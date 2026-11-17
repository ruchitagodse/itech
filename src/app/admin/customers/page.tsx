import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listCustomers } from "@/lib/customers/server";
export const metadata = { title: "Customers" };
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  const profile = await requireRole("admin");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const cursor = typeof params.cursor === "string" ? params.cursor : "";
  const { items, nextCursor } = await listCustomers(profile, query, cursor);
  const next = new URLSearchParams({ q: query, cursor: nextCursor ?? "" });
  return <><div className="page-heading"><div><span className="eyebrow">CUSTOMER MANAGEMENT</span><h1>Customers<span className="welcome-dot">.</span></h1><p className="muted">Contact details and profiles, in one place.</p></div><Link className="button primary" href="/admin/customers/new">+ Add customer</Link></div>
    <form className="customer-search" action="/admin/customers" method="get"><div className="field"><label htmlFor="customer-search">Search by name, email or phone</label><input id="customer-search" name="q" type="search" maxLength={254} defaultValue={query} placeholder="Start typing a name, email or phone number" /></div><button className="button secondary" type="submit">Search</button>{query && <Link className="text-button" href="/admin/customers">Clear search</Link>}</form>
    {items.length === 0 ? <section className="customer-empty"><span className="card-icon" aria-hidden="true">◈</span><h2>{query ? "No matching customers" : "Your customer list starts here"}</h2><p className="muted">{query ? "Search uses the start of a name, name word, email or phone. Try a shorter search." : "Add your first customer to start keeping their contact information together."}</p><Link className="button secondary" href={query ? "/admin/customers" : "/admin/customers/new"}>{query ? "View all customers" : "Add customer"}</Link></section>
    : <section className="customer-list" aria-label="Customer list"><div className="customer-list-header"><span>Customer</span><span>Contact</span><span>Location</span><span>Status</span></div>{items.map(customer => <Link href={"/admin/customers/" + customer.id} className="customer-list-row" key={customer.id}><div><strong>{customer.fullName}</strong><small>View details →</small></div><div><span>{customer.email}</span><small>{customer.phone}</small></div><div><span>{customer.city}</span><small>{customer.state} · {customer.pincode}</small></div><div><span className={"customer-status " + (customer.active ? "is-active" : "is-inactive")}>{customer.active ? "Active" : "Inactive"}</span></div></Link>)}</section>}
    <div className="customer-pagination"><span className="muted">Up to 25 customers per page</span><div>{cursor && <Link className="button secondary" href={"/admin/customers?" + new URLSearchParams({ q: query })}>Back to first page</Link>}{nextCursor && <Link className="button secondary" href={"/admin/customers?" + next.toString()}>Next page →</Link>}</div></div>
  </>;
}
