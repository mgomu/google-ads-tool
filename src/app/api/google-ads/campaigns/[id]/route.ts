import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleAdsConfig,
  isConfigValid,
  fetchCampaignDetail,
  type AdsApiError,
} from "@/lib/google-ads";

/**
 * GET /api/google-ads/campaigns/[id]
 *
 * Campaign detail including ad groups.
 * Query params: startDate, endDate (optional, defaults to last 30 days)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: campaignId } = await params;

  if (!campaignId) {
    return NextResponse.json(
      { error: "Campaign ID is required" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const dateRange =
    startDate && endDate ? { startDate, endDate } : undefined;

  try {
    const detail = await fetchCampaignDetail(
      config.customerId,
      campaignId,
      dateRange
    );

    if (!detail) {
      return NextResponse.json(
        { error: `Campaign ${campaignId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ campaign: detail });
  } catch (err) {
    const apiErr = err as AdsApiError;
    console.error("Error fetching campaign detail:", apiErr.message || err);
    return NextResponse.json(
      {
        error: "Failed to fetch campaign detail",
        message: apiErr.message || "Unknown error",
        code: apiErr.code,
      },
      { status: apiErr.code >= 400 && apiErr.code < 600 ? apiErr.code : 500 }
    );
  }
}
