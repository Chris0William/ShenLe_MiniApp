# Admin Community Filter Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the management-side 房源入口 follow the old mini-program filtering model: filter communities first, show matching community cards, then enter each community's property list; reuse the same community filter on the map.

**Architecture:** Keep the backend API unchanged and use `slCommunity/page` as the first-level query because distance and community-level aggregation are naturally community-scoped. Reuse one filter state (`PropertyFilterState`) but map only old-version-supported fields into `PageSlCommunityInput`: community name search, region, min/max rent, user location, and distance. Keep property-level editing inside `community-properties` and `property-form`.

**Tech Stack:** uni-app / unibest, Vue 3 `<script setup>`, wot-design-uni, WeChat Mini Program APIs `getLocation` and `chooseLocation`.

---

## File Structure

- Modify: `src/tabbar/config.ts` — remove management-side `找房`, make tabbar management-first.
- Modify: `pages.config.ts` — declare `chooseLocation` in `requiredPrivateInfos`.
- Modify: `src/utils/property-filter.ts` — add `buildCommunityFilterQuery()` for community-level filtering.
- Modify: `src/components/sl-property-filter-bar/sl-property-filter-bar.vue` — restrict quick filter to old-version fields: location/distance, rent range, community-name search.
- Create: `src/components/sl-community-card/sl-community-card.vue` — reusable community aggregation card.
- Modify: `src/pages/admin/property-list/index.vue` — switch first-level list from property page to community page, add current/selected location.
- Modify: `src/pages/user/map/index.vue` — reuse the same community filter for map markers; path stays because current project routes already use it as map tab.

---

### Task 1: Management Tabbar

**Files:**
- Modify: `src/tabbar/config.ts`

- [ ] **Step 1: Remove user-facing 找房 from `customTabbarList`**

Expected custom tabbar entries:

```ts
export const customTabbarList: CustomTabBarItem[] = [
  { text: '工作台', pagePath: 'pages/admin/dashboard/index', iconType: 'unocss', icon: 'i-carbon-dashboard' },
  { text: '房源', pagePath: 'pages/admin/property-list/index', iconType: 'unocss', icon: 'i-carbon-building' },
  { text: '地图', pagePath: 'pages/user/map/index', iconType: 'unocss', icon: 'i-carbon-location' },
  { text: '销控', pagePath: 'pages/admin/sales-control/index', iconType: 'unocss', icon: 'i-carbon-table-split' },
  { text: '我的', pagePath: 'pages/admin/mine/index', iconType: 'unocss', icon: 'i-carbon-user' },
]
```

- [ ] **Step 2: Build-check tabbar config**

Run: `pnpm type-check`
Expected: no TypeScript error from `src/tabbar/config.ts`.

---

### Task 2: Community Filter Contract

**Files:**
- Modify: `pages.config.ts`
- Modify: `src/utils/property-filter.ts`
- Modify: `src/components/sl-property-filter-bar/sl-property-filter-bar.vue`

- [ ] **Step 1: Declare location picker permission**

`pages.config.ts` should include:

```ts
requiredPrivateInfos: ['getLocation', 'chooseLocation'],
```

- [ ] **Step 2: Add community query mapper**

`src/utils/property-filter.ts` should include:

```ts
export function buildCommunityFilterQuery(filters: PropertyFilterState): Omit<PageSlCommunityInput, 'page' | 'pageSize'> {
  return {
    regionId: filters.regionId,
    userLng: filters.userLng,
    userLat: filters.userLat,
    distanceKm: filters.distanceKm,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  }
}
```

- [ ] **Step 3: Restrict quick filter bar**

`sl-property-filter-bar.vue` should expose only:

```ts
type DropdownName = 'location' | 'price'
```

Remove `BEDROOM_OPTIONS`, `bedroomActive`, `bedroomLabel`, `setBedroom`, `clearBedrooms`, and the bedrooms tab/template block.

- [ ] **Step 4: Verify no bedroom quick-filter references remain**

Run:

```powershell
rg -n "bedroom|BEDROOM|户型|activeDropdown === 'bedrooms'|toggleDropdown\('bedrooms'\)" src/components/sl-property-filter-bar/sl-property-filter-bar.vue
```

Expected: no output.

---

### Task 3: Community Aggregation Card

