/**
 * Evaluation Engine
 *
 * Analyzes campaign performance data, identifies trends, compares campaigns,
 * and generates actionable improvement suggestions.
 */

import {
  type Campaign,
  type PerformanceMetrics,
  fetchCampaigns,
  fetchPerformanceMetrics,
  getGoogleAdsConfig,
  isConfigValid,
} from "./google-ads";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EvaluationRequest {
  customerId: string;
  dateRange?: { startDate: string; endDate: string };
  campaignIds?: string[];
}

export interface CampaignScore {
  campaignId: string;
  campaignName: string;
  overallScore: number; // 0-100
  metrics: {
    roi: number;
    costPerConversion: number;
    ctr: number;
    conversionRate: number;
    cpc: number;
  };
  trend: "improving" | "declining" | "stable";
  trendDetails: {
    impressionsChange: number; // % change vs prior period
    clicksChange: number;
    conversionsChange: number;
    costChange: number;
  };
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface ImprovementSuggestion {
  id: string;
  campaignId: string | null; // null = account-level
  campaignName: string | null;
  priority: "high" | "medium" | "low";
  category:
    | "budget"
    | "targeting"
    | "ad_copy"
    | "bidding"
    | "structure"
    | "keyword";
  title: string;
  description: string;
  estimatedImpact: string;
  actionItems: string[];
}

export interface EvaluationResult {
  generatedAt: string;
  dateRange: { startDate: string; endDate: string };
  accountSummary: {
    totalCampaigns: number;
    totalCost: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    avgCtr: number;
    avgConversionRate: number;
    avgCpc: number;
    overallScore: number;
    overallGrade: "A" | "B" | "C" | "D" | "F";
  };
  campaignScores: CampaignScore[];
  suggestions: ImprovementSuggestion[];
  topPerformers: CampaignScore[];
  underPerformers: CampaignScore[];
}

// ─── Scoring thresholds ──────────────────────────────────────────────────────

const BENCHMARKS = {
  ctr: { excellent: 3.0, good: 1.5, average: 0.8, poor: 0.3 },
  conversionRate: {
    excellent: 5.0,
    good: 2.5,
    average: 1.0,
    poor: 0.3,
  },
  cpc: { excellent: 0.5, good: 1.5, average: 3.0, poor: 5.0 },
  costPerConversion: {
    excellent: 10,
    good: 25,
    average: 50,
    poor: 100,
  },
};

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function scoreMetric(
  value: number,
  benchmarks: { excellent: number; good: number; average: number; poor: number },
  higherIsBetter: boolean
): number {
  if (higherIsBetter) {
    if (value >= benchmarks.excellent) return 25;
    if (value >= benchmarks.good) return 20;
    if (value >= benchmarks.average) return 15;
    if (value >= benchmarks.poor) return 10;
    return 5;
  } else {
    // lower is better (CPC, cost per conversion)
    if (value <= benchmarks.excellent) return 25;
    if (value <= benchmarks.good) return 20;
    if (value <= benchmarks.average) return 15;
    if (value <= benchmarks.poor) return 10;
    return 5;
  }
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// ─── Trend detection ─────────────────────────────────────────────────────────

function detectTrend(
  recent: PerformanceMetrics[],
  prior: PerformanceMetrics[]
): {
  trend: "improving" | "declining" | "stable";
  details: {
    impressionsChange: number;
    clicksChange: number;
    conversionsChange: number;
    costChange: number;
  };
} {
  const sumRecent = recent.reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      cost: acc.cost + m.cost,
    }),
    { impressions: 0, clicks: 0, conversions: 0, cost: 0 }
  );

  const sumPrior = prior.reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      cost: acc.cost + m.cost,
    }),
    { impressions: 0, clicks: 0, conversions: 0, cost: 0 }
  );

  function pctChange(recent: number, prior: number): number {
    if (prior === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - prior) / prior) * 10000) / 100;
  }

  const impressionsChange = pctChange(
    sumRecent.impressions,
    sumPrior.impressions
  );
  const clicksChange = pctChange(sumRecent.clicks, sumPrior.clicks);
  const conversionsChange = pctChange(
    sumRecent.conversions,
    sumPrior.conversions
  );
  const costChange = pctChange(sumRecent.cost, sumPrior.cost);

  // Trend logic: improving if key metrics are up and cost isn't disproportionately up
  const engagementUp = clicksChange > 5 || conversionsChange > 5;
  const costControlled = costChange < clicksChange * 1.5 || sumRecent.cost < sumPrior.cost;

  let trend: "improving" | "declining" | "stable";
  if (engagementUp && costControlled) {
    trend = "improving";
  } else if (clicksChange < -10 || conversionsChange < -15) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  return {
    trend,
    details: { impressionsChange, clicksChange, conversionsChange, costChange },
  };
}

