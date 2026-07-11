"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dateCompact } from "@/lib/format";
import { ConfirmDialog } from "@/components/modal";
import {
  PROSPECT_STATUSES,
  type Prospect,
  type ProspectStatus,
} from "@/lib/types";
import ProspectForm, {
  CHANNEL_LABEL,
  STATUS_LABEL,
  type ProspectDraft,
} from "./prospect-form";

const STATUS_FILTERS = ["all", ...PROSPECT_STATUSES] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function emptyDraft(): ProspectDraft {
  return {
    company: "",
    contact_name: "",
    contact_email: "",
    contact_role: "",
    channel: "",
    status: "not_contacted",
    notes: "",
  };
}

function toDraft(p: Prospect): ProspectDraft {
  return {
    id: p.id,
    company: p.company ?? "",
    contact_name: p.contact_name ?? "",
    contact_email: p.contact_email ?? "",
    contact_role: p.contact_role ?? "",
    channel: p.channel ?? "",
    status: p.status,
    notes: p.notes ?? "",
  };
}

export default function ProspectsPanel({
  onOpenOpportunity,
}: {
  // Switch the pipeline view to Opportunities and open the given opportunity.
  onOpenOpportunity: (opportunityId: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<ProspectDraft | null>(null);
  const [deleting, setDeleting] = useState<Prospect | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Sort by last_touch_at desc; untouched prospects (null) sink to the bottom.
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .order("last_touch_at", { ascending: false, nullsFirst: false });
    setProspects((data as Prospect[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: prospects.length } as Record<StatusFilter, number>;
    for (const s of PROSPECT_STATUSES) c[s] = 0;
    for (const p of prospects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [prospects]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? prospects
        : prospects.filter((p) => p.status === filter),
    [prospects, filter],
  );

  function startNew() {
    setEditing(emptyDraft());
  }

  function startEdit(p: Prospect) {
    setEditing(toDraft(p));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = {
      company: editing.company,
      contact_name: editing.contact_name || null,
      contact_email: editing.contact_email || null,
      contact_role: editing.contact_role || null,
      channel: editing.channel || null,
      status: editing.status,
      notes: editing.notes || null,
    };
    const { error } = editing.id
      ? await supabase.from("prospects").update(payload).eq("id", editing.id)
      : await supabase.from("prospects").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Save prospect failed:", error);
      alert(`Save failed: ${error.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("prospects").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  // Inline status change with the timestamp rules:
  //  - any status change bumps last_touch_at
  //  - moving to 'contacted' stamps first_contacted_at the first time only
  async function handleStatusChange(p: Prospect, next: ProspectStatus) {
    if (next === p.status) return;
    setBusyId(p.id);
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: next,
      last_touch_at: now,
    };
    if (next === "contacted" && !p.first_contacted_at) {
      updates.first_contacted_at = now;
    }
    const { error } = await supabase
      .from("prospects")
      .update(updates)
      .eq("id", p.id);
    setBusyId(null);
    if (error) {
      console.error("Status change failed:", error);
      alert(`Status change failed: ${error.message}`);
      return;
    }
    await load();
  }

  // Graduate: create an opportunity prefilled from the prospect, link it back,
  // mark the prospect graduated, then hand off to the opportunity view.
  async function handleGraduate(p: Prospect) {
    if (p.status === "graduated") return;
    setBusyId(p.id);
    const oppPayload = {
      company_name: p.company,
      contact_name: p.contact_name,
      contact_email: p.contact_email,
      // A graduated prospect has already replied with interest, so it enters at
      // the first stage denoting a validated two-way conversation, not 'idea'.
      stage: "qualified",
      source: "outbound",
      // contact_role has no home on opportunities; it stays on the prospect.
      notes: p.notes ? `From prospect: ${p.notes}` : null,
    };
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .insert(oppPayload)
      .select("id")
      .single();
    if (oppErr || !opp) {
      setBusyId(null);
      console.error("Graduate (create opportunity) failed:", oppErr);
      alert(`Graduate failed: ${oppErr?.message ?? "no opportunity id"}`);
      return;
    }
    const { error: linkErr } = await supabase
      .from("prospects")
      .update({
        status: "graduated",
        opportunity_id: opp.id,
        last_touch_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    setBusyId(null);
    if (linkErr) {
      console.error("Graduate (link prospect) failed:", linkErr);
      alert(`Graduate failed: ${linkErr.message}`);
      return;
    }
    await load();
    onOpenOpportunity(opp.id);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "var(--sp-4)",
        }}
      >
        <button className="btn btn-primary" onClick={startNew}>
          + New prospect
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: "var(--sp-5)" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`tab-btn ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "all" : STATUS_LABEL[s]}
            <span className="tab-count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Last touch</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    No prospects
                    {filter !== "all"
                      ? ` in "${STATUS_LABEL[filter]}"`
                      : " yet"}
                    .
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const graduated = p.status === "graduated";
                  return (
                    <tr key={p.id}>
                      <td className="td-strong">{p.company || "—"}</td>
                      <td className="td-muted">
                        {p.contact_name ?? "—"}
                        {p.contact_role && (
                          <div className="caption">{p.contact_role}</div>
                        )}
                        {p.contact_email && (
                          <div className="caption mono">{p.contact_email}</div>
                        )}
                      </td>
                      <td className="td-muted">
                        {p.channel ? CHANNEL_LABEL[p.channel] ?? p.channel : "—"}
                      </td>
                      <td>
                        <select
                          value={p.status}
                          disabled={busyId === p.id}
                          onChange={(e) =>
                            handleStatusChange(
                              p,
                              e.target.value as ProspectStatus,
                            )
                          }
                          style={{ minWidth: 130 }}
                        >
                          {PROSPECT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="td-muted">
                        {p.last_touch_at ? dateCompact(p.last_touch_at) : "—"}
                      </td>
                      <td
                        className="td-right"
                        style={{ minWidth: 120, whiteSpace: "nowrap" }}
                      >
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
                            onClick={() => startEdit(p)}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil size={15} strokeWidth={1.75} />
                          </button>
                          {graduated && p.opportunity_id ? (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() =>
                                onOpenOpportunity(p.opportunity_id as string)
                              }
                              aria-label="View opportunity"
                              title="View opportunity"
                            >
                              <ExternalLink size={15} strokeWidth={1.75} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => handleGraduate(p)}
                              disabled={busyId === p.id || graduated}
                              aria-label="Graduate to opportunity"
                              title="Graduate to opportunity"
                            >
                              <GraduationCap size={15} strokeWidth={1.75} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => setDeleting(p)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProspectForm
        open={!!editing}
        draft={editing}
        saving={saving}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete prospect?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
