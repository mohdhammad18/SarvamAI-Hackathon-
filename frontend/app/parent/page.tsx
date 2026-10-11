"use client";

import { Info, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, EmptyState, ErrorBox, LinkButton, Spinner } from "@/components/ui";
import { api, LANG_NAMES, type Learner } from "@/lib/api";
import { getLearnerId, setLearnerId } from "@/lib/useLearner";

type Row = {
  learner: Learner;
  xp: number;
  streak: number;
  sessions_total: number;
  sessions_last_7_days: number;
  practice_attempts: number;
  trend: { date: string; accuracy: number; wcpm: number; confidence: string; passage: string; source: string }[];
  difficult_words: string[];
  developing_skills: string[];
  recommended: string;
};

export default function ParentPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ learners: Row[]; note: string }>("/parent/overview");
      setRows(d.learners);
      setNote(d.note);
      setCurrent(getLearnerId());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this learner and all their practice data? This cannot be undone.")) return;
    await api(`/learners/${id}`, { method: "DELETE" });
    if (getLearnerId() === id) setLearnerId(null);
    load();
  }

  if (error) return <ErrorBox onRetry={load}>{error}</ErrorBox>;
  if (!rows) return <Spinner label="Loading learners…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl font-extrabold">Parent &amp; teacher dashboard</h1>
        <LinkButton href="/onboarding" variant="secondary"><UserPlus size={18} aria-hidden /> Add learner</LinkButton>
      </div>
      <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sky-900">
        <Info className="shrink-0" aria-hidden />
        <p className="font-semibold">{note} Use them to guide practice, and confirm concerns by listening to your child read.</p>
      </div>
      {rows.length === 0 && <EmptyState title="No learners yet">Add a learner to get started.</EmptyState>}
      {rows.map((r) => (
        <Card key={r.learner.id} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-2xl font-extrabold">{r.learner.name}</h2>
            <Badge tone="teal">{LANG_NAMES[r.learner.reading_language]}</Badge>
            <Badge>Age {r.learner.age_band}</Badge>
            <Badge tone="amber">{r.xp} XP</Badge>
            {current === r.learner.id
              ? <Badge tone="teal">Active on this device</Badge>
              : <Button variant="ghost" onClick={() => { setLearnerId(r.learner.id); setCurrent(r.learner.id); }}>Switch to this learner</Button>}
            <Button variant="ghost" onClick={() => remove(r.learner.id)} aria-label={`Delete ${r.learner.name}`}><Trash2 size={18} aria-hidden /></Button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div><div className="text-3xl font-extrabold">{r.sessions_last_7_days}</div><div className="text-sm text-indigo-900/60">readings this week</div></div>
            <div><div className="text-3xl font-extrabold">{r.sessions_total}</div><div className="text-sm text-indigo-900/60">readings total</div></div>
            <div><div className="text-3xl font-extrabold">{r.practice_attempts}</div><div className="text-sm text-indigo-900/60">practice exercises</div></div>
            <div><div className="text-3xl font-extrabold">{r.streak}</div><div className="text-sm text-indigo-900/60">day streak</div></div>
          </div>
          {r.trend.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={r.trend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="accuracy" name="Accuracy % (est.)" stroke="#14b8a6" strokeWidth={3} />
                  <Line dataKey="wcpm" name="WCPM (est.)" stroke="#4338ca" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No readings yet" />}
          <div className="grid gap-4 md:grid-cols-3">
            <div><h3 className="font-bold">Tricky words</h3><p>{r.difficult_words.join(", ") || "None flagged yet"}</p></div>
            <div><h3 className="font-bold">Developing skills</h3><p>{r.developing_skills.join(", ") || "None yet"}</p></div>
            <div><h3 className="font-bold">Suggested next step</h3><p>{r.recommended}</p></div>
          </div>
          {r.trend.some((t) => t.source === "demo-mock") && <p className="text-xs font-bold text-amber-700">Some sessions used demo mock data and are not real assessments.</p>}
        </Card>
      ))}
    </div>
  );
}
