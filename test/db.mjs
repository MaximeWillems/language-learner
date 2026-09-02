// Rejoue les migrations dans une base SQLite en memoire. sql.js est du WebAssembly pur :
// pas de compilation native, et le meme moteur que D1 (SQLite) pour de vrai.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { KINDS, NEXT_ITEMS, PENDING } from '../.test-build/shared/sql.js'

export { KINDS, NEXT_ITEMS, PENDING }

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = join(root, 'migrations')

export const migrations = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

let SQL
export async function freshDb(upTo = migrations.length) {
  SQL ??= await initSqlJs()
  const db = new SQL.Database()
  for (const f of migrations.slice(0, upTo)) db.run(readFileSync(join(dir, f), 'utf8'))
  return db
}

/** Renvoie les lignes en objets, plutot que le format colonnes/valeurs de sql.js. */
export function rows(db, sql, params = []) {
  const st = db.prepare(sql)
  st.bind(params)
  const out = []
  while (st.step()) out.push(st.getAsObject())
  st.free()
  return out
}

export const one = (db, sql, params = []) => rows(db, sql, params)[0]
export const count = (db, table) => one(db, `SELECT COUNT(*) AS n FROM ${table}`).n

export const USER = 'local'
export const LANG = 'ja'
export const NOW = '2026-09-02T09:00:00.000Z'


/** Reproduit ce que fait l'API : enregistrer une selection, puis materialiser N elements. */
export function select(db, pairs) {
  for (const [script, grp] of pairs) {
    db.run(`INSERT OR IGNORE INTO deck_selection (user_id, lang, script, grp, added_at) VALUES (?,?,?,?,?)`,
      [USER, LANG, script, grp, NOW])
  }
}


export function materialize(db, want, filter = '', args = []) {
  const picked = rows(db, NEXT_ITEMS.replace('${FILTER}', filter), [USER, LANG, ...args, want, want])

  let written = 0
  for (const r of picked) {
    for (const kind of KINDS[r.script] ?? ['reading']) {
      db.run(`INSERT OR IGNORE INTO card (user_id, lang, item_type, item_id, kind, due, created_at)
              VALUES (?,?,?,?,?,?,?)`, [USER, LANG, r.item_type, r.item_id, kind, NOW, NOW])
      written++
    }
  }
  return { picked, written }
}
