import Link from "next/link";
export default function NotFound() { return <main className="standalone" id="main"><span className="pill">404</span><h1>This page isn’t here.</h1><p className="muted">Let’s get you back to your workspace.</p><Link className="button primary" href="/">Go to workspace</Link></main>; }
