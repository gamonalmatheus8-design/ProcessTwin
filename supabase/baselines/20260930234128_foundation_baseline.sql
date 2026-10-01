-- V1.5 foundation captured from the application's actual schema, without user data.
-- Apply ONCE to a new Supabase project's empty public schema, then replay migrations.
-- This is a separate prerequisite baseline, not a new entry in existing remote history.
-- Supabase-managed auth/storage schemas and roles must already exist.
do $$ begin
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) then
    raise exception 'Foundation baseline requires an empty public schema';
  end if;
  if to_regclass('auth.users') is null or to_regclass('storage.objects') is null then
    raise exception 'Supabase auth/storage infrastructure required';
  end if;
end $$;
create table public."organizations" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "slug" text not null,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."organization_members" (
 "organization_id" uuid not null,
 "user_id" uuid not null,
 "role" text default 'viewer'::text not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."processes" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "name" text not null,
 "description" text,
 "status" text default 'draft'::text not null,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."analysis_runs" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "dataset_id" uuid not null,
 "status" text default 'pending'::text not null,
 "engine_version" text default 'v1'::text not null,
 "started_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "summary" jsonb default '{}'::jsonb not null,
 "error_message" text,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."process_models" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "dataset_id" uuid not null,
 "analysis_run_id" uuid not null,
 "model_version" text default 'v1'::text not null,
 "graph" jsonb default '{}'::jsonb not null,
 "metrics" jsonb default '{}'::jsonb not null,
 "variants" jsonb default '[]'::jsonb not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."bottlenecks" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "analysis_run_id" uuid not null,
 "activity" text not null,
 "rank" integer not null,
 "score" numeric(5,2) not null,
 "severity" text not null,
 "avg_wait_seconds" bigint,
 "affected_cases" integer,
 "sla_impact_pct" numeric(7,3),
 "rework_rate_pct" numeric(7,3),
 "evidence" jsonb default '{}'::jsonb not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."simulation_scenarios" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "baseline_analysis_run_id" uuid not null,
 "name" text not null,
 "description" text,
 "config" jsonb default '{}'::jsonb not null,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."simulation_runs" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "scenario_id" uuid not null,
 "status" text default 'pending'::text not null,
 "iterations" integer default 500 not null,
 "random_seed" integer,
 "started_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "error_message" text,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."simulation_results" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "simulation_run_id" uuid not null,
 "baseline_metrics" jsonb default '{}'::jsonb not null,
 "simulated_metrics" jsonb default '{}'::jsonb not null,
 "deltas" jsonb default '{}'::jsonb not null,
 "impact_summary" jsonb default '{}'::jsonb not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."insights" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "analysis_run_id" uuid,
 "simulation_run_id" uuid,
 "insight_type" text not null,
 "title" text not null,
 "summary" text not null,
 "evidence" jsonb default '{}'::jsonb not null,
 "confidence" numeric(5,2),
 "created_at" timestamp with time zone default now() not null
);
create table public."datasets" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "name" text not null,
 "source_type" text default 'csv'::text not null,
 "original_filename" text,
 "storage_path" text,
 "row_count" integer default 0 not null,
 "case_count" integer default 0 not null,
 "validation_status" text default 'pending'::text not null,
 "validation_errors" jsonb default '[]'::jsonb not null,
 "column_mapping" jsonb default '{}'::jsonb not null,
 "uploaded_by" uuid not null,
 "created_at" timestamp with time zone default now() not null,
 "dataset_mode" text default 'snapshot'::text not null
);
create table public."sync_runs" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "connector_id" uuid not null,
 "dataset_id" uuid not null,
 "trigger" text not null,
 "status" text default 'queued'::text not null,
 "checkpoint_before" jsonb default '{}'::jsonb not null,
 "checkpoint_after" jsonb default '{}'::jsonb not null,
 "started_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "fetched_count" integer default 0 not null,
 "accepted_count" integer default 0 not null,
 "duplicate_count" integer default 0 not null,
 "updated_count" integer default 0 not null,
 "invalid_count" integer default 0 not null,
 "page_count" integer default 0 not null,
 "error_code" text,
 "error_message" text,
 "created_at" timestamp with time zone default now() not null
);
create table public."process_events" (
 "id" bigint generated always as identity not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "dataset_id" uuid not null,
 "event_index" integer not null,
 "case_id" text not null,
 "activity" text not null,
 "event_time" timestamp with time zone not null,
 "resource" text,
 "lifecycle" text,
 "cost" numeric(18,4),
 "status" text,
 "metadata" jsonb default '{}'::jsonb not null,
 "created_at" timestamp with time zone default now() not null,
 "connector_id" uuid,
 "sync_run_id" uuid,
 "source_event_key" text,
 "source_payload_hash" text,
 "source_updated_at" timestamp with time zone,
 "ingested_at" timestamp with time zone default now() not null
);
create table public."connectors" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "process_id" uuid not null,
 "dataset_id" uuid,
 "type" text not null,
 "name" text not null,
 "status" text default 'draft'::text not null,
 "sync_mode" text default 'manual'::text not null,
 "schedule_minutes" integer,
 "process_pack_id" text,
 "configuration" jsonb default '{}'::jsonb not null,
 "credential_ref" text,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."connector_mappings" (
 "id" uuid default gen_random_uuid() not null,
 "organization_id" uuid not null,
 "connector_id" uuid not null,
 "version" integer not null,
 "source_schema_hash" text not null,
 "canonical_mapping" jsonb default '{}'::jsonb not null,
 "identity_config" jsonb default '{}'::jsonb not null,
 "active" boolean default true not null,
 "created_by" uuid not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."connector_sync_state" (
 "connector_id" uuid not null,
 "organization_id" uuid not null,
 "checkpoint" jsonb default '{}'::jsonb not null,
 "watermark" timestamp with time zone,
 "last_attempt_at" timestamp with time zone,
 "last_success_at" timestamp with time zone,
 "next_sync_at" timestamp with time zone,
 "consecutive_failures" integer default 0 not null,
 "lease_owner" text,
 "lease_until" timestamp with time zone,
 "updated_at" timestamp with time zone default now() not null
);
alter table public."process_events" add constraint "process_events_event_index_check" CHECK ((event_index >= 0));
alter table public."process_events" add constraint "process_events_case_id_check" CHECK ((char_length(TRIM(BOTH FROM case_id)) > 0));
alter table public."process_events" add constraint "process_events_activity_check" CHECK ((char_length(TRIM(BOTH FROM activity)) > 0));
alter table public."process_events" add constraint "process_events_cost_check" CHECK (((cost IS NULL) OR (cost >= (0)::numeric)));
alter table public."process_events" add constraint "process_events_pkey" PRIMARY KEY (id);
alter table public."organizations" add constraint "organizations_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 120)));
alter table public."organizations" add constraint "organizations_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text));
alter table public."organizations" add constraint "organizations_pkey" PRIMARY KEY (id);
alter table public."organizations" add constraint "organizations_slug_key" UNIQUE (slug);
alter table public."organization_members" add constraint "organization_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text, 'viewer'::text])));
alter table public."organization_members" add constraint "organization_members_pkey" PRIMARY KEY (organization_id, user_id);
alter table public."processes" add constraint "processes_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 160)));
alter table public."process_events" add constraint "process_events_dataset_id_event_index_key" UNIQUE (dataset_id, event_index);
alter table public."processes" add constraint "processes_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'analyzing'::text, 'active'::text, 'archived'::text])));
alter table public."processes" add constraint "processes_pkey" PRIMARY KEY (id);
alter table public."processes" add constraint "processes_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."datasets" add constraint "datasets_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 180)));
alter table public."datasets" add constraint "datasets_row_count_check" CHECK ((row_count >= 0));
alter table public."datasets" add constraint "datasets_case_count_check" CHECK ((case_count >= 0));
alter table public."datasets" add constraint "datasets_validation_status_check" CHECK ((validation_status = ANY (ARRAY['pending'::text, 'valid'::text, 'invalid'::text])));
alter table public."datasets" add constraint "datasets_pkey" PRIMARY KEY (id);
alter table public."datasets" add constraint "datasets_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."analysis_runs" add constraint "analysis_runs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])));
alter table public."analysis_runs" add constraint "analysis_runs_check" CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at)));
alter table public."analysis_runs" add constraint "analysis_runs_pkey" PRIMARY KEY (id);
alter table public."analysis_runs" add constraint "analysis_runs_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."process_models" add constraint "process_models_pkey" PRIMARY KEY (id);
alter table public."process_models" add constraint "process_models_analysis_run_id_key" UNIQUE (analysis_run_id);
alter table public."bottlenecks" add constraint "bottlenecks_rank_check" CHECK ((rank > 0));
alter table public."bottlenecks" add constraint "bottlenecks_score_check" CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)));
alter table public."bottlenecks" add constraint "bottlenecks_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
alter table public."bottlenecks" add constraint "bottlenecks_avg_wait_seconds_check" CHECK (((avg_wait_seconds IS NULL) OR (avg_wait_seconds >= 0)));
alter table public."bottlenecks" add constraint "bottlenecks_affected_cases_check" CHECK (((affected_cases IS NULL) OR (affected_cases >= 0)));
alter table public."bottlenecks" add constraint "bottlenecks_pkey" PRIMARY KEY (id);
alter table public."bottlenecks" add constraint "bottlenecks_analysis_run_id_rank_key" UNIQUE (analysis_run_id, rank);
alter table public."simulation_scenarios" add constraint "simulation_scenarios_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 180)));
alter table public."simulation_scenarios" add constraint "simulation_scenarios_pkey" PRIMARY KEY (id);
alter table public."simulation_scenarios" add constraint "simulation_scenarios_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."simulation_runs" add constraint "simulation_runs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])));
alter table public."simulation_runs" add constraint "simulation_runs_iterations_check" CHECK (((iterations >= 1) AND (iterations <= 100000)));
alter table public."simulation_runs" add constraint "simulation_runs_check" CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at)));
alter table public."simulation_runs" add constraint "simulation_runs_pkey" PRIMARY KEY (id);
alter table public."simulation_runs" add constraint "simulation_runs_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."simulation_results" add constraint "simulation_results_pkey" PRIMARY KEY (id);
alter table public."simulation_results" add constraint "simulation_results_simulation_run_id_key" UNIQUE (simulation_run_id);
alter table public."insights" add constraint "insights_insight_type_check" CHECK ((insight_type = ANY (ARRAY['bottleneck'::text, 'anomaly'::text, 'opportunity'::text, 'simulation'::text])));
alter table public."insights" add constraint "insights_confidence_check" CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (100)::numeric))));
alter table public."insights" add constraint "insights_check" CHECK (((analysis_run_id IS NOT NULL) OR (simulation_run_id IS NOT NULL)));
alter table public."insights" add constraint "insights_pkey" PRIMARY KEY (id);
alter table public."datasets" add constraint "datasets_source_type_check" CHECK ((source_type = ANY (ARRAY['csv'::text, 'demo'::text, 'api'::text, 'connector'::text])));
alter table public."datasets" add constraint "datasets_dataset_mode_check" CHECK ((dataset_mode = ANY (ARRAY['snapshot'::text, 'live'::text])));
alter table public."datasets" add constraint "datasets_live_source_check" CHECK (((dataset_mode <> 'live'::text) OR (source_type = 'connector'::text)));
alter table public."datasets" add constraint "datasets_id_process_id_organization_id_key" UNIQUE (id, process_id, organization_id);
alter table public."connectors" add constraint "connectors_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 160)));
alter table public."connectors" add constraint "connectors_type_check" CHECK ((type = ANY (ARRAY['recurring_csv'::text, 'google_sheets'::text, 'rest_api'::text, 'webhook'::text, 'sql_database'::text])));
alter table public."connectors" add constraint "connectors_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'needs_attention'::text, 'needs_reauth'::text, 'disabled'::text])));
alter table public."connectors" add constraint "connectors_sync_mode_check" CHECK ((sync_mode = ANY (ARRAY['manual'::text, 'scheduled'::text, 'push'::text])));
alter table public."connectors" add constraint "connectors_schedule_check" CHECK ((((sync_mode = 'scheduled'::text) AND ((schedule_minutes >= 1) AND (schedule_minutes <= 10080))) OR ((sync_mode <> 'scheduled'::text) AND (schedule_minutes IS NULL))));
alter table public."connectors" add constraint "connectors_process_pack_check" CHECK (((process_pack_id IS NULL) OR (process_pack_id = ANY (ARRAY['production'::text, 'orders'::text, 'deliveries'::text, 'tickets'::text, 'enrollment'::text, 'hiring'::text, 'approvals'::text, 'ecommerce'::text, 'generic'::text]))));
alter table public."connectors" add constraint "connectors_configuration_object_check" CHECK ((jsonb_typeof(configuration) = 'object'::text));
alter table public."connectors" add constraint "connectors_credential_ref_check" CHECK (((credential_ref IS NULL) OR ((char_length(credential_ref) >= 1) AND (char_length(credential_ref) <= 256))));
alter table public."connectors" add constraint "connectors_pkey" PRIMARY KEY (id);
alter table public."connectors" add constraint "connectors_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."connectors" add constraint "connectors_id_process_dataset_org_key" UNIQUE (id, process_id, dataset_id, organization_id);
alter table public."connector_mappings" add constraint "connector_mappings_version_check" CHECK ((version > 0));
alter table public."connector_mappings" add constraint "connector_mappings_schema_hash_check" CHECK ((source_schema_hash ~ '^[0-9a-f]{64}$'::text));
alter table public."connector_mappings" add constraint "connector_mappings_canonical_mapping_object_check" CHECK ((jsonb_typeof(canonical_mapping) = 'object'::text));
alter table public."connector_mappings" add constraint "connector_mappings_identity_config_object_check" CHECK ((jsonb_typeof(identity_config) = 'object'::text));
alter table public."connector_mappings" add constraint "connector_mappings_pkey" PRIMARY KEY (id);
alter table public."connector_mappings" add constraint "connector_mappings_connector_version_key" UNIQUE (connector_id, version);
alter table public."connector_sync_state" add constraint "connector_sync_state_failures_check" CHECK ((consecutive_failures >= 0));
alter table public."connector_sync_state" add constraint "connector_sync_state_checkpoint_object_check" CHECK ((jsonb_typeof(checkpoint) = 'object'::text));
alter table public."connector_sync_state" add constraint "connector_sync_state_lease_check" CHECK ((((lease_owner IS NULL) AND (lease_until IS NULL)) OR ((lease_owner IS NOT NULL) AND (lease_until IS NOT NULL))));
alter table public."connector_sync_state" add constraint "connector_sync_state_pkey" PRIMARY KEY (connector_id);
alter table public."connector_sync_state" add constraint "connector_sync_state_connector_org_key" UNIQUE (connector_id, organization_id);
alter table public."sync_runs" add constraint "sync_runs_trigger_check" CHECK ((trigger = ANY (ARRAY['manual'::text, 'scheduled'::text, 'webhook'::text, 'retry'::text])));
alter table public."sync_runs" add constraint "sync_runs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'partial'::text, 'failed'::text, 'canceled'::text])));
alter table public."sync_runs" add constraint "sync_runs_counts_check" CHECK (((fetched_count >= 0) AND (accepted_count >= 0) AND (duplicate_count >= 0) AND (updated_count >= 0) AND (invalid_count >= 0) AND (page_count >= 0)));
alter table public."sync_runs" add constraint "sync_runs_checkpoint_before_object_check" CHECK ((jsonb_typeof(checkpoint_before) = 'object'::text));
alter table public."sync_runs" add constraint "sync_runs_checkpoint_after_object_check" CHECK ((jsonb_typeof(checkpoint_after) = 'object'::text));
alter table public."sync_runs" add constraint "sync_runs_completed_after_started_check" CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at)));
alter table public."sync_runs" add constraint "sync_runs_pkey" PRIMARY KEY (id);
alter table public."sync_runs" add constraint "sync_runs_id_organization_id_key" UNIQUE (id, organization_id);
alter table public."sync_runs" add constraint "sync_runs_identity_scope_key" UNIQUE (id, connector_id, process_id, dataset_id, organization_id);
alter table public."process_events" add constraint "process_events_source_event_key_check" CHECK (((source_event_key IS NULL) OR ((char_length(source_event_key) >= 1) AND (char_length(source_event_key) <= 128))));
alter table public."process_events" add constraint "process_events_source_payload_hash_check" CHECK (((source_payload_hash IS NULL) OR (source_payload_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public."process_events" add constraint "process_events_connector_provenance_check" CHECK ((((connector_id IS NULL) AND (sync_run_id IS NULL) AND (source_event_key IS NULL) AND (source_payload_hash IS NULL) AND (source_updated_at IS NULL)) OR ((connector_id IS NOT NULL) AND (sync_run_id IS NOT NULL) AND (source_event_key IS NOT NULL) AND (source_payload_hash IS NOT NULL))));
alter table public."process_events" add constraint "process_events_connector_source_key_key" UNIQUE (connector_id, source_event_key);
alter table public."organizations" add constraint "organizations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."organization_members" add constraint "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public."organization_members" add constraint "organization_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."process_events" add constraint "process_events_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."processes" add constraint "processes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public."processes" add constraint "processes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."datasets" add constraint "datasets_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."datasets" add constraint "datasets_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."process_events" add constraint "process_events_dataset_id_organization_id_fkey" FOREIGN KEY (dataset_id, organization_id) REFERENCES datasets(id, organization_id) ON DELETE CASCADE;
alter table public."analysis_runs" add constraint "analysis_runs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."analysis_runs" add constraint "analysis_runs_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."analysis_runs" add constraint "analysis_runs_dataset_id_organization_id_fkey" FOREIGN KEY (dataset_id, organization_id) REFERENCES datasets(id, organization_id) ON DELETE CASCADE;
alter table public."process_models" add constraint "process_models_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."process_models" add constraint "process_models_dataset_id_organization_id_fkey" FOREIGN KEY (dataset_id, organization_id) REFERENCES datasets(id, organization_id) ON DELETE CASCADE;
alter table public."process_models" add constraint "process_models_analysis_run_id_organization_id_fkey" FOREIGN KEY (analysis_run_id, organization_id) REFERENCES analysis_runs(id, organization_id) ON DELETE CASCADE;
alter table public."bottlenecks" add constraint "bottlenecks_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."bottlenecks" add constraint "bottlenecks_analysis_run_id_organization_id_fkey" FOREIGN KEY (analysis_run_id, organization_id) REFERENCES analysis_runs(id, organization_id) ON DELETE CASCADE;
alter table public."simulation_scenarios" add constraint "simulation_scenarios_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."simulation_scenarios" add constraint "simulation_scenarios_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."simulation_scenarios" add constraint "simulation_scenarios_baseline_analysis_run_id_organization_fkey" FOREIGN KEY (baseline_analysis_run_id, organization_id) REFERENCES analysis_runs(id, organization_id) ON DELETE CASCADE;
alter table public."simulation_runs" add constraint "simulation_runs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."simulation_runs" add constraint "simulation_runs_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."simulation_runs" add constraint "simulation_runs_scenario_id_organization_id_fkey" FOREIGN KEY (scenario_id, organization_id) REFERENCES simulation_scenarios(id, organization_id) ON DELETE CASCADE;
alter table public."simulation_results" add constraint "simulation_results_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."simulation_results" add constraint "simulation_results_simulation_run_id_organization_id_fkey" FOREIGN KEY (simulation_run_id, organization_id) REFERENCES simulation_runs(id, organization_id) ON DELETE CASCADE;
alter table public."insights" add constraint "insights_process_id_organization_id_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."insights" add constraint "insights_analysis_run_id_organization_id_fkey" FOREIGN KEY (analysis_run_id, organization_id) REFERENCES analysis_runs(id, organization_id) ON DELETE CASCADE;
alter table public."insights" add constraint "insights_simulation_run_id_organization_id_fkey" FOREIGN KEY (simulation_run_id, organization_id) REFERENCES simulation_runs(id, organization_id) ON DELETE CASCADE;
alter table public."connectors" add constraint "connectors_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."connectors" add constraint "connectors_process_scope_fkey" FOREIGN KEY (process_id, organization_id) REFERENCES processes(id, organization_id) ON DELETE CASCADE;
alter table public."connectors" add constraint "connectors_dataset_scope_fkey" FOREIGN KEY (dataset_id, process_id, organization_id) REFERENCES datasets(id, process_id, organization_id) ON DELETE RESTRICT;
alter table public."connector_mappings" add constraint "connector_mappings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."connector_mappings" add constraint "connector_mappings_connector_scope_fkey" FOREIGN KEY (connector_id, organization_id) REFERENCES connectors(id, organization_id) ON DELETE CASCADE;
alter table public."connector_sync_state" add constraint "connector_sync_state_connector_scope_fkey" FOREIGN KEY (connector_id, organization_id) REFERENCES connectors(id, organization_id) ON DELETE CASCADE;
alter table public."sync_runs" add constraint "sync_runs_connector_scope_fkey" FOREIGN KEY (connector_id, process_id, dataset_id, organization_id) REFERENCES connectors(id, process_id, dataset_id, organization_id) ON DELETE RESTRICT;
alter table public."process_events" add constraint "process_events_connector_scope_fkey" FOREIGN KEY (connector_id, process_id, dataset_id, organization_id) REFERENCES connectors(id, process_id, dataset_id, organization_id) ON DELETE RESTRICT;
alter table public."process_events" add constraint "process_events_sync_run_scope_fkey" FOREIGN KEY (sync_run_id, connector_id, process_id, dataset_id, organization_id) REFERENCES sync_runs(id, connector_id, process_id, dataset_id, organization_id) ON DELETE RESTRICT;
CREATE INDEX simulation_scenarios_process_idx ON public.simulation_scenarios USING btree (process_id, created_at DESC);
CREATE INDEX process_events_sync_run_idx ON public.process_events USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);
CREATE INDEX insights_process_org_idx ON public.insights USING btree (process_id, organization_id);
CREATE INDEX connector_mappings_created_by_idx ON public.connector_mappings USING btree (created_by);
CREATE INDEX organizations_created_by_idx ON public.organizations USING btree (created_by);
CREATE INDEX connectors_org_status_idx ON public.connectors USING btree (organization_id, status);
CREATE INDEX process_events_sync_run_scope_idx ON public.process_events USING btree (sync_run_id, connector_id, process_id, dataset_id, organization_id) WHERE (sync_run_id IS NOT NULL);
CREATE INDEX insights_analysis_org_idx ON public.insights USING btree (analysis_run_id, organization_id);
CREATE UNIQUE INDEX datasets_one_live_per_process_idx ON public.datasets USING btree (process_id) WHERE (dataset_mode = 'live'::text);
CREATE INDEX datasets_process_idx ON public.datasets USING btree (process_id, created_at DESC);
CREATE INDEX analysis_runs_dataset_org_idx ON public.analysis_runs USING btree (dataset_id, organization_id);
CREATE INDEX connector_mappings_connector_org_idx ON public.connector_mappings USING btree (connector_id, organization_id);
CREATE INDEX bottlenecks_process_org_idx ON public.bottlenecks USING btree (process_id, organization_id);
CREATE INDEX simulation_runs_scenario_org_idx ON public.simulation_runs USING btree (scenario_id, organization_id);
CREATE INDEX process_events_connector_time_idx ON public.process_events USING btree (connector_id, event_time) WHERE (connector_id IS NOT NULL);
CREATE INDEX simulation_results_run_org_idx ON public.simulation_results USING btree (simulation_run_id, organization_id);
CREATE INDEX process_events_process_time_idx ON public.process_events USING btree (process_id, event_time);
CREATE INDEX process_events_process_org_idx ON public.process_events USING btree (process_id, organization_id);
CREATE INDEX bottlenecks_analysis_idx ON public.bottlenecks USING btree (analysis_run_id, rank);
CREATE INDEX simulation_runs_created_by_idx ON public.simulation_runs USING btree (created_by);
CREATE INDEX simulation_scenarios_analysis_org_idx ON public.simulation_scenarios USING btree (baseline_analysis_run_id, organization_id);
CREATE INDEX sync_runs_process_created_idx ON public.sync_runs USING btree (process_id, created_at DESC);
CREATE INDEX process_models_dataset_org_idx ON public.process_models USING btree (dataset_id, organization_id);
CREATE INDEX sync_runs_connector_scope_idx ON public.sync_runs USING btree (connector_id, process_id, dataset_id, organization_id);
CREATE INDEX simulation_results_process_org_idx ON public.simulation_results USING btree (process_id, organization_id);
CREATE INDEX process_models_analysis_org_idx ON public.process_models USING btree (analysis_run_id, organization_id);
CREATE INDEX processes_org_idx ON public.processes USING btree (organization_id);
CREATE INDEX process_events_dataset_case_time_idx ON public.process_events USING btree (dataset_id, case_id, event_time, event_index);
CREATE INDEX analysis_runs_created_by_idx ON public.analysis_runs USING btree (created_by);
CREATE INDEX analysis_runs_process_idx ON public.analysis_runs USING btree (process_id, created_at DESC);
CREATE INDEX connector_mappings_connector_idx ON public.connector_mappings USING btree (connector_id, version DESC);
CREATE INDEX insights_simulation_org_idx ON public.insights USING btree (simulation_run_id, organization_id);
CREATE INDEX datasets_uploaded_by_idx ON public.datasets USING btree (uploaded_by);
CREATE INDEX simulation_scenarios_created_by_idx ON public.simulation_scenarios USING btree (created_by);
CREATE INDEX organization_members_user_idx ON public.organization_members USING btree (user_id);
CREATE INDEX analysis_runs_process_org_idx ON public.analysis_runs USING btree (process_id, organization_id);
CREATE INDEX insights_process_idx ON public.insights USING btree (process_id, created_at DESC);
CREATE INDEX processes_created_by_idx ON public.processes USING btree (created_by);
CREATE INDEX process_events_dataset_org_idx ON public.process_events USING btree (dataset_id, organization_id);
CREATE INDEX sync_runs_connector_created_idx ON public.sync_runs USING btree (connector_id, created_at DESC);
CREATE INDEX connectors_process_idx ON public.connectors USING btree (process_id, created_at DESC);
CREATE INDEX bottlenecks_analysis_org_idx ON public.bottlenecks USING btree (analysis_run_id, organization_id);
CREATE UNIQUE INDEX connector_mappings_one_active_idx ON public.connector_mappings USING btree (connector_id) WHERE active;
CREATE INDEX connectors_process_scope_idx ON public.connectors USING btree (process_id, organization_id);
CREATE INDEX process_events_connector_scope_idx ON public.process_events USING btree (connector_id, process_id, dataset_id, organization_id) WHERE (connector_id IS NOT NULL);
CREATE INDEX simulation_runs_process_org_idx ON public.simulation_runs USING btree (process_id, organization_id);
CREATE INDEX simulation_scenarios_process_org_idx ON public.simulation_scenarios USING btree (process_id, organization_id);
CREATE INDEX datasets_process_org_idx ON public.datasets USING btree (process_id, organization_id);
CREATE INDEX simulation_runs_scenario_idx ON public.simulation_runs USING btree (scenario_id, created_at DESC);
CREATE INDEX process_events_process_activity_idx ON public.process_events USING btree (process_id, activity);
CREATE INDEX process_models_process_org_idx ON public.process_models USING btree (process_id, organization_id);
CREATE INDEX connectors_created_by_idx ON public.connectors USING btree (created_by);
CREATE INDEX connectors_dataset_scope_idx ON public.connectors USING btree (dataset_id, process_id, organization_id) WHERE (dataset_id IS NOT NULL);
alter table public."organizations" enable row level security;
alter table public."organization_members" enable row level security;
alter table public."processes" enable row level security;
alter table public."analysis_runs" enable row level security;
alter table public."process_models" enable row level security;
alter table public."bottlenecks" enable row level security;
alter table public."simulation_scenarios" enable row level security;
alter table public."simulation_runs" enable row level security;
alter table public."simulation_results" enable row level security;
alter table public."insights" enable row level security;
alter table public."datasets" enable row level security;
alter table public."sync_runs" enable row level security;
alter table public."process_events" enable row level security;
alter table public."connectors" enable row level security;
alter table public."connector_mappings" enable row level security;
alter table public."connector_sync_state" enable row level security;
create policy "organizations_select" on public."organizations" as PERMISSIVE for SELECT to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "organizations_insert" on public."organizations" as PERMISSIVE for INSERT to authenticated with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "organizations_update" on public."organizations" as PERMISSIVE for UPDATE to authenticated using ((created_by = ( SELECT auth.uid() AS uid))) with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "organizations_delete" on public."organizations" as PERMISSIVE for DELETE to authenticated using ((created_by = ( SELECT auth.uid() AS uid)));
create policy "organization_members_select" on public."organization_members" as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.created_by = ( SELECT auth.uid() AS uid)))))));
create policy "organization_members_insert" on public."organization_members" as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.created_by = ( SELECT auth.uid() AS uid))))));
create policy "organization_members_update" on public."organization_members" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.created_by = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.created_by = ( SELECT auth.uid() AS uid))))));
create policy "organization_members_delete" on public."organization_members" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.created_by = ( SELECT auth.uid() AS uid))))));
create policy "processes_select" on public."processes" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = processes.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "datasets_select" on public."datasets" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = datasets.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "process_events_select" on public."process_events" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_events.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "analysis_runs_select" on public."analysis_runs" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = analysis_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "process_models_select" on public."process_models" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_models.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "bottlenecks_select" on public."bottlenecks" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = bottlenecks.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "simulation_scenarios_select" on public."simulation_scenarios" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_scenarios.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "simulation_runs_select" on public."simulation_runs" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "simulation_results_select" on public."simulation_results" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_results.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "insights_select" on public."insights" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = insights.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "processes_insert" on public."processes" as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = processes.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "processes_update" on public."processes" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = processes.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = processes.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "processes_delete" on public."processes" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = processes.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "datasets_insert" on public."datasets" as PERMISSIVE for INSERT to authenticated with check (((uploaded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = datasets.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "datasets_update" on public."datasets" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = datasets.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = datasets.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "datasets_delete" on public."datasets" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = datasets.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "analysis_runs_insert" on public."analysis_runs" as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = analysis_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "analysis_runs_update" on public."analysis_runs" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = analysis_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = analysis_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "analysis_runs_delete" on public."analysis_runs" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = analysis_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "process_models_insert" on public."process_models" as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_models.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "process_models_update" on public."process_models" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_models.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_models.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "process_models_delete" on public."process_models" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_models.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "bottlenecks_insert" on public."bottlenecks" as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = bottlenecks.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "bottlenecks_update" on public."bottlenecks" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = bottlenecks.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = bottlenecks.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "bottlenecks_delete" on public."bottlenecks" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = bottlenecks.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "simulation_scenarios_insert" on public."simulation_scenarios" as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_scenarios.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "simulation_scenarios_update" on public."simulation_scenarios" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_scenarios.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_scenarios.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "simulation_scenarios_delete" on public."simulation_scenarios" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_scenarios.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "simulation_runs_insert" on public."simulation_runs" as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "simulation_runs_update" on public."simulation_runs" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "simulation_runs_delete" on public."simulation_runs" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "simulation_results_insert" on public."simulation_results" as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_results.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "simulation_results_update" on public."simulation_results" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_results.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_results.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "simulation_results_delete" on public."simulation_results" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = simulation_results.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "insights_insert" on public."insights" as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = insights.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "insights_update" on public."insights" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = insights.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = insights.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))));
create policy "insights_delete" on public."insights" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = insights.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "connectors_select" on public."connectors" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connectors.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "connectors_insert" on public."connectors" as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connectors.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))))));
create policy "connectors_update" on public."connectors" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connectors.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connectors.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "connectors_delete" on public."connectors" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connectors.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "connector_mappings_select" on public."connector_mappings" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connector_mappings.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "connector_mappings_insert" on public."connector_mappings" as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connector_mappings.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))))));
create policy "connector_mappings_update" on public."connector_mappings" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connector_mappings.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))))) with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connector_mappings.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "connector_mappings_delete" on public."connector_mappings" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = connector_mappings.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))));
create policy "sync_runs_select" on public."sync_runs" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = sync_runs.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "process_events_insert" on public."process_events" as PERMISSIVE for INSERT to authenticated with check (((connector_id IS NULL) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_events.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "process_events_update" on public."process_events" as PERMISSIVE for UPDATE to authenticated using (((connector_id IS NULL) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_events.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text]))))))))))) with check (((connector_id IS NULL) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_events.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'analyst'::text])))))))))));
create policy "process_events_delete" on public."process_events" as PERMISSIVE for DELETE to authenticated using (((connector_id IS NULL) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = process_events.organization_id) AND ((o.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM organization_members m
          WHERE ((m.organization_id = o.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))))));
