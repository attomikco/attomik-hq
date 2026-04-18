import type { LineItem } from "@/lib/format";

export type Client = {
  id: string;
  name: string | null;
  email: string | null;
  emails: string[] | null;
  company: string | null;
  address: string | null;
  payment_terms: string | null;
};

export type Service = {
  id: string;
  name: string | null;
  description: string | null;
  price: number | null;
};

export type Invoice = {
  id: string;
  number: string | null;
  date: string | null;
  due: string | null;
  status: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  client_address: string | null;
  items: LineItem[] | null;
  discount: number | null;
  notes: string | null;
  created_at: string | null;
};

export type Proposal = {
  id: string;
  number: string | null;
  date: string | null;
  valid_until: string | null;
  status: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  intro: string | null;
  items: LineItem[] | null;
  discount: number | null;
  notes: string | null;
  phase1_title: string | null;
  phase1_price: string | null;
  phase1_timeline: string | null;
  phase1_payment: string | null;
  phase2_title: string | null;
  phase2_monthly: string | null;
  phase2_commitment: string | null;
  created_at: string | null;
};

export type SettingsMap = Partial<{
  brand_name: string;
  legal_name: string;
  address: string;
  email: string;
  phone: string;
  currency: string;
  default_payment_terms: string;
  payment_instructions: string;
}>;

export type LineItemDraft = {
  service_id: string;
  title: string;
  description: string;
  qty: string;
  rate: string;
};

export const EMPTY_LINE: LineItemDraft = {
  service_id: "",
  title: "",
  description: "",
  qty: "1",
  rate: "0",
};

export function toLineItemDraft(li: LineItem | null | undefined): LineItemDraft {
  return {
    service_id: (li?.service_id as string) ?? "",
    title: (li?.title as string) ?? "",
    description: ((li?.description ?? li?.desc) as string) ?? "",
    qty: String(li?.qty ?? li?.quantity ?? 1),
    rate: String(li?.rate ?? li?.price ?? 0),
  };
}

export function fromLineItemDraft(d: LineItemDraft): LineItem {
  return {
    service_id: d.service_id || null,
    title: d.title,
    description: d.description,
    qty: Number(d.qty) || 0,
    rate: Number(d.rate) || 0,
  };
}
