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

      <div className="table-wrapper">
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
                    No clients yet. Click &ldquo;New client&rdquo; to add one.
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
                      <span
                        className={`badge status-${c.status ?? "active"}`}
                      >
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
                          onClick={() => setEditing(clientToDraft(c))}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() => setDeleting(c)}
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
