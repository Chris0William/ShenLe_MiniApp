# Preview Gating Location Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten anonymous/guest preview behavior, remove manual locate buttons, reuse one auto-location result, and show all safe public preview regions.

**Architecture:** Backend keeps real-data isolation and only relaxes public-region aggregation hiding. MiniApp adds one shared location cache utility, a filter-bar gate callback, then wires map and property-list pages to gate protected preview actions while preserving normal-user behavior.

**Tech Stack:** ASP.NET Core 8 / Admin.NET / Furion / SqlSugar, uni-app Vue 3 + TypeScript, Pinia, wot-design-uni, WeChat DevTools MCP.

---

## File Structure

- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlPublic\SlPublicService.cs` — remove the `<3 communities` public-preview suppression without exposing real coordinates or IDs.
- Create: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\utils\location-cache.ts` — shared `uni.getLocation` cache and in-flight request dedupe.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\components\sl-property-filter-bar\sl-property-filter-bar.vue` — add `guarded` and `guardTip` props, block filter interactions when guarded.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\admin\property-list\index.vue` — remove locate button, remove guest strip, use shared location cache, gate choose-location and filters, load all preview regions.
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\user\map\index.vue` — remove locate button, remove guest strip, use shared location cache, gate choose-location and filters.

---

### Task 1: Backend Public Preview Shows Safe Low-Count Regions

**Files:**
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api\ShenLe.Application\Service\SlPublic\SlPublicService.cs`

- [ ] **Step 1: Locate current suppression code**

Run:

```powershell
rg -n "communityCount < 3|safeCommunities|AvailableCountText" Api\ShenLe.Application\Service\SlPublic\SlPublicService.cs
```

Expected: finds the `communityCount < 3` block inside `BuildRegionPreviewAsync`.

- [ ] **Step 2: Remove only the low-count skip**

Replace this block:

```csharp
var safeCommunities = group.Where(c => statMap.ContainsKey(c.Id)).ToList();
var communityCount = safeCommunities.Count;
if (communityCount < 3)
    continue;

var stats = safeCommunities.Select(c => statMap[c.Id]).ToList();
```

With:

```csharp
var safeCommunities = group.Where(c => statMap.ContainsKey(c.Id)).ToList();
var communityCount = safeCommunities.Count;
if (communityCount <= 0)
    continue;

var stats = safeCommunities.Select(c => statMap[c.Id]).ToList();
```

Keep these existing rules unchanged:

```csharp
Longitude = region.CenterLng!.Value,
Latitude = region.CenterLat!.Value,
CommunityCountText = $"{BucketCount(communityCount)} 个楼盘",
AvailableCountText = availableCount < 10 ? "少量房源" : $"{BucketCount(availableCount)} 套",
```

- [ ] **Step 3: Build backend**

Run:

```powershell
cd E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api
dotnet build .\ShenLe.sln --no-restore
```

Expected: build succeeds. If it fails because DLLs are locked, report the locked file/PID and do not kill processes.

- [ ] **Step 4: Do not auto-commit backend**

Per `AGENTS.md`, backend changes stop after verification unless the user explicitly asks to commit. Keep the backend worktree dirty until user gives Git/deploy instruction.

---

### Task 2: Shared MiniApp Location Cache

**Files:**
- Create: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\utils\location-cache.ts`

- [ ] **Step 1: Create shared utility**

Create file with:

```ts
export interface CachedLocation {
  longitude: number
  latitude: number
  label: string
  updatedAt: number
}

let cachedLocation: CachedLocation | null = null
let pendingLocation: Promise<CachedLocation> | null = null

function requestWxLocation(): Promise<CachedLocation> {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      success: res => resolve({
        longitude: res.longitude,
        latitude: res.latitude,
        label: '当前位置',
        updatedAt: Date.now(),
      }),
      fail: reject,
    })
  })
}

export function getCachedLocation() {
  return cachedLocation
}

export async function getLocationOnceCached(force = false) {
  if (!force && cachedLocation)
    return cachedLocation
  if (!force && pendingLocation)
    return pendingLocation

  pendingLocation = requestWxLocation()
    .then((location) => {
      cachedLocation = location
      return location
    })
    .finally(() => {
      pendingLocation = null
    })

  return pendingLocation
}

export function setCachedLocation(longitude: number, latitude: number, label = '选定位置') {
  cachedLocation = { longitude, latitude, label, updatedAt: Date.now() }
  return cachedLocation
}
```

- [ ] **Step 2: Type-check utility alone through project type-check later**

No isolated test runner exists. This is validated by Task 6 `pnpm type-check`.

---

### Task 3: Filter Bar Guard

**Files:**
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\components\sl-property-filter-bar\sl-property-filter-bar.vue`

- [ ] **Step 1: Extend props and emits**

