# Supabase setup

## 1. Create the project
1. Go to https://supabase.com and sign up (GitHub login is fine).
2. **New project.** Name it `binthere`, pick a region near you, and let it
   generate a database password — save it in your password manager. You will not
   need it for the app, only for direct database access later.
3. Wait about two minutes for it to provision.

## 2. Run the migrations
Open **SQL Editor** in the left sidebar and run these three files in order,
pasting the contents of each and pressing Run:

1. `migrations/0001_schema.sql` — tables, indexes, the unique bin name rule
2. `migrations/0002_functions.sql` — permission helpers, invites, soft delete
3. `migrations/0003_policies.sql` — row level security

Each should report success with no rows. If one errors partway, fix and re-run
that file: they are written to be safely re-runnable, except that `create policy`
in 0003 will complain if a policy already exists — drop it or reset and re-run.

## 3. Create the master account
1. **Authentication → Users → Add user → Create new user**, with your email and a
   password. Check "Auto Confirm User" so you can log in immediately.
2. Back in the SQL editor, create the workspace and the owner membership. This
   looks your account up by email, so there is no UUID to copy by hand:

```sql
-- Change the email and the workspace name to suit.
with u as (
  select id from auth.users where email = 'you@example.com'
), w as (
  insert into workspaces (owner_id, name)
  select id, 'Our Home' from u
  returning id, owner_id
)
insert into memberships (workspace_id, user_id, role, can_delete_bins)
select w.id, w.owner_id, 'owner', true from w
returning workspace_id;
```

It should return one row. If it returns none, the email did not match a user —
check the spelling against the Users list.

(After the app is built, `create_workspace()` does both in one call. This manual
step is only for bootstrapping the very first account.)

## 4. Auth settings
Under **Authentication → Sign In / Providers**:
- Leave **Email** enabled.
- Turn **Confirm email** off while developing so test accounts work instantly.
  Turn it back on before real use.
- Sign ups may stay enabled. An account with no membership row can read nothing
  anywhere in the app — row level security returns zero rows for them.

Under **Authentication → URL Configuration**, once deployed, set the Site URL to
your Netlify domain so password reset and invite redirects come back correctly.

## 5. Grab the keys
**Project Settings → API**. Copy the Project URL and the `anon` public key into
the React app's `.env.local` later:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

The `anon` key is safe in the browser — it is the row level security policies,
not the key, that protect the data. Never put the `service_role` key in the app.

## 6. Smoke test the permissions
Worth doing before writing any React, because a mistake here is invisible from
the UI. In the SQL editor:

```sql
-- Create a bin in your workspace
insert into containers (workspace_id, name) values ('WORKSPACE-ID', 'Garage');

-- This second one must fail with error 23505 (unique violation)
insert into containers (workspace_id, name) values ('WORKSPACE-ID', '  garage ');
```

Then add a second test user in the dashboard, invite them as `read`, redeem the
invite, and confirm from that account that a `select` on `containers` returns
rows but an `update` is rejected.

Note: the SQL editor runs as a superuser and bypasses row level security, so
policy checks have to be tested through the API with a real logged-in user, not
from this editor.
