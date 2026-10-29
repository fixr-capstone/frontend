import Link from "next/link";
import Logo from "@/components/Logo";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <div className="footer__brand">
          <Logo small />
          <p>Finds the lines worth fixing in AI-written Python, and tells you how. Your code stays yours.</p>
        </div>
        <nav className="footer__nav" aria-label="Footer">
          <Link href="/scan">Scan</Link>
          <Link href="/how">How it works</Link>
          <Link href="/cli">CLI</Link>
        </nav>
      </div>
      <div className="wrap footer__base">
        <span>A capstone project by Parth, Sparsh, Anushka and Shrey · MPSTME, NMIMS</span>
        <span>Results are guidance, not a security audit.</span>
      </div>
    </footer>
  );
}
