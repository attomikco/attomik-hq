"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  currencyCompact,
  dateCompact,
  dateISO,
  addDays,
  invoiceTotal,
  invoiceStatusLabel,
  nextInvoiceNumber,
} from "@/lib/format";
import { ConfirmDialog, Modal } from "@/components/modal";
import {
  invoiceRecipientCandidates,
  type RecipientCandidate,
} from "@/lib/email/recipients";
import {
  BellRing,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  type Client,
  type Invoice,
  type NewClientDraft,
  type Service,
  type SettingsMap,
  fromLineItemDraft,
  toLineItemDraft,
  EMPTY_LINE,
} from "@/lib/types";
import InvoiceForm, { type InvoiceDraft } from "./invoice-form";
import InvoicePreview from "./invoice-preview";

const STATUS_FILTERS = [
  "all",
  "draft",
  "ready",
  "sent",
  "paid",
  "overdue",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

// Month bucket key ("2026-06") from an invoice date; "undated" if missing.
function monthKey(date: string | null): string {
  return date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "undated";
}

function monthLabel(key: string): string {
  if (key === "undated") return "No date";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function emptyDraft(number: string): InvoiceDraft {
  const today = dateISO();
  const due = dateISO(addDays(new Date(), 15));
  return {
    number,
    date: today,
    due,
    service_start_date: "",
    service_end_date: "",
    status: "draft",
    client_id: "",
    client_name: "",
    client_email: "",
    client_company: "",
    client_address: "",
    items: [{ ...EMPTY_LINE }],
    discount: "0",
    notes: "",
  };
}

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<InvoiceDraft | null>(null);
  const [previewing, setPreviewing] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [reminding, setReminding] = useState<Invoice | null>(null);
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindCandidates, setRemindCandidates] = useState<RecipientCandidate[]>([]);
  const [remindPicks, setRemindPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: invs },
      { data: cls },
      { data: svcs },
      { data: stg },
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("date", { ascending: false }),
      supabase.from("clients").select("*").order("name", { ascending: true }),
      supabase
        .from("services")
        .select("*")
        .order("price", { ascending: true }),
      supabase.from("settings").select("key, value"),
    ]);
    const loaded = (invs as Invoice[] | null) ?? [];
    const today = dateISO();
    const toMarkOverdue = loaded.filter(
      (i) => i.status === "sent" && i.due && i.due < today,
    );
    if (toMarkOverdue.length > 0) {
      await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .in(
          "id",
          toMarkOverdue.map((i) => i.id),
        );
      const ids = new Set(toMarkOverdue.map((i) => i.id));
      for (const inv of loaded) {
        if (ids.has(inv.id)) inv.status = "overdue";
      }
    }
    setInvoices(loaded);
    setClients((cls as Client[] | null) ?? []);
    setServices((svcs as Service[] | null) ?? []);
    const map: SettingsMap = {};
    for (const row of (stg as { key: string; value: string }[] | null) ?? []) {
      (map as Record<string, string>)[row.key] = row.value;
    }
    setSettings(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep-link ?edit={id} — used by "View invoice" from a linked agreement.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || invoices.length === 0) return;
    const match = invoices.find((i) => i.id === editId);
    if (match) {
      startEdit(match);
      router.replace("/invoices");
    }
    // startEdit reads clients/services from closure; re-running on those two
    // plus invoices is enough to open once they've all loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, invoices, clients, services, router]);

  const currencyCode = settings.currency ?? "USD";

  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    if (filter === "overdue") {
      const today = dateISO();
      return invoices.filter(
        (i) =>
          i.status === "overdue" ||
          (i.status === "sent" && !!i.due && i.due < today),
      );
    }
    return invoices.filter((i) => (i.status ?? "draft") === filter);
  }, [invoices, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: invoices.length };
    for (const inv of invoices) {
      const s = inv.status ?? "draft";
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [invoices]);

  // Group the filtered invoices by issue month (newest first — filtered is
  // already date-descending), each with a total-invoiced subtotal plus overdue
  // and pending (not yet sent) subtotals. Undated invoices fall to the end.
  const monthGroups = useMemo(() => {
    const today = dateISO();
    const groups: {
      key: string;
      label: string;
      total: number;
      overdue: number;
      overdueCount: number;
      pending: number;
      pendingCount: number;
      invoices: Invoice[];
    }[] = [];
    const index = new Map<string, number>();
    for (const inv of filtered) {
      const key = monthKey(inv.date);
      let gi = index.get(key);
      if (gi === undefined) {
        gi = groups.length;
        index.set(key, gi);
        groups.push({
          key,
          label: monthLabel(key),
          total: 0,
          overdue: 0,
          overdueCount: 0,
          pending: 0,
          pendingCount: 0,
          invoices: [],
        });
      }
      const amount = invoiceTotal(inv.items, inv.discount);
      const status = inv.status ?? "draft";
      groups[gi].invoices.push(inv);
      groups[gi].total += amount;
      if (
        status === "overdue" ||
        (status === "sent" && !!inv.due && inv.due < today)
      ) {
        groups[gi].overdue += amount;
        groups[gi].overdueCount += 1;
      }
      if (status === "draft" || status === "ready") {
        groups[gi].pending += amount;
        groups[gi].pendingCount += 1;
      }
    }
    const undated = groups.filter((g) => g.key === "undated");
    const dated = groups.filter((g) => g.key !== "undated");
    return [...dated, ...undated];
  }, [filtered]);

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    new Set(),
  );
  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startNew() {
    const number = nextInvoiceNumber(invoices);
    setEditing(emptyDraft(number));
  }

  function startEdit(inv: Invoice) {
    // Prefer the FK now that invoices.client_id is populated. Fall back to
    // the legacy string match for any historical row that somehow predates
    // the backfill.
    const matchClient =
      (inv.client_id &&
        clients.find((c) => c.id === inv.client_id)) ||
      (inv.client_email &&
        clients.find(
          (c) =>
            (c.email ?? "").toLowerCase() ===
            (inv.client_email ?? "").toLowerCase(),
        )) ||
      (inv.client_name &&
        clients.find(
          (c) =>
            (c.name ?? "").toLowerCase() ===
              (inv.client_name ?? "").toLowerCase() &&
            (c.company ?? "").toLowerCase() ===
              (inv.client_company ?? "").toLowerCase(),
        )) ||
      (inv.client_name &&
        clients.find(
          (c) =>
            (c.name ?? "").toLowerCase() ===
            (inv.client_name ?? "").toLowerCase(),
        )) ||
      null;

    const draftItems =
      inv.items && inv.items.length > 0
        ? inv.items.map((li) => {
            const draftLine = toLineItemDraft(li);
            const matched =
              (draftLine.service_id &&
                services.find((s) => s.id === draftLine.service_id)) ||
              services.find(
                (s) =>
                  (s.name ?? "").toLowerCase() ===
                  (draftLine.title ?? "").toLowerCase(),
              ) ||
              null;
            if (matched && !draftLine.service_id) {
              draftLine.service_id = matched.id;
            }
            if (!draftLine.description && matched) {
              draftLine.description =
                (matched.description ?? matched.desc ?? "") as string;
            }
            return draftLine;
          })
        : [{ ...EMPTY_LINE }];

    setEditing({
      id: inv.id,
      number: inv.number ?? nextInvoiceNumber(invoices),
      date: inv.date ?? dateISO(),
      due: inv.due ?? dateISO(addDays(new Date(), 15)),
      service_start_date: inv.service_start_date ?? "",
      service_end_date: inv.service_end_date ?? "",
      status: inv.status ?? "draft",
      client_id: matchClient?.id ?? "",
      client_name: inv.client_name || matchClient?.name || "",
      client_email: inv.client_email || matchClient?.email || "",
      client_company: inv.client_company || matchClient?.company || "",
      client_address: inv.client_address || matchClient?.address || "",
      items: draftItems,
      discount: String(inv.discount ?? 0),
      notes: inv.notes ?? "",
    });
  }

  async function duplicate(inv: Invoice) {
    const payload = {
      number: nextInvoiceNumber(invoices),
      date: dateISO(),
      due: dateISO(addDays(new Date(), 15)),
      service_start_date: inv.service_start_date ?? null,
      service_end_date: inv.service_end_date ?? null,
      status: "draft",
      client_id: inv.client_id,
      client_name: inv.client_name,
      client_email: inv.client_email,
      client_company: inv.client_company,
      client_address: inv.client_address,
      items: inv.items ?? [],
      discount: inv.discount ?? 0,
      notes: inv.notes,
    };
    const { error } = await supabase.from("invoices").insert(payload);
    if (error) {
      console.error("Duplicate invoice failed:", error);
      alert(`Duplicate failed: ${error.message}`);
      return;
    }
    await load();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.client_id) {
      alert("Please select a client.");
      return;
    }
    setSaving(true);
    // Dual-write: the FK is the source of truth; the legacy strings are
    // snapshotted for now as a safety net. Both go in the row.
    const payload = {
      number: editing.number,
      date: editing.date,
      due: editing.due || null,
      service_start_date: editing.service_start_date || null,
      service_end_date: editing.service_end_date || null,
      status: editing.status,
      client_id: editing.client_id,
      client_name: editing.client_name,
      client_email: editing.client_email,
      client_company: editing.client_company,
      client_address: editing.client_address,
      items: editing.items.map(fromLineItemDraft),
      discount: Number(editing.discount) || 0,
      notes: editing.notes,
    };
    const { error } = editing.id
      ? await supabase.from("invoices").update(payload).eq("id", editing.id)
      : await supabase.from("invoices").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Save invoice failed:", error);
      alert(`Save failed: ${error.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function handleCreateClient(d: NewClientDraft): Promise<Client | null> {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: d.name.trim(),
        company: d.company.trim() || null,
        email: d.email.trim() || null,
        address: d.address.trim() || null,
        payment_terms: d.payment_terms.trim() || null,
        status: "active",
        emails: [],
        monthly_value: 0,
      })
      .select()
      .single();
    if (error) {
      console.error("Create client failed:", error);
      alert(`Create client failed: ${error.message}`);
      return null;
    }
    await load(); // refresh the dropdown
    return data as Client;
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("invoices").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  // An invoice you can chase: sent/overdue and past its due date, not paid.
  function isOverdue(inv: Invoice): boolean {
    const today = dateISO();
    return (
      inv.status === "overdue" ||
      (inv.status === "sent" && !!inv.due && inv.due < today)
    );
  }

  // Open the reminder dialog with every known contact for the invoice listed,
  // pre-ticked the way an automatic reminder would have been addressed.
  function openRemind(inv: Invoice) {
    const client = clients.find((c) => c.id === inv.client_id) ?? null;
    const candidates = invoiceRecipientCandidates({
      apEmail: client?.ap_email,
      apCc: client?.ap_cc_emails,
      invoiceClientEmail: inv.client_email,
      clientEmail: client?.email,
      clientEmails: client?.emails,
    });
    setRemindCandidates(candidates);
    setRemindPicks(candidates.filter((c) => c.checked).map((c) => c.email));
    setReminding(inv);
  }

  // Selections stay in candidate order, so the topmost tick is always the To.
  function toggleRemindPick(email: string) {
    const key = email.toLowerCase();
    setRemindPicks((cur) => {
      const next = cur.some((e) => e.toLowerCase() === key)
        ? cur.filter((e) => e.toLowerCase() !== key)
        : [...cur, email];
      const keys = new Set(next.map((e) => e.toLowerCase()));
      return remindCandidates
        .filter((c) => keys.has(c.email.toLowerCase()))
        .map((c) => c.email);
    });
  }

  const remindTo = remindPicks.find(
    (e) =>
      !remindCandidates.some(
        (c) => c.locked && c.email.toLowerCase() === e.toLowerCase(),
      ),
  );

  async function handleRemind() {
    if (!reminding || remindBusy || !remindTo) return;
    setRemindBusy(true);
    try {
      const res = await fetch(`/api/invoices/${reminding.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // remindTo leads so the always-CC'd address can never become the To.
        body: JSON.stringify({
          recipients: [
            remindTo,
            ...remindPicks.filter((e) => e !== remindTo),
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to send reminder.");
      setReminding(null);
      alert(
        `Reminder sent to ${data.to ?? "the client"}${
          data.cc?.length ? ` (cc ${data.cc.join(", ")})` : ""
        }.`,
      );
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send reminder.");
    } finally {
      setRemindBusy(false);
    }
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Invoices</h1>
        </div>
        <button className="btn btn-primary" onClick={startNew}>
          + New invoice
        </button>
      </header>

      <div className="tabs" style={{ marginBottom: "var(--sp-5)" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`tab-btn ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? s : invoiceStatusLabel(s)}
            <span className="tab-count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due</th>
                <th className="td-right">Amount</th>
                <th>Status</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="td-muted">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td-muted">
                    No invoices {filter !== "all" ? `with status "${invoiceStatusLabel(filter)}"` : "yet"}.
                  </td>
                </tr>
              ) : (
                monthGroups.map((g) => {
                  const open = !collapsedMonths.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr
                        className="month-group-row"
                        onClick={() => toggleMonth(g.key)}
                        style={{ cursor: "pointer" }}
                      >
                        <td
                          colSpan={7}
                          style={{
                            background: "var(--cream)",
                            borderTop: "1px solid var(--border)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--sp-2)",
                                fontWeight: "var(--fw-semibold)",
                              }}
                            >
                              {open ? (
                                <ChevronDown size={14} strokeWidth={2} />
                              ) : (
                                <ChevronRight size={14} strokeWidth={2} />
                              )}
                              {g.label}
                            </span>
                            <span
                              className="caption mono"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--sp-2)",
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                              }}
                            >
                              <span>
                                {g.invoices.length}{" "}
                                {g.invoices.length === 1
                                  ? "invoice"
                                  : "invoices"}{" "}
                                · {currencyCompact(g.total, currencyCode)}{" "}
                                invoiced
                              </span>
                              {g.overdueCount > 0 && (
                                <span style={{ color: "var(--danger)" }}>
                                  · {currencyCompact(g.overdue, currencyCode)}{" "}
                                  overdue ({g.overdueCount})
                                </span>
                              )}
                              {g.pendingCount > 0 && (
                                <span style={{ color: "var(--warning)" }}>
                                  · {currencyCompact(g.pending, currencyCode)}{" "}
                                  pending ({g.pendingCount})
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {open &&
                        g.invoices.map((inv) => (
                          <tr key={inv.id}>
                    <td className="td-mono td-strong">
                      {inv.number ?? "—"}
                    </td>
                    <td>{inv.client_name ?? "—"}</td>
                    <td className="td-muted">{dateCompact(inv.date)}</td>
                    <td className="td-muted">{dateCompact(inv.due)}</td>
                    <td className="td-right td-mono">
                      {currencyCompact(
                        invoiceTotal(inv.items, inv.discount),
                        currencyCode,
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge status-${inv.status ?? "draft"}`}
                      >
                        {invoiceStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="td-right">
                      <div
                        style={{
                          display: "inline-flex",
                          gap: "var(--sp-1)",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setPreviewing(inv)}
                          aria-label="Preview"
                          title="Preview"
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(inv)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => duplicate(inv)}
                          aria-label="Duplicate"
                          title="Duplicate"
                        >
                          <Copy size={15} strokeWidth={1.75} />
                        </button>
                        {isOverdue(inv) && (
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openRemind(inv)}
                            aria-label="Send reminder"
                            title={
                              inv.last_reminder_at
                                ? `Send reminder (last: ${dateCompact(inv.last_reminder_at)})`
                                : "Send payment reminder"
                            }
                          >
                            <BellRing size={15} strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => setDeleting(inv)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceForm
        open={!!editing}
        draft={editing}
        clients={clients}
        services={services}
        saving={saving}
        currencyCode={currencyCode}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
        onCreateClient={handleCreateClient}
      />

      <InvoicePreview
        open={!!previewing}
        invoice={previewing}
        settings={settings}
        services={services}
        onClose={() => setPreviewing(null)}
        onSent={() => {
          setPreviewing((cur) =>
            cur ? { ...cur, status: "paid" === cur.status ? cur.status : "sent" } : cur,
          );
          void load();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete invoice?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <Modal
        open={!!reminding}
        title="Send payment reminder"
        maxWidth={460}
        onClose={() => (remindBusy ? null : setReminding(null))}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setReminding(null)}
              disabled={remindBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRemind}
              disabled={remindBusy || !remindTo}
            >
              {remindBusy ? "Sending…" : "Send reminder"}
            </button>
          </>
        }
      >
        <p style={{ color: "var(--muted)", marginBottom: "var(--sp-4)" }}>
          Payment reminder for{" "}
          <strong>{reminding?.number ?? "this invoice"}</strong> to{" "}
          {reminding?.client_name ?? "the client"}
          {reminding?.reminder_count
            ? ` — ${reminding.reminder_count} reminder${reminding.reminder_count === 1 ? "" : "s"} sent already`
            : ""}
          .
        </p>

        <div className="caption" style={{ marginBottom: "var(--sp-2)" }}>
          Recipients
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-2)",
          }}
        >
          {remindCandidates.length === 0 ? (
            <p className="caption" style={{ color: "var(--subtle)" }}>
              No contact emails on file for this client.
            </p>
          ) : (
            remindCandidates.map((c) => {
              const checked = remindPicks.some(
                (e) => e.toLowerCase() === c.email.toLowerCase(),
              );
              const isTo =
                !!remindTo && remindTo.toLowerCase() === c.email.toLowerCase();
              return (
                <label
                  key={c.email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    cursor: c.locked ? "default" : "pointer",
                    opacity: c.locked ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={c.locked || remindBusy}
                    onChange={() => toggleRemindPick(c.email)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: c.locked ? "default" : "pointer",
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.email}
                    </span>
                    <span className="caption" style={{ color: "var(--subtle)" }}>
                      {c.label}
                    </span>
                  </span>
                  {checked && (
                    <span className={`badge ${isTo ? "badge-blue" : "badge-gray"}`}>
                      {isTo ? "To" : "Cc"}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
        <p
          className="caption"
          style={{ color: "var(--subtle)", marginTop: "var(--sp-3)" }}
        >
          {remindTo
            ? "The first ticked address is the To; the rest are CC'd."
            : "Tick at least one recipient other than yourself."}
        </p>
      </Modal>
    </div>
  );
}
