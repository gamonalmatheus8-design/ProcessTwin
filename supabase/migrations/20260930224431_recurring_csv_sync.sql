-- V1.5A.2: narrow manual sync RPCs. Foundation V1.5A.1 is a prerequisite.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.datasets add column sync_revision bigint not null default 0;
alter table public.datasets add column analyzed_revision bigint not null default 0;
alter table public.sync_runs
  add column filename text,
  add column storage_path text,
  add column source_schema_hash text,
  add column mapping_id uuid references public.connector_mappings(id) on delete restrict,
  add column analysis_status text not null default 'skipped' check (analysis_status in ('pending','skipped','succeeded','failed','superseded')),
  add column analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  add column dataset_revision bigint;

-- Every privileged entry point derives tenant from process, never from a caller-supplied org.
create function private.sync_authorize(p_process uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  select p.organization_id into v_org from public.processes p
  join public.organizations o on o.id = p.organization_id
  where p.id = p_process and (o.created_by = auth.uid() or exists (
    select 1 from public.organization_members m where m.organization_id = o.id
      and m.user_id = auth.uid() and m.role in ('owner','admin')));
  if v_org is null then raise insufficient_privilege using message = 'Owner/admin permission required'; end if;
  return v_org;
end $$;
revoke all on function private.sync_authorize(uuid) from public, anon, authenticated;

create function private.recurring_csv_create(p_process uuid, p_name text, p_pack text, p_mapping jsonb, p_identity jsonb, p_schema_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_dataset uuid; v_connector uuid; v_column text;
begin
  v_org := private.sync_authorize(p_process);
  if p_schema_hash !~ '^[0-9a-f]{64}$' or p_schema_hash is null
    or jsonb_typeof(p_mapping) is distinct from 'object'
    or jsonb_typeof(p_identity) is distinct from 'object'
    or coalesce(p_mapping->>'caseId','') = '' or coalesce(p_mapping->>'activity','') = ''
    or coalesce(p_mapping->>'timestamp','') = ''
    or coalesce(p_identity->>'strategy','') not in ('source_id','source_fields','canonical_fingerprint')
    or p_identity->>'version' is distinct from 'v1'
    or jsonb_typeof(p_identity->'fields') is distinct from 'array'
  then raise check_violation using message = 'Invalid mapping configuration'; end if;
  if (p_identity->>'strategy' = 'source_id' and jsonb_array_length(p_identity->'fields') <> 1)
    or (p_identity->>'strategy' = 'source_fields' and jsonb_array_length(p_identity->'fields') = 0)
    or (p_identity->>'strategy' = 'canonical_fingerprint' and jsonb_array_length(p_identity->'fields') <> 0)
  then raise check_violation using message = 'Invalid event identity'; end if;
  -- Lock the process during setup; the partial UNIQUE constraint remains the final barrier.
  perform 1 from public.processes where id = p_process and organization_id = v_org for update;
  insert into public.datasets(organization_id,process_id,name,source_type,dataset_mode,uploaded_by)
  values(v_org,p_process,'Live Dataset','connector','live',auth.uid())
  on conflict (process_id) where dataset_mode = 'live' do nothing;
  select id into strict v_dataset from public.datasets where process_id=p_process and organization_id=v_org and dataset_mode='live';
  insert into public.connectors(organization_id,process_id,dataset_id,type,name,status,sync_mode,process_pack_id,created_by)
  values(v_org,p_process,v_dataset,'recurring_csv',trim(p_name),'draft','manual',p_pack,auth.uid()) returning id into v_connector;
  insert into public.connector_mappings(organization_id,connector_id,version,source_schema_hash,canonical_mapping,identity_config,created_by)
  values(v_org,v_connector,1,p_schema_hash,p_mapping,p_identity,auth.uid());
  return jsonb_build_object('connectorId',v_connector,'datasetId',v_dataset);
end $$;

create function private.recurring_csv_start(p_connector uuid, p_filename text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c public.connectors; r public.sync_runs; v_mapping uuid; v_org uuid;
begin
  select * into strict c from public.connectors where id=p_connector;
  v_org := private.sync_authorize(c.process_id);
  if c.organization_id <> v_org or c.type <> 'recurring_csv' or c.sync_mode <> 'manual'
    or c.dataset_id is null or c.status not in ('draft','active','needs_attention')
  then raise check_violation using message='Connector unavailable'; end if;
  -- Same global lock order as merge/finalize: dataset, then connector, then run.
  perform 1 from public.datasets where id=c.dataset_id and process_id=c.process_id and organization_id=v_org and dataset_mode='live' for update;
  if not found then raise check_violation using message='Invalid live dataset'; end if;
  perform 1 from public.connectors where id=p_connector for update;
  select id into strict v_mapping from public.connector_mappings where connector_id=c.id and organization_id=v_org and active and version=1;
  -- Recover abandoned requests on next manual attempt (no scheduler in this release).
  update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_code='request_expired',
    error_message='A solicitação anterior foi interrompida. Envie o arquivo novamente.',analysis_status='skipped'
    where connector_id=c.id and status='running' and started_at < clock_timestamp()-interval '5 minutes';
  insert into public.sync_runs(organization_id,process_id,connector_id,dataset_id,trigger,status,started_at,filename,mapping_id)
  values(v_org,c.process_id,c.id,c.dataset_id,'manual','running',clock_timestamp(),left(p_filename,160),v_mapping) returning * into r;
  insert into public.connector_sync_state(connector_id,organization_id,last_attempt_at)
  values(c.id,v_org,clock_timestamp()) on conflict(connector_id) do update set last_attempt_at=excluded.last_attempt_at,updated_at=clock_timestamp();
  return to_jsonb(r);
end $$;

create function private.recurring_csv_merge(p_run uuid, p_events jsonb, p_fetched integer, p_invalid integer, p_schema_hash text, p_storage_path text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; c public.connectors; d public.datasets; e jsonb; old public.process_events;
  v_org uuid; v_next integer; v_new integer:=0; v_updated integer:=0; v_dup integer:=0; v_revision bigint;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_authorize(r.process_id);
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

create function private.recurring_csv_fail(p_run uuid, p_code text, p_fetched integer, p_invalid integer) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; v_org uuid; v_message text;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_authorize(r.process_id);
  perform 1 from public.datasets where id=r.dataset_id and organization_id=v_org for update;
  perform 1 from public.connectors where id=r.connector_id and organization_id=v_org for update;
  select * into strict r from public.sync_runs where id=p_run and organization_id=v_org for update;
  if r.status <> 'running' then return to_jsonb(r); end if;
  v_message:=case when p_code='schema_drift' then 'O arquivo mudou e o mapeamento precisa ser revisado.'
    when p_code='storage_failed' then 'Não foi possível arquivar o CSV. Tente novamente.'
    when p_code in ('invalid_mapping','invalid_csv','data_quality') then 'Revise o arquivo e a configuração do conector.'
    else 'Não foi possível concluir a sincronização. Tente novamente.' end;
  update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_code=case when p_code in ('schema_drift','storage_failed','invalid_mapping','invalid_csv','data_quality') then p_code else 'sync_failed' end,
    error_message=v_message,fetched_count=greatest(coalesce(p_fetched,0),0),invalid_count=greatest(coalesce(p_invalid,0),0),page_count=1
    where id=r.id returning * into r;
  if p_code in ('schema_drift','invalid_mapping','invalid_csv','data_quality') then update public.connectors set status='needs_attention',updated_at=clock_timestamp() where id=r.connector_id; end if;
  update public.connector_sync_state set consecutive_failures=consecutive_failures+1,updated_at=clock_timestamp() where connector_id=r.connector_id;
  return to_jsonb(r);
end $$;

-- Snapshot JSON is produced inside one transaction, without PostgREST's 1,000-row pagination limit.
create function private.recurring_csv_snapshot(p_run uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; d public.datasets; v_org uuid; v_events jsonb;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_authorize(r.process_id);
  select * into strict d from public.datasets where id=r.dataset_id and organization_id=v_org for share;
  if r.organization_id<>v_org or r.status not in ('succeeded','partial') or r.accepted_count+r.updated_count=0 then return null; end if;
  if d.analyzed_revision=d.sync_revision then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('caseId',case_id,'activity',activity,'timestamp',event_time,'resource',resource) order by event_index),'[]'::jsonb)
    into v_events from public.process_events where dataset_id=d.id and organization_id=v_org and process_id=r.process_id;
  return jsonb_build_object('revision',d.sync_revision,'events',v_events);
end $$;

create function private.recurring_csv_analysis(p_run uuid, p_revision bigint, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; d public.datasets; v_org uuid; v_analysis uuid; b jsonb;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_authorize(r.process_id);
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
      jsonb_build_object('metrics',p_result->'metrics','simulation',p_result->'simulation','impact',p_result->'impact','syncRevision',p_revision),auth.uid()) returning id into v_analysis;
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

-- Recurring CSV mapping/identity is immutable immediately after setup. A future reviewed
-- mapping-revision API must be designed explicitly; direct clients cannot silently remap.
create function private.recurring_csv_mapping_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists(select 1 from public.connectors where id=old.connector_id and type='recurring_csv')
    then raise check_violation using message='Recurring CSV mapping is frozen'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.recurring_csv_mapping_guard() from public,anon,authenticated;
create trigger recurring_csv_mapping_frozen before update or delete on public.connector_mappings
for each row execute function private.recurring_csv_mapping_guard();

revoke all on function private.recurring_csv_create(uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function private.recurring_csv_create(uuid,text,text,jsonb,jsonb,text) to authenticated;
create function public.recurring_csv_create(p_process uuid, p_name text, p_pack text, p_mapping jsonb, p_identity jsonb, p_schema_hash text) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.recurring_csv_create(p_process,p_name,p_pack,p_mapping,p_identity,p_schema_hash); $$;
revoke all on function public.recurring_csv_create(uuid,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.recurring_csv_create(uuid,text,text,jsonb,jsonb,text) to authenticated;

revoke all on function private.recurring_csv_start(uuid,text) from public,anon,authenticated;
grant execute on function private.recurring_csv_start(uuid,text) to authenticated;
create function public.recurring_csv_start(p_connector uuid, p_filename text) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.recurring_csv_start(p_connector,p_filename); $$;
revoke all on function public.recurring_csv_start(uuid,text) from public,anon;
grant execute on function public.recurring_csv_start(uuid,text) to authenticated;

revoke all on function private.recurring_csv_merge(uuid,jsonb,integer,integer,text,text) from public,anon,authenticated;
grant execute on function private.recurring_csv_merge(uuid,jsonb,integer,integer,text,text) to authenticated;
create function public.recurring_csv_merge(p_run uuid, p_events jsonb, p_fetched integer, p_invalid integer, p_schema_hash text, p_storage_path text) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.recurring_csv_merge(p_run,p_events,p_fetched,p_invalid,p_schema_hash,p_storage_path); $$;
revoke all on function public.recurring_csv_merge(uuid,jsonb,integer,integer,text,text) from public,anon;
grant execute on function public.recurring_csv_merge(uuid,jsonb,integer,integer,text,text) to authenticated;

revoke all on function private.recurring_csv_fail(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function private.recurring_csv_fail(uuid,text,integer,integer) to authenticated;
create function public.recurring_csv_fail(p_run uuid, p_code text, p_fetched integer, p_invalid integer) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.recurring_csv_fail(p_run,p_code,p_fetched,p_invalid); $$;
revoke all on function public.recurring_csv_fail(uuid,text,integer,integer) from public,anon;
grant execute on function public.recurring_csv_fail(uuid,text,integer,integer) to authenticated;

revoke all on function private.recurring_csv_snapshot(uuid) from public,anon,authenticated;
grant execute on function private.recurring_csv_snapshot(uuid) to authenticated;
create function public.recurring_csv_snapshot(p_run uuid) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.recurring_csv_snapshot(p_run); $$;
revoke all on function public.recurring_csv_snapshot(uuid) from public,anon;
grant execute on function public.recurring_csv_snapshot(uuid) to authenticated;

revoke all on function private.recurring_csv_analysis(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function private.recurring_csv_analysis(uuid,bigint,jsonb) to authenticated;
create function public.recurring_csv_analysis(p_run uuid, p_revision bigint, p_result jsonb) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.recurring_csv_analysis(p_run,p_revision,p_result); $$;
revoke all on function public.recurring_csv_analysis(uuid,bigint,jsonb) from public,anon;
grant execute on function public.recurring_csv_analysis(uuid,bigint,jsonb) to authenticated;
