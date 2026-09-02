// Le cours, ecrit a la main. Un chapitre = une etape de grammaire ; une lecon = un point.
//
// Les mots portent leur traduction ici : c'est ce qui evite d'importer un dictionnaire
// entier alors que seuls les mots enseignes ont besoin d'un sens.
//
// Les exemples sont designes par leur texte japonais et resolus contre le corpus au
// moment de la migration. Une phrase absente du corpus est ignoree sans casser l'import,
// donc verifier avec scripts/find-examples.mjs avant d'en ajouter une.

export const course = [
  {
    title: 'Les kana',
    summary: 'Lire n’importe quoi phonétiquement, même sans comprendre.',
    unlocks: 'Tout le reste. Rien n’est possible avant.',
    lessons: [
      {
        title: 'Les trois écritures',
        body: `Le japonais s’écrit avec trois systèmes mélangés dans la même phrase, et c’est déroutant tant qu’on n’a pas compris que chacun a un rôle distinct.

Les **hiragana** notent la grammaire : les terminaisons de verbes, les particules qui relient les mots. Ce sont eux qu’on voit partout, et ils s’apprennent en premier.

Les **katakana** notent ce qui vient d’ailleurs : les mots empruntés à l’anglais, les noms étrangers, parfois une mise en valeur. Mêmes sons que les hiragana, dessins différents.

Les **kanji** portent le sens. Un kanji est un mot ou une racine de mot, pas un son : 山 veut dire « montagne », et se lit différemment selon les mots où il apparaît.

Les deux premiers forment un ensemble fini de 46 signes de base chacun, qu’on peut vraiment finir. Les kanji, eux, s’accumulent toute la vie — c’est pourquoi ils ont leur propre rythme dans l’application, indépendant de ce parcours.

Cette leçon n’ajoute rien à ton paquet : va dans l’onglet **Caractères** pour charger les kana, et reviens quand tu les lis sans hésiter.`,
        words: [],
        examples: []
      }
    ]
  },
  {
    title: 'La phrase minimale',
    summary: 'Dire qu’une chose est une autre chose. La brique de tout le reste.',
    unlocks: 'Environ 40 % des phrases les plus simples du corpus.',
    lessons: [
      {
        title: 'X は Y です',
        body: `Le japonais n’a pas de verbe « être » au sens français. Il a **です**, qui se place à la fin et affirme poliment que la phrase tient.

La structure est fixe : d’abord ce dont on parle, ensuite ce qu’on en dit, et です pour fermer. **は** (écrit comme le kana *ha* mais prononcé *wa* dans ce rôle, une exception qu’il faut avaler telle quelle) marque le sujet du propos : « en ce qui concerne X… ».

C’est un rôle plus large que le sujet français. 今日は雪です ne dit pas « aujourd’hui est neige » mais « pour ce qui est d’aujourd’hui : neige ». Le japonais pose un cadre, puis le remplit — cette logique reviendra sans arrêt.

Rien n’indique le nombre ni la personne. La même phrase peut vouloir dire « je suis », « il est », « ils sont » : c’est le contexte qui tranche, et il suffit presque toujours.`,
        words: [
          ['これ', 'これ', 'ceci, cette chose-ci'],
          ['今日', 'きょう', 'aujourd’hui'],
          ['父', 'ちち', 'mon père'],
          ['元気', 'げんき', 'en forme, en bonne santé'],
          ['私', 'わたし', 'je, moi'],
          ['教師', 'きょうし', 'enseignant']
        ],
        examples: ['これは地図です。', '今日は雪です。', '父は元気です。', '私は教師です。']
      },
      {
        title: 'Poser une question avec か',
        body: `Pas d’inversion, pas de point d’interrogation obligatoire : on ajoute **か** à la fin de la phrase et elle devient une question. L’ordre des mots ne bouge pas.

**何** signifie « quoi ». Il se prononce *nani* seul, mais *nan* devant です et devant la plupart des consonnes — une contraction qu’on entend et qu’on finit par produire sans y penser.

Combiné à です, ça donne le squelette de toutes les questions d’identification : それは何ですか, littéralement « quant à cela, c’est quoi ? ».

À l’oral, l’intonation monte et le か disparaît souvent dans le registre familier. Garde-le à l’écrit et dans le registre poli : c’est la forme neutre et sûre.`,
        words: [
          ['それ', 'それ', 'cela, cette chose-là'],
          ['何', 'なに', 'quoi'],
          ['名前', 'なまえ', 'nom'],
          ['必要', 'ひつよう', 'nécessaire']
        ],
        examples: ['それは何ですか。', '名前は何ですか。', '何が必要ですか。']
      },
      {
        title: 'の, relier deux noms',
        body: `**の** accroche un nom à un autre. Le premier précise le second, dans cet ordre : 日本の人形, c’est « poupée du Japon », donc une poupée japonaise.

L’ordre est l’inverse du français, et c’est le premier endroit où il faut retourner sa manière de lire : **ce qui détermine vient toujours avant ce qui est déterminé**. Cette règle ne changera plus, et elle deviendra centrale quand tu arriveras aux propositions relatives.

の couvre bien plus que le possessif : origine, matière, appartenance, catégorie. 私の本 est mon livre, 日本の車 une voiture japonaise, 木の机 un bureau en bois. Un seul mot, là où le français en choisit trois.

Ne cherche pas à traduire の par un mot fixe. Lis-le comme une flèche qui va du détail vers l’ensemble.`,
        words: [
          ['日本', 'にほん', 'le Japon'],
          ['人形', 'にんぎょう', 'poupée'],
          ['誰', 'だれ', 'qui'],
          ['出身', 'しゅっしん', 'origine, provenance']
        ],
        examples: ['日本の人形です。', 'だれの番だ。', 'カナダの出身です。']
      },
      {
        title: 'は et が, la première vraie difficulté',
        body: `Les deux marquent quelque chose que le français appellerait le sujet, et pourtant ils ne sont pas interchangeables. C’est le premier obstacle sérieux du japonais, et il ne se règle pas en une leçon — seulement à l’usage.

**は** pose un cadre déjà connu : « en ce qui concerne X ». Il met souvent l’accent sur ce qui suit. **が** désigne au contraire ce dont on parle comme d’une information neuve, ou la mise en avant d’un élément précis parmi d’autres.

目が痛いです dit « c’est mon œil qui fait mal » — on identifie la partie concernée. 今日は雪です pose la journée comme décor, et la neige est l’information.

Un cas où が est obligatoire : avec 好き, 痛い et les mots qui décrivent un état ressenti. 読書が好きです se traduit « j’aime lire » mais se construit « la lecture est plaisante », et ce qui plaît prend が.

Ne t’attends pas à maîtriser la distinction maintenant. Retiens la règle des états ressentis, laisse le reste s’installer par exposition.`,
        words: [
          ['好き', 'すき', 'qui plaît, aimé'],
          ['痛い', 'いたい', 'douloureux'],
          ['目', 'め', 'œil'],
          ['歯', 'は', 'dent'],
          ['読書', 'どくしょ', 'lecture']
        ],
        examples: ['目が痛いです。', '歯が痛いです。', '読書が好きです。', '今日は雪です。']
      }
    ]
  }
]
