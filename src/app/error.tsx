'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  return (
    <section className="panel narrow" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1>This page couldn’t be shown</h1>
      <p>The data may be mid-refresh. Trying again usually works.</p>
      <p><button type="button" className="button" onClick={() => retry()}>Try again</button></p>
      {digest && <p className="muted small">Reference: {digest}</p>}
    </section>
  );
}
