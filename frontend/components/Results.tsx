"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Gauge, RotateCcw, ShieldCheck, Sparkles, Target, Timer, Trophy, Volume2 } from "lucide-react";
import { useState } from "react";
import type { SessionResponse, WordResult } from "@/lib/api";
import { useTutor } from "@/lib/tutor";
import { TutorPanel } from "./TutorPanel";
import { Badge, Button, Card, LinkButton, Stat } from "./ui";

const STATUS_STYLE: Record<WordResult["status"], string> = {
  correct: "bg-emerald-100 text-emerald-900",
  likely_substitution: "bg-rose-100 text-rose-900 underline decoration-rose-400 decoration-wavy",
  likely_omission: "bg-amber-100 text-amber-900 line-through decoration-amber-500",
  uncertain: "bg-slate-200 text-slate-700",
  not_attempted: "text-indigo-900/30",
};

const STATUS_LABEL: Record<WordResult["status"], string> = {
  correct: "Read well",
  likely_substitution: "Possibly a different word",
  likely_omission: "Possibly skipped",
  uncertain: "Couldn't tell",
  not_attempted: "Not reached",
};

export function Results({ data, onRetry }: { data: SessionResponse; onRetry: () => void }) {
  const { result: r, passage, feedback } = data;
  const { speak } = useTutor();
  const [selected, setSelected] = useState<WordResult | null>(null);
  const flagged = r.words.filter((w) => w.status === "likely_substitution" || w.status === "likely_omission" || w.status === "uncertain");
  const confTone = r.assessment_confidence === "high" ? "teal" : r.assessment_confidence === "medium" ? "amber" : "rose";
  const sentenceFor = (word: string) =>
    (passage.text.match(/[^.!?।]+[.!?।]?/g) ?? []).find((s) => s.toLowerCase().includes(word.toLowerCase()))?.trim() ?? word;

  return (
    <div className="space-y-6">
      {data.is_demo && (
        <div role="note" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">
          Demo mode: this result uses a mock transcript, not real speech recognition. Add a Sarvam API key to assess real readings.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="flex flex-col items-center gap-3 bg-gradient-to-b from-teal-50 to-white">
          <TutorPanel size={150} />
          {feedback.example_sentence && (
            <button onClick={() => speak(feedback.example_sentence!, passage.language)} className="rounded-2xl bg-indigo-50 p-3 text-left text-indigo-900 hover:bg-indigo-100">
              <span className="text-xs font-bold uppercase text-indigo-500">Try this sentence</span>
              <br />{feedback.example_sentence}
            </button>
          )}
          <p className="text-xs text-indigo-900/50">Tutor message: {feedback.source.startsWith("sarvam") ? "Sarvam-105B" : "template"}</p>
        </Card>

        <div className="space-y-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-wrap items-center gap-3">
            <h1 className="mr-auto text-3xl font-extrabold">Your reading report</h1>
            {data.xp_awarded > 0 && <Badge tone="amber"><Sparkles size={12} aria-hidden /> +{data.xp_awarded} XP</Badge>}
            {data.new_achievements.map((a) => <Badge key={a.id} tone="amber"><Trophy size={12} aria-hidden /> {a.title}</Badge>)}
            <Badge tone={confTone}><ShieldCheck size={12} aria-hidden /> {r.assessment_confidence} confidence</Badge>
          </motion.div>

          {r.warnings.length > 0 && (
            <div role="alert" className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="shrink-0" aria-hidden />
              <div>
                {r.warnings.map((w) => <p key={w} className="font-semibold">{w}</p>)}
                <Button variant="secondary" className="mt-2" onClick={onRetry}><RotateCcw size={16} aria-hidden /> Try another recording</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<Target aria-hidden />} label="Word accuracy (est.)" value={`${r.word_accuracy_percent}%`} tone="text-teal-600" />
            <Stat icon={<Gauge aria-hidden />} label="Words correct / min" value={r.wcpm} />
            <Stat icon={<Sparkles aria-hidden />} label="Words matched" value={`${r.likely_correct_word_count}/${r.expected_word_count}`} tone="text-amber-600" />
            <Stat icon={<Timer aria-hidden />} label="Reading time" value={`${r.reading_duration_seconds}s`} tone="text-sky-600" />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="amber">{r.error_summary.likely_omissions} possibly skipped</Badge>
            <Badge tone="rose">{r.error_summary.likely_substitutions} possibly different</Badge>
            <Badge tone="slate">{r.error_summary.possible_insertions} extra words heard</Badge>
            <Badge tone="slate">{r.error_summary.uncertain} uncertain</Badge>
            {r.error_summary.not_attempted > 0 && <Badge tone="slate">{r.error_summary.not_attempted} not reached</Badge>}
          </div>
        </div>
      </div>

      <Card>
        <h2 className="mb-1 text-xl font-extrabold">The story, word by word</h2>
        <p className="mb-3 text-sm text-indigo-900/60">Tap a word to hear it and practise. Colours show what the speech recogniser heard, which can sometimes be wrong.</p>
        <p className="text-2xl leading-loose" lang={passage.language.slice(0, 2)}>
          {r.words.map((w) => (
            <button
              key={w.index}
              onClick={() => setSelected(w)}
              className={`mx-0.5 rounded-lg px-1.5 py-0.5 focus-visible:ring-4 focus-visible:ring-sky-300 ${STATUS_STYLE[w.status]} ${selected?.index === w.index ? "ring-2 ring-indigo-500" : ""}`}
              aria-label={`${w.display}: ${STATUS_LABEL[w.status]}`}
            >
              {w.display}
            </button>
          ))}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
          {(Object.keys(STATUS_LABEL) as WordResult["status"][]).map((s) => (
            <span key={s} className={`rounded-lg px-2 py-1 ${STATUS_STYLE[s]}`}>{STATUS_LABEL[s]}</span>
          ))}
        </div>
        {selected && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-indigo-50 p-4">
            <div className="mr-auto">
              <div className="text-2xl font-extrabold">{selected.display}</div>
              <div className="text-sm text-indigo-900/70">
                {STATUS_LABEL[selected.status]}
                {selected.recognized && selected.recognized !== selected.expected && <> · heard “{selected.recognized}”</>}
              </div>
            </div>
            <Button variant="secondary" onClick={() => speak(selected.expected, passage.language, { pace: 0.75 })}><Volume2 size={16} aria-hidden /> Listen</Button>
            <Button variant="secondary" onClick={() => speak(sentenceFor(selected.expected), passage.language, { pace: 0.85 })}><Volume2 size={16} aria-hidden /> In a sentence</Button>
            <LinkButton href="/practice" variant="primary">Practise it</LinkButton>
          </div>
        )}
      </Card>

      {flagged.length > 0 && (
        <Card>
          <h2 className="mb-3 text-xl font-extrabold">Words to look at</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-sm text-indigo-900/60"><tr><th className="p-2">Expected</th><th className="p-2">Heard</th><th className="p-2">What it might mean</th><th className="p-2" /></tr></thead>
              <tbody>
                {flagged.map((w) => (
                  <tr key={w.index} className="border-t border-indigo-50">
                    <td className="p-2 text-lg font-bold">{w.display}</td>
                    <td className="p-2">{w.recognized ?? "—"}</td>
                    <td className="p-2 text-sm">{STATUS_LABEL[w.status]}</td>
                    <td className="p-2"><Button variant="ghost" onClick={() => speak(w.expected, passage.language, { pace: 0.75 })} aria-label={`Listen to ${w.expected}`}><Volume2 size={16} aria-hidden /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="text-sm text-indigo-900/70">
        <p className="font-bold text-indigo-900">About these results</p>
        <ul className="list-disc pl-5">
          {r.limitations.map((l) => <li key={l}>{l}</li>)}
          <li>Speech source: {data.stt_source}. Transcript: “{data.transcript || "(empty)"}”</li>
        </ul>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onRetry}><RotateCcw size={18} aria-hidden /> Read it again</Button>
        <LinkButton href="/practice" variant="reward">Practise my tricky words</LinkButton>
        <LinkButton href="/dashboard" variant="ghost">Back home</LinkButton>
      </div>
    </div>
  );
}
