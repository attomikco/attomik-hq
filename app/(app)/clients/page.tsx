"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/modal";
import type { Client } from "@/lib/types";
import ClientModal, {
  EMPTY_CLIENT_DRAFT,
  clientDraftToPayload,
  clientToDraft,
  type ClientDraft,
} from "./client-modal";

function isActiveClient(c: Client): boolean {
  return (c.status ?? "active") === "active";
}

export default function ClientsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClientDraft | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true });
    setClients((data as Client[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = clientDraftToPayload(editing);
    if (editing.id) {
      await supabase.from("clients").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("clients").insert(payload);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("clients").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  const activeClients = useMemo(
    () => clients.filter(isActiveClient),
    [clients],
  );
  const inactiveClients = useMemo(
    () => clients.filter((c) => !isActiveClient(c)),
    [clients],
  );
  const activeMonthlyTotal = useMemo(
    () =>
      activeClients.reduce((s, c) => s + Number(c.monthly_value ?? 0), 0),
    [activeClients],
  );

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Clients</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setEditing({ ...EMPTY_CLIENT_DRAFT })}
        >
          + New client
        </button>
      </header>

      <ClientsSectionHeader
        title="Active"
        count={activeClients.length}
        suffix={
          activeMonthlyTotal > 0
            ? `· $${activeMonthlyTotal.toLocaleString("en-US")} / mo`
            : undefined
        }
      />
      <ClientsTable
        clients={activeClients}
        loading={loading}
        emptyText="No active clients."
        onEdit={(c) => setEditing(clientToDraft(c))}
        onDelete={(c) => setDeleting(c)}
      />

      <ClientsSectionHeader
        title="Inactive"
        count={inactiveClients.length}
      />
      <ClientsTable
        clients={inactiveClients}
        loading={loading}
        emptyText="No paused or cancelled clients."
        onEdit={(c) => setEditing(clientToDraft(c))}
        onDelete={(c) => setDeleting(c)}
      />

      <ClientModal
        draft={editing}
        saving={saving}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete client?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ClientsSectionHeader({
  title,
  count,
  suffix,
}: {
  title: string;
  count: number;
  suffix?: string;
}) {
  return (
    <div className="section-header">
      <div className="section-header-bar" />
      <div
        className="section-header-title"
        style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}
      >
        <span>{title}</span>
        <span
          className="badge badge-gray mono"
          style={{ fontSize: "var(--fs-11)" }}
        >
          {count}
        </span>
        {suffix && (
          <span
            className="mono"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              fontWeight: "var(--fw-normal)",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div className="section-header-line" />
    </div>
  );
}

function ClientsTable({
  clients,
  loading,
  emptyText,
  onEdit,
  onDelete,
}: {
  clients: Client[];
  loading: boolean;
  emptyText: string;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <div
      className="table-wrapper"
      style={{ marginBottom: "var(--sp-5)" }}
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Status</th>
              <th className="td-right">Monthly</th>
              <th>Email</th>
              <th>Payment terms</th>
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
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="td-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id}>
                  <td className="td-strong">
                    <Link
                      href={`/clients/${c.id}`}
                      style={{
                        color: "inherit",
                        borderBottom: "1px dotted var(--border-strong)",
                      }}
                    >
                      {c.name ?? "—"}
                    </Link>
                  </td>
                  <td className="td-muted">
                    {c.company ? (
                      <Link
                        href={`/clients/${c.id}`}
                        style={{
                          color: "inherit",
                          borderBottom: "1px dotted var(--border-strong)",
                        }}
                      >
                        {c.company}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`badge status-${c.status ?? "active"}`}>
                      {c.status ?? "active"}
                    </span>
                  </td>
                  <td className="td-right td-mono">
                    {Number(c.monthly_value ?? 0) > 0
                      ? `$${Number(c.monthly_value).toLocaleString("en-US")}`
                      : "—"}
                  </td>
                  <td className="td-mono">{c.email ?? "—"}</td>
                  <td className="td-muted">{c.payment_terms ?? "—"}</td>
                  <td className="td-right">
                    <div
                      className="flex gap-2"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <Link
                        href={`/clients/${c.id}`}
                        className="btn btn-secondary btn-xs"
                        style={{ display: "inline-flex", gap: 4 }}
                      >
                        <ExternalLink size={12} strokeWidth={1.75} />
                        Hub
                      </Link>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => onEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => onDelete(c)}
                      >
                        Delete
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
  );
}
