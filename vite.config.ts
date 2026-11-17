import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { isPublicArtifact, servePublicFile } from './tools/public-files.mjs'
import { profileHandler } from './tools/behavior-profile.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const shared = path.join(root, 'shared')
const handleProfile = profileHandler(new URL('./data/profiles/', import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: 'saifen-local-data',
      configureServer(server) {
        server.middlewares.use(handleProfile)
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/shared/') || req.url.startsWith('/shared/web/')) return next()
          void servePublicFile(root, req, res, true)
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use(handleProfile)
      },
      writeBundle(output) {
        if (!output.dir) return
        const dest = path.resolve(output.dir, 'shared')
        fs.rmSync(dest, { recursive: true, force: true })
        for (const file of ['summary.json', 'current_run.json', ...fs.readdirSync(path.join(shared, 'heatmaps')).map(
          (name) => `heatmaps/${name}`
        )]) {
          if (!isPublicArtifact(`shared/${file}`)) continue
          const target = path.join(dest, file)
          fs.mkdirSync(path.dirname(target), { recursive: true })
          fs.copyFileSync(path.join(shared, file), target)
        }
      },
    },
    {
      name: 'figma-asset-resolver',
      resolveId(id) {
        if (id.startsWith('figma:asset/')) {
          return path.resolve(root, 'src/assets', id.slice('figma:asset/'.length))
        }
      },
    },
    react(),
    tailwindcss(),
  ],
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  server: {
    fs: {
      allow: [root],
      deny: [
        '.env', '.env.*', '*.{crt,pem}', '**/.git/**',
        ...['data', 'pipeline', 'supabase', 'shared/runs', 'shared/behavior'].map(
          (dir) => `${path.join(root, dir)}/**`
        ),
      ],
    },
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
