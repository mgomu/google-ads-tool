/**
 * Google Ads API Client
 *
 * Provides real data fetching via GAQL (Google Ads Query Language)
 * against Google Ads API v17.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  loginCustomerId?: string;
  customerId: string;
}

/** Normalized campaign with KPIs */
export interface Campaign {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED";
  budget: number;
  impressions: number;
  clicks: number;
  conversions: number;
  costMicros: number;
  /** Derived cost in dollars */
  cost: number;
  ctr: number;
  conversionRate: number;
  cpc: number;
}

/** Performance metrics for a campaign over a date range */
export interface PerformanceMetrics {
  campaignId: string;
  campaignName: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  costMicros: number;
  cost: number;
  ctr: number;
  conversionRate: number;
  cpc: number;
}

/** Campaign detail with ad groups and budget info */
export interface CampaignDetail extends Campaign {
  adGroups: AdGroup[];
  budgetName: string;
  advertisingChannelType: string;
  biddingStrategyType: string;
  startDate: string;
  endDate?: string;
}

export interface AdGroup {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED";
  impressions: number;
  clicks: number;
  costMicros: number;
  cpc: number;
}

export interface AdsApiError {
  code: number;
  message: string;
  details?: unknown;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export function getGoogleAdsConfig(): GoogleAdsConfig {
  return {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
  };
}

/** Returns true when every required credential is present */
export function isConfigValid(config: GoogleAdsConfig): boolean {
  return !!(
    config.clientId &&
    config.clientSecret &&
    config.refreshToken &&
    config.developerToken &&
    config.customerId
  );
}

// ─── OAuth2 ──────────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  config: GoogleAdsConfig
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OAuth token refresh failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ─── Low-level request ───────────────────────────────────────────────────────

export interface GoogleAdsSearchResponse {
  results: Record<string, unknown>[];
}

async function searchGaql(
  config: GoogleAdsConfig,
  query: string
): Promise<Record<string, unknown>[]> {
  const accessToken = await refreshAccessToken(config);

  const customerId = config.customerId.replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
    "Content-Type": "application/json",
  };
  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId.replace(/-/g, "");
  }

  const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      // leave null
    }
    const apiMsg =
      (parsed?.["error"] as Record<string, string>)?.["message"] || errorBody;
    throw {
      code: response.status,
      message: `Google Ads API error: ${apiMsg}`,
      details: parsed,
    } satisfies AdsApiError;
  }

  // searchStream returns an array of SearchStreamResult buckets
  const stream: GoogleAdsSearchResponse[] = await response.json();
  const allResults: Record<string, unknown>[] = [];
  for (const bucket of stream) {
    allResults.push(...bucket.results);
  }
  return allResults;
}

// ─── Normalization helpers ───────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return Number(val) || 0;
  return 0;
}

function microsToDollars(micros: number): number {
  return Math.round((micros / 1_000_000) * 100) / 100;
}

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 10000) / 100; // two decimal places
}

