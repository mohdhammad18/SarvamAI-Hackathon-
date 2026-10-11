"use client";

import { Lock, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, EmptyState, ErrorBox, Progress, Spinner } from "@/components/ui";
import { useDashboard } from "@/lib/useLearner";

export default function ProgressPage() {
  const { data, error, missing, reload } = useDashboard();
  const router = useRouter();
  useEffect(() => { if (missing) router.replace("/onboarding"); }, [missing, router]);
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!data) return <Spinner label="Loading progress…" />;

  const earned = new Set(data.achievements.map((a) => a.id));
  const active = new Set(data.active_days);
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold">{data.learner.name}&apos;s progress</h1>
      <Card>
        <h2 className="text-xl font-extrabold">Accuracy and words correct per minute</h2>
        <p className="mb-3 text-sm text-indigo-900/60">Each point is one reading. Different stories vary in difficulty, so compare readings of the same story for a fair picture. Low-confidence readings are shown but should be treated with care.</p>
        {data.trend.length ? (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis dataKey="passage" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#14b8a6" strokeWidth={3} />
                <Line type="monotone" dataKey="wcpm" name="WCPM" stroke="#4338ca" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState title="No readings yet"><Link className="font-bold text-teal-700" href="/dashboard">Start your first reading</Link></EmptyState>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xl font-extrabold">Learning calendar · last 4 weeks</h2>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => (
              <div key={d} title={d} className={`aspect-square rounded-xl ${active.has(d) ? "bg-teal-400" : "bg-indigo-50"}`} aria-label={`${d}: ${active.has(d) ? "practised" : "no practice"}`} />
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-xl font-extrabold">Badges</h2>
          <ul className="grid grid-cols-2 gap-3">
            {data.all_achievements.map((a) => (
              <li key={a.id} className={`rounded-2xl p-3 ${earned.has(a.id) ? "bg-amber-50" : "bg-slate-50 opacity-60"}`}>
                <div className="flex items-center gap-2 font-bold">{earned.has(a.id) ? <Trophy className="text-amber-500" size={18} aria-hidden /> : <Lock size={18} aria-hidden />}{a.title}</div>
                <p className="text-xs text-indigo-900/60">{a.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-xl font-extrabold">Skill mastery</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.skills.map((s) => (
            <div key={s.id}>
              <div className="mb-1 flex justify-between text-sm font-bold"><span>{s.label}</span><span>{s.mastery === null ? "upcoming" : `${Math.round(s.mastery * 100)}%`}</span></div>
              <Progress value={(s.mastery ?? 0) * 100} color={s.state === "mastered" ? "bg-teal-500" : "bg-amber-400"} label={s.label} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-extrabold">Session history</h2>
        {data.recent_sessions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-indigo-900/60"><tr><th className="p-2">When</th><th className="p-2">Story</th><th className="p-2">Accuracy</th><th className="p-2">WCPM</th><th className="p-2">Confidence</th><th className="p-2">Source</th></tr></thead>
              <tbody>
                {data.recent_sessions.map((s) => (
                  <tr key={s.id} className="border-t border-indigo-50">
                    <td className="p-2">{s.created_at.slice(0, 16)}</td>
                    <td className="p-2 font-bold">{s.title}</td>
                    <td className="p-2">{s.accuracy}%</td>
                    <td className="p-2">{s.wcpm}</td>
                    <td className="p-2"><Badge tone={s.confidence === "high" ? "teal" : s.confidence === "medium" ? "amber" : "rose"}>{s.confidence}</Badge></td>
                    <td className="p-2">{s.source === "demo-mock" ? <Badge tone="amber">demo</Badge> : s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No sessions yet" />}
      </Card>
    </div>
  );
}
