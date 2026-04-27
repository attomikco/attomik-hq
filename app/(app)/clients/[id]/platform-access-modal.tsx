"use client";

import { Modal } from "@/components/modal";
import {
  ACCESS_LEVEL_OPTIONS,
  PLATFORM_ACCESS_STATUSES,
  PLATFORM_OPTIONS,
  type PlatformAccessStatus,
} from "@/lib/types";

export type PlatformAccessDraft = {
  id?: string;
  platform: string;
  login_email: string;
  access_level: string;
  status: PlatformAccessStatus;
  login_url: string;
  notes: string;
};

export const EMPTY_PLATFORM_DRAFT: PlatformAccessDraft = {
  platform: "Shopify",
  login_email: "",
  access_level: "",
  status: "invited",
  login_url: "",
  notes: "",
};

export default function PlatformAccessModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: PlatformAccessDraft | null;
  saving: boolean;
  onChange: (d: PlatformAccessDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!draft) return null;
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={draft.id ? "Edit platform access" : "Add platform access"}
      maxWidth={560}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="platform-access-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="platform-access-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-4)" }}
      >
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Platform</label>
            <select
              value={
                PLATFORM_OPTIONS.includes(
                  draft.platform as (typeof PLATFORM_OPTIONS)[number],
                )
                  ? draft.platform
                  : "Custom"
              }
              onChange={(e) => onChange({ ...draft, platform: e.target.value })}
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {!PLATFORM_OPTIONS.includes(
              draft.platform as (typeof PLATFORM_OPTIONS)[number],
            ) && (
              <input
                style={{ marginTop: "var(--sp-2)" }}
                value={draft.platform}
                onChange={(e) =>
                  onChange({ ...draft, platform: e.target.value })
                }
                placeholder="Custom platform name"
              />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={draft.status}
              onChange={(e) =>
                onChange({
                  ...draft,
                  status: e.target.value as PlatformAccessStatus,
                })
              }
            >
              {PLATFORM_ACCESS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Login email</label>
          <input
            type="email"
            value={draft.login_email}
            onChange={(e) =>
              onChange({ ...draft, login_email: e.target.value })
            }
            placeholder="pablo@attomik.co"
          />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Access level</label>
            <select
              value={draft.access_level}
              onChange={(e) =>
                onChange({ ...draft, access_level: e.target.value })
              }
            >
              <option value="">—</option>
              {ACCESS_LEVEL_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Login URL</label>
            <input
              value={draft.login_url}
              onChange={(e) =>
                onChange({ ...draft, login_url: e.target.value })
              }
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
