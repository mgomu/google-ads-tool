import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleAdsConfig,
  isConfigValid,
} from "@/lib/google-ads";
import { createCampaignDraft } from "@/lib/campaign-creator";

/**
 * POST /api/google-ads/campaigns/create
 *
 * Creates a campaign draft by learning from historical data.
 * Generates ad copy, keyword suggestions, bidding strategy, and budget recommendations.
 *
 * Body: { productName, goal, dailyBudget, targetLocation?, targetLanguage?, landingPageUrl?, baseCampaignId? }
 */
export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body is required" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.productName || typeof body.productName !== "string") {
    return NextResponse.json(
      { error: "productName is required (string)" },
      { status: 400 }
    );
  }
  if (!body.goal || !["conversions", "traffic", "brand_awareness", "leads"].includes(body.goal as string)) {
    return NextResponse.json(
      { error: "goal is required: conversions | traffic | brand_awareness | leads" },
      { status: 400 }
    );
  }
  if (typeof body.dailyBudget !== "number" || body.dailyBudget <= 0) {
    return NextResponse.json(
      { error: "dailyBudget is required (positive number in USD)" },
      { status: 400 }
    );
  }

  try {
    const draft = await createCampaignDraft({
      customerId: config.customerId,
      productName: body.productName as string,
      goal: body.goal as "conversions" | "traffic" | "brand_awareness" | "leads",
      dailyBudget: body.dailyBudget as number,
      targetLocation: body.targetLocation as string | undefined,
      targetLanguage: body.targetLanguage as string | undefined,
      landingPageUrl: body.landingPageUrl as string | undefined,
      baseCampaignId: body.baseCampaignId as string | undefined,
    });

    return NextResponse.json({ draft });
  } catch (err) {
    const error = err as Error;
    console.error("Campaign creation error:", error.message || err);
    return NextResponse.json(
      {
        error: "Failed to create campaign draft",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
