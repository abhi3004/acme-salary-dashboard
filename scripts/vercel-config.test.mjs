import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseEnv } from 'node:util'

const readConfig = () => JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const productionTarget = () => parseEnv(readFileSync(new URL('../.env.production', import.meta.url), 'utf8')).API_PROXY_TARGET

// Configuration contract tests; hosted routing/cookies must also be checked after deployment.
test('Vercel builds and serves the Vite frontend', () => {
  const config = readConfig()
  assert.equal(config.framework, 'vite')
  assert.equal(config.buildCommand, 'npm run build')
  assert.equal(config.outputDirectory, 'dist')
})

test('Vercel proxies all API paths to the same Railway origin as the production env file', () => {
  const config = readConfig()
  const rule = config.rewrites.find(({ source }) => source === '/api/:path*')
  assert.deepEqual(rule, {
    source: '/api/:path*', destination: `${productionTarget()}/api/:path*`,
  })
  for (const path of ['auth/login', 'auth/me', 'employees/imports', 'employees/EMP-123/change-requests', 'audit-events']) {
    assert.equal(rule.destination.replace(':path*', path), `${productionTarget()}/api/${path}`)
  }
  assert.equal(config.redirects, undefined) // Keep cookie-authenticated requests same-origin.
})

test('the API rewrite precedes the React-router fallback', () => {
  const config = readConfig()
  assert.equal(config.rewrites[0].source, '/api/:path*')
  assert.deepEqual(config.rewrites.at(-1), { source: '/(.*)', destination: '/index.html' })
})

test('API responses opt out of browser and Vercel rewrite caching', () => {
  const rule = readConfig().headers.find(({ source }) => source === '/api/:path*')
  assert.ok(rule)
  const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]))
  assert.equal(headers['cache-control'], 'private, no-store')
  assert.equal(headers['x-vercel-enable-rewrite-caching'], '0')
})
