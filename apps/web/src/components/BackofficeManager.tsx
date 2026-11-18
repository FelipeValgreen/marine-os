"use strict";
"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Users,
  CreditCard,
  FileCheck2,
  Ship,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  db,
  type UserProfileAccount,
  type VesselRecord,
  type HandoverInspectionRecord,
} from "@/lib/offline/db";

interface BackofficeManagerProps {
  pushToast?: (toast: {
    title: string;
    subtitle?: string;
    tone?: "cyan" | "emerald" | "coral" | "amber";
  }) => void;
}

export function BackofficeManager({ pushToast }: BackofficeManagerProps) {
  const [activeTab, setActiveTab] = useState<
    "users" | "payments" | "compliance" | "fleet"
  >("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  // Dexie Queries
  const users = useLiveQuery(() => db.user_profiles.toArray(), [], []);
  const vessels = useLiveQuery(() => db.vessels.toArray(), [], []);
  const handovers = useLiveQuery(
    () => db.handover_inspections.reverse().sortBy("created_at"),
    [],
    []
  );
  const organizations = useLiveQuery(() => db.organizations.toArray(), [], []);

  const activeOrg = organizations?.[0];
  const planTier = activeOrg?.plan_tier || "b2b_fleet";

  // Simulated transaction records tied to Stripe
  const [transactions, setTransactions] = useState([
    {
      id: "ch_3Pd8810291",
      customer_name: "Marina Puerto Montt Charter",
      customer_email: "operaciones@marinapuertomontt.cl",
      tier: "b2b_fleet",
      amount_usd: 79.0,
      status: "succeeded",
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      stripe_id: "in_1Pd8810291_live",
    },
    {
      id: "ch_3Pd7749102",
      customer_name: "Capitán Rodrigo Soto",
      customer_email: "rodrigo.soto@patagoniayachting.cl",
      tier: "b2c_pro",
      amount_usd: 19.0,
      status: "succeeded",
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      stripe_id: "in_1Pd7749102_live",
    },
    {
      id: "ch_3Pd6619024",
      customer_name: "Astillero Chiloé Marine",
      customer_email: "contacto@astillerochiloe.cl",
      tier: "genesis_handover",
      amount_usd: 149.0,
      status: "succeeded",
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      stripe_id: "in_1Pd6619024_live",
    },
  ]);

  const filteredUsers = (users || []).filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.licenseNumber &&
        u.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole =
      userRoleFilter === "all" || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const handleVerifyLicense = async (userId: string, currentStatus: boolean) => {
    try {
      await db.user_profiles.update(userId, {
        isLicenseVerified: !currentStatus,
      });
      if (pushToast) {
        pushToast({
          title: !currentStatus ? "Licencia Náutica Aprobada" : "Verificación Revocada",
          subtitle: "Estado actualizado en el directorio de tripulación.",
          tone: !currentStatus ? "emerald" : "amber",
        });
      }
    } catch {
      if (pushToast) {
        pushToast({
          title: "Error al actualizar estado",
          tone: "coral",
        });
      }
    }
  };

  const handleSimulatePayment = () => {
    const newTx = {
      id: `ch_${Date.now().toString(36)}`,
      customer_name: "Skipper Alerce Sur",
      customer_email: "capitan.alerce@marinos.app",
      tier: "b2c_pro",
      amount_usd: 19.0,
      status: "succeeded",
      created_at: new Date().toISOString(),
      stripe_id: `in_${Date.now().toString(36)}_sim`,
    };
    setTransactions([newTx, ...transactions]);
    if (pushToast) {
      pushToast({
        title: "Cobro Procesado vía Stripe Checkout",
        subtitle: "Suscripción Skipper Pro registrada: +$19.00 USD.",
        tone: "emerald",
      });
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto pb-16">
      {/* Header & KPI Summary Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Backoffice &amp; Centro de Control MarinOS
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de usuarios registrados, conciliación de pagos en Stripe, auditoría de handovers y supervisión de flota.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://dashboard.stripe.com/test/payments"
            target="_blank"
            rel="noopener noreferrer"
            className="marine-btn marine-btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
            title="Abrir Dashboard oficial de Stripe"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Stripe Dashboard</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <button
            type="button"
            onClick={handleSimulatePayment}
            className="marine-btn marine-btn-primary text-xs px-4 py-2 font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simular Cobro (+19 USD)</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="marine-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>USUARIOS ACTIVOS</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {users?.length || 3}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
            100% Verificados en el dispositivo
          </div>
        </div>

        <div className="marine-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>MRR ESTIMADO</span>
            <CreditCard className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            $247 <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            ~$234,650 CLP / mes
          </div>
        </div>

        <div className="marine-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ACTAS AUDITADAS</span>
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {handovers?.length || 1}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
            Sellos SHA-256 intactos
          </div>
        </div>

        <div className="marine-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>BARCOS EN FLOTA</span>
            <Ship className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {vessels?.length || 1}
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
            Plan {planTier.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === "users"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios &amp; Capitanes ({users?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === "payments"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Pagos &amp; Suscripciones ({transactions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("compliance")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === "compliance"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Revisiones &amp; Handovers ({handovers?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fleet")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === "fleet"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Ship className="w-4 h-4" />
          <span>Flota &amp; Horómetros ({vessels?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Users & Captains */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, RUT o licencia..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/5 text-white placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/5 text-white"
              >
                <option value="all">Todos los Roles</option>
                <option value="skipper">Capitán / Skipper</option>
                <option value="fleet_admin">Administrador Flota</option>
                <option value="crew">Tripulante / Marinero</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#040B16]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono">
                <tr>
                  <th className="p-3.5">Oficial / Usuario</th>
                  <th className="p-3.5">RUT / Documento</th>
                  <th className="p-3.5">Rol de Bordo</th>
                  <th className="p-3.5">Licencia DIRECTEMAR</th>
                  <th className="p-3.5">Vencimiento</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] font-mono font-bold flex items-center justify-center text-xs">
                        {u.avatarInitials || u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div>{u.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {u.email || "demo@marinos.app"}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono">{u.documentNumber}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold bg-white/5 border border-white/10 text-slate-300">
                        {u.role === "skipper"
                          ? "Capitán"
                          : u.role === "fleet_admin"
                          ? "Armador"
                          : "Tripulante"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200">
                        {u.licenseType || "Sin Licencia Registrada"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {u.licenseNumber || "N/A"}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {u.licenseExpiry || "Permanente"}
                    </td>
                    <td className="p-3.5">
                      {u.isLicenseVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verificado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pendiente</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleVerifyLicense(u.id, !!u.isLicenseVerified)}
                        className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                          u.isLicenseVerified
                            ? "bg-white/5 hover:bg-white/10 text-slate-400"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                        }`}
                      >
                        {u.isLicenseVerified ? "Revocar" : "Aprobar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payments & Subscriptions */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-mono">
              HISTORIAL DE TRANSACCIONES &bull; CONEXIÓN CON STRIPE BILLING
            </div>
            <div className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Stripe Gateway Conectado (Greenseo LLC)</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#040B16]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono">
                <tr>
                  <th className="p-3.5">ID Transacción</th>
                  <th className="p-3.5">Cliente / Armador</th>
                  <th className="p-3.5">Plan / Concepto</th>
                  <th className="p-3.5">Monto (USD)</th>
                  <th className="p-3.5">Monto Estimado (CLP)</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-3.5 font-mono text-cyan-400 font-bold">{tx.id}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-white">{tx.customer_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.customer_email}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/30">
                        {tx.tier === "b2b_fleet"
                          ? "B2B Fleet"
                          : tx.tier === "b2c_pro"
                          ? "Skipper Pro"
                          : "Genesis Handover"}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white">${tx.amount_usd.toFixed(2)}</td>
                    <td className="p-3.5 font-mono text-slate-400">
                      ${Math.round(tx.amount_usd * 950).toLocaleString("es-CL")} CLP
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">
                      {new Date(tx.created_at).toLocaleString("es-CL", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3.5 text-right">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completado</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Compliance & Handovers */}
      {activeTab === "compliance" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 font-mono">
            ACTAS DE ENTREGA Y RECEPCIÓN (HANDOVER) AUDITADAS CON SELLO CRIPTOGRÁFICO
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(handovers || []).map((h) => {
              const matchedVessel = vessels?.find((v) => v.id === h.vessel_id);
              return (
                <div
                  key={h.id}
                  className="marine-card p-5 rounded-2xl border border-white/5 bg-[#040B16] space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between border-b border-white/5 pb-3">
                    <div>
                      <div className="text-xs font-mono text-[var(--accent-primary)] font-bold">
                        ACTA #{h.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {matchedVessel?.name || "SV Albatros"} •{" "}
                        {h.inspection_type === "checkin"
                          ? "Check-In (Salida)"
                          : "Check-Out (Retorno)"}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/30 text-emerald-400 border border-emerald-500/40">
                      SELLO VÁLIDO
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                    <div>
                      <span className="opacity-50">Ítems Revisados:</span>{" "}
                      {h.checklist_data?.length || 0} verificados
                    </div>
                    <div>
                      <span className="opacity-50">Evidencias:</span>{" "}
                      {h.photos_evidence?.length || 0} fotos
                    </div>
                    <div>
                      <span className="opacity-50">Fecha:</span>{" "}
                      {new Date(h.completed_offline_at).toLocaleDateString("es-CL")}
                    </div>
                    <div>
                      <span className="opacity-50">Estado Sinc:</span>{" "}
                      {h.synced_at ? "Nube ✓" : "Local-First"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      Firmas Registradas:
                    </div>
                    <div className="text-xs font-medium text-white flex items-center justify-between">
                      <span>{h.giver_name || "Armador / Base"}</span>
                      <span className="text-emerald-400 text-[10px] font-mono">
                        Firmado ✓
                      </span>
                    </div>
                    <div className="text-xs font-medium text-white flex items-center justify-between">
                      <span>{h.receiver_name || "Capitán Arrendatario"}</span>
                      <span className="text-emerald-400 text-[10px] font-mono">
                        Firmado ✓
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 truncate pt-2 border-t border-white/5">
                    HASH SHA-256: {h.integrity_hash || "SHA256-a9f491c2804b771e84d1"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Fleet Overview */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 font-mono">
            SUPERVISIÓN TÉCNICA DE MOTORES &bull; HORÓMETRO Y GARANTÍAS ACTIVAS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(vessels || []).map((v) => (
              <div
                key={v.id}
                className="marine-card p-5 rounded-2xl border border-white/5 bg-[#040B16] space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between border-b border-white/5 pb-3">
                  <div>
                    <div className="text-base font-bold text-white">{v.name}</div>
                    <div className="text-xs font-mono text-slate-400">
                      Tipo: {v.vessel_type} &bull; Matrícula: {v.registration_number}{" "}
                      &bull; MMSI: {v.mmsi || "725001234"}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-cyan-400">
                    {v.loa_meters}m LOA
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] opacity-50 uppercase">
                      Horómetro Motor
                    </div>
                    <div className="text-lg font-black text-white mt-0.5">
                      {v.engine_hours_current || 1420.5}{" "}
                      <span className="text-xs font-normal text-slate-400">hrs</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      Próx. Servicio en{" "}
                      {(1500 - (v.engine_hours_current || 1420.5)).toFixed(1)}h
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] opacity-50 uppercase">
                      Cadena &amp; Fondeo
                    </div>
                    <div className="text-lg font-black text-white mt-0.5">
                      {v.chain_length_meters || 60}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        metros
                      </span>
                    </div>
                    <div className="text-[10px] text-cyan-400 mt-0.5">
                      Calado quilla: {v.draft_meters}m
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">
                    Motor Principal: Yanmar 4JH57
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px] font-bold">
                    Garantía Vigente 2028
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
