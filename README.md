# CreatorOS - Creator Economy Micro-SaaS

A full-stack SaaS application for content creators to manage their business operations.

## Features

- **Dashboard** - Overview with income trends, deal pipeline, and quick actions
- **Deals CRM** - Kanban-style pipeline management for brand partnerships
- **Content Calendar** - List and calendar views for content planning across platforms
- **Income Tracker** - Revenue tracking with category breakdown and analytics
- **Rate Card Builder** - Create and share professional media kits

## Tech Stack

- **Frontend:** React 19, Tailwind CSS, Vite, Recharts
- **Backend:** Node.js, Express, SQLite
- **Auth:** JWT-based authentication

## Getting Started

### 1. Start the Server

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3001`

### 2. Start the Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:3000`

### 3. Default Login

Register a new account at `/login` to get started.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| GET | /api/dashboard | Dashboard stats |
| GET | /api/deals | List deals |
| POST | /api/deals | Create deal |
| PUT | /api/deals/:id | Update deal |
| DELETE | /api/deals/:id | Delete deal |
| GET | /api/content | List content |
| POST | /api/content | Create content |
| GET | /api/income | List income |
| POST | /api/income | Log income |
| GET | /api/rate-cards | List rate cards |
| POST | /api/rate-cards | Create rate card |

## Project Structure

```
creator-os/
├── server/
│   ├── server.js          # Main Express app
│   ├── middleware/
│   │   └── auth.js        # JWT auth middleware
│   ├── database/
│   │   └── db.js          # SQLite setup
│   └── .env
└── client/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Deals.jsx
    │   │   ├── Content.jsx
    │   │   ├── Income.jsx
    │   │   ├── RateCard.jsx
    │   │   └── Login.jsx
    │   ├── components/
    │   │   └── Layout.jsx
    │   ├── hooks/
    │   │   └── useAuth.js
    │   ├── lib/
    │   │   └── utils.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

## Deployment

### Backend
- Deploy to Railway, Render, or Heroku
- Switch SQLite to PostgreSQL for production
- Set `JWT_SECRET` environment variable

### Frontend
- Build: `npm run build`
- Deploy to Vercel, Netlify, or Cloudflare Pages
- Update API base URL in `src/lib/utils.js`

## License

MIT
