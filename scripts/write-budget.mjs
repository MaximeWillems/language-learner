// Compte les lignes que chaque migration ecrit. L'offre gratuite de D1 plafonne a
// 100 000 lignes par jour : recreer la base de zero doit tenir dans ce budget, sinon
// l'operation echoue a mi-parcours et laisse une base incomplete.
//
//   npm run budget

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'

const DAILY_LIMIT = 100_000
const LOUD = 10_000

const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'migrations')
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

const SQL = await initSqlJs()
const db = new SQL.Database()

const tables = () => {
  const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  return res.length ? res[0].values.map(v => v[0]) : []
}

const snapshot = () => {
  const out = new Map()
  for (const t of tables()) out.set(t, db.exec(`SELECT COUNT(*) FROM "${t}"`)[0].values[0][0])
  return out
}

const fmt = n => n.toLocaleString('fr-FR')
let prev = new Map()
let total = 0
const report = []

for (const f of files) {
  db.run(readFileSync(join(dir, f), 'utf8'))
  const now = snapshot()
  let written = 0
  for (const [t, n] of now) written += n - (prev.get(t) ?? 0)
  prev = now
  total += written
  report.push({ f, written })
}

const width = Math.max(...report.map(r => r.f.length))
console.log(`\n${'migration'.padEnd(width)}  ${'lignes'.padStart(9)}`)
console.log('-'.repeat(width + 11))
for (const { f, written } of report) {
  const flag = written >= LOUD ? '  <-- lourde' : ''
  console.log(`${f.padEnd(width)}  ${fmt(written).padStart(9)}${flag}`)
}
console.log('-'.repeat(width + 11))
console.log(`${'TOTAL'.padEnd(width)}  ${fmt(total).padStart(9)}`)

const share = Math.round((total / DAILY_LIMIT) * 100)
console.log(`\nRecreer la base de zero consomme ${share} % du quota quotidien (${fmt(DAILY_LIMIT)} lignes).`)

const heavy = report.filter(r => r.written >= LOUD)
if (heavy.length) {
  console.log('\nMigrations lourdes — a garder a l esprit avant d en ajouter une autre :')
  for (const h of heavy) console.log(`  ${h.f} : ${fmt(h.written)} lignes`)
}

if (total > DAILY_LIMIT) {
  console.error(`\nECHEC : ${fmt(total)} lignes depassent le quota quotidien.`)
  console.error('Une base recreee de zero echouerait a mi-parcours.')
  process.exit(1)
}
