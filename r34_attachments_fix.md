# Round 34 — Attachments end-to-end fix

## Root cause(s) identified

### 1. (Primary) Signed URLs blocked by storage RLS → files unopenable for all roles
Idea-submission attachments are written by the **service-role admin client** in
`persistIdeaAttachments` at storage keys `evidence/ideas/{ideaId}/{uuid}-{name}`.
The admin write bypasses RLS, so the upload + metadata insert succeed and the
filename shows on every idea-detail page.

Retrieval (`listEvidence`) then generated signed URLs with the **RLS-scoped
session client**. The storage-object read policy from migration `00012`
(`evidence_obj_read`) only permits a read when
`(storage.foldername(name))[1] = auth.uid()` **or** the user is `judge`/`admin`.
Because idea attachments live under the `ideas/…` folder (never the viewer's
uid folder), `createSignedUrl` failed RLS for innovators, evaluators and
supervisors → `url` came back `null` → no open / no preview / no download.
This is exactly the reported bug (name visible, nothing works, all roles).

**Fix:** `listEvidence` keeps the RLS-scoped `SELECT` for authorization (a row
only appears if the caller may see that idea's evidence) and then signs the
object with the **service-role client** (`createAdminClient()`), falling back to
the session client when the service key is unset. Access remains correctly
scoped by the metadata RLS; signing no longer trips storage-object RLS. No DB
migration required.

### 2. "0 KB / 0.0 MB" size display bug
Both detail views always formatted size as `(bytes/1024/1024).toFixed(1) + " MB"`,
so a 20 KB file rendered as `0.0 MB`. Added `formatFileSize()` with adaptive
B / KB / MB units and used it in both renderers.

### 3. XLSX / PPTX silently rejected server-side
`persistIdeaAttachments` allowed only PDF/DOC/DOCX/PNG/JPEG. The new-idea client
form accepts any type (size-only guard), so XLSX/PPTX passed the client and were
rejected server-side with `bad_type`, and the failure was only `console.warn`-ed
(idea still submitted, attachments dropped). Broadened the allow-list to include
XLS/XLSX/PPT/PPTX and added an **extension fallback** (browsers often send empty
or `application/octet-stream` MIME for Office files). Client edit-form validation
+ `accept` attributes updated to match.

### 4. No forced-download / explicit preview affordance
Only a single inline "Download" link existed (no `download` attribute; a
cross-origin signed URL wouldn't honor it anyway). Added a second signed URL via
Supabase's `{ download: filename }` option (sets `Content-Disposition:
attachment`) exposed as `downloadUrl`. UI now shows an **Open preview** link
(images/PDFs, inline, new tab) plus a **Download** button that forces a save for
any type.

## Files changed
- `src/lib/evidence-types.ts` — add `downloadUrl` to `EvidenceWithUrl`; add `formatFileSize()`.
- `src/lib/storage.ts` — `listEvidence` signs via admin client; generates inline + forced-download signed URLs.
- `src/app/[locale]/ideas/new/actions.ts` — broaden allowed MIME set + extension fallback (XLS/XLSX/PPT/PPTX).
- `src/app/[locale]/ideas/[id]/page.tsx` — `AttachmentRow`: `formatFileSize`, Open-preview link + forced Download button (innovator/supervisor detail).
- `src/app/[locale]/evaluator/ideas/[id]/page.tsx` — pass `downloadUrl` + `sizeBytes` to `EvaluationDetail`.
- `src/components/evaluator/evaluation-detail.tsx` — Attachment type + rendering: size, Open-preview, forced Download.
- `src/components/idea-edit-form.tsx` — broaden client ext regex + `accept` to include Office types.
- `messages/en.json`, `messages/ar.json` — add `openPreview` to `common` and `evaluator` namespaces.

## SQL migrations applied
None. The fix is code-only. Migration `00012_evidence_storage.sql` (bucket
`evidence` + `innovation.evidence_attachments` + RLS) is unchanged and already
sufficient; signing with the service-role client removes the storage-RLS
blocker without loosening any policy. (Supabase MCP was not available in this
environment; no migration was needed regardless.)

## Test coverage
- `tsc --noEmit` — passes.
- `next build` — passes.
- `formatFileSize` sanity check: 500B→"500 B", 20480→"20 KB", 204800→"200 KB",
  1048576→"1.0 MB", 15728640→"15 MB", 0/null→"0 KB" (no more "0.0 MB").
- Live upload→retrieve round-trip against Supabase not runnable here (no live env);
  logic traced end-to-end: admin upload → metadata insert → RLS-scoped list →
  admin-signed inline + download URLs → render on all three role detail views
  (innovator/supervisor share `/[locale]/ideas/[id]`; evaluator uses
  `/[locale]/evaluator/ideas/[id]`).

## Related bugs found & fixed
- "0 KB" size display (item #2 above).
- Silent XLSX/PPTX rejection on submit (item #3) — attachments advertised as
  supported were being dropped without a user-visible error.

## Constraints respected
- `schema: 'innovation'` untouched on all Supabase clients.
- No `DEMO_MODE` changes. No edits under `supabase/migrations/**` or `src/lib/reports/**`.
- Bilingual strings added to both `en.json` and `ar.json` (no renames).
- Brand colors / visual identity preserved; layouts remain responsive.
