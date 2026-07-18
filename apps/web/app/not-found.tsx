import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-mark" aria-hidden="true">VL</div>
      <p>404 · Route not found</p>
      <h1>This view is outside the current workspace.</h1>
      <span>Return to portfolio intelligence or open the account directory.</span>
      <div>
        <Link className="primary" href="/">Go to overview</Link>
        <Link className="secondary" href="/accounts">Browse accounts</Link>
      </div>
    </main>
  );
}
