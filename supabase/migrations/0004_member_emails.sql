-- BinThere 0004: let the app show WHO did something, not just a UUID.
--
-- auth.users is not readable by the authenticated role, so this view runs with
-- the definer's rights and guards itself with has_access(). You can only see
-- the email addresses of people in a workspace you belong to.

create or replace view member_emails as
select m.workspace_id, m.user_id, u.email
from memberships m
join auth.users u on u.id = m.user_id
where has_access(m.workspace_id);

grant select on member_emails to authenticated;
