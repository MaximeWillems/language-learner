// Adaptateur D1 minimal au-dessus de sql.js, pour appeler les vraies routes du Worker
// dans les tests. Sans lui, les tests ne couvrent que les requetes prises une a une :
// tout ce qui se passe entre elles — assemblage des cartes, viviers de leurres,
// ordonnancement — n'est jamais execute.

const shape = (stmt, params) => {
  stmt.bind(params)
  const out = []
  while (stmt.step()) out.push(stmt.getAsObject())
  return out
}

class Prepared {
  constructor(db, sql, params = []) {
    this.db = db
    this.sql = sql
    this.params = params
  }
  bind(...params) {
    return new Prepared(this.db, this.sql, params)
  }
  run() {
    const st = this.db.prepare(this.sql)
    try {
      shape(st, this.params)
      return { success: true, meta: { changes: this.db.getRowsModified() } }
    } finally {
      st.free()
    }
  }
  all() {
    const st = this.db.prepare(this.sql)
    try {
      return { results: shape(st, this.params), success: true }
    } finally {
      st.free()
    }
  }
  first() {
    return this.all().results[0] ?? null
  }
}

export function d1(db) {
  return {
    prepare: sql => new Prepared(db, sql),
    batch: async stmts => stmts.map(s => s.all())
  }
}

/** Un binding ASSETS inerte : les tests ne portent que sur /api. */
export const assets = { fetch: async () => new Response('', { status: 404 }) }

/** Appelle une route du Worker et rend le statut et le corps decode. */
export async function call(app, db, path, init = {}) {
  const res = await app.fetch(
    new Request('https://kotoba.test' + path, init),
    { DB: d1(db), ASSETS: assets }
  )
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}
