import type {
  DirectemarIntegrationConfig,
  IntegrationTestResult,
  SatelliteIntegrationConfig,
  SignalKIntegrationConfig,
} from "@/lib/offline/db";

// ===========================================================================
// GENERIC HELPERS
// ===========================================================================

const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9-]{1,63})(\.[a-zA-Z0-9-]{1,63})*$/;

export function isValidHost(host: string): boolean {
  const h = host.trim();
  return IPV4_RE.test(h) || HOSTNAME_RE.test(h);
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function result(
  status: IntegrationTestResult["status"],
  message: string
): IntegrationTestResult {
  return { status, message, tested_at: new Date().toISOString() };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 4000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** True when an https page tries to reach a plain-http LAN device (blocked as mixed content). */
export function isMixedContentBlocked(targetProtocol: "http" | "https"): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    targetProtocol === "http"
  );
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

// ===========================================================================
// SIGNAL K / NMEA 2000 GATEWAY
// ===========================================================================

export function buildSignalKBaseUrl(cfg: SignalKIntegrationConfig): string {
  return `${cfg.protocol}://${cfg.host.trim()}:${cfg.port}`;
}

export function isSignalKConfigured(cfg: SignalKIntegrationConfig): boolean {
  return cfg.enabled && isValidHost(cfg.host) && isValidPort(cfg.port);
}

/**
 * Probes the Signal K discovery endpoint (`/signalk`) of a real gateway.
 * Signal K servers answer with `{ endpoints: { v1: { "signalk-http": ... } }, server: {...} }`.
 */
export async function testSignalKGateway(
  cfg: SignalKIntegrationConfig
): Promise<IntegrationTestResult> {
  if (!isValidHost(cfg.host)) {
    return result("error", "IP / hostname inválido. Ej: 192.168.1.100");
  }
  if (!isValidPort(cfg.port)) {
    return result("error", "Puerto inválido (1–65535). Signal K usa 3000 por defecto.");
  }
  if (isMixedContentBlocked(cfg.protocol)) {
    return result(
      "warning",
      "Configuración guardada, pero el navegador bloquea http:// desde una página https:// (mixed content). Usa el gateway con HTTPS o abre Marine OS desde la red local del barco."
    );
  }
  try {
    const res = await fetchWithTimeout(`${buildSignalKBaseUrl(cfg)}/signalk`);
    if (!res.ok) {
      return result("error", `El gateway respondió HTTP ${res.status}.`);
    }
    const data = (await res.json()) as {
      server?: { id?: string; version?: string };
      endpoints?: Record<string, unknown>;
    };
    if (!data.endpoints) {
      return result("warning", "El host responde, pero no parece un servidor Signal K.");
    }
    const server = data.server
      ? `${data.server.id ?? "signalk-server"} v${data.server.version ?? "?"}`
      : "Signal K";
    return result("ok", `Conectado a ${server}.`);
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return result(
      "error",
      aborted
        ? "Sin respuesta en 4 s. ¿Estás conectado a la Wi-Fi del barco?"
        : "No se pudo conectar (red, CORS o gateway apagado)."
    );
  }
}

export interface ParsedSignalKTelemetry {
  lat?: number;
  lon?: number;
  sog_kn?: number;
  cog_deg?: number;
  depth_m?: number;
  aws_kn?: number;
  awa_deg?: number;
  rpm?: number;
  coolant_temp_c?: number;
  oil_pressure_kpa?: number;
  alternator_voltage_v?: number;
  house_battery_soc_pct?: number;
}

type SKNode = { value?: unknown } & Record<string, unknown>;

function skValue(node: unknown): number | undefined {
  if (node && typeof node === "object" && "value" in (node as SKNode)) {
    const v = (node as SKNode).value;
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  }
  return undefined;
}

function firstChild(obj: unknown): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const values = Object.values(obj as Record<string, unknown>);
  const found = values.find((v) => v && typeof v === "object");
  return found as Record<string, unknown> | undefined;
}

const MS_TO_KN = 1.943844;
const RAD_TO_DEG = 180 / Math.PI;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Maps a Signal K `vessels/self` document (SI units) onto Marine OS telemetry.
 * Speeds m/s → kn, angles rad → deg, temperatures K → °C, pressure Pa → kPa, SoC ratio → %.
 */
