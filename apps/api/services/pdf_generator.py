import hashlib
from datetime import datetime
from typing import Dict, Any, List


def _escape_pdf_text(text: str) -> str:
    """Escapes parentheses and backslashes for PDF content stream literals and normalizes ASCII."""
    replacements = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
        "ñ": "n", "Ñ": "N", "ü": "u", "Ü": "U", "°": " deg"
    }
    clean = text
    for k, v in replacements.items():
        clean = clean.replace(k, v)
    clean = clean.encode("ascii", "replace").decode("ascii")
    return clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_zarpe_pdf_bytes(payload: Dict[str, Any]) -> bytes:
    """
    Generates a valid standard PDF 1.4 document representing the Official Crew List & Zarpe Declaration
    (DIRECTEMAR / Maritime Authority standard format) with SHA-256 verification signature.
    """
    vessel_name = payload.get("vessel_name", "SV Albatros (Oceanis 41.1)")
    registration = payload.get("registration_number", "CB-4582")
    voyage_title = payload.get("voyage_title", "Travesia Chiloe - Isla Mechuque")
    departure_port = payload.get("departure_port", "Marina Puerto Montt")
    arrival_port = payload.get("arrival_port", "Caleta Mechuque")
    departure_at = payload.get("departure_at", datetime.utcnow().isoformat())
    crew_list: List[Dict[str, Any]] = payload.get("crew", [])

    digest_input = f"{vessel_name}|{registration}|{departure_port}|{arrival_port}|{len(crew_list)}|{departure_at}"
    verification_hash = hashlib.sha256(digest_input.encode("utf-8")).hexdigest()[:24].upper()

    lines = [
        "REPUBLICA DE CHILE - AUTORIDAD MARITIMA / DIRECTEMAR",
        "DECLARACION GENERAL DE ZARPE Y ROL DE TRIPULACION (MARINE OS DIGITAL)",
        "======================================================================",
        f"Embarcacion      : {vessel_name}   | Matricula: {registration}",
        f"Travesia         : {voyage_title}",
        f"Puerto de Zarpe  : {departure_port}",
        f"Puerto de Arribo : {arrival_port}",
        f"Fecha/Hora Zarpe : {departure_at[:19].replace('T', ' ')} UTC",
        "----------------------------------------------------------------------",
        "NOMINA DE TRIPULACION Y PASAJEROS:",
        "ROL       | NOMBRE COMPLETO           | DOCUMENTO      | LICENCIA / ATRIBUCION",
        "----------------------------------------------------------------------",
    ]

    for member in crew_list:
        role = str(member.get("role", "crew")).upper().ljust(9)[:9]
        name = str(member.get("full_name", "Tripulante")).ljust(25)[:25]
        doc = f"{member.get('document_type', 'RUT')}: {member.get('document_number', 'N/A')}".ljust(14)[:14]
        lic = str(member.get("license_type") or "Tripulante General")
        waiver = " [FIRMA OK]" if member.get("waiver_signed_at") else " [PENDIENTE]"
        lines.append(f"{role} | {name} | {doc} | {lic}{waiver}")

    lines.extend([
        "----------------------------------------------------------------------",
        "DECLARACION DE SEGURIDAD DEL CAPITAN / PATRON:",
        "Certifico que la embarcacion cuenta con elementos de seguridad SOLAS vigentes,",
        "chalecos salvavidas, pirotecnia al dia, radio VHF operativa y despacho conforme.",
        "",
        f"HASH DE INTEGRIDAD SHA-256: {verification_hash}",
        f"EMITIDO POR MARINE OS EDGE-SYNC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
    ])

    content_ops = ["BT", "/F1 10 Tf", "45 760 Td", "14 TL"]
    for idx, line in enumerate(lines):
        escaped = _escape_pdf_text(line)
        if idx == 0:
            content_ops.append(f"({escaped}) Tj")
        else:
            content_ops.append(f"T* ({escaped}) Tj")
    content_ops.append("ET")
    stream_data = "\n".join(content_ops).encode("ascii")

    objects: List[bytes] = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
    )
    objects.append(
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n"
    )
    objects.append(
        f"5 0 obj\n<< /Length {len(stream_data)} >>\nstream\n".encode("ascii")
        + stream_data
        + b"\nendstream\nendobj\n"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets: List[int] = []
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(pdf)
