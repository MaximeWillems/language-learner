import { writeFileSync } from 'node:fs'

const gojuon = [
  ['あ','ア','a'],['い','イ','i'],['う','ウ','u'],['え','エ','e'],['お','オ','o'],
  ['か','カ','ka'],['き','キ','ki'],['く','ク','ku'],['け','ケ','ke'],['こ','コ','ko'],
  ['さ','サ','sa'],['し','シ','shi'],['す','ス','su'],['せ','セ','se'],['そ','ソ','so'],
  ['た','タ','ta'],['ち','チ','chi'],['つ','ツ','tsu'],['て','テ','te'],['と','ト','to'],
  ['な','ナ','na'],['に','ニ','ni'],['ぬ','ヌ','nu'],['ね','ネ','ne'],['の','ノ','no'],
  ['は','ハ','ha'],['ひ','ヒ','hi'],['ふ','フ','fu'],['へ','ヘ','he'],['ほ','ホ','ho'],
  ['ま','マ','ma'],['み','ミ','mi'],['む','ム','mu'],['め','メ','me'],['も','モ','mo'],
  ['や','ヤ','ya'],['ゆ','ユ','yu'],['よ','ヨ','yo'],
  ['ら','ラ','ra'],['り','リ','ri'],['る','ル','ru'],['れ','レ','re'],['ろ','ロ','ro'],
  ['わ','ワ','wa'],['を','ヲ','wo'],['ん','ン','n']
]

const dakuten = [
  ['が','ガ','ga'],['ぎ','ギ','gi'],['ぐ','グ','gu'],['げ','ゲ','ge'],['ご','ゴ','go'],
  ['ざ','ザ','za'],['じ','ジ','ji'],['ず','ズ','zu'],['ぜ','ゼ','ze'],['ぞ','ゾ','zo'],
  ['だ','ダ','da'],['で','デ','de'],['ど','ド','do'],
  ['ば','バ','ba'],['び','ビ','bi'],['ぶ','ブ','bu'],['べ','ベ','be'],['ぼ','ボ','bo'],
  ['ぱ','パ','pa'],['ぴ','ピ','pi'],['ぷ','プ','pu'],['ぺ','ペ','pe'],['ぽ','ポ','po']
]

// ぢ / づ : memes lectures que じ / ず, quasi disparus. Presents en base, hors paquet par defaut.
const rare = [
  ['ぢ','ヂ','ji'],['づ','ヅ','zu']
]

const yoon = [
  ['きゃ','キャ','kya'],['きゅ','キュ','kyu'],['きょ','キョ','kyo'],
  ['しゃ','シャ','sha'],['しゅ','シュ','shu'],['しょ','ショ','sho'],
  ['ちゃ','チャ','cha'],['ちゅ','チュ','chu'],['ちょ','チョ','cho'],
  ['にゃ','ニャ','nya'],['にゅ','ニュ','nyu'],['にょ','ニョ','nyo'],
  ['ひゃ','ヒャ','hya'],['ひゅ','ヒュ','hyu'],['ひょ','ヒョ','hyo'],
  ['みゃ','ミャ','mya'],['みゅ','ミュ','myu'],['みょ','ミョ','myo'],
  ['りゃ','リャ','rya'],['りゅ','リュ','ryu'],['りょ','リョ','ryo'],
  ['ぎゃ','ギャ','gya'],['ぎゅ','ギュ','gyu'],['ぎょ','ギョ','gyo'],
  ['じゃ','ジャ','ja'],['じゅ','ジュ','ju'],['じょ','ジョ','jo'],
  ['びゃ','ビャ','bya'],['びゅ','ビュ','byu'],['びょ','ビョ','byo'],
  ['ぴゃ','ピャ','pya'],['ぴゅ','ピュ','pyu'],['ぴょ','ピョ','pyo']
]

const groups = [['gojuon', gojuon], ['dakuten', dakuten], ['rare', rare], ['yoon', yoon]]
const rows = []
let ord = 0

for (const [grp, table] of groups) {
  for (const [hira, kata, romaji] of table) {
    rows.push(['ja', hira, 'hiragana', romaji, grp, ord])
    rows.push(['ja', kata, 'katakana', romaji, grp, ord])
    ord++
  }
}

const values = rows
  .map(([lang, glyph, kind, reading, grp, o]) => `('${lang}','${glyph}','${kind}','${reading}','${grp}',${o})`)
  .join(',\n  ')

const sql = `-- Genere par scripts/seed-kana.mjs — ne pas editer a la main
INSERT INTO character (lang, glyph, kind, reading, grp, ord) VALUES
  ${values};
`

writeFileSync(new URL('../migrations/0002_seed_kana.sql', import.meta.url), sql, 'utf8')
console.log(`${rows.length} kana ecrits dans migrations/0002_seed_kana.sql`)
