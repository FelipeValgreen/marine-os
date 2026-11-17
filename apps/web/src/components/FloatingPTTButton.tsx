"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Radio, Volume2, X, Sparkles } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/nautical";
import { db } from "@/lib/offline/db";

interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onresult: (event: ISpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface ISpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface FloatingPTTButtonProps {
  onOpenSOS?: () => void;
  onOpenDigitalVHF?: () => void;
}

export function FloatingPTTButton({ onOpenSOS, onOpenDigitalVHF }: FloatingPTTButtonProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionConstructor =
        (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;

      if (SpeechRecognitionConstructor) {
        const recognition = new SpeechRecognitionConstructor();
        recognition.lang = "es-CL";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
          setShowDialog(true);
        };

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
          let current = "";
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
        };

        recognition.onerror = () => {
          setIsListening(false);
          setIsProcessing(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const handleStartListening = () => {
    triggerHapticFeedback(20);
    setTranscript("");
    setAiResponse(null);
    setShowDialog(true);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Recognition already started
      }
    } else {
      // Browser doesn't support Web Speech API - fallback demo prompt
      setTranscript("Anota en la bitácora: Viento 18kt SW, todo despejado");
      setTimeout(() => {
        handleProcessSpeech("Anota en la bitácora: Viento 18kt SW, todo despejado");
      }, 600);
    }
  };

  const handleStopListening = () => {
    triggerHapticFeedback(15);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (transcript.trim().length > 0) {
      handleProcessSpeech(transcript);
    }
  };

  const handleProcessSpeech = async (queryText: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: queryText }),
      });
      const data = await res.json();
      const reply = data.reply || "Mensaje recibido en puente.";
      setAiResponse(reply);

      // Execute tool results in local Dexie DB if returned
      if (data.toolResults && Array.isArray(data.toolResults)) {
        for (const item of data.toolResults) {
          if (item.toolName === "log_to_logbook") {
            await db.logbook_entries.add({
              id: `ptt-log-${Date.now()}`,
              voyage_id: "demo-trip-albatros-2026",
              timestamp: new Date().toISOString(),
              lat: -41.685,
              lon: -72.825,
              sog_kn: 0,
              cog_deg: 0,
              wind_kn: 18,
              engine_hours: 1240.5,
              notes: item.args?.content || queryText,
              author: "Capitán (VHF PTT)",
            });
          }
        }
      }

      // Voice output synthesis (tactile synthetic marine radio)
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = "es-CL";
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setAiResponse("Copiado por radio de a bordo. Registrado localmente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* PTT Tactical Floating HUD Dialog */}
      {showDialog && (
        <div className="fixed bottom-24 right-4 sm:bottom-28 sm:right-8 z-50 w-[90vw] max-w-sm rounded-2xl bg-[#070F1B]/95 border border-white/10 p-4 shadow-2xl backdrop-blur-xl text-white font-mono text-xs">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-orange-400" />
              <span className="font-bold text-orange-400 uppercase tracking-wider">
                VHF PTT • COPILOTO DE VOZ
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              className="text-white/50 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Transcript / Listening State */}
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 min-h-[60px] flex items-center">
              {isListening ? (
                <div className="flex items-center gap-2 text-cyan-400 font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Escuchando... {transcript || "Habla ahora..."}</span>
                </div>
              ) : isProcessing ? (
                <div className="flex items-center gap-2 text-amber-400 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  <span>Procesando orden con Gemini...</span>
                </div>
              ) : transcript ? (
                <div className="text-white/90">
                  <span className="text-white/40">TÚ: </span>&ldquo;{transcript}&rdquo;
                </div>
              ) : (
                <div className="text-white/40">
                  Mantén presionado el botón PTT para dictar bitácora, buscar repuestos o avisos.
                </div>
              )}
            </div>

            {/* AI Radio Response */}
            {aiResponse && (
              <div className="p-3 rounded-xl bg-[#0D1929] border border-cyan-500/30 text-white space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-bold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>RESPUESTA DE RADIO:</span>
                </div>
                <p className="text-xs font-sans leading-relaxed text-cyan-100">
                  {aiResponse}
                </p>
              </div>
            )}

            {/* Quick Actions if props passed */}
            {(onOpenDigitalVHF || onOpenSOS) && (
              <div className="flex gap-2 pt-2 border-t border-white/5">
                {onOpenDigitalVHF && (
                  <button
                    type="button"
                    onClick={onOpenDigitalVHF}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px]"
                  >
                    Abrir VHF &amp; Radar
                  </button>
                )}
                {onOpenSOS && (
                  <button
                    type="button"
                    onClick={onOpenSOS}
                    className="py-1.5 px-3 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 text-[10px] font-bold"
                  >
                    SOS
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TACTICAL WALKIE-TALKIE BUTTON (Lower Right) */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-center gap-1">
        <button
          type="button"
          data-testid="floating-ptt-walkie-talkie-btn"
          onMouseDown={handleStartListening}
          onMouseUp={handleStopListening}
          onTouchStart={handleStartListening}
          onTouchEnd={handleStopListening}
          className={`relative group w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-95 ${
            isListening
              ? "bg-[#D94A1A] border-2 border-orange-400 text-white"
              : "bg-[#0A1422] hover:bg-[#101E32] border border-white/10 text-white/90"
          }`}
          title="Push-To-Talk: Mantén presionado para hablar con el copiloto"
        >
          {/* Tactical Speaker Grille lines */}
          <div className="flex gap-1 mb-1 opacity-40">
            <span className="w-1 h-1 rounded-full bg-white" />
            <span className="w-1 h-1 rounded-full bg-white" />
            <span className="w-1 h-1 rounded-full bg-white" />
          </div>

          <Mic className={`w-6 h-6 ${isListening ? "text-white animate-bounce" : "text-orange-400"}`} />
          <span className="text-[9px] font-mono font-black tracking-widest uppercase mt-0.5">
            {isListening ? "TX" : "PTT"}
          </span>
        </button>
      </div>
    </>
  );
}
