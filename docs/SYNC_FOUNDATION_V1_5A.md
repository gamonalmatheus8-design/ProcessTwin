# V1.5A.1 — Sync Schema + Idempotency Foundation

## Status

Applied to Supabase project `gqlinlrsvktzqgkikxiw` through reviewed SQL iteration.

Security Advisor after the change: no findings.

The canonical migration file is intentionally not hand-written. It must later be generated/reconciled with the Supabase CLI migration workflow so migration history matches the already-applied remote schema.

## New tables

### connectors

Tenant-scoped connector metadata.

Important properties:
- belongs to one organization and process;
- may point to one long-lived live dataset;
- connector type, status and sync mode are constrained;
- configuration is JSON metadata only;
- credentials are represented only by an opaque `credential_ref`;
- owner/admin manage connector metadata through RLS;
- organization members may read it.

Supported type values:
- recurring_csv
- google_sheets
- rest_api
- webhook
- sql_database

### connector_mappings

Versioned mapping and event identity configuration.

Properties:
- unique version per connector;
- exactly one active mapping via a partial unique index;
- source schema hash is a lowercase SHA-256;
- canonical mapping and identity config are JSON objects;
- members can read;
- owner/admin can manage.

### connector_sync_state

Machine-only synchronization state.

Contains:
- checkpoint;
- watermark;
- last attempt/success;
- next sync;
- consecutive failures;
- lease owner / lease expiry.

Direct authenticated access is denied explicitly. This state is reserved for a trusted background worker.

### sync_runs

Immutable/auditable synchronization history.

Contains:
- connector/process/dataset identity;
- trigger and status;
- checkpoint before/after;
- fetched/accepted/duplicate/updated/invalid counts;
- page count;
- sanitized error information.

Authenticated organization members can read history. Direct client insert/update/delete is revoked; worker-side execution will own mutation.

## datasets changes

Added:

```
dataset_mode: snapshot | live
```

Rules:
- existing datasets default to `snapshot`;
- a `live` dataset must have `source_type = connector`;
- source_type now also accepts `connector`;
- at most one live dataset exists per process in V1.5A.

Manual CSV imports remain snapshots.

## process_events provenance

Added nullable connector-managed provenance:

- connector_id
- sync_run_id
- source_event_key
- source_payload_hash
- source_updated_at
- ingested_at

Manual events:
- connector_id = null
- sync_run_id = null
- source_event_key = null
- source_payload_hash = null

Connector events must have all provenance identifiers required by the connector provenance check.

Composite foreign keys guarantee that a connector event cannot reference a connector or sync run belonging to another process/dataset/organization.

## Database idempotency barrier

The database enforces:

```
UNIQUE(connector_id, source_event_key)
```

This intentionally uses a normal UNIQUE constraint rather than a partial index.

Postgres allows multiple NULL values, therefore manual events with no connector remain unaffected while connector-managed events are unique by logical source event.

This also gives future ingestion code a conflict target compatible with normal Postgres upsert semantics.

## Application idempotency model

Implemented in:

```
src/features/sync/idempotency.ts
```

Strategies:

### source_id

Preferred when provider supplies a stable event ID.

Stored key:

```
source-id:v1:<sha256>
```

### source_fields

For configured stable source columns such as:

```
ticket_id + status + event_time
```

Stored key:

```
source-fields:v1:<sha256>
```

Field order does not alter the result.

### canonical_fingerprint

Fallback based on normalized canonical identity fields:

- caseId
- activity
- timestamp normalized to ISO
- resource
- lifecycle
- status

Stored key:

```
canonical:v1:<sha256>
```

## Payload hash

`source_payload_hash` is SHA-256 over deterministic serialization of the full canonical event payload.

It includes mutable fields such as:
- cost;
- metadata;
- resource/status changes.

Therefore:

same key + same hash
→ duplicate / no-op

same key + different hash
→ update canonical event

missing existing key
→ insert

## Stable serialization

Object keys are recursively sorted.

Undefined object fields are omitted.

Array positions are preserved.

NaN and Infinity are rejected.

Equivalent timestamps are normalized before canonical fingerprint generation.

## RLS hardening

Manual `process_events` operations through authenticated user sessions are only allowed while `connector_id is null`.

This prevents a browser/user session from forging or mutating worker-managed connector provenance.

Trusted background ingestion will later use a server-only worker identity.

## Indexes

Foreign-key covering indexes were added for new composite relationships.

The Performance Advisor now reports only `unused_index` information, expected for newly created tables with no workload yet.

## Next implementation

V1.5A.2:

1. live dataset creation;
2. recurring CSV connector creation;
3. sync run lifecycle;
4. event merge using the idempotency model;
5. deterministic event_index allocation;
6. retry test proving duplicate delivery does not create duplicate process_events.

Do not implement scheduler/queues until recurring CSV proves the ingestion contract.
