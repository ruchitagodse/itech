import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
export default async function LoginPage() {
  const profile = await currentProfile();
  if (profile) redirect("/" + profile.role);
  return <div className="login-layout">
    <aside className="login-story"><Brand light /><div className="story-content"><span className="eyebrow">A BETTER EVERYDAY</span><h1>Great service.<br />Made simple.</h1><p>One connected workspace for the people who keep homes comfortable.</p><div className="service-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="visual-core">i<span>Tech</span><small>CARE, CONNECTED.</small></div><div className="floating-tag water"><span>◈</span> Pure water</div><div className="floating-tag air"><span>❄</span> Perfect comfort</div></div><div className="story-services"><span>Water purifier care</span><span>Air conditioning care</span></div></div><footer>Built around people. Designed for better service.</footer></aside>
    <main className="login-main" id="main"><div className="mobile-brand"><Brand /></div><div className="login-card"><span className="pill">YOUR SERVICE WORKSPACE</span><h2>Welcome back</h2><p className="muted intro">Sign in to your iTech account to continue.</p><AuthForm /><div className="access-note"><span aria-hidden="true">◈</span><p>Your account is provided by your administrator.<br />Need access? Contact your iTech team.</p></div></div><footer className="login-footer">iTech V2 <span>•</span> Service, simplified.</footer></main>
  </div>;
}
