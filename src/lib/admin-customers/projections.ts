import type { CustomerRecord } from "@/lib/customers/data";
export const directoryFilters = ["all", "active", "plans", "pending"] as const;
export type DirectoryFilter = typeof directoryFilters[number];
export type Relationships = { appliances: number | null; activeAppliances: number | null; activePlans: number | null; pendingRequests: number | null };
export function matchesFilter(customer: CustomerRecord, filter: DirectoryFilter, relationships: Relationships) {
  if (filter === "active") return customer.active;
  if (filter === "plans") return relationships.activePlans !== null && relationships.activePlans > 0;
  if (filter === "pending") return relationships.pendingRequests !== null && relationships.pendingRequests > 0;
  return true;
}
// Filter complete source pages before pagination, so matching records on later
// pages are not hidden. The lookahead establishes a real next page of matches.
export async function filteredDirectory(
  read: (cursor: string) => Promise<{ items: CustomerRecord[]; nextCursor: string | null }>,
  filter: DirectoryFilter,
  relationships: (id: string) => Relationships,
  cursor = "",
) {
  if (filter === "all") return read(cursor);
  const selected: CustomerRecord[] = [];
  let after = cursor;
  const seen = new Set<string>();
  do {
    const page = await read(after);
    for (const customer of page.items) {
      if (matchesFilter(customer, filter, relationships(customer.id))) selected.push(customer);
      if (selected.length === 26) return { items: selected.slice(0, 25), nextCursor: selected[24].id };
    }
    if (!page.nextCursor) break;
    if (seen.has(page.nextCursor)) throw new Error("Customer pagination did not advance.");
    seen.add(page.nextCursor);
    after = page.nextCursor;
  } while (true);
  return { items: selected, nextCursor: null };
}
