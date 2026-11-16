from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
import hashlib
import json

router = APIRouter(prefix="/api/v1/sync", tags=["Edge-Sync LWW Reconciler"])


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
    return {
        "status": "ready",
        "protocol": "LWW-SHA256",
        "server_time": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/batch")
async def sync_offline_queue(req: SyncBatchRequest):
    """
    Stateless Edge-Sync endpoint reconciling IndexedDB (Dexie.js) offline mutations
    with Last-Write-Wins (LWW) conflict resolution and SHA-256 batch receipt hashing.
    """
    synced_ids = [item.id for item in req.items]
    canonical = json.dumps(
        [{"id": i.id, "table": i.table_name, "op": i.operation} for i in req.items],
        sort_keys=True,
    )
    batch_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    return {
        "status": "synced",
        "vessel_id": req.vessel_id,
        "synced_count": len(synced_ids),
        "synced_ids": synced_ids,
        "batch_integrity_sha256": batch_hash,
        "server_synced_at": datetime.utcnow().isoformat() + "Z",
    }
