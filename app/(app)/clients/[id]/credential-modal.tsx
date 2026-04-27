"use client";

import { Modal } from "@/components/modal";

export type CredentialDraft = {
  id?: string;
  label: string;
  url: string;
  username: string;
  password: string;
  notes: string;
};

export const EMPTY_CREDENTIAL_DRAFT: CredentialDraft = {
  label: "",
  url: "",
  username: "",
  password: "",
  notes: "",
};

export default function CredentialModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: CredentialDraft | null;
  saving: boolean;
  onChange: (d: CredentialDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!draft) return null;
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={draft.id ? "Edit credential" : "Add credential"}
      maxWidth={560}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="credential-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="credential-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-4)" }}
      >
        <div className="form-group">
          <label className="form-label">Label</label>
          <input
            required
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            placeholder="e.g. Klaviyo techsupport account"
          />
        </div>
        <div className="form-group">
          <label className="form-label">URL</label>
          <input
            value={draft.url}
            onChange={(e) => onChange({ ...draft, url: e.target.value })}
            placeholder="https://…"
          />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="mono"
              value={draft.username}
              onChange={(e) =>
                onChange({ ...draft, username: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="mono"
              value={draft.password}
              onChange={(e) =>
                onChange({ ...draft, password: e.target.value })
              }
            />
          </div>
        </div>
        <div className="caption" style={{ marginTop: "calc(-1 * var(--sp-2))" }}>
          Stored as plaintext. Use only for shared accounts that the client
          owns and has handed off — not for anything Attomik issues.
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
