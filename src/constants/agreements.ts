export type AgreementType = 'service' | 'privacy'

export interface AgreementContent {
  type: AgreementType
  title: string
  updatedAt: string
  paragraphs: string[]
}

export const AGREEMENTS: Record<AgreementType, AgreementContent> = {
  service: {
    type: 'service',
    title: '用户服务协议',
    updatedAt: '2026-06-20',
    paragraphs: [
      '欢迎使用深租宝典。本协议用于说明你使用本小程序浏览房源、申请使用、提交资料和进行管理操作时的基本规则。',
      '你应保证使用本小程序时提交的信息真实、准确、合法，不得冒用他人身份，不得以爬取、批量复制、转售等方式获取或传播平台数据。',
      '平台内楼盘、房源、媒体、销控及管理数据属于重要业务资料。未获得相应权限前，你只能查看平台开放的脱敏预览内容。',
      '普通用户及以上权限可查看真实楼盘和房源信息；管理员权限可进行楼盘、楼栋、房源、销控等管理操作；超级管理员可进行用户审批和权限管理。',
      '如你违反本协议或存在异常使用行为，平台有权限制、暂停或终止你的账号权限，并保留追究相关责任的权利。',
    ],
  },
  privacy: {
    type: 'privacy',
    title: '隐私政策',
    updatedAt: '2026-06-20',
    paragraphs: [
      '本政策用于说明深租宝典在提供登录、申请使用、房源浏览和管理服务过程中如何处理必要的个人信息。',
      '当你点击同意并登录后，小程序会使用微信登录能力获取登录凭证，并向服务器换取账号身份，用于识别你的权限状态。',
      '如需完善资料，小程序会在你主动选择头像、填写昵称后提交，用于账号展示、申请审核和管理员识别。平台统一以系统昵称作为显示名称。',
      '当你主动使用定位、选择位置、附近距离筛选等功能时，小程序会处理位置坐标，用于计算距离或展示附近结果。你可以通过微信设置管理定位授权。',
      '平台不会向未授权用户展示真实楼盘名称、真实坐标、房源详情、图片视频等敏感数据。我们会采取必要措施保护账号资料和业务数据安全。',
      '如你不同意本政策，可以取消登录；取消后仍可浏览小程序允许匿名访问的脱敏预览内容。',
    ],
  },
}

export function getAgreement(type?: string): AgreementContent {
  return type === 'service' ? AGREEMENTS.service : AGREEMENTS.privacy
}
