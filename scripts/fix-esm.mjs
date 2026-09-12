// tsc emet des imports relatifs sans extension, que Node refuse de resoudre en ESM.
// On les complete apres coup plutot que d'alourdir les sources : le bundler de
// production, lui, s'en passe tres bien.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? '.test-build'

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.js')) {
      const before = readFileSync(p, 'utf8')
      const after = before.replace(
        /(\bfrom\s+['"])(\.[^'"]*?)(['"])/g,
        (m, a, spec, b) => (/\.(js|json)$/.test(spec) ? m : `${a}${spec}.js${b}`)
      )
      if (after !== before) writeFileSync(p, after, 'utf8')
    }
  }
}

walk(root)
