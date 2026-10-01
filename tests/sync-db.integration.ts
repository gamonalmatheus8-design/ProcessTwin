import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runCoreCycle } from "@/core/process/cycle";
import { demoSyncIdentity, demoSyncMapping, ordersSync01, ordersSync02 } from "@/features/sync/demo-data";
import { prepareRecurringCsv } from "@/features/sync/recurring-csv";
import { synchronizeRecurringCsv } from "@/features/sync/service";
import type { SupabaseClient } from "@supabase/supabase-js";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || new URL(connectionString).pathname !== "/processtwin_sync_test") throw new Error("TEST_DATABASE_URL must point to the disposable processtwin_sync_test database.");
const pool = new Pool({ connectionString, max: 6 });
let owner: string, analyst: string, viewer: string, outsider: string, org: string, processId: string;
const batch1 = prepareRecurringCsv(ordersSync01, demoSyncMapping, demoSyncIdentity);
const batch2 = prepareRecurringCsv(ordersSync02, demoSyncMapping, demoSyncIdentity);
async function asUser<T>(user: string, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin"); await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
    const result = await work(client); await client.query("commit"); return result;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
async function asServer<T>(actor: string, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin"); await client.query("set local role service_role");
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: "service_role" })]);
    const result = await work(client); await client.query("commit"); return result;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
