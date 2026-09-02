// Compte les lignes qu'un script SQL ecrit reellement dans une base SQLite.
//
// Deux pieges, tous deux rencontres :
//   - compter la difference de COUNT(*) rate les migrations qui ne font que des UPDATE,
//     et ce sont justement celles qu'on veut voir venir ;
//   - `getRowsModified` ne rend que le compte de la derniere instruction, et SQLite le
//     laisse inchange apres une instruction qui ne modifie rien : lire ce compteur apres
//     un CREATE TABLE recompte la precedente.

export const isWrite = sql =>
  /^(insert|update|delete|replace)/i.test(sql.replace(/^(?:\s+|--.*$)*/m, '').trimStart())

export function countWrites(db, sql) {
  let written = 0
  for (const stmt of db.iterateStatements(sql)) {
    const text = stmt.getSQL()
    stmt.step()
    if (isWrite(text)) written += db.getRowsModified()
    stmt.free()
  }
  return written
}
