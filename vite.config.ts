import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Keep the upstream URL in server tooling, not in the browser's JS bundle.
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_TARGET')
  const invalidTarget = () => new Error('API_PROXY_TARGET must be an HTTP(S) origin without credentials, path, query, or fragment.')
  let target: URL
  try {
    target = new URL(env.API_PROXY_TARGET ?? 'http://localhost:3000')
  } catch {
    throw invalidTarget()
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password
    || target.pathname !== '/' || target.search || target.hash) throw invalidTarget()

  const proxy = { '/api': { target: target.origin, changeOrigin: true } }
  return {
    plugins: [react()],
    server: { proxy },
    // Local preview only. A deployed static build still needs a host-side proxy.
    preview: { proxy },
  }
})
