-- V1.5A.4: only the trusted server can submit canonical events and Core results.
-- Existing function definitions remain for historical reproducibility but lose API grants.
create index sync_runs_mapping_idx on public.sync_runs(mapping_id);
create index sync_runs_analysis_idx on public.sync_runs(analysis_run_id);

grant usage on schema private to service_role;
create function private.sync_server_authorize(p_process uuid,p_actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
  if current_user <> 'service_role' or p_actor is null
  then raise insufficient_privilege using message='Trusted server and actor required'; end if;
  select p.organization_id into v_org from public.processes p
  join public.organizations o on o.id=p.organization_id
  where p.id=p_process and (o.created_by=p_actor or exists(
    select 1 from public.organization_members m where m.organization_id=o.id
      and m.user_id=p_actor and m.role in ('owner','admin')));
  if v_org is null then raise insufficient_privilege using message='Owner/admin permission required'; end if;
  return v_org;
end $$;
revoke all on function private.sync_server_authorize(uuid,uuid) from public,anon,authenticated,service_role;

revoke all on function public.recurring_csv_merge(uuid,jsonb,integer,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function private.recurring_csv_merge(uuid,jsonb,integer,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function public.recurring_csv_analysis(uuid,bigint,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.recurring_csv_analysis(uuid,bigint,jsonb) from public,anon,authenticated,service_role;

create function private.recurring_csv_merge_server(p_actor uuid, p_run uuid, p_events jsonb, p_fetched integer, p_invalid integer, p_schema_hash text, p_storage_path text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; c public.connectors; d public.datasets; e jsonb; old public.process_events;
  v_org uuid; v_next integer; v_new integer:=0; v_updated integer:=0; v_dup integer:=0; v_revision bigint;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_server_authorize(r.process_id,p_actor);
  select * into strict d from public.datasets where id=r.dataset_id and process_id=r.process_id and organization_id=v_org and dataset_mode='live' for update;
  select * into strict c from public.connectors where id=r.connector_id and dataset_id=d.id and process_id=r.process_id and organization_id=v_org and type='recurring_csv' and sync_mode='manual' for update;
  select * into strict r from public.sync_runs where id=p_run and organization_id=v_org for update;
  if r.status in ('succeeded','partial') then return to_jsonb(r); end if; -- lost-response retry of this exact run
  if r.status <> 'running' or c.status not in ('draft','active','needs_attention') then raise check_violation using message='Run unavailable'; end if;
  if not exists(select 1 from public.connector_mappings where id=r.mapping_id and connector_id=c.id and organization_id=v_org and active and version=1)
  then raise check_violation using message='Frozen mapping unavailable'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' or p_invalid < 0 or p_fetched <= 0 or p_fetched > 20000
    or p_fetched is null or p_invalid is null or p_schema_hash is null or p_schema_hash !~ '^[0-9a-f]{64}$'
    or jsonb_array_length(p_events) + p_invalid <> p_fetched
    or jsonb_array_length(p_events)=0 or p_invalid::numeric/p_fetched > 0.2
    or p_storage_path is distinct from v_org::text||'/'||r.process_id::text||'/'||d.id::text||'/sync/'||r.id::text||'/'||r.filename
  then raise check_violation using message='Invalid sync batch'; end if;
  if not exists(select 1 from storage.objects where bucket_id='process-datasets' and name=p_storage_path)
  then raise check_violation using message='Archived CSV required'; end if;
  -- Safe max + 1: dataset row is exclusively locked for this entire transaction.
  select coalesce(max(event_index),-1)+1 into v_next from public.process_events where dataset_id=d.id;
  for e in select value from jsonb_array_elements(p_events) loop
    if coalesce(e->>'sourceEventKey','') !~ '^(source-id|source-fields|canonical):v1:[0-9a-f]{64}$'
      or coalesce(e->>'sourcePayloadHash','') !~ '^[0-9a-f]{64}$'
      or coalesce(trim(e->>'caseId'),'')='' or coalesce(trim(e->>'activity'),'')=''
      or e->>'timestamp' is null
    then raise check_violation using message='Invalid canonical event'; end if;
    select * into old from public.process_events where connector_id=c.id and source_event_key=e->>'sourceEventKey';
    if found then
      if old.source_payload_hash=e->>'sourcePayloadHash' then v_dup:=v_dup+1;
      else
        update public.process_events set case_id=e->>'caseId',activity=e->>'activity',event_time=(e->>'timestamp')::timestamptz,
          resource=e->>'resource',lifecycle=e->>'lifecycle',cost=(e->>'cost')::numeric,status=e->>'status',metadata=coalesce(e->'metadata','{}'::jsonb),
          source_payload_hash=e->>'sourcePayloadHash',source_updated_at=(e->>'sourceUpdatedAt')::timestamptz,
          ingested_at=clock_timestamp(),sync_run_id=r.id
          where id=old.id and dataset_id=d.id and organization_id=v_org;
        v_updated:=v_updated+1;
      end if;
    else
      insert into public.process_events(organization_id,process_id,dataset_id,event_index,case_id,activity,event_time,resource,lifecycle,cost,status,metadata,connector_id,sync_run_id,source_event_key,source_payload_hash,source_updated_at,ingested_at)
      values(v_org,r.process_id,d.id,v_next,e->>'caseId',e->>'activity',(e->>'timestamp')::timestamptz,e->>'resource',e->>'lifecycle',(e->>'cost')::numeric,e->>'status',coalesce(e->'metadata','{}'::jsonb),c.id,r.id,e->>'sourceEventKey',e->>'sourcePayloadHash',(e->>'sourceUpdatedAt')::timestamptz,clock_timestamp());
      v_next:=v_next+1; v_new:=v_new+1;
    end if;
  end loop;
  update public.datasets set row_count=(select count(*) from public.process_events where dataset_id=d.id),
    case_count=(select count(distinct case_id) from public.process_events where dataset_id=d.id),
    validation_status='valid',validation_errors='[]'::jsonb,
    sync_revision=sync_revision+case when v_new+v_updated>0 then 1 else 0 end where id=d.id returning sync_revision into v_revision;
  update public.sync_runs set status=case when p_invalid>0 then 'partial' else 'succeeded' end,
    fetched_count=p_fetched,accepted_count=v_new,updated_count=v_updated,duplicate_count=v_dup,invalid_count=p_invalid,
    page_count=1,completed_at=clock_timestamp(),source_schema_hash=p_schema_hash,storage_path=p_storage_path,
    dataset_revision=v_revision,analysis_status=case when v_new+v_updated>0 then 'pending' else 'skipped' end
    where id=r.id returning * into r;
  update public.connectors set status='active',updated_at=clock_timestamp() where id=c.id;
  update public.connector_sync_state set last_success_at=clock_timestamp(),consecutive_failures=0,updated_at=clock_timestamp() where connector_id=c.id;
  return to_jsonb(r);
end $$;

create function private.recurring_csv_analysis_server(p_actor uuid, p_run uuid, p_revision bigint, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; d public.datasets; v_org uuid; v_analysis uuid; b jsonb;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_server_authorize(r.process_id,p_actor);
  select * into strict d from public.datasets where id=r.dataset_id and organization_id=v_org for update;
  select * into strict r from public.sync_runs where id=p_run and organization_id=v_org for update;
  if r.status not in ('succeeded','partial') or r.accepted_count+r.updated_count=0 then return to_jsonb(r); end if;
  if p_result is null then
    if r.analysis_status not in ('succeeded','superseded') then update public.sync_runs set analysis_status='failed' where id=r.id returning * into r; end if;
    return to_jsonb(r);
  end if;
  if d.sync_revision<>p_revision or d.analyzed_revision>=p_revision then
    if r.analysis_status<>'succeeded' then update public.sync_runs set analysis_status='superseded' where id=r.id returning * into r; end if;
    return to_jsonb(r);
  end if;
  if jsonb_typeof(p_result->'model') is distinct from 'object'
    or (p_result->'metrics'->>'eventCount')::integer is distinct from d.row_count
    then raise check_violation using message='Invalid analysis result'; end if;
  insert into public.analysis_runs(organization_id,process_id,dataset_id,status,engine_version,started_at,completed_at,summary,created_by)
    values(v_org,r.process_id,d.id,'completed','core-v1.1',clock_timestamp(),clock_timestamp(),
      jsonb_build_object('metrics',p_result->'metrics','simulation',p_result->'simulation','impact',p_result->'impact','syncRevision',p_revision),p_actor) returning id into v_analysis;
  insert into public.process_models(organization_id,process_id,dataset_id,analysis_run_id,model_version,graph,metrics,variants)
    values(v_org,r.process_id,d.id,v_analysis,'core-v1.1',jsonb_build_object('nodes',p_result->'model'->'nodes','edges',p_result->'model'->'edges'),p_result->'metrics',p_result->'model'->'variants');
  b:=p_result->'bottleneck';
  if b is not null and b<>'null'::jsonb then
    insert into public.bottlenecks(organization_id,process_id,analysis_run_id,activity,rank,score,severity,avg_wait_seconds,affected_cases,rework_rate_pct,evidence)
      values(v_org,r.process_id,v_analysis,b->>'activity',1,(b->>'score')::numeric,b->>'severity',(b->>'avgWaitSeconds')::bigint,(b->>'affectedCases')::integer,(b->>'reworkRatePct')::numeric,b->'evidence');
  end if;
  update public.datasets set analyzed_revision=p_revision where id=d.id;
  update public.processes set status='active' where id=r.process_id and organization_id=v_org;
  update public.sync_runs set analysis_status='succeeded',analysis_run_id=v_analysis where id=r.id returning * into r;
  return to_jsonb(r);
end $$;

revoke all on function private.recurring_csv_merge_server(uuid,uuid,jsonb,integer,integer,text,text) from public,anon,authenticated;
grant execute on function private.recurring_csv_merge_server(uuid,uuid,jsonb,integer,integer,text,text) to service_role;
create function public.recurring_csv_merge_server(p_actor uuid,p_run uuid,p_events jsonb,p_fetched integer,p_invalid integer,p_schema_hash text,p_storage_path text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.recurring_csv_merge_server(p_actor,p_run,p_events,p_fetched,p_invalid,p_schema_hash,p_storage_path);
$$;
revoke all on function public.recurring_csv_merge_server(uuid,uuid,jsonb,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.recurring_csv_merge_server(uuid,uuid,jsonb,integer,integer,text,text) to service_role;

revoke all on function private.recurring_csv_analysis_server(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function private.recurring_csv_analysis_server(uuid,uuid,bigint,jsonb) to service_role;
create function public.recurring_csv_analysis_server(p_actor uuid,p_run uuid,p_revision bigint,p_result jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.recurring_csv_analysis_server(p_actor,p_run,p_revision,p_result);
$$;
revoke all on function public.recurring_csv_analysis_server(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.recurring_csv_analysis_server(uuid,uuid,bigint,jsonb) to service_role;

-- Preserve snapshot writes while preventing forged or overwritten live results.
create policy analysis_runs_live_insert_guard on public.analysis_runs as restrictive for insert to authenticated with check (exists(select 1 from public.datasets d where d.id=analysis_runs.dataset_id and d.organization_id=analysis_runs.organization_id and d.dataset_mode='snapshot'));
create policy analysis_runs_live_update_guard on public.analysis_runs as restrictive for update to authenticated using (exists(select 1 from public.datasets d where d.id=analysis_runs.dataset_id and d.organization_id=analysis_runs.organization_id and d.dataset_mode='snapshot')) with check (exists(select 1 from public.datasets d where d.id=analysis_runs.dataset_id and d.organization_id=analysis_runs.organization_id and d.dataset_mode='snapshot'));
create policy analysis_runs_live_delete_guard on public.analysis_runs as restrictive for delete to authenticated using (exists(select 1 from public.datasets d where d.id=analysis_runs.dataset_id and d.organization_id=analysis_runs.organization_id and d.dataset_mode='snapshot'));

-- Preserve snapshot writes while preventing forged or overwritten live results.
create policy process_models_live_insert_guard on public.process_models as restrictive for insert to authenticated with check (exists(select 1 from public.datasets d where d.id=process_models.dataset_id and d.organization_id=process_models.organization_id and d.dataset_mode='snapshot'));
create policy process_models_live_update_guard on public.process_models as restrictive for update to authenticated using (exists(select 1 from public.datasets d where d.id=process_models.dataset_id and d.organization_id=process_models.organization_id and d.dataset_mode='snapshot')) with check (exists(select 1 from public.datasets d where d.id=process_models.dataset_id and d.organization_id=process_models.organization_id and d.dataset_mode='snapshot'));
create policy process_models_live_delete_guard on public.process_models as restrictive for delete to authenticated using (exists(select 1 from public.datasets d where d.id=process_models.dataset_id and d.organization_id=process_models.organization_id and d.dataset_mode='snapshot'));

-- Preserve snapshot writes while preventing forged or overwritten live results.
create policy bottlenecks_live_insert_guard on public.bottlenecks as restrictive for insert to authenticated with check (exists(select 1 from public.analysis_runs a join public.datasets d on d.id=a.dataset_id and d.organization_id=a.organization_id where a.id=bottlenecks.analysis_run_id and a.organization_id=bottlenecks.organization_id and d.dataset_mode='snapshot'));
create policy bottlenecks_live_update_guard on public.bottlenecks as restrictive for update to authenticated using (exists(select 1 from public.analysis_runs a join public.datasets d on d.id=a.dataset_id and d.organization_id=a.organization_id where a.id=bottlenecks.analysis_run_id and a.organization_id=bottlenecks.organization_id and d.dataset_mode='snapshot')) with check (exists(select 1 from public.analysis_runs a join public.datasets d on d.id=a.dataset_id and d.organization_id=a.organization_id where a.id=bottlenecks.analysis_run_id and a.organization_id=bottlenecks.organization_id and d.dataset_mode='snapshot'));
create policy bottlenecks_live_delete_guard on public.bottlenecks as restrictive for delete to authenticated using (exists(select 1 from public.analysis_runs a join public.datasets d on d.id=a.dataset_id and d.organization_id=a.organization_id where a.id=bottlenecks.analysis_run_id and a.organization_id=bottlenecks.organization_id and d.dataset_mode='snapshot'));
