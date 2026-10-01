-- Google Sheets: server-only credentials, reviewed mappings and bounded daily scheduling.
create table private.sheets_credentials (
 id uuid primary key default gen_random_uuid(),
 process_id uuid not null references public.processes(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 ciphertext text not null check (length(ciphertext) between 40 and 16000),
 updated_at timestamptz not null default now(), unique(process_id,actor_id)
);
create table private.sheets_oauth_states (
 state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
 process_id uuid not null references public.processes(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 ciphertext text not null,
 expires_at timestamptz not null default (now()+interval '10 minutes')
);
alter table private.sheets_credentials enable row level security;
alter table private.sheets_oauth_states enable row level security;
revoke all on private.sheets_credentials,private.sheets_oauth_states from public,anon,authenticated,service_role;
create index sheets_credentials_actor_idx on private.sheets_credentials(actor_id);
create index sheets_oauth_process_idx on private.sheets_oauth_states(process_id);
create index sheets_oauth_actor_idx on private.sheets_oauth_states(actor_id);
create index sheets_sync_due_idx on public.connector_sync_state(next_sync_at) where next_sync_at is not null;

create function private.sheets_oauth_state_server(p_actor uuid,p_process uuid,p_hash text,p_cipher text default null) returns text
language plpgsql security definer set search_path='' as $$
declare v_cipher text;
begin
 perform private.sync_server_authorize(p_process,p_actor);
 if p_hash !~ '^[0-9a-f]{64}$' then raise check_violation; end if;
 delete from private.sheets_oauth_states where expires_at < clock_timestamp();
 if p_cipher is not null then
  delete from private.sheets_oauth_states where process_id=p_process and actor_id=p_actor;
  insert into private.sheets_oauth_states(state_hash,process_id,actor_id,ciphertext) values(p_hash,p_process,p_actor,p_cipher);
  return null;
 end if;
 delete from private.sheets_oauth_states where state_hash=p_hash and process_id=p_process and actor_id=p_actor and expires_at>clock_timestamp() returning ciphertext into v_cipher;
 if v_cipher is null then raise insufficient_privilege using message='Invalid OAuth state'; end if;
 return v_cipher;
end $$;
create function private.sheets_credential_server(p_actor uuid,p_process uuid,p_cipher text default null,p_remove boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v private.sheets_credentials;
begin
 perform private.sync_server_authorize(p_process,p_actor);
 if p_remove then
  delete from private.sheets_credentials where process_id=p_process and actor_id=p_actor;
  update public.connectors set status='needs_reauth' where process_id=p_process and created_by=p_actor and type='google_sheets';
  return null;
 end if;
 if p_cipher is not null then
  insert into private.sheets_credentials(process_id,actor_id,ciphertext) values(p_process,p_actor,p_cipher)
  on conflict(process_id,actor_id) do update set ciphertext=excluded.ciphertext,updated_at=clock_timestamp() returning * into v;
 else select * into v from private.sheets_credentials where process_id=p_process and actor_id=p_actor; end if;
 if v.id is null then return null; end if;
 return jsonb_build_object('id',v.id,'ciphertext',v.ciphertext);
end $$;
create function private.sheets_create_server(p_actor uuid,p_config jsonb,p_schedule integer,p_process uuid, p_name text, p_pack text, p_mapping jsonb, p_identity jsonb, p_schema_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_dataset uuid; v_connector uuid; v_column text;
begin
  v_org := private.sync_server_authorize(p_process,p_actor);
  if p_schema_hash !~ '^[0-9a-f]{64}$' or p_schema_hash is null
    or jsonb_typeof(p_mapping) is distinct from 'object'
    or jsonb_typeof(p_identity) is distinct from 'object'
    or coalesce(p_mapping->>'caseId','') = '' or coalesce(p_mapping->>'activity','') = ''
    or coalesce(p_mapping->>'timestamp','') = ''
    or coalesce(p_identity->>'strategy','') <> 'source_id'
    or p_identity->>'version' is distinct from 'v1'
    or jsonb_typeof(p_identity->'fields') is distinct from 'array'
  then raise check_violation using message = 'Invalid mapping configuration'; end if;
  if (p_identity->>'strategy' = 'source_id' and jsonb_array_length(p_identity->'fields') <> 1)
    or (p_identity->>'strategy' = 'source_fields' and jsonb_array_length(p_identity->'fields') = 0)
    or (p_identity->>'strategy' = 'canonical_fingerprint' and jsonb_array_length(p_identity->'fields') <> 0)
  then raise check_violation using message = 'Invalid event identity'; end if;
  if coalesce(p_config->>'spreadsheetId','') !~ '^[a-zA-Z0-9_-]{20,200}$' or p_config->>'range' is null
    or length(p_config->>'range') not between 1 and 200 or (p_schedule is not null and p_schedule<>1440)
    or not exists(select 1 from private.sheets_credentials where process_id=p_process and actor_id=p_actor)
  then raise check_violation using message='Invalid Sheets configuration'; end if;
  if p_schedule is not null then
    perform pg_catalog.pg_advisory_xact_lock(73155201);
    if (select count(*) from public.connectors where type='google_sheets' and sync_mode='scheduled' and status<>'disabled')>=3
    then raise check_violation using message='Daily pilot capacity reached'; end if;
  end if;
  -- Lock the process during setup; the partial UNIQUE constraint remains the final barrier.
  perform 1 from public.processes where id = p_process and organization_id = v_org for update;
  insert into public.datasets(organization_id,process_id,name,source_type,dataset_mode,uploaded_by)
  values(v_org,p_process,'Live Dataset','connector','live',p_actor)
  on conflict (process_id) where dataset_mode = 'live' do nothing;
  select id into strict v_dataset from public.datasets where process_id=p_process and organization_id=v_org and dataset_mode='live';
  insert into public.connectors(organization_id,process_id,dataset_id,type,name,status,sync_mode,process_pack_id,created_by,configuration,credential_ref,schedule_minutes)
  values(v_org,p_process,v_dataset,'google_sheets',trim(p_name),'draft',case when p_schedule is null then 'manual' else 'scheduled' end,p_pack,p_actor,p_config,(select id::text from private.sheets_credentials where process_id=p_process and actor_id=p_actor),p_schedule) returning id into v_connector;
  insert into public.connector_mappings(organization_id,connector_id,version,source_schema_hash,canonical_mapping,identity_config,created_by)
  values(v_org,v_connector,1,p_schema_hash,p_mapping,p_identity,p_actor);
  insert into public.connector_sync_state(connector_id,organization_id,next_sync_at) values(v_connector,v_org,case when p_schedule is not null then (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+interval '1 day 3 hours' else null end);
  return jsonb_build_object('connectorId',v_connector,'datasetId',v_dataset);
end $$;

create function private.sheets_start_server(p_actor uuid,p_connector uuid,p_trigger text,p_filename text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.connectors; r public.sync_runs; v_org uuid; v_mapping uuid;
begin
 select * into strict c from public.connectors where id=p_connector and type='google_sheets';
 v_org:=private.sync_server_authorize(c.process_id,p_actor);
 if c.created_by<>p_actor or c.status not in ('draft','active') or p_trigger not in ('manual','scheduled')
   or (p_trigger='scheduled' and c.sync_mode<>'scheduled')
 then raise check_violation using message='Sheets connector unavailable'; end if;
 perform 1 from public.datasets where id=c.dataset_id and organization_id=v_org and dataset_mode='live' for update;
 perform 1 from public.connectors where id=c.id for update;
 select * into c from public.connectors where id=c.id;
 if c.status not in ('draft','active') then raise check_violation; end if;
 update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_code='request_expired',error_message='A execução anterior foi interrompida.',analysis_status='skipped'
 where connector_id=c.id and status='running' and started_at<clock_timestamp()-interval '5 minutes';
 if exists(select 1 from public.sync_runs where connector_id=c.id and status='running') then raise check_violation using message='Sync already running'; end if;
 select id into strict v_mapping from public.connector_mappings where connector_id=c.id and organization_id=v_org and active;
 insert into public.sync_runs(organization_id,process_id,connector_id,dataset_id,trigger,status,started_at,filename,mapping_id)
 values(v_org,c.process_id,c.id,c.dataset_id,p_trigger,'running',clock_timestamp(),p_filename,v_mapping) returning * into r;
 update public.connector_sync_state set last_attempt_at=clock_timestamp(),lease_owner=r.id::text,lease_until=clock_timestamp()+interval '5 minutes',
 next_sync_at=case when c.sync_mode='scheduled' then (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+interval '1 day 3 hours' else null end,updated_at=clock_timestamp() where connector_id=c.id;
 return to_jsonb(r);
end $$;
create function private.sheets_fail_server(p_actor uuid,p_run uuid,p_code text,p_fetched integer,p_invalid integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.sync_runs; v_org uuid; n integer;
begin
 select * into strict r from public.sync_runs where id=p_run;
 v_org:=private.sync_server_authorize(r.process_id,p_actor);
 perform 1 from public.datasets where id=r.dataset_id and organization_id=v_org for update;
 perform 1 from public.connectors where id=r.connector_id and type='google_sheets' and created_by=p_actor for update;
 if not found then raise insufficient_privilege; end if;
 select * into strict r from public.sync_runs where id=p_run for update;
 if r.status<>'running' then return to_jsonb(r); end if;
 update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_code=p_code,
 error_message=case when p_code='schema_drift' then 'A planilha mudou. Revise e confirme o mapeamento para continuar.'
 when p_code='needs_reauth' then 'Reconecte sua conta Google para continuar.'
 when p_code='source_unavailable' then 'A planilha não está acessível. Revise o acesso à fonte.'
 when p_code in ('invalid_csv','invalid_mapping','data_quality') then 'Revise a estrutura e os dados da planilha.'
 else 'Falha temporária. Consulte o histórico e tente novamente.' end,
 fetched_count=greatest(0,coalesce(p_fetched,0)),invalid_count=greatest(0,coalesce(p_invalid,0)),analysis_status='skipped'
 where id=r.id returning * into r;
 update public.connector_sync_state set consecutive_failures=consecutive_failures+1,lease_owner=null,lease_until=null,updated_at=clock_timestamp() where connector_id=r.connector_id returning consecutive_failures into n;
 update public.connectors set status=case when p_code='needs_reauth' then 'needs_reauth'
 when p_code in ('schema_drift','source_unavailable','invalid_mapping','invalid_csv','data_quality') or n>=3 then 'needs_attention' else status end,updated_at=clock_timestamp() where id=r.connector_id;
 return to_jsonb(r);
end $$;
create function private.sheets_snapshot_server(p_actor uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; d public.datasets; v_org uuid; v_events jsonb;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_server_authorize(r.process_id,p_actor);
  select * into strict d from public.datasets where id=r.dataset_id and organization_id=v_org for share;
  if r.organization_id<>v_org or r.status not in ('succeeded','partial') or r.accepted_count+r.updated_count=0 then return null; end if;
  if d.analyzed_revision=d.sync_revision then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('caseId',case_id,'activity',activity,'timestamp',event_time,'resource',resource) order by event_index),'[]'::jsonb)
    into v_events from public.process_events where dataset_id=d.id and organization_id=v_org and process_id=r.process_id;
  return jsonb_build_object('revision',d.sync_revision,'events',v_events);
end $$;

create or replace function private.recurring_csv_merge_server(p_actor uuid, p_run uuid, p_events jsonb, p_fetched integer, p_invalid integer, p_schema_hash text, p_storage_path text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.sync_runs; c public.connectors; d public.datasets; e jsonb; old public.process_events;
  v_org uuid; v_next integer; v_new integer:=0; v_updated integer:=0; v_dup integer:=0; v_revision bigint;
begin
  select * into strict r from public.sync_runs where id=p_run;
  v_org := private.sync_server_authorize(r.process_id,p_actor);
  select * into strict d from public.datasets where id=r.dataset_id and process_id=r.process_id and organization_id=v_org and dataset_mode='live' for update;
  select * into strict c from public.connectors where id=r.connector_id and dataset_id=d.id and process_id=r.process_id and organization_id=v_org and ((type='recurring_csv' and sync_mode='manual') or (type='google_sheets' and sync_mode in ('manual','scheduled') and created_by=p_actor)) for update;
  select * into strict r from public.sync_runs where id=p_run and organization_id=v_org for update;
  if r.status in ('succeeded','partial') then return to_jsonb(r); end if; -- lost-response retry of this exact run
  if c.type='google_sheets' and c.status not in ('draft','active') then raise check_violation using message='Sheets connector paused'; end if;
  if r.status <> 'running' or c.status not in ('draft','active','needs_attention') then raise check_violation using message='Run unavailable'; end if;
  if not exists(select 1 from public.connector_mappings where id=r.mapping_id and connector_id=c.id and organization_id=v_org and active and (c.type='google_sheets' or version=1))
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
  update public.connector_sync_state set last_success_at=clock_timestamp(),consecutive_failures=0,lease_owner=null,lease_until=null,updated_at=clock_timestamp() where connector_id=c.id;
  return to_jsonb(r);
end $$;

create function private.sheets_due_server(p_limit integer default 3) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if current_user<>'service_role' then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'actorId',q.created_by,'processId',q.process_id)),'[]'::jsonb) from (
 select c.id,c.created_by,c.process_id from public.connectors c join public.connector_sync_state s on s.connector_id=c.id
 where c.type='google_sheets' and c.status='active' and c.sync_mode='scheduled' and s.next_sync_at<=clock_timestamp()
 and (s.lease_until is null or s.lease_until<clock_timestamp()) order by s.next_sync_at,c.id limit least(greatest(p_limit,1),3)) q);
end $$;
-- Source scope and stable identity cannot be changed by browser sessions.
create policy sheets_connectors_insert_guard on public.connectors as restrictive for insert to authenticated with check(type<>'google_sheets');
create policy sheets_connectors_update_guard on public.connectors as restrictive for update to authenticated using(type<>'google_sheets') with check(type<>'google_sheets');
create policy sheets_connectors_delete_guard on public.connectors as restrictive for delete to authenticated using(type<>'google_sheets');
create policy sheets_mappings_insert_guard on public.connector_mappings as restrictive for insert to authenticated with check(not exists(select 1 from public.connectors where id=connector_mappings.connector_id and type='google_sheets'));
create or replace function private.recurring_csv_mapping_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.connectors where id=old.connector_id and type in ('recurring_csv','google_sheets')) then
  if tg_op='UPDATE' and exists(select 1 from public.connectors where id=old.connector_id and type='google_sheets')
   and current_user='service_role'
   and old.active and not new.active and (to_jsonb(new)-'active')=(to_jsonb(old)-'active') then return new; end if;
  raise check_violation using message='Mapping is frozen';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create function private.sheets_control_server(p_actor uuid,p_connector uuid,p_action text,p_mapping jsonb default null,p_schema text default null) returns void
language plpgsql security definer set search_path='' as $$
declare c public.connectors; m public.connector_mappings;
begin
 select * into strict c from public.connectors where id=p_connector and type='google_sheets';
 perform private.sync_server_authorize(c.process_id,p_actor);
 if c.created_by<>p_actor then raise insufficient_privilege using message='Reconnect with the connector owner'; end if;
 perform 1 from public.datasets where id=c.dataset_id for update;
 perform 1 from public.connectors where id=c.id for update;
 if exists(select 1 from public.sync_runs where connector_id=c.id and status='running' and started_at>now()-interval '5 minutes') then raise check_violation using message='Sync in progress'; end if;
 if p_action='pause' then update public.connectors set status='paused' where id=c.id; return; end if;
 if p_action<>'review' or p_schema is null or p_schema !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_mapping) is distinct from 'object'
  or coalesce(p_mapping->>'caseId','')='' or coalesce(p_mapping->>'activity','')='' or coalesce(p_mapping->>'timestamp','')=''
 then raise check_violation; end if;
 select * into strict m from public.connector_mappings where connector_id=c.id and active;
 update public.connector_mappings set active=false where id=m.id;
 insert into public.connector_mappings(organization_id,connector_id,version,source_schema_hash,canonical_mapping,identity_config,created_by)
 values(c.organization_id,c.id,m.version+1,p_schema,p_mapping,m.identity_config,p_actor);
 update public.connectors set status='active',updated_at=clock_timestamp() where id=c.id;
 update public.connector_sync_state set consecutive_failures=0,next_sync_at=case when c.sync_mode='scheduled' then now() else null end where connector_id=c.id;
end $$;

create function public.sheets_oauth_state_server(p_actor uuid,p_process uuid,p_hash text,p_cipher text default null) returns text language sql security invoker set search_path='' as $$ select private.sheets_oauth_state_server(p_actor,p_process,p_hash,p_cipher); $$;
revoke all on function private.sheets_oauth_state_server(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.sheets_oauth_state_server(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.sheets_oauth_state_server(uuid,uuid,text,text) to service_role;
grant execute on function public.sheets_oauth_state_server(uuid,uuid,text,text) to service_role;

create function public.sheets_credential_server(p_actor uuid,p_process uuid,p_cipher text default null,p_remove boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.sheets_credential_server(p_actor,p_process,p_cipher,p_remove); $$;
revoke all on function private.sheets_credential_server(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.sheets_credential_server(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.sheets_credential_server(uuid,uuid,text,boolean) to service_role;
grant execute on function public.sheets_credential_server(uuid,uuid,text,boolean) to service_role;

create function public.sheets_create_server(p_actor uuid,p_config jsonb,p_schedule integer,p_process uuid,p_name text,p_pack text,p_mapping jsonb,p_identity jsonb,p_schema_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.sheets_create_server(p_actor,p_config,p_schedule,p_process,p_name,p_pack,p_mapping,p_identity,p_schema_hash); $$;
revoke all on function private.sheets_create_server(uuid,jsonb,integer,uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.sheets_create_server(uuid,jsonb,integer,uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function private.sheets_create_server(uuid,jsonb,integer,uuid,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.sheets_create_server(uuid,jsonb,integer,uuid,text,text,jsonb,jsonb,text) to service_role;

create function public.sheets_start_server(p_actor uuid,p_connector uuid,p_trigger text,p_filename text) returns jsonb language sql security invoker set search_path='' as $$ select private.sheets_start_server(p_actor,p_connector,p_trigger,p_filename); $$;
revoke all on function private.sheets_start_server(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.sheets_start_server(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.sheets_start_server(uuid,uuid,text,text) to service_role;
grant execute on function public.sheets_start_server(uuid,uuid,text,text) to service_role;

create function public.sheets_fail_server(p_actor uuid,p_run uuid,p_code text,p_fetched integer,p_invalid integer) returns jsonb language sql security invoker set search_path='' as $$ select private.sheets_fail_server(p_actor,p_run,p_code,p_fetched,p_invalid); $$;
revoke all on function private.sheets_fail_server(uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.sheets_fail_server(uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function private.sheets_fail_server(uuid,uuid,text,integer,integer) to service_role;
grant execute on function public.sheets_fail_server(uuid,uuid,text,integer,integer) to service_role;

create function public.sheets_snapshot_server(p_actor uuid,p_run uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.sheets_snapshot_server(p_actor,p_run); $$;
revoke all on function private.sheets_snapshot_server(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.sheets_snapshot_server(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.sheets_snapshot_server(uuid,uuid) to service_role;
grant execute on function public.sheets_snapshot_server(uuid,uuid) to service_role;

create function public.sheets_due_server(p_limit integer default 3) returns jsonb language sql security invoker set search_path='' as $$ select private.sheets_due_server(p_limit); $$;
revoke all on function private.sheets_due_server(integer) from public,anon,authenticated,service_role;
revoke all on function public.sheets_due_server(integer) from public,anon,authenticated,service_role;
grant execute on function private.sheets_due_server(integer) to service_role;
grant execute on function public.sheets_due_server(integer) to service_role;

create function public.sheets_control_server(p_actor uuid,p_connector uuid,p_action text,p_mapping jsonb default null,p_schema text default null) returns void language sql security invoker set search_path='' as $$ select private.sheets_control_server(p_actor,p_connector,p_action,p_mapping,p_schema); $$;
revoke all on function private.sheets_control_server(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.sheets_control_server(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function private.sheets_control_server(uuid,uuid,text,jsonb,text) to service_role;
grant execute on function public.sheets_control_server(uuid,uuid,text,jsonb,text) to service_role;
