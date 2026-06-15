# Andre Boland — Fitness Dashboard

A personal cut + gym progress tracker. Data lives in Supabase so it syncs across devices and can be updated from Claude chat.

## How it works

```
Claude chat  →  writes to Supabase  →  this website reads from Supabase  →  live URL
```

The site auto-refreshes every 30 seconds, so updates made in chat appear without a manual reload.

## One-time setup

### 1. Supabase (already done)
Table `dashboard_state` created with a single row (`id = 'andre'`) holding all data as JSON.

### 2. Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://txbsmtieehpugosqkbsc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your rotated anon key
4. Click Deploy

That's it — you'll get a URL like `andre-dashboard.vercel.app`.

## Local development

```bash
npm install
cp .env.example .env.local   # then edit .env.local with your real key
npm run dev
```

## Updating data

Just chat with Claude. Claude writes to the same Supabase row, and the site reflects it.
