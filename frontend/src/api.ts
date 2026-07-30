import {
  ApiError,
  type ApiErrorPayload,
  type AuditTrailResponse,
  type ConfirmationDecision,
  type HealthResponse,
  type ProposeResponse,
  type ResolveResponse,
  type ReviewDecision,
} from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, `Could not reach the API at ${BASE_URL}. Is it running?`);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = payload.error?.message ?? message;
    } catch {
      // body wasn't JSON — fall back to the generic message above
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

export function proposeAction(userRequest: string, sessionId: string): Promise<ProposeResponse> {
  // Track session ID in local storage for global dashboard/audit usage
  const sessions = JSON.parse(localStorage.getItem("autonomy_sessions") || "[]");
  if (!sessions.includes(sessionId)) {
    sessions.push(sessionId);
    localStorage.setItem("autonomy_sessions", JSON.stringify(sessions));
  }

  return request<ProposeResponse>("/actions/propose", {
    method: "POST",
    body: JSON.stringify({ user_request: userRequest, session_id: sessionId }),
  });
}

export function resolveConfirmation(
  confirmationId: string,
  decision: ConfirmationDecision,
  reviewer: string,
): Promise<ResolveResponse> {
  return request<ResolveResponse>(`/confirmations/${confirmationId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ decision, reviewer }),
  });
}

export function resolveReview(
  reviewId: string,
  decision: ReviewDecision,
  reviewer: string,
): Promise<ResolveResponse> {
  return request<ResolveResponse>(`/reviews/${reviewId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ decision, reviewer }),
  });
}

export function getAuditTrail(sessionId: string): Promise<AuditTrailResponse> {
  return request<AuditTrailResponse>(`/audit/${encodeURIComponent(sessionId)}`);
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export { BASE_URL as apiBaseUrl };

import type { DashboardStatsResponse, DashboardRecentResponse, AuditEntry } from "./types";

export async function getAllAuditLogs(): Promise<AuditEntry[]> {
  const sessions = JSON.parse(localStorage.getItem("autonomy_sessions") || "[]");
  if (sessions.length === 0) return [];
  
  const promises = sessions.map((s: string) => 
    getAuditTrail(s).catch(() => ({ actions: [] }))
  );
  
  const results = await Promise.all(promises);
  let allActions: AuditEntry[] = [];
  
  for (const res of results) {
    if (res && res.actions) {
      // Cast is needed because the backend type uses dict, but AuditEntry is more specific
      allActions = allActions.concat(res.actions as unknown as AuditEntry[]);
    }
  }
  
  // Sort descending (newest first)
  return allActions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  const allLogs = await getAllAuditLogs();
  
  let autonomousExecutions = 0;
  let pendingConfirmations = 0;
  let humanReviews = 0;
  let lowRisk = 0;
  let medRisk = 0;
  let highRisk = 0;
  const dateMap: Record<string, number> = {};
  
  for (const log of allLogs) {
    if (log.routing_decision === "autonomous") autonomousExecutions++;
    if (log.routing_decision === "confirm" && log.status === "pending") pendingConfirmations++;
    if (log.routing_decision === "full_review" && log.status === "pending") humanReviews++;
    
    const score = log.composite_score || 0;
    if (score >= 0.75) highRisk++;
    else if (score >= 0.4) medRisk++;
    else lowRisk++;
    
    const dateStr = new Date(log.timestamp).toLocaleDateString("en-US", { weekday: 'short' });
    dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
  }
  
  // Create a 7-day trailing look if there isn't enough data
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date().getDay();
  const sortedDates = [];
  for (let i = 6; i >= 0; i--) {
    sortedDates.push(days[(today - i + 7) % 7]);
  }
  
  const requestsOverTime = sortedDates.map(d => ({
    date: d,
    requests: dateMap[d] || 0
  }));
  
  return {
    totalRequests: allLogs.length,
    autonomousExecutions,
    pendingConfirmations,
    humanReviews,
    requestsOverTime,
    riskDistribution: [
      { name: "Low", value: lowRisk },
      { name: "Medium", value: medRisk },
      { name: "High", value: highRisk },
    ],
  };
}

export async function getRecentRequests(): Promise<DashboardRecentResponse> {
  const logs = await getAllAuditLogs();
  return { recent: logs.slice(0, 5) };
}
