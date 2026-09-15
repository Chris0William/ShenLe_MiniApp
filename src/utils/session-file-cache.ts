import { captureSessionContext, isCurrentSession, StaleSessionError } from '@/utils/session-context'
import { getApiBaseUrl } from '@/utils/shenle'

type Session = ReturnType<typeof captureSessionContext>

export function createSessionFileCache(
  fetchFile: (id: string, session: Session) => Promise<string>,
  exists: (path: string) => Promise<boolean>,
  capacity = 64,
  ttlMs = 300_000,
) {
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(ttlMs) || ttlMs < 0)
    throw new RangeError('Invalid media cache limits')
  const paths = new Map<string, { path: string, expiresAt: number }>()
  const pending = new Map<string, Promise<string>>()
  let session: Session | null = null
  let backend = ''
  let generation = 0

  function clear() {
    generation += 1
    paths.clear()
    pending.clear()
    session = null
  }

  function download(id: string): Promise<string> {
    const context = captureSessionContext()
    const base = getApiBaseUrl()
    if (!session || !isCurrentSession(session) || backend !== base) {
      clear()
      session = context
      backend = base
    }
    const existing = pending.get(id)
    if (existing)
      return existing
    const expectedGeneration = generation
    function checkScope() {
      if (generation !== expectedGeneration || !isCurrentSession(context) || getApiBaseUrl() !== base)
        throw new StaleSessionError()
    }
    const task = (async () => {
      const cached = paths.get(id)
      if (cached && cached.expiresAt > Date.now() && await exists(cached.path)) {
        checkScope()
        paths.delete(id)
        paths.set(id, cached)
        return cached.path
      }
      checkScope()
      paths.delete(id)
      const path = await fetchFile(id, context)
      checkScope()
      paths.set(id, { path, expiresAt: Date.now() + ttlMs })
      // 淘汰缓存引用，临时文件交由微信管理，避免删掉当前仍在播放的文件。
      while (paths.size > capacity)
        paths.delete(paths.keys().next().value!)
      return path
    })().catch((error) => {
      checkScope()
      throw error
    })
    pending.set(id, task)
    return task.finally(() => {
      if (pending.get(id) === task)
        pending.delete(id)
    })
  }

  return { download, clear }
}
