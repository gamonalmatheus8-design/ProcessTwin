-- Close downstream state when another run already analyzed this same live revision.
create or replace function private.recurring_csv_snapshot(p_run uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; d public.datasets; v_org uuid; v_events jsonb;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_authorize(r.process_id);
  select * into strict d from public.datasets where id=r.dataset_id and organization_id=v_org for share;
  if r.organization_id<>v_org or r.status not in ('succeeded','partial') or r.accepted_count+r.updated_count=0 then return null; end if;
  if d.analyzed_revision=d.sync_revision then
    if r.analysis_status<>'succeeded' then
      update public.sync_runs set analysis_status='superseded' where id=r.id returning * into r;
      return jsonb_build_object('run',to_jsonb(r));
    end if;
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('caseId',case_id,'activity',activity,'timestamp',event_time,'resource',resource) order by event_index),'[]'::jsonb)
    into v_events from public.process_events where dataset_id=d.id and organization_id=v_org and process_id=r.process_id;
  return jsonb_build_object('revision',d.sync_revision,'events',v_events);
end $$;
revoke all on function private.recurring_csv_snapshot(uuid) from public,anon;
grant execute on function private.recurring_csv_snapshot(uuid) to authenticated;
