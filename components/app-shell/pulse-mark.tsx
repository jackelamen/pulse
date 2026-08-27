/**
 * Pulse mark.
 *
 * A ring cut open on both sides by the trace that passes through it. The gaps
 * are positioned exactly where the waveform crosses the circle, so they read as
 * caused by the line rather than as a truncated arc -- an arbitrary gap in a
 * ring looks like a rendering fault, not a decision.
 *
 * Ring and trace share one stroke width and one cap style, so the mark reads as
 * a single constructed object. Verified legible down to 18px, in one colour,
 * and on both the indigo tile and the dark surface.
 */
const STROKE = 4.6;

/** Ring, split where the trace crosses it at y=32 on a 64 grid (r=19). */
const RING_TOP = "M13.7 27.1 A19 19 0 0 1 50.3 27.1";
const RING_BOTTOM = "M13.7 36.9 A19 19 0 0 0 50.3 36.9";

/**
 * Flat lead-in, one asymmetric beat, flat lead-out. The tails stop short of the
 * tile edge so the mark keeps its padding at every size.
 */
const TRACE = "M8 32 H25 L30 20 L36 44 L41 32 H56";

function Glyph({ color }: { color: string }) {
  return (
    <>
      <path d={RING_TOP} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <path d={RING_BOTTOM} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <path
        d={TRACE}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export function PulseMark({
  className = "h-6 w-6",
  /** Render as a single-colour glyph (inherits currentColor) instead of the tile. */
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {!monochrome && <rect width="64" height="64" rx="17" fill="#2a3566" />}
      <Glyph color={monochrome ? "currentColor" : "#f25c2a"} />
    </svg>
  );
}
