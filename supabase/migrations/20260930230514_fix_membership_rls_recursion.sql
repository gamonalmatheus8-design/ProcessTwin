-- Break the pre-existing organizations -> organization_members -> organizations SELECT cycle.
-- A private, auth-bound boolean lookup reveals no other user's memberships.
create function private.owns_organization(p_organization uuid) returns boolean
language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists(select 1 from public.organizations where id=p_organization and created_by=auth.uid()); $$;
revoke all on function private.owns_organization(uuid) from public,anon;
grant execute on function private.owns_organization(uuid) to authenticated;
alter policy organization_members_select on public.organization_members to authenticated
using (user_id=(select auth.uid()) or private.owns_organization(organization_id));
