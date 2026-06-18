import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = path.resolve(root, 'dist/build/mp-weixin')
const target = path.resolve(root, 'dist/dev/mp-weixin')

function assertInsideRoot(value, label) {
  const relative = path.relative(root, value)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside project root: ${value}`)
  }
}

assertInsideRoot(source, 'source')
assertInsideRoot(target, 'target')

if (!fs.existsSync(source)) {
  throw new Error(`mp-weixin build output not found: ${source}`)
}

fs.rmSync(target, { recursive: true, force: true })
fs.mkdirSync(path.dirname(target), { recursive: true })

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name)
    const targetPath = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
    }
    else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

copyDirectory(source, target)

console.log(`mp-weixin dist synced: ${source} -> ${target}`)
