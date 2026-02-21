# agNBA GM Simulator

Mobile-first NBA GM simulator built with Next.js, Prisma, and PostgreSQL.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Prisma + PostgreSQL
- Zustand for SimCast playback state

## Setup

1. Install deps
   - `npm install`
2. Configure environment
   - Copy `.env.example` to `.env`
   - Set `DATABASE_URL` and `DIRECT_URL`
3. Generate Prisma client and migrate
   - `npm run db:generate`
   - `npm run db:migrate:dev -- --name init`
4. Seed league data
   - `npm run db:seed`
5. Start app
   - `npm run dev`

## Implemented Features

- Mobile-first dashboard with team summary and quick simulation
- Possession-based game simulation engine with fatigue and auto-subs
- Roster view with free-agent signing
- Trade machine with trade value + cap rule validation
- Standings page
- SimCast playback for completed games
- API routes:
  - `GET /api/league/standings`
  - `GET /api/team/[id]/roster`
  - `POST /api/sim/day`
  - `POST /api/gm/trade`
  - `POST /api/gm/sign`

## Notes

- Seed includes all 30 NBA teams plus free agents and a 170-day schedule.
- Season rollover is automatic when the final day is simulated.

## Vercel + Supabase Deployment

1. Create a Supabase project and copy two connection strings:
   - Pooler URL (transaction mode): for `DATABASE_URL`
   - Direct URL: for `DIRECT_URL`
   - Use the exact values from Supabase "Connect" and append `?pgbouncer=true&connection_limit=1` to the pooler URL if not already present.
2. In Vercel project settings, add env vars:
   - `DATABASE_URL` = Supabase pooler URL (include `pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` = Supabase direct URL
3. Run migrations manually from local/CI (recommended):
   - `npm run db:migrate:deploy`
4. In Vercel project settings, set Build Command:
   - `npm run build:vercel`
5. Seed production data once:
   - `npm run db:seed`
6. Deploy to Vercel:
   - `vercel --prod` (CLI) or push to your production branch.

### Recommended env scoping in Vercel

- Use separate Supabase projects (or databases) for `Preview` and `Production`.
- Do not point preview deployments at your production database.
- This repo defaults to no migrations during Vercel build. Keep schema changes synced by running `npm run db:migrate:deploy` from local/CI when you add migrations.
