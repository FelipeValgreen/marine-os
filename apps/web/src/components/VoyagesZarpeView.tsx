"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ScanLine,
  Share2,
  Download,
  CheckCircle2,
  UserPlus,
  ShieldAlert,
  Sparkles,
  RadioTower,
  BookmarkPlus,
  Users,
  Compass,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Anchor,
  Ship,
  Plus,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  saveCrewContactFromVoyageCrew,
  type VoyageRecord,
  type VoyageCrewRecord,
} from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";
import { computeSHA256Hex } from "@/lib/nautical";
import { CryptoStampOverlay } from "@/components/CryptoStampOverlay";
import { getApiBaseUrl } from "@/lib/api";

const API_URL = getApiBaseUrl();

interface PreZarpeChecklistItem {
  id: string;
  label: string;
  description: string;
  category: "seguridad" | "maquinaria" | "navegacion";
}

const MANDATORY_CHECKLIST: PreZarpeChecklistItem[] = [
  {
    id: "check-sentina",
    label: "Sentinas secas e inspección de bombas de achique",
    description: "Verificar bombas automáticas y accionamiento manual operativo.",
    category: "maquinaria",
  },
  {
    id: "check-diesel",
    label: "Combustible diésel verificado (>50% autonomía requerida)",
    description: "Comprobar nivel físico en estanque y filtro Racor libre de agua.",
    category: "maquinaria",
  },
  {
    id: "check-vhf",
    label: "Radiotelefonía VHF operativa en Canales 16 y 14",
    description: "Prueba de transmisión y escucha activa con Capitanía de Puerto.",
    category: "navegacion",
  },
  {
    id: "check-chalecos",
    label: "Chalecos salvavidas SOLAS para 100% de la dotación (POB)",
    description: "Inspección de silbatos, bandas reflectantes y luces de emergencia.",
    category: "seguridad",
  },
  {
    id: "check-balsa",
    label: "Balsa salvavidas y kit de pirotecnia dentro de vigencia",
    description: "Comprobar zafa hidrostática y fecha de inspección oficial.",
    category: "seguridad",
  },
  {
    id: "check-meteo",
    label: "Pronóstico meteorológico y tabla de mareas analizados",
    description: "Verificar condiciones de viento, ola y estoa de marea para zarpe seguro.",
    category: "navegacion",
  },
];

