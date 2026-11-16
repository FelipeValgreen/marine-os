import Dexie, { type Table } from "dexie";
import { getApiBaseUrl } from "@/lib/api";

export interface OrganizationRecord {
  id: string;
  name: string;
  tax_id?: string;
  country_code: string;
  plan_tier: "b2c_free" | "b2c_pro" | "b2b_fleet";
  created_at: string;
}

export interface VesselRecord {
  id: string;
  org_id: string;
  name: string;
  registration_number: string;
  vessel_type: "sailboat" | "catamaran" | "motor_yacht";
  loa_meters: number;
  beam_meters: number;
  draft_meters: number;
  mast_height_meters: number;
  fuel_capacity_l: number;
  water_capacity_l: number;
  engine_hours_current: number;
  polar_data: Record<string, unknown>;
  created_at: string;
}

export interface VesselSystemQRRecord {
  id: string;
  vessel_id: string;
  qr_slug: string;
  system_name: string;
  category: "engine" | "plumbing_wc" | "electrical" | "anchoring" | "safety" | "rigging";
  compartment_location: string;
  video_tutorial_url?: string;
  quick_instructions: string;
  created_at: string;
}

export interface InventoryItemRecord {
  id: string;
  vessel_id: string;
  qr_node_id: string | null;
  item_name: string;
  category: string;
  quantity: number;
  min_threshold: number;
  expiration_date: string | null;
  updated_at: string;
}

export interface AnchorageSpatialRecord {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  lat: number;
  lon: number;
  exposed_bearings: number[];
  seabed_type: "sand" | "mud" | "rock" | "weed" | "mixed";
  min_depth_m: number;
  max_depth_m: number;
  tide_amplitude_m: number;
  created_at: string;
}

export interface VoyageRecord {
  id: string;
  vessel_id: string;
  title: string;
  status: "draft" | "checkin_pending" | "active" | "completed";
  departure_port: string;
  arrival_port: string;
  departure_at: string;
  estimated_arrival_at?: string;
  gpx_raw_xml?: string;
  magic_link_token: string;
  security_deposit_amount: number;
  security_deposit_status: "pending" | "held" | "released";
  approval_token?: string;
  approved_at?: string;
  created_at: string;
}

export interface VoyageCrewRecord {
  id: string;
  voyage_id: string;
  role: "skipper" | "crew" | "guest";
  full_name: string;
  document_type: string;
  document_number: string;
  nationality: string;
  license_type?: string;
  license_number?: string;
  license_expiry?: string;
  ocr_verified: boolean;
  waiver_signed_at: string | null;
  created_at: string;
}

export interface HandoverChecklistItem {
  id: string;
  system_name: string;
  category: string;
  status: "ok" | "observation" | "critical";
  notes: string;
}

export interface HandoverPhotoEvidence {
  id: string;
  label: string;
  data_url: string;
  captured_at: string;
}

export interface HandoverInspectionRecord {
  id: string;
  voyage_id: string;
  vessel_id: string;
  inspection_type: "checkin" | "checkout";
  checklist_data: HandoverChecklistItem[];
  photos_evidence: HandoverPhotoEvidence[];
  signature_svg: string;
  integrity_hash: string;
  completed_offline_at: string;
  synced_at: string | null;
}

export interface VesselManualChunkRecord {
  id: string;
  vessel_id: string;
  manual_title: string;
  page_number: number;
  content: string;
  related_qr_slug?: string;
}

export interface SyncQueueRecord {
  id: string;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "UPSERT";
  record_id: string;
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "failed";
  created_offline_at: string;
  synced_at?: string;
}

export interface LogbookEntryRecord {
  id: string;
  voyage_id: string;
  timestamp: string;
  lat: number;
  lon: number;
  sog_kn: number;
  cog_deg: number;
  wind_kn: number;
  engine_hours: number;
  notes: string;
  author: string;
}

export interface ExpenseRecord {
  id: string;
  voyage_id: string;
  title: string;
  category: "fuel" | "provisions" | "mooring" | "other";
  amount_usd: number;
  amount_clp: number;
  paid_by: string;
  receipt_number?: string;
  ocr_verified: boolean;
  created_at: string;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  sog_kn: number;
  cog_deg: number;
  depth_m: number;
  timestamp: string;
}

export interface VoyageTrackRecord {
  id: string;
  voyage_id: string;
  title: string;
  skipper_name: string;
  started_at: string;
  ended_at: string;
  distance_nm: number;
  max_sog_kn: number;
  avg_sog_kn: number;
  points: TrackPoint[];
}

export interface UserPreferencesRecord {
  id: string;
  has_completed_onboarding: boolean;
  tooltip_gps_seen: boolean;
  tooltip_zarpe_pdf_seen: boolean;
  completed_lessons: string[];
  /** Vessel currently operated by the user (Fleet Manager). Falls back to the demo vessel. */
  active_vessel_id?: string;
  updated_at: string;
}

