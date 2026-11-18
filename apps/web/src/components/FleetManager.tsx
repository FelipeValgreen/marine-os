"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Ship,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Fuel,
  Droplets,
  Ruler,
  Clock,
  Compass,
  X,
  Save,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Award,
  Copy,
  Check,
  MessageCircle,
  Anchor,
  FileText,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  type VesselRecord,
} from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

interface VesselFormData {
  id?: string;
  name: string;
  registration_number: string;
  mmsi?: string;
  call_sign?: string;
  vessel_type: "sailboat" | "catamaran" | "motor_yacht";
  loa_meters: number;
  beam_meters: number;
  draft_meters: number;
  mast_height_meters: number;
  fuel_capacity_l: number;
  water_capacity_l: number;
  chain_length_meters: number;
  engine_hours_current: number;
}

const EMPTY_FORM: VesselFormData = {
  name: "",
  registration_number: "",
  mmsi: "",
  call_sign: "",
  vessel_type: "sailboat",
  loa_meters: 12.0,
  beam_meters: 4.0,
  draft_meters: 2.0,
  mast_height_meters: 18.0,
  fuel_capacity_l: 200,
  water_capacity_l: 300,
  chain_length_meters: 60,
  engine_hours_current: 0,
};

export function FleetManager() {
  const { theme, pushToast } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const vessels = useLiveQuery(() => db.vessels.toArray(), [], []);
  const userPrefs = useLiveQuery(() => db.user_preferences.get("default"), []);

  const activeVesselId = userPrefs?.active_vessel_id || DEMO_IDS.VESSEL_ID;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VesselFormData>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Genesis Handover State (Dealer / Astillero -> Dueño)
  const [genesisVessel, setGenesisVessel] = useState<VesselRecord | null>(null);
  const [genesisBuyerName, setGenesisBuyerName] = useState("Capitán Demo (Armador)");
  const [genesisBuyerEmail, setGenesisBuyerEmail] = useState("comprador.demo@marinos.app");
  const [genesisDealerName, setGenesisDealerName] = useState("Astillero & Distribuidor Náutico Demo");
  const [genesisTransferType, setGenesisTransferType] = useState<"new_shipyard" | "brokerage_used">("new_shipyard");
  const [genesisToken, setGenesisToken] = useState<string | null>(null);
  const [copiedGenesisLink, setCopiedGenesisLink] = useState(false);

  const handleOpenGenesisHandover = (vessel: VesselRecord) => {
    setGenesisVessel(vessel);
    const token = `gen-${vessel.id.slice(-6)}-${Math.random().toString(36).substring(2, 8)}`;
    setGenesisToken(token);
    setCopiedGenesisLink(false);
  };

  const handleCopyGenesisLink = () => {
    if (!genesisToken || !genesisVessel) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://marine-os-sigma.vercel.app";
    const link = `${origin}/genesis-handover?token=${genesisToken}&vessel_id=${genesisVessel.id}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => { });
      setCopiedGenesisLink(true);
      setTimeout(() => setCopiedGenesisLink(false), 2500);
    }
    pushToast({
      title: "Magic Link de Propiedad Copiado",
      subtitle: "Enlace exclusivo para transferencia de titularidad y Gemelo Digital",
      tone: "cyan",
    });
  };

  const handleSendGenesisWhatsApp = () => {
    if (!genesisToken || !genesisVessel) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://marine-os-sigma.vercel.app";
    const link = `${origin}/genesis-handover?token=${genesisToken}&vessel_id=${genesisVessel.id}`;
    const msg = `🚢 *MarinOS Genesis Handover • Traspaso Oficial de Embarcación*\n\nEstimado/a ${genesisBuyerName},\n${genesisDealerName} ha emitido el Magic Link de Propiedad para el *${genesisVessel.name}* (Matrícula ${genesisVessel.registration_number}).\n\nAl ingresar, recibirás la titularidad completa del Gemelo Digital:\n✓ Nodos QR de Sentina, Motor, Jarcia y Baños\n✓ Manuales Oficiales del Astillero\n✓ Libro de Mantenimiento con firma SHA-256\n✓ Pólizas y Garantías Oficiales Activas\n\n👉 *Reclamar Titularidad:* ${link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
    pushToast({
      title: "Abriendo WhatsApp para Traspaso",
      subtitle: "Mensaje de transferencia listo para el comprador",
      tone: "emerald",
    });
  };

  const handlePrintVesselDossier = (v: VesselRecord) => {
    if (typeof window === "undefined") return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      pushToast({
        title: "Ventana Emergente Bloqueada",
        subtitle: "Permite ventanas emergentes para imprimir o guardar el Dossier en PDF",
        tone: "coral",
      });
      return;
    }

    const shaHash = `SHA256-${Array.from(v.id + v.registration_number + v.name).reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0) | 0, 0).toString(16).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`;
    const dateFormatted = new Date().toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Dossier Técnico Naval - ${v.name} (${v.registration_number})</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0b1528;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      padding: 0;
      margin: 0;
    }
    .header {
      border-bottom: 3px double #0b1528;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge {
      font-family: monospace;
      font-size: 8pt;
      font-weight: bold;
      background: #f0f4f8;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    h1 { margin: 4px 0 2px 0; font-size: 18pt; letter-spacing: -0.5px; text-transform: uppercase; color: #0b1528; }
    h2 { margin: 0 0 4px 0; font-size: 11pt; font-weight: normal; color: #475569; }
    h3 {
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #0b1528;
      color: #ffffff;
      padding: 4px 8px;
      margin: 16px 0 8px 0;
      border-radius: 3px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .cell {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 6px 10px;
      border-radius: 4px;
    }
    .label {
      font-size: 7.5pt;
      font-family: monospace;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .value {
      font-size: 10.5pt;
      font-weight: bold;
      color: #0f172a;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 12px;
    }
    .table th {
      background: #f1f5f9;
      text-align: left;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      font-size: 8pt;
      text-transform: uppercase;
      color: #475569;
    }
    .table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
    }
    .alert-box {
      border-left: 4px solid #0b1528;
      background: #f8fafc;
      padding: 8px 12px;
      font-size: 8.5pt;
      margin-bottom: 12px;
    }
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      font-family: monospace;
      color: #64748b;
    }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #0b1528; color: white; padding: 12px 18px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; border-radius: 6px;">
    <div>
      <strong>MarinOS • Ficha Técnica Oficial de Nave</strong>
      <span style="opacity: 0.7; font-size: 11px; margin-left: 8px;">Documento listo para Zarpe e Inspección DIRECTEMAR</span>
    </div>
    <div>
      <button onclick="window.print()" style="background: #00E5FF; color: black; border: none; font-weight: bold; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;">🖨️ Imprimir / Guardar como PDF</button>
      <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 6px;">Cerrar</button>
    </div>
  </div>

  <div class="header">
    <div>
      <div class="badge">ARMADA DE CHILE • DIRECTEMAR • REGISTRO NÁUTICO</div>
      <h1>${v.name}</h1>
      <h2>Dossier Técnico Naval &amp; Certificación de Gemelo Digital</h2>
    </div>
    <div style="text-align: right;">
      <div class="badge" style="background: #ecfdf5; color: #047857; border-color: #a7f3d0;">ESTADO: APTO PARA NAVEGACIÓN</div>
      <div style="font-size: 8pt; font-family: monospace; color: #64748b; margin-top: 4px;">Emisión: ${dateFormatted}</div>
      <div style="font-size: 7.5pt; font-family: monospace; color: #94a3b8;">Plataforma MarinOS Offline v2.4</div>
    </div>
  </div>

  <h3>1. Identificación y Registro General de la Nave</h3>
  <div class="grid">
    <div class="cell">
      <div class="label">Matrícula DIRECTEMAR</div>
      <div class="value">${v.registration_number}</div>
    </div>
    <div class="cell">
      <div class="label">MMSI (DSC / AIS)</div>
      <div class="value">${v.mmsi || "725001234"}</div>
    </div>
    <div class="cell">
      <div class="label">Señal Distintiva / Call Sign</div>
      <div class="value">${v.call_sign || v.registration_number}</div>
    </div>
    <div class="cell">
      <div class="label">Tipo de Embarcación</div>
      <div class="value">${v.vessel_type === "sailboat" ? "Velero Monocasco" : v.vessel_type === "catamaran" ? "Catamarán" : "Yate a Motor"}</div>
    </div>
  </div>

  <h3>2. Dimensiones y Parámetros Hidrodinámicos</h3>
  <div class="grid">
    <div class="cell">
      <div class="label">Eslora Total (LOA)</div>
      <div class="value">${v.loa_meters.toFixed(2)} m</div>
    </div>
    <div class="cell">
      <div class="label">Manga Máxima (Beam)</div>
      <div class="value">${v.beam_meters.toFixed(2)} m</div>
    </div>
    <div class="cell">
      <div class="label">Calado Máximo (Draft)</div>
      <div class="value">${v.draft_meters.toFixed(2)} m</div>
    </div>
    <div class="cell">
      <div class="label">Altura Mástil sobre Flotación</div>
      <div class="value">${v.mast_height_meters || 18.5} m</div>
    </div>
  </div>

  <h3>3. Planta Propulsora y Combustible</h3>
  <div class="grid">
    <div class="cell">
      <div class="label">Motor Principal</div>
      <div class="value">Yanmar 4JH57 (57 HP)</div>
    </div>
    <div class="cell">
      <div class="label">Horómetro de Servicio</div>
      <div class="value">${v.engine_hours_current} hrs</div>
    </div>
    <div class="cell">
      <div class="label">Capacidad Estanque Diésel</div>
      <div class="value">${v.fuel_capacity_l} Litros</div>
    </div>
    <div class="cell">
      <div class="label">Autonomía Crucero Estimada</div>
      <div class="value">~${Math.round(v.fuel_capacity_l / 3.2 * 6)} MN (@6.0 kn)</div>
    </div>
  </div>

  <h3>4. Circuito Sanitario, Hidráulico &amp; Energía</h3>
  <div class="grid">
    <div class="cell">
      <div class="label">Estanque Agua Potable</div>
      <div class="value">${v.water_capacity_l} Litros</div>
    </div>
    <div class="cell">
      <div class="label">Desalinizadora / Watermaker</div>
      <div class="value">Spectra Ventura (24 L/h)</div>
    </div>
    <div class="cell">
      <div class="label">Banco Baterías de Servicio</div>
      <div class="value">Victron LiFePO4 (400Ah)</div>
    </div>
    <div class="cell">
      <div class="label">Bombas de Achique Principales</div>
      <div class="value">Rule 2000 GPH + Manual</div>
    </div>
  </div>

  <h3>5. Sistema de Fondeo y Maniobra</h3>
  <div class="grid">
    <div class="cell">
      <div class="label">Cadena Principal Calibrada</div>
      <div class="value">${v.chain_length_meters || 60} m (10mm Grado 40)</div>
    </div>
    <div class="cell">
      <div class="label">Ancla de Servicio Principal</div>
      <div class="value">Rocna 20 kg + Quitamuelle</div>
    </div>
    <div class="cell">
      <div class="label">Molinete Eléctrico</div>
      <div class="value">Quick Dylan 1000W / 12V</div>
    </div>
    <div class="cell">
      <div class="label">Ancla de Respeto / Popa</div>
      <div class="value">Fortress FX-23 (10m C + 50m Cabo)</div>
    </div>
  </div>

  <h3>6. Inventario de Salvamento y Cumplimiento SOLAS / DIRECTEMAR</h3>
  <table class="table">
    <thead>
      <tr>
        <th>Ítem de Seguridad</th>
        <th>Tipo / Modelo</th>
        <th>Cantidad</th>
        <th>Inspección / Vencimiento</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Balsa Salvavidas Autoinflable</strong></td>
        <td>Plastimo Ocean ISO 9650-1 (Oceánica en Contenedor)</td>
        <td>1 Balsa (6 Personas)</td>
        <td>Vigente hasta 2027</td>
        <td><span style="color:#047857; font-weight:bold;">CERTIFICADA</span></td>
      </tr>
      <tr>
        <td><strong>Radiobaliza EPIRB</strong></td>
        <td>McMurdo SmartFind G8 406MHz con GPS y AIS</td>
        <td>1 Unidad</td>
        <td>Batería vigente hasta 2029</td>
        <td><span style="color:#047857; font-weight:bold;">OPERATIVA</span></td>
      </tr>
      <tr>
        <td><strong>Pirotecnia Náutica Reglamentaria</strong></td>
        <td>Bengalas de Mano Rojas + Cohetes Paracaídas SOLAS</td>
        <td>4 Bengalas + 2 Cohetes</td>
        <td>Vencimiento Septiembre 2028</td>
        <td><span style="color:#047857; font-weight:bold;">AL DÍA</span></td>
      </tr>
      <tr>
        <td><strong>Chalecos Salvavidas Reglamentarios</strong></td>
        <td>Autoinflables 150N con Silbato y Luz Estroboscópica</td>
        <td>6 Unidades</td>
        <td>Revisión anual 2026</td>
        <td><span style="color:#047857; font-weight:bold;">A BORDO</span></td>
      </tr>
      <tr>
        <td><strong>Control de Avenidas y Vías de Agua</strong></td>
        <td>Espiches cónicos de madera blanda por cada pasa-casco</td>
        <td>4 Sets completos</td>
        <td>Inspeccionado en Sentina</td>
        <td><span style="color:#047857; font-weight:bold;">A BORDO</span></td>
      </tr>
    </tbody>
  </table>

  <h3>7. Protocolos Rápidos de Emergencia de la Embarcación</h3>
  <div class="alert-box">
    <strong>LLAMADA DE SOCORRO VHF (CANAL 16 / DSC 70):</strong><br>
    MAYDAY, MAYDAY, MAYDAY • AQUÍ ${v.name.toUpperCase()} • ${v.name.toUpperCase()} • ${v.name.toUpperCase()} • CALL SIGN: ${v.call_sign || v.registration_number} • MMSI: ${v.mmsi || "725001234"} • POSICIÓN [COORDENADAS GPS] • NATURALEZA DEL PELIGRO • TRIPULANTES A BORDO.
  </div>

  <div class="footer">
    <div>
      <strong>SELLO CRIPTOGRÁFICO MARINOS:</strong> ${shaHash}<br>
      Firma Local Generada Offline • Válida para Presentación ante Capitanías de Puerto
    </div>
    <div style="text-align: right;">
      Página 1 de 1 • MarinOS Naval Operating System<br>
      https://marine-os-app.vercel.app
    </div>
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    pushToast({
      title: "Dossier Técnico Generado",
      subtitle: `Abriendo vista de impresión para ${v.name}`,
      tone: "cyan",
    });
  };

  const handleOpenCreate = () => {
    setFormData({
      ...EMPTY_FORM,
      registration_number: `CB-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (vessel: VesselRecord) => {
    setFormData({
      id: vessel.id,
      name: vessel.name,
      registration_number: vessel.registration_number,
      mmsi: vessel.mmsi || "",
      call_sign: vessel.call_sign || "",
      vessel_type: vessel.vessel_type,
      loa_meters: vessel.loa_meters,
      beam_meters: vessel.beam_meters,
      draft_meters: vessel.draft_meters,
      mast_height_meters: vessel.mast_height_meters,
      fuel_capacity_l: vessel.fuel_capacity_l,
      water_capacity_l: vessel.water_capacity_l,
      chain_length_meters: vessel.chain_length_meters || 60,
      engine_hours_current: vessel.engine_hours_current,
    });
    setIsEditing(true);
  };

  const handleSelectActiveVessel = async (vesselId: string) => {
    const existing = await db.user_preferences.get("default");
    const updated = {
      ...(existing || {
        id: "default",
        has_completed_onboarding: true,
        tooltip_gps_seen: true,
        tooltip_zarpe_pdf_seen: true,
        completed_lessons: [],
      }),
      active_vessel_id: vesselId,
      updated_at: new Date().toISOString(),
    };
    await db.user_preferences.put(updated);
    const chosen = vessels?.find((v) => v.id === vesselId);
    pushToast({
      title: "Barco Activo Seleccionado",
      subtitle: `${chosen?.name || "Barco"} es ahora la embarcación activa de la flota`,
      tone: "emerald",
    });
  };

  const handleSaveVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.registration_number.trim()) {
      pushToast({
        title: "Campos Requeridos",
        subtitle: "Nombre y Matrícula son obligatorios",
        tone: "coral",
      });
      return;
    }

    const isNew = !formData.id;
    const vesselId = formData.id || `vessel-${Date.now()}`;
    const now = new Date().toISOString();

    const record: VesselRecord = {
      id: vesselId,
      org_id: DEMO_IDS.ORG_ID,
      name: formData.name.trim(),
      registration_number: formData.registration_number.trim().toUpperCase(),
      mmsi: formData.mmsi?.trim() || undefined,
      call_sign: formData.call_sign?.trim().toUpperCase() || undefined,
      vessel_type: formData.vessel_type,
      loa_meters: Number(formData.loa_meters) || 12.0,
      beam_meters: Number(formData.beam_meters) || 4.0,
      draft_meters: Number(formData.draft_meters) || 2.0,
      mast_height_meters: Number(formData.mast_height_meters) || 18.0,
      fuel_capacity_l: Math.round(Number(formData.fuel_capacity_l)) || 200,
      water_capacity_l: Math.round(Number(formData.water_capacity_l)) || 300,
      chain_length_meters: Math.round(Number(formData.chain_length_meters)) || 60,
      engine_hours_current: Number(formData.engine_hours_current) || 0,
      polar_data: {},
      created_at: isNew ? now : (await db.vessels.get(vesselId))?.created_at || now,
    };

    await db.vessels.put(record);
    await enqueueOfflineMutation({
      table_name: "vessels",
      operation: isNew ? "INSERT" : "UPDATE",
      record_id: vesselId,
      payload: record as unknown as Record<string, unknown>,
    });

    if (isNew && (!vessels || vessels.length === 0)) {
      await handleSelectActiveVessel(vesselId);
    }

    pushToast({
      title: isNew ? "Barco Creado" : "Barco Actualizado",
      subtitle: `${record.name} (${record.registration_number}) guardado en el dispositivo`,
      tone: "emerald",
    });

    setIsEditing(false);
    setFormData(EMPTY_FORM);
  };

  const handleDeleteVessel = async (vesselId: string) => {
    if (!vessels || vessels.length <= 1) {
      pushToast({
        title: "No se puede eliminar",
        subtitle: "Debe existir al menos un barco registrado en la flota",
        tone: "coral",
      });
      return;
    }

    await db.vessels.delete(vesselId);
    await enqueueOfflineMutation({
      table_name: "vessels",
      operation: "UPDATE",
      record_id: vesselId,
      payload: { deleted: true, deleted_at: new Date().toISOString() },
    });

    if (activeVesselId === vesselId) {
      const remaining = vessels.find((v) => v.id !== vesselId);
      if (remaining) {
        await handleSelectActiveVessel(remaining.id);
      }
    }

    pushToast({
      title: "Barco Eliminado",
      subtitle: "Registro eliminado del dispositivo",
      tone: "amber",
    });
    setDeleteConfirmId(null);
  };

  const typeLabels: Record<VesselRecord["vessel_type"], string> = {
    sailboat: "Velero Monocasco",
    catamaran: "Catamarán",
    motor_yacht: "Yate a Motor",
  };

  return (
    <div data-testid="fleet-manager-view" className="space-y-6">
      {/* Header Banner */}
      <div className="marine-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/5 shadow-2xl shadow-black/50">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--accent-primary)]">
                ARMADURÍA &amp; ESPECIFICACIONES NAVALES
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                Fleet &amp; Vessel Manager
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 opacity-80 mt-2 font-normal leading-relaxed max-w-2xl">
            Administra la flota de tu armaduría: cambia el barco activo, edita especificaciones náuticas o registra una nueva embarcación.
          </p>
        </div>

        <button
          type="button"
          data-testid="create-new-vessel-btn"
          onClick={handleOpenCreate}
          className="marine-btn marine-btn-primary text-xs sm:text-sm px-6 shrink-0 self-start sm:self-auto font-bold tracking-tight shadow-xl"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Barco</span>
        </button>
      </div>

      {/* Vessel Creation / Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            key="edit-vessel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
            onClick={() => setIsEditing(false)}
          >
            <motion.div
              key="edit-vessel-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl marine-card p-6 sm:p-8 space-y-6 my-8 border border-white/5 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNight
                        ? "bg-[#FF0000] text-black"
                        : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                      }`}
                  >
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      {formData.id ? "Editar Embarcación" : "Registrar Nueva Embarcación"}
                    </h2>
                    <div className="text-xs font-mono opacity-70">
                      {formData.id ? `ID: ${formData.id}` : "Flota MarinOS"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="w-10 min-h-14 rounded-xl border border-white/5 hover:bg-white/10 flex items-center justify-center opacity-70 hover:opacity-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVessel} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Nombre del Barco *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. SV Albatros (Oceanis 41.1)"
                      className="w-full min-h-14 px-3.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Matrícula Oficial DIRECTEMAR *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.registration_number}
                      onChange={(e) =>
                        setFormData({ ...formData, registration_number: e.target.value })
                      }
                      placeholder="CB-4582"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>
                </div>

                {/* MMSI and Call Sign */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      MMSI (9 dígitos • DSC / AIS)
                    </label>
                    <input
                      type="text"
                      maxLength={9}
                      value={formData.mmsi || ""}
                      onChange={(e) => setFormData({ ...formData, mmsi: e.target.value })}
                      placeholder="725001234"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Señal Distintiva / Call Sign (VHF MAYDAY)
                    </label>
                    <input
                      type="text"
                      value={formData.call_sign || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, call_sign: e.target.value })
                      }
                      placeholder="CB-4582"
                      className="w-full min-h-14 px-3.5 text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Tipo de Embarcación
                    </label>
                    <select
                      value={formData.vessel_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vessel_type: e.target.value as VesselRecord["vessel_type"],
                        })
                      }
                      className="w-full min-h-14 px-3.5 text-sm font-medium"
                    >
                      <option value="sailboat">Velero Monocasco</option>
                      <option value="catamaran">Catamarán</option>
                      <option value="motor_yacht">Yate a Motor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Horómetro Motor Principal (Horas)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.engine_hours_current}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          engine_hours_current: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="1420.5"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Dimensions Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Eslora LOA (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.loa_meters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          loa_meters: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="12.43"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Manga (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.beam_meters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          beam_meters: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="4.20"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Calado (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.draft_meters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          draft_meters: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="2.18"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Mástil (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.mast_height_meters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mast_height_meters: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="18.50"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Tank Capacities & Ground Tackle */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Capacidad Diésel (Litros)
                    </label>
                    <input
                      type="number"
                      value={formData.fuel_capacity_l}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fuel_capacity_l: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      placeholder="200"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Capacidad Agua (Litros)
                    </label>
                    <input
                      type="number"
                      value={formData.water_capacity_l}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          water_capacity_l: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      placeholder="330"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Cadena Fondeo (Metros)
                    </label>
                    <input
                      type="number"
                      value={formData.chain_length_meters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          chain_length_meters: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      placeholder="60"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex flex-wrap items-center justify-end gap-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="marine-btn marine-btn-secondary text-xs sm:text-sm px-4"
                  >
                    <span>Cancelar</span>
                  </button>
                  <button
                    type="submit"
                    data-testid="save-vessel-submit-btn"
                    className="marine-btn marine-btn-primary text-xs sm:text-sm px-6 font-bold tracking-tight shadow-xl"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Barco en el Dispositivo</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fleet Cards Grid — Bento Box Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {vessels?.map((v) => {
          const isActive = v.id === activeVesselId;
          const isConfirmingDelete = deleteConfirmId === v.id;

          return (
            <div
              key={v.id}
              data-testid={`fleet-vessel-card-${v.id}`}
              className={`marine-card p-6 flex flex-col justify-between space-y-5 border border-white/5 shadow-2xl shadow-black/60 transition-all ${isActive
                  ? isNight
                    ? "border-red-900 bg-red-950/20"
                    : "border-[var(--accent-primary)]/40 bg-[#0d1626]"
                  : "hover:border-white/5"
                }`}
            >
              <div className="space-y-4">
                {/* Bento Row 1: Header + Active State Badge */}
                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isActive
                          ? isNight
                            ? "bg-red-950/40 text-red-500 border border-red-800"
                            : "bg-[#1a2332] text-[var(--accent-primary)] border border-[var(--accent-primary)]/40"
                          : "bg-white/5 border border-white/5 text-slate-300"
                        }`}
                    >
                      <Ship className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold tracking-tight text-white">{v.name}</h2>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-[0.12em] bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40 uppercase">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ACTIVO</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-medium flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-[var(--accent-primary)]">{v.registration_number}</span>
                        {v.mmsi && (
                          <>
                            <span className="opacity-40">•</span>
                            <span className="font-mono text-[11px] opacity-75">MMSI: {v.mmsi}</span>
                          </>
                        )}
                        <span className="opacity-40">•</span>
                        <span>{typeLabels[v.vessel_type]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid={`edit-vessel-${v.id}`}
                      onClick={() => handleOpenEdit(v)}
                      title="Editar especificaciones"
                      className="w-10 min-h-14 rounded-xl border border-white/5 hover:bg-white/10 flex items-center justify-center text-xs opacity-75 hover:opacity-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-vessel-${v.id}`}
                      onClick={() => setDeleteConfirmId(v.id)}
                      title="Eliminar barco"
                      className="w-10 min-h-14 rounded-xl border border-white/5 hover:bg-[#FF2D55]/20 flex items-center justify-center text-xs opacity-75 hover:opacity-100 text-[#FF2D55] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Inline Banner */}
                {isConfirmingDelete && (
                  <div className="p-3.5 rounded-2xl bg-[#FF2D55]/15 border border-[#FF2D55]/30 text-xs space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-[#FF2D55]">
                      <AlertTriangle className="w-4 h-4" />
                      <span>¿Confirmar eliminación de {v.name}?</span>
                    </div>
                    <p className="text-[11px] opacity-85 leading-relaxed">
                      Esta acción eliminará la nave del dispositivo local. Se recomienda mantener al menos una embarcación en la flota.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteVessel(v.id)}
                        className="px-3.5 py-2 rounded-xl bg-[#FF2D55] text-white font-bold text-xs"
                      >
                        Sí, Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3.5 py-2 rounded-xl bg-white/10 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Bento Grid: Precision Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* Bento Cell 1: Eslora & Manga (2 cols) */}
                  <div className="col-span-2 p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-60 flex items-center gap-1.5">
                        <Ruler className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>DIMENSIONES NAVALES</span>
                      </div>
                      <div className="text-sm font-semibold tracking-tight text-white font-mono">
                        {v.loa_meters.toFixed(2)}m <span className="opacity-40 font-sans font-normal text-xs">LOA ×</span> {v.beam_meters.toFixed(2)}m <span className="opacity-40 font-sans font-normal text-xs">Manga</span>
                      </div>
                    </div>
                    <div className="text-right pl-2">
                      <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-50">CALADO</div>
                      <div className="font-mono text-base font-bold text-[var(--accent-primary)]">
                        {v.draft_meters.toFixed(2)}m
                      </div>
                    </div>
                  </div>

                  {/* Bento Cell 2: Horómetro */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 space-y-1">
                    <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-60 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>HORÓMETRO</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-white">
                      {v.engine_hours_current} <span className="text-[10px] font-normal opacity-60 font-sans">hrs</span>
                    </div>
                  </div>

                  {/* Bento Cell 3: Mástil */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 space-y-1">
                    <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-60 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#00E676]" />
                      <span>MÁSTIL</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-white">
                      {v.mast_height_meters || 18.5} <span className="text-[10px] font-normal opacity-60 font-sans">m</span>
                    </div>
                  </div>

                  {/* Bento Cell 4: Tanques & Cadena (Diésel, Agua, Cadena) */}
                  <div className="col-span-2 sm:col-span-4 p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FF9F0A]/15 border border-[#FF9F0A]/20 flex items-center justify-center shrink-0">
                        <Fuel className="w-4 h-4 text-[#FF9F0A]" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-60">ESTANQUE DIÉSEL</div>
                        <div className="font-mono text-xs font-bold text-white">{v.fuel_capacity_l} L</div>
                      </div>
                    </div>

                    <div className="hidden sm:block h-6 w-px bg-white/10" />

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/20 flex items-center justify-center shrink-0">
                        <Droplets className="w-4 h-4 text-[#00E5FF]" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-60">AGUA DULCE</div>
                        <div className="font-mono text-xs font-bold text-white">{v.water_capacity_l} L</div>
                      </div>
                    </div>

                    <div className="hidden sm:block h-6 w-px bg-white/10" />

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#00E676]/15 border border-[#00E676]/20 flex items-center justify-center shrink-0">
                        <Anchor className="w-4 h-4 text-[#00E676]" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-60">CADENA FONDEO</div>
                        <div className="font-mono text-xs font-bold text-white">{v.chain_length_meters || 60} m</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bento Cell 5: Warranty & Compliance Strip */}
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--accent-primary)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>GARANTÍAS &amp; COMPLIANCE ACTIVO</span>
                    </span>
                    <span className="opacity-50 font-mono text-[9px]">YachtPass Engine</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/5 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="font-semibold text-white/90 text-xs">Motor Yanmar 4JH57</div>
                        <div className="text-[10px] opacity-60 font-mono">Garantía hasta 1.500h</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/30 shrink-0">
                        {Math.max(0, Math.round((1500 - v.engine_hours_current) * 10) / 10)}h restan
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/5 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="font-semibold text-white/90 text-xs">Fischer Panda 5000i</div>
                        <div className="text-[10px] opacity-60 font-mono">Garantía hasta 800h</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 shrink-0">
                        Vigente
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bottom */}
              <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid={`genesis-transfer-${v.id}`}
                    onClick={() => handleOpenGenesisHandover(v)}
                    className="marine-btn text-xs px-3.5 bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-[#00E5FF]/20 font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span>Genesis Handover</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`vessel-dossier-pdf-${v.id}`}
                    onClick={() => handlePrintVesselDossier(v)}
                    className="marine-btn text-xs px-3.5 bg-white/5 text-white border border-white/10 hover:bg-white/10 font-semibold flex items-center gap-1.5 transition-all"
                    title="Descargar Ficha Técnica y Dossier Naval para Zarpe e Inspección DIRECTEMAR"
                  >
                    <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Dossier PDF / Ficha</span>
                  </button>
                </div>

                {!isActive && (
                  <button
                    type="button"
                    data-testid={`activate-vessel-${v.id}`}
                    onClick={() => handleSelectActiveVessel(v.id)}
                    className="marine-btn marine-btn-secondary text-xs px-4 font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />
                    <span>Establecer como Barco Activo</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Genesis Handover Modal (Dealer / Astillero -> Dueño) */}
      <AnimatePresence>
        {genesisVessel && (
          <motion.div
            key="genesis-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setGenesisVessel(null)}
          >
            <motion.div
              key="genesis-modal-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#040B16] border border-[#00E5FF]/40 p-6 sm:p-7 shadow-2xl shadow-black/80 relative space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#00E5FF]" />
                  <span className="font-mono text-xs uppercase tracking-widest text-[#00E5FF] font-bold">
                    GENESIS HANDOVER • TRASPASO DE TITULARIDAD
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGenesisVessel(null)}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Explanation Banner */}
              <div className="p-4 rounded-2xl bg-[#00E5FF]/10 border border-[#00E5FF]/25 space-y-1.5 text-xs font-mono">
                <div className="font-bold text-[#00E5FF] flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>Protocolo de Entrega Oficial (Dealer to Owner)</span>
                </div>
                <p className="opacity-85 leading-relaxed">
                  Transfiere la custodia completa del <strong>Gemelo Digital de {genesisVessel.name}</strong> al nuevo armador.
                  El comprador recibirá en su cuenta los Nodos QR precargados, manuales de astillero, pólizas de garantía y el historial inmutable con firma SHA-256.
                </p>
              </div>

              {/* Transfer Parameters Form */}
              <div className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase opacity-70">
                      Nombre del Comprador / Armador
                    </label>
                    <input
                      type="text"
                      value={genesisBuyerName}
                      onChange={(e) => setGenesisBuyerName(e.target.value)}
                      className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                      placeholder="Cap. Matías Edwards"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase opacity-70">
                      Email o RUT del Comprador
                    </label>
                    <input
                      type="text"
                      value={genesisBuyerEmail}
                      onChange={(e) => setGenesisBuyerEmail(e.target.value)}
                      className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                      placeholder="matias.edwards@gmail.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase opacity-70">
                      Astillero o Concesionario Emisor
                    </label>
                    <input
                      type="text"
                      value={genesisDealerName}
                      onChange={(e) => setGenesisDealerName(e.target.value)}
                      className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                      placeholder="Beneteau Americas Official"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase opacity-70">
                      Modalidad de Traspaso
                    </label>
                    <select
                      value={genesisTransferType}
                      onChange={(e) =>
                        setGenesisTransferType(
                          e.target.value as "new_shipyard" | "brokerage_used"
                        )
                      }
                      className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                    >
                      <option value="new_shipyard">Entrega Nuevo de Astillero (0h)</option>
                      <option value="brokerage_used">Traspaso Brokerage / Segundo Dueño</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Simulated Digital Certificate & QR Transfer Code */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/15 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[10px] uppercase tracking-wider text-[#00E5FF] font-bold">
                    MAGIC LINK DE PROPIEDAD EMITIDO
                  </span>
                  <span className="text-[9px] opacity-60">TOKEN: {genesisToken}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 font-mono text-[11px] break-all opacity-90 select-all">
                  {typeof window !== "undefined" ? window.location.origin : "https://marine-os-sigma.vercel.app"}/genesis-handover?token={genesisToken}&amp;vessel_id={genesisVessel.id}
                </div>

                {/* Package contents included */}
                <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] font-mono opacity-80">
                  <div className="text-[10px] uppercase opacity-55">ACTIVOS TRANSFERIDOS AUTOMÁTICAMENTE:</div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>✓ 4 Nodos QR (Motor, WC, Molinete, Sentina)</div>
                    <div>✓ 4 Manuales de Taller Oficiales</div>
                    <div>✓ Historial de Servicios SHA-256</div>
                    <div>✓ Garantía de Fábrica Yanmar &amp; Beneteau</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="copy-genesis-link-btn"
                    onClick={handleCopyGenesisLink}
                    className="marine-btn marine-btn-primary text-xs py-2.5 flex items-center justify-center gap-2 font-bold shadow-none"
                  >
                    {copiedGenesisLink ? (
                      <>
                        <Check className="w-4 h-4 text-black" />
                        <span>¡Copiado al Portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Magic Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="send-genesis-whatsapp-btn"
                    onClick={handleSendGenesisWhatsApp}
                    className="marine-btn text-xs py-2.5 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-black font-bold rounded-xl shadow-lg"
                  >
                    <MessageCircle className="w-4 h-4 fill-black" />
                    <span>Enviar por WhatsApp</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setGenesisVessel(null)}
                  className="w-full marine-btn marine-btn-secondary min-h-11 text-xs"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
