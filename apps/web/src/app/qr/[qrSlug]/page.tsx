"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  QrCode,
  Play,
  Pause,
  MapPin,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  Wrench,
  ArrowLeft,
} from "lucide-react";
import {
  db,
  enqueueOfflineMutation,
  type InventoryItemRecord,
} from "@/lib/offline/db";

export default function QRSystemTwinPage() {
  const params = useParams<{ qrSlug: string }>();
  const qrSlug = params?.qrSlug || "yanmar-4jh57";

  const qrSystem = useLiveQuery(
    () => db.vessel_systems_qr.where("qr_slug").equals(qrSlug).first(),
    [qrSlug]
  );

  const allQrSystems = useLiveQuery(
    () => db.vessel_systems_qr.toArray(),
    [],
    []
  );

  const linkedInventory = useLiveQuery<
    InventoryItemRecord[],
    InventoryItemRecord[]
  >(
    () =>
      qrSystem
        ? db.inventory_items.where("qr_node_id").equals(qrSystem.id).toArray()
        : Promise.resolve([] as InventoryItemRecord[]),
    [qrSystem],
    []
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoSeconds, setVideoSeconds] = useState<number>(0);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setVideoSeconds((prev) => {
        if (prev >= 28) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleAdjustStockOffline = async (
    itemId: string,
    delta: number,
    currentQty: number
  ) => {
    const nextQty = Math.max(0, currentQty + delta);
    const updatedAt = new Date().toISOString();
    await db.inventory_items.update(itemId, {
      quantity: nextQty,
      updated_at: updatedAt,
    });
    await enqueueOfflineMutation({
      table_name: "inventory_items",
      operation: "UPDATE",
      record_id: itemId,
      payload: { id: itemId, quantity: nextQty, updated_at: updatedAt },
    });
  };

  const steps = (qrSystem?.quick_instructions || "")
    .split(/\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="marine-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="marine-btn marine-btn-secondary text-xs px-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Bridge</span>
          </Link>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <QrCode className="w-5 h-5 text-[var(--accent-primary)]" />
            <span>Nodos QR Gemelo Digital (Caché Local 0ms)</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allQrSystems.map((node) => (
            <Link
              key={node.id}
              href={`/qr/${node.qr_slug}`}
              className={`marine-btn text-xs px-3.5 ${
                node.qr_slug === qrSlug
                  ? "marine-btn-primary"
                  : "marine-btn-secondary"
              }`}
            >
              <span>{node.system_name}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 marine-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <span className="text-[11px] font-mono uppercase text-[var(--accent-primary)]">
                QR SLUG • {qrSlug}
              </span>
              <h1 className="text-2xl font-semibold mt-1">
                {qrSystem?.system_name ||
                  "Cargando Nodo QR desde IndexedDB..."}
              </h1>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#00E676]/15 text-[#00E676]">
              OFFLINE READY
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono opacity-80">
            <MapPin className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>
              Compartimento:{" "}
              <strong>
                {qrSystem?.compartment_location || "Salón Principal"}
              </strong>
            </span>
          </div>

          <div className="rounded-2xl p-5 bg-[#040B16] border border-white/5 font-mono space-y-4">
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2 text-[var(--accent-primary)]">
              <span>MICRO-TUTORIAL OPERATIVO (28 SEG)</span>
              <span>00:{String(videoSeconds).padStart(2, "0")} / 00:28</span>
            </div>

            <div className="h-44 flex flex-col items-center justify-center text-center px-4 rounded-xl bg-white/[0.02] border border-white/5">
              <Wrench
                className={`w-9 h-9 mb-2 text-[var(--accent-primary)] ${
                  isPlaying ? "animate-spin" : ""
                }`}
              />
              <div className="text-sm font-semibold">
                {videoSeconds < 10
                  ? "PASO 1: INSPECCIÓN DE VÁLVULA Y GRIFO DE FONDO"
                  : videoSeconds < 20
                  ? "PASO 2: VERIFICACIÓN DE NIVELES / PRESIÓN"
                  : "PASO 3: OPERACIÓN SEGURA Y BLOQUEO"}
              </div>
              <p className="text-xs mt-2 opacity-75">
                {qrSystem?.quick_instructions}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="marine-btn marine-btn-primary text-xs px-4"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Reproducir (28s)</span>
                  </>
                )}
              </button>
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all"
                  style={{
                    width: `${Math.min(100, (videoSeconds / 28) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="marine-card p-6 space-y-3">
            <h2 className="text-lg font-semibold border-b border-white/5 pb-2.5">
              Guía Rápida de Operación a Bordo
            </h2>
            {steps.length > 1 ? (
              <ol className="space-y-2.5 text-sm">
                {steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3"
                  >
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      0{idx + 1}
                    </span>
                    <span className="opacity-90">{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-sm">
                {qrSystem?.quick_instructions}
              </div>
            )}
          </div>

          <div className="marine-card p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-white/5 pb-2.5">
              <Package className="w-5 h-5 text-[var(--accent-primary)]" />
              <span>Repuestos Vinculados ({linkedInventory.length})</span>
            </h2>

            {linkedInventory.length === 0 ? (
              <p className="text-xs font-mono opacity-70">
                Sin consumibles críticos registrados en este nodo.
              </p>
            ) : (
              <div className="space-y-2.5">
                {linkedInventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-sm">{item.item_name}</div>
                      <div className="text-xs font-mono opacity-70">
                        {item.category} • Mínimo: {item.min_threshold} uds
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustStockOffline(item.id, -1, item.quantity)
                        }
                        className="marine-btn marine-btn-secondary px-3"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-mono font-bold text-sm px-3.5 py-2 rounded-xl bg-white/5 border border-white/5">
                        {item.quantity} uds
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustStockOffline(item.id, 1, item.quantity)
                        }
                        className="marine-btn marine-btn-secondary px-3"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono flex items-center gap-2 opacity-75">
              <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
              <span>Sincronización diferencial activa en sync_queue.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
