"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Compass,
  Ship,
  Wrench,
  FileCheck2,
  ShieldCheck,
  BookOpen,
  LifeBuoy,
  Receipt,
  Mic,
  Eye,
  Sun,
  Moon,
  AlertOctagon,
  CornerDownLeft,
  X,
  PlusCircle,
  Users,
  Sliders,
  Anchor,
} from "lucide-react";
import { db, DEMO_IDS, enqueueOfflineMutation } from "@/lib/offline/db";
import { triggerHapticFeedback, formatNauticalCoordsDMS } from "@/lib/nautical";
import type {
  MarineSection,
  MarineTheme,
  ToastNotification,
} from "@/components/ThemeProvider";

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateSection: (
    section: MarineSection,
    subTarget?: "digital_twin" | "damage_control"
  ) => void;
  onSetTheme: (theme: MarineTheme) => void;
  onOpenSOS: () => void;
  activeAuthorName: string;
  pushToast: (toast: Omit<ToastNotification, "id">) => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: "NAVEGACIÓN" | "ACCIONES DIRECTAS" | "ERGONOMÍA & SOS";
  keywords: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void | Promise<void>;
}

export function CommandCenter({
  isOpen,
  onClose,
  onNavigateSection,
  onSetTheme,
  onOpenSOS,
  activeAuthorName,
  pushToast,
}: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quickExpenseMode, setQuickExpenseMode] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState(
    "Aprovisionamiento / Combustible Muelle"
  );
  const [expenseUsd, setExpenseUsd] = useState("145");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setQuickExpenseMode(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    }
  }, [isOpen]);

  const handleSaveQuickExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const usd = Math.max(1, Number(expenseUsd) || 145);
    const clp = Math.round(usd * 950);
    const id = `exp-cmd-${Date.now()}`;
    const record = {
      id,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      title: expenseTitle.trim() || "Gasto Operativo Registrado (Cmd+K)",
      category: "fuel" as const,
      amount_usd: usd,
      amount_clp: clp,
      paid_by: activeAuthorName,
      receipt_number: `CMD-${String(Date.now()).slice(-6)}`,
      ocr_verified: true,
      created_at: new Date().toISOString(),
    };
    await db.expenses.put(record);
    await enqueueOfflineMutation({
      table_name: "expenses",
      operation: "INSERT",
      record_id: id,
      payload: record,
    });
    triggerHapticFeedback([15, 30, 15]);
    pushToast({
      title: `Gasto Registrado: ${record.title}`,
      subtitle: `USD $${usd} ($${clp.toLocaleString("es-CL")} CLP) guardado en el teléfono`,
      tone: "emerald",
    });
    onNavigateSection("logbook");
    onClose();
  };

  const handleQuickVoiceLogbookFromCommand = async () => {
    const vessel = await db.vessels.get(DEMO_IDS.VESSEL_ID);
    const horometer = vessel?.engine_hours_current || 1420.5;
    const lat = -41.4717;
    const lon = -72.9369;
    const dms = formatNauticalCoordsDMS(lat, lon);
    const id = `log-cmd-voice-${Date.now()}`;
    const entry = {
      id,
      voyage_id: DEMO_IDS.VOYAGE_ID,
      timestamp: new Date().toISOString(),
      lat,
      lon,
      sog_kn: 6.8,
      cog_deg: 194,
      wind_kn: 14.2,
      engine_hours: horometer,
      notes: `[VOZ CMD+K] Cruzando Canal Tenglo sin novedad • POS ${dms.combined} • Horómetro ${horometer}h`,
      author: activeAuthorName,
    };
    await db.logbook_entries.put(entry);
    await enqueueOfflineMutation({
      table_name: "logbook_entries",
      operation: "INSERT",
      record_id: id,
      payload: entry,
    });
    triggerHapticFeedback([20, 40, 20]);
    pushToast({
      title: "Bitácora por Voz Guardada (Cmd+K)",
      subtitle: `${dms.combined} • Motor ${horometer}h`,
      tone: "emerald",
    });
    onNavigateSection("logbook");
    onClose();
  };

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "cmd-motor",
        title: "Ir a motor (Gemelo Digital Yanmar 4JH57)",
        subtitle: "Telemetría Signal K RPM, refrigerante, presión de aceite y QRs",
        category: "NAVEGACIÓN",
        keywords: "ir a motor yanmar rpm temperatura presion aceite vessel barco",
        shortcut: "G M",
        icon: Ship,
        action: () => {
          onNavigateSection("vessel", "digital_twin");
          onClose();
        },
      },
      {
        id: "cmd-expense",
        title: "Registrar gasto de travesía (1-Toque / Inline)",
        subtitle: "Añadir combustible, víveres o recalada en el dispositivo",
        category: "ACCIONES DIRECTAS",
        keywords: "registrar gasto boleta diesel viveres factura dinero usd clp",
        shortcut: "C E",
        icon: Receipt,
        action: () => {
          setQuickExpenseMode(true);
        },
      },
      {
        id: "cmd-damage",
        title: "Diagnóstico de Averías y Emergencias",
        subtitle: "Árbol de decisión: Pérdida de RPM, Vía de Agua y Repuestos",
        category: "NAVEGACIÓN",
        keywords: "averias emergencias falla motor perdida rpm via de agua sentina",
        shortcut: "G D",
        icon: Wrench,
        action: () => {
          onNavigateSection("vessel", "damage_control");
          onClose();
        },
      },
      {
        id: "cmd-bridge",
        title: "Ir a Puente (Carta Náutica y HUD)",
        subtitle: "Carta náutica, Vigía de fondeo y Clima",
        category: "NAVEGACIÓN",
        keywords: "puente carta mapa gps fondeo clima radar hud",
        shortcut: "G B",
        icon: Compass,
        action: () => {
          onNavigateSection("bridge");
          onClose();
        },
      },
      {
        id: "cmd-voice-log",
        title: "Registrar entrada en Bitácora por Voz (Manos libres)",
        subtitle: "Captura audio + GPS + horómetro en bitácora de a bordo",
        category: "ACCIONES DIRECTAS",
        keywords: "bitacora voz microfono dictar logbook guardia",
        shortcut: "V L",
        icon: Mic,
        action: handleQuickVoiceLogbookFromCommand,
      },
      {
        id: "cmd-zarpe",
        title: "Ir a Viajes y Zarpes",
        subtitle: "Escáner OCR de tripulación y borrador de zarpe",
        category: "NAVEGACIÓN",
        keywords: "zarpe viajes tripulacion ocr pdf qr",
        shortcut: "G Z",
        icon: FileCheck2,
        action: () => {
          onNavigateSection("voyages");
          onClose();
        },
      },
      {
        id: "cmd-fleet",
        title: "Configurar mi Velero (Fleet & Vessel Manager)",
        subtitle: "Administrar barcos, cambiar nave activa, calados y horómetro",
        category: "NAVEGACIÓN",
        keywords: "configurar mi velero flota fleet barcos veleros embarcaciones eslora manga calado horometro",
        shortcut: "G F",
        icon: Anchor,
        action: () => {
          onNavigateSection("fleet");
          onClose();
        },
      },
      {
        id: "cmd-crew",
        title: "Libreta de Tripulación Frecuente (Crew Directory)",
        subtitle: "Directorio de tripulantes, semáforo de licencias e inyección rápida",
        category: "NAVEGACIÓN",
        keywords: "tripulacion tripulantes crew libreta directorio rut licencias",
        shortcut: "G C",
        icon: Users,
        action: () => {
          onNavigateSection("crew");
          onClose();
        },
      },
      {
        id: "cmd-integrations",
        title: "Integration Hub (NMEA 2000, DIRECTEMAR, Satelital)",
        subtitle: "Configurar IP Gateway Signal K, e-Zarpe API y satélite Iridium",
        category: "NAVEGACIÓN",
        keywords: "integraciones hub nmea signalk directemar satelite iridium garmin config ip",
        shortcut: "G I",
        icon: Sliders,
        action: () => {
          onNavigateSection("integrations");
          onClose();
        },
      },
      {
        id: "cmd-handover",
        title: "Ir a Handover Check-In / Check-Out (Sello SHA-256)",
        subtitle: "Inspección de entrega/recepción con firma táctil y fotos",
        category: "NAVEGACIÓN",
        keywords: "handover checkin checkout firma sha256 acta",
        shortcut: "G H",
        icon: ShieldCheck,
        action: () => {
          onNavigateSection("handover");
          onClose();
        },
      },
      {
        id: "cmd-passport",
        title: "Abrir Pasaporte Náutico Digital & Sea Time Log",
        subtitle: "Billetera de licencia DIRECTEMAR, millas acumuladas y Replay GPX",
        category: "NAVEGACIÓN",
        keywords: "pasaporte licencia millas bitacora gastos wallet",
        shortcut: "G P",
        icon: BookOpen,
        action: () => {
          onNavigateSection("logbook");
          onClose();
        },
      },
      {
        id: "cmd-night",
        title: "Activar Night Red-Shift (#000000 + #FF0000 OLED)",
        subtitle: "Cero píxeles blancos para preservar visión escotópica nocturna",
        category: "ERGONOMÍA & SOS",
        keywords: "noche night red shift rojo guardia nocturna",
        shortcut: "T N",
        icon: Eye,
        action: () => {
          onSetTheme("night-red-shift");
          onClose();
        },
      },
      {
        id: "cmd-daylight",
        title: "Activar Daylight High-Contrast (#F0F4F8 Anti-Glare)",
        subtitle: "Fondo Blanco Hielo #F0F4F8 y texto #0A192F para sol extremo en bañera",
        category: "ERGONOMÍA & SOS",
        keywords: "dia sol daylight contraste blanco",
        shortcut: "T D",
        icon: Sun,
        action: () => {
          onSetTheme("daylight-high-contrast");
          onClose();
        },
      },
      {
        id: "cmd-midnight",
        title: "Activar Midnight Ocean (#040B16 + Lifebuoy #FF5722)",
        subtitle: "Azul Abisal y Naranja de Salvamento IALA por defecto",
        category: "ERGONOMÍA & SOS",
        keywords: "midnight ocean oscuro dark iala",
        shortcut: "T M",
        icon: Moon,
        action: () => {
          onSetTheme("midnight-ocean");
          onClose();
        },
      },
      {
        id: "cmd-academy",
        title: "Abrir Marine Academy & Glosario Náutico 🛟",
        subtitle: "Guías rápidas de zarpe, mareas de Chiloé y Pruebas de Mar",
        category: "NAVEGACIÓN",
        keywords: "academia soporte ayuda salvavidas glosario",
        shortcut: "G A",
        icon: LifeBuoy,
        action: () => {
          onNavigateSection("academy");
          onClose();
        },
      },
      {
        id: "cmd-sos",
        title: "Activar Consola SOS Zafarrancho (MAYDAY VHF 16)",
        subtitle: "Coordenadas en 32pt + Guion radial MAYDAY + Alerta Iridium SBD",
        category: "ERGONOMÍA & SOS",
        keywords: "sos mayday emergencia vhf 16 zafarrancho",
        shortcut: "SOS",
        icon: AlertOctagon,
        action: () => {
          onClose();
          onOpenSOS();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAuthorName]
  );

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (quickExpenseMode) {
        setQuickExpenseMode(false);
      } else {
        onClose();
      }
      return;
    }
    if (quickExpenseMode) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length > 0
          ? (prev - 1 + filteredCommands.length) % filteredCommands.length
          : 0
      );
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      triggerHapticFeedback(15);
      filteredCommands[selectedIndex].action();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="command-center-backdrop"
          data-testid="command-center-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onKeyDown={handleKeyDown}
          className="fixed inset-0 z-[90] flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/75 backdrop-blur-xl select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="command-center-panel"
            initial={{ opacity: 0, scale: 0.96, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -14 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-2xl marine-card overflow-hidden border border-white/5 shadow-2xl shadow-black/80"
          >
            {/* Top Command Input Bar */}
            <div className="flex items-center gap-3 px-4 border-b border-white/5">
              <Search className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                data-testid="command-center-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Comando rápido... (Ej. 'Ir a motor', 'Registrar gasto', 'Vía de agua', 'Red-Shift')"
                className="w-full min-h-[64px] bg-transparent border-none focus:outline-none text-sm sm:text-base font-semibold tracking-tight px-1"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar Command Center"
                className="min-h-14 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <span className="font-mono text-[11px] opacity-70">ESC</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Quick Expense Entry Sub-Mode */}
            {quickExpenseMode ? (
              <form
                data-testid="command-quick-expense-form"
                onSubmit={handleSaveQuickExpense}
                className="p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--accent-primary)]">
                    ACCIÓN DIRECTA • REGISTRAR GASTO EN INDEXEDDB
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickExpenseMode(false)}
                    className="marine-btn marine-btn-secondary text-xs px-3"
                  >
                    Volver a Comandos
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold tracking-tight opacity-70 mb-1">
                      Concepto del Gasto
                    </label>
                    <input
                      type="text"
                      required
                      value={expenseTitle}
                      onChange={(e) => setExpenseTitle(e.target.value)}
                      className="w-full min-h-[64px] px-3.5 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold tracking-tight opacity-70 mb-1">
                      Monto (USD $)
                    </label>
                    <input
                      type="number"
                      required
                      value={expenseUsd}
                      onChange={(e) => setExpenseUsd(e.target.value)}
                      className="w-full min-h-[64px] px-3.5 font-mono text-base font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="command-save-expense-btn"
                  className="w-full min-h-[64px] marine-btn marine-btn-primary text-sm font-bold tracking-tight"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Guardar Gasto en Bitácora (En el dispositivo)</span>
                </button>
              </form>
            ) : (
              /* Command Palette Results List */
              <div className="max-h-[62vh] overflow-y-auto p-2.5 space-y-1.5">
                {filteredCommands.length === 0 ? (
                  <div className="p-8 text-center text-xs opacity-65 font-medium">
                    Sin comandos coincidentes para &ldquo;{query}&rdquo;. Prueba con
                    &ldquo;motor&rdquo;, &ldquo;gasto&rdquo; o &ldquo;SOS&rdquo;.
                  </div>
                ) : (
                  filteredCommands.map((item, idx) => {
                    const Icon = item.icon;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={item.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => {
                          triggerHapticFeedback(14);
                          item.action();
                        }}
                        className={`w-full min-h-[64px] px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all ${
                          isSelected
                            ? "bg-slate-800/90 border border-[var(--accent-primary)]/40 text-white shadow-none"
                            : "hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-[var(--accent-primary)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold tracking-tight truncate">
                              {item.title}
                            </div>
                            <div className="text-xs opacity-70 truncate mt-0.5 font-normal">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-bold tracking-[0.15em] opacity-75 uppercase">
                            {item.category}
                          </span>
                          <span className="px-2 py-1 rounded bg-white/10 font-mono text-[11px] font-bold flex items-center gap-1">
                            <span>{item.shortcut}</span>
                            <CornerDownLeft className="w-3 h-3 opacity-70" />
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer Hint Bar */}
            <div className="px-4 py-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] opacity-70">
              <span className="font-normal">
                ↑↓ Navegar • ↵ Ejecutar • ESC Cerrar • Guardado local a bordo
              </span>
              <span className="font-mono text-[10px] tracking-wider uppercase">MARINOS COMMAND CENTER (⌘K)</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
