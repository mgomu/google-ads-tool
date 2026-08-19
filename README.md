# Google Ads Management Tool

A Next.js application for managing Google Ads campaigns, monitoring performance, and optimizing advertising spend.

## Features

- 📊 **Campaign Dashboard** - View all campaigns with key metrics
- 💰 **Budget Management** - Track spending and optimize budgets
- 📈 **Performance Reports** - Detailed analytics and reporting
- 🔐 **Secure API Integration** - OAuth2 authentication with Google Ads API
- 🧠 **Performance Evaluation** - Campaign scores, trends, and prioritized suggestions
- ✨ **Campaign Drafts** - New campaign recommendations learned from historical performance

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Ads API credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/google-ads-tool.git
cd google-ads-tool
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your Google Ads API credentials:
```env
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your_login_customer_id
GOOGLE_ADS_CUSTOMER_ID=your_customer_id
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
google-ads-tool/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── google-ads/
│   │   │       └── campaigns/
│   │   │           └── route.ts    # API endpoint for campaigns
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Dashboard page
│   │   ├── campaigns/
│   │   │   └── page.tsx           # Campaigns page
│   │   ├── reports/
│   │   │   └── page.tsx           # Reports page
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page
│   ├── components/
│   │   └── CampaignTable.tsx     # Campaign table component
│   └── lib/
│       └── google-ads.ts         # Google Ads API client
├── public/
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

- `GET /api/google-ads/campaigns` - List all campaigns
- `GET /api/google-ads/campaigns/:id` - Campaign detail with ad groups
- `GET /api/google-ads/performance` - Daily performance metrics
- `GET /api/google-ads/evaluate` - Evaluate performance and generate suggestions
- `POST /api/google-ads/campaigns/create` - Generate a campaign draft from historical data

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all Google Ads API credentials

### Option 2: Deploy via Git Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Configure environment variables
5. Deploy

### Environment Variables for Production

Set these in your Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 client ID from Google Cloud Console |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth2 refresh token |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Login customer ID (optional) |
| `GOOGLE_ADS_CUSTOMER_ID` | Your Google Ads customer ID |

## Google Ads API Setup

1. Create a Google Cloud project
2. Enable the Google Ads API
3. Create OAuth2 credentials
4. Get a developer token from Google Ads
5. Set up OAuth2 consent screen

For detailed instructions, see [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start).

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## License

MIT
