from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ocr, weather, zarpe, bosun, sync, signalk

app = FastAPI(
    title="Marine OS API — Nautical Copilot & Edge-Sync Backend",
    version="1.0.0",
    description="Cloud-Ready FastAPI Backend for Marine OS: Multimodal OCR, Open-Meteo Marine GRIB Anchorage Matcher, Official Zarpe PDF & DIRECTEMAR E-Zarpe API, Signal K NMEA 2000 Bridge, and Predictive Bosun RAG.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router)
app.include_router(weather.router)
app.include_router(zarpe.router)
app.include_router(bosun.router)
app.include_router(sync.router)
app.include_router(signalk.router)


@app.get("/")
async def root_status():
    return {
        "service": "marine-os-api",
        "status": "operational",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "marine-os-api",
        "version": "1.0.0",
        "modules": ["ocr", "weather", "zarpe", "bosun", "sync", "signalk"],
    }
