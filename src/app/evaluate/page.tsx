'use client';

import { useEffect, useState, useCallback } from 'react';

interface CampaignScore {
  campaignId: string;
  campaignName: string;
  overallScore: number;
  metrics: { roi: number; costPerConversion: number; ctr: number; conversionRate: number; cpc: number };
  trend: 'improving' | 'declining' | 'stable';
  trendDetails: { impressionsChange: number; clicksChange: number; conversionsChange: number; costChange: number };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface Suggestion {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  estimatedImpact: string;
  actionItems: string[];
}

interface EvaluationResult {
  accountSummary: {
    totalCampaigns: number; totalCost: number; totalImpressions: number;
    totalClicks: number; totalConversions: number; avgCtr: number;
    avgConversionRate: number; avgCpc: number; overallScore: number; overallGrade: string;
  };
  campaignScores: CampaignScore[];
  suggestions: Suggestion[];
  topPerformers: CampaignScore[];
  underPerformers: CampaignScore[];
  dateRange: { startDate: string; endDate: string };
}

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-green-600 bg-green-50';
  if (grade === 'B') return 'text-blue-600 bg-blue-50';
  if (grade === 'C') return 'text-yellow-600 bg-yellow-50';
  if (grade === 'D') return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

function trendIcon(trend: string): string {
  if (trend === 'improving') return '↑';
  if (trend === 'declining') return '↓';
  return '→';
}

function trendColor(trend: string): string {
  if (trend === 'improving') return 'text-green-600';
  if (trend === 'declining') return 'text-red-600';
  return 'text-gray-500';
}

function priorityBadge(p: string): string {
  if (p === 'high') return 'bg-red-100 text-red-800';
  if (p === 'medium') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function EvaluatePage() {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const fetchEvaluation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/google-ads/evaluate');
      const data = await res.json();
      if (data.error) {
        setError(data.message || data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError('Failed to run evaluation. Is the API configured?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer the initial request so the effect does not synchronously update state.
    const timer = window.setTimeout(() => { void fetchEvaluation(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchEvaluation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaign Evaluation</h1>
            <p className="mt-1 text-sm text-gray-600">Performance analysis, trends, and improvement suggestions.</p>
          </div>
          <button onClick={fetchEvaluation} disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing campaign performance...</p>
          </div>
        )}

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-yellow-800 font-medium">Configuration Required</h3>
            <p className="text-yellow-700 mt-1">{error}</p>
            <p className="text-yellow-600 text-sm mt-2">Configure your Google Ads credentials in .env.local first.</p>
          </div>
        )}

        {result && (
          <>
            {/* Account Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Overall Grade</div>
                <div className={`text-3xl font-bold mt-1 ${gradeColor(result.accountSummary.overallGrade).split(' ')[0]}`}>
                  {result.accountSummary.overallGrade}
                </div>
                <div className="text-xs text-gray-400">Score: {result.accountSummary.overallScore}/100</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Campaigns</div>
                <div className="text-2xl font-bold mt-1">{result.accountSummary.totalCampaigns}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Total Spend</div>
                <div className="text-2xl font-bold mt-1">{formatCurrency(result.accountSummary.totalCost)}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Avg CTR</div>
                <div className="text-2xl font-bold mt-1">{result.accountSummary.avgCtr}%</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Avg Conv. Rate</div>
                <div className="text-2xl font-bold mt-1">{result.accountSummary.avgConversionRate}%</div>
              </div>
            </div>

            {/* Campaign Scores */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Campaign Scores</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conv. Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost/Conv</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.campaignScores.map((cs) => (
                      <tr key={cs.campaignId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{cs.campaignName}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-sm font-bold rounded ${gradeColor(cs.grade)}`}>{cs.grade}</span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${cs.overallScore}%` }}></div>
                            </div>
                            <span className="text-gray-600">{cs.overallScore}</span>
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-sm font-medium ${trendColor(cs.trend)}`}>
                          {trendIcon(cs.trend)} {cs.trend}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{cs.metrics.ctr.toFixed(2)}%</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{cs.metrics.conversionRate.toFixed(2)}%</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(cs.metrics.cpc)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {cs.metrics.costPerConversion > 0 ? formatCurrency(cs.metrics.costPerConversion) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Improvement Suggestions */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Improvement Suggestions ({result.suggestions.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {result.suggestions.map((s) => (
                  <div key={s.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${priorityBadge(s.priority)}`}>
                            {s.priority}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">{s.category}</span>
                          {s.campaignName && <span className="text-xs text-gray-400">• {s.campaignName}</span>}
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">{s.title}</h3>
                      </div>
                      <span className="text-gray-400 ml-4">{expandedSuggestion === s.id ? '−' : '+'}</span>
                    </div>
                    {expandedSuggestion === s.id && (
                      <div className="mt-3 text-sm text-gray-600">
                        <p className="mb-2">{s.description}</p>
                        <p className="mb-2 text-blue-600 font-medium">Estimated Impact: {s.estimatedImpact}</p>
                        <div className="mt-2">
                          <p className="font-medium text-gray-700 mb-1">Action Items:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {s.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
