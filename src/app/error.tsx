"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="standalone" id="main"><h1>We couldn’t load this page.</h1><p className="muted">Please try again. If this continues, contact your administrator.</p><button className="button primary" onClick={reset}>Try again</button><a href="/login">Return to sign in</a></main>; }
