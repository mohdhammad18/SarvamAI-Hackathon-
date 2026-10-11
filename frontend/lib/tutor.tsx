"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { API_URL } from "./api";

export type TutorState =
  | "idle" | "greeting" | "speaking" | "listening" | "thinking"
  | "encouraging" | "explaining" | "celebrating" | "error";

type VoiceSource = "sarvam" | "browser-demo" | null;

type TutorCtx = {
  state: TutorState;
  setState: (s: TutorState) => void;
  message: string;
  voiceSource: VoiceSource;
  mouth: MotionValue<number>;
  speak: (text: string, language: string, opts?: { after?: TutorState; pace?: number; during?: TutorState }) => Promise<void>;
  stop: () => void;
  lastSpoken: { text: string; language: string } | null;
};

const Ctx = createContext<TutorCtx | null>(null);
const audioCache = new Map<string, string>();

export function TutorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorState>("idle");
  const [message, setMessage] = useState("");
  const [voiceSource, setVoiceSource] = useState<VoiceSource>(null);
  const [lastSpoken, setLastSpoken] = useState<{ text: string; language: string } | null>(null);
  const mouth = useMotionValue(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    cancelAnimationFrame(rafRef.current);
    mouth.set(0);
  }, [mouth]);

  const speak = useCallback<TutorCtx["speak"]>(async (text, language, opts = {}) => {
    stop();
    setMessage(text);
    setLastSpoken({ text, language });
    const after = opts.after ?? "idle";
    const key = `${language}|${opts.pace ?? 0.9}|${text}`;
    let url = audioCache.get(key);
    if (!url) {
      setState("thinking");
      const res = await fetch(`${API_URL}/api/v1/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language_code: language, pace: opts.pace ?? 0.9 }),
      }).catch(() => null);
      if (res?.ok) {
        url = URL.createObjectURL(await res.blob());
        audioCache.set(key, url);
      } else {
        const body = await res?.json().catch(() => null);
        if (body?.error?.code === "tts_demo_mode" && "speechSynthesis" in window) {
          setVoiceSource("browser-demo");
          setState(opts.during ?? "speaking");
          await new Promise<void>((resolve) => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = language;
            u.rate = 0.9;
            const iv = setInterval(() => mouth.set(Math.random() * 0.8 + 0.2), 120);
            u.onend = u.onerror = () => { clearInterval(iv); mouth.set(0); resolve(); };
            window.speechSynthesis.speak(u);
          });
          setState(after);
          return;
        }
        setState("error");
        setMessage("I lost my voice for a moment. You can read my words here.");
        return;
      }
    }
    setVoiceSource("sarvam");
    const audio = new Audio(url);
    audioRef.current = audio;
    try {
      ctxRef.current ??= new AudioContext();
      const ac = ctxRef.current;
      const src = ac.createMediaElementSource(audio);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ac.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 2; i < 40; i++) sum += buf[i];
        mouth.set(Math.min(1, sum / 38 / 140));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* analyser optional; audio still plays */
    }
    setState(opts.during ?? "speaking");
    await new Promise<void>((resolve) => {
      audio.onended = audio.onerror = audio.onpause = () => resolve();
      audio.play().catch(() => resolve());
    });
    cancelAnimationFrame(rafRef.current);
    mouth.set(0);
    setState(after);
  }, [mouth, stop]);

  return (
    <Ctx.Provider value={{ state, setState, message, voiceSource, mouth, speak, stop, lastSpoken }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTutor() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTutor outside TutorProvider");
  return c;
}
