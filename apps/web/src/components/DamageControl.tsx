"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Droplets,
  Flame,
  Wrench,
  CheckCircle2,
  MapPin,
  QrCode,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  ShoppingCart,
  PackageX,
  Anchor,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  type MarketplaceOrderRecord,
} from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

interface DecisionNode {
  stepNumber: number;
  question: string;
  actionInstruction: string;
  compartmentLabel: string;
  deckCoords: { x: number; y: number };
  equipmentToUse: string;
  partSku: string;
  estimatedPriceUsd: number;
  relatedQrSlug: string;
  options: {
    label: string;
    nextStepIndex: number | "RESOLVED";
  }[];
}

interface EmergencyScenario {
  id: "engine_rpm_loss" | "flooding" | "fire_aboard";
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  nodes: DecisionNode[];
}

const SCENARIOS: EmergencyScenario[] = [
  {
    id: "engine_rpm_loss",
    title: "Falla de Motor / Pérdida de RPM (Yanmar 4JH57)",
    subtitle:
      "1. Revisar Filtro Combustible Racor R20P • 2. Revisar Impulsor Bomba Agua",
    badge: "PROPULSIÓN • YANMAR 57HP",
    icon: Wrench,
    nodes: [
      {
        stepNumber: 1,
        question:
          "PASO 1 (FILTRO RACOR): ¿El motor Yanmar 4JH57 pierde RPM bajo carga o se observa agua/sedimento en el vaso decantador transparente?",
        actionInstruction:
          "1. Revisar Filtro Racor: Cerrar paso de diésel, drenar agua del vaso inferior y sustituir el cartucho por un 'Filtro Combustible Racor R20P (10 micras)'. Accionar el cebador manual hasta eliminar burbujas antes de dar arranque.",
        compartmentLabel: "Compartimento Motor — Prefiltro Racor (Estribor)",
        deckCoords: { x: 255, y: 95 },
        equipmentToUse: "Filtro Combustible Racor R20P (10 micras)",
        partSku: "RAC-R20P-10M",
        estimatedPriceUsd: 48.0,
        relatedQrSlug: "yanmar-4jh57",
        options: [
          {
            label: "Filtro Racor R20P reemplazado; RPM estables en 2.150",
            nextStepIndex: "RESOLVED",
          },
          {
            label: "Avanzar al Paso 2: Revisar Impulsor de Bomba de Agua",
            nextStepIndex: 1,
          },
        ],
      },
      {
        stepNumber: 2,
        question:
          "PASO 2 (IMPULSOR): ¿Persiste caída de potencia acompañada de alarma de temperatura o bajo caudal de agua salada en el escape?",
        actionInstruction:
          "2. Revisar Impulsor: Cerrar grifo de fondo bajo la escalera del salón, desmontar tapa de 6 pernos de la bomba de agua salada e instalar el 'Impulsor Bomba Agua Yanmar + Empaquetadura'. Abrir grifo de fondo (palanca vertical).",
        compartmentLabel: "Bajo Escalera Salón — Bomba Agua & Grifo Fondo",
        deckCoords: { x: 245, y: 80 },
        equipmentToUse: "Impulsor Bomba Agua Yanmar + Empaquetadura",
        partSku: "YAN-129670-42531",
        estimatedPriceUsd: 65.0,
        relatedQrSlug: "yanmar-4jh57",
        options: [
          {
            label: "Impulsor reemplazado y refrigeración en 81.5°C",
            nextStepIndex: "RESOLVED",
          },
          {
            label: "Volver al Paso 1 (Revisar Filtro Racor)",
            nextStepIndex: 0,
          },
        ],
      },
    ],
  },
  {
    id: "flooding",
    title: "Vía de Agua (Flooding / Sentina)",
    subtitle: "Árbol de decisión para ingreso de agua en casco o grifos de fondo",
    badge: "PRIORIDAD 1 • FLOTABILIDAD",
    icon: Droplets,
    nodes: [
      {
        stepNumber: 1,
        question:
          "¿El nivel de agua en la sentina central supera los 10 cm o la bomba automática no da abasto?",
        actionInstruction:
          "Activar bomba de achique eléctrica manual en panel de mesa de cartas y cerrar de inmediato los 2 grifos de fondo principales (Motor bajo escalera y Baño Jabsco popa).",
        compartmentLabel: "Bajo Escalera Salón / Grifo Fondo Motor",
        deckCoords: { x: 245, y: 80 },
        equipmentToUse: "Kit Espiches Cónicos de Madera + Bomba Achique",
        partSku: "SOLAS-BUNG-SET",
        estimatedPriceUsd: 32.0,
        relatedQrSlug: "yanmar-4jh57",
        options: [
          {
            label: "El flujo se detuvo al cerrar grifo de motor",
            nextStepIndex: "RESOLVED",
          },
          {
            label: "Sigue entrando agua por sector popa / baño",
            nextStepIndex: 1,
          },
        ],
      },
      {
        stepNumber: 2,
        question:
          "¿El ingreso proviene del pasacasco del Baño Marino Jabsco Popa?",
        actionInstruction:
          "Cerrar válvula esférica de descarga y admisión en Baño de Popa Estribor y reemplazar Válvula Joker Jabsco.",
        compartmentLabel: "Baño de Popa Estribor (Pasacascos WC)",
        deckCoords: { x: 315, y: 105 },
        equipmentToUse: "Válvula Joker Repuesto Jabsco Twist n Lock",
        partSku: "JAB-29092-1000",
        estimatedPriceUsd: 28.0,
        relatedQrSlug: "jabsco-wc-popa",
        options: [
          {
            label: "Pasacasco estanco y sentina bajando de nivel",
            nextStepIndex: "RESOLVED",
          },
          {
            label: "Reiniciar inspección desde Paso 1",
            nextStepIndex: 0,
          },
        ],
      },
    ],
  },
  {
    id: "fire_aboard",
    title: "Fuego a Bordo (Motor / BMS / Cocina)",
    subtitle: "Aislamiento eléctrico, corte de combustible y descarga por tronera",
    badge: "CRÍTICO • INCENDIO",
    icon: Flame,
    nodes: [
      {
        stepNumber: 1,
        question:
          "¿Hay presencia de humo u olor a aislamiento eléctrico quemado en sala de máquinas?",
        actionInstruction:
          "NUNCA abrir la tapa del motor de golpe. Cortar llave general de baterías (BMS) junto a mesa de cartas, cerrar paso de diésel y descargar extintor por la tronera bajo la escalera.",
        compartmentLabel: "Mesa de Cartas (Corte BMS) & Tronera Motor",
        deckCoords: { x: 215, y: 55 },
        equipmentToUse: "Extintor CO2 / Polvo ABC 2kg + Kit Bengalas SOLAS",
        partSku: "SOLAS-EXT-CO2",
        estimatedPriceUsd: 95.0,
        relatedQrSlug: "quick-windlass",
        options: [
          {
            label: "Foco controlado y circuito eléctrico aislado",
            nextStepIndex: "RESOLVED",
          },
        ],
      },
    ],
  },
];

