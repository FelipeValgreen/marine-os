"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  QrCode,
  Upload,
  BellRing,
  Receipt,
  BookOpen,
  Plus,
  Minus,
  ExternalLink,
  Gauge,
  Volume2,
  Play,
  Pause,
  CircleDot,
  Award,
  CloudSun,
  X,
  Wind,
  Waves,
  RefreshCw,
  Activity,
  Sparkles,
  ShieldCheck,
  Compass,
  LogOut,
  Mic,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  type AnchorageSpatialRecord,
  type TrackPoint,
  type VoyageTrackRecord,
} from "@/lib/offline/db";
import {
  parseGPX,
  getDefaultChiloeGPX,
  calculateAnchorScope,
  evaluateAnchorWatch,
  formatNauticalCoordsDMS,
  triggerAcousticMarineAlarm,
  haversineDistanceMeters,
} from "@/lib/nautical";
import { useMarineContext } from "@/components/ThemeProvider";
import { NauticalMap } from "@/components/NauticalMap";
import { HandoverWizard } from "@/components/HandoverWizard";
import { VoyagesZarpeView } from "@/components/VoyagesZarpeView";
import {
  MarineCopilot,
  type CopilotTelemetryContext,
} from "@/components/MarineCopilot";
import { ContextualTooltip } from "@/components/ContextualTooltip";
import { MarineAcademy } from "@/components/MarineAcademy";
import { DamageControl } from "@/components/DamageControl";

interface LiveMarineWeatherState {
  source: string;
  windSpeedKn: number;
  windGustKn: number;
  windDirDeg: number;
  waveHeightM: number;
  wavePeriodS: number;
  waveDirDeg: number;
  temperatureC: number;
  score: number;
  status: string;
  warnings: string[];
  recommendations: string[];
  loading: boolean;
}

interface SignalKTelemetryState {
  lat: number;
  lon: number;
  sog_kn: number;
  cog_deg: number;
  depth_m: number;
  aws_kn: number;
  awa_deg: number;
  rpm: number;
  coolant_temp_c: number;
  oil_pressure_kpa: number;
  alternator_voltage_v: number;
  house_battery_soc_pct: number;
  bus_source: string;
  connected: boolean;
}

