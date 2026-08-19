'use client';

import { useEffect, useState, useCallback } from 'react';

interface KeywordSuggestion {
  keyword: string;
  matchType: string;
  relevance: string;
}

interface AdCopyTemplate {
  headlines: string[];
  descriptions: string[];
  displayUrlPath?: string;
}

interface CampaignDraft {
  id: string;
  createdAt: string;
  config: {
    name: string;
    type: string;
    biddingStrategy: string;
    dailyBudget: number;
    targetLocation: string;
    targetLanguage: string;
    startDate: string;
  };
  adGroups: {
    name: string;
    keywords: KeywordSuggestion[];
    adCopy: AdCopyTemplate;
  }[];
  recommendations: string[];
  basedOn?: { campaignId: string; campaignName: string; metrics: { ctr: number; conversionRate: number; cpc: number } };
}

interface ExistingCampaign {
  id: string;
  name: string;
}

export default function CreateCampaignPage() {
  const [productName, setProductName] = useState('');
  const [goal, setGoal] = useState<string>('conversions');
  const [dailyBudget, setDailyBudget] = useState<number>(50);
  const [targetLocation, setTargetLocation] = useState('United States');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [baseCampaignId, setBaseCampaignId] = useState('');
  const [existingCampaigns, setExistingCampaigns] = useState<ExistingCampaign[]>([]);

  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch('/api/google-ads/campaigns');
        const data = await res.json();
        if (data.campaigns) setExistingCampaigns(data.campaigns);
      } catch { /* ignore */ }
    }
    fetchCampaigns();
  }, []);

  const handleCreate = useCallback(async () => {
    if (!productName.trim()) { setError('Product name is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/google-ads/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          goal,
          dailyBudget,
          targetLocation: targetLocation.trim() || undefined,
          landingPageUrl: landingPageUrl.trim() || undefined,
          baseCampaignId: baseCampaignId || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.message || data.error);
      else setDraft(data.draft);
    } catch {
      setError('Failed to create campaign draft');
    } finally {
      setLoading(false);
    }
  }, [productName, goal, dailyBudget, targetLocation, landingPageUrl, baseCampaignId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
          <p className="mt-1 text-sm text-gray-600">
            Draft a new campaign based on your product and goals. The system learns from historical data.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Campaign Settings</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product / Service Name *</label>
                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Wireless Bluetooth Headphones"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Goal *</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="conversions">Conversions / Sales</option>
                  <option value="leads">Lead Generation</option>
                  <option value="traffic">Website Traffic</option>
                  <option value="brand_awareness">Brand Awareness</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget (USD) *</label>
                <input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))}
                  min={1} step={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Location</label>
                <input type="text" value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="United States"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landing Page URL</label>
                <input type="url" value={landingPageUrl} onChange={(e) => setLandingPageUrl(e.target.value)}
                  placeholder="https://example.com/product"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              {existingCampaigns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base on Existing Campaign (optional)</label>
                  <select value={baseCampaignId} onChange={(e) => setBaseCampaignId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">None</option>
                    {existingCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
              )}

              <button onClick={handleCreate} disabled={loading || !productName.trim()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'Generating Draft...' : 'Generate Campaign Draft'}
              </button>
            </div>
          </div>

          {/* Draft Preview */}
          <div className="lg:col-span-2">
            {!draft && !loading && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Draft Yet</h3>
                <p className="text-gray-600">Fill in the form and click &quot;Generate Campaign Draft&quot; to get started.</p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing historical data and generating your campaign draft...</p>
              </div>
            )}

            {draft && (
              <div className="space-y-6">
                {/* Config summary */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Configuration</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{draft.config.name}</span></div>
                    <div><span className="text-gray-500">Type:</span> <span className="font-medium">{draft.config.type}</span></div>
                    <div><span className="text-gray-500">Bidding:</span> <span className="font-medium">{draft.config.biddingStrategy}</span></div>
                    <div><span className="text-gray-500">Daily Budget:</span> <span className="font-medium">${draft.config.dailyBudget}</span></div>
                    <div><span className="text-gray-500">Location:</span> <span className="font-medium">{draft.config.targetLocation}</span></div>
                    <div><span className="text-gray-500">Language:</span> <span className="font-medium">{draft.config.targetLanguage}</span></div>
                    <div><span className="text-gray-500">Start Date:</span> <span className="font-medium">{draft.config.startDate}</span></div>
                  </div>
                  {draft.basedOn && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                      <span className="text-blue-800 font-medium">Based on:</span> <span className="text-blue-700">{draft.basedOn.campaignName}</span>
                      <span className="text-blue-600 ml-2">(CTR: {draft.basedOn.metrics.ctr}%, Conv: {draft.basedOn.metrics.conversionRate}%)</span>
                    </div>
                  )}
                </div>

                {/* Ad Groups */}
                {draft.adGroups.map((ag, i) => (
                  <div key={i} className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Ad Group: {ag.name}</h3>

                    {/* Keywords */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Keyword Suggestions</h4>
                      <div className="flex flex-wrap gap-2">
                        {ag.keywords.map((kw, j) => (
                          <span key={j} className={`px-2 py-1 text-xs rounded-full ${
                            kw.relevance === 'high' ? 'bg-green-100 text-green-800' :
                            kw.relevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {kw.keyword} <span className="opacity-60">[{kw.matchType}]</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Ad Copy */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Ad Copy Template</h4>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-gray-500">Headlines:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {ag.adCopy.headlines.map((h, j) => (
                              <span key={j} className="bg-blue-50 text-blue-800 px-2 py-1 text-xs rounded">{h}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Descriptions:</span>
                          {ag.adCopy.descriptions.map((d, j) => (
                            <p key={j} className="text-sm text-gray-700 mt-1">{d}</p>
                          ))}
                        </div>
                        {ag.adCopy.displayUrlPath && (
                          <div className="text-xs text-gray-500">
                            Display URL: example.com/<span className="text-blue-600">{ag.adCopy.displayUrlPath}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Recommendations */}
                {draft.recommendations.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                    <h3 className="text-md font-semibold text-amber-800 mb-3">Recommendations</h3>
                    <ul className="space-y-2">
                      {draft.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
