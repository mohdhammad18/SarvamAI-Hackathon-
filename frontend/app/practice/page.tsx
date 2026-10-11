"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EXERCISES, OutcomeBanner, type Outcome, type PracticeItem } from "@/components/exercises";
import { TutorPanel } from "@/components/TutorPanel";
import { Button, Card, ErrorBox, LinkButton, Progress, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useTutor } from "@/lib/tutor";
import { getLearnerId } from "@/lib/useLearner";

type PracticeSet = { items: PracticeItem[]; words: string[]; source: string; phoneme_feedback: string };

export default function PracticePage() {
  const router = useRouter();
  const tutor = useTutor();
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [idx, setIdx] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ correct: 0, xp: 0 });
  const [error, setError] = useState<string | null>(null);
  const learnerId = typeof window !== "undefined" ? getLearnerId() : null;

  const load = useCallback(async () => {
    const id = getLearnerId();
    if (!id) return router.replace("/onboarding");
    setError(null);
    setSet(null);
    setIdx(0);
    setOutcome(null);
    setScore({ correct: 0, xp: 0 });
    try {
      setSet(await api<PracticeSet>(`/learners/${id}/practice`));
      tutor.setState("greeting");
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorBox onRetry={load}>{error}</ErrorBox>;
  if (!set || !learnerId) return <Spinner label="Building your practice…" />;

  const done = idx >= set.items.length;
  if (done) {
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <TutorPanel size={200} />
        <h1 className="text-4xl font-extrabold">Practice complete!</h1>
        <p className="text-xl">You got {score.correct} of {set.items.length} and earned <b>{score.xp} XP</b>.</p>
        <div className="flex gap-3">
          <Button onClick={load}>Practise again</Button>
          <LinkButton href="/dashboard" variant="secondary">Back home</LinkButton>
        </div>
      </Card>
    );
  }

  const item = set.items[idx];
  const ex = EXERCISES[item.type];
  const Ex = ex.Component;

  function handleDone(o: Outcome) {
    setOutcome(o);
    setScore((s) => ({ correct: s.correct + (o.correct ? 1 : 0), xp: s.xp + o.xp }));
    tutor.setState(o.correct ? "celebrating" : "encouraging");
  }

  function next() {
    setOutcome(null);
    setIdx((i) => i + 1);
    if (idx + 1 >= set!.items.length) tutor.setState("celebrating");
    else tutor.setState("idle");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="flex flex-col items-center gap-2 lg:self-start">
        <TutorPanel size={150} />
        <p className="text-center text-sm text-indigo-900/60">Words from {set.source}: <b>{set.words.join(", ")}</b></p>
      </Card>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-sm font-bold"><span>Exercise {idx + 1} of {set.items.length}</span><span>{score.xp} XP</span></div>
          <Progress value={idx} max={set.items.length} label="Practice progress" />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <Card className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold">{ex.title}</h1>
                <p className="text-indigo-900/70">{ex.instruction}</p>
              </div>
              <Ex item={item} learnerId={learnerId} onDone={handleDone} />
              {outcome && <OutcomeBanner o={outcome} />}
              <div className="flex justify-end gap-2">
                {!outcome && <Button variant="ghost" onClick={next}>Skip</Button>}
                {outcome && <Button onClick={next}>{idx + 1 >= set.items.length ? "Finish" : "Next"}</Button>}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
        <p className="text-xs text-indigo-900/50">Sound-by-sound (phoneme) feedback is {set.phoneme_feedback}.</p>
      </div>
    </div>
  );
}
