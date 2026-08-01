# BinThere

A private web app that puts a QR sticker on every storage bin. Scan a sticker,
see what is inside, and edit the contents if you have permission.

The QR code holds a URL, not the data, so a bin's contents can change without
reprinting the sticker.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the two Supabase values
npm run dev
```

To test a real phone scan against your dev machine, run `npm run dev -- --host`
and use the network URL it prints.

## Database

The schema lives in `supabase/migrations/`, applied in numeric order through the
Supabase SQL editor. See `supabase/SETUP.md` for first-time setup.

Permissions are enforced by Postgres row level security, not by the UI:

| Role | Bins and items |
| --- | --- |
| `owner` | Everything, plus invites, roles, and the trash |
| `write` | View and edit; may delete whole bins only with `can_delete_bins` |
| `read` | View only |

Nothing is hard deleted. `deleted_at` is not writable through the API, so
removal goes through `soft_delete_bin()` / `soft_delete_item()`, which check
permission first. Deleted rows can be restored for 30 days.

## Deploying

Netlify builds from `netlify.toml`. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` in the Netlify dashboard under Site
configuration -> Environment variables.

See `PLAN.md` for the full design.
