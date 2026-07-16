import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('video album save UI', () => {
  const videoViews = [
    'src/components/sl-property-card/sl-property-card.vue',
    'src/pages/admin/property-list/index.vue',
    'src/pages/common/community-manage/index.vue',
    'src/pages/common/community-properties/index.vue',
    'src/pages/common/property-detail/index.vue',
    'src/pages/common/property-form/index.vue',
  ]

  it.each(videoViews)('%s exposes explicit save and long-press save', (relativePath) => {
    const contents = source(relativePath)
    expect(contents).toContain('saveVideoToAlbum')
    expect(contents).toContain('showVideoSaveActionSheet')
    expect(contents).toContain('icon="download"')
    expect(contents).toContain('@longpress')
    expect(contents).toContain('openSavePreviewMenu')
    expect(contents).not.toContain('@longpress="savePreviewVideo"')
  })
})

describe('single community source contact assignment', () => {
  const page = source('src/pages/common/community-manage/index.vue')
  const types = source('src/types/shenle.ts')

  it('requires a source contact for every administrator on both add and edit', () => {
    expect(page).not.toContain('auth.isSuperAdmin')
    expect(page).toContain('class="owner-assignment"')
    expect(page).toContain('盘源对接人')
    expect(page).toContain('required-mark')
    expect(page).toContain('owner-assignment__value--empty')
    expect(page).not.toContain(':class="{ empty: !form.ownerId }"')
    expect(page).toContain('if (!form.ownerId)')
    expect(page).toContain('uni.showToast({ title: \'请选择盘源对接人\'')
    expect(page).toContain('getLandlordPage')
    expect(page).toContain('assignOwner')
    expect(page).toContain('unassignOwner')
    expect(page).toContain('saveOwnerAssignment(form.id)')
    expect(page).toContain('await saveOwnerAssignment(createdId)')
    expect(page).not.toContain('@tap="selectOwner()"')
    expect(page).not.toContain('暂不分配')
    expect(types).toContain('ownerId?: ShenLeId | null')
    expect(types).toContain('ownerName?: string | null')
  })
})
