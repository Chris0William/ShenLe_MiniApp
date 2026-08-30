import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMediaLongPressGuard, MEDIA_EDIT_ACTIONS, MEDIA_RENAME_ACTIONS, mediaBaseName, showMediaEditActionSheet, showMediaRenameActionSheet } from '@/utils/media-edit'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editable media actions', () => {
  it('keeps the required action order', async () => {
    const showActionSheet = vi.fn((options: { success: (result: { tapIndex: number }) => void }) => options.success({ tapIndex: 1 }))
    vi.stubGlobal('uni', { showActionSheet })

    await expect(showMediaEditActionSheet()).resolves.toBe('rename')
    expect(showActionSheet).toHaveBeenCalledWith(expect.objectContaining({ itemList: [...MEDIA_EDIT_ACTIONS] }))
    expect(MEDIA_EDIT_ACTIONS).toEqual(['查看', '编辑媒体名称', '设置为封面'])
  })

  it('provides a rename-only menu for the property media strip', async () => {
    const showActionSheet = vi.fn((options: { success: (result: { tapIndex: number }) => void }) => options.success({ tapIndex: 0 }))
    vi.stubGlobal('uni', { showActionSheet })

    await expect(showMediaRenameActionSheet()).resolves.toBe(true)
    expect(showActionSheet).toHaveBeenCalledWith(expect.objectContaining({ itemList: [...MEDIA_RENAME_ACTIONS] }))
  })

  it('removes only the known suffix from the editable value', () => {
    expect(mediaBaseName('客厅视频.mp4', '.mp4')).toBe('客厅视频')
    expect(mediaBaseName('一楼.客厅.MP4', 'mp4')).toBe('一楼.客厅')
    expect(mediaBaseName('无后缀名称', null)).toBe('无后缀名称')
  })

  it('consumes the synthetic tap emitted after long press', () => {
    let time = 100
    const guard = createMediaLongPressGuard(1000, () => time)

    guard.mark()
    time = 200
    expect(guard.consumeTap()).toBe(true)
    expect(guard.consumeTap()).toBe(false)
  })

  it('does not suppress a later deliberate tap', () => {
    let time = 100
    const guard = createMediaLongPressGuard(1000, () => time)

    guard.mark()
    time = 1200
    expect(guard.consumeTap()).toBe(false)
  })
})

describe('editable media page scope', () => {
  it('keeps the unified long-press menu on community, building and property forms', () => {
    const pages = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/building-manage/index.vue',
      'src/pages/common/property-form/index.vue',
    ]

    for (const filePath of pages) {
      const source = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
      expect(source, filePath).toContain('@longpress.stop="openMediaActionMenu(index)"')
      expect(source, filePath).toContain('showMediaEditActionSheet')
      expect(source, filePath).toContain('renameEditableMedia')
      expect(source, filePath).toContain('createMediaLongPressGuard')
    }
  })

  it('keeps the property form menu and adds the restricted property media rename menu', () => {
    const form = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/property-form/index.vue'), 'utf8')
    const detail = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/property-detail/index.vue'), 'utf8')
    const propertyList = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/community-properties/index.vue'), 'utf8')

    expect(form).toContain('@longpress.stop="openMediaActionMenu(index)"')
    expect(form).toContain('showMediaEditActionSheet')
    expect(form).toContain('renameEditableMedia')
    expect(propertyList).toContain('@longpress.stop="openMediaActionMenu(media)"')
    expect(propertyList).toContain('showMediaRenameActionSheet')
    expect(propertyList).toContain('renameEditableMedia')
    expect(propertyList).not.toContain('设置为封面')
    expect(detail).toContain('@longpress.stop="showGalleryMediaMenu(media)"')
    expect(detail).toContain('itemList: [\'查看\', \'编辑媒体名称\']')
    expect(detail).toContain('renameEditableMedia')
  })

  it('does not change either property batch workflow', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sl-property-batch/sl-property-batch.vue'), 'utf8')

    expect(source).not.toContain('showMediaEditActionSheet')
    expect(source).not.toContain('renameEditableMedia')
  })
})
