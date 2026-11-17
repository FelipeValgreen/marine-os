"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy,
  Wrench,
  CheckCircle2,
  X,
  SkipForward,
  ShieldCheck,
  Flame,
  Droplet,
  Fuel,
  Users,
  Anchor,
  RotateCcw,
} from "lucide-react";
import { triggerHapticFeedback } from "@/lib/nautical";
import { db } from "@/lib/offline/db";

export type ChecklistCategory = "guest_briefing" | "engineering_check";

interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  title: string;
  subtitle: string;
  criticalPrompt: string;
  system: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHECKLIST_ITEMS: Record<ChecklistCategory, ChecklistItem[]> = {
  guest_briefing: [
    {
      id: "gb-1",
      category: "guest_briefing",
      title: "Chalecos Salvavidas",
      subtitle: "Estiba & Ajuste de Cincha",
      criticalPrompt:
        "Ubica los chalecos en los tambuchos de bañera. Todo tripulante debe ponérselo y ajustar la cincha antes de soltar amarras.",
      system: "SEGURIDAD SOLAS",
      icon: LifeBuoy,
    },
    {
      id: "gb-2",
      category: "guest_briefing",
      title: "Uso del WC Marino Jabsco",
      subtitle: "Prevención de Atascos en Navegación",
      criticalPrompt:
        "Solo depositar papel biodegradable. Prohibido arrojar toallitas húmedas o plástico a las bombas de evacuación.",
      system: "HABITABILIDAD",
      icon: Droplet,
    },
    {
      id: "gb-3",
      category: "guest_briefing",
      title: "Balsa Salvavidas y Radiobaliza EPIRB",
      subtitle: "Zafarrancho de Abandono",
      criticalPrompt:
        "La balsa va en el espejo de popa con zafarrancho hidrostático. La EPIRB está junto a la mesa de cartas.",
      system: "SALVAMENTO",
      icon: ShieldCheck,
    },
    {
      id: "gb-4",
      category: "guest_briefing",
      title: "Hombre al Agua (MOB)",
      subtitle: "Procedimiento de Emergencia Inmediata",
      criticalPrompt:
        "Si alguien cae: gritar '¡Hombre al agua!', pulsar MOB en el plotter y arrojar el aro salvavidas de popa sin perderlo de vista.",
      system: "PROTOCOLO DE RESCATE",
      icon: Users,
    },
    {
      id: "gb-5",
      category: "guest_briefing",
      title: "Regla de Sujeción a Bordo",
      subtitle: "Una Mano para Ti, Una Mano para el Barco",
      criticalPrompt:
        "Con mar formado, mantén siempre 3 puntos de apoyo en cubierta. Desplázate por el pasillo de barlovento.",
      system: "MANIOBRA EN CUBIERTA",
      icon: Anchor,
    },
    {
      id: "gb-6",
      category: "guest_briefing",
      title: "Válvula de Gas y Fuego en Cocina",
      subtitle: "Control de Incendios",
      criticalPrompt:
        "Cerrar la llave de paso de gas tras cada uso. El extintor de 2kg y la manta ignífuga están en la bajada de cabina.",
      system: "PREVENCIÓN DE INCENDIOS",
      icon: Flame,
    },
  ],
  engineering_check: [
    {
      id: "ec-1",
      category: "engineering_check",
      title: "Nivel de Aceite Motor Yanmar",
      subtitle: "Comprobación de Varilla y Textura",
      criticalPrompt:
        "Extrae la varilla de aceite del 4JH57: nivel entre MIN y MAX. Color limpio, sin emulsión blanquecina (sin fuga de agua).",
      system: "MOTOR PROPULSIÓN",
      icon: Wrench,
    },
    {
      id: "ec-2",
      category: "engineering_check",
      title: "Filtro Decantador Racor 30µm",
      subtitle: "Inspección de Agua y Sedimentos",
      criticalPrompt:
        "Inspecciona el tazón de vidrio del filtro Racor. No debe haber gotas de agua decantada ni lodo en el fondo.",
      system: "ALIMENTACIÓN DIÉSEL",
      icon: Fuel,
    },
    {
      id: "ec-3",
      category: "engineering_check",
      title: "Grifo de Fondo de Refrigeración",
      subtitle: "Admisión de Agua de Mar",
      criticalPrompt:
        "Abre la válvula de fondo de agua salada y verifica que la canastilla del filtro no tenga algas ni caracoles.",
      system: "REFRIGERACIÓN",
      icon: Droplet,
    },
    {
      id: "ec-4",
      category: "engineering_check",
      title: "Tensión de Correa Alternador",
      subtitle: "Carga del Banco de Baterías",
      criticalPrompt:
        "Presiona la correa del alternador con el pulgar: deflexión máxima de 10mm. Sin grietas ni deshilachado.",
      system: "ELECTRICIDAD DE A BORDO",
      icon: Wrench,
    },
    {
      id: "ec-5",
      category: "engineering_check",
      title: "Sentina de Máquinas y Bombas",
      subtitle: "Estanqueidad del Casco",
      criticalPrompt:
        "Pozo de sentina seco. Prueba el interruptor manual de la bomba de achique Rule 2000 y el automático de flotador.",
      system: "ACHIQUE Y FLOTABILIDAD",
      icon: Droplet,
    },
    {
      id: "ec-6",
      category: "engineering_check",
      title: "Nivel de Diésel y Banco 12V",
      subtitle: "Autonomía de Máquinas",
      criticalPrompt:
        "Comprueba nivel en tanque de diésel (mínimo 75%) y voltaje de servicio en reposo >12.6V.",
      system: "AUTONOMÍA",
      icon: Fuel,
    },
  ],
};

