import CampaignTable from '@/components/CampaignTable';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of your Google Ads campaigns and performance metrics.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Campaigns</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">--</div>
            <div className="mt-1 text-xs text-gray-500">Configure API to view</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Impressions</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">--</div>
            <div className="mt-1 text-xs text-gray-500">Configure API to view</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Clicks</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">--</div>
            <div className="mt-1 text-xs text-gray-500">Configure API to view</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Conversions</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">--</div>
            <div className="mt-1 text-xs text-gray-500">Configure API to view</div>
          </div>
        </div>

        {/* Campaign Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Campaigns</h2>
          </div>
          <div className="p-6">
            <CampaignTable />
          </div>
        </div>
      </div>
    </div>
  );
}
