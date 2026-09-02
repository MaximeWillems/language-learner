-- Genere par scripts/import-course.mjs depuis content/course.mjs
-- Ne pas editer a la main : editer le cours et relancer le script.
INSERT INTO milestone (id, lang, pos, title, summary, unlocks) VALUES
  (1, 'ja', 1, 'Les kana', 'Lire n’importe quoi phonétiquement, même sans comprendre.', 'Tout le reste. Rien n’est possible avant.');

INSERT INTO lesson (id, milestone_id, pos, title, body) VALUES
  (1, 1, 1, 'Les trois écritures', 'Le japonais s’écrit avec trois systèmes mélangés dans la même phrase, et c’est déroutant tant qu’on n’a pas compris que chacun a un rôle distinct.

Les **hiragana** notent la grammaire : les terminaisons de verbes, les particules qui relient les mots. Ce sont eux qu’on voit partout, et ils s’apprennent en premier.

Les **katakana** notent ce qui vient d’ailleurs : les mots empruntés à l’anglais, les noms étrangers, parfois une mise en valeur. Mêmes sons que les hiragana, dessins différents.

Les **kanji** portent le sens. Un kanji est un mot ou une racine de mot, pas un son : 山 veut dire « montagne », et se lit différemment selon les mots où il apparaît.

Les deux premiers forment un ensemble fini de 46 signes de base chacun, qu’on peut vraiment finir. Les kanji, eux, s’accumulent toute la vie — c’est pourquoi ils ont leur propre rythme dans l’application, indépendant de ce parcours.

Cette leçon n’ajoute rien à ton paquet : va dans l’onglet **Caractères** pour charger les kana, et reviens quand tu les lis sans hésiter.');

INSERT INTO milestone (id, lang, pos, title, summary, unlocks) VALUES
  (2, 'ja', 2, 'La phrase minimale', 'Dire qu’une chose est une autre chose. La brique de tout le reste.', 'Environ 40 % des phrases les plus simples du corpus.');

INSERT INTO lesson (id, milestone_id, pos, title, body) VALUES
  (2, 2, 1, 'X は Y です', 'Le japonais n’a pas de verbe « être » au sens français. Il a **です**, qui se place à la fin et affirme poliment que la phrase tient.

La structure est fixe : d’abord ce dont on parle, ensuite ce qu’on en dit, et です pour fermer. **は** (écrit comme le kana *ha* mais prononcé *wa* dans ce rôle, une exception qu’il faut avaler telle quelle) marque le sujet du propos : « en ce qui concerne X… ».

C’est un rôle plus large que le sujet français. 今日は雪です ne dit pas « aujourd’hui est neige » mais « pour ce qui est d’aujourd’hui : neige ». Le japonais pose un cadre, puis le remplit — cette logique reviendra sans arrêt.

Rien n’indique le nombre ni la personne. La même phrase peut vouloir dire « je suis », « il est », « ils sont » : c’est le contexte qui tranche, et il suffit presque toujours.');

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', 'これ', 'これ', 'ceci, cette chose-ci')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'word', 'word', id, 0 FROM word
 WHERE lang = 'ja' AND lemma = 'これ' AND reading = 'これ';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '今日', 'きょう', 'aujourd’hui')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'word', 'word', id, 1 FROM word
 WHERE lang = 'ja' AND lemma = '今日' AND reading = 'きょう';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '父', 'ちち', 'mon père')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'word', 'word', id, 2 FROM word
 WHERE lang = 'ja' AND lemma = '父' AND reading = 'ちち';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '元気', 'げんき', 'en forme, en bonne santé')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'word', 'word', id, 3 FROM word
 WHERE lang = 'ja' AND lemma = '元気' AND reading = 'げんき';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '私', 'わたし', 'je, moi')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'word', 'word', id, 4 FROM word
 WHERE lang = 'ja' AND lemma = '私' AND reading = 'わたし';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '教師', 'きょうし', 'enseignant')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'word', 'word', id, 5 FROM word
 WHERE lang = 'ja' AND lemma = '教師' AND reading = 'きょうし';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'example', 'sentence', id, 0 FROM sentence
 WHERE lang = 'ja' AND text = 'これは地図です。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'example', 'sentence', id, 1 FROM sentence
 WHERE lang = 'ja' AND text = '今日は雪です。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'example', 'sentence', id, 2 FROM sentence
 WHERE lang = 'ja' AND text = '父は元気です。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 2, 'example', 'sentence', id, 3 FROM sentence
 WHERE lang = 'ja' AND text = '私は教師です。';

INSERT INTO lesson (id, milestone_id, pos, title, body) VALUES
  (3, 2, 2, 'Poser une question avec か', 'Pas d’inversion, pas de point d’interrogation obligatoire : on ajoute **か** à la fin de la phrase et elle devient une question. L’ordre des mots ne bouge pas.

**何** signifie « quoi ». Il se prononce *nani* seul, mais *nan* devant です et devant la plupart des consonnes — une contraction qu’on entend et qu’on finit par produire sans y penser.

Combiné à です, ça donne le squelette de toutes les questions d’identification : それは何ですか, littéralement « quant à cela, c’est quoi ? ».

À l’oral, l’intonation monte et le か disparaît souvent dans le registre familier. Garde-le à l’écrit et dans le registre poli : c’est la forme neutre et sûre.');

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', 'それ', 'それ', 'cela, cette chose-là')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'word', 'word', id, 0 FROM word
 WHERE lang = 'ja' AND lemma = 'それ' AND reading = 'それ';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '何', 'なに', 'quoi')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'word', 'word', id, 1 FROM word
 WHERE lang = 'ja' AND lemma = '何' AND reading = 'なに';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '名前', 'なまえ', 'nom')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'word', 'word', id, 2 FROM word
 WHERE lang = 'ja' AND lemma = '名前' AND reading = 'なまえ';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '必要', 'ひつよう', 'nécessaire')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'word', 'word', id, 3 FROM word
 WHERE lang = 'ja' AND lemma = '必要' AND reading = 'ひつよう';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'example', 'sentence', id, 0 FROM sentence
 WHERE lang = 'ja' AND text = 'それは何ですか。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'example', 'sentence', id, 1 FROM sentence
 WHERE lang = 'ja' AND text = '名前は何ですか。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 3, 'example', 'sentence', id, 2 FROM sentence
 WHERE lang = 'ja' AND text = '何が必要ですか。';

