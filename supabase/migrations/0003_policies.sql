-- BinThere 0003: row level security
-- Run after 0002. This is the file that actually enforces read vs write.

alter table workspaces  enable row level security;
alter table memberships enable row level security;
alter table invites     enable row level security;
alter table containers  enable row level security;
alter table items       enable row level security;

-- ---------------------------------------------------------------------------
-- Column grants
--
-- Policies decide which ROWS you may touch; grants decide which COLUMNS. This
-- is what stops a `write` member without can_delete_bins from simply setting
-- deleted_at themselves through the auto-generated API. Deletion has to go
-- through soft_delete_bin(), which checks the permission.
-- ---------------------------------------------------------------------------
revoke all on containers from anon, authenticated;
grant select, insert on containers to authenticated;
grant update (name) on containers to authenticated;

revoke all on items from anon, authenticated;
grant select, insert on items to authenticated;
grant update (name, quantity, notes) on items to authenticated;

revoke all on workspaces from anon, authenticated;
grant select on workspaces to authenticated;
grant update (name) on workspaces to authenticated;

revoke all on memberships from anon, authenticated;
grant select, update (role, can_delete_bins), delete on memberships to authenticated;

revoke all on invites from anon, authenticated;
grant select, insert, update (status), delete on invites to authenticated;

-- Note: no `delete` grant on containers or items anywhere. The only thing that
-- hard deletes a row is purge_deleted(), which runs as the scheduler.

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
create policy workspaces_select on workspaces
  for select using (has_access(id));

create policy workspaces_insert on workspaces
  for insert with check (owner_id = auth.uid());

create policy workspaces_update on workspaces
  for update using (is_owner(id)) with check (is_owner(id));

-- ---------------------------------------------------------------------------
-- memberships
--
-- Everyone in a workspace can see who else is in it. Only the owner can change
-- roles or remove people. The owner's own row is protected so they cannot
-- accidentally demote or delete themselves and orphan the workspace.
-- ---------------------------------------------------------------------------
create policy memberships_select on memberships
  for select using (has_access(workspace_id));

create policy memberships_insert on memberships
  for insert with check (is_owner(workspace_id) and role <> 'owner');

create policy memberships_update on memberships
  for update using (is_owner(workspace_id) and role <> 'owner')
  with check (is_owner(workspace_id) and role <> 'owner');

create policy memberships_delete on memberships
  for delete using (is_owner(workspace_id) and role <> 'owner');

-- ---------------------------------------------------------------------------
-- invites
--
-- Only the owner ever touches this table directly. The invitee never reads it;
-- redeem_invite() runs elevated on their behalf.
-- ---------------------------------------------------------------------------
create policy invites_select on invites
  for select using (is_owner(workspace_id));

create policy invites_insert on invites
  for insert with check (is_owner(workspace_id));

create policy invites_update on invites
  for update using (is_owner(workspace_id)) with check (is_owner(workspace_id));

create policy invites_delete on invites
  for delete using (is_owner(workspace_id));

-- ---------------------------------------------------------------------------
-- containers
--
-- Deleted bins stay visible to the owner only, which is what makes the trash
-- screen work without a second table.
-- ---------------------------------------------------------------------------
create policy containers_select on containers
  for select using (
    has_access(workspace_id)
    and (deleted_at is null or is_owner(workspace_id))
  );

create policy containers_insert on containers
  for insert with check (can_write(workspace_id) and deleted_at is null);

create policy containers_update on containers
  for update using (can_write(workspace_id) and deleted_at is null)
  with check (can_write(workspace_id));

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create policy items_select on items
  for select using (
    has_access(container_workspace(container_id))
    and (deleted_at is null or is_owner(container_workspace(container_id)))
  );

create policy items_insert on items
  for insert with check (
    can_write(container_workspace(container_id))
    and deleted_at is null
    and not exists (
      select 1 from containers c where c.id = container_id and c.deleted_at is not null
    )
  );

create policy items_update on items
  for update using (can_write(container_workspace(container_id)) and deleted_at is null)
  with check (can_write(container_workspace(container_id)));
