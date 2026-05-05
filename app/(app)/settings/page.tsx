"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SettingsForm = {
  brand_name: string;
  legal_name: string;
  address: string;
  email: string;
  phone: string;
  currency: string;
  default_payment_terms: string;
  payment_instructions: string;
  agreement_default_phase1_payment: string;
  agreement_default_phase2_payment: string;
  agreement_default_late_fee: string;
  agreement_governing_law: string;
  agreement_legal_entity: string;
  agreement_email_subject: string;
  agreement_email_body: string;
};

const KEYS: (keyof SettingsForm)[] = [
  "brand_name",
  "legal_name",
  "address",
  "email",
  "phone",
  "currency",
  "default_payment_terms",
  "payment_instructions",
  "agreement_default_phase1_payment",
  "agreement_default_phase2_payment",
  "agreement_default_late_fee",
  "agreement_governing_law",
  "agreement_legal_entity",
  "agreement_email_subject",
  "agreement_email_body",
];

const EMPTY: SettingsForm = {
  brand_name: "",
  legal_name: "",
  address: "",
  email: "",
  phone: "",
  currency: "USD",
  default_payment_terms: "",
  payment_instructions: "",
  agreement_default_phase1_payment: "",
  agreement_default_phase2_payment: "",
  agreement_default_late_fee: "",
  agreement_governing_law: "",
  agreement_legal_entity: "",
  agreement_email_subject: "",
  agreement_email_body: "",
};

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("settings").select("key, value");
    const map: Partial<SettingsForm> = {};
    for (const row of (data as { key: string; value: string }[] | null) ??
      []) {
      if (KEYS.includes(row.key as keyof SettingsForm)) {
        map[row.key as keyof SettingsForm] = row.value;
      }
    }
    setForm({ ...EMPTY, ...map });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const rows = KEYS.map((key) => ({ key, value: form[key] ?? "" }));
    await supabase.from("settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    setSavedAt(new Date());
    await load();
  }

  function field<K extends keyof SettingsForm>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
        </div>
        {savedAt && (
          <div
            className="mono label"
            style={{ color: "var(--brand-green-dark)" }}
          >
            Saved {savedAt.toLocaleTimeString()}
          </div>
        )}
      </header>

      <form
        onSubmit={handleSave}
        className="card"
        style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}
      >
        {loading ? (
          <div className="caption mono">Loading…</div>
        ) : (
          <>
            <div className="section-header" style={{ margin: 0 }}>
              <div className="section-header-bar" />
              <div className="section-header-title">Brand</div>
              <div className="section-header-line" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Brand name</label>
                <input
                  value={form.brand_name}
                  onChange={(e) => field("brand_name", e.target.value)}
                  placeholder="Attomik"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Legal name</label>
                <input
                  value={form.legal_name}
                  onChange={(e) => field("legal_name", e.target.value)}
                  placeholder="Attomik LLC"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                rows={3}
                value={form.address}
                onChange={(e) => field("address", e.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => field("phone", e.target.value)}
                />
              </div>
            </div>

            <div className="section-header" style={{ margin: 0 }}>
              <div className="section-header-bar" />
              <div className="section-header-title">Billing defaults</div>
              <div className="section-header-line" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => field("currency", e.target.value)}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="MXN">MXN — Mexican Peso</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Default payment terms</label>
                <input
                  value={form.default_payment_terms}
                  onChange={(e) =>
                    field("default_payment_terms", e.target.value)
                  }
                  placeholder="Net 15"
                />
                <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
                  Use {"{due_date}"} to render the invoice&apos;s due date.
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment instructions</label>
              <textarea
                rows={4}
                value={form.payment_instructions}
                onChange={(e) => field("payment_instructions", e.target.value)}
                placeholder="Wire transfer details, Stripe link, ACH info…"
              />
            </div>

            <div className="section-header" style={{ margin: 0 }}>
              <div className="section-header-bar" />
              <div className="section-header-title">Agreements</div>
              <div className="section-header-line" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Legal entity</label>
                <input
                  value={form.agreement_legal_entity}
                  onChange={(e) =>
                    field("agreement_legal_entity", e.target.value)
                  }
                  placeholder="Attomik, LLC"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Governing law</label>
                <input
                  value={form.agreement_governing_law}
                  onChange={(e) =>
                    field("agreement_governing_law", e.target.value)
                  }
                  placeholder="State of Delaware, United States"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">
                  Phase 1 default payment schedule
                </label>
                <input
                  value={form.agreement_default_phase1_payment}
                  onChange={(e) =>
                    field("agreement_default_phase1_payment", e.target.value)
                  }
                  placeholder="50% upon signing, 50% upon delivery"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Phase 2 default billing cadence
                </label>
                <input
                  value={form.agreement_default_phase2_payment}
                  onChange={(e) =>
                    field("agreement_default_phase2_payment", e.target.value)
                  }
                  placeholder="Invoiced monthly on the 1st, due net 15"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Late fee</label>
              <input
                value={form.agreement_default_late_fee}
                onChange={(e) =>
                  field("agreement_default_late_fee", e.target.value)
                }
                placeholder="1.5% per month on overdue balances"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Agreement email subject</label>
              <input
                value={form.agreement_email_subject}
                onChange={(e) =>
                  field("agreement_email_subject", e.target.value)
                }
                placeholder="Welcome to Attomik — Services Agreement for {client_company}"
              />
              <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
                Merge fields: {"{client_name}"}, {"{client_company}"},{" "}
                {"{agreement_number}"}, {"{phase1_total}"}, {"{phase2_rate}"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Agreement email body</label>
              <textarea
                rows={10}
                value={form.agreement_email_body}
                onChange={(e) =>
                  field("agreement_email_body", e.target.value)
                }
                placeholder="Hi {client_name}, ..."
              />
              <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
                Merge fields: {"{client_name}"}, {"{client_company}"},{" "}
                {"{agreement_number}"}, {"{phase1_total}"}, {"{phase2_rate}"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                paddingTop: "var(--sp-4)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
