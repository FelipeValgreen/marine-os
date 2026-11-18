"use strict";
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Check,
  Zap,
  Building2,
  Compass,
  X,
  CreditCard,
  Ship,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/offline/db";

interface CommercializationPaywallProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: "b2c_free" | "b2c_pro" | "b2b_fleet";
  onPlanUpdated?: (newTier: "b2c_free" | "b2c_pro" | "b2b_fleet") => void;
  pushToast?: (toast: {
    title: string;
    subtitle?: string;
    tone?: "cyan" | "emerald" | "coral" | "amber";
  }) => void;
}

export function CommercializationPaywall({
  isOpen,
  onClose,
  currentTier = "b2b_fleet",
  onPlanUpdated,
  pushToast,
}: CommercializationPaywallProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleSelectPlan = async (tier: "b2c_free" | "b2c_pro" | "b2b_fleet") => {
    setIsProcessing(tier);
    try {
      // Update first organization in Dexie DB
      const orgs = await db.organizations.toArray();
      if (orgs.length > 0) {
        await db.organizations.update(orgs[0].id, { plan_tier: tier });
      }

      if (pushToast) {
        pushToast({
          title: `Suscripción Actualizada: ${
            tier === "b2b_fleet"
              ? "Plan B2B Fleet & Astillero"
              : tier === "b2c_pro"
              ? "Plan Skipper Pro"
              : "Plan Marinero Free"
          }`,
          subtitle:
            tier === "b2c_free"
              ? "Modalidad gratuita activa en modo local."
              : `Activado con éxito (${billingCycle === "annual" ? "Facturación Anual 20% OFF" : "Facturación Mensual"}).`,
          tone: "emerald",
        });
      }

      if (onPlanUpdated) {
        onPlanUpdated(tier);
      }

      onClose();
    } catch {
      if (pushToast) {
        pushToast({
          title: "Error al actualizar suscripción",
          subtitle: "No se pudo sincronizar el plan en el dispositivo.",
          tone: "coral",
        });
      }
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-full max-w-4xl rounded-3xl bg-[#040B16] border border-white/10 shadow-2xl shadow-black/80 p-5 sm:p-8 space-y-6 text-slate-100 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                    <Zap className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    Planes & Comercialización MarinOS
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Capacidades tácticas de navegación en alta mar y gestión corporativa de flotas de charter y astilleros.
                </p>
              </div>
              <button
                type="button"
                data-testid="close-paywall-modal-btn"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Billing Cycle Switch */}
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center p-1 rounded-full bg-white/5 border border-white/5">
                <button
                  type="button"
                  data-testid="billing-cycle-monthly-btn"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition ${
                    billingCycle === "monthly"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Facturación Mensual
                </button>
                <button
                  type="button"
                  data-testid="billing-cycle-annual-btn"
                  onClick={() => setBillingCycle("annual")}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 transition ${
                    billingCycle === "annual"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>Anual (20% OFF)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500 text-white font-bold">
                    Ahorro
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Cards Grid (Bento style) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Marinero Free */}
              <div
                className={`marine-card p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-5 border transition ${
                  currentTier === "b2c_free"
                    ? "border-cyan-500/50 bg-cyan-950/10"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                      Marinero
                    </span>
                    <Compass className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white">$0</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Gratis para siempre
                    </div>
                  </div>
                  <p className="text-xs text-slate-300">
                    Ideal para tripulantes, invitados y navegación deportiva básica.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 border-t border-white/5 pt-3">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>1 barco propio en modo local</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Carta náutica referencial Chiloé</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Perfil náutico y credencial digital</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-500 line-through">
                      <X className="w-4 h-4 shrink-0" />
                      <span>Gimbal UI Horizon Lock</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-500 line-through">
                      <X className="w-4 h-4 shrink-0" />
                      <span>Push-to-Talk Bitácora IA</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  data-testid="select-free-tier-btn"
                  onClick={() => handleSelectPlan("b2c_free")}
                  disabled={isProcessing !== null || currentTier === "b2c_free"}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
                    currentTier === "b2c_free"
                      ? "bg-white/5 text-slate-400 border border-white/10 cursor-default"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  {currentTier === "b2c_free" ? "Plan Activo" : "Seleccionar Free"}
                </button>
              </div>

              {/* 2. Skipper Pro */}
              <div
                className={`marine-card p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-5 border relative transition ${
                  currentTier === "b2c_pro"
                    ? "border-orange-500 bg-orange-950/20 shadow-xl shadow-orange-950/30"
                    : "border-orange-500/40 bg-orange-950/10 hover:border-orange-500/60"
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-orange-500 text-white font-mono text-[10px] font-black uppercase tracking-wider shadow-md">
                  Más Popular
                </div>

                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-orange-400">
                      Skipper Pro
                    </span>
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white">
                      {billingCycle === "annual" ? "$15.8" : "$19"}
                      <span className="text-xs font-normal text-slate-400 ml-1">USD/mes</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {billingCycle === "annual" ? "Facturado $190 USD al año" : "Cobro mensual"}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300">
                    Armadores y skippers que exigen control anti-mareo y voz en alta mar.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-200 border-t border-white/5 pt-3">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>Modo Alta Mar Táctico Ilimitado</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>Gimbal UI Horizon Lock (Anti-Mareo)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>Push-to-Talk AI Manos Libres</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>Radio VHF Digital & Radar &lt;10 MN</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>Vigía Fondeo con Alarma de Garreo</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>Hasta 2 embarcaciones registradas</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  data-testid="select-pro-tier-btn"
                  onClick={() => handleSelectPlan("b2c_pro")}
                  disabled={isProcessing !== null || currentTier === "b2c_pro"}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
                    currentTier === "b2c_pro"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 cursor-default"
                      : "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/50"
                  }`}
                >
                  {currentTier === "b2c_pro" ? (
                    "Plan Activo"
                  ) : (
                    <>
                      <span>Activar Skipper Pro</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* 3. B2B Fleet & Astilleros */}
              <div
                className={`marine-card p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-5 border transition ${
                  currentTier === "b2b_fleet"
                    ? "border-emerald-500/60 bg-emerald-950/20 shadow-xl"
                    : "border-white/5 bg-white/[0.02] hover:border-emerald-500/30"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                      B2B Fleet & Astilleros
                    </span>
                    <Building2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white">
                      {billingCycle === "annual" ? "$69" : "$79"}
                      <span className="text-xs font-normal text-slate-400 ml-1">USD/barco/mes</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {billingCycle === "annual" ? "Facturación anual consolidada" : "Cobro mensual por flota"}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300">
                    Empresas de charter, armadores de flotas, astilleros y concesionarios.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-200 border-t border-white/5 pt-3">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Flota de Barcos Ilimitada</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Genesis Handover (Dealer a Dueño)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Libro Mantenimiento Inmutable SHA-256</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Handover de Charter con Fotos & Firma</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>OCR Licencias DIRECTEMAR & Tripulación</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Conciliación Split-Bill & Combustible</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  data-testid="select-fleet-tier-btn"
                  onClick={() => handleSelectPlan("b2b_fleet")}
                  disabled={isProcessing !== null || currentTier === "b2b_fleet"}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
                    currentTier === "b2b_fleet"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50"
                  }`}
                >
                  {currentTier === "b2b_fleet" ? (
                    "Plan Activo"
                  ) : (
                    <>
                      <span>Activar B2B Fleet</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Enterprise Notice */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Garantía de Grace Period Offline de 14 días para operaciones sin conexión satelital.
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Webpay Plus / Stripe / Transferencia B2B</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
