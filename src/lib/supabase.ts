import { createClient } from "@supabase/supabase-js";

// -- Cliente Supabase server-side ----------------------------------------------
// Usa SUPABASE_SERVICE_ROLE_KEY si está disponible (bypasa RLS),
// si no usa SUPABASE_KEY (anon key, respeta RLS).

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const supabase = createClient(url, key);

// -- Database types (coinciden con schema_v2.sql) ------------------------------

export type Lead = {
  id: string;
  workspace_id?: string;
  campaign_id?: string;
  assigned_to?: string;
  linkedin_url?: string;
  full_name: string;
  headline?: string;
  email?: string;
  phone?: string;
  company?: string;
  ai_summary?: string;
  status: string;
  value: number;
  score: number;
  custom_tags: string[];
  next_task?: string;
  created_at: string;
};

export type Campaign = {
  id: string;
  workspace_id?: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  workflow_json: Record<string, unknown>;
  total_leads: number;
  segment_count: number;
  created_at: string;
};

export type DBMessage = {
  id: string;
  lead_id: string;
  sender: "user" | "ai" | "prospect";
  message_text: string;
  is_read: boolean;
  status: "sending" | "sent" | "delivered" | "read";
  timestamp: string;
};

export type Agent = {
  id: string;
  workspace_id?: string;
  name: string;
  avatar_emoji: string;
  status: "active" | "paused" | "draft";
  tone: string;
  objective: string;
  icp_industries: string[];
  icp_roles: string[];
  value_proposition?: string;
  objections: Array<{ question: string; answer: string }>;
  conversations_count: number;
  meetings_count: number;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  workspace_id?: string;
  lead_id?: string;
  campaign_id?: string;
  action_type: string;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
