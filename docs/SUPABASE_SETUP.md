# Optional Supabase setup

VenueTwin works without Supabase. Complete these steps only when you want email accounts and cloud project persistence.

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the SQL Editor and run `supabase/migrations/202609230001_initial_schema.sql`.
3. Open **Project Settings → API** and copy the project URL and anon/publishable key.
4. Create `.env.local` in the VenueTwin project:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_APP_URL=http://localhost:5173
```

5. Restart `npm run dev`.

The anon key is designed for browser use. Access is restricted by the Row Level Security policies in the migration. Never put a Supabase `service_role` key in a Vite environment variable or commit `.env.local`.

Uploaded floor-plan files remain local in this version. Cloud persistence stores the venue configuration JSON, not the source PDF or image.
