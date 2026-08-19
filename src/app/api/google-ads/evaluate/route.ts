import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleAdsConfig,
  isConfigValid,
} from "@/lib/google-ads";
import { runEvaluation } from "@/lib/evaluation-engine";

/**
 * POST /api/google-ads/evaluate
 *
 * Runs evaluation engine on campaigns:
 * - Scores each campaign (0-100)
 * - Detects performance trends
 * - Generates actionable improvement suggestions
 *
 * Body: { customerId?: string, startDate?: string, endDate?: string, campaignIds?: string[] }
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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // GET-style request or empty body — use defaults
  }

  const customerId = (body.customerId as string) || config.customerId;
  const startDate = (body.startDate as string) || undefined;
  const endDate = (body.endDate as string) || undefined;
  const campaignIds = (body.campaignIds as string[]) || undefined;

  const dateRange =
    startDate && endDate ? { startDate, endDate } : undefined;

  try {
    const result = await runEvaluation({
      customerId,
      dateRange,
      campaignIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    const error = err as Error;
    console.error("Evaluation error:", error.message || err);
    return NextResponse.json(
      {
        error: "Failed to run evaluation",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

/** Also support GET for quick evaluation with default params */
export async function GET(request: NextRequest) {
  return POST(request);
}
