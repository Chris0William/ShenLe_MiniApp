<script setup lang="ts">
import type { AuthorizationRole, AuthorizationScope, AuthorizationUser, PermissionDefinition } from '@/api/rbac'
import type { ShenLeId, SlCommunityOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { getAuthorizationRole, getAuthorizationRoles, getAuthorizationUser, getPermissionCatalog, saveAuthorizationRole, saveAuthorizationUser } from '@/api/rbac'
import { useShenleAuthStore } from '@/store/auth'

definePage({ style: { navigationBarTitleText: '角色与权限', disableScroll: true } })
const auth = useShenleAuthStore()
const view = ref<'list' | 'role' | 'user'>('list')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const roles = ref<AuthorizationRole[]>([])
const catalog = ref<PermissionDefinition[]>([])
const selectedUserId = ref<ShenLeId>('')
const user = ref<AuthorizationUser | null>(null)
const role = reactive<AuthorizationRole>({ version: 0, roleCode: '', roleName: '', enabled: true, permissionKeys: [], scopes: [], reason: '' })
const sourceLabels: Record<string, string> = { 'role': '角色继承', 'user-allow': '单独允许', 'user-deny': '单独禁止' }
const effectOptions = ['继承角色', '单独允许', '单独禁止']
const scopeOptions = [
  { value: -1, label: '继承角色范围' },
  { value: 0, label: '无数据' },
  { value: 2, label: '本人创建' },
  { value: 3, label: '本人房东楼盘' },
  { value: 4, label: '受托维护楼盘' },
  { value: 5, label: '本人对接楼盘' },
  { value: 6, label: '指定楼盘' },
  { value: 7, label: '全部数据' },
]
const editableCatalog = computed(() => catalog.value.filter(item => item.key !== 'authorization.manage'))
const groups = computed(() => [...new Set(editableCatalog.value.map(item => item.group))])
const activeScopes = computed(() => view.value === 'user' ? user.value?.scopes || [] : role.scopes)
const availableScopeOptions = computed(() => view.value === 'role' ? scopeOptions.filter(item => item.value !== -1 && item.value !== 6) : scopeOptions)
const selectedScope = ref<AuthorizationScope | null>(null)
const selectingExcluded = ref(false)
const communityVisible = ref(false)
const communityKeyword = ref('')
const communities = ref<SlCommunityOutput[]>([])
const communityPage = ref(1)
const communityMore = ref(false)
const communityLoading = ref(false)

function idEqual(a: ShenLeId, b: ShenLeId) {
  return String(a) === String(b)
}

async function load() {
  if (!auth.isSuperAdmin) {
    error.value = '仅超级管理员可管理权限'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await Promise.all([getAuthorizationRoles(), getPermissionCatalog()])
    roles.value = result[0]
    catalog.value = result[1]
    if (selectedUserId.value) {
      user.value = await getAuthorizationUser(selectedUserId.value)
      view.value = 'user'
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '权限信息加载失败'
  }
  finally { loading.value = false }
}

async function editRole(item?: AuthorizationRole) {
  if (item?.roleCode === 'super_admin') {
    uni.showToast({ title: '系统超级管理员权限受保护', icon: 'none' })
    return
  }
  Object.assign(role, item?.id
    ? await getAuthorizationRole(item.id)
    : {
        id: undefined,
        version: 0,
        roleCode: '',
        roleName: '',
        description: '',
        enabled: true,
        permissionKeys: [],
        scopes: [],
        reason: '',
      })
  role.reason = ''
  view.value = 'role'
}

function toggleRole(id?: ShenLeId) {
  if (id == null || !user.value)
    return
  user.value.roleIds = user.value.roleIds.some(value => idEqual(value, id))
    ? user.value.roleIds.filter(value => !idEqual(value, id))
    : [...user.value.roleIds, id]
}

function togglePermission(key: string, enabled: boolean) {
  role.permissionKeys = enabled ? [...new Set([...role.permissionKeys, key])] : role.permissionKeys.filter(item => item !== key)
  if (!enabled)
    role.scopes = role.scopes.filter(item => item.permissionKey !== key)
}

function setOverride(key: string, event: { detail: { value: string | number } }) {
  if (!user.value)
    return
  const effect = Number(event.detail.value)
  user.value.overrides = user.value.overrides.filter(item => item.permissionKey !== key)
  if (effect)
    user.value.overrides.push({ permissionKey: key, effect })
}

function overrideIndex(key: string) {
  return user.value?.overrides.find(item => item.permissionKey === key)?.effect || 0
}

function overrideDateValue(key: string) {
  const value = user.value?.overrides.find(item => item.permissionKey === key)?.expireTime
  if (!value)
    return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()))
    return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function setOverrideExpire(key: string, event: { detail: { value: string } }) {
  const override = user.value?.overrides.find(item => item.permissionKey === key)
  if (!override)
    return
  override.expireTime = event.detail.value ? `${event.detail.value}T23:59:59` : null
}

function clearOverrideExpire(key: string) {
  const override = user.value?.overrides.find(item => item.permissionKey === key)
  if (override)
    override.expireTime = null
}
function getScope(key: string) {
  return activeScopes.value.find(item => item.permissionKey === key)
}
function scopeIndex(key: string) {
  const value = getScope(key)?.scopeType ?? (view.value === 'user' ? -1 : 0)
  return Math.max(0, availableScopeOptions.value.findIndex(item => item.value === value))
}

function setScope(key: string, event: { detail: { value: string | number } }) {
  const value = availableScopeOptions.value[Number(event.detail.value)].value
  const next = activeScopes.value.filter(item => item.permissionKey !== key)
  if (value >= 0)
    next.push({ permissionKey: key, scopeType: value, effect: 1, communityIds: [], excludedCommunityIds: [] })
  if (view.value === 'user' && user.value)
    user.value.scopes = next
  else role.scopes = next
}

async function loadCommunities(reset = false) {
  if (communityLoading.value)
    return
  communityLoading.value = true
  try {
    const nextPage = reset ? 1 : communityPage.value + 1
    const result = await getCommunityPage({ page: nextPage, pageSize: 20, name: communityKeyword.value.trim() || undefined })
    communities.value = reset ? result.items : [...communities.value, ...result.items]
    communityPage.value = nextPage
    communityMore.value = nextPage * 20 < result.total
  }
  finally { communityLoading.value = false }
}

function openCommunities(key: string, excluded = false) {
  selectedScope.value = getScope(key) || null
  selectingExcluded.value = excluded
  communityKeyword.value = ''
  communityVisible.value = true
  void loadCommunities(true)
}

function communitySelected(id: ShenLeId) {
  const scope = selectedScope.value
  return !!scope && (selectingExcluded.value ? scope.excludedCommunityIds : scope.communityIds).some(value => idEqual(value, id))
}

function toggleCommunity(id: ShenLeId) {
  const scope = selectedScope.value
  if (!scope)
    return
  const key = selectingExcluded.value ? 'excludedCommunityIds' : 'communityIds'
  const opposite = selectingExcluded.value ? 'communityIds' : 'excludedCommunityIds'
  scope[key] = communitySelected(id) ? scope[key].filter(value => !idEqual(value, id)) : [...scope[key], id]
  scope[opposite] = scope[opposite].filter(value => !idEqual(value, id))
}

async function save() {
  if (saving.value)
    return
  const reason = view.value === 'user' ? user.value?.reason : role.reason
  if (!reason?.trim()) {
    uni.showToast({ title: '请填写调整原因', icon: 'none' })
    return
  }
  const confirmation = await uni.showModal({ title: '确认权限调整', content: view.value === 'user' ? `保存「${user.value?.nickName || '用户'}」的角色与单独权限？` : `保存「${role.roleName}」角色模板？` })
  if (!confirmation.confirm)
    return
  saving.value = true
  try {
    if (view.value === 'user' && user.value) {
      await saveAuthorizationUser(user.value)
      user.value = await getAuthorizationUser(user.value.userId)
    }
    else {
      await saveAuthorizationRole(role)
      view.value = 'list'
      await load()
    }
    uni.showToast({ title: '权限已保存', icon: 'success', duration: 3000 })
  }
  finally { saving.value = false }
}

onLoad((query) => {
  selectedUserId.value = typeof query?.userId === 'string' ? query.userId : ''
  void load()
})
</script>

<template>
  <view class="authorization-page">
    <scroll-view scroll-y class="content" :refresher-enabled="false">
      <view v-if="loading" class="state">
        <wd-loading />
      </view>
      <view v-else-if="error" class="state">
        <text>{{ error }}</text><wd-button plain @click="load">
          重试
        </wd-button>
      </view>
      <template v-else-if="view === 'list'">
        <view class="section-head">
          <text>角色模板</text><wd-button size="small" @click="editRole()">
            新增角色
          </wd-button>
        </view>
        <view v-for="item in roles" :key="String(item.id)" class="role-row" @tap="editRole(item)">
          <view><text class="title">{{ item.roleName }}</text><text class="muted">{{ item.roleCode }} · {{ item.enabled ? '启用' : '停用' }} · {{ item.userCount || 0 }} 个用户</text></view>
          <view v-if="item.roleCode !== 'super_admin'" class="i-lucide-chevron-right" />
          <text v-else class="muted">系统保护</text>
        </view>
      </template>
      <template v-else>
        <view class="section-head">
          <text>{{ view === 'user' ? user?.nickName : (role.id ? '编辑角色' : '新增角色') }}</text><text v-if="view === 'user'" class="muted">{{ user?.isManaged ? 'RBAC管理' : '当前继承旧权限' }}</text>
        </view>
        <template v-if="view === 'role'">
          <wd-input v-model="role.roleName" label="角色名称" :maxlength="128" />
          <wd-input v-model="role.roleCode" label="角色编码" :disabled="!!role.id" :maxlength="64" />
          <view class="permission-row">
            <text>启用</text><wd-switch v-model="role.enabled" />
          </view>
        </template>
        <template v-else-if="user">
          <text class="section-title">角色</text>
          <view v-for="item in roles.filter(item => item.enabled && item.roleCode !== 'super_admin')" :key="String(item.id)" class="permission-row" @tap="toggleRole(item.id)">
            <text>{{ item.roleName }}</text><checkbox :checked="user.roleIds.some(id => idEqual(id, item.id!))" color="#126b4f" />
          </view>
        </template>
        <view v-for="group in groups" :key="group">
          <text class="section-title">{{ group }}</text>
          <view v-for="permission in editableCatalog.filter(item => item.group === group)" :key="permission.key" class="permission-item">
            <view class="permission-row">
              <text>{{ permission.name }}</text>
              <picker v-if="view === 'user'" :range="effectOptions" :value="overrideIndex(permission.key)" @change="setOverride(permission.key, $event)">
                <view class="picker-value">
                  {{ effectOptions[overrideIndex(permission.key)] }} <text class="i-lucide-chevron-down" />
                </view>
              </picker>
              <wd-switch v-else :model-value="role.permissionKeys.includes(permission.key)" @update:model-value="togglePermission(permission.key, $event)" />
            </view>
            <view v-if="view === 'user' && overrideIndex(permission.key)" class="override-expire">
              <text class="muted">到期时间</text>
              <picker mode="date" :value="overrideDateValue(permission.key)" @change="setOverrideExpire(permission.key, $event)">
                <view class="picker-value">
                  {{ overrideDateValue(permission.key) || '长期有效' }} <text class="i-lucide-calendar-days" />
                </view>
              </picker>
              <wd-button v-if="overrideDateValue(permission.key)" size="small" plain @click="clearOverrideExpire(permission.key)">
                清除到期
              </wd-button>
            </view>
            <template v-if="permission.hasDataScope && (view === 'user' || role.permissionKeys.includes(permission.key))">
              <picker :range="availableScopeOptions" range-key="label" :value="scopeIndex(permission.key)" @change="setScope(permission.key, $event)">
                <view class="permission-row muted">
                  <text>数据范围</text><view class="picker-value">
                    {{ availableScopeOptions[scopeIndex(permission.key)].label }} <text class="i-lucide-chevron-down" />
                  </view>
                </view>
              </picker>
              <view v-if="view === 'user' && getScope(permission.key)" class="scope-actions">
                <wd-button v-if="getScope(permission.key)?.scopeType === 6" size="small" plain @click="openCommunities(permission.key)">
                  指定 {{ getScope(permission.key)?.communityIds.length || 0 }} 个楼盘
                </wd-button>
                <wd-button size="small" plain @click="openCommunities(permission.key, true)">
                  排除 {{ getScope(permission.key)?.excludedCommunityIds.length || 0 }} 个楼盘
                </wd-button>
              </view>
            </template>
          </view>
        </view>
        <template v-if="view === 'user' && user">
          <text class="section-title">当前已保存的有效权限</text>
          <view v-for="permission in user.effective.permissions.filter(item => item.allowed || item.source === 'user-deny')" :key="permission.key" class="permission-row muted">
            <text>{{ catalog.find(item => item.key === permission.key)?.name || permission.key }}</text><text>{{ sourceLabels[permission.source] }} · {{ permission.allowed ? '允许' : '禁止' }}</text>
          </view>
          <wd-textarea v-model="user.reason" label="调整原因" :maxlength="300" />
        </template>
        <wd-textarea v-else v-model="role.reason" label="调整原因" :maxlength="300" />
      </template>
    </scroll-view>
    <view v-if="!loading && !error && view !== 'list'" class="footer">
      <wd-button v-if="view === 'role'" plain @click="view = 'list'">
        返回角色列表
      </wd-button><wd-button block :loading="saving" @click="save">
        保存权限
      </wd-button>
    </view>
    <wd-popup v-model="communityVisible" position="bottom" closable safe-area-inset-bottom custom-style="height: 72vh; border-radius: 8px 8px 0 0;" @touchmove.stop.prevent>
      <view class="community-panel">
        <text class="section-title">{{ selectingExcluded ? '排除楼盘' : '指定楼盘' }}</text>
        <wd-search v-model="communityKeyword" hide-cancel @search="loadCommunities(true)" />
        <scroll-view scroll-y class="community-list" @scrolltolower="communityMore && loadCommunities()">
          <view v-for="item in communities" :key="String(item.id)" class="permission-row" @tap="toggleCommunity(item.id)">
            <text>{{ item.name }}</text><checkbox :checked="communitySelected(item.id)" color="#126b4f" />
          </view>
          <view v-if="communityLoading" class="state">
            <wd-loading />
          </view>
        </scroll-view>
        <wd-button block @click="communityVisible = false">
          完成
        </wd-button>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.authorization-page {
  height: calc(100vh - var(--window-top));
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #1e2f27;
}
.content {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 28rpx;
}
.section-head,
.role-row,
.permission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 88rpx;
}
.section-head {
  font-size: 32rpx;
  font-weight: 600;
  padding: 20rpx 0;
}
.role-row,
.permission-item {
  border-bottom: 1px solid #e3ebe5;
}
.title,
.muted,
.section-title {
  display: block;
}
.title {
  font-size: 30rpx;
}
.muted {
  color: #52645b;
  font-size: 24rpx;
}
.section-title {
  margin: 28rpx 0 12rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.permission-row {
  font-size: 27rpx;
}
.permission-row > text:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.picker-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #126b4f;
  padding: 20rpx 0;
}
.scope-actions {
  display: flex;
  gap: 16rpx;
  padding: 0 0 20rpx;
  flex-wrap: wrap;
}

.override-expire {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 0 16rpx 20rpx;
}

.override-expire .picker-value {
  padding: 10rpx 0;
  font-size: 24rpx;
}
.footer {
  display: flex;
  gap: 16rpx;
  flex: 0 0 auto;
  padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1px solid #e3ebe5;
}
.state {
  display: flex;
  gap: 24rpx;
  flex-direction: column;
  align-items: center;
  padding: 44rpx 0;
}
.community-panel {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 20rpx 28rpx;
}
.community-list {
  min-height: 0;
  flex: 1;
}
</style>
