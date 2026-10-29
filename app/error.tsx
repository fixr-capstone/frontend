"use client";

import Logo from "@/components/Logo";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="lost">
      <Logo />
      <p className="lost__code">Error</p>
      <h1 className="lost__title">Something broke on our side</h1>
      <p className="lost__body">The page hit an unexpected error. Try again, or reload the page.</p>
      <button type="button" className="btn btn--primary" onClick={reset}>Try again</button>
    </main>
  );
}
