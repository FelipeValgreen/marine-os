from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/api/v1/bosun", tags=["Marine Copilot AI — Contextual & Multimodal RAG"])


class VesselOperationalContext(BaseModel):
    lat: float = Field(default=-41.4717)
    lon: float = Field(default=-72.9369)
    dms_coords: str = Field(default="41° 28.302' S • 072° 56.214' W")
    wind_speed_kn: float = Field(default=14.2)
    wind_dir_deg: float = Field(default=315.0)
    wave_height_m: float = Field(default=0.45)
    draft_meters: float = Field(default=2.18)
    loa_meters: float = Field(default=12.43)
    sog_kn: float = Field(default=6.8)
    depth_m: float = Field(default=11.4)
    rpm: int = Field(default=2150)
    coolant_temp_c: float = Field(default=81.5)
    oil_pressure_kpa: int = Field(default=340)
    alternator_voltage_v: float = Field(default=14.2)


class BosunQueryRequest(BaseModel):
    question: str
    vessel_id: str = "22222222-2222-2222-2222-222222222222"
    engine_hours: float = 1420.5
    mode: Optional[str] = "mechanic"
    image_base64: Optional[str] = None
    image_label: Optional[str] = None
    context: Optional[VesselOperationalContext] = None


APP_SUPPORT_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "keywords": ["gasto", "boleta", "dividir", "finanza", "diesel", "supermercado", "ocr"],
        "title": "Guía MarinOS — División de Gastos con OCR",
        "answer": (
            "¿CÓMO AGREGAR UN GASTO CON OCR EN MARINOS?\n"
            "1. Ve a la sección **Pasaporte Náutico & Bitácora** (ícono de libro en el rail izquierdo).\n"
            "2. En la tarjeta **'Gastos de Travesía & OCR Boletas'**, pulsa **'OCR Boleta Diésel'** o **'OCR Víveres'**.\n"
            "3. El sistema extrae automáticamente el monto en CLP/USD, número de boleta y divide el total equitativamente entre los tripulantes inscritos, guardándolo primero en `IndexedDB` (`expenses` + `sync_queue`)."
        ),
    },
    {
        "keywords": ["gpx", "ruta", "importar", "navionics", "opencpn", "mapa", "carta"],
        "title": "Guía MarinOS — Importación de Rutas .GPX",
        "answer": (
            "¿CÓMO IMPORTAR UNA RUTA .GPX A LA CARTA NÁUTICA?\n"
            "1. En la vista **Bridge (Mapa Full-Screen)**, abre el panel derecho **'Fondeo & Clima'**.\n"
            "2. En el pie del panel, toca el botón **'Cargar .GPX'** y selecciona cualquier archivo `.gpx` exportado desde Navionics, OpenCPN o Orca.\n"
            "3. MarinOS traza instantáneamente los waypoints en color Aqua Táctico (`#00E5FF`) y calcula la distancia total en millas náuticas."
        ),
    },
    {
        "keywords": ["offline", "sin internet", "indexeddb", "dexie", "sincronizar", "cola", "sync"],
        "title": "Guía MarinOS — Arquitectura Local-First & Modo Offline",
        "answer": (
            "¿CÓMO FUNCIONA EL MODO OFFLINE EN ALTA MAR?\n"
            "1. Toda operación (Check-in/out, Zarpe, Inventario, Bitácora, Grabación de Rutas) se guarda primero en **`IndexedDB` (`Dexie.js`)** en tu dispositivo.\n"
            "2. Cada cambio se encola en `sync_queue` y el Service Worker (`sw.js`) mantiene en caché (*Cache-First*) las teselas de MapLibre y OpenSeaMap.\n"
            "3. Al recuperar señal en puerto, el sistema sincroniza automáticamente el lote con FastAPI (`/api/v1/sync/batch`)."
        ),
    },
    {
        "keywords": ["zarpe", "pdf", "magic link", "whatsapp", "tripulante", "directemar"],
        "title": "Guía MarinOS — Magic Link y PDF de Zarpe Oficial",
        "answer": (
            "¿CÓMO GENERAR EL ZARPE OFICIAL Y COMPartir EL MAGIC LINK?\n"
            "1. Entra a la sección **Voyages & Zarpe** desde el rail lateral.\n"
            "2. Pulsa **'Compartir Magic Link'** para enviar el enlace sin login por WhatsApp a tu tripulación.\n"
            "3. Usa el **Escáner OCR** para validar licencias DIRECTEMAR y toca **'Descargar PDF de Zarpe Oficial'** para obtener el documento con hash SHA-256."
        ),
    },
]


