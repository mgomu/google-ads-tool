import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleAdsConfig,
  isConfigValid,
  fetchCampaigns,
  type AdsApiError,
} from "@/lib/google-ads";

/**
 * GET /api/google-ads/campaigns
 *
 * Lists all campaigns with KPIs.
 * Query params: startDate, endDate (ISO date strings, optional — defaults to last 30 days)
 */
export async function GET(request: NextRequest) {
  const config = getGoogleAdsConfig();

  if (!isConfigValid(config)) {
    return NextResponse.json(
      {
        error: "Google Ads API credentials not configured",
        message:
          "Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN, and GOOGLE_ADS_CUSTOMER_ID in .env.local",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const dateRange =
    startDate && endDate ? { startDate, endDate } : undefined;

  try {
    const campaigns = await fetchCampaigns(config.customerId, dateRange);

    return NextResponse.json({
      campaigns,
      meta: {
        count: campaigns.length,
        totalCost: campaigns.reduce((sum, c) => sum + c.cost, 0),
        totalImpressions: campaigns.reduce(
          (sum, c) => sum + c.impressions,
          0
        ),
        totalClicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
        totalConversions: campaigns.reduce(
          (sum, c) => sum + c.conversions,
          0
        ),
      },
    });
  } catch (err) {
    const apiErr = err as AdsApiError;
    console.error("Error fetching campaigns:", apiErr.message || err);
    return NextResponse.json(
      {
        error: "Failed to fetch campaigns",
        message: apiErr.message || "Unknown error",
        code: apiErr.code,
      },
      { status: apiErr.code >= 400 && apiErr.code < 600 ? apiErr.code : 500 }
    );
  }
}
