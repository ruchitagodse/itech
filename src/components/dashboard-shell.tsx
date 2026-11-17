import { DashboardNavigation, WorkspaceTitle } from "@/components/dashboard-navigation";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { roleLabels, type Profile } from "@/lib/roles";
export function DashboardShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const label = roleLabels[profile.role];
  return <div className="workspace"><aside className="sidebar"><Brand /><div className="workspace-label">{label} workspace</div><DashboardNavigation role={profile.role} /><div className="sidebar-bottom"><div className="sidebar-note"><span className="status-dot" /> A simpler way to serve<p>Your service workspace starts here.</p></div><LogoutButton /></div></aside><div className="workspace-body"><header className="topbar"><span>Workspace <span className="breadcrumb">/</span> <WorkspaceTitle /></span><div className="user-badge"><span className="avatar">{profile.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>{label}</small></div></div></header><main className="dashboard-main" id="main">{children}</main><footer className="workspace-footer">iTech V2 <span>Care, connected.</span></footer></div></div>;
}
