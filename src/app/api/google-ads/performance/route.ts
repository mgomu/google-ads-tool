import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleAdsConfig,
  isConfigValid,
  fetchPerformanceMetrics,
  type AdsApiError,
} from "@/lib/google-ads";

/**
 * GET /api/google-ads/performance
 *
 * Daily performance metrics for campaigns.
 * Query params:
 *   startDate, endDate — ISO date strings (defaults to last 30 days)
 *   campaignId — optional filter to a single campaign
 */
export async function GET(request: NextRequest) {
  const config = getGoogleAdsConfig();

  if (!isConfigValid(config)) {
    return NextResponse.json(
      {
        error: "Google Ads API credentials not configured",
        message: "Set required Google Ads environment variables in .env.local",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const campaignId = searchParams.get("campaignId") || undefined;
  const dateRange =
    startDate && endDate ? { startDate, endDate } : undefined;

  try {
    const metrics = await fetchPerformanceMetrics(
      config.customerId,
      dateRange,
      campaignId || undefined
    );

    return NextResponse.json({
      metrics,
      meta: {
        count: metrics.length,
        dateRange: {
          start: metrics.length > 0 ? metrics[0].date : null,
          end:
            metrics.length > 0 ? metrics[metrics.length - 1].date : null,
        },
        totals: metrics.reduce(
          (acc, m) => ({
            impressions: acc.impressions + m.impressions,
            clicks: acc.clicks + m.clicks,
            conversions: acc.conversions + m.conversions,
            cost: acc.cost + m.cost,
          }),
          { impressions: 0, clicks: 0, conversions: 0, cost: 0 }
        ),
      },
    });
  } catch (err) {
    const apiErr = err as AdsApiError;
    console.error("Error fetching performance:", apiErr.message || err);
    return NextResponse.json(
      {
        error: "Failed to fetch performance metrics",
        message: apiErr.message || "Unknown error",
        code: apiErr.code,
      },
      { status: apiErr.code >= 400 && apiErr.code < 600 ? apiErr.code : 500 }
    );
  }
}
