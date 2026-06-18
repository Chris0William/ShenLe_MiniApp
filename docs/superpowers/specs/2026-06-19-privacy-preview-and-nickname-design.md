# Privacy Preview and NickName Unification Design

## Scope

This design covers two linked product changes:

1. Anonymous and guest users must see only desensitized region/area aggregation preview data. They must not receive real community, property, media, address, or contact data.
2. User display names must be unified on `SysUser.NickName`. Display and edit paths must not use `SysWechatUser.NickName` or `SysUser.RealName` as compatibility fallbacks.

## Explicitly Out Of Scope

These items are not deferred first-version work; they are intentionally not part of the product behavior:

- Tags in anonymous/guest preview.
- Real community names in anonymous/guest preview.
- Real images or videos in anonymous/guest preview.
- Real property details in anonymous/guest preview.
- Complex heat maps.
- Grid aggregation.
- Review-only fake data.

## Permission Semantics

- Anonymous: can browse only desensitized region/area aggregation preview.
- Guest `666`: same visible preview as anonymous, plus application/status entry.
- Normal user `777`: can access real user-side communities, properties, media, and details.
- Admin `888`: can access management features.
- Super admin `999`: can manage user approvals, roles, and user nicknames.

Guest users must not see less preview content than anonymous users, and must not see more real data than anonymous users. A guest is only an identified but unapproved user.

## Backend Public Preview API

Create `SlPublicService` in the application layer. It exposes only desensitized DTOs:

- `POST /api/slPublic/regionMap`
- `POST /api/slPublic/regionPage`

The preview DTO can contain:

- Region/area id only if it is a non-sensitive region id required for UI filtering; no community or property ids.
- Region/area name, such as `马山头片区`.
- Region center latitude/longitude from `SlRegion`, not real community coordinates.
- Community count range text, such as `10+ 个楼盘`.
- Available property count range text, such as `100+ 套`.
- Fuzzy rent range text, such as `约 800-1800 元`.
- Approximate distance text when user location is provided.

It must not return:

- Real community names.
- Real community ids.
- Real community coordinates.
- Property ids.
- Room numbers, buildings, floors.
- Images or videos.
- Contact information.
- Specific addresses.

## Aggregation And Fuzzing Rules

- Use `SlRegion` as the aggregation unit.
- Prefer community `RegionId` for aggregation.
- Regions with fewer than 3 communities must not expose a precise standalone point; merge into parent when possible or omit if no safe parent is available.
- Regions with fewer than 10 available properties must not expose exact counts; show `少量房源` or merge upward.
- Counts are displayed as ranges: `1-9`, `10+`, `30+`, `50+`, `100+`, `300+`.
- Rent ranges are rounded: minimum rent down to the nearest 100, maximum rent up to the nearest 100.
- Do not expose single-property rent values or relationships between rent and property count.

## Real API Access Boundary

Anonymous and guest users may access only:

- `SlPublicService` preview endpoints.
- Login endpoints.
- Access application/status endpoints.

`777+` users may access real user-side read APIs:

- Community page/detail.
- Property page/detail.
- Community/property media and other real business data.

`888+` users may write management data:

- Communities.
- Buildings.
- Properties.
- Regions.
- Tags.
- Sales control.
- Status changes.

`999` users may access:

- User management.
- Approval/rejection.
- Role setting.
- Target user nickname changes.

Frontend masking is not a security boundary. Real backend APIs must reject anonymous and unapproved guest access.

## Frontend Preview Mode

Use one shared rule:

```ts
const canViewRealData = computed(() => auth.canUseApp || auth.isAdmin)
const isPreviewMode = computed(() => !canViewRealData.value)
```

Preview mode must not call real community/property APIs.

### Map Page

Preview mode:

- Calls `/api/slPublic/regionMap`.
- Shows region aggregation markers.
- Marker text is area-level, such as `马山头片区 · 100+ 套`.
- Marker tap opens a preview card.
- Preview card action says `申请后查看具体房源`.

