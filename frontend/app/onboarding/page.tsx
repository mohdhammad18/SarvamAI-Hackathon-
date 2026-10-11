"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { TutorAvatar } from "@/components/TutorAvatar";
import { Button, Card, ErrorBox } from "@/components/ui";
import { LANG_NAMES, postJson, type Learner } from "@/lib/api";
import { setLearnerId } from "@/lib/useLearner";

const READING_LANGS = ["en-IN", "hi-IN"];
const TUTOR_LANGS = Object.keys(LANG_NAMES);

export default function Onboarding() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", age_band: "6-8", reading_language: "en-IN", tutor_language: "en-IN", level: 1, daily_goal_minutes: 10 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(data: typeof form) {
    setBusy(true);
    setError(null);
    try {
      const learner = await postJson<Learner>("/learners", data);
      setLearnerId(learner.id);
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      create({ name: "Demo Reader", age_band: "6-8", reading_language: "en-IN", tutor_language: "en-IN", level: 1, daily_goal_minutes: 10 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create(form);
  };

  const field = "w-full rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-lg font-semibold focus:border-teal-400 focus:outline-none";

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-6 md:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center"><TutorAvatar state="greeting" size={200} /></div>
      <Card>
        <h1 className="text-3xl font-extrabold">Let&apos;s set up your reader</h1>
        <p className="mb-5 text-indigo-900/70">A parent or teacher can fill this in. We only need a nickname, no real names or contact details.</p>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 font-bold">Nickname
            <input required maxLength={40} className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Star Reader" />
          </label>
          <label className="font-bold">Age band
            <select className={field} value={form.age_band} onChange={(e) => setForm({ ...form, age_band: e.target.value })}>
              {["4-6", "6-8", "8-10", "10-12"].map((a) => <option key={a} value={a}>{a} years</option>)}
            </select>
          </label>
          <label className="font-bold">Reading level
            <select className={field} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
              <option value={1}>Just starting (level 1)</option>
              <option value={2}>Reads short sentences (level 2)</option>
              <option value={3}>Reads short stories (level 3)</option>
            </select>
          </label>
          <label className="font-bold">Reading language
            <select className={field} value={form.reading_language} onChange={(e) => setForm({ ...form, reading_language: e.target.value })}>
              {READING_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
            </select>
          </label>
          <label className="font-bold">Tutor speaks
            <select className={field} value={form.tutor_language} onChange={(e) => setForm({ ...form, tutor_language: e.target.value })}>
              {TUTOR_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
            </select>
          </label>
          <label className="font-bold">Daily goal
            <select className={field} value={form.daily_goal_minutes} onChange={(e) => setForm({ ...form, daily_goal_minutes: Number(e.target.value) })}>
              {[5, 10, 15, 20].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full text-lg">{busy ? "Creating…" : "Start reading"}</Button>
          </div>
        </form>
        {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
      </Card>
    </div>
  );
}
