/**
 * Campaign Creator Module
 *
 * Learns from historical campaign data to draft new campaign configurations
 * including budgets, targeting, ad copy templates, and bidding strategies.
 */

import {
  type Campaign,
  type CampaignDetail,
  fetchCampaigns,
  fetchCampaignDetail,
  getGoogleAdsConfig,
  isConfigValid,
} from "./google-ads";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CampaignDraftRequest {
  customerId: string;
  /** Goal for the new campaign */
  goal: "conversions" | "traffic" | "brand_awareness" | "leads";
  /** Product or service to advertise */
  productName: string;
  /** Daily budget in dollars */
  dailyBudget: number;
  /** Target location (e.g., "United States", "New York") */
  targetLocation?: string;
  /** Target language */
  targetLanguage?: string;
  /** Landing page URL */
  landingPageUrl?: string;
  /** Optional: base on a specific existing campaign */
  baseCampaignId?: string;
}

export interface AdCopyTemplate {
  headlines: string[];
  descriptions: string[];
  displayUrlPath?: string;
}

export interface KeywordSuggestion {
  keyword: string;
  matchType: "broad" | "phrase" | "exact";
  estimatedCpc?: number;
  relevance: "high" | "medium" | "low";
}

export interface CampaignDraft {
  id: string;
  createdAt: string;
  request: CampaignDraftRequest;
  config: {
    name: string;
    type: string;
    biddingStrategy: string;
    dailyBudget: number;
    targetLocation: string;
    targetLanguage: string;
    startDate: string;
    endDate?: string;
  };
  adGroups: {
    name: string;
    keywords: KeywordSuggestion[];
    adCopy: AdCopyTemplate;
  }[];
  recommendations: string[];
  basedOn?: {
    campaignId: string;
    campaignName: string;
    metrics: {
      ctr: number;
      conversionRate: number;
      cpc: number;
    };
  };
}

// ─── Keyword extraction from product name ────────────────────────────────────

function extractKeywords(productName: string, goal: string): KeywordSuggestion[] {
  const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const keywords: KeywordSuggestion[] = [];

  // Core product keywords
  for (const word of words) {
    if (!["the", "and", "for", "with", "best", "top"].includes(word)) {
      keywords.push({ keyword: word, matchType: "broad", relevance: "high" });
    }
  }

  // Full product name as phrase and exact
  keywords.push({ keyword: productName.toLowerCase(), matchType: "phrase", relevance: "high" });
  keywords.push({ keyword: productName.toLowerCase(), matchType: "exact", relevance: "high" });

  // Goal-based modifiers
  const goalModifiers: Record<string, string[]> = {
    conversions: ["buy", "price", "deal", "discount", "order"],
    traffic: ["what is", "how to", "guide", "information", "learn"],
    brand_awareness: ["brand", "reviews", "best", "top", "compare"],
    leads: ["contact", "quote", "free consultation", "demo", "trial"],
  };

  const modifiers = goalModifiers[goal] || goalModifiers.conversions;
  for (const mod of modifiers.slice(0, 3)) {
    keywords.push({ keyword: `${mod} ${productName.toLowerCase()}`, matchType: "phrase", relevance: "medium" });
  }

  return keywords;
}

// ─── Ad copy generation ──────────────────────────────────────────────────────

function generateAdCopy(
  productName: string,
  goal: string,
  landingPageUrl?: string
): AdCopyTemplate {
  const headlines: string[] = [];
  const descriptions: string[] = [];

  // Headlines (max 30 chars each for responsive search ads)
  headlines.push(productName.substring(0, 30));
  headlines.push(`Best ${productName} Online`.substring(0, 30));

  if (goal === "conversions") {
    headlines.push("Shop Now - Save Big".substring(0, 30));
    headlines.push("Limited Time Offer".substring(0, 30));
    descriptions.push(`Get the best deals on ${productName}. Free shipping on orders over $50. Shop our collection today and save.`);
  } else if (goal === "leads") {
    headlines.push("Free Quote Today".substring(0, 30));
    headlines.push("Expert Consultation".substring(0, 30));
    descriptions.push(`Looking for ${productName}? Get a free consultation and custom quote. Trusted by thousands of customers.`);
  } else if (goal === "traffic") {
    headlines.push("Learn More Today".substring(0, 30));
    headlines.push("Complete Guide".substring(0, 30));
    descriptions.push(`Discover everything about ${productName}. Expert guides, reviews, and comparisons to help you make the right choice.`);
  } else {
    headlines.push("Trusted & Reliable".substring(0, 30));
    headlines.push("Quality Guaranteed".substring(0, 30));
    descriptions.push(`${productName} — trusted by thousands. Quality products, fast delivery, and excellent customer service.`);
  }

  descriptions.push(`Visit our website to learn more about ${productName}. Easy ordering, fast support, and satisfaction guaranteed.`);

  let displayUrlPath: string | undefined;
  if (landingPageUrl) {
    try {
      const url = new URL(landingPageUrl);
      const pathParts = url.pathname.split("/").filter(Boolean).slice(0, 2);
      displayUrlPath = pathParts.join("/");
    } catch {
      // invalid URL, skip
    }
  }

  return { headlines, descriptions, displayUrlPath };
}

