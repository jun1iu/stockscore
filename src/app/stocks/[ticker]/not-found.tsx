import Link from 'next/link';

export default function NotCovered() {
  return (
    <section className="panel narrow">
      <h1>Not covered</h1>
      <p>StockScore covers 70 of the largest US companies outside banking, insurance and property. This ticker isn’t one of them.</p>
      <p><Link href="/rankings">See all 70 →</Link></p>
    </section>
  );
}
