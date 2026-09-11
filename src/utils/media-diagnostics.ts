export const MEDIA_DIAGNOSTIC_BUILD = '0.4.47-media-log1'
export const MEDIA_LOG_TAG = 'shenle-media'

interface LogManager {
  info?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
  log?: (...args: unknown[]) => void
  addFilterMsg?: (value: string) => void
}

interface DiagnosticApi {
  getRealtimeLogManager?: () => LogManager
  getLogManager?: (options: { level: number }) => LogManager
  getSystemInfoSync?: () => { platform?: string, system?: string, model?: string, version?: string, SDKVersion?: string }
  getAccountInfoSync?: () => { miniProgram?: { version?: string, envVersion?: string } }
  showModal?: (options: { title: string, content: string, showCancel: boolean }) => void
}

export interface MediaLogDetails {
  count?: number
  rawCount?: number
  validCount?: number
  hasPoster?: boolean
  httpStatus?: number
  businessCode?: number
  kind?: 'image' | 'video' | 'poster' | 'file'
  provider?: 'wx' | 'uni'
}

let sequence = 0

function getApi(): DiagnosticApi {
  const wxApi = (globalThis as unknown as { wx?: DiagnosticApi }).wx
  return wxApi || (typeof uni === 'undefined' ? {} : uni as unknown as DiagnosticApi)
}

export function mediaErrorMessage(error: unknown) {
  const value = error as { errMsg?: unknown, message?: unknown } | null
  const message = String(value?.errMsg || value?.message || '未知错误')
  return message
    .replace(/(?:https?|wxfile|file|blob):\/\/[^\s"'<>]+/gi, '[地址已隐藏]')
    .replace(/(?:authorization|cookie|token|loginTicket|phoneCode)\s*[:=]\s*[^\s,;]+/gi, '[凭据已隐藏]')
    .slice(0, 600)
}

export function isMediaPickerCancel(error: unknown) {
  return /cancel/i.test(mediaErrorMessage(error))
}

export function createMediaTrace(entry: string) {
  const id = `m${Date.now().toString(36)}-${(++sequence).toString(36)}`
  const started = Date.now()
  function write(stage: string, details: MediaLogDetails = {}, error?: unknown) {
    const failed = error !== undefined
    try {
      const api = getApi()
      const logger = api.getRealtimeLogManager?.() || api.getLogManager?.({ level: 1 })
      let runtime: { platform?: string, system?: string, model?: string, version?: string, SDKVersion?: string } = {}
      let miniProgram: { version?: string, envVersion?: string } = {}
      try {
        runtime = api.getSystemInfoSync?.() || {}
      }
      catch {}
      try {
        miniProgram = api.getAccountInfoSync?.().miniProgram || {}
      }
      catch {}
      const failure = error as { errno?: unknown, errCode?: unknown } | undefined
      const data = {
        build: MEDIA_DIAGNOSTIC_BUILD,
        traceId: id,
        entry,
        stage,
        time: new Date().toISOString(),
        elapsedMs: Date.now() - started,
        platform: runtime.platform,
        system: runtime.system,
        model: runtime.model,
        wechatVersion: runtime.version,
        sdkVersion: runtime.SDKVersion,
        miniVersion: miniProgram.version,
        envVersion: miniProgram.envVersion,
        count: details.count,
        rawCount: details.rawCount,
        validCount: details.validCount,
        hasPoster: details.hasPoster,
        kind: details.kind,
        provider: details.provider,
        httpStatus: details.httpStatus,
        businessCode: details.businessCode,
        errMsg: failed ? mediaErrorMessage(error) : undefined,
        errno: typeof failure?.errno === 'number' ? failure.errno : undefined,
        errCode: typeof failure?.errCode === 'number' ? failure.errCode : undefined,
      }
      const consoleMethod = failed ? console.error : console.info
      consoleMethod?.call(console, `[${MEDIA_LOG_TAG}]`, data)
      if (logger) {
        logger.addFilterMsg?.(MEDIA_LOG_TAG)
        const method = failed ? logger.error || logger.log : logger.info || logger.log
        method?.call(logger, MEDIA_LOG_TAG, data)
      }
    }
    catch {
      // 日志不可用时保持原选择/上传/下载流程，不能遮蔽原始错误。
    }
  }
  return {
    id,
    info: (stage: string, details?: MediaLogDetails) => write(stage, details),
    fail: (stage: string, error: unknown, details?: MediaLogDetails) => write(stage, details, error),
  }
}

export type MediaTrace = ReturnType<typeof createMediaTrace>

export function showMediaPickerFailure(error: unknown, trace: MediaTrace) {
  if (isMediaPickerCancel(error))
    return
  trace.fail('picker.final-fail', error)
  const content = `版本：${MEDIA_DIAGNOSTIC_BUILD}\n排查编号：${trace.id}\n${mediaErrorMessage(error)}`
  try {
    getApi().showModal?.({ title: '媒体选择失败', content, showCancel: false })
  }
  catch {}
}