// ─── Bidding strategy selection ──────────────────────────────────────────────

function selectBiddingStrategy(goal: string, hasConversionData: boolean): string {
  if (goal === "conversions" && hasConversionData) return "TARGET_CPA";
  if (goal === "conversions") return "MAXIMIZE_CONVERSIONS";
  if (goal === "leads") return "TARGET_CPA";
  if (goal === "traffic") return "MAXIMIZE_CLICKS";
  if (goal === "brand_awareness") return "TARGET_IMPRESSION_SHARE";
  return "MAXIMIZE_CONVERSIONS";
}

// ─── Main: create campaign draft ─────────────────────────────────────────────

export async function createCampaignDraft(
  request: CampaignDraftRequest
): Promise<CampaignDraft> {
  const config = getGoogleAdsConfig();
  if (!isConfigValid(config)) {
    throw new Error("Google Ads API credentials not configured");
  }

  // Learn from existing campaigns if available
  let existingCampaigns: Campaign[] = [];
  let baseCampaign: CampaignDetail | null = null;
  let hasConversionData = false;

  try {
    existingCampaigns = await fetchCampaigns(request.customerId);
    hasConversionData = existingCampaigns.some((c) => c.conversions > 0);

    if (request.baseCampaignId) {
      baseCampaign = await fetchCampaignDetail(
        request.customerId,
        request.baseCampaignId
      );
    }
  } catch {
    // API may not be configured yet; proceed with defaults
  }

  // Determine budget: use request value, but cap at 20% above average if base campaign exists
  let dailyBudget = request.dailyBudget;
  if (baseCampaign && baseCampaign.cost > 0) {
    const avgDailyCost = baseCampaign.cost / 30; // rough daily average
    const maxBudget = avgDailyCost * 1.2;
    if (dailyBudget > maxBudget) {
      dailyBudget = Math.round(maxBudget * 100) / 100;
    }
  }

  const campaignName = `${request.productName} - ${request.goal.charAt(0).toUpperCase() + request.goal.slice(1)}`;
  const biddingStrategy = selectBiddingStrategy(request.goal, hasConversionData);
  const keywords = extractKeywords(request.productName, request.goal);
  const adCopy = generateAdCopy(request.productName, request.goal, request.landingPageUrl);

  const today = new Date().toISOString().split("T")[0];

  const draft: CampaignDraft = {
    id: `draft-${Date.now()}`,
    createdAt: new Date().toISOString(),
    request,
    config: {
      name: campaignName,
      type: "SEARCH",
      biddingStrategy,
      dailyBudget,
      targetLocation: request.targetLocation || "United States",
      targetLanguage: request.targetLanguage || "English",
      startDate: today,
    },
    adGroups: [
      {
        name: `${request.productName} - Main`,
        keywords,
        adCopy,
      },
    ],
    recommendations: [],
    basedOn: baseCampaign
      ? {
          campaignId: baseCampaign.id,
          campaignName: baseCampaign.name,
          metrics: {
            ctr: baseCampaign.ctr,
            conversionRate: baseCampaign.conversionRate,
            cpc: baseCampaign.cpc,
          },
        }
      : undefined,
  };

  // Generate recommendations
  if (!request.landingPageUrl) {
    draft.recommendations.push(
      "Add a landing page URL to improve Quality Score and ad relevance."
    );
  }
  if (dailyBudget < 10) {
    draft.recommendations.push(
      "A daily budget below $10 may limit data collection. Consider increasing to at least $20-30 for meaningful results."
    );
  }
  if (existingCampaigns.length > 0 && !request.baseCampaignId) {
    draft.recommendations.push(
      `You have ${existingCampaigns.length} existing campaigns. Consider basing this campaign on a top performer for better initial setup.`
    );
  }
  if (biddingStrategy === "TARGET_CPA" && !hasConversionData) {
    draft.recommendations.push(
      "Target CPA bidding requires historical conversion data. Starting with Maximize Conversions instead."
    );
  }
  draft.recommendations.push(
    "After launching, monitor performance for 7-14 days before making budget or bid changes."
  );
  draft.recommendations.push(
    "Set up conversion tracking on your landing page to enable data-driven optimization."
  );

  return draft;
}
