// Transforme content/course.mjs en migrations/0009_seed_course.sql
//
//   node scripts/import-course.mjs
//
// Les mots sont inseres ou completes selon qu'ils existent deja dans le corpus, et les
// exemples sont resolus par leur texte : une phrase absente ne casse pas l'import, elle
// est simplement ignoree. Les identifiants sont retrouves en SQL plutot que devines.

import { writeFileSync } from 'node:fs'
import { course } from '../content/course.mjs'

const q = v => `'${String(v).replace(/'/g, "''")}'`
const parts = []

let lessonId = 0
let milestoneId = 0

for (const chapter of course) {
  milestoneId++
  parts.push(
    `INSERT INTO milestone (id, lang, pos, title, summary, unlocks) VALUES\n` +
    `  (${milestoneId}, 'ja', ${milestoneId}, ${q(chapter.title)}, ${q(chapter.summary)}, ${q(chapter.unlocks)});`
  )

  chapter.lessons.forEach((lesson, n) => {
    lessonId++
    parts.push(
      `INSERT INTO lesson (id, milestone_id, pos, title, body) VALUES\n` +
      `  (${lessonId}, ${milestoneId}, ${n + 1}, ${q(lesson.title)}, ${q(lesson.body)});`
    )

    lesson.words.forEach(([lemma, reading, gloss], pos) => {
      parts.push(
        `INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', ${q(lemma)}, ${q(reading)}, ${q(gloss)})\n` +
        `  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;`
      )
      parts.push(
        `INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)\n` +
        `SELECT ${lessonId}, 'word', 'word', id, ${pos} FROM word\n` +
        ` WHERE lang = 'ja' AND lemma = ${q(lemma)} AND reading = ${q(reading)};`
      )
    })

    lesson.examples.forEach((text, pos) => {
      parts.push(
        `INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)\n` +
        `SELECT ${lessonId}, 'example', 'sentence', id, ${pos} FROM sentence\n` +
        ` WHERE lang = 'ja' AND text = ${q(text)};`
      )
    })
  })
}

const header = [
  '-- Genere par scripts/import-course.mjs depuis content/course.mjs',
  '-- Ne pas editer a la main : editer le cours et relancer le script.',
  ''
].join('\n')

writeFileSync(new URL('../migrations/0009_seed_course.sql', import.meta.url), header + parts.join('\n\n') + '\n', 'utf8')

const words = course.reduce((a, c) => a + c.lessons.reduce((b, l) => b + l.words.length, 0), 0)
const examples = course.reduce((a, c) => a + c.lessons.reduce((b, l) => b + l.examples.length, 0), 0)
console.log(`${milestoneId} chapitres, ${lessonId} lecons, ${words} mots, ${examples} exemples`)
console.log(`${parts.length} instructions SQL`)
