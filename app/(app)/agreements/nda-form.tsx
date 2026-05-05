"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import {
  EMPTY_NEW_CLIENT,
  type AgreementStatus,
  type Client,
  type NewClientDraft,
} from "@/lib/types";

export type NDADraft = {
  id?: string;
  number: string;
  date: string;
  status: AgreementStatus;
  client_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_address: string;
  nda_purpose: string;
  nda_term_years: string;
  signed_date: string;
  signed_by_name: string;
  signed_by_title: string;
  notes: string;
};

export default function NDAForm({
  open,
  draft,
  clients,
  saving,
  onChange,
  onClose,
  onSubmit,
  onGenerateEmail,
  onCreateClient,
}: {
  open: boolean;
  draft: NDADraft | null;
  clients: Client[];
  saving: boolean;
  onChange: (d: NDADraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onGenerateEmail: () => void;
  onCreateClient: (draft: NewClientDraft) => Promise<Client | null>;
}) {
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientDraft, setNewClientDraft] = useState<NewClientDraft>(
    EMPTY_NEW_CLIENT,
  );
  const [savingNewClient, setSavingNewClient] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreatingClient(false);
      setNewClientDraft(EMPTY_NEW_CLIENT);
      setSavingNewClient(false);
    }
  }, [open]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    [clients],
  );

  if (!draft) return null;

  function pickClient(id: string) {
    if (!draft) return;
    if (!id) {
      onChange({
        ...draft,
        client_id: "",
        client_name: "",
        client_email: "",
        client_company: "",
        client_address: "",
      });
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    onChange({
      ...draft,
      client_id: id,
      client_name: c.name ?? "",
      client_email: c.email ?? "",
      client_company: c.company ?? "",
      client_address: c.address ?? "",
    });
  }

  async function handleCreateClient() {
    if (!newClientDraft.name.trim()) {
      alert("Client name is required.");
      return;
    }
    setSavingNewClient(true);
    const created = await onCreateClient(newClientDraft);
    setSavingNewClient(false);
    if (!created) return;
    pickClient(created.id);
    setCreatingClient(false);
    setNewClientDraft(EMPTY_NEW_CLIENT);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? `Edit ${draft.number}` : "New NDA"}
      maxWidth={780}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {draft.id && draft.client_email && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onGenerateEmail}
              disabled={saving}
              title="Download the NDA PDF and open a Gmail compose window prefilled to the client"
            >
              Generate email
            </button>
          )}
          <button
            type="submit"
            form="nda-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save NDA"}
          </button>
        </>
      }
    >
      <form
        id="nda-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-5)" }}
      >
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Number</label>
            <input
              className="mono"
              required
              value={draft.number}
              onChange={(e) => onChange({ ...draft, number: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Effective date</label>
            <input
              type="date"
              required
              value={draft.date}
              onChange={(e) => onChange({ ...draft, date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={draft.status}
              onChange={(e) =>
                onChange({
                  ...draft,
                  status: e.target.value as AgreementStatus,
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Client</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Client</label>
          <select
            required
            value={draft.client_id}
            onChange={(e) => pickClient(e.target.value)}
          >
            <option value="">— choose client —</option>
            {sortedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "(no name)"}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
        </div>

        {!creatingClient ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setCreatingClient(true)}
            style={{
              alignSelf: "flex-start",
              marginTop: "calc(-1 * var(--sp-3))",
              gap: 4,
            }}
          >
            <Plus size={12} strokeWidth={2} />
            New client
          </button>
        ) : (
          <div
            className="card-sm"
            style={{
              background: "var(--gray-150)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-3)",
            }}
          >
            <div className="label mono">Create new client</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  value={newClientDraft.name}
                  onChange={(e) =>
                    setNewClientDraft({
                      ...newClientDraft,
                      name: e.target.value,
                    })
                  }
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  value={newClientDraft.company}
                  onChange={(e) =>
                    setNewClientDraft({
                      ...newClientDraft,
                      company: e.target.value,
                    })
                  }
                  placeholder="Legal entity"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={newClientDraft.email}
                onChange={(e) =>
                  setNewClientDraft({
                    ...newClientDraft,
                    email: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                rows={2}
                value={newClientDraft.address}
                onChange={(e) =>
                  setNewClientDraft({
                    ...newClientDraft,
                    address: e.target.value,
                  })
                }
              />
            </div>
            <div
              className="flex gap-2"
              style={{ justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setCreatingClient(false);
                  setNewClientDraft(EMPTY_NEW_CLIENT);
                }}
                disabled={savingNewClient}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleCreateClient}
                disabled={savingNewClient}
              >
                {savingNewClient ? "Creating…" : "Create & select"}
              </button>
            </div>
          </div>
        )}

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Client name</label>
            <input
              value={draft.client_name}
              onChange={(e) =>
                onChange({ ...draft, client_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Client email</label>
            <input
              type="email"
              value={draft.client_email}
              onChange={(e) =>
                onChange({ ...draft, client_email: e.target.value })
              }
            />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Company (legal entity)</label>
            <input
              value={draft.client_company}
              onChange={(e) =>
                onChange({ ...draft, client_company: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              rows={2}
              value={draft.client_address}
              onChange={(e) =>
                onChange({ ...draft, client_address: e.target.value })
              }
            />
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Purpose of Disclosure</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Purpose</label>
          <textarea
            rows={4}
            value={draft.nda_purpose}
            onChange={(e) =>
              onChange({ ...draft, nda_purpose: e.target.value })
            }
            placeholder="Describe the business purpose for which information will be shared (e.g., 'Evaluation of a potential growth partnership between Attomik and [Client] involving Shopify, Klaviyo, and paid media services.')."
          />
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Term</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">
              Confidentiality term (years from disclosure)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              step="1"
              required
              value={draft.nda_term_years}
              onChange={(e) =>
                onChange({ ...draft, nda_term_years: e.target.value })
              }
            />
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Signature & Notes</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Signed date</label>
            <input
              type="date"
              value={draft.signed_date}
              onChange={(e) =>
                onChange({ ...draft, signed_date: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Signed by name</label>
            <input
              value={draft.signed_by_name}
              onChange={(e) =>
                onChange({ ...draft, signed_by_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Signed by title</label>
            <input
              value={draft.signed_by_title}
              onChange={(e) =>
                onChange({ ...draft, signed_by_title: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Internal notes</label>
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
