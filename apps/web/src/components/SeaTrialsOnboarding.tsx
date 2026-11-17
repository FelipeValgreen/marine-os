"use client";

import React, { useState } from "react";
import {
  Ship,
  QrCode,
  FileCheck2,
  Anchor,
  CheckCircle2,
  Sparkles,
  Award,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { db, DEMO_IDS, enqueueOfflineMutation } from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

export function SeaTrialsOnboarding({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const { theme, pushToast } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [vesselName, setVesselName] = useState("SV Albatros (Oceanis 41.1)");
  const [vesselDraft, setVesselDraft] = useState("2.18");
  const [qrScanned, setQrScanned] = useState(false);
  const [zarpeSimulated, setZarpeSimulated] = useState(false);
  const [anchorWatchArmed, setAnchorWatchArmed] = useState(false);

  const progressPct =
    step === 1
      ? 25
      : step === 2
        ? 50
        : step === 3
          ? 75
          : 100;

  const handleStep1SaveVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDraft = Math.max(0.5, parseFloat(vesselDraft) || 2.18);
    await db.vessels.update(DEMO_IDS.VESSEL_ID, {
      name: vesselName.trim() || "SV Albatros (Oceanis 41.1)",
      draft_meters: parsedDraft,
    });
    await enqueueOfflineMutation({
      table_name: "vessels",
      operation: "UPDATE",
      record_id: DEMO_IDS.VESSEL_ID,
      payload: {
        id: DEMO_IDS.VESSEL_ID,
        name: vesselName.trim() || "SV Albatros (Oceanis 41.1)",
        draft_meters: parsedDraft,
      },
    });
    setStep(2);
  };

  const handleStep2ScanQR = () => {
    setQrScanned(true);
    setTimeout(() => {
      setStep(3);
    }, 650);
  };

  const handleStep3GenerateZarpe = () => {
    setZarpeSimulated(true);
    setTimeout(() => {
      setStep(4);
    }, 650);
  };

  const handleStep4ArmAnchorWatch = () => {
    setAnchorWatchArmed(true);
    setStep(5);
  };

  const handleFinishSeaTrials = async () => {
    const updatedAt = new Date().toISOString();
    await db.user_preferences.put({
      id: "default",
      has_completed_onboarding: true,
      tooltip_gps_seen: false,
      tooltip_zarpe_pdf_seen: false,
      completed_lessons: ["lesson-offline-first"],
      updated_at: updatedAt,
    });
    await enqueueOfflineMutation({
      table_name: "user_preferences",
      operation: "UPSERT",
      record_id: "default",
      payload: {
        id: "default",
        has_completed_onboarding: true,
        updated_at: updatedAt,
      },
    });
    pushToast({
      title: "¡Zarpe Autorizado! Pruebas de Mar Superadas",
      subtitle: "+200 XP Náuticos acreditados en tu Pasaporte Digital",
      tone: "emerald",
    });
    if (onComplete) onComplete();
  };

  return (
    <div
      data-testid="sea-trials-onboarding-modal"
      className={`fixed inset-0 z-[70] w-screen h-screen overflow-y-auto flex items-center justify-center p-4 sm:p-8 select-none ${isNight ? "bg-black text-[#FF0000]" : "bg-[#040B16]/95 backdrop-blur-2xl text-slate-100"
        }`}
    >
      <div className="w-full max-w-xl marine-card p-6 sm:p-8 space-y-6">
        {/* Top Gamified Progress Header (Duolingo Style) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--accent-primary)]">
              <Sparkles className="w-4 h-4" />
              <span>MARINOS • PRUEBAS DE MAR TÁCTICAS</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--status-ok)]/15 text-[var(--status-ok)]">
                +{step * 50} XP
              </span>
              <button
                type="button"
                data-testid="skip-sea-trials-btn"
                onClick={handleFinishSeaTrials}
                className="min-h-14 px-3 rounded-xl bg-white/5 hover:bg-white/10 font-mono text-xs opacity-75 hover:opacity-100"
              >
                Omitir
              </button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${isNight
                ? "bg-[#FF0000]"
                : "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--status-ok)]"
                }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex justify-between font-mono text-[11px] opacity-65">
            <span>
              {step <= 4 ? `Misión ${step} de 4` : "Pruebas de Mar Completadas"}
            </span>
            <span>{progressPct}% Completado</span>
          </div>
        </div>

        {/* STEP 1: Vessel Name & Draft */}
        {step === 1 && (
          <form onSubmit={handleStep1SaveVessel} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <Ship className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  1. Configura tu Gemelo Digital
                </h2>
                <p className="text-xs opacity-75">
                  El calado exacto permite calcular el margen bajo quilla (UKC)
                  en el Seno de Reloncaví y Chiloé.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase opacity-75 mb-1">
                  Nombre de la Embarcación
                </label>
                <input
                  type="text"
                  required
                  value={vesselName}
                  onChange={(e) => setVesselName(e.target.value)}
                  className="w-full min-h-14 px-3.5 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase opacity-75 mb-1">
                  Calado Máximo (Metros)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={vesselDraft}
                  onChange={(e) => setVesselDraft(e.target.value)}
                  className="w-full min-h-14 px-3.5 font-mono text-sm font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="sea-trials-step1-btn"
              className="w-full marine-btn marine-btn-primary text-sm"
            >
              <span>Guardar Gemelo Digital en IndexedDB (+50 XP)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Simulate QR Scan */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  2. Escanea un Nodo QR en Caché Local
                </h2>
                <p className="text-xs opacity-75">
                  Cada sistema crítico a bordo tiene un QR que abre su
                  micro-tutorial en 0ms sin depender de señal celular.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 font-mono text-xs">
                <div className="text-[var(--accent-primary)] font-bold">
                  NODO DETECTADO: yanmar-4jh57
                </div>
                <div className="text-sm font-sans font-semibold">
                  Motor Yanmar 4JH57 (57 HP)
                </div>
                <div className="opacity-70">
                  Ubicación: Bajo escalera salón principal • 2 repuestos
                  vinculados
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[var(--status-ok)]/15 text-[var(--status-ok)] font-mono text-xs font-bold">
                {qrScanned ? "¡ESCANEADO 0ms!" : "LISTO PARA ESCANEAR"}
              </span>
            </div>

            <button
              type="button"
              data-testid="sea-trials-step2-btn"
              onClick={handleStep2ScanQR}
              className="w-full marine-btn marine-btn-primary text-sm"
            >
              <QrCode className="w-4 h-4" />
              <span>Simular Escaneo QR Motor Yanmar (+50 XP)</span>
            </button>
          </div>
        )}

        {/* STEP 3: Simulate Official Zarpe Generation */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  3. Genera un Despacho de Zarpe Digital
                </h2>
                <p className="text-xs opacity-75">
                  Valida automáticamente las atribuciones DIRECTEMAR de la
                  tripulación y compila el PDF con hash SHA-256.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="opacity-70">EMBARCACIÓN:</span>
                <span className="font-bold">{vesselName} (CB-4582)</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">RUTA DE PRUEBA:</span>
                <span>Puerto Montt &rarr; Caleta Mechuque</span>
              </div>
              <div className="flex justify-between text-[var(--status-ok)]">
                <span>ESTADO DE ROL:</span>
                <span>
                  {zarpeSimulated
                    ? "SELLADO SHA-256 OK"
                    : "3 TRIPULANTES VERIFICADOS POR OCR"}
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="sea-trials-step3-btn"
              onClick={handleStep3GenerateZarpe}
              className="w-full marine-btn marine-btn-primary text-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Generar Rol de Zarpe de Prueba (+50 XP)</span>
            </button>
          </div>
        )}

        {/* STEP 4: Arm Anchor Watch */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <Anchor className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  4. Activa el Anchor Watch Pro en el Mapa
                </h2>
                <p className="text-xs opacity-75">
                  Protege tu fondeo nocturno con un perímetro GPS de borneo y
                  sirena acústica automática ante garreo.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[var(--status-ok)] bg-[var(--status-ok)]/10 flex items-center justify-center font-mono text-xs font-bold text-[var(--status-ok)] shrink-0">
                24m
              </div>
              <div className="font-mono text-xs space-y-1 flex-1">
                <div className="font-bold text-[var(--accent-primary)]">
                  CALETA MECHUQUE • FONDO DE ARENA
                </div>
                <div className="opacity-80">
                  Cadena recomendada: 54m (Ratio 5:1) • Radio máximo borneo: 68m
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="sea-trials-step4-btn"
              onClick={handleStep4ArmAnchorWatch}
              className="w-full marine-btn marine-btn-primary text-sm"
            >
              <Anchor className="w-4 h-4" />
              <span>Activar Vigilancia de Fondeo Anchor Watch (+50 XP)</span>
            </button>
          </div>
        )}

        {/* STEP 5: Celebration ("¡Zarpe Autorizado!") */}
        {step === 5 && (
          <div
            data-testid="sea-trials-success-screen"
            className="text-center space-y-5 py-2"
          >
            <div className="w-20 h-20 rounded-3xl bg-[#00E676]/20 border border-[#00E676] text-[#00E676] mx-auto flex items-center justify-center shadow-none">
              <Award className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#00E676] font-bold">
                PRUEBAS DE MAR COMPLETADAS • +200 XP
              </div>
              <h2 className="text-3xl font-bold tracking-tight">
                ¡Zarpe Autorizado!
              </h2>
              <p className="text-xs sm:text-sm opacity-80 max-w-md mx-auto">
                Tu embarcación <strong>{vesselName}</strong> (calado{" "}
                <strong>{vesselDraft}m</strong>), los nodos QR, el generador de
                Zarpe y el radar Anchor Watch están listos para operar en el
                Seno de Reloncaví y Chiloé.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Barco OK</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>QR 0ms OK</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zarpe OK</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span> {anchorWatchArmed ? "Ancla OK" : "Radar OK"}</span>
              </div>
            </div>

            <button
              type="button"
              data-testid="sea-trials-finish-btn"
              onClick={handleFinishSeaTrials}
              className="w-full marine-btn marine-btn-primary text-base font-bold"
            >
              <span>Entrar al Puente de Mando (Bridge)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
