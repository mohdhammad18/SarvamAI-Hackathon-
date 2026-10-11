"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Dashboard } from "./api";

const KEY = "bolobuddy.learnerId";

export function getLearnerId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setLearnerId(id: string | null) {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
}

export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const id = getLearnerId();
    if (!id) {
      setMissing(true);
      return;
    }
    try {
      setData(await api<Dashboard>(`/learners/${id}/dashboard`));
      setError(null);
    } catch (e) {
      const err = e as { status?: number; message: string };
      if (err.status === 404) {
        setLearnerId(null);
        setMissing(true);
      } else setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, missing, reload: load };
}