**Files:**
- Create: `src/components/sl-community-card/sl-community-card.vue`

- [ ] **Step 1: Create reusable community card**

The component must:
- accept `item: SlCommunityOutput`
- show cover media, community name, region, house types, rent range, matching property count, optional distance
- emit `tap` for entering the community property list
- emit `navigate` for `uni.openLocation`

- [ ] **Step 2: Verify component auto-import**

Run: `pnpm type-check`
Expected: no unknown component/type error for `<sl-community-card>`.

---

### Task 4: Admin Property Entry Uses Community Page

**Files:**
- Modify: `src/pages/admin/property-list/index.vue`

- [ ] **Step 1: Use community API instead of property API**

Imports should use:

```ts
import type { PageSlCommunityInput, PropertyFilterState, SlCommunityOutput } from '@/types/shenle'
import { getCommunityPage } from '@/api/community'
import { buildCommunityFilterQuery, countPropertyFilters, getPropertyFilterLabels } from '@/utils/property-filter'
```

Do not use `getPropertyPage`, `deleteProperty`, `updatePropertyStatus`, or `PROPERTY_STATUS_OPTIONS` on this page.

- [ ] **Step 2: Add current/selected location state**

The page should maintain:

```ts
const DEFAULT_LOCATION = { longitude: 114.0579, latitude: 22.5431 }
const filters = ref<PropertyFilterState>({ userLng: DEFAULT_LOCATION.longitude, userLat: DEFAULT_LOCATION.latitude })
const locationLabel = ref('点击选择位置')
```

- [ ] **Step 3: Query communities**

`buildQuery()` should return:

```ts
return {
  page: page.value,
  pageSize,
  name: keyword.value.trim() || undefined,
  status: 0,
  ...buildCommunityFilterQuery(filters.value),
}
```

- [ ] **Step 4: Render community cards**

Use:

```vue
<sl-community-card
  v-for="item in items"
  :key="String(item.id)"
  :item="item"
  show-navigate
  @tap="goProperties"
  @navigate="openNavigation"
/>
```

- [ ] **Step 5: Verify old management actions remain reachable**

Clicking a community must navigate to:

```ts
`/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`
```

That page remains responsible for actual property list/edit/delete operations.

---

### Task 5: Map Reuses Community Filter

**Files:**
- Modify: `src/pages/user/map/index.vue`

- [ ] **Step 1: Use same community filter state**

Map page should keep `keyword`, `filters`, and call `buildCommunityFilterQuery(filters.value)` in `getCommunityPage()`.

- [ ] **Step 2: Add filter bar above map**

Render:

```vue
<sl-property-filter-bar
  :filters="filters"
  :keyword="keyword"
  mount-key="admin-map-filter"
  @confirm="onFilterConfirm"
  @reset="resetFilters"
/>
```

- [ ] **Step 3: Keep map marker behavior**

Markers must still come from filtered communities with coordinates, and `goProperties()` must still enter the community property page.

---

### Task 6: Verification

**Files:**
- No code changes unless verification fails.

- [ ] **Step 1: Type-check**

Run: `pnpm type-check`
Expected: exit code 0.

- [ ] **Step 2: Build WeChat Mini Program**

Run: `pnpm build:mp-weixin`
Expected: exit code 0 and `DONE Build complete`.

- [ ] **Step 3: Sync dev dist if needed**

If build only updates `dist/build/mp-weixin`, sync build to dev:

```powershell
Remove-Item -Recurse -Force dist/dev/mp-weixin -ErrorAction SilentlyContinue
Copy-Item -Recurse dist/build/mp-weixin dist/dev/mp-weixin
```

- [ ] **Step 4: WeChat DevTools compile**

Run MCP compile for project path `E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next`.
Expected: `compiled: true`, `errors: []`.

---

## Self-Review

- Spec coverage: management-side `找房` removed; map gets same filter; management `房源` returns to old community-first model; current/selected location restored; only community name/region/rent are exposed; rent uses 0-10000 dual slider.
- Placeholder scan: no `TBD`, no `TODO`, no unresolved filenames.
- Type consistency: `PropertyFilterState` remains shared, `buildCommunityFilterQuery()` maps only community-supported fields, `SlCommunityOutput` is used for community cards and map markers.