export type MarketplaceOrderStatus =
  | "quoted_offline"
  | "confirmed"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface MarketplaceOrderStatusEvent {
  status: MarketplaceOrderStatus;
  at: string;
  note?: string;
}

export interface MarketplaceOrderRecord {
  id: string;
  voyage_id: string;
  vessel_id: string;
  part_name: string;
  part_sku: string;
  arrival_port: string;
  supplier_name: string;
  estimated_price_usd: number;
  status: MarketplaceOrderStatus;
  status_history?: MarketplaceOrderStatusEvent[];
  tracking_code?: string;
  created_at: string;
  updated_at?: string;
}

export type IntegrationTestStatus = "untested" | "ok" | "warning" | "error";

export interface IntegrationTestResult {
  status: IntegrationTestStatus;
  message: string;
  tested_at: string | null;
}

export interface SignalKIntegrationConfig {
  enabled: boolean;
  protocol: "http" | "https";
  host: string;
  port: number;
  last_test: IntegrationTestResult;
}

export interface DirectemarIntegrationConfig {
  enabled: boolean;
  environment: "sandbox" | "production";
  username: string;
  /** Stored only on-device. Never enqueued to sync_queue in clear text. */
  api_key: string;
  vessel_registration: string;
  last_test: IntegrationTestResult;
}

export interface SatelliteIntegrationConfig {
  enabled: boolean;
  provider: "none" | "iridium_go" | "garmin_inreach";
  /** Iridium GO! local Wi-Fi host (default 192.168.10.1). */
  iridium_host: string;
  /** Iridium IMEI or Garmin inReach IMEI. */
  device_imei: string;
  /** Garmin MapShare identifier (share.garmin.com/<id>). */
  mapshare_id: string;
  emergency_contact: string;
  last_test: IntegrationTestResult;
}

export interface IntegrationSettingsRecord {
  id: string;
  signalk: SignalKIntegrationConfig;
  directemar: DirectemarIntegrationConfig;
  satellite: SatelliteIntegrationConfig;
  updated_at: string;
}

export interface CrewContactRecord {
  id: string;
  full_name: string;
  document_type: string;
  document_number: string;
  nationality: string;
  default_role: "skipper" | "crew" | "guest";
  license_type?: string;
  license_number?: string;
  license_expiry?: string;
  phone?: string;
  email?: string;
  notes?: string;
  ocr_verified?: boolean;
  voyages_count?: number;
  last_embarked_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface UserProfileAccount {
  id: string;
  name: string;
  email?: string;
  authProvider?: "google" | "offline_guest";
  shortLabel: string;
  role: "fleet_admin" | "skipper" | "crew";
  roleBadge: string;
  documentType: string;
  documentNumber: string;
  nationality: string;
  licenseType: string;
  licenseNumber: string;
  licenseExpiry: string;
  maxLoaMeters: number;
  vhfOperatorCert: string;
  loggedMilesNm: number;
  avatarInitials: string;
  /** Optional downscaled JPEG data URL (stored locally in IndexedDB). */
  avatarDataUrl?: string;
  updated_at?: string;
}

export const PRECONFIGURED_ACCOUNTS: UserProfileAccount[] = [
  {
    id: "acc-felipe-valverde",
    name: "Cap. Felipe Valverde",
    shortLabel: "Cap. Felipe Valverde",
    role: "fleet_admin",
    roleBadge: "Fleet Admin / Armador & Capitán",
    documentType: "RUT",
    documentNumber: "13.452.890-1",
    nationality: "CL",
    licenseType: "Capitán Deportivo de Alta Mar (DIRECTEMAR)",
    licenseNumber: "CDAM-2021-9042",
    licenseExpiry: "2031-06-30",
    maxLoaMeters: 30.0,
    vhfOperatorCert: "Restringido GMDSS #CL-4410",
    loggedMilesNm: 8420,
    avatarInitials: "FV",
  },
  {
    id: "acc-rodrigo-soto",
    name: "Skipper Rodrigo Soto",
    shortLabel: "Skipper Rodrigo Soto",
    role: "skipper",
    roleBadge: "Skipper / Patrón Titular",
    documentType: "RUT",
    documentNumber: "16.781.234-K",
    nationality: "CL",
    licenseType: "Capitán Deportivo Costero (DIRECTEMAR)",
    licenseNumber: "CDC-2024-8841",
    licenseExpiry: "2029-11-15",
    maxLoaMeters: 24.0,
    vhfOperatorCert: "Operador Radiotelefonista #CL-7812",
    loggedMilesNm: 3910,
    avatarInitials: "RS",
  },
  {
    id: "acc-cami-vargas",
    name: "Cami Vargas",
    shortLabel: "Cami Vargas",
    role: "crew",
    roleBadge: "Crew / Tripulante de Guardia",
    documentType: "RUT",
    documentNumber: "19.832.104-5",
    nationality: "CL",
    licenseType: "Patrón Deportivo de Bahía (DIRECTEMAR)",
    licenseNumber: "PDB-2025-3319",
    licenseExpiry: "2027-02-10",
    maxLoaMeters: 14.0,
    vhfOperatorCert: "Curso Básico Seguridad SOLAS",
    loggedMilesNm: 960,
    avatarInitials: "CV",
  },
];

export class MarinOSDatabase extends Dexie {
  organizations!: Table<OrganizationRecord, string>;
  vessels!: Table<VesselRecord, string>;
  vessel_systems_qr!: Table<VesselSystemQRRecord, string>;
  inventory_items!: Table<InventoryItemRecord, string>;
  anchorages_spatial!: Table<AnchorageSpatialRecord, string>;
  voyages!: Table<VoyageRecord, string>;
  voyage_crew!: Table<VoyageCrewRecord, string>;
  handover_inspections!: Table<HandoverInspectionRecord, string>;
  vessel_manual_chunks!: Table<VesselManualChunkRecord, string>;
  sync_queue!: Table<SyncQueueRecord, string>;
  logbook_entries!: Table<LogbookEntryRecord, string>;
  expenses!: Table<ExpenseRecord, string>;
  voyage_tracks!: Table<VoyageTrackRecord, string>;
  user_profiles!: Table<UserProfileAccount, string>;
  user_preferences!: Table<UserPreferencesRecord, string>;
  marketplace_orders!: Table<MarketplaceOrderRecord, string>;
  integration_settings!: Table<IntegrationSettingsRecord, string>;
  crew_contacts!: Table<CrewContactRecord, string>;
  frequent_crew!: Table<CrewContactRecord, string>;

