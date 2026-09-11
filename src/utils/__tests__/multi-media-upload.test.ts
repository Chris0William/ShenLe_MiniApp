import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

const pages = ['community-manage', 'property-form']

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

describe.each(pages)('%s multi-media upload', (page) => {
  it('appends both selected videos to the four existing videos', async () => {
    const form = { media: ['a', 'b', 'c', 'd'].map(id => ({ id })), coverImageId: 'a' }
    const uploading = { value: false }
    const toast = vi.fn()
    const uploadMediaFile = vi.fn(async (id: string) => ({ id }))
    const upload = pageFunction(page, 'uploadSelectedMedia', {
      form,
      uploading,
      uploadMediaFile,
      uni: { showToast: toast },
      normalizeMedia: (file: unknown) => file,
      extensionOf: () => '.mp4',
    })
    await upload([{ tempPath: 'e', kind: 'video' }, { tempPath: 'f', kind: 'video' }])
    expect(form.media.map(file => file.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(form.coverImageId).toBe('a')
    expect(uploadMediaFile).toHaveBeenCalledTimes(2)
    expect(uploading.value).toBe(false)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '已上传 2 个媒体' }))
  })

  it('continues after one failed upload and reports partial success', async () => {
    const form = { media: [] as { id: string }[], coverImageId: '' }
    const toast = vi.fn()
    const uploadMediaFile = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: 'second' })
    const upload = pageFunction(page, 'uploadSelectedMedia', {
      form,
      uploading: { value: false },
      uploadMediaFile,
      uni: { showToast: toast },
      normalizeMedia: (file: unknown) => file,
      extensionOf: () => '.mp4',
      console: { error: vi.fn() },
    })
    await upload([{ tempPath: 'first', kind: 'video' }, { tempPath: 'second', kind: 'video' }])
    expect(form.media.map(file => file.id)).toEqual(['second'])
    expect(form.coverImageId).toBe('second')
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '上传成功 1 个，失败 1 个', duration: 3000 }))
  })

  it('does not submit a form before all uploads finish', async () => {
    const toast = vi.fn()
    const submit = pageFunction(page, page === 'community-manage' ? 'submitForm' : 'submit', {
      uploading: { value: true },
      submitting: { value: false },
      uni: { showToast: toast },
    })
    await submit()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '媒体上传中，请完成后保存' }))
  })
})
