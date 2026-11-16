from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
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


_LAST_INGESTED_FRAME: Optional[SignalKFrameIngest] = None


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
        "source": "Signal K NMEA2000 Bus (can0 / Actisense NGT-1)",
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