INSERT INTO lesson (id, milestone_id, pos, title, body) VALUES
  (4, 2, 3, 'の, relier deux noms', '**の** accroche un nom à un autre. Le premier précise le second, dans cet ordre : 日本の人形, c’est « poupée du Japon », donc une poupée japonaise.

L’ordre est l’inverse du français, et c’est le premier endroit où il faut retourner sa manière de lire : **ce qui détermine vient toujours avant ce qui est déterminé**. Cette règle ne changera plus, et elle deviendra centrale quand tu arriveras aux propositions relatives.

の couvre bien plus que le possessif : origine, matière, appartenance, catégorie. 私の本 est mon livre, 日本の車 une voiture japonaise, 木の机 un bureau en bois. Un seul mot, là où le français en choisit trois.

Ne cherche pas à traduire の par un mot fixe. Lis-le comme une flèche qui va du détail vers l’ensemble.');

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '日本', 'にほん', 'le Japon')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'word', 'word', id, 0 FROM word
 WHERE lang = 'ja' AND lemma = '日本' AND reading = 'にほん';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '人形', 'にんぎょう', 'poupée')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'word', 'word', id, 1 FROM word
 WHERE lang = 'ja' AND lemma = '人形' AND reading = 'にんぎょう';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '誰', 'だれ', 'qui')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'word', 'word', id, 2 FROM word
 WHERE lang = 'ja' AND lemma = '誰' AND reading = 'だれ';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '出身', 'しゅっしん', 'origine, provenance')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'word', 'word', id, 3 FROM word
 WHERE lang = 'ja' AND lemma = '出身' AND reading = 'しゅっしん';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'example', 'sentence', id, 0 FROM sentence
 WHERE lang = 'ja' AND text = '日本の人形です。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'example', 'sentence', id, 1 FROM sentence
 WHERE lang = 'ja' AND text = 'だれの番だ。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 4, 'example', 'sentence', id, 2 FROM sentence
 WHERE lang = 'ja' AND text = 'カナダの出身です。';

INSERT INTO lesson (id, milestone_id, pos, title, body) VALUES
  (5, 2, 4, 'は et が, la première vraie difficulté', 'Les deux marquent quelque chose que le français appellerait le sujet, et pourtant ils ne sont pas interchangeables. C’est le premier obstacle sérieux du japonais, et il ne se règle pas en une leçon — seulement à l’usage.

**は** pose un cadre déjà connu : « en ce qui concerne X ». Il met souvent l’accent sur ce qui suit. **が** désigne au contraire ce dont on parle comme d’une information neuve, ou la mise en avant d’un élément précis parmi d’autres.

目が痛いです dit « c’est mon œil qui fait mal » — on identifie la partie concernée. 今日は雪です pose la journée comme décor, et la neige est l’information.

Un cas où が est obligatoire : avec 好き, 痛い et les mots qui décrivent un état ressenti. 読書が好きです se traduit « j’aime lire » mais se construit « la lecture est plaisante », et ce qui plaît prend が.

Ne t’attends pas à maîtriser la distinction maintenant. Retiens la règle des états ressentis, laisse le reste s’installer par exposition.');

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '好き', 'すき', 'qui plaît, aimé')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'word', 'word', id, 0 FROM word
 WHERE lang = 'ja' AND lemma = '好き' AND reading = 'すき';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '痛い', 'いたい', 'douloureux')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'word', 'word', id, 1 FROM word
 WHERE lang = 'ja' AND lemma = '痛い' AND reading = 'いたい';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '目', 'め', 'œil')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'word', 'word', id, 2 FROM word
 WHERE lang = 'ja' AND lemma = '目' AND reading = 'め';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '歯', 'は', 'dent')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'word', 'word', id, 3 FROM word
 WHERE lang = 'ja' AND lemma = '歯' AND reading = 'は';

INSERT INTO word (lang, lemma, reading, gloss) VALUES ('ja', '読書', 'どくしょ', 'lecture')
  ON CONFLICT (lang, lemma, reading) DO UPDATE SET gloss = excluded.gloss;

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'word', 'word', id, 4 FROM word
 WHERE lang = 'ja' AND lemma = '読書' AND reading = 'どくしょ';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'example', 'sentence', id, 0 FROM sentence
 WHERE lang = 'ja' AND text = '目が痛いです。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'example', 'sentence', id, 1 FROM sentence
 WHERE lang = 'ja' AND text = '歯が痛いです。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'example', 'sentence', id, 2 FROM sentence
 WHERE lang = 'ja' AND text = '読書が好きです。';

INSERT OR IGNORE INTO lesson_item (lesson_id, role, item_type, item_id, pos)
SELECT 5, 'example', 'sentence', id, 3 FROM sentence
 WHERE lang = 'ja' AND text = '今日は雪です。';
