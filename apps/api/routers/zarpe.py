from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import base64
import hashlib
from services.pdf_generator import build_zarpe_pdf_bytes

router = APIRouter(prefix="/api/v1/zarpe", tags=["Zarpe & DIRECTEMAR E-Zarpe API"])


class CrewMemberPayload(BaseModel):
    full_name: str
    role: str = "crew"
    document_type: str = "RUT"
    document_number: str
    nationality: str = "CL"
    license_type: Optional[str] = None
    license_expiry: Optional[str] = None
    waiver_signed_at: Optional[str] = None


class ZarpeGenerateRequest(BaseModel):
    voyage_id: str = "44444444-4444-4444-4444-444444444444"
    vessel_name: str = "SV Albatros (Oceanis 41.1)"
    registration_number: str = "CB-4582"
    voyage_title: str = "Travesía Chiloé - Isla Mechuque"
    departure_port: str = "Marina Puerto Montt"
    arrival_port: str = "Caleta Mechuque"
    departure_at: str = "2026-11-17T12:00:00Z"
    crew: List[CrewMemberPayload]
    return_binary: bool = False


@router.post("/generate-pdf")
async def generate_zarpe_pdf(req: ZarpeGenerateRequest):
    """
    Compiles the Official Crew List & Maritime Zarpe PDF document.
    Supports both direct binary application/pdf response and JSON with base64 + SHA-256 verification hash.
    """
    payload_dict = req.model_dump()
    pdf_bytes = build_zarpe_pdf_bytes(payload_dict)
    sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()

    if req.return_binary:
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Zarpe_{req.registration_number}.pdf"',
                "X-Zarpe-SHA256": sha256_hash,
            },
        )

    return {
        "status": "generated",
        "filename": f"Rol_Zarpe_{req.registration_number}.pdf",
        "sha256_integrity_hash": sha256_hash,
        "crew_count": len(req.crew),
        "pdf_base64": base64.b64encode(pdf_bytes).decode("ascii"),
    }


@router.post("/transmit")
async def transmit_zarpe_to_maritime_authority(req: ZarpeGenerateRequest):
    """
    Simulates transmitting the structured JSON Voyage Manifest (Vessel, Crew, Route, ETA)
    to the DIRECTEMAR / SITPORT Maritime Authority governmental webhook and returns an
    Official Zarpe Approval Token + Patrol Verification QR payload.
    """
    payload_dict = req.model_dump()
    canonical = (
        f"{req.voyage_id}|{req.vessel_name}|{req.registration_number}|"
        f"{req.departure_port}|{req.arrival_port}|{len(req.crew)}|{req.departure_at}"
    )
    seal_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    numeric_suffix = str(int(seal_hash[:6], 16) % 9000 + 1000)
    approval_token = f"ZRP-2026-{numeric_suffix}"
    transmitted_at = datetime.utcnow().isoformat() + "Z"

    return {
        "status": "APROBADO",
        "approval_token": approval_token,
        "authority": "DIRECTEMAR — Capitanía de Puerto de Puerto Montt (Distrito Naval Chiloé)",
        "webhook_endpoint": "https://sitport.directemar.cl/api/v2/e-zarpe/despacho",
        "transmitted_at": transmitted_at,
        "vessel_name": req.vessel_name,
        "registration_number": req.registration_number,
        "pob_count": len(req.crew),
        "route": f"{req.departure_port} -> {req.arrival_port}",
        "sha256_manifest_seal": seal_hash,
        "qr_verification_payload": f"DIRECTEMAR|APROBADO|{approval_token}|CB-4582|POB:{len(req.crew)}|{seal_hash[:16]}",
    }