export function parseSignalKSelf(doc: unknown): ParsedSignalKTelemetry {
  if (!doc || typeof doc !== "object") return {};
  const self = doc as Record<string, Record<string, unknown> | undefined>;
  const nav = self.navigation ?? {};
  const env = self.environment ?? {};
  const out: ParsedSignalKTelemetry = {};

  const pos = (nav.position as SKNode | undefined)?.value as
    | { latitude?: number; longitude?: number }
    | undefined;
  if (pos && typeof pos.latitude === "number" && typeof pos.longitude === "number") {
    out.lat = pos.latitude;
    out.lon = pos.longitude;
  }

  const sog = skValue(nav.speedOverGround);
  if (sog !== undefined) out.sog_kn = round1(sog * MS_TO_KN);

  const cog = skValue(nav.courseOverGroundTrue) ?? skValue(nav.courseOverGroundMagnetic);
  if (cog !== undefined) out.cog_deg = Math.round(((cog * RAD_TO_DEG) % 360 + 360) % 360);

  const depthNode = env.depth as Record<string, unknown> | undefined;
  const depth =
    skValue(depthNode?.belowTransducer) ??
    skValue(depthNode?.belowSurface) ??
    skValue(depthNode?.belowKeel);
  if (depth !== undefined) out.depth_m = round1(depth);

  const wind = env.wind as Record<string, unknown> | undefined;
  const aws = skValue(wind?.speedApparent);
  if (aws !== undefined) out.aws_kn = round1(aws * MS_TO_KN);
  const awa = skValue(wind?.angleApparent);
  if (awa !== undefined) out.awa_deg = Math.round(Math.abs(awa * RAD_TO_DEG));

  const engine = firstChild(self.propulsion);
  if (engine) {
    const rev = skValue(engine.revolutions);
    if (rev !== undefined) out.rpm = Math.round(rev * 60);
    const coolant = skValue(engine.coolantTemperature) ?? skValue(engine.temperature);
    if (coolant !== undefined) out.coolant_temp_c = round1(coolant - 273.15);
    const oil = skValue(engine.oilPressure);
    if (oil !== undefined) out.oil_pressure_kpa = Math.round(oil / 1000);
  }

  const electrical = self.electrical as Record<string, unknown> | undefined;
  const alternator = firstChild(electrical?.alternators);
  const altV = skValue(alternator?.voltage);
  if (altV !== undefined) out.alternator_voltage_v = Math.round(altV * 100) / 100;

  const battery = firstChild(electrical?.batteries);
  const soc = skValue((battery?.capacity as Record<string, unknown> | undefined)?.stateOfCharge);
  if (soc !== undefined) out.house_battery_soc_pct = Math.round(soc * 100);
  if (out.alternator_voltage_v === undefined) {
    const battV = skValue(battery?.voltage);
    if (battV !== undefined) out.alternator_voltage_v = Math.round(battV * 100) / 100;
  }

  return out;
}

/** Reads live telemetry from the configured onboard gateway. Throws on failure. */
export async function fetchSignalKSelf(
  cfg: SignalKIntegrationConfig
): Promise<ParsedSignalKTelemetry> {
  const res = await fetchWithTimeout(
    `${buildSignalKBaseUrl(cfg)}/signalk/v1/api/vessels/self`,
    {},
    2200
  );
  if (!res.ok) throw new Error(`Signal K HTTP ${res.status}`);
  return parseSignalKSelf(await res.json());
}

// ===========================================================================
// DIRECTEMAR (E-ZARPE)
// ===========================================================================

/**
 * Local validation only: there is no public DIRECTEMAR API wired into this
 * build yet — `/api/v1/zarpe/transmit` is a simulated government webhook.
 */
export function validateDirectemarConfig(
  cfg: DirectemarIntegrationConfig
): IntegrationTestResult {
  if (!cfg.username.trim()) return result("error", "Falta el usuario / RUT del armador.");
  if (cfg.api_key.trim().length < 8) {
    return result("error", "La API key debe tener al menos 8 caracteres.");
  }
  if (!/^[A-Z]{2,3}-?\d{3,6}$/i.test(cfg.vessel_registration.trim())) {
    return result("error", "Matrícula inválida. Formato esperado: CB-4582.");
  }
  return result(
    "warning",
    "Credenciales con formato válido y guardadas en el dispositivo. La transmisión oficial sigue en modo simulado hasta habilitar la API real de DIRECTEMAR."
  );
}

// ===========================================================================
// SATELLITE (IRIDIUM GO! / GARMIN INREACH)
// ===========================================================================

export async function testSatelliteLink(
  cfg: SatelliteIntegrationConfig
): Promise<IntegrationTestResult> {
  if (cfg.provider === "none") {
    return result("error", "Selecciona un proveedor satelital.");
  }
  if (cfg.device_imei && !/^\d{15}$/.test(cfg.device_imei.trim())) {
    return result("error", "El IMEI debe tener 15 dígitos.");
  }

  if (cfg.provider === "garmin_inreach") {
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(cfg.mapshare_id.trim())) {
      return result("error", "MapShare ID inválido (ej. share.garmin.com/CapValverde → CapValverde).");
    }
    return result(
      "warning",
      "Datos de inReach guardados. Garmin no permite consultar el feed MapShare desde el navegador (CORS); la verificación remota requiere el backend."
    );
  }

  // Iridium GO!: device exposes a local Wi-Fi web UI (default 192.168.10.1)
  if (!isValidHost(cfg.iridium_host)) {
    return result("error", "Host del Iridium GO! inválido (por defecto 192.168.10.1).");
  }
  if (isMixedContentBlocked("http")) {
    return result(
      "warning",
      "Configuración guardada. El navegador bloquea http://192.168.10.1 desde https://; prueba desde la Wi-Fi del Iridium GO! con Marine OS local."
    );
  }
  try {
    // `no-cors` yields an opaque response: reaching it at all proves the host is up.
    await fetchWithTimeout(`http://${cfg.iridium_host.trim()}/`, { mode: "no-cors" }, 3500);
    return result("ok", `Iridium GO! alcanzable en ${cfg.iridium_host.trim()}.`);
  } catch {
    return result("error", "Iridium GO! no responde. Conéctate a su red Wi-Fi.");
  }
}
