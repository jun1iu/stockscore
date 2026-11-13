import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="panel narrow">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>There’s nothing at this address. Try the search above, or start from one of these.</p>
      <p className="narrow__links"><Link href="/">Home</Link> <Link href="/rankings">Rankings</Link> <Link href="/track-record">Track record</Link></p>
    </section>
  );
}
