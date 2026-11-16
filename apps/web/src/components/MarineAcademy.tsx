"use client";

import React, { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LifeBuoy,
  Play,
  CheckCircle2,
  Send,
  Sparkles,
  Compass,
  WifiOff,
  Anchor,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { db, enqueueOfflineMutation } from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

interface MicroLesson {
  id: string;
  title: string;
  duration: string;
  category: string;
  summary: string;
  steps: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const MICRO_LESSONS: MicroLesson[] = [
  {
    id: "lesson-import-gpx",
    title: "Cómo importar una ruta .GPX a la carta náutica",
    duration: "0:45s",
    category: "Cartografía & Navegación",
    summary:
      "Importa tracks y rutas desde Navionics, OpenCPN u Orca directamente sobre la carta vectorial MapLibre.",
    steps: [
      "1. En la vista Bridge, abre el panel lateral 'Fondeo & Clima'.",
      "2. Toca el botón 'Cargar .GPX' en la esquina inferior derecha.",
      "3. Selecciona tu archivo .gpx: los waypoints y la derrota en color #00E5FF se trazan al instante.",
    ],
    icon: Compass,
  },
  {
    id: "lesson-offline-first",
    title: "Cómo funciona el modo Offline (IndexedDB + sync_queue)",
    duration: "0:50s",
    category: "Arquitectura Local-First",
    summary:
      "Navega en canales patagónicos sin señal celular manteniendo 100% operativos los check-ins, bitácora y cartas.",
    steps: [
      "1. Toda escritura se guarda primero en IndexedDB mediante Dexie.js.",
      "2. Las mutaciones quedan encoladas en 'sync_queue' y las cartas se sirven desde el Service Worker Cache-First.",
      "3. Al recuperar conexión en puerto, Edge-Sync reconcilia automáticamente los datos con Supabase y FastAPI.",
    ],
    icon: WifiOff,
  },
  {
    id: "lesson-anchor-watch",
    title: "Cómo configurar el Anchor Watch Pro y la sirena de garreo",
    duration: "0:40s",
    category: "Seguridad en Fondeo",
    summary:
      "Calcula los metros exactos de cadena según la amplitud de marea y vigila el radio de borneo por GPS.",
    steps: [
      "1. Selecciona tu caleta en el Smart Anchorage Matcher para consultar viento y ola real de Open-Meteo.",
      "2. Revisa la cadena recomendada (profundidad + marea + francobordo × ratio 5:1 o 7:1).",
      "3. Mantén activa la Sirena Sonora para recibir alerta acústica inmediata si el barco supera el radio máximo.",
    ],
    icon: Anchor,
  },
  {
    id: "lesson-expenses-ocr",
    title: "Cómo agregar y dividir gastos de travesía con OCR",
    duration: "0:35s",
    category: "Finanzas de Tripulación",
    summary:
      "Escanea boletas de diésel o supermercado y divide automáticamente el costo por tripulante.",
    steps: [
      "1. Abre la sección 'Pasaporte Náutico & Bitácora' desde el rail lateral.",
      "2. En la tarjeta 'Gastos de Travesía & OCR Boletas', toca 'OCR Boleta Diésel' o 'OCR Víveres'.",
      "3. El monto en USD/CLP se extrae automáticamente y actualiza la cuota por persona.",
    ],
    icon: Receipt,
  },
];

export function MarineAcademy({
  onRelaunchSeaTrials,
}: {
  onRelaunchSeaTrials?: () => void;
}) {
  const { isOffline, pushToast } = useMarineContext();
  const prefs = useLiveQuery(() => db.user_preferences.get("default"), []);

  const [activeLesson, setActiveLesson] = useState<MicroLesson>(
    MICRO_LESSONS[0]
  );
  const [supportQuestion, setSupportQuestion] = useState<string>(
    "¿Cómo agrego un gasto con OCR y cómo se divide entre la tripulación?"
  );
  const [supportAnswer, setSupportAnswer] = useState<string>(
    "¿CÓMO AGREGAR UN GASTO CON OCR EN MARINE OS?\n1. Ve a la sección 'Pasaporte Náutico & Bitácora' (ícono de libro en el rail izquierdo).\n2. En la tarjeta 'Gastos de Travesía & OCR Boletas', pulsa 'OCR Boleta Diésel' o 'OCR Víveres'.\n3. El sistema extrae automáticamente el monto en CLP/USD, número de boleta y divide el total equitativamente entre los tripulantes inscritos, guardándolo primero en IndexedDB."
  );
  const [supportLoading, setSupportLoading] = useState<boolean>(false);

  const completedIds = prefs?.completed_lessons || ["lesson-offline-first"];

  const handleMarkLessonCompleted = async (lessonId: string) => {
    const nextList = Array.from(new Set([...completedIds, lessonId]));
    const updatedAt = new Date().toISOString();
    await db.user_preferences.update("default", {
      completed_lessons: nextList,
      updated_at: updatedAt,
    });
    await enqueueOfflineMutation({
      table_name: "user_preferences",
      operation: "UPDATE",
      record_id: "default",
      payload: {
        id: "default",
        completed_lessons: nextList,
        updated_at: updatedAt,
      },
    });
    pushToast({
      title: "Micro-Clase Completada (+25 XP)",
      subtitle: "Progreso guardado en tu Pasaporte Náutico",
      tone: "emerald",
    });
  };

  const handleAskSupportAI = async (customQuery?: string) => {
    const qText = customQuery ?? supportQuestion;
    if (!qText.trim()) return;

    const API_URL = getApiBaseUrl();
    setSupportLoading(true);
    try {
      if (!isOffline) {
        const res = await fetch(`${API_URL}/api/v1/bosun/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: qText,
            mode: "app_support",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSupportAnswer(data.answer);
          setSupportLoading(false);
          return;
        }
      }
    } catch {
      // Offline fallback below
    }

    const q = qText.toLowerCase();
    if (q.includes("gpx") || q.includes("ruta") || q.includes("mapa")) {
      setSupportAnswer(
        "¿CÓMO IMPORTAR UNA RUTA .GPX A LA CARTA NÁUTICA?\n1. En la vista Bridge, abre el panel derecho 'Fondeo & Clima'.\n2. En el pie del panel, toca el botón 'Cargar .GPX' y selecciona tu archivo .gpx.\n3. Marine OS traza instantáneamente los waypoints en color Phosphor Cyan (#00E5FF)."
      );
    } else if (q.includes("offline") || q.includes("internet")) {
      setSupportAnswer(
        "¿CÓMO FUNCIONA EL MODO OFFLINE EN ALTA MAR?\n1. Toda operación se guarda primero en IndexedDB (Dexie.js).\n2. Cada cambio se encola en sync_queue y el Service Worker mantiene las cartas en caché.\n3. Al recuperar señal, sincroniza automáticamente con FastAPI."
      );
    } else if (q.includes("zarpe") || q.includes("pdf")) {
      setSupportAnswer(
        "¿CÓMO GENERAR EL ZARPE OFICIAL?\n1. Entra a Voyages & Zarpe en el rail lateral.\n2. Escanea los documentos con OCR y pulsa 'Descargar PDF de Zarpe Oficial'."
      );
    } else {
      setSupportAnswer(
        "¿CÓMO AGREGAR UN GASTO CON OCR EN MARINE OS?\n1. Ve a 'Pasaporte Náutico & Bitácora'.\n2. En 'Gastos de Travesía & OCR Boletas', pulsa 'OCR Boleta Diésel' o 'OCR Víveres'.\n3. El gasto se guarda en IndexedDB y se divide entre toda la tripulación."
      );
    }
    setSupportLoading(false);
  };

  return (
    <div data-testid="marine-academy-hub" className="space-y-6">
      {/* Top Banner */}
      <div className="marine-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-primary)]">
              MARINE ACADEMY &amp; SUPPORT HUB 🛟
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
              Centro de Entrenamiento Táctico &amp; Soporte IA
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs px-3 py-1.5 rounded-full bg-[#00E676]/15 text-[#00E676] font-semibold">
            {completedIds.length} / {MICRO_LESSONS.length} Micro-Clases
            Completadas
          </span>
          {onRelaunchSeaTrials && (
            <button
              type="button"
              data-testid="relaunch-sea-trials-btn"
              onClick={onRelaunchSeaTrials}
              className="marine-btn marine-btn-secondary text-xs"
            >
              <RotateCcw className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Repetir Pruebas de Mar (Onboarding)</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PART A: Grilla de "Micro-Clases" (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="marine-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Play className="w-5 h-5 text-[var(--accent-primary)]" />
                <span>A. Grilla de Micro-Clases Interactivas</span>
              </h2>
              <span className="font-mono text-xs opacity-70">
                100% Disponibles Offline
              </span>
            </div>

            {/* Horizontal Micro-Class Cards */}
            <div className="space-y-3">
              {MICRO_LESSONS.map((lesson) => {
                const Icon = lesson.icon;
                const isSelected = activeLesson.id === lesson.id;
                const isDone = completedIds.includes(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isSelected
                      ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/50"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                      }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0 mt-0.5">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/10">
                            {lesson.category}
                          </span>
                          <span className="font-mono text-xs text-[var(--accent-primary)]">
                            {lesson.duration}
                          </span>
                          {isDone && (
                            <span className="font-mono text-[10px] text-[#00E676] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              COMPLETADA
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base mt-1">
                          {lesson.title}
                        </h3>
                        <p className="text-xs opacity-75 mt-0.5">
                          {lesson.summary}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveLesson(lesson)}
                      className={`marine-btn text-xs px-4 shrink-0 ${isSelected
                        ? "marine-btn-primary"
                        : "marine-btn-secondary"
                        }`}
                    >
                      <Play className="w-4 h-4" />
                      <span>Ver Clase</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Simulated Interactive Micro-Video Walkthrough Viewer */}
            <div className="p-5 rounded-2xl bg-[#040B16] border border-white/15 space-y-3 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs text-[var(--accent-primary)]">
                <span>REPRODUCTOR MICRO-CLASE: {activeLesson.title}</span>
                <span>DURACIÓN: {activeLesson.duration}</span>
              </div>

              <div className="space-y-2 text-xs">
                {activeLesson.steps.map((st, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/10"
                  >
                    {st}
                  </div>
                ))}
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleMarkLessonCompleted(activeLesson.id)}
                  className="marine-btn marine-btn-primary text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Marcar Micro-Clase como Completada (+25 XP)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PART B: Chat de Soporte IA (Cómo usar la App) (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="marine-card p-6 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-primary)]">
                PARTE B • SOPORTE INTERACTIVO MARINE COPILOT
              </div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mt-0.5">
                <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
                <span>Chat de Soporte IA (Cómo usar Marine OS)</span>
              </h2>
              <p className="text-xs opacity-75 mt-1">
                Pre-configurado para resolver dudas paso a paso sobre cada
                módulo de la aplicación.
              </p>
            </div>

            {/* Quick Support Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const q = "¿Cómo agrego un gasto con OCR?";
                  setSupportQuestion(q);
                  handleAskSupportAI(q);
                }}
                className="marine-btn marine-btn-secondary text-xs px-3"
              >
                <span>¿Cómo agrego un gasto?</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = "¿Cómo importo una ruta GPX al mapa?";
                  setSupportQuestion(q);
                  handleAskSupportAI(q);
                }}
                className="marine-btn marine-btn-secondary text-xs px-3"
              >
                <span>¿Cómo importo un GPX?</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = "¿Cómo funciona el modo Offline en alta mar?";
                  setSupportQuestion(q);
                  handleAskSupportAI(q);
                }}
                className="marine-btn marine-btn-secondary text-xs px-3"
              >
                <span>¿Cómo funciona Offline?</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = "¿Cómo genero el PDF de Zarpe Oficial?";
                  setSupportQuestion(q);
                  handleAskSupportAI(q);
                }}
                className="marine-btn marine-btn-secondary text-xs px-3"
              >
                <span>¿Cómo genero el Zarpe?</span>
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={supportQuestion}
                onChange={(e) => setSupportQuestion(e.target.value)}
                className="flex-1 min-w-0 min-h-14 px-3.5 text-sm"
                placeholder="Ej. ¿Cómo agrego un gasto o activo el modo noche?"
              />
              <button
                type="button"
                data-testid="academy-support-send-btn"
                onClick={() => handleAskSupportAI()}
                disabled={supportLoading}
                className="marine-btn marine-btn-primary text-xs w-full sm:w-auto shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{supportLoading ? "Buscando..." : "Preguntar"}</span>
              </button>
            </div>

            <div
              data-testid="academy-support-answer"
              className="min-h-[168px] p-4 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs sm:text-sm whitespace-pre-line leading-relaxed"
            >
              {supportLoading ? (
                <div className="space-y-2.5 py-2">
                  <div className="h-4 w-3/4 marine-skeleton" />
                  <div className="h-4 w-full marine-skeleton" />
                  <div className="h-4 w-5/6 marine-skeleton" />
                </div>
              ) : (
                supportAnswer
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
