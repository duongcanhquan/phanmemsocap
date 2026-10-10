export function StudyBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-medium text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-accent">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
