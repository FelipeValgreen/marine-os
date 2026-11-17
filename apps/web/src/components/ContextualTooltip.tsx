"use client";

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Check } from "lucide-react";
import { db, enqueueOfflineMutation } from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

interface ContextualTooltipProps {
  preferenceKey: "tooltip_gps_seen" | "tooltip_zarpe_pdf_seen";
  title: string;
  description: string;
  positionClass?: string;
}

export function ContextualTooltip({
  preferenceKey,
  title,
  description,
  positionClass = "top-full left-0 mt-3",
}: ContextualTooltipProps) {
  const { theme } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const prefs = useLiveQuery(() => db.user_preferences.get("default"), []);

  // Only show if preferences loaded and this tooltip has not been seen yet
  if (!prefs || prefs[preferenceKey] === true) {
    return null;
  }

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedAt = new Date().toISOString();
    const updatePatch =
      preferenceKey === "tooltip_gps_seen"
        ? { tooltip_gps_seen: true, updated_at: updatedAt }
        : { tooltip_zarpe_pdf_seen: true, updated_at: updatedAt };
    await db.user_preferences.update("default", updatePatch);
    await enqueueOfflineMutation({
      table_name: "user_preferences",
      operation: "UPDATE",
      record_id: "default",
      payload: { id: "default", ...updatePatch },
    });
  };

  return (
    <div
      data-testid={`contextual-tooltip-${preferenceKey}`}
      onClick={handleDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleDismiss(e as unknown as React.MouseEvent);
        }
      }}
      className={`absolute ${positionClass} z-50 w-72 sm:w-80 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 animate-pulse ${
        isNight
          ? "bg-black border border-[#FF1E1E] text-[#FF1E1E] shadow-xl shadow-black/90"
          : "bg-[#040B16] border border-[var(--accent-primary)]/50 text-slate-100 shadow-xl shadow-black/90"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{title}</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">
          NUEVO
        </span>
      </div>

      <p className="text-xs leading-relaxed opacity-90 mt-1.5">{description}</p>

      <button
        type="button"
        onClick={handleDismiss}
        className={`mt-2.5 w-full min-h-14 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1.5 ${
          isNight
            ? "bg-red-950/40 text-red-500 border border-red-800"
            : "bg-[#1a2332] text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 hover:bg-[#222e42]"
        }`}
      >
        <Check className="w-4 h-4" />
        <span>Entendido • Ocultar Guía</span>
      </button>
    </div>
  );
}
