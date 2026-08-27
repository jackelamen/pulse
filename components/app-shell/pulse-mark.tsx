/**
 * Pulse mark.
 *
 * One idea, one stroke. The previous mark stacked a fuchsia-to-violet gradient
 * lightning bolt, a white sheen layer and a gaussian glow filter underneath a
 * white ECG line -- two competing metaphors in three hue families, none of
 * which were the app's own indigo or coral. It also failed the durability
 * tests a mark has to pass: the hairline ECG stroke and the blur turned to
 * mush at 16px favicon size, and in one-color reproduction the gradient
 * flattened into a shape you could no longer read.
 *
 * What survives is the waveform, because the waveform IS the name. It is a
 * single continuous stroke: legible at 16px, reproducible in one color,
 * embroiderable, and animatable along its own path.
 */
export function PulseMark({
  className = "h-6 w-6",
  /** Render as a single-color glyph (inherits currentColor) instead of the tile. */
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  if (monochrome) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d={WAVEFORM}
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="17" fill="#2a3566" />
      <path
        d={WAVEFORM}
        stroke="#f25c2a"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Flat baseline, one asymmetric spike right of centre, flat out. The spike is
 * deliberately off-centre -- a centred peak reads as a generic chevron.
 */
const WAVEFORM = "M11 34 H22 L27 34 L33 17 L40 45 L45 34 H53";
