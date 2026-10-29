"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { ServerPill } from "@/components/ServerStatus";

const NAV: [string, string][] = [["/scan", "Scan"], ["/how", "How it works"], ["/cli", "CLI"]];

export default function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  return (
    <header className="header">
      <div className="wrap header__inner">
        <Link href="/" className="logo-link" aria-label="Fixr, home"><Logo /></Link>
        <nav className="header__nav" aria-label="Site">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="nav__link" aria-current={path === href ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <div className="header__end">
          <ServerPill onClick={() => router.push("/scan")} />
          {path !== "/scan" && <Link className="btn btn--sm" href="/scan">Scan your code</Link>}
        </div>
      </div>
    </header>
  );
}
