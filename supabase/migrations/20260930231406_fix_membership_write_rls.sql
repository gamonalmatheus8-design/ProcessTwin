-- Membership writes must also avoid querying organizations through its membership SELECT policy.
-- Preserve original owner-only semantics for INSERT/UPDATE/DELETE, including UPDATE WITH CHECK.
alter policy organization_members_insert on public.organization_members to authenticated
with check (private.owns_organization(organization_id));
alter policy organization_members_update on public.organization_members to authenticated
using (private.owns_organization(organization_id))
with check (private.owns_organization(organization_id));
alter policy organization_members_delete on public.organization_members to authenticated
using (private.owns_organization(organization_id));
