# BinThere — Development Plan

BinThere is a private web app that generates QR code stickers for physical storage
containers.

## Goal
A private web app that generates QR code stickers for physical storage containers.
When a sticker is scanned, a logged in user sees the list of items stored in that
container and can add, edit, or delete items and containers, depending on the
permission they were granted.

## Users and sharing model
Every account belongs to a **workspace**. A workspace has exactly one **master
account** (the owner) who created it. The master account can invite other people
into the workspace and choose what they are allowed to do.

| Role | Can do |
| --- | --- |
| `owner` (master) | Everything: view, add, edit, and delete bins and items, invite and remove members, change member roles, restore deleted bins, delete the workspace |
| `write` | View bins and items, add, edit, and delete items, create and rename bins. Deleting a whole bin requires the extra `can_delete_bins` permission described below |
| `read` | Scan a sticker and view the bin's contents. No editing of any kind |

Rules:
- Only the master account can send invites or change roles. A `write` member
  cannot invite anyone.
- Deleting an entire bin is gated separately from ordinary editing, because it
  cascades to every item inside it and orphans a sticker that is already stuck to
  a physical tote. See "Deleting and restoring" below.
- Removing a member or lowering their role takes effect immediately, because
  permissions are enforced by the database, not just the UI.
- A person can be a member of more than one workspace (for example, their own
  plus one they were invited to). The app shows a workspace switcher only when a
  user belongs to more than one.

## Core idea: the QR code holds a URL, not the data
The QR code encodes a URL such as `https://binthere.netlify.app/box/a1b2c3`.
The item data lives in the database, not in the code itself. Scanning opens that
URL, the app reads the container id from the URL, then fetches and displays that
container's items. This means container contents can change at any time without
reprinting the sticker.

The URL uses the container's **id**, never its name, so renaming a bin never
invalidates a sticker that is already printed and stuck on a tote.

## Scan flow
1. Scan the sticker. The phone opens `https://binthere.netlify.app/box/a1b2c3`.
2. The app checks whether the user is logged in.
   - Not logged in: show the login screen, then return to the box automatically.
   - Logged in and a member of that bin's workspace: show the item list. Edit and
     delete controls appear only for `owner` and `write` members.
   - Logged in but not a member: show a plain "you do not have access to this
     bin" screen. The database returns no rows regardless of what the UI does.
3. The session is saved on the device, so after the first login the user usually
   stays logged in.

## Recommended stack (all free tier, no server to maintain)
| Piece | Choice | Why |
| --- | --- | --- |
| Frontend | React with Vite | Requested framework, standard fast setup |
| Hosting | Netlify | Free, connects to GitHub, auto deploys |
| Database | Supabase (PostgreSQL) | Free, real SQL, no backend to run |
| Auth | Supabase Auth | Email and password login |
| Permissions | Postgres Row Level Security | Roles enforced at the data layer |
| QR rendering | qrcode.react | Draws the printable QR code in the browser |
| Routing | react-router-dom | Handles /box/:id, /invite/:token, and login redirects |
| Styling | Tailwind CSS | Utility first styling for a modern, consistent, responsive UI |

Estimated cost: zero on free tiers at this scale.

## Data model
```
auth.users    managed by Supabase Auth (every account, master and invited)
workspaces    id | owner_id -> auth.users | name | created_at
memberships   workspace_id | user_id | role ('owner'|'write'|'read')
              | can_delete_bins boolean default false | created_at
              primary key (workspace_id, user_id)
invites       id | workspace_id | email | role | can_delete_bins | token | status
              | expires_at | invited_by | created_at
containers    id | short_id | workspace_id | name | created_by | created_at
              | deleted_at | deleted_by
items         id | container_id | name | quantity | notes | created_at | updated_at
              | deleted_at | deleted_by
```

The workspace owner also gets a row in `memberships` with role `owner`, so every
permission check can read from one table instead of special casing the owner.

## Unique bin names
Bin names are unique **per workspace**, case insensitive, and trimmed. Two
different households can both have a bin called "Christmas"; one household cannot
have two of them.

