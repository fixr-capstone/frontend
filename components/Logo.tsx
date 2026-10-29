/** Code brackets around one mint bar: the single line that matters, found inside your code. */
export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "logo--sm" : ""}`} role="img" aria-label="Fixr">
      <svg className="logo__mark" viewBox="0 0 28 28" aria-hidden="true">
        <path className="logo__bracket logo__bracket--l" d="M9.5 3.5H4.5v21h5" />
        <path className="logo__bracket logo__bracket--r" d="M18.5 3.5h5v21h-5" />
        <rect className="logo__signal" x="12.2" y="7.5" width="3.6" height="13" />
      </svg>
      <span className="logo__word" aria-hidden="true">FIXR</span>
    </span>
  );
}
