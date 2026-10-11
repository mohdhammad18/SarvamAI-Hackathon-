"use client";

import { CheckCircle2, Circle, Clock, Flame, Star, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { TutorPanel } from "@/components/TutorPanel";
import { Badge, Button, Card, EmptyState, ErrorBox, LinkButton, Progress, Spinner, Stat } from "@/components/ui";
import { api, LANG_NAMES } from "@/lib/api";
import { useTutor } from "@/lib/tutor";
import { useDashboard } from "@/lib/useLearner";

export default function DashboardPage() {
  const { data, error, missing, reload } = useDashboard();
  const router = useRouter();
  const { speak } = useTutor();
  const greeted = useRef(false);

  useEffect(() => {
    if (missing) router.replace("/onboarding");
  }, [missing, router]);

  async function greet() {
    if (!data) return;
    const g = await api<{ text: string; language: string }>(`/learners/${data.learner.id}/greeting`).catch(() => null);
    if (g) speak(g.text, g.language, { during: "greeting" });
  }

  useEffect(() => {
    if (data && !greeted.current) {
      greeted.current = true;
      api<{ text: string; language: string }>(`/learners/${data.learner.id}/greeting`).then((g) => {
        // Autoplay is often blocked until the user interacts, so only show the text here.
        speak(g.text, g.language, { during: "greeting" }).catch(() => {});
      }).catch(() => {});
    }
  }, [data, speak]);

  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!data) return <Spinner label="Loading your reading space…" />;

  const rec = data.recommended;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-teal-50">
          <TutorPanel size={170} />
          <Button variant="ghost" className="mt-2 text-sm" onClick={greet}>Say hello again</Button>
        </Card>
        <Card className="flex flex-col justify-between gap-4">
          <div>
            <p className="font-bold text-teal-700">Today&apos;s mission · about {rec?.estimated_minutes ?? 3} min</p>
            <h1 className="text-4xl font-extrabold">Hi {data.learner.name}!</h1>
            {rec ? (
              <>
                <p className="mt-2 text-xl">Read <b>“{rec.passage.title}”</b></p>
                <p className="text-indigo-900/70">{rec.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="teal">{LANG_NAMES[rec.passage.language]}</Badge>
                  <Badge>Level {rec.passage.level}</Badge>
                </div>
              </>
            ) : <EmptyState title="No passages for this language yet" />}
          </div>
          {rec && <LinkButton href={`/read/${rec.passage.id}`} className="py-4 text-xl">Start Reading</LinkButton>}
          <div>
            <div className="mb-1 flex justify-between text-sm font-bold"><span>Level {data.level}</span><span>{data.xp_into_level}/{data.xp_for_next} XP</span></div>
            <Progress value={data.xp_into_level} max={data.xp_for_next} color="bg-amber-400" label="XP to next level" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Zap aria-hidden />} label="Total XP" value={data.xp} tone="text-amber-600" />
        <Stat icon={<Flame aria-hidden />} label="Day streak" value={data.streak} tone="text-rose-500" />
        <Stat icon={<Star aria-hidden />} label="Readings" value={data.sessions_count} />
        <Stat icon={<Clock aria-hidden />} label="Minutes read" value={data.total_practice_minutes} tone="text-teal-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-xl font-extrabold">Daily quests</h2>
          <ul className="space-y-3">
            {data.quests.map((q) => (
              <li key={q.id} className="flex items-center gap-3">
                {q.done ? <CheckCircle2 className="text-teal-500" aria-label="done" /> : <Circle className="text-indigo-200" aria-label="not done" />}
                <div className="flex-1">
                  <div className="font-bold">{q.title}</div>
                  <Progress value={q.progress} max={q.target} label={q.title} />
                </div>
                <Badge tone="amber">+{q.xp}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-xl font-extrabold">This week</h2>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={data.week}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`${v}`, "readings"]} />
                <Bar dataKey="readings" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-xl font-extrabold">Achievements</h2>
          {data.achievements.length ? (
            <ul className="space-y-2">
              {data.achievements.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-amber-50 p-2">
                  <Trophy className="text-amber-500" aria-hidden />
                  <div><div className="font-bold">{a.title}</div><div className="text-xs text-indigo-900/60">{a.description}</div></div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No badges yet">Finish your first reading to earn one.</EmptyState>}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Skills map</h2>
          <Link href="/practice" className="font-bold text-teal-700 hover:underline">Practise tricky words →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.skills.map((s) => (
            <span
              key={s.id}
              className={`rounded-2xl px-4 py-2 font-bold ${s.state === "mastered" ? "bg-teal-500 text-white" : s.state === "developing" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-500"}`}
              title={s.mastery !== null ? `Mastery ${(s.mastery * 100).toFixed(0)}%` : "Not practised yet"}
            >
              {s.label} · {s.state}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
