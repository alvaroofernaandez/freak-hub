type AvatarProps = {
  displayName: string;
  imageUrl?: string | null;
};

function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

/** A member's picture, or their initials when there is none (no image assets exist yet). */
export function Avatar({ displayName, imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: an external, unknown-dimension avatar URL.
      <img
        src={imageUrl}
        alt={displayName}
        className="h-full w-full rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center rounded-full bg-surface-raised font-display text-sm"
    >
      {initials(displayName)}
    </span>
  );
}
