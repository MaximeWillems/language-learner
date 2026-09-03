import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { matchesKana, matchesAnyReading } from '../.test-build/shared/normalize.js'

test('un kana se reconnait quelle que soit la romanisation', () => {
  for (const input of ['shi', 'si', 'SHI', ' shi ', 'し', 'シ'])
    assert.equal(matchesKana(input, 'し', 'shi'), true, input)
  for (const input of ['tsu', 'tu', 'つ']) assert.equal(matchesKana(input, 'つ', 'tsu'), true, input)
  for (const input of ['fu', 'hu']) assert.equal(matchesKana(input, 'ふ', 'fu'), true, input)
})

test('un katakana accepte la reponse donnee en hiragana', () => {
  assert.equal(matchesKana('a', 'ア', 'a'), true)
  assert.equal(matchesKana('あ', 'ア', 'a'), true)
  assert.equal(matchesKana('ア', 'ア', 'a'), true)
})

test('ん accepte n et nn', () => {
  // wanakana rend んん pour "nn" : le repli sur la lecture brute rattrape le cas
  assert.equal(matchesKana('n', 'ん', 'n'), true)
  assert.equal(matchesKana('nn', 'ん', 'n'), true)
})

test('une mauvaise reponse reste fausse', () => {
  assert.equal(matchesKana('o', 'あ', 'a'), false)
  assert.equal(matchesKana('ga', 'か', 'ka'), false)
  assert.equal(matchesKana('', 'あ', 'a'), false)
  assert.equal(matchesKana('   ', 'あ', 'a'), false)
  assert.equal(matchesKana('xyz', 'あ', 'a'), false)
})

test('un kanji accepte n importe laquelle de ses lectures', () => {
  const yama = ['サン', 'セン', 'やま']
  for (const input of ['yama', 'やま', 'san', 'サン', 'sen', 'SAN'])
    assert.equal(matchesAnyReading(input, yama), true, input)
  assert.equal(matchesAnyReading('kawa', yama), false)
})

test('l okurigana est optionnel', () => {
  // KANJIDIC ecrit おこな.う : le kanji couvre おこな, う s'ecrit en kana.
  // Un debutant tape naturellement la forme complete.
  const iku = ['コウ', 'ギョウ', 'い.く', 'ゆ.く', '-ゆ.き', 'おこな.う']
  for (const input of ['okona', 'okonau', 'おこな', 'おこなう', 'i', 'iku', 'yuki', 'kou'])
    assert.equal(matchesAnyReading(input, iku), true, input)
  assert.equal(matchesAnyReading('taberu', iku), false)
})

test('le marqueur de prefixe ne se prononce pas', () => {
  assert.equal(matchesAnyReading('bi', ['ニチ', 'ひ', '-び']), true)
  assert.equal(matchesAnyReading('', ['ニチ']), false)
})

test('une lecture en kana se transcrit en romaji', async () => {
  const { romajiOf } = await import('../.test-build/shared/normalize.js')
  // les lectures on s'ecrivent en katakana : サン ne se prononce pas tout seul
  assert.equal(romajiOf('サン'), 'san')
  assert.equal(romajiOf('セン'), 'sen')
  assert.equal(romajiOf('やま'), 'yama')
  assert.equal(romajiOf('ジツ'), 'jitsu')
  assert.equal(romajiOf('がくせい'), 'gakusei')
  assert.equal(romajiOf('ちょっと'), 'chotto')
  assert.equal(romajiOf(''), '')
})

test('la transcription garde ce qui porte du sens', async () => {
  const { romajiOf } = await import('../.test-build/shared/normalize.js')
  // le point marque ou le kanji s'arrete, le tiret marque un prefixe ou un suffixe
  assert.equal(romajiOf('おこな.う'), 'okona.u')
  assert.equal(romajiOf('い.く'), 'i.ku')
  assert.equal(romajiOf('-び'), '-bi')
})

test('transcrire puis relire redonne le meme kana', async () => {
  const { romajiOf, matchesAnyReading } = await import('../.test-build/shared/normalize.js')
  for (const kana of ['サン', 'やま', 'ニチ', 'がくせい', 'きょう', 'りゅう', 'ちょっと']) {
    assert.equal(matchesAnyReading(romajiOf(kana), [kana]), true,
      `${kana} -> ${romajiOf(kana)} ne revient pas sur ses pieds`)
  }
})
