# CreatorOS / CreatorCRM

CreatorOS is a full-stack SaaS app for creators to manage brand deals, content, income, and rate cards.

## Current Stack

- Frontend: React, Vite, Tailwind CSS, Recharts
- Backend: Node.js, Express
- Database: Supabase Postgres through `pg`
- Auth: Supabase Auth with email/password and Google OAuth

## Local Development

### Backend

```bash
cd server
npm install
npm start
```

Required backend environment variables:

```text
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://creatorcrm.online,https://www.creatorcrm.online,https://app.creatorcrm.online
SESSION_TIMEOUT_MS=900000
```

Optional:

```text
DB_SSL_REJECT_UNAUTHORIZED=false
```

Use the optional SSL override only for local troubleshooting. Production should verify database TLS certificates.

### Frontend

```bash
cd client
npm install
npm run dev
```

Required frontend environment variables:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_APP_URL=https://creatorcrm.online
VITE_API_URL=https://your-backend.onrender.com/api
```

Only `VITE_` variables are exposed to the browser. Never put service-role keys, database URLs, or backend secrets in frontend env vars.

## Security Notes

- Authentication is handled by Supabase Auth.
- The backend verifies Supabase access tokens before serving user data.
- API queries are parameterized.
- API writes perform server-side validation.
- CORS should be restricted with `ALLOWED_ORIGINS` in production.
- The frontend includes security headers in `client/public/_headers`.
- `.env`, database files, build output, and `node_modules` must stay untracked.

## Deployment Checklist

- Set all required Render environment variables.
- Enable Supabase email verification.
- Configure Supabase redirect URLs:
  - `https://creatorcrm.online/**`
  - `https://www.creatorcrm.online/**`
  - `https://app.creatorcrm.online/**`
  - your Render frontend URL if still used
- Keep Supabase service-role keys out of the frontend.
- Enable daily database backups.
- Put Cloudflare or equivalent WAF/rate limiting in front of public traffic before running ads.
- Re-run:

```bash
npm audit --omit=dev
npm run build
```

## Main Features

- Dashboard
- Deals CRM
- Content calendar
- Income tracker
- Rate card builder
