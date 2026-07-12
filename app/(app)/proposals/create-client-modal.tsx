"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import type { Proposal } from "@/lib/types";

export type ClientDraft = {
  company: string; // legal entity name
  contact_name: string;
  contact_email: string;
  address: string;
  signer_name: string;
  signer_title: string;
  billing_email: string; // -> ap_email
  ops_email: string;
};

const EMPTY: ClientDraft = {
  company: "",
  contact_name: "",
  contact_email: "",
  address: "",
  signer_name: "",
  signer_title: "",
  billing_email: "",
  ops_email: "",
};

export default function CreateClientModal({
  open,
  proposal,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  proposal: Proposal | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: ClientDraft) => void;
}) {
  const [draft, setDraft] = useState<ClientDraft>(EMPTY);

  // Prefill contact fields from the proposal; legal fields start empty, ready
  // to fill from the client's reply.
  useEffect(() => {
    if (!proposal) return;
    setDraft({
      ...EMPTY,
      company: proposal.client_company ?? "",
      contact_name: proposal.client_name ?? "",
      contact_email: proposal.client_email ?? "",
    });
  }, [proposal]);

  if (!proposal) return null;

  function set<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create client"
      maxWidth={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-client-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Create client"}
          </button>
        </>
      }
    >
      <form
        id="create-client-form"
        onSubmit={handleSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-5)" }}
      >
        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Contact</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Contact name</label>
            <input
              value={draft.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contact email</label>
            <input
              type="email"
              value={draft.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
            />
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Legal &amp; billing</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Legal entity name</label>
          <input
            required
            value={draft.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Exact name for the contract"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Registered business address</label>
          <textarea
            rows={2}
            value={draft.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Signer name</label>
            <input
              value={draft.signer_name}
              onChange={(e) => set("signer_name", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Signer title</label>
            <input
              value={draft.signer_title}
              onChange={(e) => set("signer_title", e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Billing contact email</label>
            <input
              type="email"
              value={draft.billing_email}
              onChange={(e) => set("billing_email", e.target.value)}
              placeholder="Where invoices should go"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Shared operational email</label>
            <input
              type="email"
              value={draft.ops_email}
              onChange={(e) => set("ops_email", e.target.value)}
              placeholder="e.g. hello@theirbrand.com"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
