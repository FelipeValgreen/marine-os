"use client";

import React, { useEffect } from "react";
import { ShieldCheck, Hash, CheckCircle2, X } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/nautical";

interface CryptoStampOverlayProps {
  visible: boolean;
  title: string;
  subtitle: string;
  sha256Hash: string;
  tokenBadge?: string;
  onDismiss: () => void;
}

/**
 * Fluid Cryptographic SHA-256 Stamp Overlay ("Sello SHA-256 cayendo sobre la pantalla")
 * Triggered when generating/transmitting the DIRECTEMAR Zarpe PDF or sealing the Handover Inspection.
 */
export function CryptoStampOverlay({
  visible,
  title,
  subtitle,
  sha256Hash,
  tokenBadge,
  onDismiss,
}: CryptoStampOverlayProps) {
  useEffect(() => {
    if (!visible) return;
    triggerHapticFeedback([30, 50, 90]);
    const timer = setTimeout(() => {
      onDismiss();
    }, 3600);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      data-testid="crypto-sha256-stamp-overlay"
      onClick={onDismiss}
      className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sha-stamp relative max-w-lg w-full rounded-3xl p-6 sm:p-8 border-4 border-[var(--status-ok)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[0_0_70px_rgba(16,185,129,0.45)] space-y-4"
      >
        {/* Double-Ring Stamp Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[var(--status-ok)]/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--status-ok)]/20 border-2 border-[var(--status-ok)] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8 text-[var(--status-ok)]" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--status-ok)] font-black">
                SELLO CRIPTOGRÁFICO INMUTABLE • SHA-256
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            data-testid="dismiss-sha-stamp-btn"
            onClick={onDismiss}
            className="min-h-14 px-3 rounded-xl bg-white/5 hover:bg-white/10 font-mono text-xs flex items-center justify-center"
            aria-label="Cerrar sello"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stamp Body */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="opacity-80">{subtitle}</span>
            {tokenBadge && (
              <span className="px-3 py-1 rounded-full bg-[var(--status-ok)] text-[var(--bg-primary)] font-black">
                {tokenBadge}
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border border-[var(--status-ok)]/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--status-ok)] font-bold">
              <Hash className="w-3.5 h-3.5" />
              <span>DIGEST SHA-256 VERIFICADO EN CLIENTE (WEB CRYPTO API):</span>
            </div>
            <div
              data-testid="crypto-stamp-hash-value"
              className="text-xs sm:text-sm font-bold break-all tracking-wider text-[var(--accent-primary)]"
            >
              {sha256Hash}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] opacity-75 pt-1">
            <span className="flex items-center gap-1.5 text-[var(--status-ok)] font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>PERSISTIDO EN INDEXEDDB + SYNC_QUEUE</span>
            </span>
            <span>{new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
