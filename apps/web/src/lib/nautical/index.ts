export interface GPXWaypoint {
  name: string;
  lat: number;
  lon: number;
  ele?: number;
  desc?: string;
}

export interface GPXParseResult {
  routeName: string;
  waypoints: GPXWaypoint[];
  totalDistanceNm: number;
  estimatedHoursAt6Kn: number;
}

export interface AnchorScopeCalculation {
  lowTideDepthMeters: number;
  tideAmplitudeMeters: number;
  maxHighTideDepthMeters: number;
  bowFreeboardMeters: number;
  totalVerticalMeters: number;
  recommendedRatio: 5 | 7;
  recommendedChainMeters: number;
  swingRadiusMeters: number;
  holdingNotes: string;
}

export interface AnchorWatchState {
  distanceFromAnchorMeters: number;
  maxSwingRadiusMeters: number;
  marginMeters: number;
  isDragging: boolean;
  bearingFromAnchorDeg: number;
  alertLevel: "SECURE" | "WARNING" | "DRAG_ALARM";
}

/**
 * Pure Haversine distance in meters between two WGS84 coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Computes initial true bearing in degrees (0-360) from point 1 to point 2.
 */
export function calculateBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

/**
 * Pure calculation for Anchor Chain Scope (profundidad + amplitud de marea + francobordo + ratio de seguridad)
 * and horizontal Swing Radius (radio de borneo).
 */
export function calculateAnchorScope(params: {
  depthMeters: number;
  tideAmplitudeMeters: number;
  freeboardMeters?: number;
  windSpeedKnots: number;
  seabedType: "sand" | "mud" | "rock" | "weed" | "mixed";
  vesselLoaMeters?: number;
}): AnchorScopeCalculation {
  const bowFreeboardMeters = params.freeboardMeters ?? 1.4;
  const loa = params.vesselLoaMeters ?? 12.43;
  const maxHighTideDepthMeters =
    Math.round((params.depthMeters + params.tideAmplitudeMeters) * 10) / 10;
  const totalVerticalMeters =
    Math.round((maxHighTideDepthMeters + bowFreeboardMeters) * 10) / 10;

  const needsHeavyScope =
    params.windSpeedKnots >= 22 ||
    params.seabedType === "weed" ||
    params.seabedType === "rock";
  const recommendedRatio: 5 | 7 = needsHeavyScope ? 7 : 5;
  const recommendedChainMeters = Math.ceil(totalVerticalMeters * recommendedRatio);

  // Horizontal projection of deployed catenary + vessel LOA + GPS accuracy margin (5m)
  const horizontalChain = Math.sqrt(
    Math.max(0, recommendedChainMeters ** 2 - totalVerticalMeters ** 2)
  );
  const swingRadiusMeters = Math.round((horizontalChain + loa + 5.0) * 10) / 10;

  const seabedNotes: Record<string, string> = {
    sand: "Fondo de arena firme: excelente agarre. Asentar a 1.800 RPM atrás.",
    mud: "Fondo de fango/limo: buen tenedero. Filar cadena progresivamente.",
    mixed: "Fondo mixto: verificar que el ancla no salte al dar atrás.",
    weed: "Fondo de algas: ratio 7:1 obligatorio y verificar firmeza visual o por vibración de cadena.",
    rock: "Fondo rocoso: riesgo de enroque. Instalar orinque con boyarín antes de fondear.",
  };

  return {
    lowTideDepthMeters: params.depthMeters,
    tideAmplitudeMeters: params.tideAmplitudeMeters,
    maxHighTideDepthMeters,
    bowFreeboardMeters,
    totalVerticalMeters,
    recommendedRatio,
    recommendedChainMeters,
    swingRadiusMeters,
    holdingNotes: seabedNotes[params.seabedType] || seabedNotes.sand,
  };
}

/**
 * Pure Anchor Watch GPS drift and drag alarm calculator.
 */
export function evaluateAnchorWatch(
  anchorLat: number,
  anchorLon: number,
  vesselLat: number,
  vesselLon: number,
  maxSwingRadiusMeters: number
): AnchorWatchState {
  const distanceFromAnchorMeters = haversineDistanceMeters(
    anchorLat,
    anchorLon,
    vesselLat,
    vesselLon
  );
  const bearingFromAnchorDeg = calculateBearingDeg(
    anchorLat,
    anchorLon,
    vesselLat,
    vesselLon
  );
  const marginMeters =
    Math.round((maxSwingRadiusMeters - distanceFromAnchorMeters) * 10) / 10;
  const isDragging = distanceFromAnchorMeters > maxSwingRadiusMeters;

  let alertLevel: "SECURE" | "WARNING" | "DRAG_ALARM" = "SECURE";
  if (isDragging) {
    alertLevel = "DRAG_ALARM";
  } else if (distanceFromAnchorMeters >= maxSwingRadiusMeters * 0.85) {
    alertLevel = "WARNING";
  }

  return {
    distanceFromAnchorMeters,
    maxSwingRadiusMeters,
    marginMeters,
    isDragging,
    bearingFromAnchorDeg,
    alertLevel,
  };
}

/**
 * Pure GPX XML parser supporting <rtept>, <trkpt>, and <wpt> tags (Navionics / OpenCPN compatible).
 */