```sql
alter table containers
  add constraint containers_name_not_blank check (length(btrim(name)) > 0);

create unique index containers_workspace_name_key
  on containers (workspace_id, lower(btrim(name)))
  where deleted_at is null;
```

The `where deleted_at is null` clause matters: a deleted bin should release its
name so it can be reused. The consequence is that restoring a deleted bin can
collide with a newer bin of the same name — if that happens, the restore dialog
asks for a new name before bringing it back.

Handling in the app:
- The database constraint is the source of truth. On insert or rename, catch
  Postgres error `23505` and show "A bin named 'Christmas' already exists."
- The create and rename forms also check the loaded bin list as you type so the
  user sees the conflict before submitting. This is a convenience only; two
  people submitting the same name at the same moment are still caught by the index.
- Renaming follows the same rule, and is always safe for printed stickers because
  QR codes encode the id.

## Invites and permissions

### Invite flow (link based, no email service needed)
1. On the Members screen the master enters an email address and picks `read` or
   `write`. If `write` is chosen, an "allow deleting whole bins" checkbox appears,
   off by default. The app inserts a row into `invites` with a random token and a
   seven day expiry. Row Level Security allows this insert only for the workspace
   owner.
2. The app shows a copyable link, `https://binthere.netlify.app/invite/<token>`,
   which the master sends however they like (text, email, in person).
3. The invitee opens the link. If they are not signed in, they sign up or log in
   and are returned to the invite page automatically.
4. The app calls a `redeem_invite(token)` database function that runs with
   elevated rights. It verifies the invite is pending, unexpired, and addressed to
   the signed in user's email, then creates the `memberships` row with the role
   from the invite and marks the invite accepted.
5. The master can revoke a pending invite, change a member's role, or remove a
   member at any time from the Members screen.

A brand new account that has not redeemed an invite has zero memberships, so Row
Level Security returns nothing anywhere in the app. It sees an empty "ask the
owner for an invite" state. Open sign ups are therefore harmless, but if you want
sign ups disabled entirely, the alternative is a Supabase Edge Function holding
the service role key that calls `auth.admin.inviteUserByEmail` — more moving
parts, same end result.

### Enforcing roles in the database
Two small `security definer` helper functions keep the policies readable and
avoid recursive policy checks on `memberships`:

```sql
create function has_access(w uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w and m.user_id = auth.uid()
  );
$$;

create function can_write(w uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w and m.user_id = auth.uid()
      and m.role in ('owner', 'write')
  );
$$;

create function can_delete_bin(w uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w and m.user_id = auth.uid()
      and (m.role = 'owner' or (m.role = 'write' and m.can_delete_bins))
  );
$$;
```

Policy summary, with Row Level Security enabled on every table:

| Table | Select | Insert / Update | Delete |
| --- | --- | --- | --- |
| `workspaces` | `has_access(id)` | owner only | owner only |
| `memberships` | `has_access(workspace_id)` | owner only | owner only |
| `invites` | owner only | owner only | owner only |
| `containers` | `has_access(workspace_id)` and `deleted_at is null` | `can_write(workspace_id)` | `can_delete_bin(workspace_id)` |
| `items` | `has_access(...)` and `deleted_at is null` | `can_write(...)` | `can_write(...)` |

For `items`, the workspace is reached through `container_id`, so a third helper
that maps a container to its workspace keeps those two policies short.

Because deletes are soft (an update to `deleted_at`), the "delete" column above is
enforced inside the `soft_delete_bin` and `restore_bin` functions rather than by a
literal `delete` policy. Hard `delete` on `containers` is granted to nobody; the
only thing that truly removes a row is the purge job.

The React UI hides controls a member cannot use, but that is presentation only.
A `read` member who crafts a request by hand still gets rejected by Postgres.

## Deleting and restoring
Nothing is erased immediately. Deleting a bin or an item sets `deleted_at` and
`deleted_by`; every normal query filters those rows out, so the app behaves as if
the row is gone.

