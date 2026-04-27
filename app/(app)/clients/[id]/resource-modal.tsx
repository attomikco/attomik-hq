"use client";

import { Modal } from "@/components/modal";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/types";

export type ResourceDraft = {
  id?: string;
  label: string;
  url: string;
  type: ResourceType;
  notes: string;
};

export const EMPTY_RESOURCE_DRAFT: ResourceDraft = {
  label: "",
  url: "",
  type: "other",
  notes: "",
};

const TYPE_LABEL: Record<ResourceType, string> = {
  drive: "Google Drive",
  notion: "Notion",
  figma: "Figma",
  slack: "Slack",
  dropbox: "Dropbox",
  other: "Other",
};

export default function ResourceModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ResourceDraft | null;
  saving: boolean;
  onChange: (d: ResourceDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!draft) return null;
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={draft.id ? "Edit resource" : "Add resource"}
      maxWidth={520}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="resource-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="resource-form"
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
            placeholder="e.g. Brand assets folder"
          />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              value={draft.type}
              onChange={(e) =>
                onChange({ ...draft, type: e.target.value as ResourceType })
              }
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">URL</label>
            <input
              required
              value={draft.url}
              onChange={(e) => onChange({ ...draft, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
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
