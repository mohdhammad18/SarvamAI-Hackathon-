export function Waveform({ levels, active }: { levels: number[]; active: boolean }) {
  return (
    <div className="flex h-16 items-center justify-center gap-1" aria-hidden>
      {levels.map((l, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-full transition-[height] duration-75 ${active ? "bg-teal-500" : "bg-indigo-100"}`}
          style={{ height: `${Math.max(6, (active ? l : 0.1) * 64)}px` }}
        />
      ))}
    </div>
  );
}
