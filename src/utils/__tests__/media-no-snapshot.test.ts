import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isLocalMediaUrl, mediaKindOf } from '../media'

const forbiddenQuery = ['ci', '-process', '=', 'snap', 'shot'].join('')
const deadHelperName = ['video', 'Snapshot', 'Url'].join('')
const sourceExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.scss', '.ts', '.tsx', '.vue'])

function productionSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : productionSourceFiles(entryPath)
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  })
}

describe('video poster fallback', () => {
  it.each([
    ['video/mp4', null, 'video'],
    [null, 'https://example.com/demo.mov?token=1', 'video'],
    ['image/jpeg', 'https://example.com/demo.jpg', 'image'],
  ] as const)('classifies %s / %s as %s', (fileType, url, expected) => {
    expect(mediaKindOf(fileType, url)).toBe(expected)
  })

  it.each([
    'http://tmp/video.mp4',
    'https://tmp/video.mp4',
    'wxfile://tmp/video.mp4',
    'blob:https://example.com/video',
  ])('recognizes local media URL %s', (url) => {
    expect(isLocalMediaUrl(url)).toBe(true)
  })

  it('keeps every production source free of the forbidden query', () => {
    for (const sourcePath of productionSourceFiles(path.resolve(process.cwd(), 'src'))) {
      const source = fs.readFileSync(sourcePath, 'utf8')
      expect(source, path.relative(process.cwd(), sourcePath)).not.toContain(forbiddenQuery)
    }
  })

  it('does not retain the retired snapshot URL helper', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/media.ts'), 'utf8')
    expect(source).not.toContain(deadHelperName)
  })

  it('keeps the no-snapshot community cover overlay transparent', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/community-manage/index.vue'), 'utf8')
    const overlayRule = source.match(/\.card-cover__overlay\s*\{[\s\S]*?\}/)?.[0] || ''

    expect(overlayRule).toContain('background: transparent;')
  })

  it('keeps community video actions outside the preview hit area', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/community-manage/index.vue'), 'utf8')
    const previewActionRule = source.match(/\.media-preview-hit--with-action\s*\{[\s\S]*?\}/)?.[0] || ''
    const coverActionRule = source.match(/\.image-cover-action\s*\{[\s\S]*?\}/)?.[0] || ''
    const previewTitleRule = source.match(/\.video-preview__title\s*\{[\s\S]*?\}/)?.[0] || ''
    const previewActionsRule = source.match(/\.video-preview__actions\s*\{[\s\S]*?\}/)?.[0] || ''

    expect(source).toContain('class="media-preview-hit"')
    expect(source).not.toMatch(/class="video-tile__overlay"[^>]*@tap/)
    expect(source).toContain('class="video-preview__title"')
    expect(previewActionRule).toContain('bottom: 56rpx;')
    expect(coverActionRule).toContain('height: 56rpx;')
    expect(coverActionRule).toContain('z-index: 5;')
    expect(previewTitleRule).toContain('text-overflow: ellipsis;')
    expect(previewActionsRule).toContain('position: absolute;')
  })

  it('uploads and binds the WeChat-generated video poster as a child file', () => {
    const fileApi = fs.readFileSync(path.resolve(process.cwd(), 'src/api/file.ts'), 'utf8')

    expect(fileApi).toContain('\'/api/slMediaDraft/bindPoster\'')
    expect(fileApi).toContain('fileType: \'image:video_poster\'')
    expect(fileApi).toContain('posterFileId: poster.id')
    expect(fileApi).toContain('posterLocalPath: posterPath')
    expect(fileApi).toContain('uni.getFileInfo({')
    expect(fileApi).toContain('size >= MIN_VIDEO_POSTER_SIZE')
  })

  it('keeps the video when its optional poster upload or binding fails', () => {
    const fileApi = fs.readFileSync(path.resolve(process.cwd(), 'src/api/file.ts'), 'utf8')

    expect(fileApi).toContain('poster.optional-fail')
    expect(fileApi).toContain('posterPending: true')
    expect(fileApi).toContain('视频本体已经成功')
  })

  it('keeps video and poster as one media item across upload and display entry points', () => {
    const uploadPages = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
      'src/components/sl-property-batch/sl-property-batch.vue',
    ]
    const displayFiles = [
      'src/components/sl-community-card/sl-community-card.vue',
      'src/components/sl-property-card/sl-property-card.vue',
      'src/pages/common/community-properties/index.vue',
      'src/pages/common/property-detail/index.vue',
    ]

    for (const pagePath of uploadPages) {
      const source = fs.readFileSync(path.resolve(process.cwd(), pagePath), 'utf8')
      expect(source, pagePath).toContain('thumbTempFilePath')
      expect(source, pagePath).toContain('posterFileId')
    }
    for (const filePath of displayFiles) {
      const source = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
      expect(source, filePath).toContain('coverPosterFileId')
    }
  })

  it('does not open the image picker after chooseMedia fails', () => {
    const uploadPages = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
    ]

    for (const pagePath of uploadPages) {
      const source = fs.readFileSync(path.resolve(process.cwd(), pagePath), 'utf8')
      const failureHandler = source.match(/function handleChooseMediaFailure\([\s\S]*?\n\}/)?.[0] || ''

      expect(failureHandler, pagePath).toContain('showMediaPickerFailure')
      expect(failureHandler, pagePath).not.toContain('chooseImageFallback')
      expect(source, pagePath).toContain('fail: handleChooseMediaFailure')
    }
  })

  it('preserves the chooseMedia receiver in every mixed-media upload entry', () => {
    const uploadEntries = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
      'src/components/sl-property-batch/sl-property-batch.vue',
    ]

    for (const pagePath of uploadEntries) {
      const source = fs.readFileSync(path.resolve(process.cwd(), pagePath), 'utf8')
      expect(source, pagePath).toContain('wxApi.chooseMedia.bind(wxApi)')
      expect(source, pagePath).toContain('uniApi.chooseMedia?.bind(uniApi)')
    }
  })

  it('enables mixed media selection while keeping local video previews', () => {
    const uploadEntries = [
      'src/pages/common/community-manage/index.vue',
      'src/pages/common/property-form/index.vue',
      'src/components/sl-property-batch/sl-property-batch.vue',
    ]

    for (const pagePath of uploadEntries) {
      const source = fs.readFileSync(path.resolve(process.cwd(), pagePath), 'utf8')
      expect(source, pagePath).toContain('mediaType: [\'mix\']')
      expect(source, pagePath).toContain('isLocalMediaUrl(media.url)')
    }
  })
})
