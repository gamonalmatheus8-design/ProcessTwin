-- Protect the live dataset lock/index protocol from direct client writes.
-- Restrictive policies compose with existing tenant/role policies; snapshot intake is unchanged.
create policy datasets_live_insert_guard on public.datasets as restrictive for insert to authenticated with check (dataset_mode='snapshot');
create policy datasets_live_update_guard on public.datasets as restrictive for update to authenticated using (dataset_mode='snapshot') with check (dataset_mode='snapshot');
create policy datasets_live_delete_guard on public.datasets as restrictive for delete to authenticated using (dataset_mode='snapshot');
create policy process_events_live_insert_guard on public.process_events as restrictive for insert to authenticated
  with check (exists(select 1 from public.datasets d where d.id=process_events.dataset_id and d.organization_id=process_events.organization_id and d.dataset_mode='snapshot'));
create policy process_events_live_update_guard on public.process_events as restrictive for update to authenticated
  using (exists(select 1 from public.datasets d where d.id=process_events.dataset_id and d.organization_id=process_events.organization_id and d.dataset_mode='snapshot'))
  with check (exists(select 1 from public.datasets d where d.id=process_events.dataset_id and d.organization_id=process_events.organization_id and d.dataset_mode='snapshot'));
create policy process_events_live_delete_guard on public.process_events as restrictive for delete to authenticated
  using (exists(select 1 from public.datasets d where d.id=process_events.dataset_id and d.organization_id=process_events.organization_id and d.dataset_mode='snapshot'));

create function private.recurring_csv_scope_guard() returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
  if old.type='recurring_csv' and (
    new.type is distinct from old.type or new.organization_id is distinct from old.organization_id
    or new.process_id is distinct from old.process_id or new.dataset_id is distinct from old.dataset_id
    or new.sync_mode is distinct from old.sync_mode or new.created_by is distinct from old.created_by)
  then raise check_violation using message='Recurring CSV scope is immutable'; end if;
  return new;
end $$;
revoke all on function private.recurring_csv_scope_guard() from public,anon,authenticated;
create trigger recurring_csv_scope_frozen before update on public.connectors for each row execute function private.recurring_csv_scope_guard();

-- Different versions of one identity inside one export are ambiguous; reject before any writes.
create function private.recurring_csv_batch_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.connector_id is not null and exists(
    select 1 from public.process_events e where e.connector_id=new.connector_id
      and e.source_event_key=new.source_event_key and e.sync_run_id=new.sync_run_id
      and e.source_payload_hash<>new.source_payload_hash)
  then raise check_violation using message='Conflicting event identities in sync batch'; end if;
  return new;
end $$;
revoke all on function private.recurring_csv_batch_guard() from public,anon,authenticated;
create trigger recurring_csv_batch_consistency before insert or update on public.process_events
for each row execute function private.recurring_csv_batch_guard();