create policy "connector_sync_state_deny_authenticated" on public."connector_sync_state" as PERMISSIVE for ALL to authenticated using (false) with check (false);
revoke all on all tables in schema public from authenticated, anon;

grant INSERT on public."organizations" to authenticated;
grant SELECT on public."organizations" to authenticated;
grant UPDATE on public."organizations" to authenticated;
grant DELETE on public."organizations" to authenticated;
grant INSERT on public."organization_members" to authenticated;
grant SELECT on public."organization_members" to authenticated;
grant UPDATE on public."organization_members" to authenticated;
grant DELETE on public."organization_members" to authenticated;
grant INSERT on public."processes" to authenticated;
grant SELECT on public."processes" to authenticated;
grant UPDATE on public."processes" to authenticated;
grant DELETE on public."processes" to authenticated;
grant INSERT on public."analysis_runs" to authenticated;
grant SELECT on public."analysis_runs" to authenticated;
grant UPDATE on public."analysis_runs" to authenticated;
grant DELETE on public."analysis_runs" to authenticated;
grant INSERT on public."process_models" to authenticated;
grant SELECT on public."process_models" to authenticated;
grant UPDATE on public."process_models" to authenticated;
grant DELETE on public."process_models" to authenticated;
grant INSERT on public."bottlenecks" to authenticated;
grant SELECT on public."bottlenecks" to authenticated;
grant UPDATE on public."bottlenecks" to authenticated;
grant DELETE on public."bottlenecks" to authenticated;
grant INSERT on public."simulation_scenarios" to authenticated;
grant SELECT on public."simulation_scenarios" to authenticated;
grant UPDATE on public."simulation_scenarios" to authenticated;
grant DELETE on public."simulation_scenarios" to authenticated;
grant INSERT on public."simulation_runs" to authenticated;
grant SELECT on public."simulation_runs" to authenticated;
grant UPDATE on public."simulation_runs" to authenticated;
grant DELETE on public."simulation_runs" to authenticated;
grant INSERT on public."simulation_results" to authenticated;
grant SELECT on public."simulation_results" to authenticated;
grant UPDATE on public."simulation_results" to authenticated;
grant DELETE on public."simulation_results" to authenticated;
grant INSERT on public."insights" to authenticated;
grant SELECT on public."insights" to authenticated;
grant UPDATE on public."insights" to authenticated;
grant DELETE on public."insights" to authenticated;
grant INSERT on public."datasets" to authenticated;
grant SELECT on public."datasets" to authenticated;
grant UPDATE on public."datasets" to authenticated;
grant DELETE on public."datasets" to authenticated;
grant SELECT on public."sync_runs" to authenticated;
grant INSERT on public."process_events" to authenticated;
grant SELECT on public."process_events" to authenticated;
grant UPDATE on public."process_events" to authenticated;
grant DELETE on public."process_events" to authenticated;
grant INSERT on public."connectors" to authenticated;
grant SELECT on public."connectors" to authenticated;
grant UPDATE on public."connectors" to authenticated;
grant DELETE on public."connectors" to authenticated;
grant INSERT on public."connector_mappings" to authenticated;
grant SELECT on public."connector_mappings" to authenticated;
grant UPDATE on public."connector_mappings" to authenticated;
grant DELETE on public."connector_mappings" to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('process-datasets','process-datasets',false,10485760,array['text/csv','application/vnd.ms-excel','text/plain'])
on conflict(id) do nothing;
