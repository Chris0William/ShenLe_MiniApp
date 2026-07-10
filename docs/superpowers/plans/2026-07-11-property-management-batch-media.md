# Property Management Batch and Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a building-scoped property management workflow with reliable return refresh, transactional batch operations, and persistent video posters without Tencent CI snapshots.

**Architecture:** Reuse the backend batch snapshot/write and media-mount services already present. Keep the mini program state lightweight by publishing typed entity-change events rather than caching every list. Store video posters as child `SysFile` records whose `BelongId` is the video file Id, preserving all existing business media contracts.

**Tech Stack:** ASP.NET Core 8, Furion, SqlSugar, xUnit, uni-app, Vue 3, TypeScript, Pinia, wot-design-uni, WeChat DevTools.

---

### Task 1: Preserve the verified baseline

**Files:** Existing backend and mini-program changes only.

- [x] Run backend focused tests and confirm 213 tests pass.
- [x] Run `dotnet build .\ShenLe.sln --no-restore` and confirm zero errors.
- [x] Run `pnpm type-check` and `pnpm build:mp-weixin`.
- [x] Scan all changed files for UTF-8 BOM.
- [x] Commit backend baseline as `5c0e993` and mini-program version as `b7c9f08`; do not push.

### Task 2: Add pure frontend behavior tests

**Files:**
- Create: `src/utils/__tests__/property-batch.test.ts`
- Create: `src/utils/__tests__/entity-change.test.ts`
- Create: `src/utils/property-batch.ts`
- Create: `src/store/entity-change.ts`

- [ ] Add failing tests for room generation, duplicate detection, snapshot patch merge, media append/replace, and unchanged fields.
- [ ] Run the focused tests and confirm failures are caused by missing implementations.
- [ ] Implement pure generation and merge helpers with a maximum batch size of 200.
- [ ] Add failing tests for entity revision publication and per-page consumption.
- [ ] Implement a Pinia change store with property/community/building revisions and last-change payloads.
- [ ] Run focused tests and type-check.

### Task 3: Stop Tencent CI snapshot requests

**Files:**
- Modify: `src/utils/media.ts`
- Modify: `src/components/sl-community-card/sl-community-card.vue`
- Modify: `src/components/sl-property-card/sl-property-card.vue`
- Modify: `src/pages/common/community-manage/index.vue`
- Modify: `src/pages/common/community-properties/index.vue`
- Modify: `src/pages/common/property-form/index.vue`

- [ ] Add a failing source-contract test proving no runtime helper emits `ci-process=snapshot`.
- [ ] Remove the query construction and use poster fields or an empty poster result.
- [ ] Ensure every video tile has a fixed-size placeholder and play affordance when poster is absent.
- [ ] Verify image covers and video playback remain unchanged.
- [ ] Run tests, type-check, and build.
- [ ] Commit the stop-loss change locally.

### Task 4: Simplify entry flow and property form

**Files:**
- Modify: `src/pages/admin/dashboard/index.vue`
- Modify: `src/pages/admin/property-list/index.vue`
- Modify: `src/pages/common/building-manage/index.vue`
- Modify: `src/pages/common/community-properties/index.vue`
- Modify: `src/pages/common/property-form/index.vue`

- [ ] Add source-contract tests for removed dashboard actions and required building route context.
- [ ] Remove the two dashboard shortcuts and the global property add button.
- [ ] Route admin community selection to building management.
- [ ] Pass building Id/name into the building property page and filter by building Id.
- [ ] Render community, building, and total floors as read-only property-form context.
- [ ] Reject add-form entry without community/building context and retain edit compatibility through detail loading.
- [ ] Replace duplicate media buttons with one `wd-action-sheet` source selector.
- [ ] Run tests, type-check, and build.
- [ ] Commit locally.

### Task 5: Add one-click building creation

**Files:**
- Modify: `src/pages/common/building-manage/index.vue`

- [ ] Add a failing source/pure test for the empty-state visibility rule and same-name payload.
- [ ] Show the action only when a concrete community is selected and its building list is empty.
- [ ] Submit the existing add-building API with the community name, null total floors, normal status, and no media.
- [ ] Guard duplicate taps and reload on duplicate-name races.
- [ ] Run tests, type-check, and build.
- [ ] Commit locally.

### Task 6: Implement reliable return refresh

**Files:**
- Modify: `src/pages/common/property-form/index.vue`
- Modify: `src/pages/common/community-properties/index.vue`
- Modify: `src/pages/admin/property-list/index.vue`
- Modify: `src/pages/admin/sales-control/index.vue`
- Modify: `src/pages/admin/dashboard/index.vue`
- Modify: `src/pages/common/building-manage/index.vue`
- Modify: `src/pages/common/community-manage/index.vue`