// ─── Suggestion generation ───────────────────────────────────────────────────

let suggestionCounter = 0;
function nextSuggestionId(): string {
  return `sug-${Date.now()}-${++suggestionCounter}`;
}

function generateSuggestions(
  campaigns: Campaign[],
  scores: CampaignScore[]
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];

  // Account-level: identify campaigns with zero conversions but significant spend
  const noConversionCampaigns = campaigns.filter(
    (c) => c.conversions === 0 && c.cost > 10
  );
  if (noConversionCampaigns.length > 0) {
    suggestions.push({
      id: nextSuggestionId(),
      campaignId: null,
      campaignName: null,
      priority: "high",
      category: "budget",
      title: `${noConversionCampaigns.length} campaign(s) spending with zero conversions`,
      description: `These campaigns have accumulated cost without any conversions: ${noConversionCampaigns.map((c) => c.name).join(", ")}. Consider pausing them or revising the targeting.`,
      estimatedImpact: "Could save $" + noConversionCampaigns.reduce((s, c) => s + c.cost, 0).toFixed(2) + " in wasted spend",
      actionItems: [
        "Review search terms report for these campaigns",
        "Check if conversion tracking is properly configured",
        "Consider pausing underperforming ad groups",
        "Test new ad copy or landing pages",
      ],
    });
  }

  // Per-campaign suggestions
  for (const score of scores) {
    const campaign = campaigns.find((c) => c.id === score.campaignId);
    if (!campaign) continue;

    // Low CTR suggestion
    if (score.metrics.ctr < BENCHMARKS.ctr.average) {
      suggestions.push({
        id: nextSuggestionId(),
        campaignId: score.campaignId,
        campaignName: score.campaignName,
        priority: score.metrics.ctr < BENCHMARKS.ctr.poor ? "high" : "medium",
        category: "ad_copy",
        title: `Low CTR on "${score.campaignName}" (${score.metrics.ctr.toFixed(2)}%)`,
        description: `The click-through rate is below industry average. This suggests the ad copy or extensions may not be resonating with the target audience.`,
        estimatedImpact: `Improving CTR from ${score.metrics.ctr.toFixed(2)}% to ${BENCHMARKS.ctr.good}% could increase clicks by ${Math.round(((BENCHMARKS.ctr.good - score.metrics.ctr) / score.metrics.ctr) * 100)}%`,
        actionItems: [
          "Test new ad headlines with stronger calls-to-action",
          "Add ad extensions (sitelinks, callouts, structured snippets)",
          "Ensure ad copy matches search intent",
          "Review and pause low-performing keywords",
        ],
      });
    }

    // High CPC suggestion
    if (score.metrics.cpc > BENCHMARKS.cpc.average) {
      suggestions.push({
        id: nextSuggestionId(),
        campaignId: score.campaignId,
        campaignName: score.campaignName,
        priority: score.metrics.cpc > BENCHMARKS.cpc.poor ? "high" : "medium",
        category: "bidding",
        title: `High CPC on "${score.campaignName}" ($${score.metrics.cpc.toFixed(2)})`,
        description: `The average cost per click is above the recommended range. This increases acquisition costs and reduces overall ROI.`,
        estimatedImpact: `Reducing CPC from $${score.metrics.cpc.toFixed(2)} to $${BENCHMARKS.cpc.good.toFixed(2)} could save $${((score.metrics.cpc - BENCHMARKS.cpc.good) * campaign.clicks).toFixed(2)} over the same click volume`,
        actionItems: [
          "Review bid strategy — consider switching to Target CPA or Maximize Conversions",
          "Add negative keywords to exclude irrelevant traffic",
          "Improve Quality Score by enhancing ad relevance and landing page experience",
          "Test different keyword match types (broad → phrase → exact)",
        ],
      });
    }

    // Low conversion rate
    if (
      score.metrics.conversionRate < BENCHMARKS.conversionRate.average &&
      campaign.clicks > 50
    ) {
      suggestions.push({
        id: nextSuggestionId(),
        campaignId: score.campaignId,
        campaignName: score.campaignName,
        priority:
          score.metrics.conversionRate < BENCHMARKS.conversionRate.poor
            ? "high"
            : "medium",
        category: "targeting",
        title: `Low conversion rate on "${score.campaignName}" (${score.metrics.conversionRate.toFixed(2)}%)`,
        description: `Visitors are clicking but not converting. This could indicate a mismatch between ad promises and landing page experience, or poor audience targeting.`,
        estimatedImpact: `Improving conversion rate from ${score.metrics.conversionRate.toFixed(2)}% to ${BENCHMARKS.conversionRate.good}% could increase conversions by ${Math.round(((BENCHMARKS.conversionRate.good - score.metrics.conversionRate) / score.metrics.conversionRate) * 100)}%`,
        actionItems: [
          "A/B test landing pages for better message match",
          "Review audience targeting settings — narrow or adjust demographics",
          "Check mobile experience and page load speed",
          "Simplify conversion forms and reduce friction",
        ],
      });
    }

    // Declining trend
    if (score.trend === "declining") {
      suggestions.push({
        id: nextSuggestionId(),
        campaignId: score.campaignId,
        campaignName: score.campaignName,
        priority: "high",
        category: "structure",
        title: `Declining performance trend on "${score.campaignName}"`,
        description: `Key metrics are trending downward compared to the prior period. Impressions changed ${score.trendDetails.impressionsChange.toFixed(1)}%, clicks ${score.trendDetails.clicksChange.toFixed(1)}%, conversions ${score.trendDetails.conversionsChange.toFixed(1)}%.`,
        estimatedImpact: "Reversing the decline could restore previous conversion levels",
        actionItems: [
          "Check for increased competition or new competitors",
          "Review auction insights for impression share changes",
          "Refresh ad copy that may be experiencing ad fatigue",
          "Evaluate if seasonality is a factor",
        ],
      });
    }

    // Low cost per conversion (good performer — suggestion to scale)
    if (
      score.metrics.costPerConversion > 0 &&
      score.metrics.costPerConversion < BENCHMARKS.costPerConversion.excellent &&
      campaign.status === "ENABLED"
    ) {
      suggestions.push({
        id: nextSuggestionId(),
        campaignId: score.campaignId,
        campaignName: score.campaignName,
        priority: "medium",
        category: "budget",
        title: `"${score.campaignName}" is a strong performer — consider scaling`,
        description: `This campaign has an excellent cost per conversion of $${score.metrics.costPerConversion.toFixed(2)} and is a candidate for increased investment.`,
        estimatedImpact: `Increasing budget by 20-30% could capture more conversions at efficient cost`,
        actionItems: [
          "Gradually increase daily budget (20% increments to avoid instability)",
          "Expand to similar keywords or audiences",
          "Create lookalike audiences based on converters",
          "Consider promoting to a dedicated campaign for more control",
        ],
      });
    }
  }

  // Account-level: overall structure suggestion
  if (campaigns.length > 10) {
    suggestions.push({
      id: nextSuggestionId(),
      campaignId: null,
      campaignName: null,
      priority: "low",
      category: "structure",
      title: `Account has ${campaigns.length} active campaigns — consider consolidation`,
      description: "Managing many campaigns can dilute budget and data. Consolidating similar campaigns can improve machine learning and reporting clarity.",
      estimatedImpact: "Better data density per campaign improves automated bidding performance",
      actionItems: [
        "Group campaigns by product/service line or funnel stage",
        "Merge campaigns with similar targeting and keywords",
        "Use ad groups for thematic segmentation within campaigns",
      ],
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return suggestions;
}

// ─── Main evaluation function ────────────────────────────────────────────────

export async function runEvaluation(
  request: EvaluationRequest
): Promise<EvaluationResult> {
  const config = getGoogleAdsConfig();
  if (!isConfigValid(config)) {
    throw new Error("Google Ads API credentials not configured");
  }

  // Fetch campaigns
  const campaigns = await fetchCampaigns(request.customerId, request.dateRange);

  // Filter to requested campaign IDs if specified
  const filteredCampaigns = request.campaignIds
    ? campaigns.filter((c) => request.campaignIds!.includes(c.id))
    : campaigns;

  // Calculate account summary
  const totalCost = filteredCampaigns.reduce((s, c) => s + c.cost, 0);
  const totalImpressions = filteredCampaigns.reduce(
    (s, c) => s + c.impressions,
    0
  );
  const totalClicks = filteredCampaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = filteredCampaigns.reduce(
    (s, c) => s + c.conversions,
    0
  );
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgConversionRate =
    totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalCost / totalClicks : 0;

  // Score each campaign
  const campaignScores: CampaignScore[] = [];

  for (const campaign of filteredCampaigns) {
    // Fetch daily performance for trend analysis
    const metrics = await fetchPerformanceMetrics(
      request.customerId,
      request.dateRange,
      campaign.id
    );

    // Split metrics into recent (last 15 days) and prior (15 days before that)
    const midpoint = Math.floor(metrics.length / 2);
    const recentMetrics = metrics.slice(midpoint);
    const priorMetrics = metrics.slice(0, midpoint);

    const { trend, details } = detectTrend(recentMetrics, priorMetrics);

    // Calculate cost per conversion
    const costPerConversion =
      campaign.conversions > 0 ? campaign.cost / campaign.conversions : 0;

    // Calculate individual scores
    const ctrScore = scoreMetric(campaign.ctr, BENCHMARKS.ctr, true);
    const convScore = scoreMetric(
      campaign.conversionRate,
      BENCHMARKS.conversionRate,
      true
    );
    const cpcScore = scoreMetric(campaign.cpc, BENCHMARKS.cpc, false);
    const cpcConvScore = scoreMetric(
      costPerConversion,
      BENCHMARKS.costPerConversion,
      false
    );

    // Trend bonus/penalty
    let trendBonus = 0;
    if (trend === "improving") trendBonus = 10;
    else if (trend === "declining") trendBonus = -10;

    const overallScore = Math.min(
      100,
      Math.max(0, ctrScore + convScore + cpcScore + cpcConvScore + trendBonus)
    );

    campaignScores.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      overallScore,
      metrics: {
        roi:
          campaign.cost > 0
            ? Math.round(
                ((campaign.conversions * 50 - campaign.cost) / campaign.cost) *
                  100
              ) / 100
            : 0, // rough ROI estimate (assuming $50 avg conversion value)
        costPerConversion,
        ctr: campaign.ctr,
        conversionRate: campaign.conversionRate,
        cpc: campaign.cpc,
      },
      trend,
      trendDetails: details,
      grade: gradeFromScore(overallScore),
    });
  }

  // Sort by score
  campaignScores.sort((a, b) => b.overallScore - a.overallScore);

  // Generate suggestions
  const suggestions = generateSuggestions(
    filteredCampaigns,
    campaignScores
  );

  // Overall account score
  const overallScore =
    campaignScores.length > 0
      ? Math.round(
          campaignScores.reduce((s, c) => s + c.overallScore, 0) /
            campaignScores.length
        )
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    dateRange: request.dateRange || {
      startDate: daysAgo(30),
      endDate: today(),
    },
    accountSummary: {
      totalCampaigns: filteredCampaigns.length,
      totalCost,
      totalImpressions,
      totalClicks,
      totalConversions,
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgConversionRate: Math.round(avgConversionRate * 100) / 100,
      avgCpc: Math.round(avgCpc * 100) / 100,
      overallScore,
      overallGrade: gradeFromScore(overallScore),
    },
    campaignScores,
    suggestions,
    topPerformers: campaignScores.slice(0, 3),
    underPerformers: campaignScores.slice(-3).reverse(),
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
