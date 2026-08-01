-- BinThere 0001: tables, indexes, constraints
-- Run this first in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('owner', 'write', 'read');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Workspaces: one per master account. Everything else hangs off this.
-- ---------------------------------------------------------------------------
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Memberships: who belongs to a workspace and what they may do.
-- The owner gets a row here too, so permission checks read one table.
-- ---------------------------------------------------------------------------
create table if not exists memberships (
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             member_role not null,
  can_delete_bins  boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists memberships_user_idx on memberships (user_id);

-- ---------------------------------------------------------------------------
-- Invites: a pending offer of membership, redeemed via a link.
-- ---------------------------------------------------------------------------
create table if not exists invites (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  email            text not null,
  role             member_role not null,
  can_delete_bins  boolean not null default false,
  token            text not null unique default encode(gen_random_bytes(24), 'hex'),
  status           text not null default 'pending',
  expires_at       timestamptz not null default now() + interval '7 days',
  invited_by       uuid not null default auth.uid() references auth.users (id),
  created_at       timestamptz not null default now(),

  constraint invites_status_valid check (status in ('pending', 'accepted', 'revoked')),
  -- There is exactly one owner and it is whoever created the workspace.
  constraint invites_role_not_owner check (role <> 'owner')
);

create index if not exists invites_token_idx on invites (token);
create index if not exists invites_workspace_idx on invites (workspace_id);

-- ---------------------------------------------------------------------------
-- Short ids for sticker URLs: /box/a1b2c3
-- Ambiguous characters (0 1 i l o) are left out so a smudged sticker is still
-- readable if someone ever types the code by hand. This is an identifier, not a
-- secret -- access is controlled by row level security, not by URL obscurity.
-- ---------------------------------------------------------------------------
create or replace function gen_short_id(len int default 6)
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := '23456789abcdefghjkmnpqrstuvwxyz';
  result   text := '';
  i        int;
begin
  for i in 1..len loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Containers (bins)
-- ---------------------------------------------------------------------------
create table if not exists containers (
  id           uuid primary key default gen_random_uuid(),
  short_id     text not null unique default gen_short_id(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name         text not null,
  created_by   uuid default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  deleted_by   uuid references auth.users (id),

  constraint containers_name_not_blank check (length(btrim(name)) > 0)
);

-- Bin names are unique per workspace, case insensitive, ignoring surrounding
-- whitespace. Partial on deleted_at so a deleted bin releases its name.
create unique index if not exists containers_workspace_name_key
  on containers (workspace_id, lower(btrim(name)))
  where deleted_at is null;

create index if not exists containers_workspace_idx on containers (workspace_id);

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
create table if not exists items (
  id           uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers (id) on delete cascade,
  name         text not null,
  quantity     integer not null default 1,
  notes        text,
  created_by   uuid default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  deleted_by   uuid references auth.users (id),

  constraint items_name_not_blank check (length(btrim(name)) > 0),
  constraint items_quantity_non_negative check (quantity >= 0)
);

create index if not exists items_container_idx on items (container_id);

-- Keep updated_at honest without the app having to remember.
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists items_touch_updated_at on items;
create trigger items_touch_updated_at
  before update on items
  for each row execute function touch_updated_at();