Real mode:

- `777+`, `888`, and `999` may call real map/community/property data.
- Admin map behavior keeps real management capability.

### List / Property Page

Preview mode:

- Calls `/api/slPublic/regionPage`.
- Shows region cards instead of real community/property cards.
- Example card content:
  - `马山头片区`
  - `约 100+ 套可租`
  - `租金约 800-1800 元`
  - `申请通过后查看具体楼盘与房源`

Preview mode does not show community names, community images, property images, property details, videos, room numbers, or addresses.

### Search And Filters

Anonymous and guest users cannot search real community names because this leaks whether a community exists.

- Real community-name search prompts: `登录并通过审核后可搜索具体楼盘`.
- Region and rent filters can operate on public aggregation data.
- `777+` users regain real community-name search and real community/property filtering.

### Protected Details And Actions

Anonymous and guest users cannot enter real detail pages. Real actions must route through `ensureCanUse`:

- Anonymous: navigate to login.
- Guest `666`: navigate to apply/status page.
- `777+`: continue to real detail/action.

Protected actions include:

- View community details.
- View property details.
- View images or videos.
- View contact information.
- Search exact community names.
- Enter real property lists.

### Guest Login Flow

After login, guest `666` users must not be forcibly redirected to the application page. They return to map/list preview and see a status strip such as:

`当前账号待开通，申请通过后可查看完整房源`

They enter the application page only when tapping a protected action or explicit application/status entry.

## SysUser.NickName Unification

All user display names use only `SysUser.NickName`.

- Do not display `SysWechatUser.NickName`.
- Do not display `SysUser.RealName` as fallback.
- Do not sync nickname edits into `SysWechatUser.NickName`.
- Do not sync nickname edits into `SysUser.RealName`.

### Backend

- Add `NickName` to `LoginUserOutput`.
- `/api/sysAuth/getUserInfo` returns `NickName = user.NickName`.
- `/api/slUserManage/page` returns `NickName = u.NickName`.
- `/api/slUserManage/page` searches `u.NickName` and account; account remains a management search field, not a display fallback.
- Add current-user nickname update endpoint, for example `POST /api/slAccess/setNickName`, using current token `UserId` and updating only `SysUser.NickName`.
- Add super-admin target nickname update endpoint, for example `POST /api/slUserManage/setNickName`, guarded by `999`, updating only target `SysUser.NickName`.
- Validate nickname after trim: 1 to 32 characters. No uniqueness constraint.

### Frontend

- Add `nickName` to `LoginUserOutput` type.
- `auth.displayName` uses `user.nickName || '未登录'` for logged-in users.
- Do not inject WeChat session nickname into `realName` as a display substitute.
- Mine page top name continues to read `auth.displayName`.
- Mine page adds a self nickname editor.
- User management page displays `item.nickName`.
- Super admin user management page adds target nickname editing.
- After self nickname update, refresh `/api/sysAuth/getUserInfo`.
- After super admin nickname update, update the current list item immediately.

## Verification

Backend:

- `dotnet build .\ShenLe.sln` from `ShenLe\Api`.
- Anonymous can call public preview endpoints.
- Anonymous cannot call real community/property endpoints.
- Guest `666` can call public preview endpoints and application/status endpoints, but cannot call real data endpoints.
- Normal user `777` can call real user-side data endpoints.
- Admin `888` can use management writes.
- Super admin `999` can approve/reject, set roles, and update target `SysUser.NickName`.

MiniApp:

- `pnpm type-check`.
- `pnpm build:mp-weixin`.
- WeChat DevTools compile reports `compiled: true`, `errors: []`.
- Anonymous map/list show region preview only.
- Guest login returns to preview, not forced application page.
- Guest protected actions navigate to application/status.
- Normal user sees real communities/properties/media.
- Mine page displays `SysUser.NickName`.
- Self nickname edit refreshes mine display immediately.
- Super admin nickname edit updates user list immediately.