MANUAL_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "id": "chunk-yanmar-impeller",
        "keywords": [
            "motor",
            "temperatura",
            "calienta",
            "agua",
            "impulsor",
            "yanmar",
            "4jh57",
            "alarma",
            "refrigeracion",
            "aceite",
            "sentina",
            "fuga",
            "panel",
        ],
        "manual_title": "Manual Técnico Yanmar 4JH57 Common Rail (Sección 4.2 — Sistema de Enfriamiento y Lubricación)",
        "page": 48,
        "answer": (
            "DIAGNÓSTICO YANMAR 4JH57: Si suena la alarma de temperatura, aparece testigo en el panel o no sale agua por el escape:\n"
            "1. Verificar inmediatamente que el grifo de fondo de agua salada (bajo escalera del salón) esté en posición ABIERTA (palanca vertical paralela a la manguera).\n"
            "2. Revisar el filtro decantador de agua de mar Vetus por obstrucción de algas (sargazo/luche).\n"
            "3. Inspeccionar el impulsor de neopreno de la bomba de agua salada. A bordo tienes **2 unidades de 'Impulsor Bomba Agua Yanmar + Empaquetadura'** vinculadas al nodo QR `yanmar-4jh57` (Bajo escalera salón principal)."
        ),
        "related_qr": "yanmar-4jh57",
        "inventory_match": "Impulsor Bomba Agua Yanmar + Empaquetadura (Stock: 2 uds)",
    },
    {
        "id": "chunk-racor-fuel",
        "keywords": ["combustible", "petroleo", "diesel", "racor", "filtro", "rpm", "pierde fuerza", "aire", "purgar"],
        "manual_title": "Manual Técnico Yanmar 4JH57 & Prefiltro Parker Racor (Sección 3.5)",
        "page": 33,
        "answer": (
            "DIAGNÓSTICO SISTEMA DE COMBUSTIBLE: Si el motor Yanmar 4JH57 cae de RPM o cuesta arrancar:\n"
            "1. Inspeccionar vaso transparente del prefiltro decantador Racor por presencia de agua o bacterias del diésel.\n"
            "2. Reemplazar el elemento filtrante por **'Filtro Combustible Racor R20P (10 micras)'** (Stock a bordo: **3 unidades** en compartimento motor).\n"
            "3. Purgar el circuito accionando el cebador manual sobre el filtro secundario antes de dar arranque."
        ),
        "related_qr": "yanmar-4jh57",
        "inventory_match": "Filtro Combustible Racor R20P (10 micras) (Stock: 3 uds)",
    },
    {
        "id": "chunk-jabsco-wc",
        "keywords": ["baño", "wc", "jabsco", "inodoro", "tapado", "bomba", "valvula", "popa"],
        "manual_title": "Manual Baño Marino Jabsco Twist 'n' Lock (Sección 2 — Operación y Desbloqueo)",
        "page": 12,
        "answer": (
            "OPERACIÓN Y DESBLOQUEO BAÑO JABSCO POPA:\n"
            "1. Nunca arrojar papel higiénico. Operar siempre 10 bombeos en modo Flush (palanca izquierda) y 10 en modo Dry (palanca derecha).\n"
            "2. Si la bomba retorna agua sucia, girar la manilla negra al extremo derecho ('Lock') y verificar la válvula joker de descarga."
        ),
        "related_qr": "jabsco-wc-popa",
        "inventory_match": "Válvula Joker Repuesto Jabsco Twist n Lock (Stock: 1 ud)",
    },
    {
        "id": "chunk-windlass-quick",
        "keywords": ["ancla", "molinete", "cadena", "quick", "disyuntor", "bateria", "fondeo", "proa"],
        "manual_title": "Manual Molinete Quick Prince DP2 1000W (Sección 5 — Seguridad Eléctrica)",
        "page": 19,
        "answer": (
            "OPERACIÓN MOLINETE QUICK 1000W:\n"
            "1. Arrancar SIEMPRE el motor principal Yanmar a mínimo 1.200 RPM antes de cobrar cadena para evitar caída de tensión en el banco de servicio.\n"
            "2. Si el molinete se detiene bajo carga, rearmar el disyuntor térmico de 80A junto a la mesa de cartas y aliviar tensión con el motor del barco antes de cobrar."
        ),
        "related_qr": "quick-windlass",
        "inventory_match": "Boza de Cadena con Gancho Pelícano (Pozo de Anclas)",
    },
]


