"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Radio,
  X,
  Volume2,
  VolumeX,
  Ship,
  Send,
  CheckCircle2,
} from "lucide-react";
import { triggerHapticFeedback } from "@/lib/nautical";
import { db } from "@/lib/offline/db";

interface DigitalVHFProps {
  isOpen: boolean;
  onClose: () => void;
  vesselSogKn?: number;
}

interface SimulatedShipAlert {
  id: string;
  shipName: string;
  shipType: string;
  callsign: string;
  distanceNm: number;
  bearingDeg: number;
  channel: 16 | 72 | 77;
  status: "FONDEADO" | "NAVEGANDO" | "ALERTA_MANIOBRA";
  report: string;
  timeAgo: string;
}

const NEARBY_VESSELS: SimulatedShipAlert[] = [
  {
    id: "vessel-1",
    shipName: "SV Patagonia Sur",
    shipType: "Beneteau Oceanis 46.1",
    callsign: "CB-4892",
    distanceNm: 3.2,
    bearingDeg: 245,
    channel: 72,
    status: "ALERTA_MANIOBRA",
    report:
      "Atención naves en la zona: Fondo de arena dura garreando en Caleta Mechuque con ráfagas N de 28kt. Cadena 60m filada.",
    timeAgo: "Hace 24 min",
  },
  {
    id: "vessel-2",
    shipName: "M/Y Reloncaví Express",
    shipType: "Apreamare 38 Comfort",
    callsign: "CB-2104",
    distanceNm: 1.8,
    bearingDeg: 15,
    channel: 16,
    status: "NAVEGANDO",
    report:
      "Aviso a navegantes: En la desembocadura sur del Canal Tenglo la sonda marca 1.8m en bajamar. Embarcaciones con calado >1.8m esperar media marea.",
    timeAgo: "Hace 1h",
  },
  {
    id: "vessel-3",
    shipName: "SY Caleuche",
    shipType: "Jeanneau Sun Odyssey 440",
    callsign: "CB-9021",
    distanceNm: 6.4,
    bearingDeg: 130,
    channel: 77,
    status: "FONDEADO",
    report:
      "Fondeado en Caleta La Arena. Tenedero de fango excelente con 35m de cadena. Abrigo completo de vientos del Oeste.",
    timeAgo: "Hace 2h",
  },
  {
    id: "vessel-4",
    shipName: "Don Bernardo",
    shipType: "Lancha Artesanal",
    callsign: "CAL-551",
    distanceNm: 4.1,
    bearingDeg: 190,
    channel: 16,
    status: "NAVEGANDO",
    report:
      "Corriente de vaciante muy fuerte en Paso Queullín (5.2 nudos). Respetar centro de canal y resguardar boyarines de cultivo.",
    timeAgo: "Hace 3h",
  },
];

export function DigitalVHF({ isOpen, onClose }: DigitalVHFProps) {
  const [selectedChannel, setSelectedChannel] = useState<16 | 72 | 77>(16);
  const [isSquelchMuted, setIsSquelchMuted] = useState<boolean>(false);
  const [broadcastText, setBroadcastText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sentSuccess, setSentSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const filteredVessels = NEARBY_VESSELS.filter(
    (v) => selectedChannel === 16 || v.channel === selectedChannel
  );

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setIsSending(true);
    triggerHapticFeedback(25);

    try {
      await db.community_reports.add({
        id: `broadcast-${Date.now()}`,
        author_name: "Capitán SV Albatros",
        author_license: "Patrón Deportivo",
        vessel_name: "SV Albatros",
        anchorage_slug: "seno-reloncavi-en-derrota",
        lat: -41.685,
        lon: -72.825,
        report_type: "navigation_warning",
        title: `Reporte VHF Ch${selectedChannel}`,
        content: broadcastText.trim(),
        wind_conditions: "18 kn SW",
        chain_payout_m: 0,
        seabed_type: "Aguas abiertas",
        upvotes: 1,
        created_at: new Date().toISOString(),
      });

      setSentSuccess(true);
      setBroadcastText("");
      setTimeout(() => setSentSuccess(false), 3000);
    } catch {
      // ignore
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-lg h-full bg-[#050B14] border-l border-white/10 shadow-2xl flex flex-col justify-between text-white font-mono"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-black tracking-wider uppercase text-white">
                VHF DIGITAL & RADAR SOCIAL
              </h2>
              <div className="text-[10px] text-white/50">
                TRÁFICO NÁUTICO EN RADIO &lt; 10 MILLAS NÁUTICAS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSquelchMuted(!isSquelchMuted)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
              title="Squelch / Silenciar audio de estática"
            >
              {isSquelchMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VHF Channel Selector */}
        <div className="p-3 bg-[#03070E] border-b border-white/5">
          <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 px-1">
            FRECUENCIA VHF MARINA
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { ch: 16, label: "CH 16 (EMERGENCIA)", freq: "156.800 MHz", alert: true },
              { ch: 72, label: "CH 72 (INTER-BUQUE)", freq: "156.625 MHz", alert: false },
              { ch: 77, label: "CH 77 (CLUB / PUERTO)", freq: "156.875 MHz", alert: false },
            ].map((c) => (
              <button
                key={c.ch}
                type="button"
                onClick={() => setSelectedChannel(c.ch as 16 | 72 | 77)}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  selectedChannel === c.ch
                    ? c.alert
                      ? "bg-red-950/60 border-red-500/60 text-red-300 font-bold"
                      : "bg-[#0E1B2E] border-amber-500/60 text-amber-300 font-bold"
                    : "bg-white/5 border-white/5 text-white/50 hover:text-white"
                }`}
              >
                <span className="text-xs">{c.label}</span>
                <span className="text-[9px] opacity-60 font-mono mt-0.5">{c.freq}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vessel Radar Alert Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-white/50 px-1">
            <span>BARCOS EN ESCUCHA ({filteredVessels.length})</span>
            <span>RANGO: 10 NM</span>
          </div>

          {filteredVessels.map((v) => (
            <div
              key={v.id}
              className="p-4 rounded-2xl bg-[#09121F] border border-white/10 hover:border-white/20 transition space-y-2.5 shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Ship className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-sm text-white">{v.shipName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/70">
                      {v.callsign}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {v.shipType} • Ch {v.channel}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">
                    {v.distanceNm.toFixed(1)} NM
                  </div>
                  <div className="text-[10px] text-white/50">
                    Marcación {v.bearingDeg}°
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase ${
                    v.status === "ALERTA_MANIOBRA"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-white/5 text-white/70"
                  }`}
                >
                  {v.status === "ALERTA_MANIOBRA" ? "⚠️ ALERTA DE FONDEO" : "EN NAVEGACIÓN"}
                </span>
              </div>

              {/* Tactical Report Text */}
              <p className="text-xs text-white/90 bg-black/40 p-2.5 rounded-xl border border-white/5 leading-relaxed font-sans">
                &ldquo;{v.report}&rdquo;
              </p>

              <div className="text-[10px] text-white/40 text-right">{v.timeAgo}</div>
            </div>
          ))}
        </div>

        {/* Broadcast to Fleet Dock */}
        <div className="p-4 bg-[#03070E] border-t border-white/5 space-y-2">
          {sentSuccess && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reporte emitido a la flota y guardado en memoria local.</span>
            </div>
          )}

          <form onSubmit={handleBroadcast} className="flex gap-2">
            <input
              type="text"
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder={`Transmitir por Ch ${selectedChannel} a naves a < 10 NM...`}
              className="flex-1 bg-[#0A1422] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={isSending || !broadcastText.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-black text-xs flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>TX</span>
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
