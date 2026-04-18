"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dateShort } from "@/lib/format";
import { Modal, ConfirmDialog } from "@/components/modal";

type Client = {
  id: string;
  name: string | null;
  email: string | null;
  emails: string[] | null;
  company: string | null;
  address: string | null;
  payment_terms: string | null;
  created_at: string | null;
};

type Draft = {
  id?: string;
  name: string;
  company: string;
  address: string;
  email: string;
  emails: string[];
  payment_terms: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  company: "",
  address: "",
  email: "",
  emails: [],
  payment_terms: "Net 15",
};

export default function ClientsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
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
    const payload = {
      name: editing.name,
      company: editing.company,
      address: editing.address,
      email: editing.email,
      emails: editing.emails,
      payment_terms: editing.payment_terms,
    };
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
          onClick={() => setEditing({ ...EMPTY_DRAFT })}
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
                <th>Email</th>
                <th>Payment terms</th>
                <th>Created</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    Loading…
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    No clients yet. Click &ldquo;New client&rdquo; to add one.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id}>
                    <td className="td-strong">{c.name ?? "—"}</td>
                    <td className="td-muted">{c.company ?? "—"}</td>
                    <td className="td-mono">{c.email ?? "—"}</td>
                    <td className="td-muted">{c.payment_terms ?? "—"}</td>
                    <td className="td-muted">{dateShort(c.created_at)}</td>
                    <td className="td-right">
                      <div
                        className="flex gap-2"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            setEditing({
                              id: c.id,
                              name: c.name ?? "",
                              company: c.company ?? "",
                              address: c.address ?? "",
                              email: c.email ?? "",
                              emails: Array.isArray(c.emails) ? c.emails : [],
                              payment_terms: c.payment_terms ?? "Net 15",
                            })
                          }
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

function ClientModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: Draft | null;
  saving: boolean;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [emailInput, setEmailInput] = useState("");

  if (!draft) return null;

  function addEmail(raw: string) {
    const val = raw.trim();
    if (!val || !draft) return;
    if (draft.emails.includes(val)) return;
    onChange({ ...draft, emails: [...draft.emails, val] });
    setEmailInput("");
  }

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={draft.id ? "Edit client" : "New client"}
      maxWidth={560}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="client-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save client"}
          </button>
        </>
      }
    >
      <form
        id="client-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-4)" }}
      >
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            required
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Company</label>
          <input
            value={draft.company}
            onChange={(e) => onChange({ ...draft, company: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea
            rows={3}
            value={draft.address}
            onChange={(e) => onChange({ ...draft, address: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Primary email</label>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Additional emails</label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-2)",
              padding: "var(--sp-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              background: "var(--paper)",
              minHeight: 44,
            }}
          >
            {draft.emails.map((em) => (
              <span
                key={em}
                className="badge badge-gray"
                style={{ gap: "var(--sp-2)" }}
              >
                {em}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      emails: draft.emails.filter((x) => x !== em),
                    })
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "var(--text-sm)",
                    lineHeight: 1,
                  }}
                  aria-label={`Remove ${em}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="email"
              value={emailInput}
              placeholder="Type and press Enter"
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addEmail(emailInput);
                } else if (
                  e.key === "Backspace" &&
                  !emailInput &&
                  draft.emails.length > 0
                ) {
                  onChange({
                    ...draft,
                    emails: draft.emails.slice(0, -1),
                  });
                }
              }}
              onBlur={() => emailInput && addEmail(emailInput)}
              style={{
                border: "none",
                outline: "none",
                flex: 1,
                minWidth: 160,
                padding: 0,
                background: "transparent",
                boxShadow: "none",
              }}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment terms</label>
          <input
            value={draft.payment_terms}
            onChange={(e) =>
              onChange({ ...draft, payment_terms: e.target.value })
            }
            placeholder="e.g. Net 15"
          />
        </div>
      </form>
    </Modal>
  );
}
