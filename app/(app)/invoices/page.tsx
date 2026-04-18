"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  currencyCompact,
  dateCompact,
  dateISO,
  addDays,
  invoiceTotal,
  nextInvoiceNumber,
} from "@/lib/format";
import { ConfirmDialog } from "@/components/modal";
import { Copy, Eye, Pencil, Trash2 } from "lucide-react";
import {
  type Client,
  type Invoice,
  type Service,
  type SettingsMap,
  fromLineItemDraft,
  toLineItemDraft,
  EMPTY_LINE,
} from "@/lib/types";
import InvoiceForm, { type InvoiceDraft } from "./invoice-form";
import InvoicePreview from "./invoice-preview";

const STATUS_FILTERS = ["all", "draft", "sent", "paid", "overdue"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function emptyDraft(number: string): InvoiceDraft {
  const today = dateISO();
  const due = dateISO(addDays(new Date(), 15));
  return {
    number,
    date: today,
    due,
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
    setInvoices((invs as Invoice[] | null) ?? []);
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

  const currencyCode = settings.currency ?? "USD";

  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
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

  function startNew() {
    const number = nextInvoiceNumber(invoices);
    setEditing(emptyDraft(number));
  }

  function startEdit(inv: Invoice) {
    setEditing({
      id: inv.id,
      number: inv.number ?? nextInvoiceNumber(invoices),
      date: inv.date ?? dateISO(),
      due: inv.due ?? dateISO(addDays(new Date(), 15)),
      status: inv.status ?? "draft",
      client_id: "",
      client_name: inv.client_name ?? "",
      client_email: inv.client_email ?? "",
      client_company: inv.client_company ?? "",
      client_address: inv.client_address ?? "",
      items:
        inv.items && inv.items.length > 0
          ? inv.items.map(toLineItemDraft)
          : [{ ...EMPTY_LINE }],
      discount: String(inv.discount ?? 0),
      notes: inv.notes ?? "",
    });
  }

  async function duplicate(inv: Invoice) {
    const payload = {
      number: nextInvoiceNumber(invoices),
      date: dateISO(),
      due: dateISO(addDays(new Date(), 15)),
      status: "draft",
      client_name: inv.client_name,
      client_email: inv.client_email,
      client_company: inv.client_company,
      client_address: inv.client_address,
      items: inv.items ?? [],
      discount: inv.discount ?? 0,
      notes: inv.notes,
    };
    await supabase.from("invoices").insert(payload);
    await load();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = {
      number: editing.number,
      date: editing.date,
      due: editing.due || null,
      status: editing.status,
      client_name: editing.client_name,
      client_email: editing.client_email,
      client_company: editing.client_company,
      client_address: editing.client_address,
      items: editing.items.map(fromLineItemDraft),
      discount: Number(editing.discount) || 0,
      notes: editing.notes,
    };
    if (editing.id) {
      await supabase.from("invoices").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("invoices").insert(payload);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("invoices").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <div className="label mono" style={{ marginBottom: "var(--sp-2)" }}>
            01 / Invoices
          </div>
          <h1>Invoices.</h1>
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
            {s}
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
                    No invoices {filter !== "all" ? `with status "${filter}"` : "yet"}.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
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
                        {inv.status ?? "draft"}
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
                ))
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
      />

      <InvoicePreview
        open={!!previewing}
        invoice={previewing}
        settings={settings}
        onClose={() => setPreviewing(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete invoice?"
        message={`Permanently delete ${deleting?.number ?? "this invoice"}? This cannot be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
