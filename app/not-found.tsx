import Link from "next/link";

export default function NotFound() {
  return (
    <div className="lost">
      <p className="lost__code">404</p>
      <h1 className="lost__title">Nothing on this line</h1>
      <p className="lost__body">This page does not exist. The scanner has its own page.</p>
      <Link className="btn btn--primary" href="/scan">Go to the scanner</Link>
    </div>
  );
}
