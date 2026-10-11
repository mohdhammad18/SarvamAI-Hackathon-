"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Home, LineChart, Sparkles, Users } from "lucide-react";
import { api, type Health } from "@/lib/api";

const LINKS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/practice", label: "Practice", icon: Sparkles },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/parent", label: "Parents", icon: Users },
];

export function ModeBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    api<Health>("/health").then(setHealth).catch(() => setDown(true));
  }, []);
  if (down) return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">Server offline</span>;
  if (!health) return null;
  return health.mode === "live" ? (
    <span title={`${health.stt_model} · ${health.tts_model} · ${health.chat_model}`} className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
      Live · Sarvam AI
    </span>
  ) : (
    <span title="No Sarvam API key: results use labelled mock data" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
      Demo mode · mock speech
    </span>
  );
}

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-indigo-100/70 bg-[#fffbf3]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3" aria-label="Main">
        <Link href="/" className="mr-auto flex items-center gap-2 text-xl font-extrabold text-indigo-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400 text-white"><BookOpen size={20} /></span>
          BoloBuddy
        </Link>
        <ModeBadge />
        <ul className="flex gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={path.startsWith(href) ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${path.startsWith(href) ? "bg-indigo-700 text-white" : "text-indigo-900 hover:bg-indigo-50"}`}
              >
                <Icon size={16} aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