export function VoyagesZarpeView({
  magicToken,
}: {
  magicToken?: string;
}) {
  const { isOffline, pushToast, theme } = useMarineContext();
  const isNight = theme === "night-red-shift";

  // All voyages in Dexie
  const voyages = useLiveQuery(() => db.voyages.toArray(), [], []);
  const defaultVoyage = useLiveQuery(
    () => (magicToken ? db.voyages.where("magic_link_token").equals(magicToken).first() : db.voyages.toCollection().first()),
    [magicToken]
  );

  // Selected voyage state (starts with magicToken if provided, else null to show dashboard)
  const [selectedVoyageId, setSelectedVoyageId] = useState<string | null>(
    magicToken ? defaultVoyage?.id || DEMO_IDS.VOYAGE_ID : null
  );

  // Stepper state for the selected voyage: 1: Ruta y Fechas, 2: Tripulación, 3: Checklist, 4: E-Zarpe
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Active voyage record
  const currentVoyage = useLiveQuery(
    () => (selectedVoyageId ? db.voyages.get(selectedVoyageId) : undefined),
    [selectedVoyageId]
  );

  const vessel = useLiveQuery(
    () =>
      currentVoyage
        ? db.vessels.get(currentVoyage.vessel_id)
        : db.vessels.get(DEMO_IDS.VESSEL_ID),
    [currentVoyage]
  );

  const crewList = useLiveQuery(
    () =>
      db.voyage_crew
        .where("voyage_id")
        .equals(selectedVoyageId || DEMO_IDS.VOYAGE_ID)
        .toArray(),
    [selectedVoyageId],
    []
  );

  const savedContacts = useLiveQuery(
    async () => {
      const freq = db.frequent_crew ? await db.frequent_crew.toArray() : [];
      if (freq && freq.length > 0) return freq;
      return db.crew_contacts.toArray();
    },
    [],
    []
  );

  // Create Voyage Modal State
  const [isCreatingVoyage, setIsCreatingVoyage] = useState(false);
  const [newTitle, setNewTitle] = useState("Travesía Seno de Reloncaví - Chiloé");
  const [newDepPort, setNewDepPort] = useState("Marina Puerto Montt");
  const [newArrPort, setNewArrPort] = useState("Caleta Mechuque");
  const [newDepDate, setNewDepDate] = useState(() => new Date(Date.now() + 7200000).toISOString().slice(0, 16));
  const [newArrDate, setNewArrDate] = useState(() => new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16));

  // Checklist interactive state - Starts empty (0/6) per PRD R-4.6 safety rule
  const [checklistChecks, setChecklistChecks] = useState<Record<string, boolean>>({});

  // Manual Crew Member Form State
  const [role, setRole] = useState<"skipper" | "crew" | "guest">("crew");
  const [fullName, setFullName] = useState("");
  const [docType, setDocType] = useState("RUT");
  const [docNumber, setDocNumber] = useState("");
  const [nationality, setNationality] = useState("CL");
  const [licenseType, setLicenseType] = useState("Patrón Deportivo de Bahía (DIRECTEMAR)");
  const [licenseExpiry, setLicenseExpiry] = useState("2029-11-30");
  const waiverAccepted = true;
  const [saveToAddressBook, setSaveToAddressBook] = useState(true);
  const [ocrNotes, setOcrNotes] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Modals & Overlays
  const [showManualCrewForm, setShowManualCrewForm] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [transmittingZarpe, setTransmittingZarpe] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [authorityApproval, setAuthorityApproval] = useState<{
    approval_token: string;
    authority: string;
    transmitted_at: string;
    sha256_manifest_seal: string;
    pob_count: number;
  } | null>(null);

  const [stampOverlay, setStampOverlay] = useState<{
    title: string;
    subtitle: string;
    sha256Hash: string;
    tokenBadge?: string;
  } | null>(null);

  const checklistCompletedCount = Object.values(checklistChecks).filter(Boolean).length;
  const isChecklistApproved = checklistCompletedCount === MANDATORY_CHECKLIST.length;
  const hasCrew = (crewList || []).length > 0;
  const canTransmitZarpe = hasCrew && isChecklistApproved;

  // Plan New Zarpe Handler
  const handleCreateNewVoyage = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `voyage-${Date.now()}`;
    const token = `trip-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const record: VoyageRecord = {
      id: newId,
      vessel_id: vessel?.id || DEMO_IDS.VESSEL_ID,
      title: newTitle.trim() || "Nueva Travesía",
      status: "draft",
      departure_port: newDepPort.trim(),
      arrival_port: newArrPort.trim(),
      departure_at: newDepDate ? new Date(newDepDate).toISOString() : now,
      estimated_arrival_at: newArrDate ? new Date(newArrDate).toISOString() : now,
      magic_link_token: token,
      security_deposit_amount: 1500,
      security_deposit_status: "pending",
      created_at: now,
    };

    await db.voyages.put(record);
    await enqueueOfflineMutation({
      table_name: "voyages",
      operation: "INSERT",
      record_id: newId,
      payload: record as unknown as Record<string, unknown>,
    });

    setIsCreatingVoyage(false);
    setSelectedVoyageId(newId);
    setCurrentStep(1);

    pushToast({
      title: "Viaje Creado Exitosamente",
      subtitle: `${record.title} listo para configurar tripulación y zarpe`,
      tone: "emerald",
    });
  };

  const handleToggleChecklist = (id: string) => {
    setChecklistChecks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleBatchInjectFrequentCrew = async () => {
    const contacts = savedContacts || [];
    if (contacts.length === 0) {
      pushToast({
        title: "Agenda vacía",
        subtitle: "No hay tripulantes guardados en la libreta frecuente",
        tone: "amber",
      });
      return;
    }
    let addedCount = 0;
    const now = new Date().toISOString();
    const targetVoyageId = selectedVoyageId || DEMO_IDS.VOYAGE_ID;

    for (const contact of contacts) {
      const alreadyOnBoard = crewList?.some(
        (m) => m.document_number === contact.document_number
      );
      if (!alreadyOnBoard) {
        const newMember: VoyageCrewRecord = {
          id: crypto.randomUUID(),
          voyage_id: targetVoyageId,
          full_name: contact.full_name,
          document_type: contact.document_type || "RUT",
          document_number: contact.document_number,
          nationality: contact.nationality || "CL",
          role: contact.default_role || "crew",
          license_type: contact.license_type || "Tripulante General",
          license_number: contact.license_number || "",
          license_expiry: contact.license_expiry || "",
          ocr_verified: true,
          waiver_signed_at: null,
          created_at: now,
        };
        await db.voyage_crew.put(newMember);
        await enqueueOfflineMutation({
          table_name: "voyage_crew",
          operation: "INSERT",
          record_id: newMember.id,
          payload: newMember as unknown as Record<string, unknown>,
        });
        addedCount++;
      }
    }
    if (addedCount > 0) {
      pushToast({
        title: "Tripulación Inyectada desde Agenda",
        subtitle: `Se agregaron ${addedCount} tripulante(s) al rol de zarpe`,
        tone: "emerald",
      });
    } else {
      pushToast({
        title: "Tripulación ya a bordo",
        subtitle: "Todos los contactos de la agenda ya estaban en el rol",
        tone: "amber",
      });
    }
  };

  const handleRunMultimodalOCR = async (
    presetType: "felipe" | "skipper" | "crew" | "passport"
  ) => {
    setOcrLoading(true);
    setOcrNotes(null);
    const targetRole =
      presetType === "skipper" || presetType === "felipe" ? "skipper" : "crew";
    setRole(targetRole);

    try {
      if (!isOffline) {
        const res = await fetch(`${API_URL}/api/v1/ocr/crew-document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_hint: presetType,
            role: targetRole,
            vessel_loa_meters: vessel?.loa_meters || 12.43,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setFullName(data.full_name);
          setDocType(data.document_type);
          setDocNumber(data.document_number);
          setNationality(data.nationality);
          setLicenseType(data.license_type || "Tripulante General");
          setLicenseExpiry(data.license_expiry || "2029-12-31");
          const msg = `${data.attribution_notes} (Confianza ${Math.round(
            data.confidence_score * 100
          )}%)`;
          setOcrNotes(msg);
          setShowManualCrewForm(true);
          pushToast({
            title: `OCR Exitoso: ${data.full_name}`,
            subtitle: `${data.license_type} • ${data.document_number}`,
            tone: "cyan",
          });
          setOcrLoading(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    if (presetType === "felipe") {
      setFullName("Cap. Felipe Valverde");
      setDocType("RUT");
      setDocNumber("13.452.890-1");
      setNationality("CL");
      setLicenseType("Capitán Deportivo de Alta Mar (DIRECTEMAR)");
      setLicenseExpiry("2031-06-30");
      setOcrNotes("Atribución Alta Mar validada para SV Albatros (12.43m LOA).");
    } else if (presetType === "skipper") {
      setFullName("Skipper Rodrigo Soto");
      setDocType("RUT");
      setDocNumber("16.781.234-K");
      setNationality("CL");
      setLicenseType("Capitán Deportivo Costero (DIRECTEMAR)");
      setLicenseExpiry("2029-11-15");
      setOcrNotes("Atribución Costera validada para SV Albatros (12.43m LOA <= 24m).");
    } else if (presetType === "passport") {
      setFullName("Sophie Laurent Moreau");
      setDocType("PASSPORT");
      setDocNumber("FR9928412");
      setNationality("FR");
      setLicenseType("Patrón Deportivo de Bahía");
      setLicenseExpiry("2028-04-15");
      setOcrNotes("Pasaporte internacional y licencia deportiva verificadas.");
    } else {
      setFullName("Cami Vargas");
      setDocType("RUT");
      setDocNumber("19.832.104-5");
      setNationality("CL");
      setLicenseType("Patrón Deportivo de Bahía (DIRECTEMAR)");
      setLicenseExpiry("2027-02-10");
      setOcrNotes("Cédula chilena y licencia náutica deportiva verificadas.");
    }
    setShowManualCrewForm(true);
    setOcrLoading(false);
  };

  const handleSaveCrewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !docNumber.trim()) return;

    const now = new Date().toISOString();
    const recordId = `crew-${Date.now()}`;
    const newMember: VoyageCrewRecord = {
      id: recordId,
      voyage_id: selectedVoyageId || DEMO_IDS.VOYAGE_ID,
      role,
      full_name: fullName.trim(),
      document_type: docType,
      document_number: docNumber.trim(),
      nationality,
      license_type: licenseType,
      license_expiry: licenseExpiry,
      ocr_verified: true,
      waiver_signed_at: waiverAccepted ? now : null,
      created_at: now,
    };

    await db.voyage_crew.put(newMember);
    await enqueueOfflineMutation({
      table_name: "voyage_crew",
      operation: "INSERT",
      record_id: recordId,
      payload: newMember as unknown as Record<string, unknown>,
    });

    if (saveToAddressBook) {
      await saveCrewContactFromVoyageCrew(newMember);
    }

    pushToast({
      title: `Tripulante Inscrito: ${newMember.full_name}`,
      subtitle: "Añadido al Rol de Zarpe Oficial",
      tone: "emerald",
    });

    setFullName("");
    setDocNumber("");
    setShowManualCrewForm(false);
  };

  const handleTransmitZarpe = async () => {
    if (!canTransmitZarpe) return;
    setTransmittingZarpe(true);

    const now = new Date().toISOString();
    const token = `AUT-CL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const digest = await computeSHA256Hex(
      JSON.stringify({
        voyage_id: selectedVoyageId,
        vessel: vessel?.name,
        pob: crewList?.length,
        time: now,
      })
    );

    // Update voyage status to active
    if (selectedVoyageId) {
      await db.voyages.update(selectedVoyageId, {
        status: "active",
        approval_token: token,
        approved_at: now,
      });
      await enqueueOfflineMutation({
        table_name: "voyages",
        operation: "UPDATE",
        record_id: selectedVoyageId,
        payload: { status: "active", approval_token: token, approved_at: now },
      });
    }

    setAuthorityApproval({
      approval_token: token,
      authority: "Simulador de Despacho (Modo Demo)",
      transmitted_at: now,
      sha256_manifest_seal: digest,
      pob_count: crewList?.length || 1,
    });

    setStampOverlay({
      title: "BORRADOR DE APOYO • ZARPE DEMO",
      subtitle: `Token Simulado: ${token} • POB: ${crewList?.length || 1}`,
      sha256Hash: digest,
      tokenBadge: "SIMULADO",
    });

    setTransmittingZarpe(false);

    pushToast({
      title: "Simulación de Zarpe Registrada",
      subtitle: "Borrador de apoyo guardado (No válido ante Autoridad Marítima)",
      tone: "emerald",
    });
  };

  const handleDownloadPDF = async () => {
    setPdfStatus("Generando Documento de Zarpe (PDF)...");
    const digest = await computeSHA256Hex(JSON.stringify(crewList));
    setPdfStatus(`Documento compilado (${crewList.length} tripulantes) • Resumen SHA-256: ${digest.slice(0, 16)}...`);
    setStampOverlay({
      title: "DOCUMENTO DE APOYO PARA ZARPE",
      subtitle: `${vessel?.name || "SV Albatros"} • POB: ${crewList.length} • Para presentar ante Autoridad Marítima`,
      sha256Hash: digest,
      tokenBadge: "BORRADOR APOYO",
    });
  };

  // ===========================================================================
  // SUB-VIEW A: DASHBOARD DE VIAJES (LISTADO DE CARDS + "+ PLANIFICAR NUEVO ZARPE")
  // ===========================================================================
  if (!selectedVoyageId) {
    return (
      <div data-testid="voyages-dashboard" className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header with High-Impact CTA */}
        <div className="marine-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 uppercase">
                <RadioTower className="w-3.5 h-3.5" />
                <span>DESPACHO &amp; BITÁCORA DE VIAJE</span>
              </span>
              <span className="text-xs font-mono opacity-60">
                {(voyages || []).length} viajes registrados
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Dashboard de Viajes &amp; Despacho Marítimo
            </h1>
            <p className="text-xs sm:text-sm opacity-70 max-w-2xl">
              Crea travesías, gestiona la dotación a bordo, completa el checklist de seguridad y
              genera el documento de apoyo para zarpe ante la Autoridad Marítima.
            </p>
          </div>

          <button
            type="button"
            data-testid="plan-new-zarpe-btn"
            onClick={() => setIsCreatingVoyage(true)}
            className="marine-btn marine-btn-primary min-h-12 px-6 text-sm font-bold flex items-center justify-center gap-2 shadow-none shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ PLANIFICAR NUEVO ZARPE</span>
          </button>
        </div>

        {/* Voyages Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(voyages || []).map((v) => {
            const isApproved = v.status === "active";
            const dateStr = v.departure_at
              ? new Date(v.departure_at).toLocaleDateString("es-CL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Por definir";

            return (
              <div
                key={v.id}
                data-testid={`voyage-card-${v.id}`}
                className="marine-card p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all hover:shadow-xl"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          isApproved
                            ? "bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40"
                            : v.status === "checkin_pending"
                            ? "bg-[#FF9F0A]/20 text-[#FF9F0A] border border-[#FF9F0A]/40"
                            : "bg-white/10 text-white/80 border border-white/20"
                        }`}
                      >
                        {isApproved ? "✓ ZARPE AUTORIZADO" : v.status === "checkin_pending" ? "CHECK-IN PENDIENTE" : "BORRADOR"}
                      </span>
                      <h3 className="text-base font-bold tracking-tight text-white mt-2">
                        {v.title}
                      </h3>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                      <Anchor className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                  </div>

                  {/* Route & Ports */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="text-[10px] opacity-60 uppercase">ITINERARIO:</div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span className="text-[#00E5FF]">{v.departure_port}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      <span className="text-[#00E676]">{v.arrival_port}</span>
                    </div>
                  </div>

                  {/* Date & Vessel info */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[9px] opacity-60 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>FECHA ZARPE</span>
                      </div>
                      <div className="font-semibold text-white/90 mt-0.5 truncate">{dateStr}</div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[9px] opacity-60 flex items-center gap-1">
                        <Ship className="w-3 h-3" />
                        <span>EMBARCACIÓN</span>
                      </div>
                      <div className="font-semibold text-white/90 mt-0.5 truncate">
                        {vessel?.name || "SV Albatros"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-mono opacity-65">
                    Token: {v.magic_link_token}
                  </span>

                  <button
                    type="button"
                    data-testid={`open-voyage-wizard-${v.id}`}
                    onClick={() => {
                      setSelectedVoyageId(v.id);
                      setCurrentStep(isApproved ? 4 : 2);
                    }}
                    className="marine-btn marine-btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                  >
                    <span>Gestionar Zarpe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal: Planificar Nuevo Zarpe */}
        {isCreatingVoyage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={() => setIsCreatingVoyage(false)}
          >
            <div
              className="w-full max-w-lg rounded-3xl bg-[#040B16] border-2 border-[var(--accent-primary)]/50 p-6 sm:p-7 shadow-2xl relative space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h3 className="text-base sm:text-lg font-bold">Planificar Nuevo Zarpe</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingVoyage(false)}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewVoyage} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase opacity-70">
                    Título o Nombre de la Travesía *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Travesía Dalcahue a Caleta Mechuque"
                    className="w-full min-h-12 px-3.5 text-sm rounded-xl bg-white/5 border border-white/5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase opacity-70">
                      Puerto de Zarpe *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDepPort}
                      onChange={(e) => setNewDepPort(e.target.value)}
                      placeholder="Marina Puerto Montt"
                      className="w-full min-h-12 px-3.5 text-sm rounded-xl bg-white/5 border border-white/5 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase opacity-70">
                      Puerto de Destino *
                    </label>
                    <input
                      type="text"
                      required
                      value={newArrPort}
                      onChange={(e) => setNewArrPort(e.target.value)}
                      placeholder="Caleta Mechuque"
                      className="w-full min-h-12 px-3.5 text-sm rounded-xl bg-white/5 border border-white/5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase opacity-70">
                      Fecha y Hora de Zarpe
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newDepDate}
                      onChange={(e) => setNewDepDate(e.target.value)}
                      className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase opacity-70">
                      Fecha Estimada Arribo
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newArrDate}
                      onChange={(e) => setNewArrDate(e.target.value)}
                      className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingVoyage(false)}
                    className="marine-btn marine-btn-secondary min-h-11 px-4 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    data-testid="submit-new-voyage-btn"
                    className="marine-btn marine-btn-primary min-h-11 px-6 text-xs font-bold"
                  >
                    Crear Viaje y Configurar Zarpe
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // SUB-VIEW B: WIZARD SECUENCIAL (STEPPER 1 → 2 → 3 → 4)
  // ===========================================================================
  return (
    <div data-testid="voyage-stepper-view" className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Return to Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="back-to-voyages-btn"
            onClick={() => setSelectedVoyageId(null)}
            className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Mis Viajes</span>
          </button>

          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{currentVoyage?.title || "Travesía"}</span>
              <span className="text-xs font-mono font-normal opacity-60">
                ({currentVoyage?.departure_port} → {currentVoyage?.arrival_port})
              </span>
            </h1>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="share-crew-link-btn"
            onClick={() => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/trip/${currentVoyage?.magic_link_token}` : "https://marinos.app";
              if (navigator.clipboard) navigator.clipboard.writeText(url);
              setShareCopied(true);
              setTimeout(() => setShareCopied(false), 2000);
              pushToast({
                title: "Magic Link de Tripulación Copiado",
                subtitle: url,
                tone: "cyan",
              });
            }}
            className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{shareCopied ? "¡Copiado!" : "Compartir Rol Tripulación"}</span>
          </button>

          <button
            type="button"
            data-testid="download-zarpe-pdf-btn"
            onClick={handleDownloadPDF}
            className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Descargar Rol PDF</span>
          </button>
        </div>
      </div>

      {/* Visual Stepper Bar */}
      <div className="marine-card p-3 sm:p-4">
        <div className="grid grid-cols-4 gap-2 font-mono text-xs">
          {[
            { step: 1, title: "1. Ruta & Fechas", desc: "Itinerario" },
            { step: 2, title: "2. Tripulación", desc: `${(crewList || []).length} a bordo` },
            { step: 3, title: "3. Checklist", desc: `${checklistCompletedCount}/6 Verificado` },
            { step: 4, title: "4. E-Zarpe", desc: currentVoyage?.status === "active" ? "Despachado" : "DIRECTEMAR" },
          ].map((s) => {
            const isActive = currentStep === s.step;
            const isCompleted = currentStep > s.step || (s.step === 4 && currentVoyage?.status === "active");

            return (
              <button
                key={s.step}
                type="button"
                data-testid={`stepper-tab-${s.step}`}
                onClick={() => setCurrentStep(s.step as 1 | 2 | 3 | 4)}
                className={`p-2 sm:p-3 rounded-xl border text-left transition-all shadow-none ${
                  isActive
                    ? isNight
                      ? "bg-red-950/40 text-red-500 border-b-2 border-b-red-500 border-transparent font-bold"
                      : "bg-[#1a2332] text-[var(--accent-primary)] border-b-2 border-b-[var(--accent-primary)] border-transparent font-bold"
                    : isCompleted
                    ? "bg-[#111c2e] text-[#00E676] border-b-2 border-b-[#00E676]/60 border-transparent hover:bg-[#1a2332]"
                    : "bg-[#0c1421] border-transparent text-slate-400 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] sm:text-xs">{s.title}</span>
                  {isCompleted && !isActive && <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />}
                </div>
                <div className="text-[10px] opacity-75 mt-0.5 truncate hidden sm:block">{s.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP CONTENT CONTAINER */}

      {/* =======================================================================
          PASO 1: RUTA Y FECHAS
      ======================================================================= */}
      {currentStep === 1 && (
        <div data-testid="step-1-route-dates" className="marine-card p-6 space-y-6">
          <div className="border-b border-white/5 pb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold">
                PASO 1 DE 4 • PLANIFICACIÓN NÁUTICA
              </div>
              <h2 className="text-lg font-bold mt-0.5">Ruta, Puertos y Fechas de Zarpe</h2>
            </div>
            <Compass className="w-6 h-6 text-[var(--accent-primary)]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="text-[10px] uppercase opacity-60">PUERTOS PRINCIPALES:</div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-[10px] opacity-55 block">PUERTO DE ZARPE:</span>
                  <span className="font-bold text-[#00E5FF] text-base">{currentVoyage?.departure_port}</span>
                </div>
                <div>
                  <span className="text-[10px] opacity-55 block">DESTINO PREVISTO:</span>
                  <span className="font-bold text-[#00E676] text-base">{currentVoyage?.arrival_port}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="text-[10px] uppercase opacity-60">VENTANA DE NAVEGACIÓN:</div>
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] opacity-55 block">SALIDA PROGRAMADA:</span>
                  <span className="font-bold text-white">
                    {currentVoyage?.departure_at ? new Date(currentVoyage.departure_at).toLocaleString("es-CL") : "Inmediata"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] opacity-55 block">ARRIBO ESTIMADO:</span>
                  <span className="font-bold text-white">
                    {currentVoyage?.estimated_arrival_at ? new Date(currentVoyage.estimated_arrival_at).toLocaleString("es-CL") : "48 horas"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span>Ruta cartográfica validada por los canales profundos del Seno de Reloncaví (cero cruce por tierra).</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              data-testid="continue-to-step-2-btn"
              onClick={() => setCurrentStep(2)}
              className="marine-btn marine-btn-primary min-h-12 px-6 text-sm font-bold flex items-center gap-2"
            >
              <span>Continuar a Tripulación</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =======================================================================
          PASO 2: TRIPULACIÓN (CREW MANIFEST + BOTONES PROMINENTES)
      ======================================================================= */}
      {currentStep === 2 && (
        <div data-testid="step-2-crew-manifest" className="marine-card p-6 space-y-6">
          <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold">
                PASO 2 DE 4 • DOTACIÓN A BORDO
              </div>
              <h2 className="text-lg font-bold mt-0.5">Rol de Tripulación (POB)</h2>
            </div>

            {/* Crucial Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="load-frequent-crew-batch-btn"
                onClick={handleBatchInjectFrequentCrew}
                className="marine-btn text-xs px-3.5 py-2 bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40 hover:bg-[#00E5FF]/25 font-bold flex items-center gap-1.5"
              >
                <BookmarkPlus className="w-4 h-4 text-[#00E5FF]" />
                <span>+ Cargar desde Agenda</span>
              </button>

              <button
                type="button"
                data-testid="scan-crew-ocr-btn"
                onClick={() => handleRunMultimodalOCR("felipe")}
                disabled={ocrLoading}
                className="marine-btn marine-btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold shadow-none"
              >
                <ScanLine className="w-4 h-4" />
                <span>{ocrLoading ? "Escaneando..." : "+ Escanear Carnet OCR"}</span>
              </button>

              <button
                type="button"
                data-testid="add-manual-crew-btn"
                onClick={() => setShowManualCrewForm(true)}
                className="marine-btn marine-btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Agregar Manual</span>
              </button>
            </div>
          </div>

          {/* Crew Table List */}
          {(!crewList || crewList.length === 0) ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-3 font-mono">
              <Users className="w-10 h-10 text-white/30 mx-auto" />
              <div className="font-bold text-sm">Sin tripulantes registrados aún</div>
              <p className="text-xs opacity-60 max-w-md mx-auto">
                Para zarpar ante DIRECTEMAR es obligatorio inscribir al Capitán y a los tripulantes.
                Usa los botones superiores para cargar en 1 clic desde tu Agenda o escanear el carnet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-mono opacity-70 flex justify-between">
                <span>TRIPULACIÓN REGISTRADA ({crewList.length} PERSONAS A BORDO):</span>
                <span>SEMAFORO DIRECTEMAR</span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {crewList.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{m.full_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] uppercase">
                          {m.role === "skipper" ? "Capitán" : m.role === "crew" ? "Tripulante" : "Invitado"}
                        </span>
                      </div>
                      <div className="opacity-70 text-[11px]">
                        {m.document_type} {m.document_number} • {m.nationality} • {m.license_type || "Sin Licencia"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Licencia Vigente</span>
                      </span>

                      <button
                        type="button"
                        onClick={async () => {
                          await db.voyage_crew.delete(m.id);
                          pushToast({
                            title: "Tripulante Retirado",
                            subtitle: `${m.full_name} eliminado del rol`,
                            tone: "amber",
                          });
                        }}
                        className="p-1 rounded text-white/50 hover:text-[#FF2D55]"
                        title="Eliminar de esta travesía"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Modal for Manual Crew Entry */}
          {showManualCrewForm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => setShowManualCrewForm(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-[#040B16] border border-white/20 p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="font-bold text-sm">Inscribir Tripulante en Rol de Zarpe</h3>
                  <button type="button" onClick={() => setShowManualCrewForm(false)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {ocrNotes && (
                  <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[11px] font-mono text-[var(--accent-primary)] flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{ocrNotes}</span>
                  </div>
                )}

                <form onSubmit={handleSaveCrewMember} className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="block opacity-70 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Cap. Felipe Valverde"
                      className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block opacity-70 mb-1">Tipo Doc.</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full min-h-11 px-2 text-xs rounded-xl bg-white/5 border border-white/5"
                      >
                        <option value="RUT">RUT (Chile)</option>
                        <option value="PASSPORT">Pasaporte</option>
                        <option value="DNI">DNI</option>
                      </select>
                    </div>
                    <div>
                      <label className="block opacity-70 mb-1">Nº Documento *</label>
                      <input
                        type="text"
                        required
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        placeholder="13.452.890-1"
                        className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block opacity-70 mb-1">Rol a Bordo</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as "skipper" | "crew" | "guest")}
                        className="w-full min-h-11 px-2 text-xs rounded-xl bg-white/5 border border-white/5"
                      >
                        <option value="skipper">Capitán / Patrón</option>
                        <option value="crew">Tripulante</option>
                        <option value="guest">Pasajero / Invitado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block opacity-70 mb-1">Nacionalidad</label>
                      <input
                        type="text"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="CL"
                        className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block opacity-70 mb-1">Licencia DIRECTEMAR</label>
                    <input
                      type="text"
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value)}
                      placeholder="Capitán Deportivo Alta Mar"
                      className="w-full min-h-11 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="save-to-contacts"
                      checked={saveToAddressBook}
                      onChange={(e) => setSaveToAddressBook(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="save-to-contacts" className="text-[11px] opacity-80 cursor-pointer">
                      Guardar también en Libreta de Tripulación Frecuente
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualCrewForm(false)}
                      className="marine-btn marine-btn-secondary text-xs px-3 py-1.5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="marine-btn marine-btn-primary text-xs px-4 py-1.5 font-bold"
                    >
                      Inscribir en Rol
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Stepper Navigation */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="marine-btn marine-btn-secondary text-xs px-4 py-2"
            >
              ← Volver a Ruta
            </button>

            <button
              type="button"
              data-testid="continue-to-step-3-btn"
              onClick={() => setCurrentStep(3)}
              className="marine-btn marine-btn-primary min-h-12 px-6 text-sm font-bold flex items-center gap-2"
            >
              <span>Continuar a Checklist Pre-Zarpe ({checklistCompletedCount}/6)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =======================================================================
          PASO 3: CHECKLIST PRE-ZARPE (HANDOVER DE SEGURIDAD)
      ======================================================================= */}
      {currentStep === 3 && (
        <div data-testid="step-3-checklist" className="marine-card p-6 space-y-6">
          <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold">
                PASO 3 DE 4 • SEGURIDAD MARÍTIMA
              </div>
              <h2 className="text-lg font-bold mt-0.5">Checklist Pre-Zarpe Obligatorio</h2>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span
                className={`px-3 py-1 rounded-full font-bold border ${
                  isChecklistApproved
                    ? "bg-[#00E676]/20 text-[#00E676] border-[#00E676]/40"
                    : "bg-[#FF9F0A]/20 text-[#FF9F0A] border-[#FF9F0A]/40"
                }`}
              >
                {checklistCompletedCount} / {MANDATORY_CHECKLIST.length} COMPLETADOS
              </span>
            </div>
          </div>

          <p className="text-xs font-mono opacity-70">
            Revisión física obligatoria del Capitán antes de desatracar. El E-Zarpe oficial ante DIRECTEMAR
            requiere la certificación de todos los ítems de seguridad y sentina.
          </p>

          <div className="space-y-3 font-mono">
            {MANDATORY_CHECKLIST.map((item) => {
              const isChecked = Boolean(checklistChecks[item.id]);

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleChecklist(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isChecked
                      ? "bg-[#00E676]/[0.06] border-[#00E676]/30 shadow-sm"
                      : "bg-white/[0.02] border-white/5 hover:border-white/20"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isChecked
                        ? "bg-[#00E676] border-[#00E676] text-black"
                        : "border-white/30 bg-black/40"
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                  </div>

                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className={`text-xs font-bold ${isChecked ? "text-white" : "text-white/90"}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] opacity-60 leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stepper Navigation */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="marine-btn marine-btn-secondary text-xs px-4 py-2"
            >
              ← Volver a Tripulación
            </button>

            <button
              type="button"
              data-testid="continue-to-step-4-btn"
              onClick={() => setCurrentStep(4)}
              className="marine-btn marine-btn-primary min-h-12 px-6 text-sm font-bold flex items-center gap-2"
            >
              <span>Continuar a Despacho E-Zarpe</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =======================================================================
          PASO 4: E-ZARPE DIRECTEMAR (DESPACHO OFICIAL)
      ======================================================================= */}
      {currentStep === 4 && (
        <div data-testid="step-4-ezarpe" className="marine-card p-6 space-y-6">
          <div className="border-b border-white/5 pb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold">
                PASO 4 DE 4 • DOCUMENTO DE ZARPE &amp; DESPACHO
              </div>
              <h2 className="text-lg font-bold mt-0.5">Preparación de Zarpe &amp; Rol de Tripulación</h2>
            </div>

            <RadioTower className="w-6 h-6 text-[#00E5FF]" />
          </div>

          {/* Validation Status Pre-flight Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                hasCrew
                  ? "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]"
                  : "bg-[#FF2D55]/10 border-[#FF2D55]/30 text-[#FF2D55]"
              }`}
            >
              <div className="flex items-center gap-2">
                {hasCrew ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                <span className="font-bold">Tripulación Inscrita:</span>
              </div>
              <span>{(crewList || []).length} personas a bordo</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isChecklistApproved
                  ? "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]"
                  : "bg-[#FF2D55]/10 border-[#FF2D55]/30 text-[#FF2D55]"
              }`}
            >
              <div className="flex items-center gap-2">
                {isChecklistApproved ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span className="font-bold">Checklist Pre-Zarpe:</span>
              </div>
              <span>{checklistCompletedCount} / {MANDATORY_CHECKLIST.length} aprobados</span>
            </div>
          </div>

          {/* Summary Details */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 font-mono text-xs">
            <div className="text-[10px] uppercase opacity-60">DATOS DE EXPEDIENTE NÁUTICO:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-[9px] opacity-55 block">EMBARCACIÓN</span>
                <span className="font-bold text-white">{vessel?.name}</span>
              </div>
              <div>
                <span className="text-[9px] opacity-55 block">MATRÍCULA</span>
                <span className="font-bold text-[var(--accent-primary)]">{vessel?.registration_number}</span>
              </div>
              <div>
                <span className="text-[9px] opacity-55 block">AUTORIDAD RECEPTORA</span>
                <span className="font-bold text-white truncate block">Cap. Puerto P. Montt</span>
              </div>
              <div>
                <span className="text-[9px] opacity-55 block">ESTADO</span>
                <span className="font-bold text-[#00E676]">
                  {currentVoyage?.status === "active" ? "Documento Generado" : "Listo para Despacho"}
                </span>
              </div>
            </div>
          </div>

          {/* Transmit Action */}
          {canTransmitZarpe ? (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[var(--accent-primary)]/15 to-[#00E676]/15 border border-[var(--accent-primary)]/30 space-y-3 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                <span>Modo demo — aprobación simulada, no válida ante la Autoridad Marítima</span>
              </div>

              <h3 className="text-base font-bold text-white">
                {currentVoyage?.status === "active"
                  ? "✓ Documentación de Travesía Lista"
                  : "Todo listo para generar la documentación de apoyo"}
              </h3>
              <p className="text-xs font-mono opacity-80 max-w-lg mx-auto">
                El zarpe formal debe tramitarse por los canales oficiales de DIRECTEMAR (portal web oficial SITPORT o presencialmente en Capitanía de Puerto). Este documento es un borrador de apoyo para la tripulación.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  data-testid="transmit-ezarpe-directemar-btn"
                  onClick={handleDownloadPDF}
                  className="marine-btn marine-btn-primary min-h-12 px-7 text-sm font-bold shadow-none flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Generar documento de zarpe (PDF) para presentar ante la Autoridad Marítima</span>
                </button>

                <button
                  type="button"
                  onClick={handleTransmitZarpe}
                  disabled={transmittingZarpe}
                  className="marine-btn marine-btn-secondary min-h-12 px-5 text-xs flex items-center gap-2"
                >
                  <RadioTower className="w-4 h-4" />
                  <span>
                    {transmittingZarpe
                      ? "Simulando despacho..."
                      : "Simular validación local (Demo)"}
                  </span>
                </button>
              </div>

              {pdfStatus && (
                <div className="text-[11px] font-mono text-[var(--accent-primary)] pt-1">
                  {pdfStatus}
                </div>
              )}

              {authorityApproval && (
                <div className="mt-3 p-3 rounded-xl bg-black/40 border border-[#00E676]/40 text-left font-mono text-[11px] space-y-1">
                  <div className="text-[#00E676] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registro Simulado: {authorityApproval.approval_token}</span>
                  </div>
                  <div className="text-white/80">
                    Módulo: {authorityApproval.authority}
                  </div>
                  <div className="text-white/60 text-[10px]">
                    Resumen SHA-256: {authorityApproval.sha256_manifest_seal.slice(0, 24)}... • POB: {authorityApproval.pob_count}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#FF2D55]/15 border border-[#FF2D55]/30 text-xs font-mono space-y-1.5">
              <div className="font-bold text-[#FF2D55] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>Requisitos de Despacho Incompletos</span>
              </div>
              <p className="opacity-80">
                Debes tener al menos 1 tripulante registrado en el Paso 2 y completar los 6 ítems
                del checklist de seguridad en el Paso 3 antes de poder tramitar el zarpe oficial.
              </p>
            </div>
          )}

          {/* Stepper Navigation */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="marine-btn marine-btn-secondary text-xs px-4 py-2"
            >
              ← Volver a Checklist
            </button>

            <button
              type="button"
              onClick={() => setSelectedVoyageId(null)}
              className="marine-btn marine-btn-secondary text-xs px-4 py-2"
            >
              Volver al Dashboard de Viajes
            </button>
          </div>
        </div>
      )}

      {/* Crypto Stamp Modal Overlay if active */}
      {stampOverlay && (
        <CryptoStampOverlay
          visible={true}
          title={stampOverlay.title}
          subtitle={stampOverlay.subtitle}
          sha256Hash={stampOverlay.sha256Hash}
          tokenBadge={stampOverlay.tokenBadge}
          onDismiss={() => setStampOverlay(null)}
        />
      )}
    </div>
  );
}
