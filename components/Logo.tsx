const BARS = [9, 15, 6, 22, 12];
const SIGNAL = 3;

/** Stencil wordmark with a five-bar mark: four bars of scanner noise and one mint signal. */
export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "logo--sm" : ""}`} role="img" aria-label="Fixr">
      <svg className="logo__mark" viewBox="0 0 24 24" aria-hidden="true">
        {BARS.map((h, i) => (
          <rect
            key={i}
            className={i === SIGNAL ? "logo__signal" : "logo__noise"}
            x={i * 5}
            y={24 - h}
            width="3.2"
            height={h}
            rx="0.6"
            style={{ ["--i" as string]: i }}
          />
        ))}
      </svg>
      <span className="logo__word" aria-hidden="true">FIXR</span>
    </span>
  );
}