interface FlashChecklistProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function FlashChecklist({ isOpen, onClose, onComplete }: FlashChecklistProps) {
  const [activeCategory, setActiveCategory] = useState<ChecklistCategory>("guest_briefing");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [direction, setDirection] = useState<"next" | "skip">("next");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentItems = CHECKLIST_ITEMS[activeCategory];
  const total = currentItems.length;
  const currentItem = currentItems[currentIndex];

  const handleNext = async (verified: boolean) => {
    triggerHapticFeedback(verified ? 15 : 25);

    if (verified) {
      setVerifiedIds((prev) => [...prev, currentItem.id]);
      setDirection("next");
    } else {
      setSkippedIds((prev) => [...prev, currentItem.id]);
      setDirection("skip");
    }

    if (currentIndex + 1 < total) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      // Auto-log to offline DB
      try {
        await db.logbook_entries.add({
          id: `checklist-${Date.now()}`,
          voyage_id: "demo-trip-albatros-2026",
          timestamp: new Date().toISOString(),
          lat: -41.685,
          lon: -72.825,
          sog_kn: 0,
          cog_deg: 0,
          wind_kn: 18,
          engine_hours: 1240.5,
          notes: `Flash-Checklist completado: ${
            activeCategory === "guest_briefing"
              ? "Briefing de Invitados"
              : "Checklist de Ingeniería"
          }. ${verified ? verifiedIds.length + 1 : verifiedIds.length}/${total} ítems verificados.`,
          author: "Patrón de Yate",
        });
      } catch {
        // ignore DB write if already closed
      }
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setVerifiedIds([]);
    setSkippedIds([]);
    setIsCompleted(false);
  };

