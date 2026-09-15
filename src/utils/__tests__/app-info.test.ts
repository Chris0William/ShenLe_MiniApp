import { describe, expect, it } from 'vitest'
import { API_ENV_LABEL, APP_CHANNEL, APP_VERSION } from '../app-info'

describe('app-info 版本信息', () => {
  it('版本号为三段式语义化格式', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('运行渠道标签为受控中文文案', () => {
    expect(['开发版', '体验版', '正式版']).toContain(APP_CHANNEL)
  })

  it('接口环境标签为受控中文文案', () => {
    expect(['测试环境', '正式环境']).toContain(API_ENV_LABEL)
  })
})
