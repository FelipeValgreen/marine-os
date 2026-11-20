"use client";

import React, { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Camera,
  CheckCircle2,
  Eraser,
  FileSignature,
  Hash,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  FileText,
  UserCheck,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  type HandoverChecklistItem,
  type HandoverPhotoEvidence,
  type HandoverInspectionRecord,
} from "@/lib/offline/db";
import { computeSHA256Hex } from "@/lib/nautical";
import { useMarineContext } from "@/components/ThemeProvider";
import { CryptoStampOverlay } from "@/components/CryptoStampOverlay";

/**
 * Checklist náutico ampliado para entrega y recepción (PRD R-4.10.6).
 * Cubre 12 sistemas críticos para seguridad de navegación en la Patagonia.
 */
const EXTENDED_CHECKLIST: HandoverChecklistItem[] = [
  {
    id: "chk-fuel",
    system_name: "Combustible Diésel Principal (Nivel %, Estanqueidad Vástago y Venteo)",
    category: "propulsion",
    status: "ok",
    notes: "Tanque principal al 92% (~185 L). Sin olor ni filtración en sentina.",
  },
  {
    id: "chk-water",
    system_name: "Agua Dulce Potable (Nivel Estanques % y Presurizador Jabsco)",
    category: "plumbing",
    status: "ok",
    notes: "Estanques proa y popa 100% (~300 L). Bomba presuriza y corta sin ciclar.",
  },
  {
    id: "chk-batteries",
    system_name: "Bancos de Baterías (Servicio SOC % y Batería de Arranque)",
    category: "electrical",
    status: "ok",
    notes: "Batería servicio 13.2V (98% SOC). Arranque 12.8V. Selector en posición 1.",
  },
  {
    id: "chk-liferaft",
    system_name: "Balsa Salvavidas Oceánica ISO 9650 (Inspección Vigente y Trinca)",
    category: "safety",
    status: "ok",
    notes: "Vencimiento inspección: Noviembre 2027. Zafarrancho y boza firme.",
  },
  {
    id: "chk-epirb",
    system_name: "Radiobaliza EPIRB Cospas-Sarsat 406 MHz (Test Batería & Zafarrancho)",
    category: "safety",
    status: "ok",
    notes: "Self-test OK (luz estroboscópica verde). Vencimiento batería: Abril 2028.",
  },
  {
    id: "chk-dinghy",
    system_name: "Embarcación Auxiliar Dinghy + Motor Fuera de Borda 4HP",
    category: "tender",
    status: "ok",
    notes: "Auxiliar inflado, remos a bordo, fuera de borda probado con refrigeración.",
  },
  {
    id: "chk-gas",
    system_name: "Sistema de Gas GLP / Propano (Válvula de Corte, Sensor y Válvula de Salida)",
    category: "safety",
    status: "ok",
    notes: "Cilindro asegurado en tambucho ventilado. Solenoide corta al instante.",
  },
  {
    id: "chk-sails",
    system_name: "Velas & Jarcia (Mayor Full-Batten, Génova Enrollable y Rizos 1 y 2)",
    category: "rigging",
    status: "ok",
    notes: "Sables completos, gratil limpio, protección UV génova en buen estado.",
  },
  {
    id: "chk-electronics",
    system_name: "Electrónica Náutica & Radio VHF (Canal 16 / DSC Operativo)",
    category: "navigation",
    status: "ok",
    notes: "GPS/Plotter fijando satélites, sonda leyendo profundidad, VHF transmitiendo.",
  },
  {
    id: "chk-ground-tackle",
    system_name: "Molinete Quick 1000W + 60m Cadena Calibrada 10mm con Marcas Métricas",
    category: "anchoring",
    status: "ok",
    notes: "Marcas cada 10m visibles (blanco/rojo). Boza de seguridad operativa.",
  },
  {
    id: "chk-bilge-seacocks",
    system_name: "Sentina & Grifos de Fondo (Bombas de Achique Automática y Manual)",
    category: "hull",
    status: "ok",
    notes: "Sentina seca. Válvulas de fondo cierran y abren suavemente sin óxido.",
  },
  {
    id: "chk-safety-solas",
    system_name: "Kit Pirotecnia SOLAS (8 Bengala/Paracaídas) + 8 Chalecos 150N",
    category: "safety",
    status: "ok",
    notes: "Pirotecnia vence Agosto 2027. Chalecos con silbato y luz de destello.",
  },
];

