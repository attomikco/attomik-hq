"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/modal";
import PDFDownloadButton from "@/components/pdf-download-button";
import { currency, currencyCompact, dateShort, lineSubtotal } from "@/lib/format";
import { KICKOFF_CATEGORIES } from "@/lib/defaults/kickoff-checklist";
import type {
  Agreement,
  Client,
  ClientCredential,
  ClientPlatformAccess,
  ClientResource,
  Invoice,
  KickoffItem,
  Opportunity,
  Proposal,
  ResourceType,
  Service,
  SettingsMap,
} from "@/lib/types";
import ClientModal, {
  clientDraftToPayload,
  clientToDraft,
  type ClientDraft,
} from "../client-modal";
import PlatformAccessModal, {
  EMPTY_PLATFORM_DRAFT,
  type PlatformAccessDraft,
} from "./platform-access-modal";
import CredentialModal, {
  EMPTY_CREDENTIAL_DRAFT,
  type CredentialDraft,
} from "./credential-modal";
import ResourceModal, {
  EMPTY_RESOURCE_DRAFT,
  type ResourceDraft,
} from "./resource-modal";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  drive: "Google Drive",
  notion: "Notion",
  figma: "Figma",
  slack: "Slack",
  dropbox: "Dropbox",
  other: "Link",
};

const RESOURCE_BADGE_CLASS: Record<ResourceType, string> = {
  drive: "badge-google",
  notion: "badge-gray",
  figma: "badge-meta",
  slack: "badge-shopify",
  dropbox: "badge-walmart",
  other: "badge-gray",
};

function platformAccessToDraft(p: ClientPlatformAccess): PlatformAccessDraft {
  return {
    id: p.id,
    platform: p.platform,
    login_email: p.login_email ?? "",
    access_level: p.access_level ?? "",
    status: p.status,
    login_url: p.login_url ?? "",
    notes: p.notes ?? "",
  };
}

function credentialToDraft(c: ClientCredential): CredentialDraft {
  return {
    id: c.id,
    label: c.label ?? "",
    url: c.url ?? "",
    username: c.username ?? "",
    password: c.password ?? "",
    notes: c.notes ?? "",
  };
}

function resourceToDraft(r: ClientResource): ResourceDraft {
  return {
    id: r.id,
    label: r.label ?? "",
    url: r.url ?? "",
    type: r.type,
    notes: r.notes ?? "",
  };
}

