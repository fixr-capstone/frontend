import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="lost">
      <Logo />
      <p className="lost__code">404</p>
      <h1 className="lost__title">Nothing on this line</h1>
      <p className="lost__body">This page does not exist. The scanner is on the home page.</p>
      <Link className="btn btn--primary" href="/#scanner">Go to the scanner</Link>
    </main>
  );
}