let referenceContract: unknown;
async function create(client: PoolClient, target = processId) {
  return (await client.query("select public.recurring_csv_create($1,'Test CSV','orders',$2::jsonb,$3::jsonb,$4) as result", [target, JSON.stringify(demoSyncMapping), JSON.stringify(demoSyncIdentity), batch1.schemaHash])).rows[0].result as { connectorId: string; datasetId: string };
}
async function start(client: PoolClient, connector: string) {
  return (await client.query("select public.recurring_csv_start($1,'test.csv') as result", [connector])).rows[0].result;
}
async function merge(client: PoolClient, run: Record<string, string>, batch = batch1, events = batch.records, actor = owner, archive = true) {
  const path = `${run.organization_id}/${run.process_id}/${run.dataset_id}/sync/${run.id}/test.csv`;
  if (archive) await pool.query("insert into storage.objects(bucket_id,name) select 'process-datasets',$1 where not exists(select 1 from storage.objects where bucket_id='process-datasets' and name=$1)", [path]);
  return (await client.query("select public.recurring_csv_merge_server($7,$1,$2::jsonb,$3,$4,$5,$6) as result", [run.id, JSON.stringify(events), batch.fetched, batch.invalid, batch.schemaHash, path, actor])).rows[0].result;
}
async function sync(connector: string, batch = batch1) { const run = await asUser(owner, (c) => start(c, connector)); return asServer(owner, (c) => merge(c, run, batch)); }
beforeAll(async () => {
  const exists = await pool.query("select to_regclass('public.connectors') as table");
  if (exists.rows[0].table) throw new Error("Test database must be empty; refusing to overwrite existing schema.");
  await pool.query(readFileSync("supabase/tests/bootstrap.sql", "utf8"));
  await pool.query(readFileSync("supabase/baselines/20260930234128_foundation_baseline.sql", "utf8"));
  for (const file of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
    if (file.endsWith("recurring_csv_server_boundary.sql")) referenceContract = (await pool.query(readFileSync("supabase/schema-contract.sql", "utf8"))).rows[0].contract;
    await pool.query(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
});
beforeEach(async () => {
  // Only this explicitly named disposable database is truncated, never a connected Supabase project.
  await pool.query("truncate auth.users,storage.objects cascade");
  [owner, analyst, viewer, outsider, org, processId] = Array.from({ length: 6 }, () => randomUUID());
  await pool.query("insert into auth.users(id) select unnest($1::uuid[])", [[owner, analyst, viewer, outsider]]);
  await pool.query("insert into public.organizations(id,name,slug,created_by) values($1,'Sync Test','sync-test',$2)", [org, owner]);
  await pool.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'analyst'),($1,$4,'viewer')", [org, owner, analyst, viewer]);
  await pool.query("insert into public.processes(id,organization_id,name,created_by) values($1,$2,'Sync Process',$3)", [processId, org, owner]);
});
afterAll(async () => { await pool.end(); });

describe("real PostgreSQL recurring CSV RPCs", () => {
  it("browser roles cannot submit fabricated events or analyses through old or server RPCs", async () => {
    const signatures = [
      "recurring_csv_merge(uuid,jsonb,integer,integer,text,text)",
      "recurring_csv_analysis(uuid,bigint,jsonb)",
      "recurring_csv_merge_server(uuid,uuid,jsonb,integer,integer,text,text)",
      "recurring_csv_analysis_server(uuid,uuid,bigint,jsonb)",
    ];
    for (const schema of ["public", "private"]) for (const signature of signatures) {
      const grants = await pool.query("select has_function_privilege('authenticated',$1,'execute') as session,has_function_privilege('anon',$1,'execute') as anon", [`${schema}.${signature}`]);
      expect(grants.rows[0]).toEqual({ session: false, anon: false });
    }
    const connector = await asUser(owner, c => create(c));
    const run = await asUser(owner, c => start(c, connector.connectorId));
    for (const user of [owner, analyst, viewer, outsider]) {
      await expect(asUser(user, c => c.query("select public.recurring_csv_merge($1,'[]',1,0,$2,'fake')", [run.id,batch1.schemaHash]))).rejects.toThrow("permission denied");
      await expect(asUser(user, c => c.query("select public.recurring_csv_analysis_server($1,$2,1,'{}')", [user,run.id]))).rejects.toThrow("permission denied");
    }
    expect((await pool.query("select count(*)::int as n from public.process_events")).rows[0].n).toBe(0);
    expect((await pool.query("select count(*)::int as n from public.analysis_runs")).rows[0].n).toBe(0);
  });
  it("direct live result writes cannot bypass RPC protection; snapshot results remain writable", async () => {
    const connector = await asUser(owner, c => create(c));
    const run = await sync(connector.connectorId);
    const snapshot = await asUser(owner, async c => (await c.query("select public.recurring_csv_snapshot($1) as result", [run.id])).rows[0].result);
    await asServer(owner, c => c.query("select public.recurring_csv_analysis_server($1,$2,$3,$4)", [owner,run.id,snapshot.revision,JSON.stringify(runCoreCycle(snapshot.events))]));
    await expect(asUser(owner, c => c.query("insert into public.analysis_runs(organization_id,process_id,dataset_id,status,created_by) values($1,$2,$3,'completed',$4)", [org,processId,connector.datasetId,owner]))).rejects.toThrow();
    for (const table of ["analysis_runs","process_models","bottlenecks"]) {
      expect(await asUser(owner, async c => (await c.query(`delete from public.${table}`)).rowCount)).toBe(0);
    }
    expect(await asUser(owner, async c => (await c.query("update public.process_models set metrics='{}'")).rowCount)).toBe(0);
    await asUser(owner, async c => {
      const dataset = (await c.query("insert into public.datasets(organization_id,process_id,name,source_type,dataset_mode,uploaded_by) values($1,$2,'Snapshot','csv','snapshot',$3) returning id", [org,processId,owner])).rows[0].id;
      const analysis = (await c.query("insert into public.analysis_runs(organization_id,process_id,dataset_id,status,created_by) values($1,$2,$3,'completed',$4) returning id", [org,processId,dataset,owner])).rows[0].id;
      await c.query("insert into public.process_models(organization_id,process_id,dataset_id,analysis_run_id,model_version,graph,metrics,variants) values($1,$2,$3,$4,'core-v1.1','{}','{}','[]')", [org,processId,dataset,analysis]);
    });
    expect((await pool.query("select count(*)::int as n from public.process_models")).rows[0].n).toBe(2);
  });
  it("trusted server still rejects missing, downgraded and cross-tenant actors", async () => {
    const connector = await asUser(owner, c => create(c));
    const run = await asUser(owner, c => start(c, connector.connectorId));
    for (const actor of [analyst, viewer, outsider, null]) {
      await expect(asServer(owner, c => merge(c, run, batch1, batch1.records, actor as unknown as string))).rejects.toThrow();
    }
    await pool.query("update public.organizations set created_by=$1 where id=$2", [outsider,org]);
    await pool.query("update public.organization_members set role='viewer' where user_id=$1", [owner]);
    await expect(asServer(owner, c => merge(c, run))).rejects.toThrow("Owner/admin");
    expect((await pool.query("select count(*)::int as n from public.process_events")).rows[0].n).toBe(0);
  });
  it("trusted merge refuses a missing archive and new foreign keys have covering indexes", async () => {
    const connector = await asUser(owner, c => create(c));
    const run = await asUser(owner, c => start(c, connector.connectorId));
    await expect(asServer(owner, c => merge(c, run, batch1, batch1.records, owner, false))).rejects.toThrow("Archived CSV required");
    const indexes = await pool.query("select indexname from pg_indexes where tablename='sync_runs' and indexname in ('sync_runs_mapping_idx','sync_runs_analysis_idx')");
    expect(indexes.rows).toHaveLength(2);
  });
  it("baseline refuses a nonempty application schema without modifying it", async () => {
    await expect(pool.query(readFileSync("supabase/baselines/20260930234128_foundation_baseline.sql", "utf8"))).rejects.toThrow("empty public schema");
    expect((await pool.query("select count(*)::int as n from public.organizations")).rows[0].n).toBe(1);
  });
  it("V1.5A.3 prerequisite reproduces the captured remote schema before V1.5A.4", async () => {
    const actual = referenceContract;
    expect(actual).toEqual(JSON.parse(readFileSync("supabase/baselines/schema-contract.json", "utf8")));
  });
  it("session roles cannot truncate tables or install triggers across tenant boundaries", async () => {
    for (const user of [owner, analyst, viewer, outsider]) {
      await expect(asUser(user, (c) => c.query("truncate public.process_events"))).rejects.toThrow("permission denied");
    }
    const grants = await pool.query("select grantee,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('authenticated','anon') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')");
    expect(grants.rows).toHaveLength(0);
    expect((await pool.query("select count(*)::int as n from public.organizations")).rows[0].n).toBe(1);
  });
  it("full service: private upload, real RPC, Core Cycle and durable model", async () => {
    const connector = await asUser(owner, (c) => create(c));
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (!["recurring_csv_start", "recurring_csv_merge_server", "recurring_csv_fail", "recurring_csv_snapshot", "recurring_csv_analysis_server"].includes(name)) throw new Error("Unexpected RPC");
        try { return { data: await (name.endsWith("_server") ? asServer : asUser)(owner, async (c) => (await c.query(`select public.${name}(${Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(",")}) as result`, Object.values(args).map((value) => value && typeof value === "object" ? JSON.stringify(value) : value))).rows[0].result), error: null }; }
        catch (error) { return { data: null, error }; }
      },
      storage: { from: (bucket: string) => ({ upload: async (path: string) => { try { await asUser(owner, (c) => c.query("insert into storage.objects(bucket_id,name) values($1,$2)", [bucket, path])); return { error: null }; } catch (error) { return { error }; } } }) },
    } as unknown as SupabaseClient;
    const mapping = { canonical_mapping: demoSyncMapping, identity_config: demoSyncIdentity, source_schema_hash: batch1.schemaHash };
    const first = await synchronizeRecurringCsv({ client, writer: { client, actorId: owner }, connectorId: connector.connectorId, file: new File([ordersSync01], "orders-sync-01.csv"), mapping });
    const second = await synchronizeRecurringCsv({ client, writer: { client, actorId: owner }, connectorId: connector.connectorId, file: new File([ordersSync02], "orders-sync-02.csv"), mapping });
    const duplicate = await synchronizeRecurringCsv({ client, writer: { client, actorId: owner }, connectorId: connector.connectorId, file: new File([ordersSync02], "orders-sync-02.csv"), mapping });
    expect(first).toMatchObject({ analysisExecuted: true, run: { accepted_count: 100 } });
    expect(second).toMatchObject({ analysisExecuted: true, run: { accepted_count: 20, updated_count: 3, duplicate_count: 100 } });
    expect(duplicate).toMatchObject({ analysisExecuted: false, run: { accepted_count: 0, updated_count: 0, duplicate_count: 123 } });
    expect((await pool.query("select metrics->>'eventCount' as n from public.process_models order by created_at desc limit 1")).rows[0].n).toBe("120");
    expect((await pool.query("select count(*)::int as n from public.analysis_runs")).rows[0].n).toBe(2);
    expect((await pool.query("select count(*)::int as n from storage.objects")).rows[0].n).toBe(3);
  });
  it("100 then 123: 120 durable canonical events, no duplicate rows", async () => {
    const connector = await asUser(owner, (c) => create(c));
    expect(await sync(connector.connectorId)).toMatchObject({ fetched_count: 100, accepted_count: 100, duplicate_count: 0, updated_count: 0 });
    expect(await sync(connector.connectorId, batch2)).toMatchObject({ fetched_count: 123, accepted_count: 20, duplicate_count: 100, updated_count: 3 });
    const stored = await pool.query("select count(*)::int as events,count(distinct event_index)::int as indexes from public.process_events where dataset_id=$1", [connector.datasetId]);
    expect(stored.rows[0]).toEqual({ events: 120, indexes: 120 });
    expect(await sync(connector.connectorId, batch2)).toMatchObject({ accepted_count: 0, updated_count: 0, duplicate_count: 123, analysis_status: "skipped" });
  });
  it("same CSV twice, reordered rows, and exact-run response retry are no-ops", async () => {
    const connector = await asUser(owner, (c) => create(c));
    const run = await asUser(owner, (c) => start(c, connector.connectorId));
    await asServer(owner, (c) => merge(c, run));
    expect(await asServer(owner, (c) => merge(c, run))).toMatchObject({ accepted_count: 100 });
    const next = await asUser(owner, (c) => start(c, connector.connectorId));
    expect(await asServer(owner, (c) => merge(c, next, batch1, [...batch1.records].reverse()))).toMatchObject({ accepted_count: 0, updated_count: 0, duplicate_count: 100 });
  });
  it("two concurrent requests on same connector serialize and retain unique indexes", async () => {
    const connector = await asUser(owner, (c) => create(c));
    const a = await asUser(owner, (c) => start(c, connector.connectorId));
    const b = await asUser(owner, (c) => start(c, connector.connectorId));
    let release!: () => void;
    const locked = new Promise<void>((resolve) => { release = resolve; });
    const first = asServer(owner, async (c) => {
      // RPC holds its dataset lock until this surrounding transaction commits.
      const result = await merge(c, a); release(); await c.query("select pg_sleep(0.2)"); return result;
    });
    await locked;
    const second = asServer(owner, (c) => merge(c, b));
    const results = await Promise.all([first, second]);
    expect(results.map((run) => run.accepted_count).sort()).toEqual([0, 100]);
    expect(results.map((run) => run.duplicate_count).sort()).toEqual([0, 100]);
    expect((await pool.query("select count(*)::int as n,count(distinct event_index)::int as indexes from public.process_events")).rows[0]).toEqual({ n: 100, indexes: 100 });
  });
  it("concurrent connector setup reuses the one live dataset", async () => {
    const results = await Promise.all([asUser(owner, (c) => create(c)), asUser(owner, (c) => create(c))]);
    expect(results[0].datasetId).toBe(results[1].datasetId);
    expect((await pool.query("select count(*)::int as n from public.datasets where dataset_mode='live'")).rows[0].n).toBe(1);
  });
  it("different connectors sharing a dataset allocate indexes under the same lock", async () => {
    const a = await asUser(owner, (c) => create(c)); const b = await asUser(owner, (c) => create(c));
    await Promise.all([sync(a.connectorId), sync(b.connectorId)]);
    expect((await pool.query("select count(*)::int as n,count(distinct event_index)::int as indexes from public.process_events")).rows[0]).toEqual({ n: 200, indexes: 200 });
  });
  it("updates preserve row IDs, source keys, connector and event indexes", async () => {
    const connector = await asUser(owner, (c) => create(c)); await sync(connector.connectorId);
    const before = (await pool.query("select id,event_index,source_event_key,connector_id from public.process_events order by event_index")).rows;
    await sync(connector.connectorId, batch2);
    const after = (await pool.query("select id,event_index,source_event_key,connector_id from public.process_events where event_index<100 order by event_index")).rows;
    expect(after).toEqual(before);
    expect((await pool.query("select resource from public.process_events where event_index=0")).rows[0].resource).toBe("Equipe B");
  });
  it("a failed batch rolls back its earlier inserts, and retry is safe", async () => {
    const connector = await asUser(owner, (c) => create(c)); const run = await asUser(owner, (c) => start(c, connector.connectorId));
    const bad = [...batch1.records]; bad[50] = { ...bad[50], timestamp: "invalid date" };
    await expect(asServer(owner, (c) => merge(c, run, batch1, bad))).rejects.toThrow();
    expect((await pool.query("select count(*)::int as n from public.process_events")).rows[0].n).toBe(0);
    expect(await asServer(owner, (c) => merge(c, run))).toMatchObject({ accepted_count: 100 });
    expect(await sync(connector.connectorId)).toMatchObject({ accepted_count: 0, duplicate_count: 100 });
  });
  it("schema drift closes the run and flags attention without mutating mapping", async () => {
    const connector = await asUser(owner, (c) => create(c)); const run = await asUser(owner, (c) => start(c, connector.connectorId));
    const failed = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_fail($1,'schema_drift',100,0) as result", [run.id])).rows[0].result);
    expect(failed).toMatchObject({ status: "failed", error_message: "O arquivo mudou e o mapeamento precisa ser revisado." });
    expect(failed.completed_at).toBeTruthy();
    expect((await pool.query("select status from public.connectors")).rows[0].status).toBe("needs_attention");
    expect((await pool.query("select canonical_mapping from public.connector_mappings")).rows[0].canonical_mapping).toEqual(demoSyncMapping);
    await expect(asUser(owner, (c) => c.query("update public.connector_mappings set identity_config='{}'"))).rejects.toThrow("frozen");
  });
  it("partial sync counts invalid rows while dataset row_count is canonical count", async () => {
    const connector = await asUser(owner, (c) => create(c));
    const partial = prepareRecurringCsv(ordersSync01.replace("E2,P1,Aprovado", "E2,,Aprovado"), demoSyncMapping, demoSyncIdentity);
    expect(await sync(connector.connectorId, partial)).toMatchObject({ status: "partial", accepted_count: 99, invalid_count: 1 });
    expect((await pool.query("select row_count from public.datasets")).rows[0].row_count).toBe(99);
  });
  it("analysis reads entire dataset; zero changes create no new analysis", async () => {
    const connector = await asUser(owner, (c) => create(c)); await sync(connector.connectorId); const run = await sync(connector.connectorId, batch2);
    const snapshot = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_snapshot($1) as result", [run.id])).rows[0].result);
    expect(snapshot.events).toHaveLength(120);
    const result = runCoreCycle(snapshot.events);
    const persisted = await asServer(owner, async (c) => (await c.query("select public.recurring_csv_analysis_server($4,$1,$2,$3) as result", [run.id, snapshot.revision, JSON.stringify(result), owner])).rows[0].result);
    expect(persisted.analysis_status).toBe("succeeded");
    const duplicate = await sync(connector.connectorId, batch2);
    const noSnapshot = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_snapshot($1) as result", [duplicate.id])).rows[0].result);
    expect(noSnapshot).toBeNull();
    expect((await pool.query("select count(*)::int as n from public.analysis_runs")).rows[0].n).toBe(1);
  });
  it("analysis failure leaves ingestion valid and explicit retry persists analysis atomically", async () => {
    const connector = await asUser(owner, (c) => create(c)); const run = await sync(connector.connectorId);
    await asServer(owner, (c) => c.query("select public.recurring_csv_analysis_server($2,$1,0,null)", [run.id, owner]));
    expect((await pool.query("select status,analysis_status from public.sync_runs")).rows[0]).toEqual({ status: "succeeded", analysis_status: "failed" });
    expect((await pool.query("select count(*)::int as n from public.process_events")).rows[0].n).toBe(100);
    await sync(connector.connectorId);
    const snapshot = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_snapshot($1) as result", [run.id])).rows[0].result);
    await asServer(owner, (c) => c.query("select public.recurring_csv_analysis_server($4,$1,$2,$3)", [run.id, snapshot.revision, JSON.stringify(runCoreCycle(snapshot.events)), owner]));
    expect((await pool.query("select count(*)::int as n from public.process_models")).rows[0].n).toBe(1);
  });
  it("stale analysis cannot replace newer live dataset revision", async () => {
    const connector = await asUser(owner, (c) => create(c)); const first = await sync(connector.connectorId);
    const snapshot = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_snapshot($1) as result", [first.id])).rows[0].result);
    await sync(connector.connectorId, batch2);
    const stale = await asServer(owner, async (c) => (await c.query("select public.recurring_csv_analysis_server($4,$1,$2,$3) as result", [first.id, snapshot.revision, JSON.stringify(runCoreCycle(snapshot.events)), owner])).rows[0].result);
    expect(stale.analysis_status).toBe("superseded");
    expect((await pool.query("select count(*)::int as n from public.analysis_runs")).rows[0].n).toBe(0);
  });
  it("a sibling run closes as superseded when the live revision was already analyzed", async () => {
    const connector = await asUser(owner, (c) => create(c));
    const first = await sync(connector.connectorId);
    const second = await sync(connector.connectorId, batch2);
    const snapshot = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_snapshot($1) as result", [second.id])).rows[0].result);
    await asServer(owner, (c) => c.query("select public.recurring_csv_analysis_server($4,$1,$2,$3)", [second.id, snapshot.revision, JSON.stringify(runCoreCycle(snapshot.events)), owner]));
    const superseded = await asUser(owner, async (c) => (await c.query("select public.recurring_csv_snapshot($1) as result", [first.id])).rows[0].result);
    expect(superseded.run.analysis_status).toBe("superseded");
    expect(superseded.events).toBeUndefined();
    expect((await pool.query("select count(*)::int as n from public.analysis_runs")).rows[0].n).toBe(1);
  });
  it("analyst/viewer/cross-tenant/anonymous cannot execute sync mutations", async () => {
    for (const user of [analyst, viewer, outsider]) await expect(asUser(user, (c) => create(c))).rejects.toThrow("Owner/admin");
    const permission = await pool.query("select has_function_privilege('anon','public.recurring_csv_create(uuid,text,text,jsonb,jsonb,text)','execute') as allowed");
    expect(permission.rows[0].allowed).toBe(false);
  });
  it("admin can configure and sync while account bootstrap and snapshot intake retain RLS", async () => {
    await pool.query("update public.organization_members set role='admin' where user_id=$1", [analyst]);
    const connector = await asUser(analyst, (c) => create(c));
    const run = await asUser(analyst, (c) => start(c, connector.connectorId));
    expect(await asServer(analyst, (c) => merge(c, run, batch1, batch1.records, analyst))).toMatchObject({ accepted_count: 100 });
    await asUser(owner, async (c) => {
      const other = (await c.query("insert into public.organizations(name,slug,created_by) values('Account Bootstrap','bootstrap-test',$1) returning id", [owner])).rows[0].id;
      await c.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')", [other, owner]);
    });
    await asUser(analyst, async (c) => {
      const dataset = (await c.query("insert into public.datasets(organization_id,process_id,name,source_type,dataset_mode,uploaded_by) values($1,$2,'Manual Snapshot','csv','snapshot',$3) returning id", [org, processId, analyst])).rows[0].id;
      await c.query("insert into public.process_events(organization_id,process_id,dataset_id,event_index,case_id,activity,event_time) values($1,$2,$3,0,'P1','Snapshot',now())", [org, processId, dataset]);
    });
  });
  it("an abandoned running request is closed on the next manual attempt", async () => {
    const connector = await asUser(owner, (c) => create(c)); const abandoned = await asUser(owner, (c) => start(c, connector.connectorId));
    await pool.query("update public.sync_runs set started_at=now()-interval '6 minutes' where id=$1", [abandoned.id]);
    await asUser(owner, (c) => start(c, connector.connectorId));
    const run = (await pool.query("select status,error_code,completed_at from public.sync_runs where id=$1", [abandoned.id])).rows[0];
    expect(run.status).toBe("failed"); expect(run.error_code).toBe("request_expired"); expect(run.completed_at).toBeTruthy();
  });
  it("viewer can read same-tenant history, outsider cannot; direct run/event/live writes fail", async () => {
    const connector = await asUser(owner, (c) => create(c)); await sync(connector.connectorId);
    expect(await asUser(viewer, async (c) => (await c.query("select * from public.sync_runs")).rowCount)).toBe(1);
    expect(await asUser(outsider, async (c) => (await c.query("select * from public.sync_runs")).rowCount)).toBe(0);
    await expect(asUser(owner, (c) => c.query("insert into public.process_events(organization_id,process_id,dataset_id,event_index,case_id,activity,event_time) values($1,$2,$3,200,'FAKE','FAKE',now())", [org, processId, connector.datasetId]))).rejects.toThrow();
    expect(await asUser(owner, async (c) => (await c.query("update public.datasets set row_count=999 where id=$1", [connector.datasetId])).rowCount)).toBe(0);
    await expect(asUser(owner, (c) => c.query("update public.sync_runs set status='running'"))).rejects.toThrow();
  });
  it("private Storage RLS accepts own path and rejects cross-tenant/viewer uploads", async () => {
    const path = `${org}/${processId}/dataset/sync/run/test.csv`;
    await asUser(owner, (c) => c.query("insert into storage.objects(bucket_id,name) values('process-datasets',$1)", [path]));
    expect(await asUser(viewer, async (c) => (await c.query("select * from storage.objects")).rowCount)).toBe(1);
    await expect(asUser(viewer, (c) => c.query("insert into storage.objects(bucket_id,name) values('process-datasets',$1)", [path + '-viewer']))).rejects.toThrow();
    await expect(asUser(outsider, (c) => c.query("insert into storage.objects(bucket_id,name) values('process-datasets',$1)", [path + '-outsider']))).rejects.toThrow();
    expect((await pool.query("select public from storage.buckets where id='process-datasets'")).rows[0].public).toBe(false);
  });
});

