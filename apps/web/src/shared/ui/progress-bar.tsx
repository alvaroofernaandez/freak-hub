type ProgressBarProps = {
  /** 0-100. Values outside the range are clamped. */
  value: number;
  /** What is progressing, for assistive tech (e.g. "Progreso de Elden Ring"). */
  label: string;
};

/**
 * How far along an entry is (#39). The fill eases toward its new width so a
 * change reads as movement rather than a jump; the track keeps its size, so
 * nothing around it reflows.
 */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <div
        data-testid="progress-bar-fill"
        style={{ width: `${percentage}%` }}
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
      />
    </div>
  );
}
