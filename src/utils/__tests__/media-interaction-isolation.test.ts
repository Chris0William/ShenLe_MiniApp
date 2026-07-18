import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(filePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
}

function cssRule(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`))?.[0] || ''
}

describe('media interaction isolation', () => {
  it('keeps editable media preview and cover action in separate hit regions', () => {
    const editableMediaFiles = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
      'src/pages/common/building-manage/index.vue',
    ]

    for (const filePath of editableMediaFiles) {
      const source = readSource(filePath)
      const previewActionRule = cssRule(source, '.media-preview-hit--with-action')
      const coverActionRule = cssRule(source, '.image-cover-action')
      const removeRule = cssRule(source, '.image-remove')

      expect(source, filePath).toContain('class="media-preview-hit"')
      expect(source, filePath).toContain('@tap.stop=')
      expect(previewActionRule, filePath).toContain('bottom: 56rpx;')
      expect(coverActionRule, filePath).toContain('height: 56rpx;')
      expect(coverActionRule, filePath).toContain('z-index: 5;')
      expect(removeRule, filePath).toContain('width: 52rpx;')
      expect(removeRule, filePath).toContain('height: 52rpx;')
      expect(removeRule, filePath).toContain('z-index: 7;')
    }
  })

  it('does not bind video preview to an element overlapping the cover action', () => {
    const videoEditors = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
    ]

    for (const filePath of videoEditors) {
      const source = readSource(filePath)
      expect(source, filePath).not.toMatch(/class="video-tile"[^>]*@tap/)
      expect(source, filePath).not.toMatch(/class="video-tile__overlay"[^>]*@tap/)
    }
  })

  it('reserves a fixed action area in every video preview header', () => {
    const videoPreviewFiles = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
      'src/pages/common/community-properties/index.vue',
      'src/pages/common/property-detail/index.vue',
      'src/components/sl-property-card/sl-property-card.vue',
      'src/pages/admin/property-list/index.vue',
    ]

    for (const filePath of videoPreviewFiles) {
      const source = readSource(filePath)
      const headRule = cssRule(source, '.video-preview__head')
      const titleRule = cssRule(source, '.video-preview__title')
      const actionsRule = cssRule(source, '.video-preview__actions')

      expect(source, filePath).toContain('class="video-preview__title"')
      expect(headRule, filePath).toContain('padding: 20rpx 224rpx 20rpx 24rpx;')
      expect(titleRule, filePath).toContain('width: 100%;')
      expect(titleRule, filePath).toContain('text-overflow: ellipsis;')
      expect(actionsRule, filePath).toContain('position: absolute;')
      expect(actionsRule, filePath).toContain('right: 20rpx;')
    }
  })

  it('keeps batch-media native video and remove controls operable', () => {
    const source = readSource('src/components/sl-property-batch/sl-property-batch.vue')
    const removeRule = source.match(/\.selected-media__remove,\s*\.pool-media__check\s*\{[\s\S]*?\}/)?.[0] || ''

    expect(source).toContain('@tap.stop="setAddRowCover(media.fileId)"')
    expect(source).toContain('class="selected-media__remove" @tap.stop=')
    expect(cssRule(source, '.media-poster--local')).toContain('pointer-events: none;')
    expect(removeRule).toContain('z-index: 3;')
  })
})