Change props from:

```ts
const props = defineProps<{
  filters: PropertyFilterState
  keyword?: string
  mountKey?: string
}>()
```

To:

```ts
const props = defineProps<{
  filters: PropertyFilterState
  keyword?: string
  mountKey?: string
  guarded?: boolean
  guardTip?: string
}>()
```

Change emits from:

```ts
const emit = defineEmits<{
  confirm: [filters: PropertyFilterState, keyword?: string]
  reset: []
}>()
```

To:

```ts
const emit = defineEmits<{
  confirm: [filters: PropertyFilterState, keyword?: string]
  reset: []
  guarded: [tip?: string]
}>()
```

- [ ] **Step 2: Add a guard helper**

Add below `let trackWidth = 0`:

```ts
function guardInteraction() {
  if (!props.guarded)
    return false
  activeDropdown.value = null
  sheetVisible.value = false
  emit('guarded', props.guardTip)
  return true
}
```

- [ ] **Step 3: Apply guard to interaction methods**

At the top of these functions, add `if (guardInteraction()) return`:

```ts
function toggleDropdown(name: DropdownName) {
  if (guardInteraction())
    return
  // existing body
}

function openSheet() {
  if (guardInteraction())
    return
  // existing body
}

function resetAll() {
  if (guardInteraction())
    return
  // existing body
}
```

- [ ] **Step 4: Guard inline reset click**

Change template reset click from:

```vue
<view class="filter-reset" @tap="emit('reset')">
```

To:

```vue
<view class="filter-reset" @tap="resetAll">
```

The reset action now respects preview gating.

---

### Task 4: Property List Preview Gating and Location Cache

**Files:**
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\admin\property-list\index.vue`

- [ ] **Step 1: Import shared location helpers**

Add:

```ts
import { getLocationOnceCached, setCachedLocation } from '@/utils/location-cache'
```

- [ ] **Step 2: Use all-region preview page size**

Change:

```ts
const pageSize = 10
```

To:

```ts
const pageSize = 200
```

- [ ] **Step 3: Replace `requestLocation` and `autoLocate` implementation**

Remove local `requestLocation()` and replace `autoLocate()` with:

```ts
async function autoLocate() {
  if (locating.value)
    return
  locating.value = true
  try {
    const res = await getLocationOnceCached()
    setReferencePoint(res.longitude, res.latitude, res.label)
    await load(true)
  }
  catch {
    setReferencePoint(DEFAULT_LOCATION.longitude, DEFAULT_LOCATION.latitude, '深圳市中心')
    await load(true)
  }
  finally {
    locating.value = false
  }
}
```

- [ ] **Step 4: Gate manual choose-location**

At the start of `chooseReferencePoint()` add:

```ts
if (isPreviewMode.value) {
  ensureCanUse('登录并通过审核后可选择位置')
  return
}
```

After successful `uni.chooseLocation`, change set call to cache selected point:

```ts
const label = res.name || res.address || '选定位置'
setCachedLocation(res.longitude, res.latitude, label)
setReferencePoint(res.longitude, res.latitude, label)
```

- [ ] **Step 5: Add filter guard handler**

Add:

```ts
function onFilterGuarded(tip?: string) {
  ensureCanUse(tip || '登录并通过审核后可使用筛选')
}
```

- [ ] **Step 6: Remove locate button and guest strip from template**

Change location actions from:

```vue
<view class="location-card__actions">
  <text class="location-card__action" @tap.stop="autoLocate">定位</text>
  <text class="location-card__action">选点</text>
</view>
```

To:

```vue
<view class="location-card__actions">
  <text class="location-card__action">选点</text>
</view>
```

Delete the full block:

```vue
<view v-if="auth.isGuest" class="guest-strip sl-card" @tap="previewCardAction">
  <wd-icon name="warning" size="18px" color="#b46d08" />
  <text>当前账号待开通，申请通过后可查看完整房源</text>
</view>
```

- [ ] **Step 7: Wire filter guard props/events**

Change filter component usage to include:

```vue
<sl-property-filter-bar
  :filters="filters"
  :keyword="keyword"
  :guarded="isPreviewMode"
  guard-tip="登录并通过审核后可使用筛选"
  mount-key="admin-community-filter"
  @confirm="onFilterConfirm"
  @reset="resetFilters"
  @guarded="onFilterGuarded"
