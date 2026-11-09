#!/usr/bin/env node
// Server hisob yig'masi (supabase/functions/_shared/generated/engine.js) manbadan (src/server/engine.ts) qayta
// yig'ilganiga mos kelishini tekshiradi. Mos kelmasa: `npm run build:engine` va natijani commit qiling.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const committed = path.join(root, 'supabase', 'functions', '_shared', 'generated', 'engine.js')
const outDir = mkdtempSync(path.join(tmpdir(), 'eduflow-engine-'))

try {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.engine.config.ts'], {
    cwd: root,
    env: { ...process.env, ENGINE_OUT_DIR: outDir },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  if (result.status !== 0) {
    console.error('check-engine: yig\'ish muvaffaqiyatsiz')
    process.exit(1)
  }
  const fresh = readFileSync(path.join(outDir, 'engine.js'), 'utf8')
  const current = readFileSync(committed, 'utf8')
  if (fresh !== current) {
    console.error('check-engine: generated/engine.js eskirgan — `npm run build:engine` bilan yangilab, commit qiling')
    process.exit(1)
  }
  console.log('check-engine: generated/engine.js manba bilan mos')
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
