-- The original policies called storage.foldername(o.name), where o.name is the
-- organization display name. Authorize against the outer Storage object path.
drop policy if exists process_datasets_storage_insert on storage.objects;
drop policy if exists process_datasets_storage_select on storage.objects;
drop policy if exists process_datasets_storage_update on storage.objects;
drop policy if exists process_datasets_storage_delete on storage.objects;

create policy process_datasets_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'process-datasets'
  and exists (
    select 1 from public.organizations o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = o.id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin', 'analyst')
        )
      )
  )
);

create policy process_datasets_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'process-datasets'
  and exists (
    select 1 from public.organizations o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = o.id and om.user_id = (select auth.uid())
        )
      )
  )
);

create policy process_datasets_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'process-datasets'
  and exists (
    select 1 from public.organizations o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = o.id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin', 'analyst')
        )
      )
  )
)
with check (
  bucket_id = 'process-datasets'
  and exists (
    select 1 from public.organizations o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = o.id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin', 'analyst')
        )
      )
  )
);

create policy process_datasets_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'process-datasets'
  and exists (
    select 1 from public.organizations o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = o.id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin')
        )
      )
  )
);
