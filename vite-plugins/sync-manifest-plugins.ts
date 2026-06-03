import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

interface ManifestType {
  plus?: {
    distribute?: {
      plugins?: Record<string, any>
    }
  }
  'app-plus'?: {
    distribute?: {
      plugins?: Record<string, any>
    }
  }
  'mp-weixin'?: {
    permission?: Record<string, any>
    requiredPrivateInfos?: string[]
  }
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath))
    return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export default function syncManifestPlugin(): Plugin {
  return {
    name: 'sync-manifest',
    apply: 'build',
    enforce: 'post',
    writeBundle: {
      order: 'post',
      handler() {
        const srcManifestPath = path.resolve(process.cwd(), './src/manifest.json')
        const srcManifest = readJson<ManifestType>(srcManifestPath)
        if (!srcManifest)
          return

        try {
          const distAppManifestPath = path.resolve(process.cwd(), './dist/dev/app/manifest.json')
          const distAppManifest = readJson<ManifestType>(distAppManifestPath) || {}
          const appPlusPlugins = srcManifest['app-plus']?.distribute?.plugins

          if (appPlusPlugins) {
            if (!distAppManifest.plus)
              distAppManifest.plus = {}
            if (!distAppManifest.plus.distribute)
              distAppManifest.plus.distribute = {}
            distAppManifest.plus.distribute.plugins = appPlusPlugins
            writeJson(distAppManifestPath, distAppManifest)
            console.log('Manifest app-plus plugins synced')
          }

          const mpWeixinConfig = srcManifest['mp-weixin']
          if (mpWeixinConfig?.permission || mpWeixinConfig?.requiredPrivateInfos?.length) {
            const mpWeixinTargets = [
              path.resolve(process.cwd(), './dist/dev/mp-weixin/app.json'),
              path.resolve(process.cwd(), './dist/build/mp-weixin/app.json'),
            ]

            for (const target of mpWeixinTargets) {
              const appJson = readJson<Record<string, any>>(target)
              if (!appJson)
                continue

              if (mpWeixinConfig.permission)
                appJson.permission = mpWeixinConfig.permission
              if (mpWeixinConfig.requiredPrivateInfos?.length)
                appJson.requiredPrivateInfos = mpWeixinConfig.requiredPrivateInfos

              writeJson(target, appJson)
              console.log(`Manifest mp-weixin config synced: ${target}`)
            }
          }
        }
        catch (error) {
          console.error('Sync manifest config failed:', error)
        }
      },
    },
  }
}
