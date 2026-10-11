"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "reward" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-indigo-700 text-white hover:bg-indigo-800 shadow-[0_4px_0_#312e81] active:translate-y-[2px] active:shadow-[0_2px_0_#312e81]",
  secondary: "bg-white text-indigo-900 border-2 border-indigo-100 hover:border-indigo-300 shadow-[0_3px_0_#e0e7ff]",
  ghost: "text-indigo-800 hover:bg-indigo-50",
  reward: "bg-amber-400 text-indigo-950 hover:bg-amber-300 shadow-[0_4px_0_#b45309] active:translate-y-[2px]",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-[0_4px_0_#9f1239]",
};

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(49,46,129,0.07)] ring-1 ring-indigo-50 ${className}`}>{children}</section>;
}

export function Progress({ value, max = 100, color = "bg-teal-500", label }: { value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-3 w-full overflow-hidden rounded-full bg-indigo-50">
      <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
    </div>
  );
}

export function Badge({ children, tone = "indigo" }: { children: ReactNode; tone?: "indigo" | "teal" | "amber" | "rose" | "slate" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-800",
    teal: "bg-teal-50 text-teal-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function Stat({ icon, label, value, tone = "text-indigo-700" }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-indigo-50">
      <div className={`grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 ${tone}`}>{icon}</div>
      <div>
        <div className="text-2xl font-extrabold text-indigo-950">{value}</div>
        <div className="text-xs font-semibold text-indigo-900/60">{label}</div>
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-indigo-800">
      <span className="h-5 w-5 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700" />
      <span className="font-semibold">{label}</span>
    </div>
  );
}

export function ErrorBox({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border-2 border-rose-100 bg-rose-50 p-4 text-rose-900">
      <p className="font-semibold">{children}</p>
      {onRetry && <Button variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-100 p-6 text-center text-indigo-900/70">
      <p className="font-bold text-indigo-900">{title}</p>
      {children}
    </div>
  );
}