/>
```

- [ ] **Step 8: Remove unused guest-strip style if no longer referenced**

Delete `.guest-strip { ... }` from this file.

---

### Task 5: Map Preview Gating and Location Cache

**Files:**
- Modify: `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next\src\pages\user\map\index.vue`

- [ ] **Step 1: Import shared location helpers**

Add:

```ts
import { getLocationOnceCached, setCachedLocation } from '@/utils/location-cache'
```

- [ ] **Step 2: Replace local location request**

Remove local `requestLocation()` and replace `getLocation(showTip = false)` with:

```ts
async function getLocation(showTip = false) {
  if (locating.value)
    return
  locating.value = true
  try {
    const res = await getLocationOnceCached()
    applyReferencePoint(res.longitude, res.latitude, res.label)
    if (showTip)
      uni.showToast({ title: '已更新当前位置', icon: 'success' })
    await loadCommunities()
  }
  catch {
    locationReady.value = false
    if (showTip)
      uni.showToast({ title: '定位失败，请手动选点', icon: 'none' })
  }
  finally {
    locating.value = false
  }
}
```

- [ ] **Step 3: Gate manual choose-location**

At the start of `chooseReferencePoint()` add:

```ts
if (isPreviewMode.value) {
  ensureCanUse('登录并通过审核后可选择位置')
  return
}
```

After successful `uni.chooseLocation`, cache selected point:

```ts
const label = res.name || res.address || '选定位置'
setCachedLocation(res.longitude, res.latitude, label)
applyReferencePoint(res.longitude, res.latitude, label)
```

- [ ] **Step 4: Add filter guard handler**

Add:

```ts
function onFilterGuarded(tip?: string) {
  ensureCanUse(tip || '登录并通过审核后可使用筛选')
}
```

- [ ] **Step 5: Remove locate button and guest strip from template**

In `.map-head__actions`, delete this button:

```vue
<wd-button size="small" plain @click="getLocation(true)">
  {{ locating ? '定位中' : '定位' }}
</wd-button>
```

Delete the full `guest-strip` block under `location-strip`.

- [ ] **Step 6: Wire filter guard props/events**

Change filter component usage to include:

```vue
<sl-property-filter-bar
  :filters="filters"
  :keyword="keyword"
  :guarded="isPreviewMode"
  guard-tip="登录并通过审核后可使用筛选"
  mount-key="admin-map-filter"
  @confirm="onFilterConfirm"
  @reset="resetFilters"
  @guarded="onFilterGuarded"
/>
```

- [ ] **Step 7: Remove unused guest-strip style if no longer referenced**

Delete `.guest-strip { ... }` from this file.

---

### Task 6: MiniApp Static Verification

**Files:**
- Read/verify generated output only; do not commit `dist`.

- [ ] **Step 1: Type-check**

Run:

```powershell
cd E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next
pnpm type-check
```

Expected: exit code 0.

- [ ] **Step 2: Build WeChat MiniApp and sync output**

Run:

```powershell
pnpm build:mp-weixin
```

Expected: exit code 0, and `scripts/sync-mp-weixin-dist.mjs` copies `dist/build/mp-weixin` to `dist/dev/mp-weixin`.

- [ ] **Step 3: Check Git status before runtime verification**

Run:

```powershell
git status --short
```

Expected: only intended source/docs files are changed. No `dist`, `node_modules`, temp logs, or screenshots are staged.

---

### Task 7: WeChat DevTools Runtime Verification

**Files:**
- No source edits unless a runtime issue is found.

- [ ] **Step 1: Open and compile project**

Use WeChat DevTools MCP with project path:

```text
E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next
```

Expected compile result:

```text
compiled: true
errors: []
warnings: []
```

- [ ] **Step 2: Verify anonymous/guest map page**

Navigate/reLaunch to:

```text
/pages/user/map/index
```

Expected:

- No visible “定位” button.
- No guest strip text “当前账号待开通，申请通过后可查看完整房源”.
- Preview markers are region markers.
- Tapping filter controls triggers login/apply guard instead of opening filters.
- Tapping “选点” triggers login/apply guard instead of opening `chooseLocation`.

- [ ] **Step 3: Verify anonymous/guest property list page**

Navigate/reLaunch to:

```text
/pages/admin/property-list/index
```

Expected:

- No visible “定位” action.
- No guest strip text.
- Preview region cards load.
- Tapping filter controls triggers login/apply guard instead of opening filters.
- Tapping “选点” triggers login/apply guard instead of opening `chooseLocation`.

---

### Task 8: Commit MiniApp Changes Only

**Files:**
- Commit MiniApp source/docs changes.
- Do not commit backend changes unless user explicitly asks.

- [ ] **Step 1: Review MiniApp diff**

Run:

```powershell
cd E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next
git diff -- src docs package.json
```

Expected: only intended MiniApp changes.

- [ ] **Step 2: Commit MiniApp**

Run:

```powershell
git add -- src docs
git commit -m "feat: gate preview filters and cache location"
```

Expected: one MiniApp commit.

- [ ] **Step 3: Report backend dirty state**

Run:

```powershell
cd E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe
git status --short
```

Expected: `SlPublicService.cs` modified and not committed unless user has separately requested backend commit/deploy.