async function createSheet(schedule: number | null = 1440) {
  return asServer(owner, async c => {
    await c.query("select public.sheets_credential_server($1,$2,$3)", [owner,processId,'v1.'+'x'.repeat(80)]);
    return (await c.query("select public.sheets_create_server($1,$2,$3,$4,'Test Sheets','orders',$5,$6,$7) as result", [owner,JSON.stringify({spreadsheetId:'a'.repeat(30),sheetName:'Orders',range:'bounded-v1'}),schedule,processId,JSON.stringify(demoSyncMapping),JSON.stringify(demoSyncIdentity),batch1.schemaHash])).rows[0].result;
  });
}
async function startSheet(connectorId: string, trigger = 'manual') {
  return asServer(owner, async c => (await c.query("select public.sheets_start_server($1,$2,$3,'test.csv') as result", [owner,connectorId,trigger])).rows[0].result);
}
describe('real Google Sheets server RPC and scheduling boundaries', () => {
  it('isolates encrypted credentials and OAuth states from every session role and other tenants', async () => {
    await createSheet();
    for (const user of [owner,analyst,viewer,outsider]) {
      await expect(asUser(user,c=>c.query("select * from private.sheets_credentials"))).rejects.toThrow('permission denied');
      await expect(asUser(user,c=>c.query("select public.sheets_credential_server($1,$2)",[user,processId]))).rejects.toThrow('permission denied');
    }
    await expect(asServer(outsider,c=>c.query("select public.sheets_credential_server($1,$2)",[outsider,processId]))).rejects.toThrow('Owner/admin');
  });
  it('binds expiring OAuth state to the actor and process and consumes it exactly once', async () => {
    const hash = 'a'.repeat(64);
    await asServer(owner,c=>c.query("select public.sheets_oauth_state_server($1,$2,$3,'cipher')",[owner,processId,hash]));
    await expect(asServer(outsider,c=>c.query("select public.sheets_oauth_state_server($1,$2,$3)",[outsider,processId,hash]))).rejects.toThrow();
    const result = await asServer(owner,c=>c.query("select public.sheets_oauth_state_server($1,$2,$3) as token",[owner,processId,hash]));
    expect(result.rows[0].token).toBe('cipher');
    await expect(asServer(owner,c=>c.query("select public.sheets_oauth_state_server($1,$2,$3)",[owner,processId,hash]))).rejects.toThrow('Invalid OAuth');
    await asServer(owner,c=>c.query("select public.sheets_oauth_state_server($1,$2,$3,'cipher')",[owner,processId,hash]));
    await pool.query("update private.sheets_oauth_states set expires_at=now()-interval '1 second'");
    await expect(asServer(owner,c=>c.query("select public.sheets_oauth_state_server($1,$2,$3)",[owner,processId,hash]))).rejects.toThrow('Invalid OAuth');
  });
  it('serializes manual and scheduled starts and recovers abandoned executions', async () => {
    const sheet = await createSheet();
    const results = await Promise.allSettled([startSheet(sheet.connectorId),startSheet(sheet.connectorId,'scheduled')]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect((await pool.query("select count(*)::int n from public.sync_runs where status='running'")).rows[0].n).toBe(1);
    await pool.query("update public.sync_runs set started_at=now()-interval '6 minutes'");
    await startSheet(sheet.connectorId);
    expect((await pool.query("select error_code from public.sync_runs where status='failed'")).rows[0].error_code).toBe('request_expired');
  });
  it('merges archived Sheets events idempotently and derives the complete snapshot', async () => {
    const sheet = await createSheet(); const first = await startSheet(sheet.connectorId);
    const merged = await asServer(owner,c=>merge(c,first)); expect(merged.accepted_count).toBe(100);
    const snapshot = await asServer(owner,async c=>(await c.query("select public.sheets_snapshot_server($1,$2) as result",[owner,first.id])).rows[0].result);
    expect(snapshot.events).toHaveLength(100);
    await asServer(owner,c=>c.query("select public.recurring_csv_analysis_server($1,$2,$3,$4)",[owner,first.id,snapshot.revision,JSON.stringify(runCoreCycle(snapshot.events))]));
    const second=await startSheet(sheet.connectorId); const duplicate=await asServer(owner,c=>merge(c,second));
    expect(duplicate.duplicate_count).toBe(100); expect(duplicate.analysis_status).toBe('skipped');
    expect((await pool.query("select count(*)::int n from public.analysis_runs")).rows[0].n).toBe(1);
  });
  it('schema drift stops scheduling; explicit review versions the mapping and preserves identity', async () => {
    const sheet=await createSheet(); const run=await startSheet(sheet.connectorId);
    await asServer(owner,c=>c.query("select public.sheets_fail_server($1,$2,'schema_drift',0,0)",[owner,run.id]));
    expect((await pool.query("select status from public.connectors where id=$1",[sheet.connectorId])).rows[0].status).toBe('needs_attention');
    await pool.query("update public.connector_sync_state set next_sync_at=now()-interval '1 day'");
    expect((await asServer(owner,c=>c.query("select public.sheets_due_server() as result"))).rows[0].result).toEqual([]);
    await expect(startSheet(sheet.connectorId)).rejects.toThrow();
    await expect(asUser(owner,c=>c.query("update public.connector_mappings set canonical_mapping='{}' where connector_id=$1",[sheet.connectorId]))).rejects.toThrow('frozen');
    await asServer(owner,c=>c.query("select public.sheets_control_server($1,$2,'review',$3,$4)",[owner,sheet.connectorId,JSON.stringify(demoSyncMapping),batch1.schemaHash]));
    const mappings=(await pool.query("select version,active,identity_config from public.connector_mappings where connector_id=$1 order by version",[sheet.connectorId])).rows;
    expect(mappings.map(m=>[m.version,m.active])).toEqual([[1,false],[2,true]]); expect(mappings[1].identity_config).toEqual(demoSyncIdentity);
    const resumed=await startSheet(sheet.connectorId); const merged=await asServer(owner,c=>merge(c,resumed)); expect(merged.accepted_count).toBe(100);
  });
  it('limits recurring temporary failures and rechecks revoked scheduled actor permissions', async () => {
    const sheet=await createSheet();
    for(let n=0;n<3;n++){const run=await startSheet(sheet.connectorId);await asServer(owner,c=>c.query("select public.sheets_fail_server($1,$2,'source_temporary',0,0)",[owner,run.id]));}
    expect((await pool.query("select status from public.connectors where id=$1",[sheet.connectorId])).rows[0].status).toBe('needs_attention');
    const another=await createSheet(null);
    await pool.query("update public.organizations set created_by=$1 where id=$2",[outsider,org]);
    await pool.query("update public.organization_members set role='viewer' where user_id=$1",[owner]);
    await expect(startSheet(another.connectorId)).rejects.toThrow('Owner/admin');
    expect((await pool.query("select count(*)::int n from public.process_events")).rows[0].n).toBe(0);
  });
  it('requires reauthorization after disconnect and enforces the bounded daily pilot capacity', async () => {
    await createSheet();await createSheet();await createSheet();
    await expect(createSheet()).rejects.toThrow('capacity');
    await asServer(owner,c=>c.query("select public.sheets_credential_server($1,$2,null,true)",[owner,processId]));
    expect((await pool.query("select count(*)::int n from private.sheets_credentials")).rows[0].n).toBe(0);
    expect((await pool.query("select count(*)::int n from public.connectors where status='needs_reauth'")).rows[0].n).toBe(3);
  });
});
