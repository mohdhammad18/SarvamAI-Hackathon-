export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, init);
  } catch {
    throw new ApiError("network", "Can't reach the BoloBuddy server. Is the backend running on port 8000?", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.error?.code ?? "error", body?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export const postJson = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export type Learner = {
  id: string;
  name: string;
  age_band: string;
  reading_language: string;
  tutor_language: string;
  level: number;
  daily_goal_minutes: number;
};

export type Passage = {
  id: string;
  language: string;
  level: number;
  title: string;
  text: string;
  skills: string[];
  target_words: string[];
  word_count: number;
  sentences?: string[];
};

export type WordResult = {
  index: number;
  expected: string;
  display: string;
  recognized: string | null;
  status: "correct" | "likely_substitution" | "likely_omission" | "uncertain" | "not_attempted";
};

export type AssessmentResult = {
  expected_word_count: number;
  matched_word_count: number;
  likely_correct_word_count: number;
  attempted_word_count: number;
  reading_duration_seconds: number;
  wcpm: number;
  word_accuracy_percent: number;
  attempted_accuracy_percent: number;
  assessment_confidence: "high" | "medium" | "low";
  confidence_score: number;
  error_summary: Record<string, number>;
  words: WordResult[];
  insertions: string[];
  warnings: string[];
  practice_candidates: string[];
  limitations: string[];
  phoneme_evidence: { available: boolean; note: string };
};

export type SessionResponse = {
  session_id: string;
  passage: Passage;
  transcript: string;
  stt_source: string;
  is_demo: boolean;
  result: AssessmentResult;
  feedback: { message: string; tip: string; example_sentence: string | null; source: string; translated_message?: string };
  xp_awarded: number;
  new_achievements: { id: string; title: string; description: string }[];
};

export type Dashboard = {
  learner: Learner;
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  streak: number;
  total_practice_minutes: number;
  sessions_count: number;
  practice_attempts: number;
  quests: { id: string; title: string; target: number; progress: number; done: boolean; xp: number }[];
  achievements: { id: string; title: string; description: string; earned_at: string }[];
  all_achievements: { id: string; title: string; description: string }[];
  recommended: { passage: Passage; reason: string; estimated_minutes: number } | null;
  skills: { id: string; label: string; level: number; mastery: number | null; state: "mastered" | "developing" | "upcoming" }[];
  weak_words: string[];
  week: { day: string; date: string; readings: number; minutes: number }[];
  trend: { date: string; passage: string; accuracy: number; wcpm: number; confidence: string }[];
  active_days: string[];
  recent_sessions: { id: string; passage_id: string; title: string; created_at: string; accuracy: number; wcpm: number; confidence: string; source: string }[];
};

export type Health = { ok: boolean; mode: "live" | "demo"; stt_model: string; tts_model: string; chat_model: string };

export const LANG_NAMES: Record<string, string> = {
  "en-IN": "English", "hi-IN": "Hindi", "bn-IN": "Bengali", "ta-IN": "Tamil", "te-IN": "Telugu",
  "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi", "gu-IN": "Gujarati", "pa-IN": "Punjabi", "od-IN": "Odia",
};