function degreesToCardinal(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSO",
    "SO",
    "OSO",
    "O",
    "ONO",
    "NO",
    "NNO",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Computes expiration semaphore status for the Nautical Passport Wallet:
 * - Green (#00E676): > 180 days (> 6 months)
 * - Amber (#FF9F0A): 30 to 180 days
 * - Red (#FF2D55): < 30 days
 */
function evaluateLicenseExpirySemaphore(expiryDateStr: string): {
  daysRemaining: number;
  tone: "green" | "amber" | "red";
  badgeLabel: string;
} {
  const target = new Date(expiryDateStr).getTime();
  const now = Date.now();
  const daysRemaining = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (daysRemaining > 180) {
    return {
      daysRemaining,
      tone: "green",
      badgeLabel: "VIGENTE (> 6 MESES)",
    };
  }
  if (daysRemaining >= 30) {
    return {
      daysRemaining,
      tone: "amber",
      badgeLabel: `POR VENCER (${daysRemaining} DÍAS)`,
    };
  }
  return {
    daysRemaining,
    tone: "red",
    badgeLabel:
      daysRemaining >= 0
        ? `CRÍTICO (< 30 DÍAS: ${daysRemaining}d)`
        : "LICENCIA VENCIDA",
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MarineOSHomePage() {
  const {
    theme,
    activeAccount,
    updatePassportProfile,
    logoutSession,
    activeSection,
    requestedVesselSubView,
    clearRequestedVesselSubView,
    openCommandCenter,
    isOffline,
    pushToast,
    relaunchSeaTrials,
  } = useMarineContext();
  const isNight = theme === "night-red-shift";

  // Live Dexie IndexedDB Queries
  const vessel = useLiveQuery(() => db.vessels.get(DEMO_IDS.VESSEL_ID), []);
  const qrNodes = useLiveQuery(() => db.vessel_systems_qr.toArray(), [], []);
  const inventoryItems = useLiveQuery(
    () => db.inventory_items.toArray(),
    [],
    []
  );
  const anchorages = useLiveQuery(
    () => db.anchorages_spatial.toArray(),
    [],
    []
  );
  const crewList = useLiveQuery(() => db.voyage_crew.toArray(), [], []);
  const logbookEntries = useLiveQuery(
    () => db.logbook_entries.reverse().sortBy("timestamp"),
    [],
    []
  );
  const expenses = useLiveQuery(() => db.expenses.toArray(), [], []);
  const savedTracks = useLiveQuery(() => db.voyage_tracks.toArray(), [], []);

  // =========================================================================
  // 1. BRIDGE: REAL SIGNAL K / NMEA 2000 TELEMETRY + NATIVE GPS + OPEN-METEO
  // =========================================================================
  const [gpsMode, setGpsMode] = useState<"simulator" | "native_gps">(
    "simulator"
  );
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<
    "anchorage" | "routing" | "copilot"
  >("anchorage");
  const [vesselSubView, setVesselSubView] = useState<
    "digital_twin" | "damage_control"
  >("digital_twin");
  const [soundAlarmEnabled, setSoundAlarmEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (requestedVesselSubView) {
      setVesselSubView(requestedVesselSubView);
      clearRequestedVesselSubView();
    }
  }, [requestedVesselSubView, clearRequestedVesselSubView]);

  const [departureWindowId, setDepartureWindowId] = useState<
    "now" | "in_2h" | "in_6h" | "tomorrow_0800"
  >("in_2h");
  const [passagePlan, setPassagePlan] = useState({
    label: "Zarpar en 2 hrs (Ventana Óptima)",
    avg_wind_kn: 14.2,
    max_gust_kn: 18.5,
    wind_dir_deg: 315,
    wave_height_m: 0.42,
    predicted_sog_kn: 7.1,
    eta_hours: 7.4,
    comfort_score: 96,
    status: "OPTIMAL",
    sail_plan: "Mayor Full + Génova 100% (Aleta / Largo 135° TWA)",
    tactical_summary:
      "VENTANA ÓPTIMA DE CRUCE: Viento entablado del NO de 14 kn en popa redonda y estoa de marea en Paso Maillén.",
    forecast_48h: [
      { offset_h: "+0h", wind_kn: 16.5, gust_kn: 23.0, dir_deg: 295, wave_m: 0.65, rating: "GOOD" },
      { offset_h: "+2h", wind_kn: 14.2, gust_kn: 18.5, dir_deg: 315, wave_m: 0.42, rating: "OPTIMAL" },
      { offset_h: "+6h", wind_kn: 24.8, gust_kn: 33.5, dir_deg: 195, wave_m: 1.45, rating: "CAUTION" },
      { offset_h: "+12h", wind_kn: 21.0, gust_kn: 28.0, dir_deg: 200, wave_m: 1.15, rating: "CAUTION" },
      { offset_h: "+24h", wind_kn: 12.8, gust_kn: 16.4, dir_deg: 330, wave_m: 0.35, rating: "OPTIMAL" },
      { offset_h: "+36h", wind_kn: 15.0, gust_kn: 19.8, dir_deg: 310, wave_m: 0.5, rating: "GOOD" },
      { offset_h: "+48h", wind_kn: 18.2, gust_kn: 24.5, dir_deg: 285, wave_m: 0.8, rating: "GOOD" },
    ],
  });

  useEffect(() => {
    let active = true;
    async function loadPassagePlan() {
      if (!isOffline) {
        try {
          const res = await fetch(
            `${API_URL}/api/v1/weather/passage-planner?departure_window=${departureWindowId}`
          );
          if (res.ok && active) {
            const data = await res.json();
            setPassagePlan({
              ...data.selected_window,
              forecast_48h: data.forecast_48h,
            });
            return;
          }
        } catch {
          // Offline fallback
        }
      }
    }
    loadPassagePlan();
    return () => {
      active = false;
    };
  }, [departureWindowId, isOffline]);

  const [telemetry, setTelemetry] = useState<SignalKTelemetryState>({
    lat: -41.4717,
    lon: -72.9369,
    sog_kn: 6.8,
    cog_deg: 194,
    depth_m: 11.4,
    aws_kn: 14.2,
    awa_deg: 46,
    rpm: 2150,
    coolant_temp_c: 81.5,
    oil_pressure_kpa: 340,
    alternator_voltage_v: 14.2,
    house_battery_soc_pct: 94,
    bus_source: "Signal K NMEA2000 Bus (can0)",
    connected: true,
  });

  // Real Asynchronous Connection to FastAPI `/api/v1/signalk/telemetry`
  useEffect(() => {
    let active = true;

    async function pollSignalKBus() {
      if (isOffline) {
        if (active) {
          setTelemetry((prev) => ({
            ...prev,
            bus_source: "Signal K Local Edge Cache (can0)",
            connected: false,
          }));
        }
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/v1/signalk/telemetry`);
        if (res.ok && active) {
          const data = await res.json();
          setTelemetry((prev) => ({
            ...prev,
            sog_kn:
              gpsMode === "simulator"
                ? Number(data.navigation?.sog_kn ?? 6.8)
                : prev.sog_kn,
            cog_deg:
              gpsMode === "simulator"
                ? Number(data.navigation?.cog_deg ?? 194)
                : prev.cog_deg,
            depth_m: Number(
              data.navigation?.depth_below_transducer_m ?? prev.depth_m
            ),
            aws_kn: Number(data.environment?.aws_kn ?? prev.aws_kn),
            awa_deg: Number(data.environment?.awa_deg ?? prev.awa_deg),
            rpm: Number(data.propulsion?.rpm ?? 2150),
            coolant_temp_c: Number(data.propulsion?.coolant_temp_c ?? 81.5),
            oil_pressure_kpa: Number(data.propulsion?.oil_pressure_kpa ?? 340),
            alternator_voltage_v: Number(
              data.propulsion?.alternator_voltage_v ?? 14.2
            ),
            house_battery_soc_pct: Number(
              data.propulsion?.house_battery_soc_pct ?? 94
            ),
            bus_source:
              data.source || "Signal K NMEA2000 Bus (can0 / Actisense NGT-1)",
            connected: true,
          }));
        }
      } catch {
        if (active) {
          setTelemetry((prev) => ({
            ...prev,
            connected: false,
          }));
        }
      }
    }

    pollSignalKBus();
    const interval = setInterval(pollSignalKBus, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOffline, gpsMode]);

  // Real Native Geolocation `watchPosition`
  useEffect(() => {
    if (gpsMode !== "native_gps") return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      pushToast({
        title: "Geolocation API no disponible",
        subtitle: "Manteniendo coordenadas de respaldo Seno de Reloncaví",
        tone: "amber",
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const sogKn =
          pos.coords.speed !== null && !Number.isNaN(pos.coords.speed)
            ? Math.round(pos.coords.speed * 1.94384 * 10) / 10
            : 6.2;
        const cogDeg =
          pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)
            ? Math.round(pos.coords.heading)
            : 190;
        setTelemetry((prev) => ({
          ...prev,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          sog_kn: sogKn,
          cog_deg: cogDeg,
        }));
      },
      () => {
        // Keep last valid fix if permission denied
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsMode]);

  const [gpxXml, setGpxXml] = useState<string>(() => getDefaultChiloeGPX());
  const parsedRoute = parseGPX(gpxXml);

  const [selectedAnchorageSlug, setSelectedAnchorageSlug] = useState<string>(
    "marina-puerto-montt"
  );
  const selectedAnchorage: AnchorageSpatialRecord | null =
    anchorages.find((a) => a.slug === selectedAnchorageSlug) ||
    anchorages[0] ||
    null;

  // Real Live Open-Meteo Weather & Marine State
  const [liveWeather, setLiveWeather] = useState<LiveMarineWeatherState>({
    source: "open-meteo-live",
    windSpeedKn: 14.2,
    windGustKn: 19.8,
    windDirDeg: 315,
    waveHeightM: 0.45,
    wavePeriodS: 5.8,
    waveDirDeg: 295,
    temperatureC: 12.6,
    score: 92,
    status: "SAFE",
    warnings: [],
    recommendations: [
      "Excelente abrigo orográfico frente al viento actual.",
      "Margen bajo quilla seguro sobre calado de 2.18m.",
    ],
    loading: false,
  });

  const fetchLiveOpenMeteoAndScore = async (
    anchorage: AnchorageSpatialRecord | null
  ) => {
    const lat = anchorage?.lat ?? -41.4717;
    const lon = anchorage?.lon ?? -72.9369;
    const slug = anchorage?.slug ?? "marina-puerto-montt";

    setLiveWeather((prev) => ({ ...prev, loading: true }));

    try {
      if (!isOffline) {
        const apiRes = await fetch(
          `${API_URL}/api/v1/weather/anchorage-score?anchorage_slug=${slug}&lat=${lat}&lon=${lon}&vessel_draft_m=${vessel?.draft_meters || 2.18
          }`
        );
        if (apiRes.ok) {
          const data = await apiRes.json();
          setLiveWeather({
            source: data.weather.source || "open-meteo-live",
            windSpeedKn: data.weather.wind_speed_kn,
            windGustKn: data.weather.wind_gust_kn,
            windDirDeg: data.weather.wind_dir_deg,
            waveHeightM: data.weather.wave_height_m,
            wavePeriodS: data.weather.wave_period_s ?? 5.6,
            waveDirDeg: data.weather.wave_dir_deg ?? 290,
            temperatureC: data.weather.temperature_c ?? 12.4,
            score: data.evaluation.score,
            status: data.evaluation.status,
            warnings: data.evaluation.warnings || [],
            recommendations: data.evaluation.recommendations || [],
            loading: false,
          });
          return;
        }
      }

      const [wResp, mResp] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn`
        ),
        fetch(
          `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period`
        ),
      ]);

      let windSpeedKn = liveWeather.windSpeedKn;
      let windGustKn = liveWeather.windGustKn;
      let windDirDeg = liveWeather.windDirDeg;
      let temperatureC = liveWeather.temperatureC;
      let waveHeightM = liveWeather.waveHeightM;
      let wavePeriodS = liveWeather.wavePeriodS;
      let waveDirDeg = liveWeather.waveDirDeg;

      if (wResp.ok) {
        const wData = (await wResp.json()).current || {};
        if (wData.wind_speed_10m !== undefined)
          windSpeedKn = Number(wData.wind_speed_10m);
        if (wData.wind_gusts_10m !== undefined)
          windGustKn = Number(wData.wind_gusts_10m);
        if (wData.wind_direction_10m !== undefined)
          windDirDeg = Number(wData.wind_direction_10m);
        if (wData.temperature_2m !== undefined)
          temperatureC = Number(wData.temperature_2m);
      }

      if (mResp.ok) {
        const mData = (await mResp.json()).current || {};
        if (mData.wave_height !== undefined && mData.wave_height !== null)
          waveHeightM = Number(mData.wave_height);
        if (mData.wave_period !== undefined && mData.wave_period !== null)
          wavePeriodS = Number(mData.wave_period);
        if (mData.wave_direction !== undefined && mData.wave_direction !== null)
          waveDirDeg = Number(mData.wave_direction);
      }

      setLiveWeather((prev) => ({
        ...prev,
        source: "open-meteo-direct",
        windSpeedKn,
        windGustKn,
        windDirDeg,
        temperatureC,
        waveHeightM,
        wavePeriodS,
        waveDirDeg,
        loading: false,
      }));
    } catch {
      setLiveWeather((prev) => ({
        ...prev,
        source: "indexeddb-grib-cache",
        loading: false,
      }));
    }
  };

  useEffect(() => {
    fetchLiveOpenMeteoAndScore(selectedAnchorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnchorageSlug, isOffline]);

  const scopeCalc = calculateAnchorScope({
    depthMeters: selectedAnchorage?.min_depth_m ?? 6.4,
    tideAmplitudeMeters: selectedAnchorage?.tide_amplitude_m ?? 6.1,
    freeboardMeters: 1.4,
    windSpeedKnots: liveWeather.windSpeedKn,
    seabedType: selectedAnchorage?.seabed_type ?? "sand",
    vesselLoaMeters: vessel?.loa_meters ?? 12.43,
  });

  const anchorLat = selectedAnchorage?.lat ?? -41.4717;
  const anchorLon = selectedAnchorage?.lon ?? -72.9369;
  const [vesselOffsetMeters, setVesselOffsetMeters] = useState<number>(24);

  const effectiveVesselLat =
    gpsMode === "native_gps"
      ? telemetry.lat
      : anchorLat - vesselOffsetMeters / 111320;
  const effectiveVesselLon =
    gpsMode === "native_gps"
      ? telemetry.lon
      : anchorLon + (vesselOffsetMeters * 0.4) / 82000;

  const currentDms = formatNauticalCoordsDMS(
    effectiveVesselLat,
    effectiveVesselLon
  );

  const anchorWatch = evaluateAnchorWatch(
    anchorLat,
    anchorLon,
    effectiveVesselLat,
    effectiveVesselLon,
    scopeCalc.swingRadiusMeters
  );

  const copilotContext: CopilotTelemetryContext = {
    lat: effectiveVesselLat,
    lon: effectiveVesselLon,
    dms_coords: currentDms.combined,
    wind_speed_kn: liveWeather.windSpeedKn,
    wind_dir_deg: liveWeather.windDirDeg,
    wave_height_m: liveWeather.waveHeightM,
    draft_meters: vessel?.draft_meters ?? 2.18,
    loa_meters: vessel?.loa_meters ?? 12.43,
    sog_kn: telemetry.sog_kn,
    depth_m: telemetry.depth_m,
    rpm: telemetry.rpm,
    coolant_temp_c: telemetry.coolant_temp_c,
    oil_pressure_kpa: telemetry.oil_pressure_kpa,
    alternator_voltage_v: telemetry.alternator_voltage_v,
    engine_hours: vessel?.engine_hours_current ?? 1420.5,
  };

  const handleSimulateDragWithAudio = () => {
    setVesselOffsetMeters(Math.ceil(scopeCalc.swingRadiusMeters + 22));
    if (soundAlarmEnabled) {
      triggerAcousticMarineAlarm();
    }
    pushToast({
      title: "¡Alarma de Garreo Activada!",
      subtitle: "El barco ha excedido el radio seguro de borneo",
      tone: "coral",
    });
  };

  const handleGPXFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setGpxXml(reader.result);
        pushToast({
          title: `Ruta GPX Importada: ${file.name}`,
          subtitle: "Renderizada sobre carta vectorial MapLibre",
          tone: "cyan",
        });
      }
    };
    reader.readAsText(file);
  };

  // =========================================================================
  // 2. VESSEL: HOROMETER & INVENTORY
  // =========================================================================
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("repuestos_motor");

  const handleIncrementEngineHours = async (delta: number) => {
    if (!vessel) return;
    const nextHours =
      Math.round((vessel.engine_hours_current + delta) * 10) / 10;
    await db.vessels.update(vessel.id, { engine_hours_current: nextHours });
    await enqueueOfflineMutation({
      table_name: "vessels",
      operation: "UPDATE",
      record_id: vessel.id,
      payload: { id: vessel.id, engine_hours_current: nextHours },
    });
    pushToast({
      title: `Horómetro Actualizado: ${nextHours} hrs`,
      subtitle: "Sincronizado en IndexedDB (vessels)",
      tone: "cyan",
    });
  };

  const handleAdjustInventoryStock = async (
    itemId: string,
    delta: number,
    currentQty: number
  ) => {
    const nextQty = Math.max(0, currentQty + delta);
    const updatedAt = new Date().toISOString();
    await db.inventory_items.update(itemId, {
      quantity: nextQty,
      updated_at: updatedAt,
    });
    await enqueueOfflineMutation({
      table_name: "inventory_items",
      operation: "UPDATE",
      record_id: itemId,
      payload: { id: itemId, quantity: nextQty, updated_at: updatedAt },
    });
  };

  const handleAddInventoryItemOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const id = `inv-${Date.now()}`;
    const record = {
      id,
      vessel_id: DEMO_IDS.VESSEL_ID,
      qr_node_id: DEMO_IDS.QR_YANMAR_ID,
      item_name: newItemName.trim(),
      category: newItemCategory,
      quantity: 1,
      min_threshold: 1,
      expiration_date: null,
      updated_at: new Date().toISOString(),
    };
    await db.inventory_items.put(record);
    await enqueueOfflineMutation({
      table_name: "inventory_items",
      operation: "INSERT",
      record_id: id,
      payload: record,
    });
    setNewItemName("");
  };

  // =========================================================================
  // 5. DIGITAL NAUTICAL PASSPORT (APPLE WALLET) + SEA TIME LOG + REPLAY
  // =========================================================================
  const [isRecordingTrack, setIsRecordingTrack] = useState<boolean>(false);
  const [recordedPoints, setRecordedPoints] = useState<TrackPoint[]>([]);
  const [selectedReplayTrackId, setSelectedReplayTrackId] = useState<string>(
    "track-chiloe-mechuque-01"
  );
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [logNote, setLogNote] = useState<string>("");
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);

  const commitVoiceLogEntryToIndexedDB = async (transcribedText: string) => {
    const id = `log-voice-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const currentHorometer = vessel?.engine_hours_current ?? 1420.5;
    const entry = {
      id,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      timestamp,
      lat: effectiveVesselLat,
      lon: effectiveVesselLon,
      sog_kn: telemetry.sog_kn,
      cog_deg: telemetry.cog_deg,
      wind_kn: liveWeather.windSpeedKn,
      engine_hours: currentHorometer,
      notes: `[VOZ] ${transcribedText}`,
      author: activeAccount.name,
    };
    await db.logbook_entries.put(entry);
    await enqueueOfflineMutation({
      table_name: "logbook_entries",
      operation: "INSERT",
      record_id: id,
      payload: entry,
    });
    pushToast({
      title: "Bitácora de Voz Registrada (Zero Data Entry)",
      subtitle: `"${transcribedText}" • ${currentDms.combined} • ${currentHorometer}h`,
      tone: "emerald",
    });
  };

  const handleTriggerVoiceLogbook = () => {
    if (isListeningVoice) return;
    setIsListeningVoice(true);

    // Check Web Speech API support
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              SpeechRecognition?: new () => {
                lang: string;
                interimResults: boolean;
                maxAlternatives: number;
                onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
                onerror: (() => void) | null;
                onend: (() => void) | null;
                start: () => void;
              };
              webkitSpeechRecognition?: new () => {
                lang: string;
                interimResults: boolean;
                maxAlternatives: number;
                onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
                onerror: (() => void) | null;
                onend: (() => void) | null;
                start: () => void;
              };
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              webkitSpeechRecognition?: new () => {
                lang: string;
                interimResults: boolean;
                maxAlternatives: number;
                onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
                onerror: (() => void) | null;
                onend: (() => void) | null;
                start: () => void;
              };
            }
          ).webkitSpeechRecognition
        : undefined;

    if (SpeechRecognitionCtor) {
      try {
        let resolved = false;
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "es-CL";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        const fallbackTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            setIsListeningVoice(false);
            commitVoiceLogEntryToIndexedDB(
              "Cruzando Canal Tenglo, todo en orden — motor 2.150 RPM y sin novedades"
            );
          }
        }, 1800);

        recognition.onresult = (event) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(fallbackTimer);
          const transcript =
            event.results?.[0]?.[0]?.transcript ||
            "Cruzando Canal Tenglo, todo en orden";
          setIsListeningVoice(false);
          commitVoiceLogEntryToIndexedDB(transcript);
        };

        recognition.onerror = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(fallbackTimer);
          setIsListeningVoice(false);
          commitVoiceLogEntryToIndexedDB(
            "Cruzando Canal Tenglo, todo en orden — rumbo 194°M"
          );
        };

        recognition.start();
        return;
      } catch {
        // Fallback below
      }
    }

    setTimeout(() => {
      setIsListeningVoice(false);
      commitVoiceLogEntryToIndexedDB(
        "Cruzando Canal Tenglo, todo en orden — viento 14 nudos y sentina seca"
      );
    }, 650);
  };

  const activeReplayTrack: VoyageTrackRecord | undefined =
    savedTracks.find((t) => t.id === selectedReplayTrackId) || savedTracks[0];

  // Dynamic Sea Time Log: Sum of all recorded tracks in IndexedDB + certified base miles
  const loggedTrackMilesNm =
    Math.round(
      savedTracks.reduce((sum, trk) => sum + (trk.distance_nm || 0), 0) * 10
    ) / 10;
  const totalSeaTimeMilesNm =
    Math.round((activeAccount.loggedMilesNm + loggedTrackMilesNm) * 10) / 10;

  const semaphore = evaluateLicenseExpirySemaphore(activeAccount.licenseExpiry);

  useEffect(() => {
    if (!isRecordingTrack) return;
    const timer = setInterval(() => {
      setRecordedPoints((prev) => {
        const step = prev.length;
        const nextLat = effectiveVesselLat - step * 0.0045;
        const nextLon = effectiveVesselLon - step * 0.0032;
        return [
          ...prev,
          {
            lat: nextLat,
            lon: nextLon,
            sog_kn: telemetry.sog_kn,
            cog_deg: telemetry.cog_deg,
            depth_m: telemetry.depth_m,
            timestamp: new Date().toISOString().slice(11, 19) + " UTC",
          },
        ];
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [
    isRecordingTrack,
    effectiveVesselLat,
    effectiveVesselLon,
    telemetry.sog_kn,
    telemetry.cog_deg,
    telemetry.depth_m,
  ]);

  useEffect(() => {
    if (!isReplaying || !activeReplayTrack) return;
    const timer = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= activeReplayTrack.points.length - 1) {
          setIsReplaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [isReplaying, activeReplayTrack]);

  const handleToggleTrackRecording = async () => {
    if (!isRecordingTrack) {
      setRecordedPoints([
        {
          lat: effectiveVesselLat,
          lon: effectiveVesselLon,
          sog_kn: telemetry.sog_kn,
          cog_deg: telemetry.cog_deg,
          depth_m: telemetry.depth_m,
          timestamp: new Date().toISOString().slice(11, 19) + " UTC",
        },
        {
          lat: effectiveVesselLat - 0.006,
          lon: effectiveVesselLon - 0.004,
          sog_kn: 6.8,
          cog_deg: 196,
          depth_m: 12.4,
          timestamp: new Date().toISOString().slice(11, 19) + " UTC",
        },
      ]);
      setIsRecordingTrack(true);
      pushToast({
        title: "Grabación de Track GPS Iniciada",
        subtitle: "Registrando coordenadas en vivo",
        tone: "cyan",
      });
    } else {
      setIsRecordingTrack(false);
      if (recordedPoints.length > 0) {
        let distMeters = 0;
        for (let i = 1; i < recordedPoints.length; i++) {
          distMeters += haversineDistanceMeters(
            recordedPoints[i - 1].lat,
            recordedPoints[i - 1].lon,
            recordedPoints[i].lat,
            recordedPoints[i].lon
          );
        }
        const distNm = Math.max(
          1.2,
          Math.round((distMeters / 1852) * 10) / 10
        );
        const trackId = `track-live-${Date.now()}`;
        const newTrack: VoyageTrackRecord = {
          id: trackId,
          voyage_id: DEMO_IDS.VOYAGE_ID,
          title: `Track Grabado en Vivo (${activeAccount.name})`,
          skipper_name: activeAccount.name,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          distance_nm: distNm,
          max_sog_kn: 7.4,
          avg_sog_kn: 6.5,
          points: recordedPoints,
        };
        await db.voyage_tracks.put(newTrack);
        await enqueueOfflineMutation({
          table_name: "voyage_tracks",
          operation: "INSERT",
          record_id: trackId,
          payload: newTrack as unknown as Record<string, unknown>,
        });
        setSelectedReplayTrackId(trackId);
        setReplayIndex(0);
        pushToast({
          title: `Sea Time Log +${distNm} MN Registradas`,
          subtitle: `${recordedPoints.length} puntos guardados en IndexedDB`,
          tone: "emerald",
        });
      }
    }
  };

  const handleAddLogbookEntryOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logNote.trim()) return;
    const id = `log-${Date.now()}`;
    const entry = {
      id,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      timestamp: new Date().toISOString(),
      lat: effectiveVesselLat,
      lon: effectiveVesselLon,
      sog_kn: telemetry.sog_kn,
      cog_deg: telemetry.cog_deg,
      wind_kn: liveWeather.windSpeedKn,
      engine_hours: vessel?.engine_hours_current || 1420.5,
      notes: logNote.trim(),
      author: activeAccount.name,
    };
    await db.logbook_entries.put(entry);
    await enqueueOfflineMutation({
      table_name: "logbook_entries",
      operation: "INSERT",
      record_id: id,
      payload: entry,
    });
    setLogNote("");
  };

  const handleScanReceiptOCR = async (hint: "diesel" | "provisions") => {
    let title = "Carga Diesel Marino COPEC (OCR)";
    let amountUsd = 178;
    let amountClp = 168500;
    let receiptNo = "BOL-884920";

    if (!isOffline) {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/ocr/expense-receipt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receipt_hint: hint }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          title = data.merchant_name;
          amountUsd = data.total_amount_usd;
          amountClp = data.total_amount_clp;
          receiptNo = data.receipt_number;
        }
      } catch {
        // Fallback local OCR
      }
    } else if (hint === "provisions") {
      title = "Aprovisionamiento Supermercado Puerto Montt (OCR Offline)";
      amountUsd = 260;
      amountClp = 245900;
      receiptNo = "BOL-441092";
    }

    const id = `exp-${Date.now()}`;
    const newExpense = {
      id,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      title,
      category: (hint === "diesel" ? "fuel" : "provisions") as
        | "fuel"
        | "provisions",
      amount_usd: amountUsd,
      amount_clp: amountClp,
      paid_by: activeAccount.name,
      receipt_number: receiptNo,
      ocr_verified: true,
      created_at: new Date().toISOString(),
    };
    await db.expenses.put(newExpense);
    await enqueueOfflineMutation({
      table_name: "expenses",
      operation: "INSERT",
      record_id: id,
      payload: newExpense,
    });
    pushToast({
      title: `Boleta Escaneada (${receiptNo})`,
      subtitle: `${title} • USD $${amountUsd}`,
      tone: "emerald",
    });
  };

  const totalExpensesUsd = expenses.reduce((acc, e) => acc + e.amount_usd, 0);
  const perPersonUsd =
    crewList.length > 0
      ? Math.round((totalExpensesUsd / crewList.length) * 100) / 100
      : totalExpensesUsd;

  const replayPoint: TrackPoint | undefined =
    activeReplayTrack?.points[
    Math.min(replayIndex, (activeReplayTrack?.points.length || 1) - 1)
    ];

  // ===========================================================================
  // VIEW 1: BRIDGE (100vw x 100vh FULLSCREEN REAL CHART + MINIMALIST HUD + DRAWER)
  // ===========================================================================
  if (activeSection === "bridge") {
    return (
      <div className="relative w-screen h-screen overflow-hidden select-none">
        {/* 100vw x 100vh Fullscreen Real Cartography (Carto Dark Matter + OpenSeaMap) */}
        <NauticalMap
          fullScreen={true}
          waypoints={parsedRoute.waypoints}
          anchorages={anchorages}
          selectedAnchorage={selectedAnchorage}
          vesselPosition={{
            lat: effectiveVesselLat,
            lon: effectiveVesselLon,
          }}
          anchorPosition={{ lat: anchorLat, lon: anchorLon }}
          swingRadiusMeters={scopeCalc.swingRadiusMeters}
          isDragging={anchorWatch.isDragging}
          isNight={isNight}
          trackPoints={
            isRecordingTrack ? recordedPoints : activeReplayTrack?.points || []
          }
          onSelectAnchorage={(a) => {
            setSelectedAnchorageSlug(a.slug);
            setDrawerTab("anchorage");
            setDrawerOpen(true);
          }}
        />

        {/* 1. TOP-LEFT COMPACT PILL + LIVE YANMAR 4JH57 SIGNAL K CAPSULE */}
        <div className="fixed top-4 left-3 lg:left-20 z-30 flex flex-wrap items-center gap-2 max-w-[calc(100vw-9rem)]">
          <div className="marine-pill px-3.5 py-2 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse" />
              <span className="font-semibold text-xs sm:text-sm tracking-tight">
                SV Albatros
              </span>
            </div>

            <span className="opacity-25">|</span>

            <span
              data-testid="nautical-dms-coords"
              className="font-mono text-xs sm:text-sm font-medium text-[#00E5FF] truncate"
            >
              {currentDms.combined}
            </span>

            <span className="hidden sm:inline opacity-25">|</span>

            <div className="relative inline-flex items-center rounded-full bg-black/40 p-1 border border-white/10">
              <button
                type="button"
                data-testid="gps-mode-simulator-btn"
                onClick={() => setGpsMode("simulator")}
                className={`min-h-14 px-3.5 py-1 rounded-full text-xs font-mono font-medium transition ${gpsMode === "simulator"
                  ? "bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-bold"
                  : "opacity-70 hover:opacity-100"
                  }`}
              >
                SIM
              </button>
              <button
                type="button"
                data-testid="gps-mode-native-btn"
                onClick={() => setGpsMode("native_gps")}
                className={`min-h-14 px-3.5 py-1 rounded-full text-xs font-mono font-medium transition ${gpsMode === "native_gps"
                  ? "bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-bold"
                  : "opacity-70 hover:opacity-100"
                  }`}
              >
                GPS REAL
              </button>
              <ContextualTooltip
                preferenceKey="tooltip_gps_seen"
                title="Conmutador GPS Real / Simulador"
                description="Alterna en vivo entre el GPS Nativo del dispositivo (watchPosition) y el Simulador del Seno de Reloncaví."
                positionClass="top-full left-0 mt-3"
              />
            </div>
          </div>

          <div
            data-testid="signalk-engine-pill"
            className="hidden xl:flex marine-pill px-3.5 py-2 items-center gap-3 font-mono text-xs"
          >
              <Activity className="w-3.5 h-3.5 text-[#00E676]" />
              <span>YANMAR {telemetry.rpm} RPM</span>
              <span className="opacity-25">•</span>
              <span>{telemetry.coolant_temp_c.toFixed(1)}°C</span>
              <span className="opacity-25">•</span>
              <span>{telemetry.oil_pressure_kpa} kPa</span>
              <span className="opacity-25">•</span>
              <span className="text-[#00E5FF]">
                {telemetry.alternator_voltage_v.toFixed(1)}V
              </span>
            </div>
          </div>

        {/* 2. TOP-RIGHT FLOATING BUTTONS ("⌘K", "Planificador 48h", "Copiloto IA" + "Fondeo & Clima") */}
        <div className="fixed top-4 right-3 sm:right-4 z-30 flex items-center gap-2">
          <button
            type="button"
            data-testid="bridge-cmd-k-btn"
            onClick={openCommandCenter}
            title="Abrir Command Center (⌘K)"
            className="marine-pill min-h-14 px-3.5 py-2.5 flex items-center gap-1.5 font-mono text-xs font-bold"
          >
            <span className="text-[var(--accent-primary)]">⌘K</span>
            <span className="hidden lg:inline">Comando</span>
          </button>

          <button
            type="button"
            data-testid="open-passage-planner-btn"
            onClick={() => {
              setDrawerTab("routing");
              setDrawerOpen(true);
            }}
            className={`marine-pill min-h-14 px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold transition ${
              drawerOpen && drawerTab === "routing"
                ? "border-[var(--accent-primary)]/60 text-[var(--accent-primary)]"
                : ""
            }`}
          >
            <Compass className="w-4 h-4 text-[#00E676] shrink-0" />
            <span className="hidden md:inline">Planificador 48h</span>
          </button>

          <button
            type="button"
            data-testid="open-copilot-drawer-btn"
            onClick={() => {
              setDrawerTab("copilot");
              setDrawerOpen(true);
            }}
            className={`marine-pill min-h-14 px-4 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold transition ${drawerOpen && drawerTab === "copilot"
              ? "border-[var(--accent-primary)]/60 text-[var(--accent-primary)]"
              : ""
              }`}
          >
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="hidden sm:inline">Copiloto IA</span>
          </button>

            <button
              type="button"
              data-testid="toggle-anchorage-drawer-btn"
              onClick={() => {
                if (drawerOpen && drawerTab === "anchorage") {
                  setDrawerOpen(false);
                } else {
                  setDrawerTab("anchorage");
                  setDrawerOpen(true);
                }
              }}
              className={`marine-pill min-h-14 px-4 sm:px-5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold transition ${anchorWatch.isDragging
                ? "bg-[#FF2D55] text-white border-[#FF2D55] animate-pulse"
                : drawerOpen && drawerTab === "anchorage"
                  ? "border-[var(--accent-primary)]/50 text-[var(--accent-primary)]"
                  : ""
                }`}
            >
              <CloudSun className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span>Fondeo & Clima</span>
              <span className="hidden sm:inline font-mono text-xs px-2 py-0.5 rounded-full bg-white/10">
                {liveWeather.windSpeedKn.toFixed(1)} kn • {liveWeather.score}%
              </span>
            </button>
          </div>

          {/* 3. BOTTOM-LEFT MINIMALIST TELEMETRY HUD (4 Clean Numbers: SOG, COG, PROF, VIENTO) */}
          <div className="fixed bottom-20 lg:bottom-6 left-3 right-3 sm:right-auto lg:left-20 z-30">
            <div className="marine-card px-4 sm:px-5 py-3.5 rounded-2xl grid grid-cols-4 sm:flex sm:items-center gap-3 sm:gap-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-55">
                  SOG
                </div>
                <div className="font-mono text-xl sm:text-3xl font-semibold tracking-tight leading-none mt-1">
                  {telemetry.sog_kn.toFixed(1)}
                  <span className="text-[10px] font-normal opacity-50 ml-0.5">
                    KN
                  </span>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-white/10" />

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-55">
                  COG
                </div>
                <div className="font-mono text-xl sm:text-3xl font-semibold tracking-tight leading-none mt-1">
                  {String(Math.round(telemetry.cog_deg)).padStart(3, "0")}
                  <span className="text-[10px] font-normal opacity-50 ml-0.5">
                    °M
                  </span>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-white/10" />

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-55">
                  PROF
                </div>
                <div className="font-mono text-xl sm:text-3xl font-semibold tracking-tight leading-none mt-1 text-[#00E5FF]">
                  {telemetry.depth_m.toFixed(1)}
                  <span className="text-[10px] font-normal opacity-50 ml-0.5">
                    M
                  </span>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-white/10" />

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-55">
                  VIENTO
                </div>
                <div className="font-mono text-xl sm:text-3xl font-semibold tracking-tight leading-none mt-1 text-[#00E676]">
                  {liveWeather.windSpeedKn.toFixed(1)}
                  <span className="text-[10px] font-normal opacity-50 ml-0.5">
                    KN
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. COLLAPSIBLE RIGHT DRAWER (w-96, Anchorage Matcher + Marine Copilot AI) */}
          <div
            data-testid="anchorage-weather-drawer"
            className={`fixed top-20 bottom-20 lg:bottom-6 right-3 sm:right-4 w-[calc(100vw-1.5rem)] sm:w-96 z-40 transition-all duration-300 ease-out ${drawerOpen
              ? "translate-x-0 opacity-100 pointer-events-auto"
              : "translate-x-[420px] opacity-0 pointer-events-none"
              }`}
          >
            <div className="marine-card h-full p-5 flex flex-col justify-between overflow-y-auto space-y-4">
              <div className="space-y-4">
                {/* Drawer Mode Switcher + Close Button */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="grid grid-cols-3 gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setDrawerTab("anchorage")}
                      className={`min-h-14 px-2 rounded-xl font-mono text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        drawerTab === "anchorage"
                          ? "marine-btn-primary"
                          : "marine-btn-secondary"
                      }`}
                    >
                      <CloudSun className="w-3.5 h-3.5 shrink-0" />
                      <span>Fondeo</span>
                    </button>
                    <button
                      type="button"
                      data-testid="drawer-tab-routing-btn"
                      onClick={() => setDrawerTab("routing")}
                      className={`min-h-14 px-2 rounded-xl font-mono text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        drawerTab === "routing"
                          ? "marine-btn-primary"
                          : "marine-btn-secondary"
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5 shrink-0" />
                      <span>Ruteo 48h</span>
                    </button>
                    <button
                      type="button"
                      data-testid="drawer-tab-copilot-btn"
                      onClick={() => setDrawerTab("copilot")}
                      className={`min-h-14 px-2 rounded-xl font-mono text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        drawerTab === "copilot"
                          ? "marine-btn-primary"
                          : "marine-btn-secondary"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Copiloto</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="min-h-14 w-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
                    aria-label="Cerrar panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {drawerTab === "copilot" ? (
                  <MarineCopilot vesselContext={copilotContext} compact={true} />
                ) : drawerTab === "routing" ? (
                  <div
                    data-testid="passage-planner-panel"
                    className="space-y-4 font-mono text-xs"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--accent-primary)]">
                        WEATHER ROUTING • EVOLUCIÓN 48 HORAS
                      </div>
                      <h3 className="text-base font-sans font-bold mt-0.5">
                        Planificador de Zarpe (PredictWind Engine)
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "now", label: "Zarpar Ahora" },
                        { id: "in_2h", label: "Zarpar en 2 hrs ⭐" },
                        { id: "in_6h", label: "Zarpar en 6 hrs" },
                        { id: "tomorrow_0800", label: "Zarpar Mañana" },
                      ].map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          data-testid={`routing-window-${w.id}`}
                          onClick={() =>
                            setDepartureWindowId(
                              w.id as "now" | "in_2h" | "in_6h" | "tomorrow_0800"
                            )
                          }
                          className={`min-h-14 px-3 rounded-xl text-xs font-bold transition ${
                            departureWindowId === w.id
                              ? "marine-btn-primary"
                              : "marine-btn-secondary"
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--accent-primary)]">
                          {passagePlan.label}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            passagePlan.status === "OPTIMAL"
                              ? "bg-[#00E676]/20 text-[#00E676]"
                              : passagePlan.status === "GOOD"
                              ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                              : "bg-[#FF9F0A]/20 text-[#FF9F0A]"
                          }`}
                        >
                          {passagePlan.status} ({passagePlan.comfort_score}%)
                        </span>
                      </div>

                      <p className="font-sans text-xs opacity-90 leading-relaxed">
                        {passagePlan.tactical_summary}
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="p-2 rounded-lg bg-white/5">
                          <div className="text-[9px] opacity-60">VIENTO MED</div>
                          <div className="text-sm font-bold mt-0.5">
                            {passagePlan.avg_wind_kn} kn
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-white/5">
                          <div className="text-[9px] opacity-60">SOG EST.</div>
                          <div className="text-sm font-bold mt-0.5 text-[var(--accent-primary)]">
                            {passagePlan.predicted_sog_kn} kn
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-white/5">
                          <div className="text-[9px] opacity-60">ETA CRUCE</div>
                          <div className="text-sm font-bold mt-0.5 text-[#00E676]">
                            {passagePlan.eta_hours} hrs
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 text-[11px] text-[#00E676]">
                        Plan Vélico: <strong>{passagePlan.sail_plan}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Anchorage Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono uppercase opacity-70">
                        Caleta / Fondeadero (Seno de Reloncaví & Chiloé)
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={selectedAnchorageSlug}
                          onChange={(e) =>
                            setSelectedAnchorageSlug(e.target.value)
                          }
                          className="flex-1 min-w-0 min-h-14 px-3 text-xs sm:text-sm font-medium"
                        >
                          {anchorages.map((a) => (
                            <option key={a.id} value={a.slug}>
                              {a.name} ({a.min_depth_m}m • {a.seabed_type})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            fetchLiveOpenMeteoAndScore(selectedAnchorage)
                          }
                          title="Actualizar Open-Meteo en vivo"
                          className="marine-btn marine-btn-secondary px-3.5 shrink-0"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${liveWeather.loading
                              ? "animate-spin text-[var(--accent-primary)]"
                              : ""
                              }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Real-Time Open-Meteo Weather & Marine Readouts with Zero-CLS Skeletons */}
                    <div className="grid grid-cols-2 gap-2.5 font-mono">
                      <div className="min-h-[96px] p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[10px] opacity-60 uppercase">
                          <span>VIENTO REAL</span>
                          <Wind className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        </div>
                        {liveWeather.loading ? (
                          <div className="space-y-1.5 pt-1">
                            <div className="h-6 w-20 marine-skeleton" />
                            <div className="h-3.5 w-28 marine-skeleton" />
                          </div>
                        ) : (
                          <>
                            <div
                              data-testid="live-wind-readout"
                              className="text-xl font-semibold mt-1"
                            >
                              {liveWeather.windSpeedKn.toFixed(1)} kn
                            </div>
                            <div className="text-[11px] opacity-70 mt-0.5 truncate">
                              Ráf. {liveWeather.windGustKn.toFixed(1)} kn •{" "}
                              {Math.round(liveWeather.windDirDeg)}° (
                              {degreesToCardinal(liveWeather.windDirDeg)})
                            </div>
                          </>
                        )}
                      </div>

                      <div className="min-h-[96px] p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[10px] opacity-60 uppercase">
                          <span>OLEAJE MARINO</span>
                          <Waves className="w-3.5 h-3.5 text-[#00E676]" />
                        </div>
                        {liveWeather.loading ? (
                          <div className="space-y-1.5 pt-1">
                            <div className="h-6 w-20 marine-skeleton" />
                            <div className="h-3.5 w-24 marine-skeleton" />
                          </div>
                        ) : (
                          <>
                            <div
                              data-testid="live-wave-readout"
                              className="text-xl font-semibold mt-1"
                            >
                              {liveWeather.waveHeightM.toFixed(2)} m
                            </div>
                            <div className="text-[11px] opacity-70 mt-0.5 truncate">
                              Período {liveWeather.wavePeriodS.toFixed(1)}s •{" "}
                              {Math.round(liveWeather.waveDirDeg)}°
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Calculated Chain Scope & Safety Score */}
                    <div className="min-h-[148px] p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 font-mono text-xs flex flex-col justify-between">
                      {liveWeather.loading ? (
                        <div className="space-y-2.5 py-1">
                          <div className="h-4 w-full marine-skeleton" />
                          <div className="h-4 w-4/5 marine-skeleton" />
                          <div className="h-4 w-3/4 marine-skeleton" />
                          <div className="h-6 w-full marine-skeleton mt-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">SCORE SEGURIDAD</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-[#00E676]/15 text-[#00E676] font-bold">
                              {liveWeather.score}/100 ({liveWeather.status})
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">
                              SONDA / UKC BAJAMAR
                            </span>
                            <span>
                              {scopeCalc.lowTideDepthMeters}m (UKC{" "}
                              {(
                                scopeCalc.lowTideDepthMeters -
                                (vessel?.draft_meters || 2.18)
                              ).toFixed(2)}
                              m)
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">AMPLITUD DE MAREA</span>
                            <span>+{scopeCalc.tideAmplitudeMeters}m</span>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm font-bold text-[var(--accent-primary)]">
                            <span>CADENA RECOMENDADA</span>
                            <span>
                              {scopeCalc.recommendedChainMeters}m (Ratio{" "}
                              {scopeCalc.recommendedRatio}:1)
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Circular Anchor Watch Radar & Siren Controls */}
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-xs">
                          <BellRing className="w-4 h-4 text-[var(--accent-primary)]" />
                          <span>Anchor Watch Pro</span>
                        </div>
                        <span
                          data-testid="anchor-watch-status"
                          className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full font-bold ${anchorWatch.isDragging
                            ? "bg-[#FF2D55]/20 text-[#FF2D55]"
                            : "bg-[#00E676]/20 text-[#00E676]"
                            }`}
                        >
                          {anchorWatch.alertLevel}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div
                          className={`w-20 h-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center font-mono shrink-0 ${anchorWatch.isDragging
                            ? "border-[#FF2D55] bg-[#FF2D55]/10 text-[#FF2D55] animate-pulse"
                            : "border-[#00E676]/60 bg-[#00E676]/5 text-[#00E676]"
                            }`}
                        >
                          <span className="text-sm font-bold">
                            {anchorWatch.distanceFromAnchorMeters}m
                          </span>
                          <span className="text-[9px] opacity-70">
                            MAX {anchorWatch.maxSwingRadiusMeters}m
                          </span>
                        </div>

                        <div className="space-y-1 text-xs font-mono flex-1 min-w-0">
                          <div>
                            Margen: <strong>{anchorWatch.marginMeters}m</strong>
                          </div>
                          <div>
                            Demora:{" "}
                            <strong>{anchorWatch.bearingFromAnchorDeg}°</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSoundAlarmEnabled(!soundAlarmEnabled)
                            }
                            className="min-h-14 w-full px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] text-[var(--accent-primary)] flex items-center justify-center gap-1.5 mt-1"
                          >
                            <Volume2 className="w-4 h-4 shrink-0" />
                            <span>
                              Sirena: {soundAlarmEnabled ? "ACTIVA" : "MUTE"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {anchorWatch.isDragging && (
                        <div
                          data-testid="drag-alarm-banner"
                          className="p-3 rounded-xl bg-[#FF2D55]/20 border border-[#FF2D55] font-mono text-xs text-[#FF2D55] font-semibold"
                        >
                          ¡ALARMA DE GARREO! Barco fuera del radio de borneo (
                          {anchorWatch.distanceFromAnchorMeters}m &gt;{" "}
                          {anchorWatch.maxSwingRadiusMeters}m).
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setVesselOffsetMeters(24)}
                          className="marine-btn marine-btn-secondary text-xs px-2"
                        >
                          <span>Fondeo Seguro</span>
                        </button>
                        <button
                          type="button"
                          data-testid="simulate-drag-btn"
                          onClick={handleSimulateDragWithAudio}
                          className="marine-btn marine-btn-primary text-xs px-2"
                        >
                          <span>Simular Garreo</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom GPX Import in Drawer */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="opacity-60 truncate pr-2">
                  GPX: {parsedRoute.totalDistanceNm} MN
                </span>
                <label className="marine-btn marine-btn-secondary text-xs px-3 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Cargar .GPX</span>
                  <input
                    type="file"
                    accept=".gpx,application/xml,text/xml"
                    onChange={handleGPXFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        );
  }

        // ===========================================================================
        // VIEW 2: VESSEL (MI BARCO / GEMELO DIGITAL, SIGNAL K, QRs & DAMAGE CONTROL)
        // ===========================================================================
        if (activeSection === "vessel") {
    return (
        <div className="space-y-6">
          <div className="marine-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-primary)]">
                INGENIERÍA NAVAL &amp; SOURCING DE REPUESTOS
              </div>
              <div className="text-lg font-bold">
                {vessel?.name || "SV Albatros (Oceanis 41.1)"} —{" "}
                {vesselSubView === "digital_twin"
                  ? "Gemelo Digital & Telemetría Signal K"
                  : "Damage Control & Marketplace de Repuestos"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="vessel-subview-twin-btn"
                onClick={() => setVesselSubView("digital_twin")}
                className={`marine-btn text-xs ${
                  vesselSubView === "digital_twin"
                    ? "marine-btn-primary"
                    : "marine-btn-secondary"
                }`}
              >
                <Gauge className="w-4 h-4" />
                <span>Gemelo Digital &amp; Inventario</span>
              </button>
              <button
                type="button"
                data-testid="vessel-subview-damage-btn"
                onClick={() => setVesselSubView("damage_control")}
                className={`marine-btn text-xs ${
                  vesselSubView === "damage_control"
                    ? "bg-[#FF2D55] text-white border-[#FF2D55]"
                    : "marine-btn-secondary"
                }`}
              >
                <Activity className="w-4 h-4 text-[#FF2D55]" />
                <span>Damage Control (Falla Motor / Marketplace)</span>
              </button>
            </div>
          </div>

          {vesselSubView === "damage_control" ? (
            <DamageControl />
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <div className="marine-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-primary)]">
                      DIGITAL TWIN • SIGNAL K NMEA 2000 LIVE
                    </div>
                    <h1 className="text-xl font-semibold mt-0.5">
                      {vessel?.name || "SV Albatros (Oceanis 41.1)"}
                    </h1>
                  </div>
                  <Gauge className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="opacity-60 text-[10px]">
                      YANMAR 4JH57 (RPM)
                    </div>
                    <div
                      data-testid="signalk-rpm-value"
                      className="font-semibold text-base mt-1 text-[#00E5FF]"
                    >
                      {telemetry.rpm} RPM
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="opacity-60 text-[10px]">
                      REFRIGERANTE MOTOR
                    </div>
                    <div className="font-semibold text-base mt-1 text-[#00E676]">
                      {telemetry.coolant_temp_c.toFixed(1)} °C
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="opacity-60 text-[10px]">PRESIÓN ACEITE</div>
                    <div className="font-semibold text-base mt-1">
                      {telemetry.oil_pressure_kpa} kPa
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="opacity-60 text-[10px]">
                      ALTERNADOR / SOC
                    </div>
                    <div className="font-semibold text-base mt-1 text-[var(--accent-primary)]">
                      {telemetry.alternator_voltage_v.toFixed(1)}V (
                      {telemetry.house_battery_soc_pct}%)
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="opacity-60 text-[10px]">ESLORA × CALADO</div>
                    <div className="font-semibold text-sm mt-1">
                      {vessel?.loa_meters || 12.43}m ×{" "}
                      {vessel?.draft_meters || 2.18}m
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="opacity-60 text-[10px]">HORÓMETRO ACTUAL</div>
                    <div
                      data-testid="vessel-horometer-value"
                      className="font-semibold text-base mt-1 text-[var(--accent-primary)]"
                    >
                      {vessel?.engine_hours_current || 1420.5} hrs
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-mono">
                    <span className="opacity-80">Próximo servicio 1.500h:</span>
                    <span className="text-[#00E676]">
                      Restan{" "}
                      {Math.max(
                        0,
                        Math.round(
                          (1500 - (vessel?.engine_hours_current || 1420.5)) * 10
                        ) / 10
                      )}{" "}
                      hrs
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleIncrementEngineHours(0.5)}
                      className="marine-btn marine-btn-secondary text-xs px-2"
                    >
                      <span>+0.5h</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIncrementEngineHours(1.0)}
                      className="marine-btn marine-btn-secondary text-xs px-2"
                    >
                      <span>+1.0h</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIncrementEngineHours(2.0)}
                      className="marine-btn marine-btn-primary text-xs px-2"
                    >
                      <span>+2.0h</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="marine-card p-6 space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-white/10 pb-3">
                  <QrCode className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Sistemas QR Twins a Bordo ({qrNodes.length})</span>
                </h2>
                <div className="space-y-2.5">
                  {qrNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {node.system_name}
                        </div>
                        <div className="text-xs font-mono opacity-65 truncate">
                          {node.compartment_location}
                        </div>
                      </div>
                      <Link
                        href={`/qr/${node.qr_slug}`}
                        className="marine-btn marine-btn-primary text-xs px-3.5 shrink-0"
                      >
                        <span>Abrir QR</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="marine-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <h2 className="text-lg font-semibold">
                    Inventario de Tambuchos & Alertas SOLAS (
                    {inventoryItems.length})
                  </h2>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    IndexedDB Sync
                  </span>
                </div>

                <div className="space-y-2.5">
                  {inventoryItems.map((item) => {
                    const isLow = item.quantity <= item.min_threshold;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                            <span className="truncate">{item.item_name}</span>
                            {isLow && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FF9F0A]/20 text-[#FF9F0A]">
                                STOCK MÍNIMO
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono opacity-65 mt-0.5">
                            {item.category} • Mínimo: {item.min_threshold}
                            {item.expiration_date && (
                              <span> • Vence: {item.expiration_date}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustInventoryStock(
                                item.id,
                                -1,
                                item.quantity
                              )
                            }
                            className="marine-btn marine-btn-secondary px-3"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="min-h-14 px-3.5 flex items-center rounded-xl bg-white/5 border border-white/10 font-bold text-sm">
                            {item.quantity} uds
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustInventoryStock(
                                item.id,
                                1,
                                item.quantity
                              )
                            }
                            className="marine-btn marine-btn-secondary px-3"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleAddInventoryItemOffline}
                  className="pt-3 border-t border-white/10 flex flex-wrap gap-2"
                >
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Agregar repuesto o elemento SOLAS al barco..."
                    className="flex-1 min-w-[180px] min-h-14 px-3.5 text-sm"
                  />
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="min-h-14 px-3.5 font-mono text-xs"
                  >
                    <option value="repuestos_motor">repuestos_motor</option>
                    <option value="seguridad">seguridad</option>
                    <option value="plomeria">plomeria</option>
                  </select>
                  <button
                    type="submit"
                    className="marine-btn marine-btn-primary text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </form>
              </div>

              {/* Multimodal Context-Injected Marine Copilot AI */}
              <MarineCopilot vesselContext={copilotContext} />
            </div>
          </div>
          )}
        </div>
        );
  }

        // ===========================================================================
        // VIEW 3: VOYAGES & ZARPE
        // ===========================================================================
        if (activeSection === "voyages") {
    return <VoyagesZarpeView magicToken={DEMO_IDS.MAGIC_TOKEN} />;
  }

        // ===========================================================================
        // VIEW 4: HANDOVER WIZARD
        // ===========================================================================
        if (activeSection === "handover") {
    return <HandoverWizard vesselId={DEMO_IDS.VESSEL_ID} />;
  }

        // ===========================================================================
        // VIEW 6: MARINE ACADEMY & SUPPORT HUB (SALVAVIDAS 🛟)
        // ===========================================================================
        if (activeSection === "academy") {
    return <MarineAcademy onRelaunchSeaTrials={relaunchSeaTrials} />;
  }

        // ===========================================================================
        // VIEW 5: PASAPORTE NÁUTICO DIGITAL (APPLE WALLET STYLE + SEA TIME LOG)
        // ===========================================================================
        return (
        <div className="space-y-6">
          {/* Top Row: Apple Wallet Style Digital Nautical Passport + Sea Time Counter */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 cols: Apple Wallet Digital Nautical License Card */}
            <div
              data-testid="digital-nautical-passport-wallet"
              className={`lg:col-span-7 rounded-3xl p-6 sm:p-8 border shadow-2xl flex flex-col justify-between space-y-6 ${isNight
                ? "bg-black border-[#FF1E1E]"
                : "bg-gradient-to-br from-[#0F1E36]/95 via-[#0A1424]/95 to-[#060C16]/95 border-[var(--accent-primary)]/35 backdrop-blur-2xl"
                }`}
            >
              {/* Wallet Top Header + Expiration Semaphore Pill */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isNight
                            ? "bg-[#FF1E1E] text-black"
                            : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40"
                            }`}
                        >
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest opacity-70">
                            REPÚBLICA DE CHILE • DIRECTEMAR — APPLE WALLET NÁUTICO
                          </div>
                          <h1 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
                            {activeAccount.licenseType}
                          </h1>
                        </div>
                      </div>

                      {/* Traffic Light Expiration Semaphore */}
                      <div
                        data-testid="license-expiry-semaphore"
                        className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold flex items-center gap-2 border ${semaphore.tone === "green"
                          ? "bg-[#00E676]/15 border-[#00E676]/50 text-[#00E676]"
                          : semaphore.tone === "amber"
                            ? "bg-[#FF9F0A]/15 border-[#FF9F0A]/50 text-[#FF9F0A]"
                            : "bg-[#FF2D55]/20 border-[#FF2D55] text-[#FF2D55] animate-pulse"
                          }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${semaphore.tone === "green"
                            ? "bg-[#00E676]"
                            : semaphore.tone === "amber"
                              ? "bg-[#FF9F0A]"
                              : "bg-[#FF2D55]"
                            }`}
                        />
                        <span>{semaphore.badgeLabel}</span>
                      </div>
                    </div>

                    {/* Middle Body: Captain Metadata + Simulated Official QR Code */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1">
                        <div>
                          <div className="text-[10px] font-mono uppercase opacity-60">
                            TITULAR DEL PASAPORTE NÁUTICO
                          </div>
                          <div className="text-2xl font-bold tracking-tight mt-0.5">
                            {activeAccount.name}
                          </div>
                          <div className="font-mono text-xs opacity-75">
                            {activeAccount.email || "filipo.valverde@gmail.com"} •{" "}
                            {activeAccount.roleBadge}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
                          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                            <div className="text-[10px] opacity-60">DOCUMENTO</div>
                            <div className="font-semibold mt-0.5">
                              {activeAccount.documentType} {activeAccount.documentNumber}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                            <div className="text-[10px] opacity-60">Nº REGISTRO</div>
                            <div className="font-semibold mt-0.5 text-[var(--accent-primary)]">
                              {activeAccount.licenseNumber}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 col-span-2 sm:col-span-1">
                            <div className="text-[10px] opacity-60">VENCIMIENTO</div>
                            <div className="font-semibold mt-0.5">
                              {activeAccount.licenseExpiry}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs opacity-85">
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                            Atribución Máx: {activeAccount.maxLoaMeters}m LOA
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                            {activeAccount.vhfOperatorCert}
                          </span>
                        </div>
                      </div>

                      {/* Simulated Vector QR Code for Port Authority Verification */}
                      <div className="p-3.5 rounded-2xl bg-black/60 border border-white/15 flex flex-col items-center justify-center shrink-0 self-start sm:self-center">
                        <svg
                          viewBox="0 0 100 100"
                          className="w-28 h-28"
                          aria-label="Código QR de Verificación DIRECTEMAR"
                        >
                          <rect width="100" height="100" rx="8" fill="#040B16" />
                          <rect
                            x="10"
                            y="10"
                            width="24"
                            height="24"
                            fill="none"
                            stroke={isNight ? "#FF1E1E" : "#00E5FF"}
                            strokeWidth="4"
                          />
                          <rect
                            x="16"
                            y="16"
                            width="12"
                            height="12"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="66"
                            y="10"
                            width="24"
                            height="24"
                            fill="none"
                            stroke={isNight ? "#FF1E1E" : "#00E5FF"}
                            strokeWidth="4"
                          />
                          <rect
                            x="72"
                            y="16"
                            width="12"
                            height="12"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="10"
                            y="66"
                            width="24"
                            height="24"
                            fill="none"
                            stroke={isNight ? "#FF1E1E" : "#00E5FF"}
                            strokeWidth="4"
                          />
                          <rect
                            x="16"
                            y="72"
                            width="12"
                            height="12"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="42"
                            y="14"
                            width="6"
                            height="6"
                            fill={isNight ? "#FF1E1E" : "#00E676"}
                          />
                          <rect
                            x="52"
                            y="22"
                            width="6"
                            height="14"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="42"
                            y="42"
                            width="16"
                            height="16"
                            fill={isNight ? "#FF1E1E" : "#00E676"}
                          />
                          <rect
                            x="14"
                            y="44"
                            width="18"
                            height="6"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="66"
                            y="44"
                            width="22"
                            height="6"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="44"
                            y="68"
                            width="8"
                            height="20"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                          <rect
                            x="62"
                            y="62"
                            width="12"
                            height="12"
                            fill={isNight ? "#FF1E1E" : "#00E676"}
                          />
                          <rect
                            x="78"
                            y="76"
                            width="12"
                            height="12"
                            fill={isNight ? "#FF1E1E" : "#00E5FF"}
                          />
                        </svg>
                        <span className="font-mono text-[9px] uppercase tracking-widest opacity-70 mt-1.5">
                          QR VERIFICACIÓN ARMADA
                        </span>
                      </div>
                    </div>

                    {/* Wallet Interactive Controls (Test Semaphore & License Tier Offline in IndexedDB) */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid="passport-tier-altamar-btn"
                          onClick={() =>
                            updatePassportProfile({
                              licenseType: "Capitán Deportivo de Alta Mar (DIRECTEMAR)",
                              licenseExpiry: "2031-06-30",
                              maxLoaMeters: 30.0,
                            })
                          }
                          className="marine-btn marine-btn-secondary text-xs px-3"
                        >
                          <span>Capitán Alta Mar (Verde &gt;6m)</span>
                        </button>
                        <button
                          type="button"
                          data-testid="passport-tier-bahia-expiring-btn"
                          onClick={() =>
                            updatePassportProfile({
                              licenseType: "Patrón Deportivo de Bahía (DIRECTEMAR)",
                              licenseExpiry: "2026-12-01",
                              maxLoaMeters: 14.0,
                            })
                          }
                          className="marine-btn marine-btn-secondary text-xs px-3"
                        >
                          <span>Simular Vencimiento &lt;30d (Rojo)</span>
                        </button>
                      </div>

                      <Link
                        href="/login"
                        onClick={() => logoutSession()}
                        className="marine-btn marine-btn-secondary text-xs px-3.5"
                      >
                        <LogOut className="w-4 h-4 text-[#FF2D55]" />
                        <span>Cambiar Cuenta OAuth</span>
                      </Link>
                    </div>
                  </div>

                  {/* Right 5 cols: Total Nautical Miles (Sea Time Log) & Certification Summary */}
                  <div className="lg:col-span-5 marine-card p-6 sm:p-7 flex flex-col justify-between space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-primary)]">
                          SEA TIME LOG • BITÁCORA CERTIFICADA
                        </span>
                        <Compass className="w-5 h-5 text-[var(--accent-primary)]" />
                      </div>
                      <h2 className="text-lg font-semibold">
                        Millas Náuticas Totales Acumuladas
                      </h2>
                      <p className="text-xs opacity-70">
                        Suma automática de tu historial base certificado más todas las
                        travesías GPS grabadas en IndexedDB.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 font-mono space-y-2">
                      <div className="text-xs opacity-65 uppercase">
                        TOTAL SEA TIME (INDEXEDDB + TRACKS)
                      </div>
                      <div
                        data-testid="sea-time-total-miles"
                        className="text-4xl sm:text-5xl font-bold tracking-tight text-[#00E5FF]"
                      >
                        {totalSeaTimeMilesNm.toLocaleString("es-CL")}{" "}
                        <span className="text-base font-normal opacity-70">MN</span>
                      </div>
                      <div className="text-xs text-[#00E676] pt-1">
                        • Base histórica: {activeAccount.loggedMilesNm} MN + Travesías
                        grabadas: +{loggedTrackMilesNm} MN ({savedTracks.length} piernas)
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                        <div className="text-[10px] opacity-60">TRAVESÍAS GRABADAS</div>
                        <div className="text-lg font-semibold mt-1">
                          {savedTracks.length} Piernas
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                        <div className="text-[10px] opacity-60">PROVEEDOR AUTH</div>
                        <div className="text-sm font-semibold mt-1 uppercase text-[#00E676]">
                          {activeAccount.authProvider || "GOOGLE OAUTH"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Track Recorder & Replay + Watch Logbook & Expenses */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 marine-card p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                          <Award className="w-5 h-5 text-[var(--accent-primary)]" />
                          <span>
                            Historial de Navegaciones, Grabadora en Vivo & Replay
                          </span>
                        </h2>
                        <p className="text-xs font-mono opacity-70">
                          Cada track grabado incrementa automáticamente tu Sea Time Log
                        </p>
                      </div>

                      <button
                        type="button"
                        data-testid="toggle-track-record-btn"
                        onClick={handleToggleTrackRecording}
                        className={`marine-btn text-xs ${isRecordingTrack
                          ? "marine-btn-primary animate-pulse"
                          : "marine-btn-secondary"
                          }`}
                      >
                        <CircleDot className="w-4 h-4" />
                        <span>
                          {isRecordingTrack
                            ? `Guardar Track (${recordedPoints.length} pts)`
                            : "Grabar Ruta GPS en Vivo"}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {savedTracks.map((trk) => (
                          <button
                            key={trk.id}
                            type="button"
                            onClick={() => {
                              setSelectedReplayTrackId(trk.id);
                              setReplayIndex(0);
                            }}
                            className={`min-h-14 p-3.5 rounded-xl border text-left font-mono text-xs transition ${selectedReplayTrackId === trk.id
                              ? "bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/50"
                              : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                              }`}
                          >
                            <div className="font-semibold truncate">{trk.title}</div>
                            <div className="opacity-70 mt-0.5 truncate">
                              {trk.skipper_name} • +{trk.distance_nm} MN • Máx{" "}
                              {trk.max_sog_kn} kn
                            </div>
                          </button>
                        ))}
                      </div>

                      {activeReplayTrack && (
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                          <button
                            type="button"
                            data-testid="replay-track-btn"
                            onClick={() => setIsReplaying(!isReplaying)}
                            className="marine-btn marine-btn-primary text-xs px-4"
                          >
                            {isReplaying ? (
                              <>
                                <Pause className="w-4 h-4" />
                                <span>Pausar</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                <span>Reproducir Replay</span>
                              </>
                            )}
                          </button>

                          <div className="flex-1 min-w-[180px]">
                            <div className="flex justify-between mb-1 opacity-80">
                              <span>
                                Punto {replayIndex + 1} /{" "}
                                {activeReplayTrack.points.length} (
                                {replayPoint?.timestamp})
                              </span>
                              <span className="text-[var(--accent-primary)]">
                                {replayPoint?.sog_kn} kn • {replayPoint?.cog_deg}°
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(0, activeReplayTrack.points.length - 1)}
                              value={replayIndex}
                              onChange={(e) => setReplayIndex(Number(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}

                      <NauticalMap
                        fullScreen={false}
                        waypoints={parsedRoute.waypoints}
                        anchorages={anchorages}
                        selectedAnchorage={selectedAnchorage}
                        vesselPosition={{
                          lat: replayPoint?.lat ?? effectiveVesselLat,
                          lon: replayPoint?.lon ?? effectiveVesselLon,
                        }}
                        anchorPosition={{ lat: anchorLat, lon: anchorLon }}
                        swingRadiusMeters={scopeCalc.swingRadiusMeters}
                        isNight={isNight}
                        trackPoints={
                          isRecordingTrack
                            ? recordedPoints
                            : activeReplayTrack?.points || []
                        }
                        onSelectAnchorage={(a) => setSelectedAnchorageSlug(a.slug)}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    <div className="marine-card p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-[var(--accent-primary)]" />
                          <span>
                            Bitácora de Voz &amp; Guardia ({logbookEntries.length})
                          </span>
                        </h3>
                        <span className="font-mono text-[10px] uppercase px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-bold">
                          ZERO DATA ENTRY
                        </span>
                      </div>

                      {/* Primary Floating/Featured Voice Microphone Button (1-Tap Zero Data Entry) */}
                      <button
                        type="button"
                        data-testid="voice-logbook-mic-btn"
                        onClick={handleTriggerVoiceLogbook}
                        className={`w-full min-h-[68px] marine-btn text-sm sm:text-base font-bold flex items-center justify-center gap-3 shadow-2xl ${
                          isListeningVoice
                            ? "bg-[#FF2D55] text-white border-[#FF2D55] animate-pulse"
                            : "marine-btn-primary"
                        }`}
                      >
                        <Mic className="w-6 h-6 shrink-0" />
                        <span>
                          {isListeningVoice
                            ? "ESCUCHANDO VOZ... (CAPTURANDO GPS + HORÓMETRO)"
                            : "Dictar Bitácora por Voz (1-Toque: Audio + GPS + Horómetro)"}
                        </span>
                      </button>

                      <form
                        onSubmit={handleAddLogbookEntryOffline}
                        className="flex flex-wrap sm:flex-nowrap gap-2"
                      >
                        <input
                          type="text"
                          value={logNote}
                          onChange={(e) => setLogNote(e.target.value)}
                          placeholder={`Anotar novedad como ${activeAccount.name}...`}
                          className="flex-1 min-w-0 min-h-14 px-3.5 text-sm"
                        />
                        <button
                          type="submit"
                          className="marine-btn marine-btn-primary text-xs w-full sm:w-auto shrink-0"
                        >
                          <span>Firmar</span>
                        </button>
                      </form>

                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {logbookEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono"
                          >
                            <div className="flex justify-between font-semibold text-[var(--accent-primary)]">
                              <span>{entry.author}</span>
                              <span className="opacity-70">
                                {entry.timestamp.slice(0, 19).replace("T", " ")} UTC
                              </span>
                            </div>
                            <div className="mt-1.5 opacity-90">{entry.notes}</div>
                            <div className="mt-1.5 text-[11px] opacity-60">
                              {entry.lat.toFixed(4)}°S, {entry.lon.toFixed(4)}°W • SOG{" "}
                              {entry.sog_kn}kn • Motor {entry.engine_hours}h
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="marine-card p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-[#00E676]" />
                          <span>Gastos de Travesía & OCR Boletas</span>
                        </h3>
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-[#00E676]/15 text-[#00E676]">
                          USD ${totalExpensesUsd} (${perPersonUsd}/pers)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleScanReceiptOCR("diesel")}
                          className="marine-btn marine-btn-secondary text-xs"
                        >
                          <Receipt className="w-4 h-4 text-[var(--accent-primary)]" />
                          <span>OCR Boleta Diésel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScanReceiptOCR("provisions")}
                          className="marine-btn marine-btn-secondary text-xs"
                        >
                          <Receipt className="w-4 h-4 text-[var(--accent-primary)]" />
                          <span>OCR Víveres</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {expenses.map((exp) => (
                          <div
                            key={exp.id}
                            className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs font-mono"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium truncate">{exp.title}</div>
                              <div className="opacity-65 text-[11px] truncate">
                                Pagó: {exp.paid_by} • #{exp.receipt_number}
                              </div>
                            </div>
                            <div className="text-right font-semibold shrink-0">
                              <div className="text-[#00E676]">USD ${exp.amount_usd}</div>
                              <div className="opacity-60 text-[11px]">
                                CLP ${exp.amount_clp.toLocaleString("es-CL")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
}