export function DamageControl() {
  const { pushToast } = useMarineContext();

  const voyage = useLiveQuery(() => db.voyages.get(DEMO_IDS.VOYAGE_ID), []);
  const marketplaceOrders = useLiveQuery(
    () => db.marketplace_orders.reverse().sortBy("created_at"),
    [],
    []
  );

  const [selectedScenarioId, setSelectedScenarioId] = useState<
    "engine_rpm_loss" | "flooding" | "fire_aboard"
  >("engine_rpm_loss");
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [resolved, setResolved] = useState<boolean>(false);
  const [partUnavailable, setPartUnavailable] = useState<boolean>(false);

  const scenario =
    SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];
  const currentNode = scenario.nodes[stepIndex] || scenario.nodes[0];
  const destinationPort = voyage?.arrival_port || "Caleta Mechuque";

  const handleSelectScenario = (
    id: "engine_rpm_loss" | "flooding" | "fire_aboard"
  ) => {
    setSelectedScenarioId(id);
    setStepIndex(0);
    setResolved(false);
    setPartUnavailable(false);
  };

  const handleQuoteInNextPort = async () => {
    const orderId = `mkt-ord-${Date.now()}`;
    const newOrder: MarketplaceOrderRecord = {
      id: orderId,
      voyage_id: voyage?.id || DEMO_IDS.VOYAGE_ID,
      vessel_id: DEMO_IDS.VESSEL_ID,
      part_name: currentNode.equipmentToUse,
      part_sku: currentNode.partSku,
      arrival_port: destinationPort,
      supplier_name: `Náutica Austral & Repuestos Yanmar (${destinationPort})`,
      estimated_price_usd: currentNode.estimatedPriceUsd,
      status: "quoted_offline",
      created_at: new Date().toISOString(),
    };

    await db.marketplace_orders.put(newOrder);
    await enqueueOfflineMutation({
      table_name: "marketplace_orders",
      operation: "INSERT",
      record_id: orderId,
      payload: newOrder as unknown as Record<string, unknown>,
    });

    pushToast({
      title: `Orden de Repuesto Creada en ${destinationPort}`,
      subtitle: `${newOrder.part_name} (USD $${newOrder.estimated_price_usd}) pendiente de sincronizar`,
      tone: "emerald",
    });
  };

  return (
    <div data-testid="damage-control-view" className="space-y-6">
      {/* Top Scenario Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const isSelected = sc.id === selectedScenarioId;
          return (
            <button
              key={sc.id}
              type="button"
              data-testid={`damage-scenario-${sc.id}`}
              onClick={() => handleSelectScenario(sc.id)}
              className={`min-h-14 p-5 rounded-2xl border text-left transition flex flex-col justify-between space-y-3 ${
                isSelected
                  ? "bg-red-950/30 border border-red-800 shadow-none"
                  : "marine-card hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-white/10 font-bold text-[#FF9F0A]">
                  {sc.badge}
                </span>
                <Icon className="w-5 h-5 text-[#FF2D55] shrink-0" />
              </div>
              <div>
                <div className="text-base font-bold">{sc.title}</div>
                <div className="text-xs opacity-75 mt-1">{sc.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Responsive Industrial Grid: Decision Tree + Marketplace Sourcing (Left) & Hull Map (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 cols: Interactive Decision Tree + Spare Parts Marketplace Sourcing */}
        <div className="lg:col-span-6 marine-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#FF2D55]">
                  ÁRBOL DE DECISIÓN TÁCTIL &amp; SOURCING DE REPUESTOS
                </div>
                <h2 className="text-lg font-bold mt-0.5">{scenario.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStepIndex(0);
                  setResolved(false);
                  setPartUnavailable(false);
                }}
                className="marine-btn marine-btn-secondary text-xs px-3"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reiniciar</span>
              </button>
            </div>

            {resolved ? (
              <div
                data-testid="damage-control-resolved"
                className="p-6 rounded-2xl bg-[#00E676]/15 border border-[#00E676] space-y-3 text-center"
              >
                <CheckCircle2 className="w-10 h-10 text-[#00E676] mx-auto" />
                <div className="text-xl font-bold text-[#00E676]">
                  Avería Controlada y Estabilizada
                </div>
                <p className="text-xs font-mono opacity-85">
                  Registra el incidente en la Bitácora de Voz para actualizar el
                  historial del motor en el dispositivo.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-[#FF2D55]/10 border border-[#FF2D55]/40 space-y-2">
                  <div className="font-mono text-xs font-bold text-[#FF2D55] flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>
                      PASO FÍSICO {currentNode.stepNumber}: DIAGNÓSTICO A BORDO
                    </span>
                  </div>
                  <div className="text-base font-semibold leading-snug">
                    {currentNode.question}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 font-mono text-xs">
                  <div className="text-[var(--accent-primary)] font-bold uppercase">
                    PROCEDIMIENTO MECÁNICO PASO A PASO:
                  </div>
                  <p className="leading-relaxed opacity-90 font-sans text-sm">
                    {currentNode.actionInstruction}
                  </p>
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[#00E676]">
                      Repuesto requerido:{" "}
                      <strong>{currentNode.equipmentToUse}</strong> (
                      {currentNode.partSku})
                    </span>
                    <Link
                      href={`/qr/${currentNode.relatedQrSlug}`}
                      className="text-[var(--accent-primary)] underline flex items-center gap-1 font-bold"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR: {currentNode.relatedQrSlug}</span>
                    </Link>
                  </div>
                </div>

                {/* Decision Options + "Repuesto no disponible a bordo" Marketplace Trigger */}
                <div className="space-y-2.5 pt-1">
                  <div className="font-mono text-[11px] uppercase opacity-70">
                    RESULTADO DE LA INSPECCIÓN:
                  </div>
                  {currentNode.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`damage-option-${idx}`}
                      onClick={() => {
                        setPartUnavailable(false);
                        if (opt.nextStepIndex === "RESOLVED") {
                          setResolved(true);
                        } else {
                          setStepIndex(opt.nextStepIndex);
                        }
                      }}
                      className="w-full marine-btn marine-btn-secondary text-xs sm:text-sm justify-between"
                    >
                      <span>{opt.label}</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  ))}

                  {/* Toggle: "Repuesto no disponible a bordo" */}
                  <button
                    type="button"
                    data-testid="damage-part-unavailable-btn"
                    onClick={() => setPartUnavailable(true)}
                    className={`w-full marine-btn text-xs sm:text-sm justify-between ${
                      partUnavailable
                        ? "bg-[#FF9F0A]/20 border-[#FF9F0A] text-[#FF9F0A]"
                        : "marine-btn-secondary"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <PackageX className="w-4 h-4 text-[#FF9F0A] shrink-0" />
                      <span>Repuesto no disponible a bordo</span>
                    </span>
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/10">
                      SOURCING
                    </span>
                  </button>

                  {/* Enabled when "Repuesto no disponible a bordo" is marked */}
                  {partUnavailable && (
                    <div
                      data-testid="marketplace-quote-box"
                      className="p-4 rounded-2xl bg-[var(--accent-primary)]/10 border-2 border-[var(--accent-primary)]/50 space-y-3"
                    >
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-[var(--accent-primary)] font-bold">
                          MARINOS MARKETPLACE • ENTREGA EN MUELLE
                        </span>
                        <span className="text-[#00E676] font-bold">
                          USD ${currentNode.estimatedPriceUsd}
                        </span>
                      </div>
                      <p className="text-xs opacity-85">
                        Solicita <strong>{currentNode.equipmentToUse}</strong>{" "}
                        para entrega prioritaria al arribar a tu próximo puerto
                        de destino (<strong>{destinationPort}</strong>).
                      </p>
                      <button
                        type="button"
                        data-testid="quote-next-port-btn"
                        onClick={handleQuoteInNextPort}
                        className="w-full marine-btn marine-btn-primary text-xs sm:text-sm font-bold"
                      >
                        <ShoppingCart className="w-4 h-4 shrink-0" />
                        <span>
                          Cotizar en próximo Puerto ({destinationPort})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right 6 cols: Interactive Digital Twin Hull Map + Marketplace Orders in IndexedDB */}
        <div className="lg:col-span-6 space-y-6">
          <div className="marine-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-primary)]">
                  PLANO DE CUBIERTA &amp; SENTINA • SV ALBATROS (12.43M)
                </div>
                <h2 className="text-lg font-bold flex items-center gap-2 mt-0.5">
                  <MapPin className="w-5 h-5 text-[#FF2D55]" />
                  <span>Ubicación Exacta: {currentNode.compartmentLabel}</span>
                </h2>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#040B16] border border-white/15 flex flex-col items-center justify-center">
              <svg
                viewBox="0 0 420 160"
                className="w-full max-w-lg h-auto"
                aria-label="Plano esquemático SV Albatros Oceanis 41.1"
              >
                <path
                  d="M 20 80 Q 110 18 230 22 L 385 32 Q 400 80 385 128 L 230 138 Q 110 142 20 80 Z"
                  fill="rgba(0, 245, 255, 0.05)"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                />
                <line
                  x1="105"
                  y1="34"
                  x2="105"
                  y2="126"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                />
                <line
                  x1="200"
                  y1="24"
                  x2="200"
                  y2="136"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                />
                <line
                  x1="285"
                  y1="26"
                  x2="285"
                  y2="134"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                />

                <text
                  x="48"
                  y="83"
                  fill="#94A3B8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  PROA / ANCLA
                </text>
                <text
                  x="130"
                  y="83"
                  fill="#94A3B8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  SALÓN CENTRAL
                </text>
                <text
                  x="212"
                  y="46"
                  fill="#00E5FF"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  CARTAS/BMS
                </text>
                <text
                  x="218"
                  y="83"
                  fill="#E9FEFF"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  MOTOR YANMAR
                </text>
                <text
                  x="295"
                  y="118"
                  fill="#00E676"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  WC POPA ESTR.
                </text>

                <circle cx="65" cy="80" r="4" fill="#00E5FF" />
                <circle cx="215" cy="55" r="4" fill="#FF9F0A" />
                <circle cx="245" cy="80" r="4" fill="#00E676" />
                <circle cx="315" cy="105" r="4" fill="#00E676" />

                <circle
                  cx={currentNode.deckCoords.x}
                  cy={currentNode.deckCoords.y}
                  r="18"
                  fill="rgba(255, 69, 58, 0.25)"
                  stroke="#FF2D55"
                  strokeWidth="2"
                />
                <circle
                  cx={currentNode.deckCoords.x}
                  cy={currentNode.deckCoords.y}
                  r="6"
                  fill="#FF2D55"
                />
              </svg>
            </div>
          </div>

          {/* Marketplace Orders Persisted in IndexedDB */}
          <div
            data-testid="marketplace-orders-list"
            className="marine-card p-6 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>
                  Órdenes de Repuestos en Próximo Puerto (
                  {marketplaceOrders.length})
                </span>
              </h3>
              <span className="font-mono text-[11px] text-[#00E676]">
                Destino: {destinationPort}
              </span>
            </div>

            {marketplaceOrders.length === 0 ? (
              <p className="text-xs font-mono opacity-65">
                Marca &ldquo;Repuesto no disponible a bordo&rdquo; y pulsa
                &ldquo;Cotizar en próximo Puerto&rdquo; para generar una orden
                de suministro en {destinationPort}.
              </p>
            ) : (
              <div className="space-y-2">
                {marketplaceOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/40 flex items-center justify-between gap-3 font-mono text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#00E676] truncate">
                        {ord.part_name} ({ord.part_sku})
                      </div>
                      <div className="text-[11px] opacity-85 flex items-center gap-1 mt-0.5">
                        <Anchor className="w-3 h-3 shrink-0" />
                        <span>
                          Puerto de Entrega: <strong>{ord.arrival_port}</strong>{" "}
                          • {ord.supplier_name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm">
                        USD ${ord.estimated_price_usd}
                      </div>
                      <div className="text-[10px] text-[var(--accent-primary)]">
                        EN SYNC_QUEUE
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
