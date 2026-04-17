/**
 * domain/marketing/types.ts
 *
 * Tipos canónicos para el Motor de Marketing (SAM).
 * Sin React. Sin Supabase.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type CustomerTier = "vip" | "frequent" | "occasional" | "at_risk" | "inactive";

export type MessageChannel = "email" | "whatsapp" | "sms";

export type TriggerCategory =
  | "inactivity"
  | "overdue"
  | "return"
  | "post_purchase"
  | "first_purchase"
  | "second_purchase"
  | "high_ticket"
  | "low_ticket"
  | "low_stock";

export type ExecutionStatus = "pending" | "sent" | "delivered" | "opened" | "clicked" | "failed";

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

// ─── Entities ───────────────────────────────────────────────────────────────

export interface SamCustomer {
  id: string;
  erpCode: string;
  ruc: string;
  razonSocial: string;
  phone: string | null;
  email: string | null;
  tipoCliente: string | null;
  tier: CustomerTier;
  totalSpent: number;
  purchaseCount: number;
  avgTicket: number;
  lastPurchase: string | null;
  hasPendingDebt: boolean;
  pendingAmount: number;
  fechaIngreso: string | null;
  codeCount: number;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SamTemplate {
  id: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SamSegment {
  id: string;
  name: string;
  description: string | null;
  filters: SegmentFilter;
  createdAt: string;
  updatedAt: string;
}

export interface SamCampaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  segmentId: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SamTrigger {
  id: string;
  name: string;
  category: TriggerCategory;
  description: string | null;
  channel: MessageChannel;
  templateId: string | null;
  campaignId: string | null;
  conditions: TriggerCondition;
  frequencyCap: number;
  priority: number;
  isActive: boolean;
  fireCount: number;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SamExecution {
  id: string;
  triggerId: string;
  customerId: string;
  campaignId: string | null;
  channel: MessageChannel;
  status: ExecutionStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  errorMsg: string | null;
  createdAt: string;
}

// ─── Value Objects ──────────────────────────────────────────────────────────

export interface SegmentFilter {
  tiers?: CustomerTier[];
  channels?: MessageChannel[];
  minSpent?: number;
  maxSpent?: number;
  minPurchases?: number;
  inactiveDays?: number;
  hasPendingDebt?: boolean;
}

export interface TriggerCondition {
  inactivityDays?: number;
  withinDays?: number;
  ticketThreshold?: number;
  stockThreshold?: number;
}

export interface MarketingMetrics {
  totalCustomers: number;
  reachableEmail: number;
  reachableWhatsapp: number;
  activeTriggers: number;
  totalExecutions: number;
  openRate: number;
}

export interface TriggerInsight {
  triggerId: string;
  triggerName: string;
  category: TriggerCategory;
  channel: MessageChannel;
  description: string | null;
  isActive: boolean;
  matchCount: number;
}

export interface EtlStats {
  totalSynced: number;
  withPhone: number;
  withEmail: number;
  withBoth: number;
  tierBreakdown: Record<CustomerTier, number>;
  lastSyncedAt: string | null;
}