export default function ClientHubPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";
  const supabase = useMemo(() => createClient(), []);

  // Core data
  const [client, setClient] = useState<Client | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [originProposal, setOriginProposal] = useState<Proposal | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [platformAccess, setPlatformAccess] = useState<ClientPlatformAccess[]>(
    [],
  );
  const [credentials, setCredentials] = useState<ClientCredential[]>([]);
  const [resources, setResources] = useState<ClientResource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [editingClient, setEditingClient] = useState<ClientDraft | null>(null);
  const [savingClient, setSavingClient] = useState(false);

  const [editingPA, setEditingPA] = useState<PlatformAccessDraft | null>(null);
  const [savingPA, setSavingPA] = useState(false);
  const [deletingPA, setDeletingPA] =
    useState<ClientPlatformAccess | null>(null);

  const [editingCred, setEditingCred] = useState<CredentialDraft | null>(null);
  const [savingCred, setSavingCred] = useState(false);
  const [deletingCred, setDeletingCred] =
    useState<ClientCredential | null>(null);
  const [revealedCreds, setRevealedCreds] = useState<Record<string, boolean>>(
    {},
  );

  const [editingRes, setEditingRes] = useState<ResourceDraft | null>(null);
  const [savingRes, setSavingRes] = useState(false);
  const [deletingRes, setDeletingRes] = useState<ClientResource | null>(null);

  // Inline hub_notes editor
  const [hubNotesDraft, setHubNotesDraft] = useState("");
  const [hubNotesDirty, setHubNotesDirty] = useState(false);
  const [savingHubNotes, setSavingHubNotes] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();
    const c = (clientData as Client | null) ?? null;
    setClient(c);
    if (c) {
      setHubNotesDraft(c.hub_notes ?? "");
      setHubNotesDirty(false);
    }
    if (!c) {
      setLoading(false);
      return;
    }

    const emailKey = (c.email ?? "").toLowerCase();
    const companyKey = (c.company ?? "").toLowerCase();

    const oppPromise = c.opportunity_id
      ? supabase
          .from("opportunities")
          .select("*")
          .eq("id", c.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null });
    const propPromise = c.proposal_id
      ? supabase
          .from("proposals")
          .select("*")
          .eq("id", c.proposal_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [
      { data: opps },
      { data: oppProp },
      { data: allProps },
      { data: allAgrs },
      { data: allInvs },
      { data: pa },
      { data: cr },
      { data: rs },
      { data: svc },
      { data: stg },
    ] = await Promise.all([
      oppPromise,
      propPromise,
      supabase
        .from("proposals")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("agreements")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("client_platform_access")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_credentials")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_resources")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase.from("services").select("*"),
      supabase.from("settings").select("key, value"),
    ]);

    function matches(item: {
      client_email?: string | null;
      client_company?: string | null;
    }) {
      const e = (item.client_email ?? "").toLowerCase();
      const co = (item.client_company ?? "").toLowerCase();
      return (emailKey && e === emailKey) || (companyKey && co === companyKey);
    }

    setOpportunity((opps as Opportunity | null) ?? null);
    setOriginProposal((oppProp as Proposal | null) ?? null);
    setProposals(((allProps as Proposal[] | null) ?? []).filter(matches));
    setAgreements(((allAgrs as Agreement[] | null) ?? []).filter(matches));
    setInvoices(((allInvs as Invoice[] | null) ?? []).filter(matches));
    setPlatformAccess((pa as ClientPlatformAccess[] | null) ?? []);
    setCredentials((cr as ClientCredential[] | null) ?? []);
    setResources((rs as ClientResource[] | null) ?? []);
    setServices((svc as Service[] | null) ?? []);
    const map: SettingsMap = {};
    for (const row of (stg as { key: string; value: string }[] | null) ?? []) {
      (map as Record<string, string>)[row.key] = row.value;
    }
    setSettings(map);
    setLoading(false);
  }, [clientId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const currencyCode = settings.currency ?? "USD";

  // ── derived ────────────────────────────────────────────────────────

  const lifetimeValue = useMemo(() => {
    return agreements.reduce((sum, a) => {
      const p1 = Number(a.phase1_total) || 0;
      const p2 =
        (Number(a.phase2_rate) || 0) * (Number(a.phase2_commitment) || 0);
      return sum + p1 + p2;
    }, 0);
  }, [agreements]);

  const monthsAsClient = useMemo(() => {
    if (!client?.created_at) return null;
    const start = new Date(client.created_at);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    const months =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());
    return Math.max(0, months);
  }, [client]);

  type Doc = {
    kind: "proposal" | "agreement" | "invoice";
    id: string;
    number: string | null;
    date: string | null;
    status: string | null;
    amount: number;
    original: Proposal | Agreement | Invoice;
  };

  const documents = useMemo<Doc[]>(() => {
    const docs: Doc[] = [];
    for (const p of proposals) {
      const p1 = Number(p.p1_total ?? 0) || 0;
      const p2 = Number(p.p2_rate ?? 0) || 0;
      docs.push({
        kind: "proposal",
        id: p.id,
        number: p.number,
        date: p.date,
        status: p.status,
        amount: p1 + p2,
        original: p,
      });
    }
    for (const a of agreements) {
      const amt = Number(a.phase1_total ?? 0) || 0;
      docs.push({
        kind: "agreement",
        id: a.id,
        number: a.number,
        date: a.date,
        status: a.status,
        amount: amt,
        original: a,
      });
    }
    for (const i of invoices) {
      const subtotal = lineSubtotal(i.items);
      const discPct = Number(i.discount ?? 0) || 0;
      const amount = Math.max(0, subtotal - subtotal * (discPct / 100));
      docs.push({
        kind: "invoice",
        id: i.id,
        number: i.number,
        date: i.date,
        status: i.status,
        amount,
        original: i,
      });
    }
    return docs.sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? ""),
    );
  }, [proposals, agreements, invoices]);

  // Most recent agreement drives the kickoff section
  const latestAgreement = useMemo<Agreement | null>(() => {
    if (agreements.length === 0) return null;
    return [...agreements].sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? ""),
    )[0];
  }, [agreements]);

  const kickoffItems: KickoffItem[] = useMemo(() => {
    if (!latestAgreement) return [];
    return Array.isArray(latestAgreement.kickoff_items)
      ? latestAgreement.kickoff_items
      : [];
  }, [latestAgreement]);

  const kickoffStats = useMemo(() => {
    const total = kickoffItems.length;
    const provided = kickoffItems.filter((i) => i.provided).length;
    return { total, provided };
  }, [kickoffItems]);

  const hasOrigin =
    !!opportunity ||
    !!originProposal ||
    (!!client?.opportunity_id &&
      agreements.some((a) => a.opportunity_id === client?.opportunity_id));

  // ── handlers ───────────────────────────────────────────────────────

  function openEditClient() {
    if (!client) return;
    setEditingClient(clientToDraft(client));
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient || !client) return;
    setSavingClient(true);
    const payload = clientDraftToPayload(editingClient);
    await supabase.from("clients").update(payload).eq("id", client.id);
    setSavingClient(false);
    setEditingClient(null);
    await load();
  }

  async function handleSaveHubNotes() {
    if (!client) return;
    setSavingHubNotes(true);
    await supabase
      .from("clients")
      .update({ hub_notes: hubNotesDraft || null })
      .eq("id", client.id);
    setSavingHubNotes(false);
    setHubNotesDirty(false);
    setClient({ ...client, hub_notes: hubNotesDraft });
  }

  // Platform access
  function startNewPA() {
    setEditingPA({ ...EMPTY_PLATFORM_DRAFT });
  }
  function startEditPA(p: ClientPlatformAccess) {
    setEditingPA(platformAccessToDraft(p));
  }
  async function handleSavePA(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPA || !client) return;
    setSavingPA(true);
    const payload = {
      client_id: client.id,
      platform: editingPA.platform,
      login_email: editingPA.login_email || null,
      access_level: editingPA.access_level || null,
      status: editingPA.status,
      login_url: editingPA.login_url || null,
      notes: editingPA.notes || null,
    };
    if (editingPA.id) {
      await supabase
        .from("client_platform_access")
        .update(payload)
        .eq("id", editingPA.id);
    } else {
      await supabase.from("client_platform_access").insert(payload);
    }
    setSavingPA(false);
    setEditingPA(null);
    await load();
  }
  async function handleDeletePA() {
    if (!deletingPA) return;
    await supabase
      .from("client_platform_access")
      .delete()
      .eq("id", deletingPA.id);
    setDeletingPA(null);
    await load();
  }

  // Credentials
  function startNewCred() {
    setEditingCred({ ...EMPTY_CREDENTIAL_DRAFT });
  }
  function startEditCred(c: ClientCredential) {
    setEditingCred(credentialToDraft(c));
  }
  async function handleSaveCred(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCred || !client) return;
    setSavingCred(true);
    const payload = {
      client_id: client.id,
      label: editingCred.label || null,
      url: editingCred.url || null,
      username: editingCred.username || null,
      password: editingCred.password || null,
      notes: editingCred.notes || null,
    };
    if (editingCred.id) {
      await supabase
        .from("client_credentials")
        .update(payload)
        .eq("id", editingCred.id);
    } else {
      await supabase.from("client_credentials").insert(payload);
    }
    setSavingCred(false);
    setEditingCred(null);
    await load();
  }
  async function handleDeleteCred() {
    if (!deletingCred) return;
    await supabase
      .from("client_credentials")
      .delete()
      .eq("id", deletingCred.id);
    setDeletingCred(null);
    await load();
  }
  function toggleReveal(id: string) {
    setRevealedCreds((m) => ({ ...m, [id]: !m[id] }));
  }

  // Resources
  function startNewRes() {
    setEditingRes({ ...EMPTY_RESOURCE_DRAFT });
  }
  function startEditRes(r: ClientResource) {
    setEditingRes(resourceToDraft(r));
  }
  async function handleSaveRes(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRes || !client) return;
    setSavingRes(true);
    const payload = {
      client_id: client.id,
      label: editingRes.label || null,
      url: editingRes.url || null,
      type: editingRes.type,
      notes: editingRes.notes || null,
    };
    if (editingRes.id) {
      await supabase
        .from("client_resources")
        .update(payload)
        .eq("id", editingRes.id);
    } else {
      await supabase.from("client_resources").insert(payload);
    }
    setSavingRes(false);
    setEditingRes(null);
    await load();
  }
  async function handleDeleteRes() {
    if (!deletingRes) return;
    await supabase
      .from("client_resources")
      .delete()
      .eq("id", deletingRes.id);
    setDeletingRes(null);
    await load();
  }

  // ── render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-content">
        <div className="caption mono">Loading…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page-content">
        <Link href="/clients" className="caption mono">
          ← Back to clients
        </Link>
        <h1 style={{ marginTop: "var(--sp-4)" }}>Client not found</h1>
        <p className="caption">
          No client matches that ID. It may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <Link
        href="/clients"
        className="caption mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--sp-1)",
          color: "var(--muted)",
          marginBottom: "var(--sp-3)",
        }}
      >
        <ArrowLeft size={12} strokeWidth={1.75} />
        Back to clients
      </Link>

      <header className="page-header">
        <div>
          <h1>{client.name ?? "—"}</h1>
          <div
            className="flex"
            style={{
              alignItems: "center",
              gap: "var(--sp-3)",
              marginTop: "var(--sp-2)",
              flexWrap: "wrap",
            }}
          >
            {client.company && (
              <span
                style={{
                  fontSize: "var(--text-md)",
                  color: "var(--muted)",
                  fontWeight: "var(--fw-semibold)",
                }}
              >
                {client.company}
              </span>
            )}
            <span className={`badge status-${client.status ?? "active"}`}>
              {client.status ?? "active"}
            </span>
            {Number(client.monthly_value ?? 0) > 0 && (
              <span
                className="badge badge-black mono"
                style={{ fontSize: "var(--fs-11)" }}
              >
                {currencyCompact(Number(client.monthly_value), currencyCode)} /
                mo
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openEditClient}>
          <Pencil size={14} strokeWidth={1.75} />
          Edit client
        </button>
      </header>

      {/* KPIs */}
      <section className="grid-4">
        <Kpi
          label="Current MRR"
          value={
            Number(client.monthly_value ?? 0) > 0
              ? currency(Number(client.monthly_value), currencyCode)
              : "—"
          }
          accent
        />
        <Kpi
          label="Lifetime value"
          value={
            lifetimeValue > 0
              ? currencyCompact(lifetimeValue, currencyCode)
              : "—"
          }
          hint={
            agreements.length > 0
              ? `${agreements.length} agreement${agreements.length === 1 ? "" : "s"}`
              : "no agreements yet"
          }
        />
        <Kpi
          label="Months as client"
          value={monthsAsClient !== null ? String(monthsAsClient) : "—"}
          hint={
            client.created_at ? `since ${dateShort(client.created_at)}` : ""
          }
        />
        <Kpi
          label="Growth stage"
          value={client.growth_stage ?? "—"}
        />
      </section>

      {/* ── ORIGIN ───────────────────────────────────────────────── */}
      <SectionHeader title="Originated from" />
      {hasOrigin ? (
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
          }}
        >
          {opportunity && (
            <OriginRow
              label="Opportunity"
              primary={opportunity.company_name ?? "—"}
              secondary={
                opportunity.won_at
                  ? `Won ${dateShort(opportunity.won_at.slice(0, 10))}`
                  : `Stage: ${opportunity.stage}`
              }
              href={`/pipeline?edit=${opportunity.id}`}
            />
          )}
          {originProposal && (
            <OriginRow
              label="Proposal"
              primary={originProposal.number ?? "—"}
              secondary={
                originProposal.date ? `Dated ${dateShort(originProposal.date)}` : ""
              }
              href={`/proposals?edit=${originProposal.id}`}
            />
          )}
          {client.opportunity_id &&
            agreements
              .filter((a) => a.opportunity_id === client.opportunity_id)
              .map((a) => (
                <OriginRow
                  key={a.id}
                  label="Agreement"
                  primary={a.number}
                  secondary={
                    a.signed_date
                      ? `Signed ${dateShort(a.signed_date)}`
                      : `Status: ${a.status}`
                  }
                  href={`/agreements?edit=${a.id}`}
                />
              ))}
        </div>
      ) : (
        <div
          className="card"
          style={{ padding: "var(--sp-4)", background: "var(--gray-150)" }}
        >
          <div className="caption mono">
            No origin data — this client predates the opportunity tracking.
          </div>
        </div>
      )}

      {/* ── DOCUMENTS ─────────────────────────────────────────────── */}
      <SectionHeader
        title="Documents"
        right={`${documents.length} total`}
      />
      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Number</th>
                <th>Date</th>
                <th>Status</th>
                <th className="td-right">Amount</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    No proposals, agreements, or invoices for this client yet.
                  </td>
                </tr>
              ) : (
                documents.map((d) => (
                  <tr key={`${d.kind}-${d.id}`}>
                    <td>
                      <span
                        className="badge badge-gray"
                        style={{ fontSize: "var(--fs-10)" }}
                      >
                        {d.kind}
                      </span>
                    </td>
                    <td className="td-mono td-strong">{d.number ?? "—"}</td>
                    <td className="td-muted">{dateShort(d.date)}</td>
                    <td>
                      <span className={`badge status-${d.status ?? "draft"}`}>
                        {d.status ?? "draft"}
                      </span>
                    </td>
                    <td className="td-right td-mono">
                      {d.amount > 0 ? currency(d.amount, currencyCode) : "—"}
                    </td>
                    <td className="td-right" style={{ minWidth: 220 }}>
                      <div
                        className="flex gap-2"
                        style={{ justifyContent: "flex-end" }}
                      >
                        {d.kind === "proposal" && (
                          <PDFDownloadButton
                            type="proposal"
                            data={d.original as Proposal}
                            settings={
                              settings as Record<string, string | undefined>
                            }
                            label="PDF"
                            className="btn btn-ghost btn-xs"
                          />
                        )}
                        {d.kind === "agreement" && (
                          <PDFDownloadButton
                            type="agreement"
                            data={d.original as Agreement}
                            settings={
                              settings as Record<string, string | undefined>
                            }
                            label="PDF"
                            className="btn btn-ghost btn-xs"
                          />
                        )}
                        {d.kind === "invoice" && (
                          <PDFDownloadButton
                            type="invoice"
                            data={d.original as Invoice}
                            settings={
                              settings as Record<string, string | undefined>
                            }
                            services={services}
                            label="PDF"
                            className="btn btn-ghost btn-xs"
                          />
                        )}
                        <Link
                          href={`/${d.kind}s?edit=${d.id}`}
                          className="btn btn-ghost btn-xs"
                          style={{ display: "inline-flex", gap: 4 }}
                        >
                          <ExternalLink size={12} strokeWidth={1.75} />
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PLATFORM ACCESS ───────────────────────────────────────── */}
      <SectionHeader
        title="Platform access"
        right={
          <button className="btn btn-secondary btn-xs" onClick={startNewPA}>
            <Plus size={12} strokeWidth={2} />
            Add platform access
          </button>
        }
      />
      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Login email</th>
                <th>Access level</th>
                <th>Status</th>
                <th>Notes</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {platformAccess.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    No platform access tracked yet.
                  </td>
                </tr>
              ) : (
                platformAccess.map((p) => (
                  <tr key={p.id}>
                    <td className="td-strong">{p.platform}</td>
                    <td className="td-mono">{p.login_email ?? "—"}</td>
                    <td className="td-muted">{p.access_level ?? "—"}</td>
                    <td>
                      <span className={`badge status-${p.status}`}>
                        {p.status}
                      </span>
                    </td>
                    <td
                      className="td-muted truncate"
                      style={{ maxWidth: 260 }}
                    >
                      {p.notes ?? "—"}
                    </td>
                    <td className="td-right" style={{ minWidth: 110 }}>
                      <div
                        className="flex gap-1"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEditPA(p)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => setDeletingPA(p)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
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

      {/* ── CREDENTIALS ───────────────────────────────────────────── */}
      <SectionHeader
        title="Credentials"
        right={
          <button className="btn btn-secondary btn-xs" onClick={startNewCred}>
            <Plus size={12} strokeWidth={2} />
            Add credential
          </button>
        }
      />
      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>URL</th>
                <th>Username</th>
                <th>Password</th>
                <th>Notes</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    No shared credentials saved yet.
                  </td>
                </tr>
              ) : (
                credentials.map((c) => (
                  <tr key={c.id}>
                    <td className="td-strong">{c.label ?? "—"}</td>
                    <td className="td-mono">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--muted)",
                            borderBottom: "1px dotted var(--border-strong)",
                          }}
                        >
                          {c.url.length > 36 ? `${c.url.slice(0, 36)}…` : c.url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="td-mono">{c.username ?? "—"}</td>
                    <td className="td-mono">
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--sp-2)",
                        }}
                      >
                        <span>
                          {c.password
                            ? revealedCreds[c.id]
                              ? c.password
                              : "•".repeat(Math.min(12, c.password.length))
                            : "—"}
                        </span>
                        {c.password && (
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => toggleReveal(c.id)}
                            aria-label={
                              revealedCreds[c.id] ? "Hide" : "Reveal"
                            }
                            title={revealedCreds[c.id] ? "Hide" : "Reveal"}
                          >
                            {revealedCreds[c.id] ? (
                              <EyeOff size={13} strokeWidth={1.75} />
                            ) : (
                              <Eye size={13} strokeWidth={1.75} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td
                      className="td-muted truncate"
                      style={{ maxWidth: 220 }}
                    >
                      {c.notes ?? "—"}
                    </td>
                    <td className="td-right" style={{ minWidth: 110 }}>
                      <div
                        className="flex gap-1"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEditCred(c)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => setDeletingCred(c)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
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

      {/* ── RESOURCES ─────────────────────────────────────────────── */}
      <SectionHeader
        title="Resources"
        right={
          <button className="btn btn-secondary btn-xs" onClick={startNewRes}>
            <Plus size={12} strokeWidth={2} />
            Add resource
          </button>
        }
      />
      {resources.length === 0 ? (
        <div
          className="card"
          style={{ padding: "var(--sp-4)", background: "var(--gray-150)" }}
        >
          <div className="caption mono">No shared resources yet.</div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-2)",
          }}
        >
          {resources.map((r) => (
            <div
              key={r.id}
              className="card-sm"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--sp-3)",
                background: "var(--paper)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className={`badge ${RESOURCE_BADGE_CLASS[r.type]}`}
                style={{ flexShrink: 0, marginTop: 2 }}
              >
                {RESOURCE_LABEL[r.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="td-strong">{r.label ?? "—"}</div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--muted)",
                      borderBottom: "1px dotted var(--border-strong)",
                      display: "inline-block",
                      marginTop: 2,
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.url}
                  </a>
                )}
                {r.notes && (
                  <div
                    className="caption"
                    style={{ marginTop: "var(--sp-1)" }}
                  >
                    {r.notes}
                  </div>
                )}
              </div>
              <div
                className="flex gap-1"
                style={{ flexShrink: 0, alignItems: "center" }}
              >
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => startEditRes(r)}
                  aria-label="Edit"
                  title="Edit"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => setDeletingRes(r)}
                  aria-label="Delete"
                  title="Delete"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KICKOFF STATUS ────────────────────────────────────────── */}
      {latestAgreement && kickoffItems.length > 0 && (
        <>
          <SectionHeader
            title="Kickoff status"
            right={
              <Link
                href={`/agreements?edit=${latestAgreement.id}`}
                className="caption mono"
                style={{ color: "var(--muted)" }}
              >
                Edit in agreement {latestAgreement.number} →
              </Link>
            }
          />
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--sp-3)",
              }}
            >
              <div>
                <div className="label mono">Progress</div>
                <div
                  className="mono"
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: "var(--fw-bold)",
                  }}
                >
                  {kickoffStats.provided} / {kickoffStats.total} provided
                </div>
              </div>
              <div style={{ flex: 1, marginLeft: "var(--sp-6)" }}>
                <div
                  style={{
                    height: 8,
                    background: "var(--cream)",
                    borderRadius: "var(--r-xs)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${
                        kickoffStats.total > 0
                          ? (kickoffStats.provided / kickoffStats.total) * 100
                          : 0
                      }%`,
                      background: "var(--accent)",
                      transition: "width var(--t-normal)",
                    }}
                  />
                </div>
              </div>
            </div>

            {KICKOFF_CATEGORIES.map((cat) => {
              const items = kickoffItems.filter((i) => i.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} style={{ marginTop: "var(--sp-4)" }}>
                  <div className="label mono">{cat}</div>
                  <ul
                    className="caption"
                    style={{
                      marginTop: "var(--sp-2)",
                      paddingLeft: "var(--sp-3)",
                      listStyle: "none",
                    }}
                  >
                    {items.map((it, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "var(--sp-2)",
                          padding: "var(--sp-1) 0",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={it.provided}
                          readOnly
                          style={{
                            width: 14,
                            height: 14,
                            marginTop: 2,
                            cursor: "default",
                          }}
                        />
                        <span
                          style={{
                            color: it.provided
                              ? "var(--muted)"
                              : "var(--ink)",
                            textDecoration: it.provided
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {it.item}
                          {it.required && !it.provided && (
                            <span
                              className="mono"
                              style={{
                                marginLeft: "var(--sp-2)",
                                fontSize: "var(--fs-10)",
                                color: "var(--danger)",
                                letterSpacing: "var(--ls-wide)",
                                textTransform: "uppercase",
                              }}
                            >
                              required
                            </span>
                          )}
                          {it.notes && (
                            <span
                              style={{
                                marginLeft: "var(--sp-2)",
                                color: "var(--muted)",
                              }}
                            >
                              — {it.notes}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── CONTACTS ──────────────────────────────────────────────── */}
      <SectionHeader title="Contacts" />
      <div
        className="grid-2"
        style={{ gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}
      >
        <div className="card">
          <div className="label mono">Primary contact</div>
          <div
            style={{
              marginTop: "var(--sp-2)",
              fontSize: "var(--text-md)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            {client.name ?? "—"}
          </div>
          {client.email && (
            <div className="caption mono">{client.email}</div>
          )}
          {client.primary_contact_phone && (
            <div className="caption mono">{client.primary_contact_phone}</div>
          )}
          {client.preferred_channel && (
            <div className="caption" style={{ marginTop: "var(--sp-2)" }}>
              Prefers {client.preferred_channel}
            </div>
          )}
          {client.slack_channel && (
            <div className="caption mono">{client.slack_channel}</div>
          )}
        </div>

        <div className="card">
          <div className="label mono">Additional emails</div>
          <div
            style={{
              marginTop: "var(--sp-2)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-2)",
            }}
          >
            {(client.emails ?? []).length === 0 ? (
              <span className="caption mono">None</span>
            ) : (
              (client.emails ?? []).map((em) => (
                <span key={em} className="badge badge-gray mono">
                  {em}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "var(--sp-7)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--sp-2)",
          }}
        >
          <div className="label mono">Hub notes</div>
          {hubNotesDirty && (
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={handleSaveHubNotes}
              disabled={savingHubNotes}
            >
              {savingHubNotes ? "Saving…" : "Save notes"}
            </button>
          )}
        </div>
        <textarea
          rows={6}
          value={hubNotesDraft}
          onChange={(e) => {
            setHubNotesDraft(e.target.value);
            setHubNotesDirty(true);
          }}
          placeholder="Working notes about this client — onboarding context, preferences, anything you want to remember."
        />
      </div>

      {/* ── MODALS ────────────────────────────────────────────────── */}
      <ClientModal
        draft={editingClient}
        saving={savingClient}
        onChange={setEditingClient}
        onClose={() => setEditingClient(null)}
        onSubmit={handleSaveClient}
      />
      <PlatformAccessModal
        draft={editingPA}
        saving={savingPA}
        onChange={setEditingPA}
        onClose={() => setEditingPA(null)}
        onSubmit={handleSavePA}
      />
      <CredentialModal
        draft={editingCred}
        saving={savingCred}
        onChange={setEditingCred}
        onClose={() => setEditingCred(null)}
        onSubmit={handleSaveCred}
      />
      <ResourceModal
        draft={editingRes}
        saving={savingRes}
        onChange={setEditingRes}
        onClose={() => setEditingRes(null)}
        onSubmit={handleSaveRes}
      />

      <ConfirmDialog
        open={!!deletingPA}
        title="Remove platform access?"
        message="Removes the row from this client's Hub. Doesn't revoke the actual access — do that on the platform."
        onCancel={() => setDeletingPA(null)}
        onConfirm={handleDeletePA}
      />
      <ConfirmDialog
        open={!!deletingCred}
        title="Delete credential?"
        message="This action cannot be undone."
        onCancel={() => setDeletingCred(null)}
        onConfirm={handleDeleteCred}
      />
      <ConfirmDialog
        open={!!deletingRes}
        title="Delete resource?"
        message="This action cannot be undone."
        onCancel={() => setDeletingRes(null)}
        onConfirm={handleDeleteRes}
      />
    </div>
  );
}

// ── presentational helpers ────────────────────────────────────────────

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`kpi-card${accent ? " accent" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-sub">{hint}</div>}
    </div>
  );
}

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="section-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
      }}
    >
      <div
        className="flex"
        style={{ alignItems: "center", gap: "var(--sp-3)", flex: 1 }}
      >
        <div className="section-header-bar" />
        <div className="section-header-title">{title}</div>
        <div className="section-header-line" />
      </div>
      {right && (
        <div style={{ flexShrink: 0 }}>
          {typeof right === "string" ? (
            <span className="caption mono" style={{ color: "var(--muted)" }}>
              {right}
            </span>
          ) : (
            right
          )}
        </div>
      )}
    </div>
  );
}

function OriginRow({
  label,
  primary,
  secondary,
  href,
}: {
  label: string;
  primary: string;
  secondary?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
        padding: "var(--sp-2) 0",
        borderBottom: "1px solid var(--border)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <span
          className="label mono"
          style={{ minWidth: 100, color: "var(--muted)" }}
        >
          {label}
        </span>
        <span style={{ fontWeight: "var(--fw-semibold)" }}>{primary}</span>
        {secondary && (
          <span className="caption mono" style={{ color: "var(--muted)" }}>
            {secondary}
          </span>
        )}
      </div>
      <ExternalLink size={14} strokeWidth={1.75} color="var(--muted)" />
    </Link>
  );
}
