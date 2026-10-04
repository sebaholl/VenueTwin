# Optional Supabase setup

VenueTwin works without Supabase. Complete these steps only when you want email accounts and cloud project persistence.

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the SQL Editor and run the migrations in filename order:
   - `supabase/migrations/202609230001_initial_schema.sql`
   - `supabase/migrations/202610040001_public_project_sharing.sql`

   The first migration grants project-table access only to authenticated owners. The sharing migration exposes a restricted database function that returns one explicitly shared project for an exact random token; it does not grant anonymous access to the projects table.
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

## Public preview security

The **Share** action saves the latest venue configuration and creates a random UUID link. Sharing can be disabled at any time. Public visitors receive only the project name, venue configuration and last update time through `get_shared_project`; account details and other projects are never returned.
