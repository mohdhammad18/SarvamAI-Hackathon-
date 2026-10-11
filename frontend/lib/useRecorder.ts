"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toWav16k } from "./wav";

const SILENCE_RMS = 0.004;

export type RecState = "idle" | "requesting" | "recording" | "paused" | "stopped" | "error";

export const MAX_SECONDS = 30;

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export function useRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0));
  const [silent, setSilent] = useState(false);
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [deviceId, setDeviceIdState] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("bolobuddy.mic") ?? "" : ""));
  const [peak, setPeak] = useState(0);
  const setDeviceId = (id: string) => { setDeviceIdState(id); localStorage.setItem("bolobuddy.mic", id); };

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` })));
    } catch { /* ignore */ }
  }, []);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const accumulated = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef(0);
  const acRef = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    cancelAnimationFrame(raf.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    acRef.current?.close().catch(() => {});
    acRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setSilent(false);
    setElapsed(0);
    accumulated.current = 0;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("error");
      setError("This browser can't record audio. Please try Chrome, Edge or Safari.");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      refreshDevices();
      setPeak(0);
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        accumulated.current += rec.state === "inactive" && startedAt.current ? (performance.now() - startedAt.current) / 1000 : 0;
        startedAt.current = 0;
        setElapsed(Math.round(accumulated.current * 10) / 10);
        cleanup();
        const raw = new Blob(chunks.current, { type: (rec.mimeType || "audio/webm").split(";")[0] });
        toWav16k(raw)
          .then(({ wav, duration, rms }) => {
            setBlob(wav);
            setElapsed(Math.round(duration * 10) / 10);
            setSilent(rms < SILENCE_RMS);
          })
          .catch(() => setBlob(raw))
          .finally(() => setState("stopped"));
      };
      const ac = new AudioContext();
      acRef.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 64;
      ac.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setLevels(Array.from(buf.slice(0, 24), (v) => v / 255));
        const mx = Math.max(...buf) / 255;
        setPeak((p) => Math.max(p * 0.95, mx));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      rec.start(250);
      startedAt.current = performance.now();
      setState("recording");
      timer.current = setInterval(() => {
        const secs = accumulated.current + (startedAt.current ? (performance.now() - startedAt.current) / 1000 : 0);
        setElapsed(Math.round(secs * 10) / 10);
        if (secs >= MAX_SECONDS) stop();
      }, 100);
    } catch (e) {
      cleanup();
      setState("error");
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Click the lock icon in the address bar, allow the microphone, then try again."
          : name === "NotFoundError"
          ? "No microphone was found. Please connect one and try again."
          : "We couldn't start the microphone. Please try again.",
      );
    }
  }, [cleanup, stop, deviceId, refreshDevices]);

  const pause = useCallback(() => {
    const rec = recRef.current;
    if (rec?.state === "recording") {
      rec.pause();
      accumulated.current += (performance.now() - startedAt.current) / 1000;
      startedAt.current = 0;
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    const rec = recRef.current;
    if (rec?.state === "paused") {
      rec.resume();
      startedAt.current = performance.now();
      setState("recording");
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setBlob(null);
    setSilent(false);
    setElapsed(0);
    setState("idle");
    setError(null);
  }, [cleanup]);

  return { state, elapsed, blob, error, levels, silent, peak, devices, deviceId, setDeviceId, refreshDevices, start, stop, pause, resume, reset };
}