  constructor() {
    super("MarinOSLocalFirstDB");
    this.version(5).stores({
      organizations: "id, name, country_code, plan_tier",
      vessels: "id, org_id, registration_number, name",
      vessel_systems_qr: "id, vessel_id, &qr_slug, category",
      inventory_items: "id, vessel_id, qr_node_id, category",
      anchorages_spatial: "id, &slug, name, seabed_type",
      voyages: "id, vessel_id, &magic_link_token, status",
      voyage_crew: "id, voyage_id, role, document_number",
      handover_inspections: "id, voyage_id, vessel_id, inspection_type, completed_offline_at",
      vessel_manual_chunks: "id, vessel_id, manual_title",
      sync_queue: "id, table_name, status, created_offline_at",
      logbook_entries: "id, voyage_id, timestamp",
      expenses: "id, voyage_id, category, created_at",
      voyage_tracks: "id, voyage_id, started_at",
      user_profiles: "id, role, documentNumber",
      user_preferences: "id",
      marketplace_orders: "id, voyage_id, vessel_id, arrival_port, created_at",
    });
    // v6: Integration Hub settings + Crew Address Book (Dexie merges with v5 schema)
    this.version(6).stores({
      integration_settings: "id",
      crew_contacts: "id, document_number, full_name, license_expiry",
    });
    // v7: frequent_crew table
    this.version(7).stores({
      frequent_crew: "id, document_number, full_name, license_expiry",
    });
  }
}

export const MarineOSDatabase = MarinOSDatabase;
export const db = new MarinOSDatabase();
export type FrequentCrewRecord = CrewContactRecord;

// ===========================================================================
// INTEGRATION HUB DEFAULTS
// ===========================================================================
export const INTEGRATION_SETTINGS_ID = "default";

const UNTESTED: IntegrationTestResult = {
  status: "untested",
  message: "Sin probar",
  tested_at: null,
};

export function createDefaultIntegrationSettings(): IntegrationSettingsRecord {
  return {
    id: INTEGRATION_SETTINGS_ID,
    signalk: {
      enabled: false,
      protocol: "http",
      host: "",
      port: 3000,
      last_test: { ...UNTESTED },
    },
    directemar: {
      enabled: false,
      environment: "sandbox",
      username: "",
      api_key: "",
      vessel_registration: "",
      last_test: { ...UNTESTED },
    },
    satellite: {
      enabled: false,
      provider: "none",
      iridium_host: "192.168.10.1",
      device_imei: "",
      mapshare_id: "",
      emergency_contact: "",
      last_test: { ...UNTESTED },
    },
    updated_at: new Date().toISOString(),
  };
}

/** Returns stored integration settings merged over defaults (tolerates partial records). */
export async function getIntegrationSettings(): Promise<IntegrationSettingsRecord> {
  const defaults = createDefaultIntegrationSettings();
  const stored = await db.integration_settings.get(INTEGRATION_SETTINGS_ID);
  if (!stored) return defaults;
  return {
    ...defaults,
    ...stored,
    signalk: { ...defaults.signalk, ...stored.signalk },
    directemar: { ...defaults.directemar, ...stored.directemar },
    satellite: { ...defaults.satellite, ...stored.satellite },
  };
}

// ===========================================================================
// CREW ADDRESS BOOK HELPERS
// ===========================================================================
export function normalizeDocumentNumber(doc: string): string {
  return doc.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function crewContactIdFor(documentNumber: string): string {
  return `crew-contact-${normalizeDocumentNumber(documentNumber)}`;
}

/**
 * Upserts a crew member into the frequent-crew address book, keyed by normalized
 * document number so re-saving the same person updates instead of duplicating.
 */
export async function saveCrewContactFromVoyageCrew(
  member: Pick<
    VoyageCrewRecord,
    | "full_name"
    | "document_type"
    | "document_number"
    | "nationality"
    | "role"
    | "license_type"
    | "license_expiry"
    | "ocr_verified"
  >
): Promise<CrewContactRecord> {
  const id = crewContactIdFor(member.document_number);
  const now = new Date().toISOString();
  const existing = await db.crew_contacts.get(id);
  const record: CrewContactRecord = {
    id,
    full_name: member.full_name.trim(),
    document_type: member.document_type,
    document_number: member.document_number.trim(),
    nationality: member.nationality,
    default_role: member.role,
    license_type: member.license_type,
    license_expiry: member.license_expiry,
    phone: existing?.phone,
    email: existing?.email,
    notes: existing?.notes,
    ocr_verified: member.ocr_verified || existing?.ocr_verified || false,
    voyages_count: existing?.voyages_count ?? 0,
    last_embarked_at: existing?.last_embarked_at,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await db.crew_contacts.put(record);
  if (db.frequent_crew) {
    await db.frequent_crew.put(record);
  }
  await enqueueOfflineMutation({
    table_name: "frequent_crew",
    operation: "UPSERT",
    record_id: id,
    payload: record as unknown as Record<string, unknown>,
  });
  return record;
}

export const DEMO_IDS = {
  ORG_ID: "11111111-1111-1111-1111-111111111111",
  VESSEL_ID: "22222222-2222-2222-2222-222222222222",
  QR_YANMAR_ID: "33333333-3333-3333-3333-333333333331",
  QR_JABSCO_ID: "33333333-3333-3333-3333-333333333332",
  QR_WINDLASS_ID: "33333333-3333-3333-3333-333333333333",
  VOYAGE_ID: "44444444-4444-4444-4444-444444444444",
  MAGIC_TOKEN: "demo-trip-albatros-2026",
} as const;

let seedPromise: Promise<void> | null = null;

/**
 * Idempotently populates IndexedDB with all data from 0002_seed_demo.sql
 * plus spatial anchorages, crew, manual chunks, logbook, expenses, and historical GPS tracks.
 */
export async function ensureDemoSeedData(): Promise<void> {
  if (typeof window === "undefined") return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    await db.transaction(
      "rw",
      [
        db.organizations,
        db.vessels,
        db.vessel_systems_qr,
        db.inventory_items,
        db.anchorages_spatial,
        db.voyages,
        db.voyage_crew,
        db.vessel_manual_chunks,
        db.logbook_entries,
        db.expenses,
        db.voyage_tracks,
        db.user_profiles,
        db.user_preferences,
      ],
      async () => {
        const existingPrefs = await db.user_preferences.get("default");
        if (!existingPrefs) {
          await db.user_preferences.put({
            id: "default",
            has_completed_onboarding: false,
            tooltip_gps_seen: false,
            tooltip_zarpe_pdf_seen: false,
            completed_lessons: ["lesson-offline-first"],
            updated_at: now,
          });
        }

        const profilesCount = await db.user_profiles.count();
        if (profilesCount === 0) {
          await db.user_profiles.bulkPut(PRECONFIGURED_ACCOUNTS);
        }
        // Always ensure Seno de Reloncaví / Puerto Montt (-41.4717, -72.9369) & Chiloé anchorages are up to date
        await db.anchorages_spatial.bulkPut([
          {
            id: "66666666-6666-6666-6666-666666666662",
            slug: "marina-puerto-montt",
            name: "Seno de Reloncaví — Canal Tenglo / Puerto Montt",
            country_code: "CL",
            lat: -41.4717,
            lon: -72.9369,
            exposed_bearings: [165, 180],
            seabed_type: "sand",
            min_depth_m: 6.4,
            max_depth_m: 14.5,
            tide_amplitude_m: 6.1,
            created_at: now,
          },
          {
            id: "66666666-6666-6666-6666-666666666661",
            slug: "caleta-mechuque",
            name: "Caleta Mechuque (Archipiélago Chauques, Chiloé)",
            country_code: "CL",
            lat: -42.3125,
            lon: -73.268,
            exposed_bearings: [180, 195, 210],
            seabed_type: "sand",
            min_depth_m: 5.2,
            max_depth_m: 12.0,
            tide_amplitude_m: 4.2,
            created_at: now,
          },
          {
            id: "66666666-6666-6666-6666-666666666663",
            slug: "caleta-dalcahue",
            name: "Canal Dalcahue — Fondeadero Astilleros",
            country_code: "CL",
            lat: -42.381,
            lon: -73.651,
            exposed_bearings: [90, 270],
            seabed_type: "mud",
            min_depth_m: 4.2,
            max_depth_m: 8.5,
            tide_amplitude_m: 3.8,
            created_at: now,
          },
          {
            id: "66666666-6666-6666-6666-666666666664",
            slug: "bahia-ilque",
            name: "Bahía Ilque / Isla Huar (Seno de Reloncaví)",
            country_code: "CL",
            lat: -41.635,
            lon: -73.082,
            exposed_bearings: [30, 45, 60],
            seabed_type: "sand",
            min_depth_m: 5.8,
            max_depth_m: 15.0,
            tide_amplitude_m: 5.4,
            created_at: now,
          },
        ]);

        const vesselCount = await db.vessels.count();
        if (vesselCount === 0) {
          // 1. Organization (from 0002_seed_demo.sql)
          await db.organizations.put({
            id: DEMO_IDS.ORG_ID,
            name: "Chárter Austral & Pacífico",
            tax_id: "76.543.210-K",
            country_code: "CL",
            plan_tier: "b2b_fleet",
            created_at: now,
          });

          // 2. Vessel (from 0002_seed_demo.sql)
          await db.vessels.put({
            id: DEMO_IDS.VESSEL_ID,
            org_id: DEMO_IDS.ORG_ID,
            name: "SV Albatros (Oceanis 41.1)",
            registration_number: "CB-4582",
            vessel_type: "sailboat",
            loa_meters: 12.43,
            beam_meters: 4.2,
            draft_meters: 2.18,
            mast_height_meters: 18.5,
            fuel_capacity_l: 200,
            water_capacity_l: 330,
            engine_hours_current: 1420.5,
            polar_data: {
              tws_8: { beat_angle: 44, beat_vmg: 4.6, run_vmg: 5.1 },
              tws_12: { beat_angle: 41, beat_vmg: 5.8, run_vmg: 6.7 },
              tws_16: { beat_angle: 39, beat_vmg: 6.5, run_vmg: 7.6 },
              tws_20: { beat_angle: 40, beat_vmg: 6.8, run_vmg: 8.2 },
            },
            created_at: now,
          });

          // 3. Vessel QR Systems (from 0002_seed_demo.sql)
          await db.vessel_systems_qr.bulkPut([
            {
              id: DEMO_IDS.QR_YANMAR_ID,
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_slug: "yanmar-4jh57",
              system_name: "Motor Yanmar 4JH57 (57 HP)",
              category: "engine",
              compartment_location: "Bajo escalera salón principal",
              video_tutorial_url: "local://microvideo/yanmar-4jh57",
              quick_instructions:
                "1. Verificar grifo de fondo agua salada abierto (palanca vertical). 2. Revisar nivel aceite y refrigerante. 3. Encender contacto, esperar precalentamiento y dar arranque.",
              created_at: now,
            },
            {
              id: DEMO_IDS.QR_JABSCO_ID,
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_slug: "jabsco-wc-popa",
              system_name: "Baño Marino Jabsco Popa",
              category: "plumbing_wc",
              compartment_location: "Baño de popa estribor",
              video_tutorial_url: "local://microvideo/jabsco-wc-popa",
              quick_instructions:
                "NUNCA arrojar papel higiénico ni toallitas. Bombear 10 veces en modo Flush (palanca izquierda) y 10 veces en modo Dry (palanca derecha) al terminar.",
              created_at: now,
            },
            {
              id: DEMO_IDS.QR_WINDLASS_ID,
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_slug: "quick-windlass",
              system_name: "Molinete de Ancla Quick 1000W",
              category: "anchoring",
              compartment_location: "Pozo de anclas proa",
              video_tutorial_url: "local://microvideo/quick-windlass",
              quick_instructions:
                "Operar SIEMPRE con el motor principal encendido a 1.200 RPM para evitar caída de voltaje. Asegurar cadena con boza antes de navegar.",
              created_at: now,
            },
          ]);

          // 4. Inventory Items (from 0002_seed_demo.sql)
          await db.inventory_items.bulkPut([
            {
              id: "55555555-5555-5555-5555-555555555551",
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_node_id: DEMO_IDS.QR_YANMAR_ID,
              item_name: "Impulsor Bomba Agua Yanmar + Empaquetadura",
              category: "repuestos_motor",
              quantity: 2,
              min_threshold: 1,
              expiration_date: null,
              updated_at: now,
            },
            {
              id: "55555555-5555-5555-5555-555555555552",
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_node_id: DEMO_IDS.QR_YANMAR_ID,
              item_name: "Filtro Combustible Racor R20P (10 micras)",
              category: "repuestos_motor",
              quantity: 3,
              min_threshold: 2,
              expiration_date: null,
              updated_at: now,
            },
            {
              id: "55555555-5555-5555-5555-555555555553",
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_node_id: null,
              item_name: "Kit Bengalas Solas (4 Paracaídas + 4 Mano)",
              category: "seguridad",
              quantity: 1,
              min_threshold: 1,
              expiration_date: "2027-08-15",
              updated_at: now,
            },
            {
              id: "55555555-5555-5555-5555-555555555554",
              vessel_id: DEMO_IDS.VESSEL_ID,
              qr_node_id: DEMO_IDS.QR_JABSCO_ID,
              item_name: "Válvula Joker Repuesto Jabsco Twist n Lock",
              category: "plomeria",
              quantity: 1,
              min_threshold: 1,
              expiration_date: null,
              updated_at: now,
            },
          ]);

          // 5. Voyage (from 0002_seed_demo.sql)
          await db.voyages.put({
            id: DEMO_IDS.VOYAGE_ID,
            vessel_id: DEMO_IDS.VESSEL_ID,
            title: "Travesía Chiloé - Isla Mechuque",
            status: "checkin_pending",
            departure_port: "Marina Puerto Montt",
            arrival_port: "Caleta Mechuque",
            departure_at: tomorrow,
            estimated_arrival_at: new Date(Date.now() + 4 * 86400000).toISOString(),
            magic_link_token: DEMO_IDS.MAGIC_TOKEN,
            security_deposit_amount: 3500.0,
            security_deposit_status: "held",
            created_at: now,
          });

          // 6. Spatial Anchorages in Patagonia / Chiloé (Centered on Seno de Reloncaví / Puerto Montt)
          await db.anchorages_spatial.bulkPut([
            {
              id: "66666666-6666-6666-6666-666666666662",
              slug: "marina-puerto-montt",
              name: "Seno de Reloncaví — Canal Tenglo / Puerto Montt",
              country_code: "CL",
              lat: -41.4717,
              lon: -72.9369,
              exposed_bearings: [165, 180],
              seabed_type: "sand",
              min_depth_m: 6.4,
              max_depth_m: 14.5,
              tide_amplitude_m: 6.1,
              created_at: now,
            },
            {
              id: "66666666-6666-6666-6666-666666666661",
              slug: "caleta-mechuque",
              name: "Caleta Mechuque (Archipiélago Chauques, Chiloé)",
              country_code: "CL",
              lat: -42.3125,
              lon: -73.268,
              exposed_bearings: [180, 195, 210],
              seabed_type: "sand",
              min_depth_m: 5.2,
              max_depth_m: 12.0,
              tide_amplitude_m: 4.2,
              created_at: now,
            },
            {
              id: "66666666-6666-6666-6666-666666666663",
              slug: "caleta-dalcahue",
              name: "Canal Dalcahue — Fondeadero Astilleros",
              country_code: "CL",
              lat: -42.381,
              lon: -73.651,
              exposed_bearings: [90, 270],
              seabed_type: "mud",
              min_depth_m: 4.2,
              max_depth_m: 8.5,
              tide_amplitude_m: 3.8,
              created_at: now,
            },
            {
              id: "66666666-6666-6666-6666-666666666664",
              slug: "bahia-ilque",
              name: "Bahía Ilque / Isla Huar (Seno de Reloncaví)",
              country_code: "CL",
              lat: -41.635,
              lon: -73.082,
              exposed_bearings: [30, 45, 60],
              seabed_type: "sand",
              min_depth_m: 5.8,
              max_depth_m: 15.0,
              tide_amplitude_m: 5.4,
              created_at: now,
            },
          ]);

          // 7. Initial Crew Members matching the 3 accounts
          await db.voyage_crew.bulkPut([
            {
              id: "77777777-7777-7777-7777-777777777771",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              role: "skipper",
              full_name: "Cap. Felipe Valverde",
              document_type: "RUT",
              document_number: "13.452.890-1",
              nationality: "CL",
              license_type: "Capitán Deportivo de Alta Mar (DIRECTEMAR)",
              license_expiry: "2031-06-30",
              ocr_verified: true,
              waiver_signed_at: now,
              created_at: now,
            },
            {
              id: "77777777-7777-7777-7777-777777777772",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              role: "skipper",
              full_name: "Skipper Rodrigo Soto",
              document_type: "RUT",
              document_number: "16.781.234-K",
              nationality: "CL",
              license_type: "Capitán Deportivo Costero (DIRECTEMAR)",
              license_expiry: "2029-11-15",
              ocr_verified: true,
              waiver_signed_at: now,
              created_at: now,
            },
            {
              id: "77777777-7777-7777-7777-777777777773",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              role: "crew",
              full_name: "Cami Vargas",
              document_type: "RUT",
              document_number: "19.832.104-5",
              nationality: "CL",
              license_type: "Patrón Deportivo de Bahía (DIRECTEMAR)",
              license_expiry: "2027-02-10",
              ocr_verified: true,
              waiver_signed_at: now,
              created_at: now,
            },
          ]);

          // 7b. Seed Initial Frequent Crew / Contacts (Agenda de Tripulación Frecuente)
          const initialFrequentCrew: CrewContactRecord[] = [
            {
              id: "contact-felipe-valverde",
              full_name: "Cap. Felipe Valverde",
              document_type: "RUT",
              document_number: "13.452.890-1",
              nationality: "Chilena",
              license_type: "Capitán Deportivo de Alta Mar (DIRECTEMAR)",
              license_number: "ARM-CL-94821",
              license_expiry: "2031-06-30",
              default_role: "skipper",
              notes: "Capitán y Armador SV Albatros",
              ocr_verified: true,
              voyages_count: 14,
              created_at: now,
              updated_at: now,
            },
            {
              id: "contact-rodrigo-soto",
              full_name: "Skipper Rodrigo Soto",
              document_type: "RUT",
              document_number: "16.781.234-K",
              nationality: "Chilena",
              license_type: "Capitán Deportivo Costero (DIRECTEMAR)",
              license_number: "ARM-CL-77412",
              license_expiry: "2029-11-15",
              default_role: "skipper",
              notes: "Patrón de relevo y oficial de guardia",
              ocr_verified: true,
              voyages_count: 8,
              created_at: now,
              updated_at: now,
            },
            {
              id: "contact-cami-vargas",
              full_name: "Cami Vargas",
              document_type: "RUT",
              document_number: "19.832.104-5",
              nationality: "Chilena",
              license_type: "Patrón Deportivo de Bahía (DIRECTEMAR)",
              license_number: "ARM-CL-66019",
              license_expiry: "2027-02-10",
              default_role: "crew",
              notes: "Proel y navegante táctico",
              ocr_verified: true,
              voyages_count: 5,
              created_at: now,
              updated_at: now,
            },
          ];
          await db.crew_contacts.bulkPut(initialFrequentCrew);
          if (db.frequent_crew) {
            await db.frequent_crew.bulkPut(initialFrequentCrew);
          }

          // 8. Vessel Manual Chunks for local offline RAG
          await db.vessel_manual_chunks.bulkPut([
            {
              id: "88888888-8888-8888-8888-888888888881",
              vessel_id: DEMO_IDS.VESSEL_ID,
              manual_title: "Manual Técnico Yanmar 4JH57 Common Rail",
              page_number: 48,
              content:
                "Alarma de sobretemperatura de agua o falta de caudal en escape: 1) Verificar grifo de fondo abierto (palanca vertical bajo escalera del salón). 2) Limpiar canastillo de filtro de agua de mar Vetus. 3) Reemplazar impulsor con repuesto a bordo (2 uds disponibles en nodo QR yanmar-4jh57).",
              related_qr_slug: "yanmar-4jh57",
            },
            {
              id: "88888888-8888-8888-8888-888888888882",
              vessel_id: DEMO_IDS.VESSEL_ID,
              manual_title: "Sistema de Combustible & Prefiltro Racor R20P",
              page_number: 33,
              content:
                "Pérdida de RPM o caída de presión de riel en Yanmar 4JH57: Drenar decantador inferior del filtro Racor. Si persiste, cambiar cartucho por Filtro Racor R20P de 10 micras (3 uds en inventario a bordo) y bombear cebador manual.",
              related_qr_slug: "yanmar-4jh57",
            },
            {
              id: "88888888-8888-8888-8888-888888888883",
              vessel_id: DEMO_IDS.VESSEL_ID,
              manual_title: "Baño Marino Jabsco Twist 'n' Lock",
              page_number: 12,
              content:
                "Nunca arrojar papel higiénico. Realizar 10 bombeos en modo Flush y 10 en modo Dry. Cerrar siempre con giro Twist 'n' Lock al navegar con escora.",
              related_qr_slug: "jabsco-wc-popa",
            },
            {
              id: "88888888-8888-8888-8888-888888888884",
              vessel_id: DEMO_IDS.VESSEL_ID,
              manual_title: "Molinete de Ancla Quick 1000W",
              page_number: 19,
              content:
                "Operar exclusivamente con motor principal a >= 1.200 RPM. Si salta el térmico de 80A en mesa de cartas, aliviar tensión avante con motor antes de cobrar.",
              related_qr_slug: "quick-windlass",
            },
          ]);

          // 9. Initial Logbook Entries
          await db.logbook_entries.bulkPut([
            {
              id: "99999999-9999-9999-9999-999999999991",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              timestamp: now,
              lat: -41.4812,
              lon: -72.9615,
              sog_kn: 6.4,
              cog_deg: 185,
              wind_kn: 14.5,
              engine_hours: 1420.5,
              notes:
                "Zarpe desde Marina Puerto Montt por Canal Tenglo. Grifos de fondo, aceite Yanmar y tensión de baterías verificados.",
              author: "Cap. Felipe Valverde",
            },
            {
              id: "99999999-9999-9999-9999-999999999992",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
              lat: -41.882,
              lon: -73.214,
              sog_kn: 7.1,
              cog_deg: 192,
              wind_kn: 16.8,
              engine_hours: 1419.0,
              notes:
                "Cruce Golfo de Ancud con 1 rizo en mayor y génova al 85%. Escucha permanente VHF Canal 16.",
              author: "Skipper Rodrigo Soto",
            },
          ]);

          // 10. Initial Shared Expenses
          await db.expenses.bulkPut([
            {
              id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              title: "Combustible Diesel Marino COPEC Chinquihue (125L)",
              category: "fuel",
              amount_usd: 178.0,
              amount_clp: 168500,
              paid_by: "Cap. Felipe Valverde",
              receipt_number: "BOL-884920",
              ocr_verified: true,
              created_at: now,
            },
            {
              id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              title: "Aprovisionamiento Víveres & Agua Travesía Chiloé",
              category: "provisions",
              amount_usd: 260.0,
              amount_clp: 245900,
              paid_by: "Cami Vargas",
              receipt_number: "BOL-441092",
              ocr_verified: true,
              created_at: now,
            },
          ]);
        }

        const tracksCount = await db.voyage_tracks.count();
        if (tracksCount === 0) {
          await db.voyage_tracks.bulkPut([
            {
              id: "track-chiloe-mechuque-01",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              title: "Pierna 1: Marina Puerto Montt → Caleta Mechuque",
              skipper_name: "Cap. Felipe Valverde",
              started_at: "2026-11-14T08:30:00Z",
              ended_at: "2026-11-14T16:45:00Z",
              distance_nm: 52.4,
              max_sog_kn: 8.2,
              avg_sog_kn: 6.4,
              points: [
                { lat: -41.4812, lon: -72.9615, sog_kn: 5.4, cog_deg: 195, depth_m: 14.2, timestamp: "08:30 UTC" },
                { lat: -41.6120, lon: -73.0180, sog_kn: 6.2, cog_deg: 190, depth_m: 38.0, timestamp: "10:00 UTC" },
                { lat: -41.7240, lon: -73.0650, sog_kn: 6.8, cog_deg: 202, depth_m: 45.0, timestamp: "11:30 UTC" },
                { lat: -41.8820, lon: -73.2140, sog_kn: 7.5, cog_deg: 198, depth_m: 62.0, timestamp: "13:15 UTC" },
                { lat: -42.0410, lon: -73.2850, sog_kn: 8.2, cog_deg: 188, depth_m: 41.0, timestamp: "14:40 UTC" },
                { lat: -42.1850, lon: -73.2980, sog_kn: 6.6, cog_deg: 175, depth_m: 22.5, timestamp: "15:50 UTC" },
                { lat: -42.3125, lon: -73.2680, sog_kn: 2.1, cog_deg: 165, depth_m: 6.4, timestamp: "16:45 UTC" },
              ],
            },
            {
              id: "track-mechuque-dalcahue-02",
              voyage_id: DEMO_IDS.VOYAGE_ID,
              title: "Pierna 2: Caleta Mechuque → Canal Dalcahue",
              skipper_name: "Skipper Rodrigo Soto",
              started_at: "2026-11-15T09:15:00Z",
              ended_at: "2026-11-15T13:10:00Z",
              distance_nm: 19.8,
              max_sog_kn: 7.4,
              avg_sog_kn: 5.9,
              points: [
                { lat: -42.3125, lon: -73.2680, sog_kn: 4.5, cog_deg: 255, depth_m: 7.2, timestamp: "09:15 UTC" },
                { lat: -42.3340, lon: -73.3820, sog_kn: 6.4, cog_deg: 260, depth_m: 28.0, timestamp: "10:30 UTC" },
                { lat: -42.3590, lon: -73.5110, sog_kn: 7.4, cog_deg: 252, depth_m: 19.5, timestamp: "11:45 UTC" },
                { lat: -42.3810, lon: -73.6510, sog_kn: 3.1, cog_deg: 248, depth_m: 5.8, timestamp: "13:10 UTC" },
              ],
            },
          ]);
        }
      }
    );
  })();

  return seedPromise;
}

/**
 * Helper to enqueue an offline mutation into Dexie `sync_queue` so every local operation
 * complies strictly with the Local-First architecture rule.
 */
export async function enqueueOfflineMutation(params: {
  table_name: string;
  operation: "INSERT" | "UPDATE" | "UPSERT";
  record_id: string;
  payload: Record<string, unknown>;
}): Promise<SyncQueueRecord> {
  const item: SyncQueueRecord = {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    table_name: params.table_name,
    operation: params.operation,
    record_id: params.record_id,
    payload: params.payload,
    status: "pending",
    created_offline_at: new Date().toISOString(),
  };
  await db.sync_queue.put(item);
  return item;
}

const API_URL = getApiBaseUrl();

/**
 * Flushes pending `sync_queue` items to FastAPI `/api/v1/sync/batch` when online.
 */
export async function flushSyncQueue(apiBaseUrl = API_URL): Promise<number> {
  const pending = await db.sync_queue.where("status").equals("pending").toArray();
  if (pending.length === 0) return 0;

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/sync/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_id: DEMO_IDS.VESSEL_ID,
        items: pending,
      }),
    });
    if (!response.ok) return 0;

    const syncedAt = new Date().toISOString();
    await db.transaction("rw", [db.sync_queue, db.handover_inspections], async () => {
      for (const item of pending) {
        await db.sync_queue.update(item.id, { status: "synced", synced_at: syncedAt });
        if (item.table_name === "handover_inspections") {
          await db.handover_inspections.update(item.record_id, { synced_at: syncedAt });
        }
      }
    });
    return pending.length;
  } catch {
    return 0;
  }
}
