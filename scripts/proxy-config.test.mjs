import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

async function configFor(t, mode, override, withDefaults = true) {
  // Isolate env loading from a developer's private .env*.local files and shell.
  const directory = mkdtempSync(join(tmpdir(), 'acme-proxy-test-'))
  const previousDirectory = process.cwd()
  const previousTarget = process.env.API_PROXY_TARGET
  t.after(() => {
    process.chdir(previousDirectory)
    if (previousTarget === undefined) delete process.env.API_PROXY_TARGET
    else process.env.API_PROXY_TARGET = previousTarget
    rmSync(directory, { recursive: true, force: true })
  })
  if (withDefaults) {
    for (const filename of ['.env.development', '.env.production']) {
      copyFileSync(join(projectRoot, filename), join(directory, filename))
    }
  }
  process.chdir(directory)
  if (override === undefined) delete process.env.API_PROXY_TARGET
  else process.env.API_PROXY_TARGET = override
  const result = await loadConfigFromFile(
    { command: 'serve', mode }, join(projectRoot, 'vite.config.ts'), projectRoot, 'silent',
  )
  assert.ok(result)
  return result.config
}

test('development routes /api to localhost and preserves the /api path', async (t) => {
  const config = await configFor(t, 'development')
  assert.equal(config.server.proxy['/api'].target, 'http://localhost:3000')
  assert.equal(config.server.proxy['/api'].changeOrigin, true)
  assert.equal(config.server.proxy['/api'].rewrite, undefined)
})

test('production mode and local preview share the Railway target', async (t) => {
  const config = await configFor(t, 'production')
  assert.equal(config.server.proxy['/api'].target, 'https://of-acme-salary-dashboard-service-production.up.railway.app')
  assert.deepEqual(config.preview.proxy, config.server.proxy)
})

test('process environment overrides the mode-specific file', async (t) => {
  const config = await configFor(t, 'production', 'https://backend.example.test/')
  assert.equal(config.server.proxy['/api'].target, 'https://backend.example.test')
})

test('missing configuration defaults to localhost', async (t) => {
  const config = await configFor(t, 'test', undefined, false)
  assert.equal(config.server.proxy['/api'].target, 'http://localhost:3000')
})

for (const value of ['', 'invalid', 'ftp://backend.example.test', 'https://user:secret@backend.example.test',
  'https://backend.example.test/api', 'https://backend.example.test?key=value', 'https://backend.example.test/#fragment']) {
  test(`rejects invalid proxy origin ${value.replace('user:secret@', '[credentials]@') || '(empty)'}`, async (t) => {
    await assert.rejects(configFor(t, 'production', value), /API_PROXY_TARGET must be an HTTP\(S\) origin/)
  })
}