- [ ] Add failing tests for deciding between local patch, local removal, and scoped reload.
- [ ] Publish typed changes after add/update/delete/status changes.
- [ ] Replace one edited property in-place after fetching its detail; do not reset pagination.
- [ ] Remove deleted properties locally and adjust totals.
- [ ] For structural reloads, preserve loaded-page count and page scroll offset.
- [ ] Refresh dashboard/building/community counts only when their consumed revision changes.
- [ ] Run tests, type-check, and build.
- [ ] Commit locally.

### Task 7: Wire batch API contracts into the mini program

**Files:**
- Modify: `src/types/shenle.ts`
- Modify: `src/api/property.ts`
- Modify: `src/api/building.ts`
- Modify: `src/api/file.ts`

- [ ] Add failing type/source tests for batch list/add/update/delete and media-draft routes.
- [ ] Add exact DTOs matching the backend response and structured error shapes.
- [ ] Add request wrappers without changing existing single-write wrappers.
- [ ] Run tests and type-check.

### Task 8: Build batch property UI

**Files:**
- Create: `src/components/sl-property-batch/sl-property-batch.vue`
- Modify: `src/pages/common/community-properties/index.vue`
- Reuse: `src/utils/property-batch.ts`

- [ ] Add failing component/source tests for selection mode and disabled actions with no selection.
- [ ] Add batch-add sheet with start floor, floor count, rooms per floor, unit, preview, and offline defaults.
- [ ] Update building total floors before submitting generated rows when required.
- [ ] Add multi-select mode and a batch-edit sheet with explicit field switches.
- [ ] Merge enabled fields into complete batch snapshots before calling batch update.
- [ ] Add media append/replace/clear controls using community media and uploads.
- [ ] Add batch-delete confirmation with selected count and room preview.
- [ ] Apply successful results to the local list and publish structural change events.
- [ ] Run tests, type-check, and build.
- [ ] Commit locally.

### Task 9: Restore landlord media compatibility and multi-target draft reuse

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlMedia/SlMediaMountModels.cs`
- Modify: `Api/ShenLe.Application/Service/SlMedia/SlMediaMountPolicy.cs`
- Modify: `Api/ShenLe.Application/Service/SlMedia/SlMediaMountService.cs`
- Modify: `Api/ShenLe.Application/Service/SlProperty/SlPropertyBatchExecutor.cs`
- Test: `Api/ShenLe.Test/MediaMount/SlMediaMountPolicyTests.cs`
- Test: `Api/ShenLe.Test/MediaMount/SlMediaMountServiceTests.cs`

- [ ] Add a failing test proving a landlord can copy media from the owned source community but not another object.
- [ ] Pass the validated community Id as an allowed source scope for single property writes.
- [ ] Add a failing transaction test for reusing one owned draft media file across multiple rows.
- [ ] Allow later rows to copy the already-claimed draft only when owner and immutable physical metadata still match.
- [ ] Run focused backend tests and build.
- [ ] Commit locally.

### Task 10: Add persistent video poster support

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlMediaDraft/Dto/SlMediaDraftDto.cs`
- Modify: `Api/ShenLe.Application/Service/SlMediaDraft/SlMediaDraftService.cs`
- Modify: `Api/ShenLe.Application/Service/SlMedia/SlMediaMountService.cs`
- Modify: property/community/building media output DTOs and assemblers.
- Modify: `src/api/file.ts`
- Modify: `src/types/shenle.ts`
- Modify: media-rendering components and pages.

- [ ] Add failing backend tests for binding a poster only when video and poster are current-user drafts.
- [ ] Implement `/api/slMediaDraft/bindPoster` by setting poster `BelongId` to the video file Id and `FileType` to `image:video_poster`.
- [ ] Add failing tests proving video copies also copy child poster metadata.
- [ ] Return optional poster file Id/URL in media and cover outputs without changing existing fields.
- [ ] Upload `thumbTempFilePath` after each chosen video and bind it before form submission.
- [ ] Download private posters by poster file Id and render placeholders on failure.
- [ ] Verify compiled output contains no Tencent CI snapshot query.
- [ ] Run backend tests/build and mini-program tests/type-check/build.
- [ ] Commit locally.

### Task 11: Runtime verification and final local commits

**Files:** All files changed by this plan.

- [ ] Scan all changed files for UTF-8 BOM and run `git diff --check`.
- [ ] Run backend focused tests, full build, frontend tests, type-check, and mp-weixin build.
- [ ] Open the project through WeChat DevTools MCP and compile with zero errors.
- [ ] Verify empty-building creation, building-scoped navigation, read-only property ownership, media action sheet, deep-list edit return, batch add/edit/delete, and video placeholder/poster playback.
- [ ] Review diffs for unrelated scan-login or generated artifacts.
- [ ] Create final local commits in backend and mini-program repositories; do not push.

