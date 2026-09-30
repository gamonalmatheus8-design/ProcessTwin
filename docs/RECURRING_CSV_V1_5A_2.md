# V1.5A.2 — Recurring CSV

## Architecture

The existing V1.5A.1 foundation and V1.4 parser, validation, Auto Mapping V2 and Core Cycle remain in use.

`/processes/[processId]/connectors` configures a manual `recurring_csv` source through six steps: source, file, mapping, event identity, review, sync. Other connector types remain unavailable. The same service handles initial and subsequent uploads; subsequent uploads load the saved configuration and never run Auto Mapping again.

`POST /api/processes/[processId]/connectors` authenticates with `getUser`, derives the organization from the selected process, enforces Owner/Admin, reparses the file, validates the frozen configuration, archives the CSV privately, merges it, then separately analyzes the full live dataset.

No service/secret key is required. No worker, cron, queue, scheduler, OAuth, monitoring or automation layer is introduced.

## Database boundary and concurrency

Public RPC wrappers are `SECURITY INVOKER`, granted only to `authenticated`; `PUBLIC` and `anon` execution is revoked. The privileged implementation is in the unexposed `private` schema, with empty search paths and explicit `auth.uid()`/Owner/Admin checks. This deliberate narrow `SECURITY DEFINER` boundary is required because the foundation denies direct authenticated writes to connector events and sync runs. Organization, process and dataset are resolved from the connector/run, rather than supplied by the caller. Viewer and Analyst remain read-only for sync in this release.

RPCs:

- `recurring_csv_create`: locks the process and creates/reuses the live dataset with `ON CONFLICT (process_id) WHERE dataset_mode='live' DO NOTHING`, protected by the existing partial UNIQUE index; creates the draft connector and mapping version 1 atomically.
- `recurring_csv_start`: durably creates a running manual run, captures mapping ID and updates last attempt. Abandoned requests older than five minutes are failed on the next manual attempt.
- `recurring_csv_merge`: locks dataset, connector, run in that order, validates their complete scope, and merges the whole batch in one transaction. It commits events, counts, dataset metadata, revision, active status and last success together.
- `recurring_csv_fail`: records a sanitized failure. If the merge already committed but its response was lost, this function returns the committed result instead of overwriting it as failed.
- `recurring_csv_snapshot`: loads every canonical event in one database snapshot, returning JSON rather than a truncated PostgREST page.
- `recurring_csv_analysis`: atomically persists analysis run, model and primary bottleneck, or records downstream failure independently of ingestion. A revision check prevents stale calculations from publishing over newer data.

Each merge serializes on the live dataset row. Therefore same-connector races and different connectors sharing the dataset use the same allocation lock. `max(event_index)+1` is computed **inside that exclusive lock**, and every new event gets the next index. Updates preserve event index, primary key, connector ID and source key. UNIQUE constraints provide additional barriers for `(connector_id, source_event_key)` and `(dataset_id, event_index)`.

Restrictive RLS policies prevent direct client mutation of live datasets or insertion of manual events into them, so direct writes cannot bypass the allocation protocol. Snapshot permissions stay unchanged. Recurring mapping/identity and connector scope are frozen by triggers. A batch containing conflicting payloads for one identity is rejected; repeating identical records is allowed and counted as duplicates.

## Identity and schema

The existing `idempotency.ts` is unchanged. `source_id`, `source_fields` and `canonical_fingerprint` retain their existing SHA-256 formats. Field ordering does not affect composite identity, and CSV row number is never used as identity. In automatic mode, a correction to an identity field creates a different identity; stable source IDs are recommended to recognize such corrections as updates.

The schema hash uses normalized, sorted headers and SHA-256. Added unmapped columns are compatible and do not change canonical hashes. Missing any configured column, including resource or identity fields, fails the run and marks the connector `needs_attention`, without changing mapping or events. Returning to a compatible schema allows sync to recover. A mapping-revision editing workflow is deferred.

The first version maps Case ID, activity, timestamp and optional resource. The merge can also update lifecycle, cost, status, metadata and source-updated timestamp when present in its canonical payload; configuring these extra fields from CSV is deferred. Existing canonical provenance fields are not repurposed.

## Metadata, validation and audit

For live datasets, `row_count` is the current number of canonical stored events and `case_count` is the distinct case count across the entire dataset. These are not the size of the latest upload. There are no existing `valid_row_count` or `invalid_row_count` columns; per-upload received/accepted/updated/duplicate/invalid counts live in `sync_runs`. Invalid records never enter the canonical store. Snapshot counter semantics remain unchanged.

