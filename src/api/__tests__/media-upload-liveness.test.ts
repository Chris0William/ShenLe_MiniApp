import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadFile, uploadMediaFile } from '@/api/file'

interface UploadOptions {
  success?: (res: { statusCode: number, data: string }) => void
  fail?: (error: unknown) => void
}

function successBody(id: string) {
  return JSON.stringify({
    code: 200,
    result: { id, url: `/media/${id}`, fileName: `${id}.mp4` },
  })
}

function setUni(overrides: Record<string, unknown> = {}) {
  const uniApi = {
    getStorageSync: vi.fn(() => 'token'),
    showToast: vi.fn(),
    uploadFile: vi.fn((_options: UploadOptions) => ({ abort: vi.fn() })),
    getFileInfo: vi.fn(),
    ...overrides,
  }
  ;(globalThis as unknown as { uni: unknown }).uni = uniApi
  return uniApi as typeof uniApi & { uploadFile: ReturnType<typeof vi.fn> }
}

function pageFunction(page: string, name: string, context: Record<string, unknown>) {
  const file = path.resolve(`src/pages/common/${page}/index.vue`)
  const script = parse(fs.readFileSync(file, 'utf8')).descriptor.scriptSetup!.content
  const source = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  if (!declaration)
    throw new Error(`Missing ${name}`)
  const js = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(`${js}; ${name}`, context)
}

describe('media upload liveness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setUni()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('rejects and aborts when uploadFile never invokes a callback', async () => {
    const uniApi = setUni({ uploadFile: vi.fn(() => ({ abort: vi.fn() })) })
    const promise = uploadFile('/tmp/stuck.mp4', { fileType: 'video' })
    const rejection = expect(promise).rejects.toThrow('上传超时')

    await vi.advanceTimersByTimeAsync(60_001)

    await rejection
    expect(uniApi.uploadFile).toHaveBeenCalledTimes(1)
    expect(uniApi.uploadFile.mock.results[0].value.abort).toHaveBeenCalledTimes(1)
  })

  it('ignores a synchronous fail emitted by abort after timeout', async () => {
    let options: UploadOptions | undefined
    let failCalled = 0
    const abort = vi.fn(() => options?.fail?.(new Error('aborted')))
    setUni({ uploadFile: vi.fn((input: UploadOptions) => {
      options = {
        ...input,
        fail: (error) => {
          failCalled += 1
          input.fail?.(error)
        },
      }
      return { abort }
    }) })
    const promise = uploadFile('/tmp/abort-fail.mp4', { fileType: 'video' })
    const rejection = expect(promise).rejects.toThrow('上传超时')

    await vi.advanceTimersByTimeAsync(60_001)

    await rejection
    expect(abort).toHaveBeenCalledTimes(1)
    expect(failCalled).toBe(1)
  })

  it('keeps the timeout rejection when success arrives late', async () => {
    let options: UploadOptions | undefined
    setUni({ uploadFile: vi.fn((input: UploadOptions) => {
      options = input
      return { abort: vi.fn() }
    }) })
    const promise = uploadFile('/tmp/late.mp4', { fileType: 'video' })
    const rejection = expect(promise).rejects.toThrow('上传超时')

    await vi.advanceTimersByTimeAsync(60_001)
    options?.success?.({ statusCode: 200, data: successBody('late') })

    await rejection
  })

  it('rejects promptly when uni.uploadFile throws synchronously', async () => {
    const thrown = new Error('native upload unavailable')
    setUni({
      uploadFile: vi.fn(() => {
        throw thrown
      }),
    })

    await expect(uploadFile('/tmp/throw.mp4', { fileType: 'video' })).rejects.toBe(thrown)
  })

  it('does not leave a video upload pending when getFileInfo never responds', async () => {
    const uniApi = setUni({
      uploadFile: vi.fn((options: UploadOptions) => {
        options.success?.({ statusCode: 200, data: successBody('video') })
        return { abort: vi.fn() }
      }),
      getFileInfo: vi.fn(),
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const promise = uploadMediaFile('/tmp/video.mp4', { kind: 'video', posterPath: '/tmp/poster.jpg' })

    await vi.advanceTimersByTimeAsync(5_001)

    await expect(promise).resolves.toMatchObject({ id: 'video' })
    expect(uniApi.getFileInfo).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalled()
  })

  it('continues the real page serial queue after one upload rejects', async () => {
    const uniApi = setUni({
      uploadFile: vi.fn()
        .mockImplementationOnce((options: UploadOptions) => {
          options.fail?.(new Error('first failed'))
          return { abort: vi.fn() }
        })
        .mockImplementationOnce((options: UploadOptions) => {
          options.success?.({ statusCode: 200, data: successBody('second') })
          return { abort: vi.fn() }
        }),
    })
    const form = { media: [] as Array<{ id: string }>, coverImageId: '' }
    const upload = pageFunction('community-manage', 'uploadSelectedMedia', {
      form,
      uploading: { value: false },
      uploadProgress: { done: 0, total: 0, failed: 0 },
      uploadMediaFile,
      normalizeMedia: (file: unknown) => file,
      extensionOf: () => '.mp4',
      mediaTrace: undefined,
      uni: uniApi,
      console: { error: vi.fn() },
    }) as (files: Array<{ tempPath: string, kind: 'image' | 'video' }>) => Promise<void>

    await upload([
      { tempPath: '/tmp/first.jpg', kind: 'image' },
      { tempPath: '/tmp/second.jpg', kind: 'image' },
    ])

    expect(uniApi.uploadFile).toHaveBeenCalledTimes(2)
    expect(form.media.map(item => item.id)).toEqual(['second'])
    expect(form.coverImageId).toBe('second')
    expect(uniApi.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '上传成功 1 个，失败 1 个' }))
  })
})
