"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useTutor } from "@/lib/tutor";
import { TutorAvatar } from "./TutorAvatar";

export function TutorPanel({ size = 180, compact = false }: { size?: number; compact?: boolean }) {
  const { state, message, mouth, speak, lastSpoken, voiceSource } = useTutor();
  return (
    <div className={`flex ${compact ? "flex-row items-center" : "flex-col items-center"} gap-3`}>
      <TutorAvatar state={state} mouth={mouth} size={size} />
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative max-w-sm rounded-3xl bg-white px-5 py-4 text-lg font-semibold text-indigo-950 shadow-md ring-1 ring-indigo-50"
            aria-live="polite"
          >
            {message}
            <div className="mt-2 flex items-center gap-2">
              {lastSpoken && (
                <button
                  onClick={() => speak(lastSpoken.text, lastSpoken.language)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                >
                  <RotateCcw size={12} aria-hidden /> Replay
                </button>
              )}
              {voiceSource === "browser-demo" && <span className="text-xs font-semibold text-amber-700">Browser voice (demo mode)</span>}
              {voiceSource === "sarvam" && <span className="text-xs font-semibold text-teal-700">Voice: Sarvam Bulbul</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
