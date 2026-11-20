"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Truck,
  PackageCheck,
  Package,
  Search,
  Printer,
  MapPin,
  CheckCircle2,
  X,
  Plus,
  Minus,
  ShieldCheck,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  type MarketplaceOrderRecord,
} from "@/lib/offline/db";

export interface MarineProduct {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: "motor" | "electrico" | "fontaneria" | "jarcia" | "seguridad" | "navegacion";
  categoryLabel: string;
  price_usd: number;
  price_clp: number;
  stock_ports: string[];
  compatible_vessels: string;
  description: string;
  in_stock: boolean;
  lead_time: string;
}

export const MARINE_CATALOG: MarineProduct[] = [
  {
    id: "prod-racor-500fg",
    sku: "RAC-500FG-30M",
    name: "Filtro Decantador Racor 500FG (30 micras)",
    brand: "Parker Racor",
    category: "motor",
    categoryLabel: "Motor & Propulsión",
    price_usd: 48,
    price_clp: 45600,
    stock_ports: ["Puerto Montt (Oxxean)", "Valparaíso", "Castro"],
    compatible_vessels: "Yanmar 4JH57, Volvo Penta D2-40, Motores Diésel Marinos",
    description: "Elemento filtrante de celulosa hidrofóbica Aquabloc. Retiene el 99% de agua libre e impurezas del petróleo antes de la bomba de inyección.",
    in_stock: true,
    lead_time: "Inmediato (Muelle)",
  },
  {
    id: "prod-impeller-yanmar",
    sku: "YAN-129470-42532",
    name: "Kit Rodete Bomba Agua Salada Yanmar (Neopreno + O-Ring)",
    brand: "Yanmar Marine",
    category: "motor",
    categoryLabel: "Motor & Propulsión",
    price_usd: 65,
    price_clp: 61750,
    stock_ports: ["Puerto Montt (Chinquihue)", "Castro", "Puerto Williams"],
    compatible_vessels: "Yanmar 4JH57, 4JH45, 3YM30, Oceanis 41.1, Lagoon 42",
    description: "Rodete de 6 palas de neopreno reforzado. Incluye junta tórica de estanqueidad y sachet de lubricante de montaje a base de glicerina neutra.",
    in_stock: true,
    lead_time: "Inmediato (Muelle)",
  },
  {
    id: "prod-anode-shaft",
    sku: "ZNC-HNG-5M",
    name: "Ánodo de Sacrificio de Zinc Colgante con Cable 5m",
    brand: "Tecnoseal Marine",
    category: "motor",
    categoryLabel: "Motor & Propulsión",
    price_usd: 35,
    price_clp: 33250,
    stock_ports: ["Castro", "Puerto Montt", "Caleta Mechuque"],
    compatible_vessels: "Universal (Veleros monocasco, catamaranes y yates)",
    description: "Ánodo de zinc electrolítico de alta pureza (Norma Mil-Spec A-18001K). Se arroja al mar conectado a la masa del motor mientras el barco está amarrado a puerto.",
    in_stock: true,
    lead_time: "Inmediato",
  },
  {
    id: "prod-rule-2000",
    sku: "RUL-2000-12V",
    name: "Bomba de Achique Sumergible Rule 2000 GPH (12V)",
    brand: "Rule Xylem",
    category: "fontaneria",
    categoryLabel: "Fontanería & Achique",
    price_usd: 145,
    price_clp: 137750,
    stock_ports: ["Puerto Montt (Oxxean)", "Valparaíso"],
    compatible_vessels: "Sentina Principal de Oceanis, Lagoon, Sun Odyssey",
    description: "Caudal de 7.570 litros/hora. Motor de alta resistencia con protección térmica contra funcionamiento en seco. Salida para manguera espiralada de 1-1/8 pulg.",
    in_stock: true,
    lead_time: "24h Despacho",
  },
  {
    id: "prod-jabsco-joker",
    sku: "JAB-29092-1000",
    name: "Kit Válvula Joker & Diafragma Inodoro Jabsco Marino",
    brand: "Jabsco Marine",
    category: "fontaneria",
    categoryLabel: "Fontanería & Achique",
    price_usd: 38,
    price_clp: 36100,
    stock_ports: ["Puerto Montt", "Castro", "Puerto Varas"],
    compatible_vessels: "Inodoros manuales y eléctricos Jabsco Twist 'n' Lock",
    description: "Válvula antiretorno de nitrilo resistente al agua de mar y residuos. Evita el reflujo de aguas negras hacia la taza del inodoro.",
    in_stock: true,
    lead_time: "Inmediato",
  },
  {
    id: "prod-victron-lifepo4",
    sku: "VIC-BAT-LFP200",
    name: "Batería Victron Energy LiFePO4 Smart 12.8V / 200Ah",
    brand: "Victron Energy",
    category: "electrico",
    categoryLabel: "Electricidad & Baterías",
    price_usd: 1450,
    price_clp: 1377500,
    stock_ports: ["Puerto Montt (Oxxean)", "Santiago Hub"],
    compatible_vessels: "Bancos de servicio 12V/24V, Victron Cerbo GX, Multiplus",
    description: "Celda de fosfato de hierro y litio con Bluetooth integrado para monitoreo de voltaje por celda y temperatura en la app VictronConnect. 5.000 ciclos de vida.",
    in_stock: true,
    lead_time: "24h - 48h",
  },
  {
    id: "prod-yanmar-oil-5l",
    sku: "YAN-OIL-15W40-5L",
    name: "Aceite Motor Diésel Marino Yanmar 15W-40 CI-4 (5L)",
    brand: "Yanmar Marine Lubricants",
    category: "motor",
    categoryLabel: "Motor & Propulsión",
    price_usd: 55,
    price_clp: 52250,
    stock_ports: ["Puerto Montt", "Castro", "Caleta La Arena"],
    compatible_vessels: "Yanmar serie JH, YM, GM y generadores marinos",
    description: "Formulación especial con aditivos anticorrosivos de salitre y detergentes anti-carbonilla para motores diésel marinos que operan a régimen sostenido.",
    in_stock: true,
    lead_time: "Inmediato (Muelle)",
  },
  {
    id: "prod-damage-control-bungs",
    sku: "DC-WOOD-BUNG-04",
    name: "Set 4 Espiches Cónicos de Madera Blanda (Damage Control)",
    brand: "MarinOS Safety Gear",
    category: "seguridad",
    categoryLabel: "Seguridad DIRECTEMAR",
    price_usd: 28,
    price_clp: 26600,
    stock_ports: ["Puerto Montt", "Castro", "Caleta Mechuque", "Puerto Williams", "Valparaíso"],
    compatible_vessels: "Pasa-cascos y tomas de mar de 1/2 pulg hasta 2 pulg",
    description: "Madera de pino blanco blando que se expande por absorción al contacto con el agua de mar, sellando de inmediato roturas en válvulas de fondo o mangueras de sentina.",
    in_stock: true,
    lead_time: "Inmediato en todas las capitanías",
  },
  {
    id: "prod-solas-flares",
    sku: "SOL-PYRO-RED-04",
    name: "Pack 4 Bengalas de Mano Rojas SOLAS (Vigencia 2028)",
    brand: "Comet Marine",
    category: "seguridad",
    categoryLabel: "Seguridad DIRECTEMAR",
    price_usd: 120,
    price_clp: 114000,
    stock_ports: ["Valparaíso", "Puerto Montt (Oxxean)"],
    compatible_vessels: "Obligatorio DIRECTEMAR Navegación Mayor y Costera",
    description: "15.000 candelas de intensidad por 60 segundos. Homologación SOLAS 74/96 y aprobación de la Armada de Chile para botiquín de emergencia reglamentario.",
    in_stock: true,
    lead_time: "Despacho terrestre 24h",
  },
  {
    id: "prod-inox-shackle",
    sku: "SS-SHK-12MM",
    name: "Grillete Forjado Lira Inox 316 12mm con Perno Roscado",
    brand: "Wichard Marine",
    category: "jarcia",
    categoryLabel: "Jarcia & Cubierta",
    price_usd: 24,
    price_clp: 22800,
    stock_ports: ["Puerto Montt", "Castro", "Puerto Varas"],
    compatible_vessels: "Unión cadena de fondeo de 10mm, arraigos de drizas y jarcia",
    description: "Acero inoxidable calidad marina 316 forjado a presión. Carga de rotura garantizada de 4.800 kg. Perno roscado con orificio para fijación con precinto o alambre inox.",
    in_stock: true,
    lead_time: "Inmediato",
  },
  {
    id: "prod-spectra-pickle",
    sku: "SPC-MEM-CLNKIT",
    name: "Kit Conservación y Limpieza Desalinizadora Spectra (Pickle)",
    brand: "Spectra Watermakers",
    category: "fontaneria",
    categoryLabel: "Fontanería & Achique",
    price_usd: 95,
    price_clp: 90250,
    stock_ports: ["Puerto Montt (Oxxean)"],
    compatible_vessels: "Spectra Ventura 150, Catalina 300, Newport 400",
    description: "Metabisulfito de sodio de grado alimenticio purificado para hibernación de membranas de ósmosis inversa. Previene el crecimiento bacteriano hasta por 6 meses.",
    in_stock: true,
    lead_time: "24h Despacho",
  },
  {
    id: "prod-vhf-antenna",
    sku: "SHK-VHF-5400XT",
    name: "Antena VHF Marina Shakespeare Galaxy 5400-XT (1.2m 3dB)",
    brand: "Shakespeare Marine",
    category: "navegacion",
    categoryLabel: "Navegación & VHF",
    price_usd: 185,
    price_clp: 175750,
    stock_ports: ["Puerto Montt", "Valparaíso"],
    compatible_vessels: "Transceptores VHF Clase D fijos (Icom, Raymarine, B&G)",
    description: "Fibra de vidrio de alta resistencia con terminación en bronce cromado y cable coaxial de baja pérdida RG-8X de 6 metros. Rango óptimo en canales y fiordos patagónicos.",
    in_stock: true,
    lead_time: "Inmediato",
  },
];

