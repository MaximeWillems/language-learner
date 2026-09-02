// Compte les lignes que chaque migration ecrit. L'offre gratuite de D1 plafonne a
// 100 000 lignes par jour : recreer la base de zero doit tenir dans ce budget, sinon
// l'operation echoue a mi-parcours et laisse une base incomplete.
//
//   npm run budget

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { countWrites } from './count-writes.mjs'

const DAILY_LIMIT = 100_000
const LOUD = 10_000

const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'migrations')
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

const SQL = await initSqlJs()
const db = new SQL.Database()

const report = files.map(f => ({ f, written: countWrites(db, readFileSync(join(dir, f), 'utf8')) }))
const total = report.reduce((a, r) => a + r.written, 0)

const fmt = n => n.toLocaleString('fr-FR')
const width = Math.max(...report.map(r => r.f.length))

console.log(`\n${'migration'.padEnd(width)}  ${'lignes'.padStart(9)}`)
console.log('-'.repeat(width + 11))
for (const { f, written } of report) {
  console.log(`${f.padEnd(width)}  ${fmt(written).padStart(9)}${written >= LOUD ? '  <-- lourde' : ''}`)
}
console.log('-'.repeat(width + 11))
console.log(`${'TOTAL'.padEnd(width)}  ${fmt(total).padStart(9)}`)

console.log(`\nRecreer la base de zero consomme ${Math.round(total / DAILY_LIMIT * 100)} % du quota quotidien (${fmt(DAILY_LIMIT)} lignes).`)

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
