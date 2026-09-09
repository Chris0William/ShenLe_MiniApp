interface CommunityBusinessDisplay {
  managementFee?: number | null
  networkFee?: number | null
  networkFeeMode?: 1 | 2 | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
  petPolicy?: 1 | 2 | 3 | null
}

export function managementPackageText(value?: number | null) {
  if (value === 1)
    return '可包'
  if (value === 2)
    return '不可包'
  return ''
}

export function networkPackageText(value?: number | null) {
  if (value === 1)
    return '可包'
  if (value === 2)
    return '不可包'
  if (value === 3)
    return '自理'
  if (value === 4)
    return '必开'
  return ''
}

export function petPolicyText(value?: number | null) {
  if (value === 1)
    return '可养宠物'
  if (value === 2)
    return '不可养宠物'
  if (value === 3)
    return '可沟通养宠物'
  return ''
}

export function managementFeeText(item: CommunityBusinessDisplay) {
  const fee = item.managementFee === null || item.managementFee === undefined
    ? '未设置'
    : `${item.managementFee}元/月`
  const mode = managementPackageText(item.managementPackageMode)
  return mode ? `${fee}（${mode}）` : fee
}

export function networkFeeText(item: CommunityBusinessDisplay) {
  const mode = networkPackageText(item.networkPackageMode)
  if (item.networkFeeMode === 2 || mode === '自理')
    return '自理'
  if (item.networkFee === null || item.networkFee === undefined)
    return mode || '未设置'
  return mode ? `${item.networkFee}元/月（${mode}）` : `${item.networkFee}元/月`
}
