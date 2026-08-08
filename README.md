# Coco – CodeCoogs Member Platform

A modern [Next.js](https://nextjs.org) application for managing CodeCoogs club operations, including member points, events, opportunities, finances, and team administration.

## Overview

Coco is a comprehensive member management and engagement platform for CodeCoogs. It provides:

- **Member Dashboard** – Points tracking, leaderboard, and personal activity history
- **Event Management** – Browse, sign up for, and manage club events
- **Opportunities** – Discover and apply for career/learning opportunities (with admin import)
- **Financial Dashboard** – Membership purchases via Stripe, financial tracking, and analytics
- **Point System** – Track member contributions with an academic-year scoped point system
- **Team Management** – Create, manage, and deactivate teams with role-based permissions
- **Officer Tools** – Admin panels for managing points, members, permissions, and team operations
- **Authentication** – Secure Supabase-based auth with individual and team login flows

## Tech Stack

- **Framework** – [Next.js 16](https://nextjs.org) with React 19 (App Router)
- **Styling** – [Tailwind CSS 4](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com)
- **Database** – [Supabase](https://supabase.com) (PostgreSQL) with auth helpers
- **UI Components** – [Base UI](https://base-ui.com), [Lucide icons](https://lucide.dev), [dnd-kit](https://docs.dnd-kit.com) for drag-and-drop
- **Payments** – [Stripe](https://stripe.com) for membership subscriptions
- **Deployment** – [Vercel](https://vercel.com) (with fallback to Vercel URL environment variable)

## Getting Started

### Prerequisites

- Node.js 22+ (or your project's specified version)
- npm, yarn, pnpm, or bun
- Supabase project with database migrations applied
- Stripe account for payment processing (optional for development)

### Installation

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd coco-app
npm install
```

2. Set up environment variables in `.env.local`:

```env
# CodeCoogs API
NEXT_PUBLIC_CODECOOGS_API_URL=https://api.codecoogs.com/v1

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Stripe (optional)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-key>
STRIPE_SECRET_KEY=<your-stripe-secret>
STRIPE_WEBHOOK_SECRET=<your-webhook-secret>

# Optional: Override CodeCoogs API URL for server-side requests
CODECOOGS_API_URL=https://api.codecoogs.com/v1
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will automatically reload as you make changes.

### Building & Production

```bash
npm run build
npm start
```

### Code Quality

```bash
npm run lint      # Run ESLint
npm run typecheck # TypeScript type checking
```

## Project Structure

```
app/
├── api/              # Route handlers (Stripe webhooks, CodeCoogs proxy, etc.)
├── auth/             # Authentication pages (sign-in, sign-up, callbacks)
├── components/       # Shared UI components and modals
├── contexts/         # React context providers
├── dashboard/        # Main app features (members, officers, finances, etc.)
├── login/            # Login page
├── signup/           # Signup page
└── page.tsx          # Landing/home page
```

## Key Features

### Member Experience
- View personal points and activity history
- Browse and sign up for events and opportunities
- Purchase membership plans via Stripe Checkout
- View team information and participate in team activities

### Officer & Admin Tools
- Manage member points and point history
- Create, edit, and delete events and opportunities
- Import opportunities in bulk via file upload
- Manage team memberships and permissions
- View financial analytics and membership data
- Manage academic periods and team deactivations

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on getting started, coding standards, and submitting changes.

## Deployment

The app is deployed on [Vercel](https://vercel.com). The `main` branch auto-deploys to production.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