- Deleting a bin also stamps `deleted_at` on the items inside it, so a restore
  brings the bin back with its contents intact.
- A **Recently deleted** screen lists everything removed in the last 30 days, who
  removed it, and when. The master can restore any of it. Restoring a bin whose
  name has since been taken prompts for a new name first.
- After 30 days rows are purged for real by a scheduled job (a Supabase cron
  function, or simply left in place — at household scale the storage is nothing
  and keeping them is a fine default).
- Soft delete is what makes the `can_delete_bins` permission low stakes. The
  permission decides who can *remove* something; the restore window decides
  whether that removal is permanent, and it protects the master from their own
  mistakes just as much as anyone else's.

## UI and theme
Style the app with Tailwind CSS so it feels modern, clean, and intuitive on both
phone and desktop. The interface is mobile first because most use happens on a
phone right after scanning a sticker.

Design direction:
- A calm, modern theme with a single accent color used consistently for primary
  actions such as add, save, and the scan or view buttons.
- Neutral gray background with white cards for containers and item lists, generous
  spacing, and rounded corners so it reads as tidy and uncluttered.
- Support a light and dark mode using Tailwind's dark mode class so it is easy to
  read in a dim storage room.
- Large, easy to tap buttons and legible text since the app is used one handed
  while holding a container.
- Clear visual states for empty containers, loading, errors, no access, and
  read only mode (a small "view only" badge instead of hidden-with-no-explanation
  buttons).

Suggested tooling: Tailwind CSS with the Vite plugin. Optionally add a headless
component or icon library later (for example lucide-react for icons) to speed up
building polished controls, but plain Tailwind is enough to start.

## Main screens
1. **Login** — email and password, with redirect back to wherever the user was headed.
2. **Dashboard** (any member) — list of bins in the workspace, with view or print
   QR for each. Create bin is visible to `owner` and `write` only.
3. **Box view** at `/box/:id` (any member of that bin's workspace) — the item list.
   Add, edit, and delete controls for `owner` and `write`; `read` sees a clean
   list with a "view only" badge.
4. **Members** at `/members` (master only) — current members with their roles, a
   per member "can delete bins" toggle, role change and remove controls, pending
   invites with copy link and revoke, and the invite form.
5. **Accept invite** at `/invite/:token` — redeems the invite after sign in and
   drops the user on the dashboard.
6. **Recently deleted** at `/trash` (master only) — bins and items removed in the
   last 30 days, with who deleted them and a restore button.
7. **No access** — shown to a signed in user with no membership.

## Open decisions to confirm before building
- Invites are matched to the invitee's email address. If you would rather have a
  link that anyone can redeem, drop the email check in `redeem_invite` and the
  link alone becomes the credential.
- Bin name uniqueness is scoped to the workspace and is case insensitive
  ("Garage" and "garage" collide). Say the word if you want it case sensitive.
- Item deletion comes with plain `write`; only whole bin deletion needs the extra
  permission. Gating item deletion too is possible but starts to feel like
  corporate software for a household inventory.
- The restore window is 30 days and the Recently deleted screen is master only.
  Letting `write` members restore their own accidental deletes is a reasonable
  alternative if you would rather not be the one everybody asks.

## Suggested next steps when development begins
1. Create the Supabase project and your master account.
2. Define the `workspaces`, `memberships`, `invites`, `containers`, and `items`
   tables, the partial unique bin name index, the helper functions, and the Row
   Level Security policies.
3. Write the `redeem_invite`, `soft_delete_bin`, and `restore_bin` functions and
   test them with a second throwaway account at each role.
4. Scaffold the React app with Vite and install the libraries above.
5. Build authentication, the workspace context, and a protected route wrapper that
   knows the current user's role and delete permission.
6. Build the dashboard, then the box view, then QR generation and printing.
7. Build the Members screen and the invite acceptance page.
8. Build the Recently deleted screen.
9. Connect the GitHub repo to Netlify for automatic deploys.