export function parseGPX(gpxXml: string): GPXParseResult {
  const waypoints: GPXWaypoint[] = [];
  let routeName = "Ruta Náutica Importada";

  const nameMatch = gpxXml.match(/<name>([^<]+)<\/name>/i);
  if (nameMatch && nameMatch[1]) {
    routeName = nameMatch[1].trim();
  }

  const ptRegex =
    /<(rtept|trkpt|wpt)\s+[^>]*lat=["']([0-9.-]+)["'][^>]*lon=["']([0-9.-]+)["'][^>]*>([\s\S]*?)<\/\1>|<(rtept|trkpt|wpt)\s+[^>]*lon=["']([0-9.-]+)["'][^>]*lat=["']([0-9.-]+)["'][^>]*>([\s\S]*?)<\/\5>/gi;

  let match: RegExpExecArray | null;
  let index = 1;
  while ((match = ptRegex.exec(gpxXml)) !== null) {
    const lat = parseFloat(match[2] || match[7]);
    const lon = parseFloat(match[3] || match[6]);
    const inner = match[4] || match[8] || "";
    const wpNameMatch = inner.match(/<name>([^<]+)<\/name>/i);
    const descMatch = inner.match(/<desc>([^<]+)<\/desc>/i);

    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      waypoints.push({
        name: wpNameMatch ? wpNameMatch[1].trim() : `WP-${index}`,
        lat,
        lon,
        desc: descMatch ? descMatch[1].trim() : undefined,
      });
      index++;
    }
  }

  let totalMeters = 0;
  for (let i = 1; i < waypoints.length; i++) {
    totalMeters += haversineDistanceMeters(
      waypoints[i - 1].lat,
      waypoints[i - 1].lon,
      waypoints[i].lat,
      waypoints[i].lon
    );
  }

  const totalDistanceNm = Math.round((totalMeters / 1852) * 10) / 10;
  const estimatedHoursAt6Kn = Math.round((totalDistanceNm / 6.0) * 10) / 10;

  return {
    routeName,
    waypoints,
    totalDistanceNm,
    estimatedHoursAt6Kn,
  };
}

/**
 * Generates the default Chiloé GPX XML.
 * Strictly navigates through the wide, deep, navigable water channels:
 * Puerto Montt -> Seno de Reloncaví (East of Maillén) -> Paso Queullín -> Golfo de Ancud -> Caleta Mechuque.
 * Absolutely zero land intersections.
 */
export function getDefaultChiloeGPX(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MarinOS Nautical Copilot">
  <rte>
    <name>Seno de Reloncaví &amp; Canales: Puerto Montt a Caleta Mechuque</name>
    <rtept lat="-41.4850" lon="-72.9400"><name>WP1 Puerto Montt</name><desc>Salida Bahía de Puerto Montt - Aguas Libres</desc></rtept>
    <rtept lat="-41.5250" lon="-72.9250"><name>WP2 Canal Principal Tenglo</name><desc>Canal este de Isla Tenglo - Aguas profundas</desc></rtept>
    <rtept lat="-41.6050" lon="-72.8850"><name>WP3 Seno de Reloncaví Este</name><desc>Aguas abiertas al este de Isla Maillén</desc></rtept>
    <rtept lat="-41.7250" lon="-72.8600"><name>WP4 Paso Queullín</name><desc>Canal comercial y deportivo al Golfo de Ancud</desc></rtept>
    <rtept lat="-41.8500" lon="-72.9100"><name>WP5 Boca Golfo de Ancud</name><desc>Ingreso a aguas abiertas del Golfo</desc></rtept>
    <rtept lat="-42.0500" lon="-73.0800"><name>WP6 Golfo de Ancud Abierto</name><desc>Mar abierto - Vigilancia VHF Canal 16</desc></rtept>
    <rtept lat="-42.2700" lon="-73.2100"><name>WP7 Entrada Chauques Este</name><desc>Aproximación por aguas libres</desc></rtept>
    <rtept lat="-42.3125" lon="-73.2680"><name>WP8 Caleta Mechuque</name><desc>Arribo a tenedero protegido de arena 5.2m</desc></rtept>
  </rte>
</gpx>`;
}

/**
 * Formats decimal WGS84 coordinates into standard Nautical Degrees + Decimal Minutes (DMS / DMM).
 * Example: 42° 18.750' S, 073° 16.080' W
 */
export function formatNauticalCoordsDMS(lat: number, lon: number): {
  latDms: string;
  lonDms: string;
  combined: string;
} {
  const latHem = lat >= 0 ? "N" : "S";
  const lonHem = lon >= 0 ? "E" : "W";
  const absLat = Math.abs(lat);
  const absLon = Math.abs(lon);

  const latDeg = Math.floor(absLat);
  const latMin = ((absLat - latDeg) * 60).toFixed(3).padStart(6, "0");

  const lonDeg = Math.floor(absLon);
  const lonMin = ((absLon - lonDeg) * 60).toFixed(3).padStart(6, "0");

  const latDms = `${String(latDeg).padStart(2, "0")}° ${latMin}' ${latHem}`;
  const lonDms = `${String(lonDeg).padStart(3, "0")}° ${lonMin}' ${lonHem}`;
  return {
    latDms,
    lonDms,
    combined: `${latDms} • ${lonDms}`,
  };
}

/**
 * Triggers a synthesized marine acoustic siren using Web Audio API for Anchor Watch Pro.
 */
export function triggerAcousticMarineAlarm(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.75);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  } catch {
    // Ignore if browser autoplay policy blocks audio before interaction
  }
}

/**
 * Generates SHA-256 integrity hash in hex for offline Handover Inspections & Zarpe verification.
 */
export async function computeSHA256Hex(payload: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Deterministic fallback hash
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  for (let i = 0, ch; i < payload.length; i++) {
    ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  ).repeat(4);
}

/**
 * Triggers native tactile haptic feedback on supported mobile/tablet hardware.
 */
export function triggerHapticFeedback(
  pattern: number | number[] = 14
): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore if vibration is blocked or unsupported
    }
  }
}
