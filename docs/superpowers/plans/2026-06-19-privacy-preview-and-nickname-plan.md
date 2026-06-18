# Privacy Preview and NickName Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect real housing data from anonymous/guest users while allowing WeChat-compliant browsing, and unify all miniapp user display names on `SysUser.NickName`.

**Architecture:** Add a backend public preview service that returns only region-level aggregation DTOs, then remove anonymous access from real community/property reads. Frontend switches map/list into preview mode for anonymous/guest users and routes protected actions through `ensureCanUse`. Nickname display/edit is centralized on `SysUser.NickName` with minimal backend endpoints.

**Tech Stack:** ASP.NET Core 8 / Admin.NET / Furion / SqlSugar / Mapster backend; uni-app / unibest / Vue 3 / Pinia / wot-design-uni miniapp.

---

## File Structure

Backend files:

- Create: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlPublic\Dto\SlPublicDto.cs` for preview request/response DTOs.
- Create: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlPublic\SlPublicService.cs` for public aggregation endpoints.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Helper\SlAuth.cs` to add normal-user guard.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlCommunity\SlCommunityService.cs` to remove anonymous real reads and require `777+` for page/list/detail.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlProperty\SlPropertyService.cs` to remove anonymous real reads and require `777+` for page/detail.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlAccess\SlAccessService.cs` to add current-user nickname update.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlUserManage\SlUserManageService.cs` and DTO file to return/update `SysUser.NickName` only.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Core\Service\Auth\Dto\LoginUserOutput.cs` and `SysAuthService.cs` to return `NickName`.

Miniapp files:

- Create: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\api\public-preview.ts` for public region preview endpoints.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\types\shenle.ts` for preview DTOs and nickname fields.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\store\auth.ts` for `SysUser.NickName` display and preview capability.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\api\auth.ts` and `src\api\user-manage.ts` for nickname endpoints.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\common\login\index.vue` to stop forcing guests to apply page.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\user\map\index.vue` to support region preview mode.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\admin\property-list\index.vue` to support region preview cards when not allowed real data.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\admin\mine\index.vue` to add self nickname editing.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\admin\user-manage\index.vue` to add target nickname editing.

---

### Task 1: Backend NickName Contract

**Files:** `LoginUserOutput.cs`, `SysAuthService.cs`, `SlAccessService.cs`, `SlUserManageDto.cs`, `SlUserManageService.cs`

- [ ] Add `NickName` property with XML summary to `LoginUserOutput`.
- [ ] Set `NickName = user.NickName` in `SysAuthService.GetUserInfo()`.
- [ ] Add `SetMyNickNameInput` with `[Required]` and `[MaxLength(32)]` to `SlAccess` DTO scope or service file.
- [ ] Add `POST /api/slAccess/setNickName`; read current `UserId`, trim nickname, reject empty, update only `SysUser.NickName`.
- [ ] Add `SetSlUserNickNameInput` to `SlUserManageDto.cs`.
- [ ] Add `POST /api/slUserManage/setNickName`; require super admin, trim nickname, reject empty, update only target `SysUser.NickName`.
- [ ] Change `SlUserManage.Page()` to select `NickName = u.NickName` and search `u.NickName` / `u.Account` only.
- [ ] Run `dotnet build .\ShenLe.sln --no-restore` from `ShenLe\Api`; expected 0 errors.

### Task 2: Backend Public Preview API

**Files:** `SlPublicDto.cs`, `SlPublicService.cs`

- [ ] Create DTOs: `SlPublicRegionQueryInput`, `SlPublicRegionPreviewOutput`.
- [ ] Implement `POST /api/slPublic/regionMap` and `POST /api/slPublic/regionPage` with `[AllowAnonymous]`.
- [ ] Aggregate by `SlRegion`; join active communities and active/available properties (`Status == 0 || Status == 1`).
- [ ] Support filters: `RegionId`, `MinPrice`, `MaxPrice`, optional user `Latitude/Longitude` for approximate distance.
- [ ] Return only region name, region center coordinates, range labels, fuzzy rent labels, and distance labels.
- [ ] Apply privacy thresholds: less than 3 communities or no safe active properties are skipped; counts are bucketed.
- [ ] Run backend build; expected 0 errors.

### Task 3: Backend Real API Guards

**Files:** `SlAuth.cs`, `SlCommunityService.cs`, `SlPropertyService.cs`

- [ ] Add `RequireNormalUser()` to `SlAuth`: account type must be `>= 777`.
- [ ] Remove `[AllowAnonymous]` from `SlCommunity.Page`, `List`, `Detail`.
- [ ] Call `SlAuth.RequireNormalUser()` at the top of real user-side read methods unless `RequireAdmin()` already protects writes.
- [ ] Remove `[AllowAnonymous]` from `SlProperty.Page` and `Detail`.
- [ ] Call `SlAuth.RequireNormalUser()` for real property page/detail.
- [ ] Keep management writes guarded by `RequireAdmin()`.
- [ ] Run backend build; expected 0 errors.

### Task 4: Miniapp Types And API Wrappers

**Files:** `types\shenle.ts`, `api\public-preview.ts`, `api\auth.ts`, `api\user-manage.ts`

- [ ] Add `nickName?: string` to `LoginUserOutput`.
- [ ] Add `SlPublicRegionQueryInput` and `SlPublicRegionPreviewOutput` types.
- [ ] Add `getPublicRegionMap()` and `getPublicRegionPage()` wrappers with `{ auth: false }`.
- [ ] Add `setMyNickName(nickName)` wrapper calling `/api/slAccess/setNickName`.
- [ ] Add `setUserNickName({ userId, nickName })` wrapper calling `/api/slUserManage/setNickName`.
- [ ] Run `pnpm type-check`; expected no type errors for new API signatures.

### Task 5: Miniapp Auth And Guest Flow

**Files:** `store\auth.ts`, `pages\common\login\index.vue`

- [ ] Add `canViewRealData = computed(() => canUseApp.value || isAdmin.value)` to auth store.
- [ ] Change `displayName` to use only `user.value?.nickName` for logged-in users; otherwise `未登录`.
- [ ] Change `toLoginUser()` to set `nickName: session.nickName || ''` and not use `realName` as display substitute.
- [ ] Return `canViewRealData` from the store.
- [ ] In login page, remove guest forced redirect to `/pages/common/apply/index`; redirect guest back to requested page or map.
- [ ] Run `pnpm type-check`; expected no type errors.

### Task 6: Miniapp Preview Map

**Files:** `pages\user\map\index.vue`

- [ ] Add preview state for public region markers and selected preview card.
- [ ] If `!auth.canViewRealData`, load `/api/slPublic/regionMap` instead of `getCommunityPage`.
- [ ] Build marker callouts from region labels, never real community names.
- [ ] On preview marker/card tap, route protected action through `ensureCanUse`.
- [ ] Add guest status strip when `auth.isGuest`.
- [ ] Keep real community map behavior unchanged for `777+` and admins.
- [ ] Run `pnpm type-check`; expected no type errors.

### Task 7: Miniapp Preview List

**Files:** `pages\admin\property-list\index.vue`

- [ ] If `!auth.canViewRealData`, call `/api/slPublic/regionPage` instead of `getCommunityPage`.
- [ ] Render preview region cards instead of `sl-community-card`.
- [ ] Block exact community-name search in preview mode with toast `登录并通过审核后可搜索具体楼盘`.
- [ ] Preserve region and rent filters against public preview query.
- [ ] Route preview card action through `ensureCanUse`.
- [ ] Keep admin/real user list behavior unchanged.
- [ ] Run `pnpm type-check`; expected no type errors.

### Task 8: Mine And User Management NickName UI

**Files:** `pages\admin\mine\index.vue`, `pages\admin\user-manage\index.vue`

- [ ] Add self nickname edit modal/input in mine page.
- [ ] Submit self edit with `setMyNickName`, then `auth.refreshUser()`.
- [ ] Add target nickname edit action in user management cards.
- [ ] Submit target edit with `setUserNickName`; update `item.nickName` immediately on success.
- [ ] Ensure all display text reads `nickName`, not `realName`.
- [ ] Run `pnpm type-check`; expected no type errors.

### Task 9: Full Verification And Commit

**Files:** all changed files

- [ ] Run backend `dotnet build .\ShenLe.sln --no-restore` from `ShenLe\Api`; expected 0 errors.
- [ ] Run miniapp `pnpm type-check`; expected pass.
- [ ] Run miniapp `pnpm build:mp-weixin`; expected pass.
- [ ] Sync `dist/build/mp-weixin` to `dist/dev/mp-weixin` if build script does not already do it.
- [ ] Open WeChat DevTools with MCP and compile; expected `compiled: true`, `errors: []`.
- [ ] Verify anonymous preview page data uses public region records only.
- [ ] Commit backend and miniapp changes separately with clear messages after verification.
