"use client";

import { motion, useReducedMotion, useTransform, type MotionValue, useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";
import type { TutorState } from "@/lib/tutor";

const STATE_LABEL: Record<TutorState, string> = {
  idle: "BoloBuddy is waiting",
  greeting: "BoloBuddy is waving hello",
  speaking: "BoloBuddy is speaking",
  listening: "BoloBuddy is listening",
  thinking: "BoloBuddy is thinking",
  encouraging: "BoloBuddy is cheering you on",
  explaining: "BoloBuddy is explaining",
  celebrating: "BoloBuddy is celebrating",
  error: "BoloBuddy is reassuring you",
};

/** SVG owl tutor. Mouth openness follows the `mouth` motion value (driven by
 * the Bulbul audio analyser); all other motion is state-driven. */
export function TutorAvatar({ state, mouth, size = 220 }: { state: TutorState; mouth?: MotionValue<number>; size?: number }) {
  const reduce = useReducedMotion();
  const fallbackMouth = useMotionValue(0);
  const m = mouth ?? fallbackMouth;
  const mouthRy = useTransform(m, [0, 1], [2, 11]);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 2500 + Math.random() * 2500);
    };
    loop();
    return () => clearTimeout(t);
  }, [reduce]);

  const bodyAnim = reduce
    ? {}
    : state === "celebrating"
    ? { y: [0, -18, 0], rotate: [0, -4, 4, 0], transition: { repeat: Infinity, duration: 0.9 } }
    : state === "thinking"
    ? { rotate: [0, -3, 0], transition: { repeat: Infinity, duration: 2 } }
    : state === "listening"
    ? { scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 1.4 } }
    : state === "encouraging"
    ? { y: [0, -6, 0], transition: { repeat: Infinity, duration: 1 } }
    : { y: [0, -4, 0], transition: { repeat: Infinity, duration: 3, ease: "easeInOut" as const } };

  const wingRight = !reduce && (state === "greeting" || state === "celebrating")
    ? { rotate: [0, -35, 0, -35, 0], transition: { repeat: Infinity, duration: 1.2 } }
    : !reduce && state === "explaining"
    ? { rotate: [0, -20, 0], transition: { repeat: Infinity, duration: 1.8 } }
    : { rotate: 0 };

  const eyeScaleY = blink ? 0.1 : state === "celebrating" || state === "encouraging" ? 0.6 : 1;
  const sad = state === "error";

  return (
    <div role="img" aria-label={STATE_LABEL[state]} className="relative select-none" style={{ width: size, height: size }}>
      {state === "listening" && !reduce && (
        <motion.div
          className="absolute inset-4 rounded-full border-4 border-teal-400/60"
          animate={{ scale: [1, 1.15], opacity: [0.8, 0] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        />
      )}
      <motion.svg viewBox="0 0 200 200" width={size} height={size} animate={bodyAnim}>
        <ellipse cx="100" cy="188" rx="52" ry="7" fill="#1e1b4b" opacity="0.08" />
        {/* body */}
        <path d="M100 30c-42 0-62 32-62 74 0 44 24 76 62 76s62-32 62-76c0-42-20-74-62-74z" fill="#2dd4bf" />
        <path d="M100 82c-26 0-40 20-40 46 0 30 16 46 40 46s40-16 40-46c0-26-14-46-40-46z" fill="#ccfbf1" />
        {/* belly feathers */}
        <path d="M84 132q8 6 16 0q8 6 16 0M88 148q6 5 12 0q6 5 12 0" stroke="#5eead4" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* ear tufts */}
        <path d="M52 50l8-26 18 18z" fill="#14b8a6" />
        <path d="M148 50l-8-26-18 18z" fill="#14b8a6" />
        {/* wings */}
        <path d="M40 100c-14 10-16 40-4 56 8-6 14-26 12-50z" fill="#14b8a6" />
        <motion.path d="M160 100c14 10 16 40 4 56-8-6-14-26-12-50z" fill="#14b8a6" style={{ originX: "160px", originY: "100px" }} animate={wingRight} />
        {/* eyes */}
        <circle cx="76" cy="78" r="22" fill="#fff" />
        <circle cx="124" cy="78" r="22" fill="#fff" />
        <motion.g animate={{ scaleY: eyeScaleY }} style={{ originY: "78px" }} transition={{ duration: 0.08 }}>
          <motion.circle cx="78" cy="80" r="10" fill="#1e1b4b" animate={state === "thinking" && !reduce ? { cx: [78, 84, 78], cy: [80, 74, 80] } : {}} transition={{ repeat: Infinity, duration: 2 }} />
          <motion.circle cx="122" cy="80" r="10" fill="#1e1b4b" animate={state === "thinking" && !reduce ? { cx: [122, 128, 122], cy: [80, 74, 80] } : {}} transition={{ repeat: Infinity, duration: 2 }} />
          <circle cx="82" cy="76" r="3" fill="#fff" />
          <circle cx="126" cy="76" r="3" fill="#fff" />
        </motion.g>
        {/* brows */}
        <path d={sad ? "M60 56q14 -6 26 2M140 56q-14 -6 -26 2" : "M60 52q14 -8 28 0M112 52q14 -8 28 0"} stroke="#0f766e" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* cheeks */}
        <circle cx="62" cy="102" r="7" fill="#fda4af" opacity="0.6" />
        <circle cx="138" cy="102" r="7" fill="#fda4af" opacity="0.6" />
        {/* beak + mouth */}
        <path d="M92 96l8 10 8-10z" fill="#f59e0b" />
        {state === "speaking" || state === "explaining" || state === "greeting" ? (
          <motion.ellipse cx="100" cy="114" rx="8" ry={mouthRy} fill="#7c2d12" />
        ) : (
          <path d={sad ? "M90 118q10 -6 20 0" : "M88 112q12 10 24 0"} stroke="#7c2d12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        )}
        {/* reading glasses for explaining */}
        {state === "explaining" && (
          <g stroke="#4338ca" strokeWidth="3" fill="none">
            <circle cx="76" cy="78" r="24" />
            <circle cx="124" cy="78" r="24" />
            <path d="M100 76h0" />
          </g>
        )}
        {/* headphones while listening */}
        {state === "listening" && (
          <g>
            <path d="M44 80q0-56 56-56t56 56" stroke="#4338ca" strokeWidth="6" fill="none" />
            <rect x="34" y="72" width="16" height="26" rx="7" fill="#4338ca" />
            <rect x="150" y="72" width="16" height="26" rx="7" fill="#4338ca" />
          </g>
        )}
        {/* stars when celebrating */}
        {state === "celebrating" && (
          <g fill="#facc15">
            <motion.path d="M30 30l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" animate={reduce ? {} : { rotate: 360 }} transition={{ repeat: Infinity, duration: 3 }} />
            <motion.path d="M168 24l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" animate={reduce ? {} : { scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
          </g>
        )}
        {state === "thinking" && (
          <g fill="#a5b4fc">
            <circle cx="160" cy="40" r="5" />
            <circle cx="172" cy="26" r="7" />
            <circle cx="186" cy="10" r="9" />
          </g>
        )}
      </motion.svg>
    </div>
  );
}
