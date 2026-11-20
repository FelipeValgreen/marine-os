from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import math
import time

router = APIRouter(prefix="/api/v1/signalk", tags=["Signal K NMEA 2000 Telemetry Bridge"])


class SignalKFrameIngest(BaseModel):
    vessel_id: str = "22222222-2222-2222-2222-222222222222"
    lat: float = -41.4717
    lon: float = -72.9369
    sog_kn: float = 6.8
    cog_deg: float = 194.0
    depth_m: float = 11.4
    aws_kn: float = 14.2
    awa_deg: float = 46.0
    rpm: int = 2150
    coolant_temp_c: float = 81.5
    oil_pressure_kpa: int = 340
    alternator_voltage_v: float = 14.2
    house_battery_soc_pct: int = 94
    engine_hours: float = 1420.5


class NMEABatchParseRequest(BaseModel):
    vessel_id: str = "22222222-2222-2222-2222-222222222222"
    sentences: List[str] = Field(
        default_factory=lambda: [
            "$GPRMC,143200.00,A,4128.3020,S,07256.2140,W,6.8,194.0,201126,,,A*7A",
            "$SDDBT,37.4,f,11.4,M,6.2,F*3B",
            "$IIMWV,46.0,R,14.2,N,A*15",
            "$YMXDR,T,81.5,C,COOLANT,P,340,K,OIL,U,14.2,V,ALT,T,2150,R,RPM*41",
        ]
    )


_LAST_INGESTED_FRAME: Optional[SignalKFrameIngest] = None


def validate_nmea_checksum(sentence: str) -> Dict[str, Any]:
    """Validates NMEA 0183 XOR checksum (*HH) if present."""
    s = sentence.strip()
    if not s.startswith("$") and not s.startswith("!"):
        return {"valid": False, "reason": "Missing $ or ! prefix"}
    if "*" not in s:
        return {"valid": True, "checksum_present": False, "computed": None}
    body, given_hex = s[1:].split("*", 1)
    given_hex = given_hex.strip()[:2].upper()
    xor_val = 0
    for ch in body:
        xor_val ^= ord(ch)
    computed_hex = f"{xor_val:02X}"
    return {
        "valid": computed_hex == given_hex,
        "checksum_present": True,
        "given": given_hex,
        "computed": computed_hex,
    }


def _nmea_coord_to_decimal(raw_val: str, hemisphere: str) -> Optional[float]:
    if not raw_val or "." not in raw_val:
        return None
    try:
        dot_idx = raw_val.index(".")
        deg_Part = int(raw_val[: dot_idx - 2])
        min_Part = float(raw_val[dot_idx - 2 :])
        dec = deg_Part + (min_Part / 60.0)
        if hemisphere.upper() in ("S", "W"):
            dec = -dec
        return round(dec, 6)
    except Exception:
        return None


def parse_single_nmea_sentence(sentence: str) -> Dict[str, Any]:
    """Decodes standard marine NMEA 0183 sentences (RMC, GGA, DBT, MWV, XDR)."""
    s = sentence.strip()
    chk = validate_nmea_checksum(s)
    clean = s.split("*")[0]
    parts = clean.split(",")
    talker_type = parts[0][1:].upper() if parts else ""
    msg_type = talker_type[-3:] if len(talker_type) >= 3 else talker_type
    extracted: Dict[str, Any] = {}

    try:
        if msg_type == "RMC" and len(parts) >= 9:
            # $GPRMC,time,status,lat,N/S,lon,E/W,sog,cog,date...
            status = parts[2].upper()
            if status == "A":
                lat = _nmea_coord_to_decimal(parts[3], parts[4])
                lon = _nmea_coord_to_decimal(parts[5], parts[6])
                if lat is not None:
                    extracted["lat"] = lat
                if lon is not None:
                    extracted["lon"] = lon
                if parts[7]:
                    extracted["sog_kn"] = round(float(parts[7]), 2)
                if parts[8]:
                    extracted["cog_deg"] = round(float(parts[8]), 1)

        elif msg_type == "GGA" and len(parts) >= 6:
            lat = _nmea_coord_to_decimal(parts[2], parts[3])
            lon = _nmea_coord_to_decimal(parts[4], parts[5])
            if lat is not None:
                extracted["lat"] = lat
            if lon is not None:
                extracted["lon"] = lon

        elif msg_type == "DBT" and len(parts) >= 5:
            # $SDDBT,feet,f,meters,M,fathoms,F
            if parts[3]:
                extracted["depth_m"] = round(float(parts[3]), 2)

        elif msg_type == "MWV" and len(parts) >= 5:
            # $IIMWV,angle,R/T,speed,N/M/K,A
            if parts[1]:
                extracted["awa_deg"] = round(float(parts[1]), 1)
            if parts[3]:
                spd = float(parts[3])
                unit = parts[4].upper() if len(parts) > 4 else "N"
                if unit == "M":
                    spd *= 1.94384
                elif unit == "K":
                    spd *= 0.539957
                extracted["aws_kn"] = round(spd, 1)

        elif msg_type == "XDR" and len(parts) >= 5:
            # Transducer quads: type,value,unit,name
            idx = 1
            while idx + 3 < len(parts):
                val_str = parts[idx + 1]
                name_str = parts[idx + 3].upper()
                if val_str:
                    val = float(val_str)
                    if "COOL" in name_str or "TEMP" in name_str:
                        extracted["coolant_temp_c"] = round(val, 1)
                    elif "OIL" in name_str:
                        extracted["oil_pressure_kpa"] = int(round(val))
                    elif "ALT" in name_str or "VOLT" in name_str or "BAT" in name_str:
                        extracted["alternator_voltage_v"] = round(val, 2)
                    elif "RPM" in name_str or "ENG" in name_str:
                        extracted["rpm"] = int(round(val))
                idx += 4
    except Exception as exc:
        extracted["parse_error"] = str(exc)

    return {
        "raw": s,
        "talker": talker_type[:2] if len(talker_type) >= 5 else "II",
        "sentence_type": msg_type,
        "checksum": chk,
        "extracted": extracted,
    }