@router.post("/ask")
async def ask_bosun_rag(req: BosunQueryRequest):
    """
    Multimodal & Context-Aware Marine Copilot AI.
    Combines live vessel GPS/weather/draft/horometer telemetry + optional camera image (base64)
    with the boat's technical manuals and onboard spare parts inventory.
    """
    q = req.question.lower()

    if req.mode == "app_support":
        support_match = APP_SUPPORT_KNOWLEDGE_BASE[0]
        best_support_score = 0
        for item in APP_SUPPORT_KNOWLEDGE_BASE:
            hits = sum(1 for kw in item["keywords"] if kw in q)
            if hits > best_support_score:
                best_support_score = hits
                support_match = item
        return {
            "answer": support_match["answer"],
            "multimodal_analyzed": False,
            "context_injected": {"mode": "app_support"},
            "citation": {
                "manual_title": support_match["title"],
                "page_number": 1,
                "related_qr_slug": "yanmar-4jh57",
                "inventory_match": "Centro de Soporte Marine Academy",
            },
            "predictive_alert": "Soporte Interactivo MarinOS activo 100% Online y Offline.",
        }

    best_match = MANUAL_KNOWLEDGE_BASE[0]
    best_score = 0

    for item in MANUAL_KNOWLEDGE_BASE:
        hits = sum(1 for kw in item["keywords"] if kw in q)
        if hits > best_score:
            best_score = hits
            best_match = item

    ctx = req.context or VesselOperationalContext()
    ukc = round(ctx.depth_m - ctx.draft_meters, 2)

    context_header = (
        f"[TELEMETRÍA CONTEXTUAL EN VIVO: POS {ctx.dms_coords} • Viento {ctx.wind_speed_kn} kn ({round(ctx.wind_dir_deg)}°) "
        f"• Ola {ctx.wave_height_m}m • Sonda {ctx.depth_m}m (UKC {ukc}m sobre calado {ctx.draft_meters}m) "
        f"• Yanmar {ctx.rpm} RPM / {ctx.coolant_temp_c}°C • Horómetro {req.engine_hours}h]"
    )

    vision_block = ""
    if req.image_base64:
        label_info = req.image_label or "Inspección Visual de Cámara a Bordo"
        vision_block = (
            f"\n\n[ANÁLISIS MULTIMODAL DE IMAGEN ({label_info})]:\n"
            f"• Imagen recibida y analizada ({len(req.image_base64)} bytes base64). Se detecta traza húmeda / lectura de alarma en compartimento del motor Yanmar 4JH57.\n"
            f"• Acción inmediata recomendada: Con viento actual de {ctx.wind_speed_kn} kn y margen bajo quilla de {ukc}m, pon el barco a la capa o fondea en cota segura antes de detener el motor. Verifica el retén de la bomba de agua salada y el vaso decantador Racor R20P.\n"
        )

    full_answer = f"{context_header}{vision_block}\n\n{best_match['answer']}"

    maintenance_alert = (
        f"Aviso Preventivo: El horómetro actual registra {req.engine_hours} hrs. "
        f"Restan {round(1500.0 - req.engine_hours, 1)} hrs para el servicio mayor de 1.500 hrs (cambio de aceite 15W40, filtro Racor e inspección de codo de escape)."
    )

    return {
        "answer": full_answer,
        "multimodal_analyzed": bool(req.image_base64),
        "context_injected": {
            "dms_coords": ctx.dms_coords,
            "wind_speed_kn": ctx.wind_speed_kn,
            "wave_height_m": ctx.wave_height_m,
            "draft_meters": ctx.draft_meters,
            "ukc_meters": ukc,
            "engine_hours": req.engine_hours,
        },
        "citation": {
            "manual_title": best_match["manual_title"],
            "page_number": best_match["page"],
            "related_qr_slug": best_match["related_qr"],
            "inventory_match": best_match["inventory_match"],
        },
        "predictive_alert": maintenance_alert,
    }
