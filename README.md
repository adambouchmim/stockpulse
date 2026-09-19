# StockPulse

StockPulse is a personalized weekly market and portfolio news digest application. It monitors watchlist stocks, summarizes high-impact market news using AI, and presents concise digests for investors.

## Features

- **Personalized Watchlist**: Track key stocks, ETFs, and market indices.
- **AI-Powered Digest**: Aggregates and synthesizes relevant financial news and sentiment.
- **Authentication**: Secure user authentication and session management powered by Supabase.
- **Modern UI / UX**: Built with React, Tailwind CSS, shadcn/ui components, Lucide icons, and light/dark theme support.

## Tech Stack

- **Framework**: [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling**: [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Backend / Database**: [Supabase](https://supabase.com/)
- **State Management & Queries**: [TanStack Query](https://tanstack.com/query/latest)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/adambouchmim/stockpulse.git
cd stockpulse
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file in the root directory (or copy from `.env.example`) and configure your Supabase keys:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

4. Run the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

6. Run tests:
```bash
npm test
```