@router.get("/telemetry")
async def get_signalk_telemetry():
    """
    Stateless Signal K / NMEA 2000 telemetry endpoint for SV Albatros (Oceanis 41.1)
    and its Yanmar 4JH57 Common Rail propulsion plant in Seno de Reloncaví / Puerto Montt.
    Returns live ingested NMEA 2000 gateway data if pushed, or real-time harmonic engine/bus telemetry.
    """
    if _LAST_INGESTED_FRAME is not None:
        f = _LAST_INGESTED_FRAME
        return {
            "vessel_id": f.vessel_id,
            "source": "Signal K NMEA2000 Gateway (Ingested Live Frame)",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "navigation": {
                "sog_kn": f.sog_kn,
                "cog_deg": f.cog_deg,
                "depth_below_transducer_m": f.depth_m,
                "position": {"lat": f.lat, "lon": f.lon},
            },
            "environment": {
                "aws_kn": f.aws_kn,
                "awa_deg": f.awa_deg,
                "water_temp_c": 11.8,
            },
            "propulsion": {
                "engine_name": "Yanmar 4JH57",
                "rpm": f.rpm,
                "coolant_temp_c": f.coolant_temp_c,
                "oil_pressure_kpa": f.oil_pressure_kpa,
                "alternator_voltage_v": f.alternator_voltage_v,
                "house_battery_soc_pct": f.house_battery_soc_pct,
                "engine_hours": f.engine_hours,
            },
        }

    t = time.time()
    return {
        "vessel_id": "22222222-2222-2222-2222-222222222222",
        "source": "simulator",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "navigation": {
            "sog_kn": round(6.8 + 0.2 * math.sin(t / 5.0), 1),
            "cog_deg": round(194 + 1.5 * math.cos(t / 8.0), 0),
            "depth_below_transducer_m": round(11.4 + 0.3 * math.sin(t / 12.0), 1),
            "position": {"lat": -41.4717, "lon": -72.9369},
        },
        "environment": {
            "aws_kn": round(14.2 + 0.8 * math.sin(t / 4.0), 1),
            "awa_deg": round(46 + 2.0 * math.cos(t / 6.0), 0),
            "water_temp_c": 11.8,
        },
        "propulsion": {
            "engine_name": "Yanmar 4JH57",
            "rpm": round(2150 + 10 * math.sin(t / 3.0)),
            "coolant_temp_c": round(81.5 + 0.3 * math.sin(t / 15.0), 1),
            "oil_pressure_kpa": round(340 + 4 * math.cos(t / 7.0)),
            "alternator_voltage_v": round(14.2 + 0.05 * math.sin(t / 9.0), 2),
            "house_battery_soc_pct": 94,
            "engine_hours": 1420.5,
        },
    }


@router.post("/ingest")
async def ingest_signalk_frame(frame: SignalKFrameIngest):
    """
    Allows an onboard Raspberry Pi / Cerbo GX / Actisense NMEA 2000 gateway to push live frames
    to the cloud backend.
    """
    global _LAST_INGESTED_FRAME
    _LAST_INGESTED_FRAME = frame
    return {
        "status": "ingested",
        "vessel_id": frame.vessel_id,
        "received_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/parse-nmea")
async def parse_and_ingest_nmea_batch(req: NMEABatchParseRequest):
    """
    Parses a batch of raw NMEA 0183 sentences ($GPRMC, $SDDBT, $IIMWV, $YMXDR),
    validates XOR checksums, updates live vessel telemetry state, and returns decoded frame.
    """
    global _LAST_INGESTED_FRAME
    base = _LAST_INGESTED_FRAME.model_dump() if _LAST_INGESTED_FRAME else SignalKFrameIngest(vessel_id=req.vessel_id).model_dump()
    parsed_results = []
    merged_fields: Dict[str, Any] = {}

    for raw_line in req.sentences:
        if not raw_line.strip():
            continue
        res = parse_single_nmea_sentence(raw_line)
        parsed_results.append(res)
        for k, v in res.get("extracted", {}).items():
            if k != "parse_error" and v is not None:
                base[k] = v
                merged_fields[k] = v

    _LAST_INGESTED_FRAME = SignalKFrameIngest(**base)

    return {
        "status": "parsed_and_ingested",
        "vessel_id": req.vessel_id,
        "sentence_count": len(parsed_results),
        "merged_telemetry": merged_fields,
        "active_frame": _LAST_INGESTED_FRAME.model_dump(),
        "sentences": parsed_results,
        "processed_at": datetime.utcnow().isoformat() + "Z",
    }
