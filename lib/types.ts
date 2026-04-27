import type { LineItem } from "@/lib/format";

export type Client = {
  id: string;
  name: string | null;
  email: string | null;
  emails: string[] | null;
  company: string | null;
  address: string | null;
  payment_terms: string | null;
  status: string | null;
  monthly_value: number | null;
  growth_stage: string | null;
  notes: string | null;
  opportunity_id: string | null;
  proposal_id: string | null;
  slack_channel: string | null;
  preferred_channel: string | null;
  primary_contact_phone: string | null;
  hub_notes: string | null;
  created_at: string | null;
};

export const PLATFORM_OPTIONS = [
  "Shopify",
  "Meta",
  "Klaviyo",
  "GA4",
  "Google Ads",
  "TikTok",
  "Amazon",
  "Custom",
] as const;

export const ACCESS_LEVEL_OPTIONS = [
  "admin",
  "manager",
  "staff",
  "collaborator",
  "custom",
] as const;

export const PLATFORM_ACCESS_STATUSES = [
  "invited",
  "accepted",
  "pending",
  "revoked",
] as const;

export type PlatformAccessStatus = (typeof PLATFORM_ACCESS_STATUSES)[number];

export type ClientPlatformAccess = {
  id: string;
  client_id: string;
  platform: string;
  login_email: string | null;
  access_level: string | null;
  status: PlatformAccessStatus;
  login_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientCredential = {
  id: string;
  client_id: string;
  label: string | null;
  url: string | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const RESOURCE_TYPES = [
  "drive",
  "notion",
  "figma",
  "slack",
  "dropbox",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ClientResource = {
  id: string;
  client_id: string;
  label: string | null;
  url: string | null;
  type: ResourceType;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const OPPORTUNITY_STAGES = [
  "idea",
  "qualified",
  "discovery",
  "proposal_drafted",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPEN_OPPORTUNITY_STAGES: OpportunityStage[] = [
  "idea",
  "qualified",
  "discovery",
  "proposal_drafted",
  "proposal_sent",
  "negotiation",
];

export const OPPORTUNITY_SOURCES = [
  "referral",
  "inbound",
  "outbound",
  "network",
  "other",
] as const;

export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];

export const OPPORTUNITY_PHASES = [
  "phase1_only",
  "phase1_phase2",
  "phase2_only",
] as const;

export type OpportunityPhase = (typeof OPPORTUNITY_PHASES)[number];

export type Opportunity = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  stage: OpportunityStage;
  source: string | null;
  estimated_value: number | null;
  estimated_phase: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  name: string | null;
  description: string | null;
  desc?: string | null;
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
  p1_items: LineItem[] | null;
  p1_discount: number | null;
  p1_discount_amount: number | null;
  phase1_compare: string | null;
  phase1_note: string | null;
  phase1_timeline: string | null;
  phase1_payment: string | null;
  phase2_title: string | null;
  p2_items: LineItem[] | null;
  p2_rate: number | null;
  p2_discount: number | null;
  p2_discount_amount: number | null;
  phase2_compare: string | null;
  phase2_note: string | null;
  phase2_commitment: string | null;
  phase1_title: string | null;
  phase1_price: string | null;
  phase2_monthly: string | null;
  p1_type: string | null;
  p1_second_store: boolean | null;
  p1_amazon: boolean | null;
  p1_tiktok: boolean | null;
  p1_email_template: boolean | null;
  p1_total: number | null;
  p2_bundle: string | null;
  p2_total: number | null;
  p2_second_store: boolean | null;
  opportunity_id: string | null;
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
  agreement_default_phase1_payment: string;
  agreement_default_phase2_payment: string;
  agreement_default_late_fee: string;
  agreement_governing_law: string;
  agreement_legal_entity: string;
  agreement_email_subject: string;
  agreement_email_body: string;
}>;

export type AgreementStatus =
  | "draft"
  | "sent"
  | "signed"
  | "active"
  | "completed"
  | "cancelled";

export type KickoffItem = {
  category: string;
  item: string;
  required: boolean;
  provided: boolean;
  notes?: string;
};

export type Phase1Item = {
  name: string;
  price: number;
  description?: string;
};

export type Agreement = {
  id: string;
  number: string;
  date: string;
  status: AgreementStatus;
  proposal_id: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  opportunity_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  client_address: string | null;
  phase1_items: Phase1Item[];
  phase1_total: number;
  phase1_discount: number;
  phase1_timeline: string | null;
  phase1_payment: string | null;
  phase2_service: string | null;
  phase2_rate: number;
  phase2_discount: number;
  phase2_commitment: number;
  phase2_start_date: string | null;
  kickoff_items: KickoffItem[];
  terms: string | null;
  signed_date: string | null;
  signed_by_name: string | null;
  signed_by_title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

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
    title: ((li?.title ?? li?.name) as string) ?? "",
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
