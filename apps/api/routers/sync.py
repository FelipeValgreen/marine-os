from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
import hashlib
import json
import os

router = APIRouter(prefix="/api/v1/sync", tags=["Edge-Sync LWW Reconciler"])

STORE_PATH = "/tmp/marinos_lww_cloud_store.json"
_MEMORY_LWW_STORE: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _load_lww_store() -> Dict[str, Dict[str, Dict[str, Any]]]:
    global _MEMORY_LWW_STORE
    if _MEMORY_LWW_STORE:
        return _MEMORY_LWW_STORE
    if os.path.exists(STORE_PATH):
        try:
            with open(STORE_PATH, "r", encoding="utf-8") as f:
                _MEMORY_LWW_STORE = json.load(f)
        except Exception:
            _MEMORY_LWW_STORE = {}
    return _MEMORY_LWW_STORE


def _save_lww_store(store: Dict[str, Dict[str, Dict[str, Any]]]) -> None:
    try:
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False)
    except Exception:
        pass


class SyncQueueItemPayload(BaseModel):
    id: str
    table_name: str
    operation: str
    record_id: str
    payload: Dict[str, Any]
    created_offline_at: str


class SyncBatchRequest(BaseModel):
    vessel_id: str = "22222222-2222-2222-2222-222222222222"
    items: List[SyncQueueItemPayload]


@router.get("/status")
async def get_sync_status():
    store = _load_lww_store()
    total_records = sum(len(tbl) for tbl in store.values())
    return {
        "status": "ready",
        "protocol": "LWW-SHA256-Bidirectional",
        "persisted_records": total_records,
        "server_time": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/batch")
async def sync_offline_queue(req: SyncBatchRequest):
    """
    Bidirectional Edge-Sync endpoint reconciling IndexedDB (Dexie.js) offline mutations
    with Last-Write-Wins (LWW) conflict resolution, persistent storage, and SHA-256 batch receipt hashing.
    """
    store = _load_lww_store()
    vessel_bucket = store.setdefault(req.vessel_id, {})

    synced_ids: List[str] = []
    applied_lww = 0
    skipped_older = 0

    for item in req.items:
        composite_key = f"{item.table_name}::{item.record_id}"
        existing = vessel_bucket.get(composite_key)
        incoming_ts = item.created_offline_at or ""
        existing_ts = existing.get("updated_at", "") if existing else ""

        if not existing or incoming_ts >= existing_ts:
            if item.operation.upper() == "DELETE":
                vessel_bucket[composite_key] = {
                    "table_name": item.table_name,
                    "record_id": item.record_id,
                    "deleted": True,
                    "payload": {},
                    "updated_at": incoming_ts,
                }
            else:
                vessel_bucket[composite_key] = {
                    "table_name": item.table_name,
                    "record_id": item.record_id,
                    "deleted": False,
                    "payload": item.payload,
                    "updated_at": incoming_ts,
                }
            applied_lww += 1
        else:
            skipped_older += 1

        synced_ids.append(item.id)

    _save_lww_store(store)

    canonical = json.dumps(
        [{"id": i.id, "table": i.table_name, "op": i.operation} for i in req.items],
        sort_keys=True,
    )
    batch_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    return {
        "status": "synced",
        "vessel_id": req.vessel_id,
        "synced_count": len(synced_ids),
        "applied_lww_count": applied_lww,
        "skipped_older_count": skipped_older,
        "synced_ids": synced_ids,
        "batch_integrity_sha256": batch_hash,
        "server_synced_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/pull")
async def pull_vessel_synced_state(
    vessel_id: str = Query(default="22222222-2222-2222-2222-222222222222"),
):
    """
    Pulls the latest LWW-reconciled cloud state for a vessel across all tables
    to enable multi-device synchronization (Mobile <-> Tablet <-> Desktop).
    """
    store = _load_lww_store()
    vessel_bucket = store.get(vessel_id, {})
    active_records = [rec for rec in vessel_bucket.values() if not rec.get("deleted")]
    state_json = json.dumps(active_records, sort_keys=True)
    state_sha256 = hashlib.sha256(state_json.encode("utf-8")).hexdigest()

    return {
        "status": "ok",
        "vessel_id": vessel_id,
        "record_count": len(active_records),
        "state_integrity_sha256": state_sha256,
        "records": active_records,
        "pulled_at": datetime.utcnow().isoformat() + "Z",
    }
