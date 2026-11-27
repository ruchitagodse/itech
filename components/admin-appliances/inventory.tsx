import Link from "next/link";
import { Icon } from "@/components/admin-dashboard/icons";
import type { AdminApplianceInventoryData } from "@/lib/admin-appliances/server";
import {
  ApplianceAvatar,
  ApplianceTypeBadge,
  CoverageBadge,
  displayDate,
  EmptyState,
  PageHeader,
} from "./shared";
import s from "./appliances.module.css";

export function ApplianceInventory({ data }: { data: AdminApplianceInventoryData }) {
  const { items, matched, nextCursor, cursor, query, typeFilter, coverageFilter, metrics } = data;
  const isFiltered = Boolean(query || (typeFilter && typeFilter !== "all") || (coverageFilter && coverageFilter !== "all"));

  const buildUrl = (newParams: { q?: string; type?: string; coverage?: string; cursor?: string | null }) => {
    const params = new URLSearchParams();
    const q = newParams.q !== undefined ? newParams.q : query;
    const type = newParams.type !== undefined ? newParams.type : typeFilter;
    const coverage = newParams.coverage !== undefined ? newParams.coverage : coverageFilter;
    const cur = newParams.cursor !== undefined ? newParams.cursor : cursor;

    if (q) params.set("q", q);
    if (type && type !== "all") params.set("type", type);
    if (coverage && coverage !== "all") params.set("coverage", coverage);
    if (cur) params.set("cursor", cur);

    const qs = params.toString();
    return `/admin/appliances${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className={s.screen}>
      {/* 1. Header */}
      <PageHeader
        title="Appliance Management"
        subtitle="Manage registered customer appliances, service plans, and installation records"
        addHref="/admin/appliances/new"
        count={metrics.total}
      />

      {/* 2. Metrics Summary Cards */}
      <div className={s.metrics}>
        <div className={s.metric}>
          <div className={s.metricTop}>
            <span>Total Appliances</span>
            <span className={s.iconTile}>
              <Icon name="appliance" />
            </span>
          </div>
          <div className={s.metricValue}>{metrics.total}</div>
          <p className={s.metricNote}>Registered across customer base</p>
        </div>

        <div className={s.metric}>
          <div className={s.metricTop}>
            <span>Air Conditioners</span>
            <span className={s.iconTile} style={{ color: "#07529b", background: "#edf6fd" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 14h12M9 10h6" />
              </svg>
            </span>
          </div>
          <div className={s.metricValue}>{metrics.ac}</div>
          <p className={s.metricNote}>Split & window AC systems</p>
        </div>

        <div className={s.metric}>
          <div className={s.metricTop}>
            <span>Water Purifiers</span>
            <span className={s.iconTile} style={{ color: "#059669", background: "#ecfdf5" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </span>
          </div>
          <div className={s.metricValue}>{metrics.waterPurifier}</div>
          <p className={s.metricNote}>RO & UV purification units</p>
        </div>

        <div className={s.metric}>
          <div className={s.metricTop}>
            <span>Active Coverage</span>
            <span className={s.iconTile} style={{ color: "#059669", background: "#ecfdf5" }}>
              <Icon name="plan" />
            </span>
          </div>
          <div className={s.metricValue}>{metrics.activeCoverage}</div>
          <p className={s.metricNote}>Covered under active care plan</p>
        </div>

        <div className={s.metric}>
          <div className={s.metricTop}>
            <span>Expired Coverage</span>
            <span className={s.iconTile} style={{ color: "#b45309", background: "#fffbeb" }}>
              <Icon name="clock" />
            </span>
          </div>
          <div className={s.metricValue}>{metrics.expiredCoverage}</div>
          <p className={s.metricNote}>Eligible for annual renewal</p>
        </div>
      </div>

      {/* 3. Main Directory Panel */}
      <section className={s.panel}>
        <div className={s.panelHeading}>
          <div>
            <h2>
              Appliance Directory
              <span className={s.countPill}>{matched}</span>
            </h2>
            <p>Search, filter, and inspect customer appliances and coverage details</p>
          </div>
          <div>
            <Link className={s.outline} href="/admin/appliances/new">
              <Icon name="plus" />
              Add appliance
            </Link>
          </div>
        </div>

        {/* Search & Filter Form */}
        <form className={s.searchForm} method="get" action="/admin/appliances">
          <div className={s.searchField}>
            <label htmlFor="search-q">Search appliances</label>
            <div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                id="search-q"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search by brand, model, serial, customer name, or phone…"
              />
            </div>
          </div>

          <div className={s.filterField}>
            <label htmlFor="filter-type">Appliance type</label>
            <select id="filter-type" name="type" defaultValue={typeFilter}>
              <option value="all">All appliances</option>
              <option value="ac">Air Conditioners</option>
              <option value="water_purifier">Water Purifiers</option>
            </select>
          </div>

          <div className={s.filterField}>
            <label htmlFor="filter-coverage">Coverage status</label>
            <select id="filter-coverage" name="coverage" defaultValue={coverageFilter}>
              <option value="all">All coverage</option>
              <option value="active">Active coverage</option>
              <option value="expired">Expired coverage</option>
              <option value="none">No coverage</option>
            </select>
          </div>

          <button className={s.secondary} type="submit">
            Apply filters
          </button>
        </form>

        {isFiltered && (
          <div className={s.resultsMeta}>
            <span>
              Showing {matched} {matched === 1 ? "appliance" : "appliances"} matching criteria
            </span>
            <Link href="/admin/appliances">Clear all filters</Link>
          </div>
        )}

        {/* 4. Table view for Desktop */}
        {items.length === 0 ? (
          <EmptyState
            title={isFiltered ? "No matching appliances found" : "No appliances registered yet"}
            text={
              isFiltered
                ? "Try clearing or adjusting your search filters to view more appliances."
                : "Register a customer's water purifier or air conditioner to track service history and maintenance plans."
            }
            actionHref={isFiltered ? "/admin/appliances" : "/admin/appliances/new"}
            actionText={isFiltered ? "Clear filters" : "Add first appliance"}
          />
        ) : (
          <>
            <div className={s.tableWrap}>
              <table className={s.directoryTable}>
                <thead>
                  <tr>
                    <th>Appliance</th>
                    <th>Type</th>
                    <th>Serial Number</th>
                    <th>Customer</th>
                    <th>Installed</th>
                    <th>Coverage Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const detailHref = `/admin/customers/${item.customerId}/appliances/${item.id}`;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className={s.applianceCell}>
                            <ApplianceAvatar type={item.type} />
                            <div>
                              <Link className={s.applianceBrand} href={detailHref}>
                                {item.brand}
                              </Link>
                              <span className={s.applianceModel}>{item.model}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <ApplianceTypeBadge type={item.type} />
                        </td>
                        <td>
                          {item.serialNumber ? (
                            <span className={s.monoTag}>{item.serialNumber}</span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 12 }}>None</span>
                          )}
                        </td>
                        <td>
                          <div>
                            <Link className={s.customerLink} href={`/admin/customers/${item.customerId}`}>
                              {item.customerName}
                            </Link>
                            <span className={s.contactSub}>
                              {item.customerPhone || item.customerCity || "No contact info"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: "#334155" }}>
                            {displayDate(item.installationDate || item.purchaseDate)}
                          </span>
                        </td>
                        <td>
                          <div>
                            <CoverageBadge status={item.plan?.status} />
                            {item.plan && (
                              <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                {item.plan.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                            <Link className={s.outline} href={detailHref} style={{ minHeight: 34, padding: "6px 12px", fontSize: 12.5 }}>
                              View
                            </Link>
                            <Link
                              className={s.secondary}
                              href={`${detailHref}/edit`}
                              style={{ minHeight: 34, padding: "6px 12px", fontSize: 12.5 }}
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 5. Mobile Cards View */}
            <div className={s.applianceCards}>
              {items.map(item => {
                const detailHref = `/admin/customers/${item.customerId}/appliances/${item.id}`;
                return (
                  <div key={item.id} className={s.applianceCard}>
                    <div className={s.cardHeader}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <ApplianceAvatar type={item.type} />
                        <div>
                          <h3 className={s.cardTitle}>
                            <Link href={detailHref}>{item.brand} {item.model}</Link>
                          </h3>
                          <span className={s.cardTypeLabel}>
                            {item.type === "ac" ? "Air Conditioner" : "Water Purifier"}
                          </span>
                        </div>
                      </div>
                      <CoverageBadge status={item.plan?.status} />
                    </div>

                    <div className={s.cardMetaGrid}>
                      <div className={s.metaItem}>
                        <span className={s.metaLabel}>Customer</span>
                        <Link className={s.customerLink} href={`/admin/customers/${item.customerId}`}>
                          {item.customerName}
                        </Link>
                      </div>
                      <div className={s.metaItem}>
                        <span className={s.metaLabel}>Serial Number</span>
                        <span className={s.metaValue}>
                          {item.serialNumber ? (
                            <span className={s.monoTag}>{item.serialNumber}</span>
                          ) : (
                            "Not recorded"
                          )}
                        </span>
                      </div>
                      <div className={s.metaItem}>
                        <span className={s.metaLabel}>Installed Date</span>
                        <span className={s.metaValue}>
                          {displayDate(item.installationDate || item.purchaseDate)}
                        </span>
                      </div>
                      <div className={s.metaItem}>
                        <span className={s.metaLabel}>Service Plan</span>
                        <span className={s.metaValue}>
                          {item.plan ? item.plan.name : "None"}
                        </span>
                      </div>
                    </div>

                    <div className={s.cardActions}>
                      <Link className={s.outline} href={detailHref}>
                        View details
                      </Link>
                      <Link className={s.secondary} href={`${detailHref}/edit`}>
                        Edit appliance
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 6. Pagination */}
            {(cursor || nextCursor) && (
              <div className={s.pagination}>
                <span>
                  Showing page {cursor ? "after " + cursor.slice(0, 8) : "1"}
                </span>
                <div>
                  {cursor && (
                    <Link className={s.outline} href={buildUrl({ cursor: null })}>
                      First page
                    </Link>
                  )}
                  {nextCursor && (
                    <Link className={s.primary} href={buildUrl({ cursor: nextCursor })}>
                      Next page →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
