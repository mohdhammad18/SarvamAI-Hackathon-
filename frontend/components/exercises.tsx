"use client";

import { CheckCircle2, Mic, Square, Volume2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL, ApiError, postJson } from "@/lib/api";
import { useTutor } from "@/lib/tutor";
import { useRecorder } from "@/lib/useRecorder";
import { Button } from "./ui";

export type PracticeItem = {
  id: string;
  type: "listen_repeat" | "pick_word" | "missing_word" | "read_sentence";
  language: string;
  payload: { word: string; options?: string[]; sentence?: string; full_sentence?: string };
};

export type Outcome = { correct: boolean; xp: number; message: string; uncertain?: boolean };
type Props = { item: PracticeItem; learnerId: string; onDone: (o: Outcome) => void };

const uid = () => crypto.randomUUID();

function ChoiceGrid({ item, learnerId, onDone, options }: Props & { options: string[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [attemptId] = useState(uid);
  async function choose(o: string) {
    if (picked) return;
    setPicked(o);
    const res = await postJson<{ correct: boolean; xp_awarded: number; answer: string }>("/practice/choice", {
      attempt_id: attemptId, learner_id: learnerId, item_id: item.id, answer: o,
    });
    setAnswer(res.answer);
    onDone({ correct: res.correct, xp: res.xp_awarded, message: res.correct ? "Yes! That's right." : `Good try! The word was “${res.answer}”.` });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => choose(o)}
          disabled={!!picked}
          className={`rounded-2xl border-4 p-5 text-3xl font-extrabold transition focus-visible:ring-4 focus-visible:ring-sky-300 ${
            answer && o === answer ? "border-emerald-400 bg-emerald-50" : picked === o ? "border-rose-300 bg-rose-50" : "border-indigo-100 bg-white hover:border-teal-300"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SpokenAttempt({ item, learnerId, onDone, target }: Props & { target: string }) {
  const rec = useRecorder();
  const tutor = useTutor();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attemptId] = useState(uid);

  useEffect(() => {
    if (rec.state === "recording") tutor.setState("listening");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state]);

  useEffect(() => {
    if (rec.state !== "stopped" || !rec.blob) return;
    if (rec.silent) {
      setErr("I couldn't hear anything. Check your microphone is on and not muted, then try again.");
      rec.reset();
      return;
    }
    (async () => {
      setBusy(true);
      tutor.setState("thinking");
      const fd = new FormData();
      fd.append("attempt_id", attemptId);
      fd.append("learner_id", learnerId);
      fd.append("item_id", item.id);
      fd.append("duration_seconds", String(Math.max(rec.elapsed, 1)));
      fd.append("file", rec.blob!, rec.blob!.type.includes("wav") ? "attempt.wav" : "attempt.webm");
      try {
        const res = await fetch(`${API_URL}/api/v1/practice/spoken`, { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new ApiError(body.error?.code, body.error?.message, res.status);
        if (body.uncertain) {
          tutor.setState("encouraging");
          setErr("I couldn't hear that clearly. Let's try once more, a little louder.");
          rec.reset();
        } else {
          tutor.setState(body.correct ? "celebrating" : "encouraging");
          onDone({
            correct: body.correct,
            xp: body.xp_awarded,
            message: (body.correct ? "Lovely reading!" : `I heard “${body.heard}”. Let's listen once more and keep practising.`) + (body.is_demo ? " (demo: mock speech)" : ""),
          });
        }
      } catch (e) {
        tutor.setState("error");
        setErr((e as Error).message);
        rec.reset();
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state, rec.blob]);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-4xl font-extrabold leading-snug" lang={item.language.slice(0, 2)}>{target}</p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => tutor.speak(target, item.language, { pace: 0.75 })}><Volume2 size={18} aria-hidden /> Listen</Button>
        {rec.state === "recording" ? (
          <Button variant="danger" onClick={rec.stop}><Square size={18} aria-hidden /> Stop ({rec.elapsed.toFixed(1)}s)</Button>
        ) : (
          <Button onClick={() => { tutor.stop(); setErr(null); rec.start(); }} disabled={busy || rec.state === "requesting"}>
            <Mic size={18} aria-hidden /> {busy ? "Checking…" : "Say it"}
          </Button>
        )}
      </div>
      {(rec.error || err) && <p role="alert" className="text-center font-semibold text-rose-700">{rec.error || err}</p>}
    </div>
  );
}

export function ListenRepeat(p: Props) {
  return <SpokenAttempt {...p} target={p.item.payload.word} />;
}

export function PickWord(p: Props) {
  const { speak } = useTutor();
  useEffect(() => {
    speak(p.item.payload.word, p.item.language, { pace: 0.75 }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.item.id]);
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Button variant="secondary" onClick={() => speak(p.item.payload.word, p.item.language, { pace: 0.75 })}><Volume2 size={18} aria-hidden /> Hear the word again</Button>
      </div>
      <ChoiceGrid {...p} options={p.item.payload.options ?? []} />
    </div>
  );
}

export function MissingWord(p: Props) {
  return (
    <div className="space-y-5">
      <p className="text-center text-3xl font-bold" lang={p.item.language.slice(0, 2)}>{p.item.payload.sentence}</p>
      <ChoiceGrid {...p} options={p.item.payload.options ?? []} />
    </div>
  );
}

export function ReadSentence(p: Props) {
  return <SpokenAttempt {...p} target={p.item.payload.sentence ?? p.item.payload.word} />;
}

export const EXERCISES = {
  listen_repeat: { title: "Listen and repeat", instruction: "Listen to BoloBuddy, then say the word yourself.", Component: ListenRepeat },
  pick_word: { title: "Which word did you hear?", instruction: "Listen carefully and tap the matching word.", Component: PickWord },
  missing_word: { title: "Fill the gap", instruction: "Tap the word that completes the sentence.", Component: MissingWord },
  read_sentence: { title: "Read a sentence", instruction: "Read the whole sentence aloud. Your tricky word is inside!", Component: ReadSentence },
} as const;

export function OutcomeBanner({ o }: { o: Outcome }) {
  return (
    <div role="status" className={`flex items-center gap-3 rounded-2xl p-4 font-bold ${o.correct ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
      {o.correct ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
      <span className="flex-1">{o.message}</span>
      {o.xp > 0 && <span className="rounded-full bg-amber-300 px-3 py-1 text-indigo-950">+{o.xp} XP</span>}
    </div>
  );
}