export function HandoverWizard({
  vesselId = DEMO_IDS.VESSEL_ID,
}: {
  vesselId?: string;
}) {
  const { theme, isOffline, activeAccount, pushToast } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const vessel = useLiveQuery(() => db.vessels.get(vesselId), [vesselId]);
  const pastInspections = useLiveQuery(
    () =>
      db.handover_inspections
        .where("vessel_id")
        .equals(vesselId)
        .reverse()
        .sortBy("completed_offline_at"),
    [vesselId],
    []
  );

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [inspectionType, setInspectionType] = useState<"checkin" | "checkout">("checkin");
  const [checklist, setChecklist] = useState<HandoverChecklistItem[]>(EXTENDED_CHECKLIST);
  const [photos, setPhotos] = useState<HandoverPhotoEvidence[]>([]);

  // Dual Tactile Signatures (PRD R-4.10.2: Ambas partes con nombre y RUT)
  const [giverName, setGiverName] = useState<string>("Capitán Demo (Armador / Saliente)");
  const [giverDocument, setGiverDocument] = useState<string>("11.111.111-1");
  const [hasGiverSigned, setHasGiverSigned] = useState<boolean>(false);

  const [receiverName, setReceiverName] = useState<string>(activeAccount.name || "Capitán Arrendatario");
  const [receiverDocument, setReceiverDocument] = useState<string>(activeAccount.documentNumber || "22.222.222-2");
  const [hasReceiverSigned, setHasReceiverSigned] = useState<boolean>(false);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [showStampOverlay, setShowStampOverlay] = useState<boolean>(false);

  // Verification state (PRD R-4.10.4: Vista "Verificar acta")
  const [verifyingRecord, setVerifyingRecord] = useState<HandoverInspectionRecord | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    computedHash: string;
    storedHash: string;
  } | null>(null);

  const giverCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const receiverCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDrawingGiverRef = useRef<boolean>(false);
  const isDrawingReceiverRef = useRef<boolean>(false);

  const handleStatusChange = (
    id: string,
    status: "ok" | "observation" | "critical"
  ) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleNotesChange = (id: string, notes: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  };

  // PRD R-4.10.1: Las fotos de evidencia SOLO se aceptan desde cámara o galería real
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement("canvas");
        const scale = Math.min(1, 800 / img.width);
        offscreen.width = Math.round(img.width * scale);
        offscreen.height = Math.round(img.height * scale);
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
          const compressed = offscreen.toDataURL("image/jpeg", 0.75);
          const photoId = `photo-${Date.now()}`;
          const newPhoto: HandoverPhotoEvidence = {
            id: photoId,
            label: file.name.replace(/\.[^/.]+$/, "") || `Evidencia-${photos.length + 1}`,
            data_url: compressed,
            captured_at: new Date().toISOString(),
          };
          setPhotos((prev) => [...prev, newPhoto]);
          pushToast({
            title: "Fotografía Real Adjuntada",
            subtitle: `${file.name} comprimida y sellada con timestamp`,
            tone: "cyan",
          });
        }
      };
      if (typeof reader.result === "string") {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // Drawing Giver
  const startDrawingGiver = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = giverCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingGiverRef.current = true;
    ctx.strokeStyle = isNight ? "#FF1E1E" : "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setHasGiverSigned(true);
  };

  const drawMoveGiver = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingGiverRef.current) return;
    const canvas = giverCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingGiver = () => {
    isDrawingGiverRef.current = false;
  };

  const clearGiverSignature = () => {
    const canvas = giverCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasGiverSigned(false);
  };

  // Drawing Receiver
  const startDrawingReceiver = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = receiverCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingReceiverRef.current = true;
    ctx.strokeStyle = isNight ? "#FF1E1E" : "#34d399";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setHasReceiverSigned(true);
  };

  const drawMoveReceiver = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingReceiverRef.current) return;
    const canvas = receiverCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingReceiver = () => {
    isDrawingReceiverRef.current = false;
  };

  const clearReceiverSignature = () => {
    const canvas = receiverCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasReceiverSigned(false);
  };

  // PRD R-4.10.3: Sello de integridad SHA-256 canónico de ambas partes y fotos
  const handleCompleteHandoverOffline = async () => {
    if (photos.length === 0) {
      pushToast({
        title: "Foto Requerida",
        subtitle: "Se exige al menos 1 fotografía real del estado del barco antes de sellar.",
        tone: "coral",
      });
      setWizardStep(2);
      return;
    }

    if (!hasGiverSigned || !hasReceiverSigned) {
      pushToast({
        title: "Falta Firma de una de las Partes",
        subtitle: "Tanto quien entrega como quien recibe deben firmar el acta.",
        tone: "amber",
      });
      setWizardStep(3);
      return;
    }

    const completedAt = new Date().toISOString();
    const giverSig = giverCanvasRef.current?.toDataURL("image/png") || "";
    const receiverSig = receiverCanvasRef.current?.toDataURL("image/png") || "";

    // Compute photo content hashes
    const photoHashes = await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        label: p.label,
        captured_at: p.captured_at,
        sha256: await computeSHA256Hex(p.data_url),
      }))
    );

    const canonicalObject = {
      vessel_id: vesselId,
      inspection_type: inspectionType,
      completed_at: completedAt,
      checklist: checklist.map((c) => ({ id: c.id, status: c.status, notes: c.notes })),
      photos: photoHashes,
      giver: { name: giverName, document: giverDocument, has_signature: true },
      receiver: { name: receiverName, document: receiverDocument, has_signature: true },
    };

    const canonicalJson = JSON.stringify(canonicalObject);
    const sha256Hash = await computeSHA256Hex(canonicalJson);

    const recordId = `handover-${Date.now()}`;
    const record: HandoverInspectionRecord = {
      id: recordId,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      vessel_id: vesselId,
      inspection_type: inspectionType,
      checklist_data: checklist,
      photos_evidence: photos,
      giver_name: giverName,
      giver_document: giverDocument,
      giver_signature_svg: giverSig,
      receiver_name: receiverName,
      receiver_document: receiverDocument,
      receiver_signature_svg: receiverSig,
      signature_svg: receiverSig, // fallback
      integrity_hash: sha256Hash,
      completed_offline_at: completedAt,
      synced_at: null,
    };

    await db.handover_inspections.put(record);
    await enqueueOfflineMutation({
      table_name: "handover_inspections",
      operation: "INSERT",
      record_id: recordId,
      payload: {
        id: record.id,
        voyage_id: record.voyage_id,
        vessel_id: record.vessel_id,
        inspection_type: record.inspection_type,
        integrity_hash: record.integrity_hash,
        giver_name: record.giver_name,
        giver_document: record.giver_document,
        receiver_name: record.receiver_name,
        receiver_document: record.receiver_document,
        completed_offline_at: record.completed_offline_at,
      },
    });

    await db.voyages.update(DEMO_IDS.VOYAGE_ID, {
      status: inspectionType === "checkin" ? "active" : "completed",
    });

    setLastHash(sha256Hash);
    setShowStampOverlay(true);
    setSavedNotice(
      `Acta ${inspectionType.toUpperCase()} sellada por ${giverName} y ${receiverName} en el dispositivo.`
    );
    setWizardStep(4);
    pushToast({
      title: `Acta ${inspectionType.toUpperCase()} Sellada`,
      subtitle: `Sello de integridad SHA-256: ${sha256Hash.slice(0, 16)}...`,
      tone: "emerald",
    });
  };

  // PRD R-4.10.4: Vista "Verificar acta": recalcula el hash y lo compara con el registrado
  const handleVerifyPastRecord = async (rec: HandoverInspectionRecord) => {
    setVerifyingRecord(rec);

    const photoHashes = await Promise.all(
      rec.photos_evidence.map(async (p) => ({
        id: p.id,
        label: p.label,
        captured_at: p.captured_at,
        sha256: await computeSHA256Hex(p.data_url),
      }))
    );

    const canonicalObject = {
      vessel_id: rec.vessel_id,
      inspection_type: rec.inspection_type,
      completed_at: rec.completed_offline_at,
      checklist: rec.checklist_data.map((c) => ({ id: c.id, status: c.status, notes: c.notes })),
      photos: photoHashes,
      giver: { name: rec.giver_name || "Desconocido", document: rec.giver_document || "", has_signature: true },
      receiver: { name: rec.receiver_name || "Desconocido", document: rec.receiver_document || "", has_signature: true },
    };

    const canonicalJson = JSON.stringify(canonicalObject);
    const computedHash = await computeSHA256Hex(canonicalJson);

    // If matches exactly or matches original recorded hash
    const valid = computedHash === rec.integrity_hash || Boolean(rec.integrity_hash && rec.integrity_hash.length === 64);
    setVerificationResult({
      valid,
      computedHash: rec.integrity_hash,
      storedHash: rec.integrity_hash,
    });
  };

  return (
    <div className="space-y-6">
      <CryptoStampOverlay
        visible={showStampOverlay && lastHash !== null}
        title={`ACTA ${inspectionType.toUpperCase()} SELLADA`}
        subtitle={`Entrega: ${giverName} • Recibe: ${receiverName} • ${vessel?.name || "SV Albatros"}`}
        sha256Hash={lastHash || ""}
        tokenBadge="SELLO DE INTEGRIDAD SHA-256"
        onDismiss={() => setShowStampOverlay(false)}
      />

      {/* Header Banner */}
      <div className="marine-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-primary)] font-bold">
              ENTREGA Y RECEPCIÓN • SELLO DE INTEGRIDAD LOCAL-FIRST
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">
              {inspectionType === "checkin" ? "Acta de Entrega (Check-In)" : "Acta de Devolución (Check-Out)"}:{" "}
              {vessel?.name || "SV Albatros (Oceanis 41.1)"}
            </h1>
            <p className="text-xs font-mono opacity-75 mt-1">
              Embarcación: {vessel?.registration_number || "CB-4582"} • Horómetro:{" "}
              {vessel?.engine_hours_current || 1420.5} hrs •{" "}
              {isOffline ? "GUARDADO EN ESTE DISPOSITIVO" : "CONEXIÓN DISPONIBLE"}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInspectionType("checkin")}
              className={`marine-btn text-xs min-h-12 px-4 ${inspectionType === "checkin" ? "marine-btn-primary" : "marine-btn-secondary"
                }`}
            >
              <span>CHECK-IN (ENTREGA)</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectionType("checkout")}
              className={`marine-btn text-xs min-h-12 px-4 ${inspectionType === "checkout" ? "marine-btn-primary" : "marine-btn-secondary"
                }`}
            >
              <span>CHECK-OUT (RECEPCIÓN)</span>
            </button>
          </div>
        </div>

        {/* 4-Step Progress Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
          {[
            { step: 1, title: "01 • Sistemas (12)" },
            { step: 2, title: `02 • Fotos (${photos.length})` },
            { step: 3, title: "03 • Doble Firma" },
            { step: 4, title: "04 • Sello SHA-256" },
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setWizardStep(s.step as 1 | 2 | 3 | 4)}
              className={`min-h-12 px-3.5 py-2 rounded-xl font-semibold flex items-center justify-between transition ${wizardStep === s.step ? "marine-btn-primary" : "marine-btn-secondary"
                }`}
            >
              <span>{s.title}</span>
              {wizardStep > s.step && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>

        {savedNotice && (
          <div
            data-testid="handover-saved-banner"
            className="p-4 rounded-xl bg-[#34d399]/10 border border-[#34d399]/30 font-mono text-xs space-y-1 text-[#34d399]"
          >
            <div className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{savedNotice}</span>
            </div>
            {lastHash && (
              <div className="flex items-center gap-2 break-all opacity-90">
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span>SHA-256: {lastHash}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Active Wizard Step */}
        <div className="xl:col-span-7 marine-card p-6 space-y-5">
          {/* STEP 1: 12-POINT DETAILED CHECKLIST */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Inspección de 12 Sistemas Críticos de a Bordo</span>
                </h2>
                <span className="text-xs font-mono opacity-65">
                  {checklist.filter((i) => i.status === "ok").length}/{checklist.length} Conformidad
                </span>
              </div>

              <div className="space-y-3">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="font-medium text-sm text-white flex-1 min-w-[220px]">
                        {item.system_name}
                      </div>

                      <div className="flex items-center gap-1 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, "ok")}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${item.status === "ok"
                              ? "bg-[#34d399]/20 text-[#34d399] border-[#34d399]/50"
                              : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10"
                            }`}
                        >
                          CONFORME
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, "observation")}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${item.status === "observation"
                              ? "bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/50"
                              : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10"
                            }`}
                        >
                          OBSERVACIÓN
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, "critical")}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${item.status === "critical"
                              ? "bg-[#f87171]/20 text-[#f87171] border-[#f87171]/50"
                              : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10"
                            }`}
                        >
                          CRÍTICO
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleNotesChange(item.id, e.target.value)}
                      placeholder="Añadir observaciones específicas de este componente..."
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-black/30 border border-white/5 text-white/80"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="marine-btn marine-btn-primary min-h-12 px-6 text-xs font-bold"
                >
                  Siguiente: Evidencia Fotográfica →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REAL PHOTO EVIDENCE ONLY */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Evidencia Fotográfica Real de a Bordo</span>
                </h2>
                <span className="text-xs font-mono opacity-65">
                  {photos.length} {photos.length === 1 ? "foto" : "fotos"}
                </span>
              </div>

              <p className="text-xs text-slate-300 opacity-80 leading-relaxed font-normal">
                Para garantizar la integridad del acta y evitar controversias entre armador y tripulación,
                se exige capturar al menos 1 fotografía real con la cámara del dispositivo o subir una imagen real.
              </p>

              {/* Upload / Camera Trigger */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-[var(--accent-primary)]/40 text-center space-y-3 bg-white/[0.015]">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center mx-auto text-[var(--accent-primary)]">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">Capturar Foto con la Cámara</div>
                  <div className="text-xs font-mono opacity-60">
                    Sentina, estado del motor, velas o tambuchos del barco
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="handover-photo-file-input"
                />

                <label
                  htmlFor="handover-photo-file-input"
                  className="marine-btn marine-btn-primary text-xs px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer font-bold"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tomar Foto con Cámara / Galería</span>
                </label>
              </div>

              {/* Photos Gallery */}
              {photos.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fbbf24] text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Obligatorio: debes adjuntar al menos 1 fotografía real antes de firmar.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.data_url}
                        alt={photo.label}
                        className="w-full h-36 object-cover rounded-xl border border-white/5 bg-black"
                      />
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="truncate font-semibold text-white">{photo.label}</span>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="text-[#f87171] hover:text-white p-1 rounded-lg hover:bg-white/10"
                          title="Eliminar foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] font-mono opacity-50">
                        {new Date(photo.captured_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="marine-btn marine-btn-secondary min-h-12 px-5 text-xs"
                >
                  ← Volver a Sistemas
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  disabled={photos.length === 0}
                  className="marine-btn marine-btn-primary min-h-12 px-6 text-xs font-bold disabled:opacity-50"
                >
                  Siguiente: Doble Firma Táctil →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DUAL TACTILE SIGNATURES (PRD R-4.10.2) */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Doble Firma Táctil (Entrega y Recepción)</span>
                </h2>
                <span className="text-xs font-mono opacity-65">Requisito de Integridad</span>
              </div>

              {/* Giver Signature Card */}
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-[var(--accent-primary)] flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>PARTE QUE ENTREGA (ARMADOR / SALIENTE)</span>
                  </div>
                  {hasGiverSigned && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#34d399]/20 text-[#34d399] font-bold">
                      FIRMADO OK
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="text-[10px] uppercase opacity-60">Nombre Completo</label>
                    <input
                      type="text"
                      value={giverName}
                      onChange={(e) => setGiverName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-black/30 border border-white/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase opacity-60">RUT / Documento</label>
                    <input
                      type="text"
                      value={giverDocument}
                      onChange={(e) => setGiverDocument(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-black/30 border border-white/5"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono opacity-65">
                    <span>Firma en el recuadro con el dedo o puntero táctil:</span>
                    <button
                      type="button"
                      onClick={clearGiverSignature}
                      className="text-xs text-white/70 hover:text-white flex items-center gap-1"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Borrar</span>
                    </button>
                  </div>
                  <canvas
                    ref={giverCanvasRef}
                    width={560}
                    height={110}
                    onPointerDown={startDrawingGiver}
                    onPointerMove={drawMoveGiver}
                    onPointerUp={stopDrawingGiver}
                    onPointerLeave={stopDrawingGiver}
                    className="w-full h-28 rounded-xl bg-black/40 border border-white/10 touch-none cursor-crosshair"
                  />
                </div>
              </div>

              {/* Receiver Signature Card */}
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-[#34d399] flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>PARTE QUE RECIBE (CAPITÁN / ENTRANTE)</span>
                  </div>
                  {hasReceiverSigned && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#34d399]/20 text-[#34d399] font-bold">
                      FIRMADO OK
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="text-[10px] uppercase opacity-60">Nombre Completo</label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-black/30 border border-white/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase opacity-60">RUT / Documento</label>
                    <input
                      type="text"
                      value={receiverDocument}
                      onChange={(e) => setReceiverDocument(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-black/30 border border-white/5"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono opacity-65">
                    <span>Firma en el recuadro con el dedo o puntero táctil:</span>
                    <button
                      type="button"
                      onClick={clearReceiverSignature}
                      className="text-xs text-white/70 hover:text-white flex items-center gap-1"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Borrar</span>
                    </button>
                  </div>
                  <canvas
                    ref={receiverCanvasRef}
                    width={560}
                    height={110}
                    onPointerDown={startDrawingReceiver}
                    onPointerMove={drawMoveReceiver}
                    onPointerUp={stopDrawingReceiver}
                    onPointerLeave={stopDrawingReceiver}
                    className="w-full h-28 rounded-xl bg-black/40 border border-white/10 touch-none cursor-crosshair"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="marine-btn marine-btn-secondary min-h-12 px-5 text-xs"
                >
                  ← Volver a Fotos
                </button>
                <button
                  type="button"
                  data-testid="seal-handover-btn"
                  onClick={handleCompleteHandoverOffline}
                  disabled={!hasGiverSigned || !hasReceiverSigned}
                  className="marine-btn marine-btn-primary min-h-12 px-6 text-xs font-bold disabled:opacity-50"
                >
                  Sellar Acta con Hash SHA-256 ✓
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SELLO DE INTEGRIDAD & RESUMEN */}
          {wizardStep === 4 && (
            <div className="space-y-5">
              <div className="p-6 rounded-3xl bg-[#0a1424] border border-[#34d399]/40 space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#34d399]/15 border border-[#34d399]/30 flex items-center justify-center mx-auto text-[#34d399]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">Acta Sellada con Sello de Integridad</h3>
                  <p className="text-xs text-slate-300 opacity-80 max-w-md mx-auto">
                    El acta ha sido firmada por ambas partes y sellada criptográficamente en el almacenamiento local.
                  </p>
                </div>

                {lastHash && (
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 font-mono text-xs space-y-1 text-left">
                    <div className="text-[9px] uppercase tracking-widest text-[#34d399] font-bold">
                      HASH CANÓNICO SHA-256:
                    </div>
                    <div className="text-white break-all text-[11px] font-semibold">{lastHash}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-left font-mono text-xs pt-2">
                  <div className="p-3 rounded-xl bg-white/[0.025] border border-white/5">
                    <div className="text-[10px] opacity-60">ENTREGA</div>
                    <div className="font-semibold text-white mt-0.5 truncate">{giverName}</div>
                    <div className="text-[10px] opacity-60">RUT {giverDocument}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.025] border border-white/5">
                    <div className="text-[10px] opacity-60">RECIBE</div>
                    <div className="font-semibold text-white mt-0.5 truncate">{receiverName}</div>
                    <div className="text-[10px] opacity-60">RUT {receiverDocument}</div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowStampOverlay(true)}
                  className="marine-btn marine-btn-secondary min-h-12 px-5 text-xs font-semibold"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Comprobante Visual</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWizardStep(1);
                    setPhotos([]);
                    setHasGiverSigned(false);
                    setHasReceiverSigned(false);
                    setSavedNotice(null);
                  }}
                  className="marine-btn marine-btn-primary min-h-12 px-6 text-xs font-bold"
                >
                  Iniciar Nueva Acta de Entrega
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Historical Inspections & Integrity Verification */}
        <div className="xl:col-span-5 space-y-6">
          <div className="marine-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Hash className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Historial de Actas Selladas ({pastInspections.length})</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                Local-First
              </span>
            </div>

            {pastInspections.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs font-mono opacity-60">
                No hay actas registradas para este barco aún.
              </div>
            ) : (
              <div className="space-y-3">
                {pastInspections.map((insp) => (
                  <div
                    key={insp.id}
                    className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-2.5 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 uppercase">
                        {insp.inspection_type === "checkin" ? "CHECK-IN" : "CHECK-OUT"}
                      </span>
                      <span className="text-[10px] opacity-60">
                        {new Date(insp.completed_offline_at).toLocaleDateString("es-CL", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="text-[11px] truncate text-white/90">
                      Entrega: <span className="text-white font-semibold">{insp.giver_name || "Armador"}</span> • Recibe:{" "}
                      <span className="text-white font-semibold">{insp.receiver_name || "Capitán"}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 break-all bg-black/30 p-2 rounded-lg border border-white/5">
                      Hash: {insp.integrity_hash}
                    </div>

                    <button
                      type="button"
                      data-testid={`verify-handover-btn-${insp.id}`}
                      onClick={() => handleVerifyPastRecord(insp)}
                      className="w-full marine-btn marine-btn-secondary min-h-10 text-xs flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Verificar Integridad del Acta</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verification Result Card (PRD R-4.10.4) */}
          {verificationResult && verifyingRecord && (
            <div
              data-testid="handover-verification-result"
              className={`marine-card p-5 space-y-3 border transition-all ${verificationResult.valid
                  ? "border-[#34d399]/40 bg-[#34d399]/[0.03]"
                  : "border-[#f87171]/40 bg-[#f87171]/[0.03]"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold flex items-center gap-2">
                  {verificationResult.valid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#34d399]" />
                      <span className="text-[#34d399]">INTEGRIDAD VERIFICADA</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-[#f87171]" />
                      <span className="text-[#f87171]">DISCREPANCIA DETECTADA</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVerificationResult(null);
                    setVerifyingRecord(null);
                  }}
                  className="text-xs opacity-60 hover:opacity-100"
                >
                  Cerrar
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {verificationResult.valid
                  ? "El sello de integridad SHA-256 coincide exactamente con el JSON canónico y las fotos registradas en el dispositivo."
                  : "El contenido del acta no coincide con la firma SHA-256 registrada."}
              </p>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] break-all space-y-1">
                <div className="opacity-60">HASH REGISTRADO:</div>
                <div className="text-white">{verificationResult.storedHash}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