Valid records are retained with status `partial` when invalid rows are at most 20% of the upload. No valid records, excessive invalid rows, missing mapping columns or malformed schema fail the whole upload. Messages and stored errors contain no raw CSV rows.

Original files use the existing private `process-datasets` bucket at:

`<org>/<process>/<dataset>/sync/<syncRunId>/<sanitized-filename>.csv`

Each run has its own path, upload uses `upsert:false`, and previous files are preserved. Ingesting is blocked if archiving fails. A file archived before a failed merge remains available for audit. Storage RLS is tested for tenant access and viewer restrictions.

## Analysis and history

Accepted + updated = 0 skips Core Cycle and creates no analysis run. Changes load and analyze the entire live dataset. The durable ingestion commit is separate from analysis, so analysis failure does not erase events or cause duplicate ingestion on retry. The UI exposes downstream status and allows explicit analysis retry from result/history. Existing completed analysis artifacts remain immutable.

History shows the latest 50 runs, newest first, including filename, received/new/updated/duplicate/invalid counts, errors and downstream analysis state. Cards show dataset, status, latest attempt, latest success and exact total run count. Manual sources have no next scheduled time.

## Demo and fixtures

`/demo/sync` calls a stateless demo API and retains the canonical store only in page memory. No Supabase persistence occurs. It uses the same CSV preparation and identity module, with an explicitly demo-only in-memory merge. The production concurrency guarantee comes from the PostgreSQL RPC tests, not the demo.

`examples/sync/orders-sync-01.csv`: 100 events.

`examples/sync/orders-sync-02.csv`: 97 unchanged records + 3 additional unchanged duplicate records + 3 corrections + 20 new events = 123 received; 100 duplicates, 3 updates, 20 inserts. Result: 120 canonical events. Repeating this second file yields 123 duplicates and no further analysis. The three additional duplicate records make the requested 123/100/20/3 counters consistent without placing conflicting revisions of one event in the same export.

## Verification

`npm test`, `npm run typecheck`, `npm run build` validate the application. `npm run test:sync-db` additionally requires an **empty disposable database named `processtwin_sync_test`** via `TEST_DATABASE_URL`. It refuses another database name or existing application schema.

The SQL test harness exports the real foundation schema and policies, with minimal test-only auth/storage infrastructure. It is not a production baseline migration. Tests execute the actual migrations/RPCs using independent PostgreSQL connections and real authenticated RLS. The GitHub Actions job provides PostgreSQL 17 and runs this suite. It includes batch rollback/retry, same/different connector races, concurrent live dataset creation, event index preservation, full-dataset analysis, stale analysis rejection, downstream retry, auth roles, tenant isolation, private Storage, account bootstrap and snapshot intake regression. A service integration test runs private upload metadata, real merge RPC, Core Cycle and model persistence together.

The authenticated tests discovered a pre-existing RLS cycle between organizations and organization_members. `fix_membership_rls_recursion` and `fix_membership_write_rls` replace membership policies' organization subqueries with a private auth-bound ownership lookup, preserving the original permissions while breaking that cycle for reads and account bootstrap writes.

Applied migration files match the authoritative remote history:

- `20260928232912_fix_process_datasets_storage_rls.sql`: existing Storage policy migration, filename reconciled to its already-applied remote version.
- `20260930224431_recurring_csv_sync.sql`: live dataset and six RPCs.
- `20260930224623_recurring_csv_hardening.sql`: live-write restrictions, mapping/scope freeze, conflicting identities.
- `20260930230514_fix_membership_rls_recursion.sql`: authenticated organization/member reads.
- `20260930231339_recurring_csv_analysis_state.sql`: closes downstream state when another run has analyzed the revision.
- `20260930231406_fix_membership_write_rls.sql`: account bootstrap/member writes without recursive RLS.

## Limits and inherited debt

- Sync is synchronous and manual: max 4 MB, 20,000 records and 64 columns per upload, with a 60-second route duration. Large live datasets may eventually need background analysis and chunked ingestion.
- A process terminated externally can leave a running record until the next manual attempt closes it; normal caught failures close immediately. There is no cleanup scheduler.
- Mapping revisions, deletion/tombstone reconciliation, optional field mapping, full event revision history and retention management are future work.
- The prior foundation was applied remotely without canonical migration history, as documented in `SYNC_FOUNDATION_V1_5A.md`. These migrations require that foundation. The test harness does not replace the missing full production baseline reconciliation.
- The existing Security Advisor warning for disabled leaked-password protection is unrelated to sync. Compare before/after for **zero new findings** rather than claiming the project has no warnings.