const CHILEAN_PORTS = [
  "Marina Puerto Montt (Canal Tenglo)",
  "Marina Oxxean (Reloncaví • Puerto Montt)",
  "Club Náutico Castro (Chiloé)",
  "Caleta Mechuque (Islas Chauques)",
  "Marina Puerto Varas (Lago Llanquihue)",
  "Caleta La Arena (Carretera Austral)",
  "Club de Yates Higuerillas (Concón)",
  "Muelle Prat (Valparaíso)",
  "Puerto Williams (Canal Beagle)",
];

interface MarineMarketplaceProps {
  activeVesselId?: string;
  pushToast: (toast: { title: string; subtitle?: string; tone?: "emerald" | "cyan" | "coral" | "amber" }) => void;
}

export function MarineMarketplace({ activeVesselId, pushToast }: MarineMarketplaceProps) {
  const marketplaceOrders = useLiveQuery(
    () => db.marketplace_orders.reverse().sortBy("created_at"),
    [],
    []
  );
  const vessels = useLiveQuery(() => db.vessels.toArray(), [], []);

  // Filter and Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Order Placement Modal State
  const [selectedProduct, setSelectedProduct] = useState<MarineProduct | null>(null);
  const [orderPort, setOrderPort] = useState(CHILEAN_PORTS[1]);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderUrgency, setOrderUrgency] = useState<"normal" | "urgent" | "express_caleta">("normal");
  const [orderVesselId, setOrderVesselId] = useState(activeVesselId || DEMO_IDS.VESSEL_ID);
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Products
  const filteredProducts = MARINE_CATALOG.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.compatible_vessels.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenOrderModal = (product: MarineProduct) => {
    setSelectedProduct(product);
    setOrderQuantity(1);
    setOrderNotes("");
    if (activeVesselId) setOrderVesselId(activeVesselId);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setIsSubmitting(true);
    try {
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const trackingCode = `CL-${orderPort.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newOrder: MarketplaceOrderRecord = {
        id: orderId,
        voyage_id: DEMO_IDS.VOYAGE_ID,
        vessel_id: orderVesselId,
        part_name: `${selectedProduct.name} (${orderQuantity} unidad${orderQuantity > 1 ? "es" : ""})`,
        part_sku: selectedProduct.sku,
        arrival_port: orderPort,
        supplier_name: `${selectedProduct.brand} • Distribución Portuaria Sur`,
        estimated_price_usd: selectedProduct.price_usd * orderQuantity,
        status: "quoted_offline",
        tracking_code: trackingCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.marketplace_orders.put(newOrder);
      await enqueueOfflineMutation({
        table_name: "marketplace_orders",
        record_id: orderId,
        operation: "INSERT",
        payload: newOrder as unknown as Record<string, unknown>,
      });

      pushToast({
        title: "Orden Solicitada con Éxito",
        subtitle: `${selectedProduct.name} enviado a cotización para entrega en ${orderPort}`,
        tone: "cyan",
      });

      setSelectedProduct(null);
    } catch {
      pushToast({
        title: "Error al registrar orden",
        subtitle: "Verifica el almacenamiento local del dispositivo",
        tone: "coral",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: MarketplaceOrderRecord["status"]
  ) => {
    const existing = await db.marketplace_orders.get(orderId);
    if (!existing) return;

    const updated: MarketplaceOrderRecord = {
      ...existing,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    await db.marketplace_orders.put(updated);
    await enqueueOfflineMutation({
      table_name: "marketplace_orders",
      record_id: orderId,
      operation: "UPDATE",
      payload: updated as unknown as Record<string, unknown>,
    });

    pushToast({
      title: "Estado de Orden Actualizado",
      subtitle: `La orden ${existing.part_sku} ahora está: ${newStatus.toUpperCase()}`,
      tone: newStatus === "delivered" ? "emerald" : "cyan",
    });
  };

  const handlePayOrderInUSD = async (order: MarketplaceOrderRecord) => {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutType: "marketplace_order",
          itemName: order.part_name,
          sku: order.part_sku,
          amountUsd: order.estimated_price_usd,
          orderId: order.id,
          deliveryPort: order.arrival_port,
        }),
      });
      const data = await res.json();
      await handleUpdateOrderStatus(order.id, "in_transit");
      if (data.checkoutUrl && typeof window !== "undefined") {
        window.open(data.checkoutUrl, "_blank");
        return;
      }
      pushToast({
        title: `Pago Procesado: $${(order.estimated_price_usd || 0).toFixed(2)} USD`,
        subtitle: `Orden ${order.tracking_code || order.part_sku} pagada en dólares y despachada a ${order.arrival_port}`,
        tone: "emerald",
      });
    } catch {
      await handleUpdateOrderStatus(order.id, "in_transit");
      pushToast({
        title: `Cobro Registrado Offline: $${(order.estimated_price_usd || 0).toFixed(2)} USD`,
        subtitle: `Sincronización Stripe USD encolada para ${order.part_sku}`,
        tone: "emerald",
      });
    }
  };

  const handlePrintDispatchBill = (order: MarketplaceOrderRecord) => {
    if (typeof window === "undefined") return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      pushToast({
        title: "Ventana Emergente Bloqueada",
        subtitle: "Permite ventanas emergentes para generar la Guía de Despacho",
        tone: "coral",
      });
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Guía de Despacho y Hoja de Ruta Naval - ${order.tracking_code || order.id}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0b1528;
      line-height: 1.4;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 2px solid #0b1528;
      padding-bottom: 10px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge {
      font-family: monospace;
      font-size: 8pt;
      font-weight: bold;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 3px 6px;
      border-radius: 4px;
    }
    .box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 14px;
      background: #f8fafc;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .label { font-size: 8pt; text-transform: uppercase; color: #64748b; font-family: monospace; }
    .value { font-size: 11pt; font-weight: bold; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #0b1528; color: white; text-align: left; padding: 6px 10px; font-size: 9pt; }
    td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 10pt; }
    .footer { border-top: 1px solid #cbd5e1; margin-top: 24px; padding-top: 10px; font-size: 8pt; color: #64748b; font-family: monospace; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="background: #0b1528; color: white; padding: 10px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
    <span><strong>MarinOS Marketplace • Guía de Despacho Portuario</strong></span>
    <div>
      <button onclick="window.print()" style="background: #00E5FF; color: black; border: none; font-weight: bold; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Imprimir</button>
      <button onclick="window.close()" style="background: #475569; color: white; border: none; padding: 6px 10px; border-radius: 4px; margin-left: 6px; cursor: pointer;">Cerrar</button>
    </div>
  </div>

  <div class="header">
    <div>
      <div class="badge">MARINOS LOGISTICS &amp; NAVAL SPARE PARTS</div>
      <h1 style="margin: 4px 0 0 0; font-size: 18pt;">GUÍA DE DESPACHO MARÍTIMA</h1>
      <div style="font-size: 9pt; color: #475569;">Hoja de Ruta de Repuestos a Puerto / Muelle</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12pt; font-weight: bold; font-family: monospace; color: #0284c7;">${order.tracking_code || order.id}</div>
      <div style="font-size: 8pt; color: #64748b;">Fecha: ${new Date(order.created_at || Date.now()).toLocaleDateString("es-CL")}</div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div>
        <div class="label">Puerto de Destino / Recalada</div>
        <div class="value">${order.arrival_port}</div>
      </div>
      <div>
        <div class="label">Embarcación Solicitante</div>
        <div class="value">${vessels?.find((v) => v.id === order.vessel_id)?.name || "Embarcación Activa"}</div>
      </div>
      <div>
        <div class="label">Proveedor Asignado</div>
        <div class="value">${order.supplier_name}</div>
      </div>
      <div>
        <div class="label">Estado Actual de Logística</div>
        <div class="value">${order.status.toUpperCase()}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Código SKU</th>
        <th>Descripción de Repuesto o Equipo</th>
        <th style="text-align: right;">Precio Estimado USD</th>
        <th style="text-align: right;">Estimado CLP</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-family: monospace;">${order.part_sku}</td>
        <td><strong>${order.part_name}</strong></td>
        <td style="text-align: right; font-weight: bold;">$${order.estimated_price_usd} USD</td>
        <td style="text-align: right;">$${((order.estimated_price_usd || 0) * 950).toLocaleString("es-CL")} CLP</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Sello de Validación Criptográfica MarinOS Offline • Despacho Seguro a Puerto</div>
    <div>Página 1 de 1</div>
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Hero */}
      <div className="marine-card p-6 sm:p-8 bg-gradient-to-br from-[#0F1E36]/90 via-[#0A1424]/90 to-[#060C16]/90 border-[var(--accent-primary)]/20 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.14em] uppercase bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 font-mono">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>MARINOS STORE • LOGÍSTICA PORTUARIA Y REPUESTOS NAVALES</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Repuestos y Suministros con Entrega Directa en Puerto
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-mono opacity-80 leading-relaxed">
              Catálogo técnico precargado offline con compatibilidad de motor, propulsión, jarcia, bombas y fondeo. Solicita suministros directamente a muelles y caletas de Chile (Puerto Montt, Castro, Oxxean, Caleta Mechuque, Valparaíso).
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center min-w-[120px]">
              <div className="text-[10px] font-mono opacity-60 uppercase">ÓRDENES ACTIVAS</div>
              <div className="text-2xl font-bold text-[var(--accent-primary)] mt-0.5">
                {marketplaceOrders.length}
              </div>
              <div className="text-[9px] font-mono opacity-50 mt-0.5">Dexie.js Offline</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center min-w-[120px]">
              <div className="text-[10px] font-mono opacity-60 uppercase">EN TRÁNSITO</div>
              <div className="text-2xl font-bold text-[#00E5FF] mt-0.5">
                {marketplaceOrders.filter((o) => o.status === "dispatched" || o.status === "in_transit").length}
              </div>
              <div className="text-[9px] font-mono opacity-50 mt-0.5">Rumbo a Caleta</div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Catalog Section */}
      <div className="space-y-4">
        {/* Search & Category Filter Bar */}
        <div className="marine-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar repuesto por nombre, SKU, marca (Yanmar, Racor, Victron, Rule...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent-primary)] font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-xs font-mono opacity-60 shrink-0 text-right sm:text-left">
              Mostrando <span className="font-bold text-white">{filteredProducts.length}</span> repuestos técnicos
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "Todos los Repuestos" },
              { id: "motor", label: "Motor & Propulsión" },
              { id: "electrico", label: "Electricidad & Victron" },
              { id: "fontaneria", label: "Fontanería & Achique" },
              { id: "seguridad", label: "Seguridad DIRECTEMAR" },
              { id: "jarcia", label: "Jarcia & Cubierta" },
              { id: "navegacion", label: "Navegación & VHF" },
            ].map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${isSelected
                      ? "bg-[var(--accent-primary)] text-black font-bold shadow-md shadow-[var(--accent-primary)]/20"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
                    }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="marine-card p-5 flex flex-col justify-between space-y-4 border border-white/5 hover:border-[var(--accent-primary)]/30 transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/5 text-[var(--accent-primary)] border border-white/10">
                      {product.brand}
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors leading-snug">
                      {product.name}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono opacity-50 shrink-0">
                    {product.sku}
                  </span>
                </div>

                <p className="text-xs text-slate-300/80 leading-relaxed line-clamp-2">
                  {product.description}
                </p>

                {/* Compatibility & Ports Info */}
                <div className="space-y-1.5 font-mono text-[11px] pt-2 border-t border-white/5">
                  <div className="flex items-start gap-1.5 text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00E676] shrink-0 mt-0.5" />
                    <span className="truncate">Compatible: {product.compatible_vessels}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-[#00E5FF] shrink-0 mt-0.5" />
                    <span className="truncate">Stock: {product.stock_ports.join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Price & Action Bottom (Strict USD Billing) */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-white font-mono">
                    ${product.price_usd.toFixed(2)} USD
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400">
                    Cobro directo en USD • Stripe
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`order-part-${product.sku}`}
                  onClick={() => handleOpenOrderModal(product)}
                  className="marine-btn marine-btn-primary text-xs px-3.5 py-2 font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Pedir a Puerto</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Orders Tracker Section */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-base font-semibold text-white">
              Seguimiento de Despachos &amp; Logística Portuaria
            </h3>
          </div>
          <span className="text-xs font-mono opacity-60">
            {marketplaceOrders.length} orden{marketplaceOrders.length !== 1 ? "es" : ""} registrada{marketplaceOrders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {marketplaceOrders.length === 0 ? (
          <div className="marine-card p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto text-slate-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold">No hay órdenes registradas</div>
            <p className="text-xs font-mono opacity-70 max-w-sm mx-auto">
              Selecciona cualquier repuesto del catálogo superior para coordinar una entrega a muelle o caleta.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketplaceOrders.map((order) => {
              const isDelivered = order.status === "delivered";
              const isInTransit = order.status === "dispatched" || order.status === "in_transit";

              return (
                <div
                  key={order.id}
                  className={`marine-card p-5 space-y-4 border transition ${isDelivered
                      ? "border-[#00E676]/40 bg-[#00E676]/[0.02]"
                      : isInTransit
                        ? "border-[#00E5FF]/40 bg-[#00E5FF]/[0.02]"
                        : "border-white/5"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm sm:text-base flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                        <span className="text-white">{order.part_name}</span>
                      </div>
                      <div className="text-xs font-mono opacity-65 mt-0.5">
                        SKU: {order.part_sku}
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold shrink-0 ${isDelivered
                          ? "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/50"
                          : isInTransit
                            ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/50 animate-pulse"
                            : "bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/50"
                        }`}
                    >
                      {isDelivered
                        ? "ENTREGADO A BORDO"
                        : isInTransit
                          ? "EN TRÁNSITO A PUERTO"
                          : "COTIZADO / EN PROCESO"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-xs pt-1 border-t border-white/5">
                    <div>
                      <div className="text-[10px] opacity-50 uppercase">Puerto de Destino</div>
                      <div className="font-semibold text-[var(--accent-primary)] truncate mt-0.5">
                        {order.arrival_port}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] opacity-50 uppercase">Proveedor Asignado</div>
                      <div className="font-semibold truncate mt-0.5 text-slate-200">
                        {order.supplier_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] opacity-50 uppercase">Monto Facturado (USD)</div>
                      <div className="font-bold text-[#00E676] mt-0.5">
                        ${(order.estimated_price_usd || 0).toFixed(2)} USD
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] opacity-50 uppercase">Tracking / Orden</div>
                      <div className="font-semibold opacity-80 truncate mt-0.5 text-[#00E5FF]">
                        {order.tracking_code || `#${order.id.slice(0, 8)}`}
                      </div>
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrintDispatchBill(order)}
                      className="marine-btn text-xs px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1.5"
                      title="Imprimir Guía de Despacho y Hoja de Ruta"
                    >
                      <Printer className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Guía Despacho</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isDelivered && (
                        <>
                          {!isInTransit && (
                            <button
                              type="button"
                              data-testid={`pay-usd-order-${order.id}`}
                              onClick={() => handlePayOrderInUSD(order)}
                              className="marine-btn text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-500/40"
                            >
                              <span>Pagar ${(order.estimated_price_usd || 0).toFixed(2)} USD</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order.id, "delivered")}
                            className="marine-btn marine-btn-primary text-xs px-3 py-1.5"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Confirmar Entrega</span>
                          </button>
                        </>
                      )}
                      {isDelivered && (
                        <span className="text-xs font-mono text-[#00E676] flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>A Bordo &amp; Pagado (USD)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Placement Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            key="order-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              key="order-modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="marine-card p-6 sm:p-8 max-w-lg w-full space-y-6 border border-white/10 shadow-2xl relative"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                    COORDINAR ENTREGA A PUERTO
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {selectedProduct.name}
                  </h3>
                  <div className="text-xs font-mono opacity-60 mt-0.5">
                    SKU: {selectedProduct.sku} • Marca: {selectedProduct.brand}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmOrder} className="space-y-4">
                {/* Destination Port */}
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Puerto o Caleta de Destino (Chile)
                  </label>
                  <select
                    value={orderPort}
                    onChange={(e) => setOrderPort(e.target.value)}
                    className="w-full min-h-12 px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white"
                  >
                    {CHILEAN_PORTS.map((port) => (
                      <option key={port} value={port} className="bg-[#0B1528] text-white">
                        {port}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vessel Select */}
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Embarcación de Destino
                  </label>
                  <select
                    value={orderVesselId}
                    onChange={(e) => setOrderVesselId(e.target.value)}
                    className="w-full min-h-12 px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white"
                  >
                    {vessels?.map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#0B1528] text-white">
                        {v.name} ({v.registration_number})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Urgency and Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Urgencia de Despacho
                    </label>
                    <select
                      value={orderUrgency}
                      onChange={(e) => setOrderUrgency(e.target.value as "normal" | "urgent" | "express_caleta")}
                      className="w-full min-h-12 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                    >
                      <option value="normal" className="bg-[#0B1528] text-white">Estándar (48h)</option>
                      <option value="urgent" className="bg-[#0B1528] text-white">Urgente Muelle (24h)</option>
                      <option value="express_caleta" className="bg-[#0B1528] text-white">Lancha Express Caleta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Cantidad
                    </label>
                    <div className="flex items-center min-h-12 rounded-xl bg-white/5 border border-white/10 px-2 justify-between">
                      <button
                        type="button"
                        onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-mono font-bold text-sm text-white">
                        {orderQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOrderQuantity(orderQuantity + 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instructions / Notes */}
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Instrucciones de Entrega al Muelle / Proveedor (Opcional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ej. Entregar en pontón 4 o llamar a tripulación por VHF 14"
                    className="w-full min-h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 font-mono"
                  />
                </div>

                {/* Price Calculation Summary (Strict USD Billing) */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="opacity-60">Total a Cobrar en Dólares:</span>
                    <div className="text-base font-bold text-[#00E676]">
                      ${(selectedProduct.price_usd * orderQuantity).toFixed(2)} USD
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="opacity-60">Pasarela de Pago:</span>
                    <div className="text-sm font-semibold text-white">
                      Stripe USD Checkout
                    </div>
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="marine-btn marine-btn-secondary text-xs px-4"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="marine-btn marine-btn-primary text-xs px-6 py-2.5 font-bold flex items-center gap-2"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>{isSubmitting ? "Registrando..." : "Confirmar Pedido a Puerto"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
