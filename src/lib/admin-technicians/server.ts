import "server-only";
import type { UserRecord } from "firebase-admin/auth";
import { FieldPath } from "firebase-admin/firestore";
import { adminServices } from "@/lib/firebase/admin";
import type { Profile } from "@/lib/roles";
import { serviceRequestRecord } from "@/lib/service-requests/server";
import { validId } from "@/lib/service-requests/data";
import { accountLabels, accountStatus, matchesTechnician, workloadFor, type Technician, type Workload } from "./data";
function admin(profile: Profile) { if (profile.role !== "admin") throw new Error("Admin access required."); }
async function optional<T>(read: () => Promise<T>): Promise<T | null> { try { return await read(); } catch { return null; } }
const zero = (): Workload => ({ assigned: 0, pending: 0, inProgress: 0, completed: 0 });
function projection(id: string, data: FirebaseFirestore.DocumentData, account: UserRecord | null | undefined, workload: Workload | null): Technician {
  // Explicit allowlist: never pass raw Firebase Auth records to the UI.
  return { id, displayName: typeof data.displayName === "string" ? data.displayName : account?.displayName || "Technician",
    email: account?.email ?? (typeof data.email === "string" ? data.email : ""), phone: account?.phoneNumber ?? "",
    profileActive: data.active === true, createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    emailVerified: account ? account.emailVerified : null, signInDisabled: account ? account.disabled : null,
    status: accountStatus(data.active === true, account), workload };
}
export async function technicianDirectory(profile: Profile, params: { q?: string; status?: string; workload?: string; cursor?: string }) {
  admin(profile);
  const query = typeof params.q === "string" ? params.q : "", cursor = typeof params.cursor === "string" ? params.cursor : "";
  if (query.length > 254 || cursor && !validId(cursor)) throw new Error("Invalid technician search.");
  const status = params.status && Object.hasOwn(accountLabels, params.status) ? params.status : "all";
  const filter = params.workload === "assigned" || params.workload === "progress" ? params.workload : "all";
  const { db, auth } = adminServices();
  const [users, requests] = await Promise.all([
    db.collection("users").where("role", "==", "technician").orderBy(FieldPath.documentId()).select("displayName", "email", "active", "createdAt").get(),
    optional(() => db.collection("serviceRequests").select("assignedTechnicianUid", "status").get()),
  ]);
  const accounts = new Map<string, UserRecord | null | undefined>();
  // Firebase getUsers accepts at most 100 identifiers. A failed batch is
  // unavailable, which is distinct from a confirmed missing account.
  for (let i = 0; i < users.docs.length; i += 100) {
    const batch = users.docs.slice(i, i + 100), result = await optional(() => auth.getUsers(batch.map(d => ({ uid: d.id }))));
    const found = new Map(result?.users.map(u => [u.uid, u]) ?? []);
    for (const doc of batch) accounts.set(doc.id, result ? found.get(doc.id) ?? null : undefined);
  }
  const workloads = requests ? workloadFor(requests.docs.map(d => ({ assignedTechnicianUid: d.data().assignedTechnicianUid, status: d.data().status }))) : null;
  if (filter !== "all" && !workloads) throw new Error("Workload filter is temporarily unavailable.");
  const all = users.docs.map(d => projection(d.id, d.data(), accounts.get(d.id), workloads ? workloads.get(d.id) ?? zero() : null));
  const matched = all.filter(t => matchesTechnician(t, query, status, filter));
  const remaining = cursor ? matched.filter(t => t.id > cursor) : matched;
  const items = remaining.slice(0, 25), hasMore = remaining.length > 25;
  return { items, query, status, filter, cursor, nextCursor: hasMore ? items[24].id : null, matched: matched.length,
    metrics: { total: all.length, assigned: workloads ? all.filter(t => t.workload!.assigned > 0).length : null,
      inProgress: workloads ? all.filter(t => t.workload!.inProgress > 0).length : null,
      completed: workloads ? all.reduce((sum, t) => sum + t.workload!.completed, 0) : null },
    authUnavailable: all.some(t => t.status === "unavailable") };
}
export type JobCursors = { pendingCursor?: string; progressCursor?: string; completedCursor?: string };
export async function technicianDetails(profile: Profile, id: string, cursors: JobCursors = {}) {
  admin(profile);
  if (!validId(id) || Object.values(cursors).some(c => c && !validId(c))) throw new Error("Invalid technician record.");
  const { db, auth } = adminServices(), doc = await db.collection("users").doc(id).get();
  // Check role before reading any Auth account or assignment information.
  if (!doc.exists || doc.data()?.role !== "technician") return null;
  const authResult = await optional(async (): Promise<{ account: UserRecord | null }> => {
    try { return { account: await auth.getUser(id) }; }
    catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found") return { account: null }; throw error; }
  });
  async function page(status: string, cursor = "") {
    const collection = db.collection("serviceRequests");
    let query = collection.where("assignedTechnicianUid", "==", id).where("status", "==", status).orderBy("createdAt", "desc");
    if (cursor) {
      const marker = await collection.doc(cursor).get(), data = marker.data();
      if (!marker.exists || data?.assignedTechnicianUid !== id || data?.status !== status) throw new Error("Invalid assignment page.");
      query = query.startAfter(marker);
    }
    const result = await query.limit(7).get(), items = result.docs.slice(0, 6).map(serviceRequestRecord);
    return { items, nextCursor: result.size > 6 ? items[5].id : null };
  }
  const [requests, pending, progress, completed] = await Promise.all([
    optional(() => db.collection("serviceRequests").where("assignedTechnicianUid", "==", id).select("assignedTechnicianUid", "status").get()),
    optional(() => page("pending", cursors.pendingCursor)), optional(() => page("in_progress", cursors.progressCursor)), optional(() => page("completed", cursors.completedCursor)),
  ]);
  const workload = requests ? workloadFor(requests.docs.map(d => ({ assignedTechnicianUid: d.data().assignedTechnicianUid, status: d.data().status }))).get(id) ?? zero() : null;
  const technician = projection(id, doc.data()!, authResult === null ? undefined : authResult.account, workload);
  return { technician, pending, progress, completed };
}
export type TechnicianDirectoryData = Awaited<ReturnType<typeof technicianDirectory>>;
export type TechnicianDetailData = NonNullable<Awaited<ReturnType<typeof technicianDetails>>>;
