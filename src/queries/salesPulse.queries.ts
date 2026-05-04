/**
 * queries/salesPulse.queries.ts
 *
 * CRUD de subscribers + historial de runs + trigger de envíos manuales
 * para el Sales Pulse Semanal. Vive en proyecto AUTH (authClient).
 *
 * El cómputo del payload y el envío vía Resend lo hace la Edge Function
 * send-sales-pulse — desde la app solo invocamos.
 */
import { authClient } from "@/api/client";
import { trimStr } from "@/api/normalize";
import type { PulseRunStatus } from "@/domain/salesPulse/types";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export interface SalesPulseSubscriber {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalesPulseRun {
  id: string;
  triggeredBy: "cron" | "manual";
  triggeredByUser: string | null;
  scheduledAt: string;
  sentAt: string | null;
  weekStart: string;
  weekEnd: string;
  recipients: string[];
  resendIds: string[];
  status: PulseRunStatus;
  errorMsg: string | null;
  payload: unknown;
  isTest: boolean;
}

export interface TriggerTestSendInput {
  /** Si se omite, la EF resuelve los activos en BD. */
  recipients?: string[];
  /** Si se omite, la EF calcula el lunes anterior PYT. */
  weekStart?: string;
  /** true = no envía Resend, devuelve preview del HTML. */
  dryRun?: boolean;
}

export interface TriggerTestSendResult {
  status: PulseRunStatus | "dry_run";
  weekStart: string;
  weekEnd: string;
  sentCount?: number;
  recipientsCount?: number;
  errors?: string[];
  /** Solo presente cuando dryRun=true. */
  htmlPreview?: string;
  payload?: unknown;
  subject?: string;
}

// ─── Subscribers CRUD ───────────────────────────────────────────────────────

export async function fetchSubscribers(): Promise<SalesPulseSubscriber[]> {
  const { data, error } = await authClient
    .from("sales_pulse_subscribers")
    .select("id, email, name, active, created_at, updated_at")
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`fetchSubscribers: ${error.message}`);

  return (data ?? []).map((r) => ({
    id:        r.id,
    email:     trimStr(r.email),
    name:      r.name ? trimStr(r.name) : null,
    active:    !!r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function addSubscriber(input: { email: string; name?: string | null }): Promise<SalesPulseSubscriber> {
  const email = trimStr(input.email).toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Email inválido");

  const { data, error } = await authClient
    .from("sales_pulse_subscribers")
    .insert({ email, name: input.name?.trim() || null, active: true })
    .select("id, email, name, active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Ese email ya está suscripto");
    throw new Error(`addSubscriber: ${error.message}`);
  }

  return {
    id: data.id, email: trimStr(data.email),
    name: data.name ? trimStr(data.name) : null,
    active: !!data.active,
    createdAt: data.created_at, updatedAt: data.updated_at,
  };
}

export async function setSubscriberActive(id: string, active: boolean): Promise<void> {
  const { error } = await authClient
    .from("sales_pulse_subscribers")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(`setSubscriberActive: ${error.message}`);
}

export async function removeSubscriber(id: string): Promise<void> {
  const { error } = await authClient
    .from("sales_pulse_subscribers")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`removeSubscriber: ${error.message}`);
}

// ─── Runs (audit log) ───────────────────────────────────────────────────────

export async function deleteRun(id: string): Promise<void> {
  const { error } = await authClient
    .from("sales_pulse_runs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deleteRun: ${error.message}`);
}

export interface FetchRunsResult {
  rows: SalesPulseRun[];
  total: number;
}

export async function fetchRuns(page = 0, pageSize = 12): Promise<FetchRunsResult> {
  const from = page * pageSize;
  const to   = from + pageSize - 1;
  const { data, error, count } = await authClient
    .from("sales_pulse_runs")
    .select(
      "id, triggered_by, triggered_by_user, scheduled_at, sent_at, week_start, week_end, recipients, resend_ids, status, error_msg, payload, is_test",
      { count: "exact" },
    )
    .order("scheduled_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`fetchRuns: ${error.message}`);

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    triggeredBy:    (r.triggered_by === "cron" ? "cron" : "manual") as "cron" | "manual",
    triggeredByUser: r.triggered_by_user ?? null,
    scheduledAt: r.scheduled_at,
    sentAt:      r.sent_at ?? null,
    weekStart:   r.week_start,
    weekEnd:     r.week_end,
    recipients:  (r.recipients ?? []) as string[],
    resendIds:   (r.resend_ids ?? []) as string[],
    status:      r.status as PulseRunStatus,
    errorMsg:    r.error_msg ?? null,
    payload:     r.payload ?? {},
    isTest:      !!r.is_test,
  }));

  return { rows, total: count ?? rows.length };
}

// ─── Trigger manual / test ──────────────────────────────────────────────────

/**
 * Invoca la EF send-sales-pulse autenticando con el JWT del usuario actual.
 * El backend re-valida que sea super_user antes de proceder.
 */
export async function triggerSalesPulse(input: TriggerTestSendInput = {}): Promise<TriggerTestSendResult> {
  const session = await authClient.auth.getSession();
  if (!session.data.session) throw new Error("Sesión expirada");

  const body: Record<string, unknown> = { source: "manual", is_test: true };
  if (input.recipients && input.recipients.length > 0) body.recipients = input.recipients;
  if (input.weekStart) body.p_week_start = input.weekStart;
  if (input.dryRun) body.dry_run = true;

  const { data, error } = await authClient.functions.invoke("send-sales-pulse", { body });
  if (error) throw new Error(`triggerSalesPulse: ${error.message}`);

  if (input.dryRun) {
    return {
      status: "dry_run",
      weekStart: data.week_start,
      weekEnd: data.week_end,
      htmlPreview: data.html,
      payload: data.payload,
      subject: data.subject,
      recipientsCount: (data.recipients ?? []).length,
    };
  }

  return {
    status: data.status as PulseRunStatus,
    weekStart: data.week_start,
    weekEnd: data.week_end,
    sentCount: data.sent_count,
    recipientsCount: data.recipients_count,
    errors: data.errors ?? [],
  };
}
