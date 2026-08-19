import CampaignTable from '@/components/CampaignTable';

export default function CampaignsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage and monitor your Google Ads campaigns.
              </p>
            </div>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              disabled
              title="Coming soon - Create new campaign"
            >
              + New Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" disabled>
                <option>All Statuses</option>
                <option>Enabled</option>
                <option>Paused</option>
                <option>Removed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search campaigns..."
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Campaign Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Campaigns</h2>
          </div>
          <div className="p-6">
            <CampaignTable />
          </div>
        </div>
      </div>
    </div>
  );
}
