import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const websiteDir = path.join(root, 'website')
const filesToCheck = [
  'index.html',
  'assets/styles.css',
  'assets/main.js',
  'README.md',
  'scripts/verify-website.mjs',
]

function assert(condition, message) {
  if (!condition) {
    console.error(`Website verification failed: ${message}`)
    process.exit(1)
  }
}

function readUtf8(relativePath) {
  const filePath = path.join(websiteDir, relativePath)
  assert(fs.existsSync(filePath), `missing ${relativePath}`)
  const bytes = fs.readFileSync(filePath)
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  assert(!hasBom, `${relativePath} has UTF-8 BOM`)
  return bytes.toString('utf8')
}

const html = readUtf8('index.html')
const plainText = html
  .replace(/<br\s*\/?>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, '')

for (const relativePath of filesToCheck.slice(1)) {
  readUtf8(relativePath)
}

const requiredSnippets = [
  '深租宝典',
  '深乐租',
  '把分散房源变成可运营的数据资产',
  '预约产品演示',
  '查看核心功能',
  '楼盘与房源管理',
  '地图找房与筛选',
  '销控看板',
  '媒体资产池',
  '数据与权限保护',
  '想把你的房源团队数字化',
  '不提供在线交易、支付或用户自行发布',
]

for (const snippet of requiredSnippets) {
  assert(plainText.includes(snippet.replace(/\s+/g, '')), `missing required copy: ${snippet}`)
}

const requiredIds = ['hero', 'features', 'scenarios', 'security', 'contact']
for (const id of requiredIds) {
  assert(html.includes(`id="${id}"`), `missing section id: ${id}`)
}

const forbiddenClaims = ['保证成交', '自动匹配客户', '官方认证房源', '真实房号', '房东电话']
for (const claim of forbiddenClaims) {
  assert(!html.includes(claim), `forbidden claim or sensitive wording found: ${claim}`)
}

assert(html.includes('assets/styles.css'), 'stylesheet is not linked')
assert(html.includes('assets/main.js'), 'main script is not linked')
console.log('Website verification passed')
