"use client";

import { motion } from "framer-motion";
import { AudioLines, BookOpenCheck, Ear, LineChart, Lock, Mic, Sparkles, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { TutorAvatar } from "@/components/TutorAvatar";
import { Card, LinkButton } from "@/components/ui";
import type { TutorState } from "@/lib/tutor";

const DEMO_STATES: TutorState[] = ["greeting", "speaking", "listening", "thinking", "explaining", "celebrating"];

const STEPS = [
  { icon: Ear, title: "Listen", text: "BoloBuddy reads the story aloud in a natural Sarvam Bulbul voice." },
  { icon: Mic, title: "Read aloud", text: "Your child reads into the microphone. Audio is processed, then deleted." },
  { icon: AudioLines, title: "Get gentle feedback", text: "Saaras speech recognition and our reading engine estimate accuracy and fluency." },
  { icon: Sparkles, title: "Practise smart", text: "Targeted word games are built from the words your child found tricky." },
];

export default function Landing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % DEMO_STATES.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-14 pb-10">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <span className="inline-block rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-900">Powered by Sarvam AI</span>
          <h1 className="text-5xl font-extrabold leading-tight text-indigo-950 md:text-6xl">
            A reading buddy that <span className="text-teal-600">listens</span> and helps every child shine.
          </h1>
          <p className="text-xl text-indigo-900/75">
            BoloBuddy is a friendly AI tutor for young readers in English and Hindi. It reads with your child, listens carefully, and turns tricky words into fun practice.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/onboarding" className="text-lg">Start Learning</LinkButton>
            <LinkButton href="/onboarding?demo=1" variant="secondary" className="text-lg">Try a quick demo</LinkButton>
          </div>
        </div>
        <div className="relative grid place-items-center rounded-[3rem] bg-gradient-to-br from-sky-100 via-teal-50 to-amber-50 p-8">
          <TutorAvatar state={DEMO_STATES[i]} size={280} />
          <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 rounded-full bg-white px-4 py-1 font-bold capitalize text-indigo-800 shadow">
            {DEMO_STATES[i]}
          </motion.p>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-5 text-3xl font-extrabold">How reading practice works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, n) => (
            <Card key={title}>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 text-teal-700"><Icon size={20} aria-hidden /></span>
                <span className="text-sm font-bold text-indigo-900/50">Step {n + 1}</span>
              </div>
              <h3 className="text-xl font-extrabold">{title}</h3>
              <p className="text-indigo-900/70">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card><BookOpenCheck className="mb-2 text-indigo-600" aria-hidden /><h3 className="text-xl font-extrabold">Curated stories</h3><p className="text-indigo-900/70">Levelled passages in English and Hindi with target sounds such as “sh”, “th” and Hindi matras.</p></Card>
        <Card><Trophy className="mb-2 text-amber-500" aria-hidden /><h3 className="text-xl font-extrabold">XP, streaks and quests</h3><p className="text-indigo-900/70">Rewards are earned only from real completed activities and can never be claimed twice.</p></Card>
        <Card><LineChart className="mb-2 text-teal-600" aria-hidden /><h3 className="text-xl font-extrabold">Parent and teacher view</h3><p className="text-indigo-900/70">Accuracy and words-per-minute trends, tricky words and next steps, clearly marked as automated estimates.</p></Card>
      </section>

      <section className="rounded-3xl bg-indigo-900 p-8 text-indigo-50">
        <div className="flex items-start gap-4">
          <Lock className="mt-1 shrink-0 text-teal-300" aria-hidden />
          <div>
            <h2 className="text-2xl font-extrabold text-white">Built with privacy in mind</h2>
            <p className="mt-1 text-indigo-100/90">
              We ask only for a nickname, age band and language. Recordings are sent securely to our server for transcription and are not stored. Scores are automated practice estimates, not formal assessments. Parents can delete a learner profile at any time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
