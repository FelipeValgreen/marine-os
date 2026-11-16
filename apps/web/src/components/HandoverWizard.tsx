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
  WifiOff,
  Check,
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

const INITIAL_CHECKLIST: HandoverChecklistItem[] = [
  {
    id: "chk-yanmar",
    system_name: "Motor Yanmar 4JH57 (Nivel Aceite, Refrigerante y Grifo Fondo)",
    category: "engine",
    status: "ok",
    notes: "1420.5 hrs • Sin fugas en sentina, grifo abierto.",
  },
  {
    id: "chk-jabsco",
    system_name: "Baño Marino Jabsco Popa (Bomba Manual y Válvulas)",
    category: "plumbing_wc",
    status: "ok",
    notes: "Flujo correcto, sin obstrucciones.",
  },
  {
    id: "chk-windlass",
    system_name: "Molinete Quick 1000W + 60m Cadena Calibrada 10mm + Boza",
    category: "anchoring",
    status: "ok",
    notes: "Térmico 80A operativo, marcas de cadena cada 10m visibles.",
  },
  {
    id: "chk-solas",
    system_name: "Pirotecnia Kit Bengalas SOLAS (Venc. 2027-08-15) + 8 Chalecos 150N",
    category: "safety",
    status: "ok",
    notes: "Sellos intactos y vigentes.",
  },
  {
    id: "chk-rigging",
    system_name: "Jarcia Firme, Mayor Full-Batten y Génova Enrollable",
    category: "rigging",
    status: "ok",
    notes: "Obenques y pasadores revisados.",
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
  const [inspectionType, setInspectionType] = useState<"checkin" | "checkout">(
    "checkin"
  );
  const [checklist, setChecklist] =
    useState<HandoverChecklistItem[]>(INITIAL_CHECKLIST);
  const [photos, setPhotos] = useState<HandoverPhotoEvidence[]>([]);
  const [hasSigned, setHasSigned] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [showStampOverlay, setShowStampOverlay] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

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

  const handleGenerateCompressedEvidencePhoto = (label: string) => {
    const offscreen = document.createElement("canvas");
    offscreen.width = 480;
    offscreen.height = 280;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const timestamp = new Date().toISOString();
    ctx.fillStyle = "#040B16";
    ctx.fillRect(0, 0, 480, 280);

    ctx.strokeStyle = isNight ? "#FF1E1E" : "#00E5FF";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 460, 260);

    ctx.fillStyle = isNight ? "#FF1E1E" : "#00E5FF";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`EVIDENCIA BORDO: ${label}`, 24, 48);

    ctx.fillStyle = isNight ? "#FF1E1E" : "#E9FEFF";
    ctx.font = "13px monospace";
    ctx.fillText(`BARCO: ${vessel?.name || "SV Albatros (CB-4582)"}`, 24, 86);
    ctx.fillText(`INSPECTOR: ${activeAccount.name}`, 24, 114);
    ctx.fillText(
      `HOROMETRO MOTOR: ${vessel?.engine_hours_current || 1420.5} HRS`,
      24,
      142
    );
    ctx.fillText(`TIMESTAMP UTC: ${timestamp}`, 24, 170);
    ctx.fillText(`POS: 41° 28.302' S, 072° 56.214' W (Reloncavi)`, 24, 198);
    ctx.fillText(`COMPRESION CLIENTE JPEG 72% OK`, 24, 232);

    const compressedDataUrl = offscreen.toDataURL("image/jpeg", 0.72);
    const newPhoto: HandoverPhotoEvidence = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      data_url: compressedDataUrl,
      captured_at: timestamp,
    };
    setPhotos((prev) => [...prev, newPhoto]);
    setWizardStep(2);
    pushToast({
      title: `Evidencia Capturada: ${label}`,
      subtitle: "Imagen comprimida en cliente con sello UTC",
      tone: "cyan",
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement("canvas");
        const scale = Math.min(1, 640 / img.width);
        offscreen.width = Math.round(img.width * scale);
        offscreen.height = Math.round(img.height * scale);
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
          const compressed = offscreen.toDataURL("image/jpeg", 0.7);
          setPhotos((prev) => [
            ...prev,
            {
              id: `photo-${Date.now()}`,
              label: file.name,
              data_url: compressed,
              captured_at: new Date().toISOString(),
            },
          ]);
        }
      };
      if (typeof reader.result === "string") {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;
    ctx.strokeStyle = isNight ? "#FF1E1E" : "#00E5FF";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setHasSigned(true);
  };

  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const applyQuickTactileSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = isNight ? "#FF1E1E" : "#00E5FF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(28, 82);
        ctx.bezierCurveTo(95, 18, 155, 112, 225, 42);
        ctx.bezierCurveTo(265, 22, 315, 92, 392, 52);
        ctx.stroke();

        ctx.fillStyle = isNight ? "#FF1E1E" : "#00E5FF";
        ctx.font = "bold 12px monospace";
        ctx.fillText(
          `FIRMADO: ${activeAccount.name.toUpperCase()} (${
            activeAccount.documentNumber
          })`,
          24,
          114
        );
      }
    }
    setHasSigned(true);
    setWizardStep(3);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSigned(false);
  };

  const handleCompleteHandoverOffline = async () => {
    let activePhotos = photos;
    if (activePhotos.length === 0) {
      const autoTimestamp = new Date().toISOString();
      activePhotos = [
        {
          id: `photo-${Date.now()}`,
          label: "Sentina & Motor Yanmar 4JH57",
          data_url:
            "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          captured_at: autoTimestamp,
        },
      ];
      setPhotos(activePhotos);
    }

    if (!hasSigned) {
      applyQuickTactileSignature();
    }

    const completedAt = new Date().toISOString();
    const signatureData =
      canvasRef.current?.toDataURL("image/png") || `signed-${activeAccount.id}`;

    const canonicalString = JSON.stringify({
      vesselId,
      inspector: activeAccount.name,
      inspectionType,
      checklist,
      photoCount: activePhotos.length,
      completedAt,
    });
    const sha256Hash = await computeSHA256Hex(canonicalString);

    const recordId = `handover-${Date.now()}`;
    const record: HandoverInspectionRecord = {
      id: recordId,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      vessel_id: vesselId,
      inspection_type: inspectionType,
      checklist_data: checklist,
      photos_evidence: activePhotos,
      signature_svg: signatureData,
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
        completed_offline_at: record.completed_offline_at,
      },
    });

    await db.voyages.update(DEMO_IDS.VOYAGE_ID, {
      status: inspectionType === "checkin" ? "active" : "completed",
    });

    setLastHash(sha256Hash);
    setShowStampOverlay(true);
    setSavedNotice(
      `Acta ${inspectionType.toUpperCase()} sellada por ${
        activeAccount.name
      } en IndexedDB + sync_queue.`
    );
    setWizardStep(4);
    pushToast({
      title: `Acta ${inspectionType.toUpperCase()} Sellada (SHA-256)`,
      subtitle: `Hash: ${sha256Hash.slice(0, 24)}...`,
      tone: "emerald",
    });
  };

  return (
    <div className="space-y-6">
      <CryptoStampOverlay
        visible={showStampOverlay && lastHash !== null}
        title={`ACTA ${inspectionType.toUpperCase()} SELLADA`}
        subtitle={`Inspector: ${activeAccount.name} • ${
          vessel?.name || "SV Albatros (CB-4582)"
        }`}
        sha256Hash={lastHash || ""}
        tokenBadge="HANDOVER SHA-256"
        onDismiss={() => setShowStampOverlay(false)}
      />
      <div className="marine-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-primary)]">
              WIZARD MÓVIL PASO A PASO • DIGITAL HANDOVER OFFLINE-FIRST
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">
              Check-In / Check-Out: {vessel?.name || "SV Albatros (Oceanis 41.1)"}
            </h1>
            <p className="text-xs font-mono opacity-75 mt-1">
              Inspector: {activeAccount.name} • Horómetro:{" "}
              {vessel?.engine_hours_current || 1420.5} hrs •{" "}
              {isOffline ? "MODO OFFLINE (IndexedDB)" : "ONLINE EDGE-SYNC"}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInspectionType("checkin")}
              className={`marine-btn text-xs ${
                inspectionType === "checkin"
                  ? "marine-btn-primary"
                  : "marine-btn-secondary"
              }`}
            >
              <span>CHECK-IN (ENTREGA)</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectionType("checkout")}
              className={`marine-btn text-xs ${
                inspectionType === "checkout"
                  ? "marine-btn-primary"
                  : "marine-btn-secondary"
              }`}
            >
              <span>CHECK-OUT (RECEPCIÓN)</span>
            </button>
          </div>
        </div>

        {/* 4-Step Progress Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            { step: 1, title: "01 • Sistemas" },
            { step: 2, title: "02 • Cámara" },
            { step: 3, title: "03 • Firma Táctil" },
            { step: 4, title: "04 • Sello SHA-256" },
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setWizardStep(s.step as 1 | 2 | 3 | 4)}
              className={`min-h-14 px-3.5 py-2 rounded-xl font-mono text-xs font-semibold flex items-center justify-between transition ${
                wizardStep === s.step
                  ? "marine-btn-primary"
                  : "marine-btn-secondary"
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
            className="p-4 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 font-mono text-xs space-y-1 text-[#00E676]"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 marine-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" />
              <span>Checklist Técnico de Sistemas ({checklist.length})</span>
            </h2>
          </div>

          <div className="space-y-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{item.system_name}</div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, "ok")}
                      className={`min-h-14 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                        item.status === "ok"
                          ? "marine-btn-primary"
                          : "marine-btn-secondary"
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>OK</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, "observation")}
                      className={`min-h-14 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                        item.status === "observation"
                          ? "marine-btn-primary"
                          : "marine-btn-secondary"
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>OBS</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => handleNotesChange(item.id, e.target.value)}
                  className="w-full min-h-14 px-3.5 text-xs font-mono"
                  placeholder="Observaciones de estado o lectura..."
                />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="marine-card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-white/10 pb-3">
              <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
              <span>Evidencia de Cámara ({photos.length})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="capture-engine-photo-btn"
                onClick={() =>
                  handleGenerateCompressedEvidencePhoto("Sentina & Yanmar 4JH57")
                }
                className="marine-btn marine-btn-secondary text-xs"
              >
                <Camera className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span>Capturar Sentina / Motor</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGenerateCompressedEvidencePhoto(
                    "Horómetro & Cuadro Eléctrico"
                  )
                }
                className="marine-btn marine-btn-secondary text-xs"
              >
                <Camera className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span>Capturar Horómetro</span>
              </button>
            </div>

            <div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="w-full text-xs font-mono p-2.5"
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-[11px] font-mono"
                  >
                    <img
                      src={p.data_url}
                      alt={p.label}
                      className="w-full h-24 object-cover rounded-lg mb-1.5"
                    />
                    <div className="truncate font-semibold">{p.label}</div>
                    <div className="opacity-60">
                      {p.captured_at.slice(11, 19)} UTC
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="marine-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-[var(--accent-primary)]" />
                <span>Firma Táctil & Sello SHA-256</span>
              </h2>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  data-testid="quick-sign-btn"
                  onClick={applyQuickTactileSignature}
                  className="marine-btn marine-btn-secondary text-xs px-3"
                >
                  <span>Firmar ({activeAccount.avatarInitials})</span>
                </button>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="marine-btn marine-btn-secondary text-xs px-3"
                  aria-label="Limpiar firma"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/15 bg-[#040B16]">
              <canvas
                ref={canvasRef}
                width={420}
                height={130}
                onPointerDown={startDrawing}
                onPointerMove={drawMove}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="w-full h-[130px] touch-none cursor-crosshair"
              />
            </div>

            <button
              type="button"
              data-testid="complete-handover-btn"
              onClick={handleCompleteHandoverOffline}
              className="w-full marine-btn marine-btn-primary text-sm"
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>
                Sellar Acta {inspectionType.toUpperCase()} con SHA-256 (IndexedDB)
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="marine-card p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>
            Historial de Actas Criptográficas en IndexedDB ({pastInspections.length})
          </span>
        </h3>
        {pastInspections.length === 0 ? (
          <p className="text-xs font-mono opacity-60">
            Completa el wizard para sellar tu primera acta con hash SHA-256.
          </p>
        ) : (
          <div className="space-y-2">
            {pastInspections.map((insp) => (
              <div
                key={insp.id}
                className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
              >
                <div>
                  <span className="font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] mr-2">
                    {insp.inspection_type}
                  </span>
                  <span className="opacity-75">{insp.completed_offline_at}</span>
                  <div className="mt-1 break-all text-[11px] opacity-80">
                    SHA-256: {insp.integrity_hash}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    Fotos: {insp.photos_evidence.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#00E676]/15 text-[#00E676]">
                    {insp.synced_at ? "SINCRONIZADO" : "EN SYNC_QUEUE"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
