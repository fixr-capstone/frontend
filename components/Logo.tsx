/**
 * The Fixr wordmark. Its F is built from code lines: the stem is the editor's gutter, the arms are
 * lines, and the mint arm is the finding worth fixing. Drawn as outlines, so it needs no font.
 */
export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <svg className={`logo ${small ? "logo--sm" : ""}`} viewBox="0 48 470 160" role="img" aria-label="Fixr">
      <path className="logo__gutter" d="M0 48H36V208H0Z" />
      <path className="logo__line" d="M50 48H118V83H50Z" />
      <path className="logo__line logo__signal" d="M50 112H104V146H50Z" />
      <path d="M138 48H174V208H138ZM198 48H234L326.4 208H290.4ZM290.4 48H326.4L234 208H198ZM396 156H434L470 208H432Z" />
      <path fillRule="evenodd" d="M350 48H414A56 56 0 0 1 414 160H386V208H350ZM386 84H414A20 20 0 0 1 414 124H386Z" />
    </svg>
  );
}