function normalizeStatus(raw: string): Campaign["status"] {
  const upper = raw?.toUpperCase() || "REMOVED";
  if (upper === "ENABLED" || upper === "PAUSED") return upper;
  return "REMOVED";
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

/** Fetch all campaigns with KPIs for the given date range */
export async function fetchCampaigns(
  customerId: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<Campaign[]> {
  const config = getGoogleAdsConfig();
  const start = dateRange?.startDate || daysAgo(30);
  const end = dateRange?.endDate || today();

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.campaign_budget,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.conversion_rate,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  const results = await searchGaql(config, query);

  return results.map((r) => {
    const campaign = r["campaign"] as Record<string, unknown>;
    const metrics = r["metrics"] as Record<string, unknown>;
    const costMicros = toNumber(metrics["costMicros"]);
    const impressions = toNumber(metrics["impressions"]);
    const clicks = toNumber(metrics["clicks"]);
    const conversions = toNumber(metrics["conversions"]);

    return {
      id: String(campaign["id"]),
      name: String(campaign["name"]),
      status: normalizeStatus(String(campaign["status"])),
      budget: toNumber(campaign["campaignBudget"]),
      impressions,
      clicks,
      conversions,
      costMicros,
      cost: microsToDollars(costMicros),
      ctr: toNumber(metrics["ctr"]),
      conversionRate: toNumber(metrics["conversionRate"]),
      cpc: microsToDollars(toNumber(metrics["averageCpc"])),
    };
  });
}

// ─── Performance metrics (daily) ─────────────────────────────────────────────

export async function fetchPerformanceMetrics(
  customerId: string,
  dateRange?: { startDate: string; endDate: string },
  campaignId?: string
): Promise<PerformanceMetrics[]> {
  const config = getGoogleAdsConfig();
  const start = dateRange?.startDate || daysAgo(30);
  const end = dateRange?.endDate || today();

  let campaignFilter = "";
  if (campaignId) {
    campaignFilter = `AND campaign.id = ${campaignId}`;
  }

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.conversion_rate,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
      ${campaignFilter}
    ORDER BY segments.date ASC
  `;

  const results = await searchGaql(config, query);

  return results.map((r) => {
    const campaign = r["campaign"] as Record<string, unknown>;
    const segments = r["segments"] as Record<string, unknown>;
    const metrics = r["metrics"] as Record<string, unknown>;
    const costMicros = toNumber(metrics["costMicros"]);
    const clicks = toNumber(metrics["clicks"]);
    const conversions = toNumber(metrics["conversions"]);

    return {
      campaignId: String(campaign["id"]),
      campaignName: String(campaign["name"]),
      date: String(segments["date"]),
      impressions: toNumber(metrics["impressions"]),
      clicks,
      conversions,
      costMicros,
      cost: microsToDollars(costMicros),
      ctr: toNumber(metrics["ctr"]),
      conversionRate: toNumber(metrics["conversionRate"]),
      cpc: microsToDollars(toNumber(metrics["averageCpc"])),
    };
  });
}

// ─── Campaign detail (with ad groups) ────────────────────────────────────────

export async function fetchCampaignDetail(
  customerId: string,
  campaignId: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<CampaignDetail | null> {
  const config = getGoogleAdsConfig();
  const start = dateRange?.startDate || daysAgo(30);
  const end = dateRange?.endDate || today();

  // Fetch campaign-level info
  const campaignQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.campaign_budget,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.conversion_rate,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.id = ${campaignId}
  `;

  const campaignResults = await searchGaql(config, campaignQuery);
  if (campaignResults.length === 0) return null;

  const r = campaignResults[0];
  const campaign = r["campaign"] as Record<string, unknown>;
  const metrics = r["metrics"] as Record<string, unknown>;
  const costMicros = toNumber(metrics["costMicros"]);
  const impressions = toNumber(metrics["impressions"]);
  const clicks = toNumber(metrics["clicks"]);
  const conversions = toNumber(metrics["conversions"]);

  // Fetch ad groups for this campaign
  const adGroupQuery = `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.average_cpc
    FROM ad_group
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.id = ${campaignId}
    ORDER BY metrics.cost_micros DESC
  `;

  const adGroupResults = await searchGaql(config, adGroupQuery);

  const adGroups: AdGroup[] = adGroupResults.map((ar) => {
    const ag = ar["ad_group"] as Record<string, unknown>;
    const agm = ar["metrics"] as Record<string, unknown>;
    return {
      id: String(ag["id"]),
      name: String(ag["name"]),
      status: normalizeStatus(String(ag["status"])),
      impressions: toNumber(agm["impressions"]),
      clicks: toNumber(agm["clicks"]),
      costMicros: toNumber(agm["costMicros"]),
      cpc: microsToDollars(toNumber(agm["averageCpc"])),
    };
  });

  return {
    id: String(campaign["id"]),
    name: String(campaign["name"]),
    status: normalizeStatus(String(campaign["status"])),
    budget: toNumber(campaign["campaignBudget"]),
    impressions,
    clicks,
    conversions,
    costMicros,
    cost: microsToDollars(costMicros),
    ctr: toNumber(metrics["ctr"]),
    conversionRate: toNumber(metrics["conversionRate"]),
    cpc: microsToDollars(toNumber(metrics["averageCpc"])),
    adGroups,
    budgetName: String(campaign["campaignBudget"]),
    advertisingChannelType: String(campaign["advertisingChannelType"]),
    biddingStrategyType: String(campaign["biddingStrategyType"]),
    startDate: String(campaign["startDate"]),
    endDate: campaign["endDate"] ? String(campaign["endDate"]) : undefined,
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function microsToCurrency(micros: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(micros / 1_000_000);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
