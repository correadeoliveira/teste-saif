import { defineConfig } from 'vite'
import path from 'path'
import fs from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


// Recebe o perfil de comportamento do questionário e grava em data/profiles/,
// que é ignorado pelo git (dado pessoal, local por instalação). Funciona tanto
// no dev quanto no preview, porque os dois passam por middlewares do Vite.
const PROFILE_LIMIT = 64 * 1024

function behaviorApi() {
  const handler = (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/')) return next()
    if (req.method !== 'POST') {
      res.statusCode = 405
      return res.end(JSON.stringify({ error: 'method_not_allowed' }))
    }

    let body = ''
    let aborted = false
    req.on('data', (c: Buffer) => {
      body += c
      if (body.length > PROFILE_LIMIT) {
        aborted = true
        res.statusCode = 413
        res.end(JSON.stringify({ error: 'payload_too_large' }))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (aborted) return
      let payload: any
      try {
        payload = JSON.parse(body)
      } catch {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: 'invalid_json' }))
      }
      const dir = path.resolve(__dirname, 'data/profiles')
      fs.mkdirSync(dir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const file = path.join(dir, `profile_${stamp}.json`)
      fs.writeFileSync(
        file,
        JSON.stringify({ received_at: new Date().toISOString(), profile: payload }, null, 2)
      )
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, stored: path.basename(file) }))
    })
    return undefined
  }

  return {
    name: 'behavior-api',
    configureServer(server: any) { server.middlewares.use(handler) },
    configurePreviewServer(server: any) { server.middlewares.use(handler) },
  }
}

function figmaAssetResolver() {  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function serveShared() {
  const sharedRoot = path.resolve(__dirname, 'shared')
  const types: Record<string, string> = {
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/geo+json; charset=utf-8',
  }
  return {
    name: 'serve-shared',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/shared/')) return next()
        const rel = decodeURIComponent(req.url.split('?')[0].replace(/^\/shared\//, ''))
        const file = path.resolve(sharedRoot, rel)
        if (!file.startsWith(sharedRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          return next()
        }
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      if (!fs.existsSync(sharedRoot)) return
      fs.cpSync(sharedRoot, path.resolve(__dirname, 'dist', 'shared'), { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [
    serveShared(),
    behaviorApi(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname)],
    },
    // dev em 5173: 4173 fica reservado para o servidor estatico da
    // landing SAIFEN SECURITY (~/Documentos/Projeto Padrao).
    port: 5173,
    strictPort: true,
  },

  // `preview` e chave de primeiro nivel no Vite, irma de `server`. Aninhar
  // dentro de `server` faz o Vite ignora-la e cair no default 4173.
  preview: {
    port: 4174,
    strictPort: true,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})

