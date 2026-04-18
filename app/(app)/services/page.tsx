"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currency } from "@/lib/format";
import { Modal, ConfirmDialog } from "@/components/modal";

type Service = {
  id: string;
  name: string | null;
  description: string | null;
  price: number | null;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
};

const EMPTY_DRAFT: Draft = { name: "", description: "", price: "0" };

export default function ServicesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .order("price", { ascending: true });
    setServices((data as Service[] | null) ?? []);
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
      description: editing.description,
      price: Number(editing.price) || 0,
    };
    if (editing.id) {
      await supabase.from("services").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("services").insert(payload);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("services").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Services</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setEditing({ ...EMPTY_DRAFT })}
        >
          + New service
        </button>
      </header>

      <div className="table-wrapper">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th className="td-right">Price</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="td-muted">
                    Loading…
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td-muted">
                    No services yet.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id}>
                    <td className="td-strong">{s.name ?? "—"}</td>
                    <td className="td-muted">{s.description ?? "—"}</td>
                    <td className="td-right td-mono">
                      {currency(Number(s.price ?? 0))}
                    </td>
                    <td className="td-right">
                      <div
                        className="flex gap-2"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            setEditing({
                              id: s.id,
                              name: s.name ?? "",
                              description: s.description ?? "",
                              price: String(s.price ?? 0),
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() => setDeleting(s)}
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

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit service" : "New service"}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="service-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save service"}
            </button>
          </>
        }
      >
        {editing && (
          <form
            id="service-form"
            onSubmit={handleSave}
            className="flex-col"
            style={{ gap: "var(--sp-4)" }}
          >
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                rows={3}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={editing.price}
                onChange={(e) =>
                  setEditing({ ...editing, price: e.target.value })
                }
              />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete service?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