  const switchCategory = (cat: ChecklistCategory) => {
    setActiveCategory(cat);
    setCurrentIndex(0);
    setVerifiedIds([]);
    setSkippedIds([]);
    setIsCompleted(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-xl bg-[#070F1B] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h2 className="font-mono text-sm sm:text-base font-bold text-white tracking-wider uppercase">
              FLASH-CHECKLIST TÁCTICO
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-2 p-2 bg-[#040913] border-b border-white/5 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => switchCategory("guest_briefing")}
            className={`py-2.5 rounded-xl transition ${
              activeCategory === "guest_briefing"
                ? "bg-[#142338] text-cyan-400 border border-cyan-500/30"
                : "text-white/50 hover:text-white"
            }`}
          >
            1. Briefing Invitados ({CHECKLIST_ITEMS.guest_briefing.length})
          </button>
          <button
            type="button"
            onClick={() => switchCategory("engineering_check")}
            className={`py-2.5 rounded-xl transition ${
              activeCategory === "engineering_check"
                ? "bg-[#142338] text-amber-400 border border-amber-500/30"
                : "text-white/50 hover:text-white"
            }`}
          >
            2. Ingeniería de Máquinas ({CHECKLIST_ITEMS.engineering_check.length})
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/5 h-1.5">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{
              width: `${((currentIndex + (isCompleted ? 1 : 0)) / total) * 100}%`,
            }}
          />
        </div>

        {/* Card Content Area */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center min-h-[380px] sm:min-h-[420px]">
          <AnimatePresence mode="wait">
            {!isCompleted && currentItem ? (
              <motion.div
                key={currentItem.id}
                initial={{
                  opacity: 0,
                  x: direction === "next" ? 60 : -60,
                  scale: 0.96,
                }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x: direction === "next" ? -60 : 60,
                  scale: 0.96,
                }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="flex flex-col justify-between h-full space-y-6"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-white/50 mb-3">
                    <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 uppercase tracking-widest text-[#00E5FF] font-semibold">
                      {currentItem.system}
                    </span>
                    <span className="font-bold text-white">
                      ÍTEM {currentIndex + 1} DE {total}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-2">
                    {currentItem.title}
                  </h3>
                  <div className="text-xs sm:text-sm font-mono text-white/60 mb-6">
                    {currentItem.subtitle}
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                    <p className="text-base sm:text-lg text-white font-medium leading-relaxed">
                      &ldquo;{currentItem.criticalPrompt}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Gesture hint */}
                <div className="text-center font-mono text-[11px] text-white/40 tracking-wider">
                  TOCA LOS BOTONES INFERIORES O DESLIZA PARA CONTINUAR
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-6 py-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-white mb-2">
                    ¡Checklist Completado!
                  </h3>
                  <p className="text-sm font-mono text-white/70 max-w-sm">
                    Verificados: {verifiedIds.length} • Omitidos: {skippedIds.length}
                  </p>
                  <p className="text-xs font-mono text-emerald-400 mt-2">
                    ✓ Registrado automáticamente en la bitácora de a bordo
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full max-w-sm pt-4">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="flex-1 min-h-[52px] rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-mono text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    REINICIAR
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onComplete) onComplete();
                    }}
                    className="flex-1 min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-black flex items-center justify-center gap-2 shadow-lg"
                  >
                    CERRAR
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* GIANT CONTROLS FOR WET FINGERS */}
        {!isCompleted && (
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-5 bg-[#040913] border-t border-white/5">
            {/* OMITIR BUTTON (Dark Matte Grey) */}
            <button
              type="button"
              data-testid="flash-checklist-skip-btn"
              onClick={() => handleNext(false)}
              className="min-h-[64px] sm:min-h-[72px] px-4 rounded-2xl bg-[#182232] hover:bg-[#202C3F] active:scale-[0.98] border border-white/10 flex items-center justify-center gap-2 font-mono text-sm sm:text-base font-bold text-white/80 transition shadow-lg"
            >
              <SkipForward className="w-5 h-5 text-white/50" />
              <span>OMITIR</span>
            </button>

            {/* VERIFICADO BUTTON (Matte Tactical Emerald) */}
            <button
              type="button"
              data-testid="flash-checklist-verify-btn"
              onClick={() => handleNext(true)}
              className="min-h-[64px] sm:min-h-[72px] px-4 rounded-2xl bg-[#059669] hover:bg-[#10B981] active:scale-[0.98] border border-emerald-400/40 flex items-center justify-center gap-2 font-mono text-sm sm:text-base font-black text-white transition shadow-lg"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>VERIFICADO ✓</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
