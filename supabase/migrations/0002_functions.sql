-- BinThere 0002: permission helpers and the operations that need elevated rights
-- Run after 0001.

-- ---------------------------------------------------------------------------
-- Permission helpers
--
-- These are `security definer` so they can read `memberships` without tripping
-- the row level security policy that is itself defined in terms of them. Each
-- one answers a single yes/no question about the current user.
-- ---------------------------------------------------------------------------

create or replace function has_access(w uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w and m.user_id = auth.uid()
  );
$$;

create or replace function can_write(w uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w
      and m.user_id = auth.uid()
      and m.role in ('owner', 'write')
  );
$$;

create or replace function can_delete_bin(w uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w
      and m.user_id = auth.uid()
      and (m.role = 'owner' or (m.role = 'write' and m.can_delete_bins))
  );
$$;

create or replace function is_owner(w uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = w and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Items reach their workspace through their container.
create or replace function container_workspace(c uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from containers where id = c;
$$;

-- ---------------------------------------------------------------------------
-- Workspace creation
--
-- Chicken and egg: inserting a workspace requires a membership to prove access,
-- and the membership cannot exist before the workspace. This does both in one
-- transaction.
-- ---------------------------------------------------------------------------
create or replace function create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  insert into workspaces (owner_id, name)
  values (auth.uid(), coalesce(nullif(btrim(workspace_name), ''), 'My Home'))
  returning id into new_id;

  insert into memberships (workspace_id, user_id, role, can_delete_bins)
  values (new_id, auth.uid(), 'owner', true);

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invite redemption
--
-- The invitee cannot read the invites table (owner only), so redemption goes
-- through here. Runs elevated, checks everything itself.
-- ---------------------------------------------------------------------------
create or replace function redeem_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into inv from invites where token = invite_token;

  if not found then
    raise exception 'That invite link is not valid';
  end if;
  if inv.status = 'accepted' then
    raise exception 'That invite has already been used';
  end if;
  if inv.status = 'revoked' then
    raise exception 'That invite was cancelled';
  end if;
  if inv.expires_at < now() then
    raise exception 'That invite has expired. Ask for a new one.';
  end if;
  if lower(inv.email) <> lower(coalesce(auth.email(), '')) then
    raise exception 'That invite was sent to a different email address';
  end if;

  insert into memberships (workspace_id, user_id, role, can_delete_bins)
  values (inv.workspace_id, auth.uid(), inv.role, inv.can_delete_bins)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        can_delete_bins = excluded.can_delete_bins;

  update invites set status = 'accepted' where id = inv.id;

  return inv.workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Soft delete and restore
--
-- Nothing is ever hard deleted by the app. `deleted_at` is not writable through
-- the normal API (see the column grants in 0003), so these functions are the
-- only way a row can be removed or brought back, and they check permission
-- themselves.
-- ---------------------------------------------------------------------------

create or replace function soft_delete_bin(bin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w uuid;
begin
  select workspace_id into w
  from containers
  where id = bin_id and deleted_at is null;

  if w is null then
    raise exception 'Bin not found';
  end if;
  if not can_delete_bin(w) then
    raise exception 'You do not have permission to delete bins';
  end if;

  -- Stamp the bin and its items with the same timestamp, so a later restore can
  -- tell which items went down with the bin and which were already deleted.
  update containers
  set deleted_at = now(), deleted_by = auth.uid()
  where id = bin_id;

  update items
  set deleted_at = (select deleted_at from containers where id = bin_id),
      deleted_by = auth.uid()
  where container_id = bin_id and deleted_at is null;
end;
$$;

create or replace function restore_bin(bin_id uuid, new_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w             uuid;
  deleted_stamp timestamptz;
  final_name    text;
begin
  select workspace_id, deleted_at, name
  into w, deleted_stamp, final_name
  from containers
  where id = bin_id and deleted_at is not null;

  if w is null then
    raise exception 'Bin not found, or it is not deleted';
  end if;
  if not is_owner(w) then
    raise exception 'Only the workspace owner can restore deleted bins';
  end if;

  if new_name is not null and btrim(new_name) <> '' then
    final_name := btrim(new_name);
  end if;

  -- The name may have been taken by a new bin while this one sat in the trash.
  if exists (
    select 1 from containers
    where workspace_id = w
      and lower(btrim(name)) = lower(btrim(final_name))
      and deleted_at is null
  ) then
    raise exception 'A bin named "%" already exists. Restore it under a different name.', final_name;
  end if;

  update items
  set deleted_at = null, deleted_by = null
  where container_id = bin_id and deleted_at = deleted_stamp;

  update containers
  set name = final_name, deleted_at = null, deleted_by = null
  where id = bin_id;
end;
$$;

create or replace function soft_delete_item(item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w uuid;
begin
  select container_workspace(i.container_id) into w
  from items i
  where i.id = item_id and i.deleted_at is null;

  if w is null then
    raise exception 'Item not found';
  end if;
  if not can_write(w) then
    raise exception 'You do not have permission to change this bin';
  end if;

  update items
  set deleted_at = now(), deleted_by = auth.uid()
  where id = item_id;
end;
$$;

create or replace function restore_item(item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w         uuid;
  parent_id uuid;
begin
  select i.container_id, container_workspace(i.container_id)
  into parent_id, w
  from items i
  where i.id = item_id and i.deleted_at is not null;

  if w is null then
    raise exception 'Item not found, or it is not deleted';
  end if;
  if not is_owner(w) then
    raise exception 'Only the workspace owner can restore deleted items';
  end if;
  if exists (select 1 from containers where id = parent_id and deleted_at is not null) then
    raise exception 'Restore the bin first, then the item';
  end if;

  update items
  set deleted_at = null, deleted_by = null
  where id = item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Purge: hard delete anything that has been in the trash for 30 days.
-- Call it from a scheduled job, or never -- at household scale, leaving the rows
-- in place costs nothing.
-- ---------------------------------------------------------------------------
create or replace function purge_deleted(older_than interval default interval '30 days')
returns void
language sql
security definer
set search_path = public
as $$
  delete from items where deleted_at < now() - older_than;
  delete from containers where deleted_at < now() - older_than;
$$;

-- Only signed in users may call these. `purge_deleted` is for the scheduler.
revoke execute on function purge_deleted(interval) from anon, authenticated;
