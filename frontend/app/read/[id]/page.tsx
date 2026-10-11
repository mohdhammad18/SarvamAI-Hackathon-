"use client";

import { ChevronLeft, ChevronRight, Languages, Mic, Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Results } from "@/components/Results";
import { TutorPanel } from "@/components/TutorPanel";
import { Waveform } from "@/components/Waveform";
import { Badge, Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { api, ApiError, API_URL, LANG_NAMES, type Learner, type Passage, type SessionResponse } from "@/lib/api";
import { useTutor } from "@/lib/tutor";
import { getLearnerId } from "@/lib/useLearner";
import { MAX_SECONDS, useRecorder } from "@/lib/useRecorder";

type Aids = { translation: string | null; transliteration: string | null };

export default function ReadingStudio() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tutor = useTutor();
  const rec = useRecorder();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [learner, setLearner] = useState<Learner | null>(null);
  const [sentence, setSentence] = useState(0);
  const [aids, setAids] = useState<Aids | null>(null);
  const [showAids, setShowAids] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<string | null>(null);

  useEffect(() => {
    const lid = getLearnerId();
    if (!lid) return router.replace("/onboarding");
    api<Passage>(`/passages/${id}`).then(setPassage).catch((e) => setError(e.message));
    api<{ learner: Learner }>(`/learners/${lid}/dashboard`).then((d) => setLearner(d.learner)).catch(() => {});
  }, [id, router]);

  useEffect(() => {
    if (rec.state === "recording") tutor.setState("listening");
    if (rec.state === "error") tutor.setState("error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state]);

  useEffect(() => {
    if (rec.blob) {
      const url = URL.createObjectURL(rec.blob);
      setPlayback(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [rec.blob]);

  async function loadAids() {
    setShowAids((s) => !s);
    if (!aids && passage && learner) {
      setAids(await api<Aids>(`/passages/${passage.id}/aids?tutor_language=${learner.tutor_language}`).catch(() => ({ translation: null, transliteration: null })));
    }
  }

  async function submit() {
    if (!rec.blob || !passage || !learner) return;
    setProcessing(true);
    setError(null);
    tutor.setState("thinking");
    const fd = new FormData();
    fd.append("learner_id", learner.id);
    fd.append("passage_id", passage.id);
    fd.append("duration_seconds", String(rec.elapsed));
    fd.append("file", rec.blob, `reading.${rec.blob.type.includes("wav") ? "wav" : rec.blob.type.includes("ogg") ? "ogg" : rec.blob.type.includes("mp4") ? "m4a" : "webm"}`);
    try {
      const res = await fetch(`${API_URL}/api/v1/sessions/assess`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new ApiError(body?.error?.code, body?.error?.message ?? "Processing failed", res.status);
      setResult(body);
      const r = body as SessionResponse;
      const spoken = r.feedback.translated_message ?? `${r.feedback.message} ${r.feedback.tip}`;
      const lang = r.feedback.translated_message ? learner.tutor_language : "en-IN";
      const celebrate = r.result.assessment_confidence !== "low" && r.result.word_accuracy_percent >= 80;
      tutor.setState(celebrate ? "celebrating" : "explaining");
      setTimeout(() => tutor.speak(spoken, lang, { during: "explaining", after: celebrate ? "celebrating" : "encouraging" }), celebrate ? 1500 : 0);
    } catch (e) {
      tutor.setState("error");
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  function retry() {
    setResult(null);
    setError(null);
    rec.reset();
    tutor.setState("idle");
  }

  if (error && !passage) return <ErrorBox>{error}</ErrorBox>;
  if (!passage) return <Spinner label="Opening the story…" />;
  const sentences = passage.sentences ?? [passage.text];

  if (result) return <Results data={result} onRetry={retry} />;

  const recording = rec.state === "recording" || rec.state === "paused";
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="flex flex-col items-center gap-3 bg-gradient-to-b from-sky-50 to-white lg:sticky lg:top-20 lg:self-start">
        <TutorPanel size={160} />
        <Button variant="secondary" className="w-full" onClick={() => tutor.speak(passage.text, passage.language, { pace: 0.85 })}>
          <Volume2 size={18} aria-hidden /> Hear the whole story
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => tutor.speak(sentences[sentence], passage.language, { pace: 0.8 })}>
          <Volume2 size={18} aria-hidden /> Hear this sentence
        </Button>
      </Card>

      <div className="space-y-5">
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h1 className="mr-auto text-3xl font-extrabold">{passage.title}</h1>
            <Badge tone="teal">{LANG_NAMES[passage.language]}</Badge>
            <Badge>Level {passage.level}</Badge>
            <Badge tone="slate">{passage.word_count} words</Badge>
          </div>
          <p className="text-3xl leading-relaxed md:text-4xl md:leading-relaxed" lang={passage.language.slice(0, 2)}>
            {sentences.map((s, i) => (
              <span key={i} className={`rounded-lg px-1 transition ${i === sentence ? "bg-amber-100 text-indigo-950" : "text-indigo-900/50"}`}>{s} </span>
            ))}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="ghost" disabled={sentence === 0} onClick={() => setSentence((s) => s - 1)} aria-label="Previous sentence"><ChevronLeft aria-hidden /> Back</Button>
            <span className="text-sm font-bold text-indigo-900/60">Sentence {sentence + 1} of {sentences.length}</span>
            <Button variant="ghost" disabled={sentence >= sentences.length - 1} onClick={() => setSentence((s) => s + 1)} aria-label="Next sentence">Next <ChevronRight aria-hidden /></Button>
            <Button variant="ghost" className="ml-auto" onClick={loadAids}><Languages size={18} aria-hidden /> {showAids ? "Hide" : "Show"} helper text</Button>
          </div>
          {showAids && (
            <div className="mt-3 space-y-2 rounded-2xl bg-indigo-50 p-4 text-indigo-900">
              {!aids && <Spinner label="Asking Sarvam…" />}
              {aids?.transliteration && <p><b>Pronunciation (Roman script):</b> {aids.transliteration}</p>}
              {aids?.translation && <p><b>Meaning:</b> {aids.translation}</p>}
              {aids && !aids.transliteration && !aids.translation && <p>No helper text is available for this story in your tutor language.</p>}
              <p className="text-xs">Helper text is machine-generated by Sarvam and may contain mistakes. It is for understanding only. Please read the story in its original script.</p>
            </div>
          )}
        </Card>

        <Card className="text-center">
          <p className="mb-2 font-bold text-indigo-900/70">
            {rec.state === "idle" && "When you're ready, press the big button and read the whole story aloud."}
            {rec.state === "requesting" && "Please allow microphone access…"}
            {rec.state === "recording" && "I'm listening… read at your own pace."}
            {rec.state === "paused" && "Paused. Press resume when you're ready."}
            {rec.state === "stopped" && !processing && "Great! Send your reading to BoloBuddy, or record again."}
            {processing && "BoloBuddy is checking your reading…"}
          </p>
          <Waveform levels={rec.levels} active={rec.state === "recording"} />
          <div className="my-2 font-mono text-2xl font-bold tabular-nums" aria-live="off">
            {rec.elapsed.toFixed(1)}s <span className="text-sm text-indigo-900/50">/ {MAX_SECONDS}s max</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!recording && rec.state !== "stopped" && (
              <button
                onClick={() => { tutor.stop(); rec.start(); }}
                disabled={rec.state === "requesting"}
                className="grid h-24 w-24 place-items-center rounded-full bg-rose-500 text-white shadow-[0_6px_0_#9f1239] transition hover:bg-rose-600 focus-visible:ring-4 focus-visible:ring-sky-300 active:translate-y-1"
                aria-label="Start recording"
              >
                <Mic size={40} aria-hidden />
              </button>
            )}
            {recording && (
              <>
                {rec.state === "recording"
                  ? <Button variant="secondary" onClick={rec.pause}><Pause size={18} aria-hidden /> Pause</Button>
                  : <Button variant="secondary" onClick={rec.resume}><Play size={18} aria-hidden /> Resume</Button>}
                <button onClick={rec.stop} className="grid h-24 w-24 place-items-center rounded-full bg-indigo-700 text-white shadow-[0_6px_0_#312e81]" aria-label="Stop recording">
                  <Square size={36} aria-hidden />
                </button>
              </>
            )}
            {rec.state === "stopped" && (
              <>
                {playback && <audio controls src={playback} className="h-10" aria-label="Play back your reading" />}
                <Button variant="secondary" onClick={retry} disabled={processing}><RotateCcw size={18} aria-hidden /> Record again</Button>
                <Button onClick={submit} disabled={processing || rec.elapsed < 1} className="text-lg">
                  {processing ? "Checking…" : "Check my reading"}
                </Button>
              </>
            )}
          </div>
          {rec.state === "stopped" && rec.elapsed < 1 && <p className="mt-2 text-rose-700">That was too short. Please record again.</p>}
          {rec.state === "stopped" && rec.silent && (
            <p role="alert" className="mt-2 font-semibold text-amber-800">
              Your recording is almost silent. Check that the right microphone is selected and not muted, then record again closer to it.
            </p>
          )}
          {rec.error && <div className="mt-3"><ErrorBox onRetry={retry}>{rec.error}</ErrorBox></div>}
          {error && <div className="mt-3"><ErrorBox onRetry={() => submit()}>{error}</ErrorBox></div>}
        </Card>
      </div>
    </div>
  );
}
