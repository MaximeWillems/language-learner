# Kotoba

Apprentissage du japonais par répétition espacée : les kana d'abord, les kanji et les
phrases ensuite. Prévu pour tourner sur un sous-domaine de `pikilab.app`, entièrement
sur les offres gratuites de Cloudflare.

## Tout piloter depuis Cloudflare

Node 22 n'est pas installé sur la machine de dev, et Wrangler refuse de démarrer en
dessous. Tant que c'est le cas, tout passe par le tableau de bord Cloudflare et par
GitHub — aucune commande locale n'est nécessaire.

### 1. Créer la base

Tableau de bord → **Storage & Databases → D1 SQL Database → Create database**, nom
`kotoba`. Une fois créée, la page affiche un **Database ID** : le recopier dans
`wrangler.jsonc` à la place de `A_REMPLACER_APRES_npm_run_db_create`, puis pousser.

### 2. Régler le build du Worker

Worker `kotoba` → **Settings → Build** :

- **Build command** : `npm run build`
- **Deploy command** : `npx wrangler d1 migrations apply kotoba --remote && npx wrangler deploy`

La commande de déploiement applique les migrations avant de publier, donc les tables
et les kana se chargent tout seuls au premier build, et à chaque nouvelle migration
ensuite. Le fichier `.node-version` impose Node 22 au serveur de build.

Si la partie migrations échoue, repli : **D1 → kotoba → Console**, et coller à la main
le contenu de `migrations/0001_init.sql` puis de `migrations/0002_seed_kana.sql`. Dans
ce cas, retirer la partie `d1 migrations apply` de la commande de déploiement.

### 3. Le sous-domaine et l'accès

Worker → **Settings → Domains & Routes → Add custom domain** : `kotoba.pikilab.app`.

Puis **Zero Trust → Access → Applications** : une application *self-hosted* sur ce
domaine, avec une règle limitée à ton adresse mail. L'app lit ensuite l'en-tête
`Cf-Access-Authenticated-User-Email` — aucun code d'authentification à écrire. Sans
Access, l'app est publique et tout le monde partage l'utilisateur `local`.

## En local (le jour où Node 22 sera installé)

```
npm install
npx wrangler d1 migrations apply kotoba          # base locale
npm run dev:api                                   # Worker sur 8787
npm run dev:web                                   # interface sur 5173
```

## Structure

```
api/          le Worker : routes Hono + planification FSRS
shared/       partage entre le Worker et l'interface : types, comparaison des
              reponses, ordonnancement de la file, requetes SQL
test/         tests (node:test + sql.js), sans dependance exterieure
src/          l'interface React : App (navigation), Home, Deck, Stats,
              Settings, Review
migrations/   le schéma SQL et les kana
content/      le cours ecrit a la main (course.mjs)
scripts/      generation des donnees : kana, kanji, phrases, cours
```

## Ce qui marche

**Kana** — 208 signes : hiragana et katakana, gojuon + dakuten + yoon. Deux cartes
chacun : lire le signe (saisie libre) et le reconnaitre parmi quatre.

**Kanji** — les 2 136 joyo, les plus courants d'abord, groupes par niveau scolaire
(6 annees de primaire + college). Deux cartes chacun : donner le sens (parmi quatre)
et donner une lecture (saisie libre). 1 987 ont un sens en francais ; les 149 restants,
tous de niveau college, s'affichent en anglais avec une mention.

**Phrases** — 6 000 phrases reelles traduites en francais, classees en quatre niveaux
et decoupees en mots. Deux cartes chacune : **comprendre** (on retourne la carte et on
se juge) et **texte a trous** (un mot est masque, a retrouver parmi quatre).

Le texte a trous est a choix multiples et non en saisie libre : sans methode de saisie
japonaise, taper 行った au clavier romaji est impossible.

**Vocabulaire** — 2 499 mots tires des phrases du corpus, classes par frequence reelle
d'apparition. Deux cartes par mot : le sens, et la lecture — sauf pour les mots ecrits en
kana seul, ou demander la lecture reviendrait a recopier ce qui est affiche.

Les **150 mots les plus frequents sont traduits a la main** (`content/vocabulaire.mjs`).
Ils couvrent 62 % de toutes les occurrences, et ce sont les particules et auxiliaires,
pour lesquels les gloses anglaises de JMdict sont des explications grammaticales
inutilisables : « indicates sentence topic » n'apprend rien, « marque le theme de la
phrase » si. Le reste vient de JMdict. Au total **73 % des occurrences ont un sens en
francais**, 99 % en ont un.

La lecture de chaque mot vient du **corpus, par vote majoritaire**, et non des marqueurs
de priorite de JMdict : 人 se lit ひと 3 068 fois contre じん 17, ce qu'aucun classement
generique ne dit.

**Prononciation** — chaque lecture affichee est doublee de sa transcription en romaji.
Les lectures on s'ecrivent en katakana par convention, ce qui ne sert a rien tant qu'on
ne les lit pas couramment. Le kana reste au premier plan, la transcription en dessous.

**Le moteur** — planification par FSRS (`ts-fsrs`), avec l'intervalle de chaque note
affiche avant de choisir. Plafond de 20 nouvelles cartes par jour, revisions et
nouveautes melangees. Chaque reponse est journalisee dans `review_log` : c'est cette
table qui permettra plus tard de reentrainer les parametres sur ton propre historique.

**Le parcours** — un cours guide en chapitres. Le cours decide de ce qu'on apprend
ensuite, la repetition espacee decide de quand on le revoit : terminer une lecon ne fait
que creer des cartes ordinaires. **Aucun chapitre n'est verrouille**, et les cartes sont
proposees case a cocher, jamais ajoutees d'office. Chaque lecon affiche combien de ses
elements sont deja au paquet, ce qui remplace un test de placement.

Le cours vit dans `content/course.mjs` et se regenere avec
`node scripts/import-course.mjs`. Les mots y portent leur traduction ; les exemples sont
designes par leur texte japonais et resolus contre le corpus a la migration — une phrase
absente est ignoree sans casser l'import.

**Navigation** — cinq ecrans : Reviser, Caracteres, Phrases, Statistiques, Reglages.
Chaque famille de contenu a le sien, parce qu'on veut rarement travailler les kanji et
les phrases dans le meme mouvement.

**Statistiques** — en tete, **le nombre de phrases du corpus dont on connait tous les
kanji**, et celles auxquelles il ne manque qu'un kanji. Mesure de capacite plutot que de
volume : elle redescend quand on oublie. Puis la repartition des cartes, le taux de
reussite, la serie de jours, les revisions des quatorze derniers jours, et la **charge
planifiee des quatorze prochains**. Ce dernier
graphique est celui qui sert : un pic annonce une journee lourde, donc le moment de
baisser le plafond de nouveautes avant de la subir.

**Gestion des cartes** — une carte oubliee six fois ou plus (`lapses`, le compteur
FSRS) est signalee comme difficile. Depuis la seance ou depuis le panneau « Cartes a
problème », on peut la **mettre de cote** (elle sort de la file sans etre supprimee) ou
la **remettre a zero** (la planification est effacee, la carte redevient une nouveaute).
L'historique des reponses est conserve dans les deux cas : c'est lui qui garde la trace
du probleme. Repeter davantage une carte qui ne passe pas ne sert a rien — c'est le
seul cas ou la repetition espacee ne peut rien.

**Les reponses acceptees** — romaji Hepburn ou kunrei (`shi` = `si`, `tsu` = `tu`),
saisie directe en kana, hiragana pour un katakana, majuscules et espaces ignores.
Pour un kanji, n'importe laquelle de ses lectures on ou kun, avec ou sans l'okurigana
(`okona` comme `okonau`). Et un bouton « en fait c'etait juste » pour corriger une
note trop severe.

**Entrainement libre** — un mode sans echeance ni plafond : tire au hasard dans le
paquet, en boucle, filtrable par ecriture (hiragana / katakana / kanji) et par type
d'exercice. Les reponses sont journalisees avec `mode = 'practice'` mais **ne
modifient jamais la planification** : repondre a une carte hors de son echeance ne
dit rien de la courbe d'oubli, et laisser FSRS s'en nourrir ferait s'effondrer les
intervalles. Consequence pour plus tard : seules les lignes `mode = 'review'` doivent
servir a reentrainer les parametres.

**Introduction des nouveautes** — les nouvelles cartes sont servies **en alternance
entre ecritures** (`ROW_NUMBER() OVER (PARTITION BY ch.kind ...)`). Un tri global unique
ne marche pas : les kana portent `ord` 0-103 et les kanji 1000+, donc ajouter des kanji
ne donnait rien a reviser tant que les 208 kana n'etaient pas epuises — cinq jours
d'attente a 20 nouvelles par jour. Toute nouvelle famille de contenu (les mots, plus
tard) doit entrer dans cette rotation.

**Rythme** — le plafond de nouvelles cartes par jour se regle depuis l'accueil
(defaut 20, stocke dans `setting`). Il ne s'applique qu'aux cartes jamais vues ;
les revisions dues arrivent toujours en totalite.

## Regenerer les donnees

Les kana se regenerent seuls :

```
node scripts/seed-kana.mjs
```

Les kanji viennent de KANJIDIC2, un XML de 15 Mo qui n'est pas versionne. Pour
regenerer `migrations/0004_seed_kanji.sql`, telecharger
`http://www.edrdg.org/kanjidic/kanjidic2.xml.gz`, le decompresser, puis :

```
node scripts/import-kanji.mjs chemin/vers/kanjidic2.xml
```

Le vocabulaire vient de **JMdict** (`http://ftp.edrdg.org/pub/Nihongo/JMdict.gz`, 21 Mo),
croise avec les lectures du corpus Tanaka :

```
node scripts/import-vocab.mjs chemin/vers/le/dossier
```

Les phrases croisent deux sources : Tatoeba pour les textes et les traductions
francaises, le corpus Tanaka pour le decoupage en mots. Ce dernier evite d'embarquer
un analyseur morphologique, dont le dictionnaire pese 15 Mo et ne tiendrait pas dans
un navigateur — et son decoupage est fait a la main, donc plus fiable.

Telecharger dans un meme dossier `jpn_sentences.tsv`, `fra_sentences.tsv` et
`jpn-fra_links.tsv` depuis `https://downloads.tatoeba.org/exports/per_language/`,
ainsi que `http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz`, puis :

```
node scripts/import-sentences.mjs chemin/vers/le/dossier
```

Le script ne garde que les phrases dont le decoupage couvre au moins 85 % du texte :
Tanaka n'annote pas les noms propres, et une phrase a trous partiels est inexploitable.
Il ecarte aussi celles dont tous les mots sont deja largement couverts, sinon le tri
par frequence produit cinquante variations de la meme tournure.

## Versions

La version vit a un seul endroit : `shared/version.ts`. L'interface et le Worker
l'importent tous les deux, ce qui permet de detecter un onglet perime — au chargement,
la page compare sa version compilee a celle que renvoie `/api/version`, et propose de
recharger si elles different. Le numero est affiche en bas de l'accueil.

Format `x.y.z` : `z` pour une correction, `y` pour une nouvelle fonction, `x` pour une
refonte. **A incrementer dans le meme commit que le changement**, avec une entree dans
`CHANGELOG.md` — sinon la version affichee ment.

## Licences des donnees

Trois sources, **toutes avec mention obligatoire**, affichee en bas de l'accueil :

- **KANJIDIC2**, **JMdict** et le **corpus Tanaka** — Electronic Dictionary Research and
  Development Group, CC BY-SA
- **Tatoeba** — CC BY 2.0 FR

Toute source ajoutee plus tard (JMdict, KanjiVG) porte la meme obligation.

## Raccourcis clavier

`Entrée` valide la réponse, puis accepte la note suggérée. `1` `2` `3` `4` choisissent
directement Encore / Dur / Bon / Facile.

## Tests

```
npm run check
```

Enchaine la verification de types, les tests et le rapport de budget d'ecriture. Les
tests seuls : `npm test`.

Quarante-trois tests, sans service exterieur ni base distante. `sql.js` est du SQLite
compile en WebAssembly : les migrations sont rejouees en memoire, donc les tests portent
sur le vrai schema et le vrai moteur, pas sur une imitation.

Les requetes vivent dans `shared/sql.ts` et l'ordonnancement dans `shared/queue.ts`,
importes a la fois par le Worker et par les tests. **Une requete recopiee dans un test
finit toujours par diverger de celle qui tourne en production** ; ici c'est la meme.

Ce qui est couvert en priorite, ce sont les pannes deja vecues — chacune a son test de
non-regression :

| Test | Ce qu'il empeche de revenir |
| --- | --- |
| alternance entre familles | les kanji ajoutes n'arrivaient jamais, les kana passant tous avant |
| composition du paquet | les cartes de phrase comptees comme des kanji, faute de verifier le type |
| cout d'une selection | 12 000 lignes ecrites d'avance, qui ont fait toucher le plafond D1 |
| cartes d'un meme element | le texte a trous devoilait la traduction demandee juste apres |
| entrainement libre | une reponse hors echeance ne doit jamais deplacer une revision |

## Le budget d'ecriture D1

L'offre gratuite plafonne a **100 000 lignes ecrites par jour**, remis a zero a minuit
UTC. C'est large pour l'usage courant — une revision coute deux lignes — mais deux choses
en consomment beaucoup :

- **l'import du corpus de phrases** (migration 0007) : 50 641 lignes, dont 38 771 pour la
  seule table de liaison phrase / mot. C'est une depense unique, mais elle occupe la
  moitie du quota le jour ou elle passe ;
- **la constitution du paquet**, jusqu'a la version 0.9.0 : deux cartes creees d'avance
  par element selectionne. Corrige en 0.9.1 — les cartes naissent a l'introduction.

`npm run budget` chiffre chaque migration et echoue si recreer la base de zero
depasserait le quota. Aujourd'hui : 61 554 lignes, soit 62 % d'une journee.

**Un depassement de quota bloque aussi la publication du code.** La commande de
deploiement enchaine `d1 migrations apply --remote && wrangler deploy` : si les
migrations echouent faute de quota, le `&&` empeche la publication et le Worker reste
sur sa version precedente. C'est le comportement correct — publier du code qui attend
un schema absent casserait l'application — mais il faut savoir le lire : une
fonctionnalite qui « n'apparait pas » peut simplement n'avoir jamais ete deployee.

Le compteur s'est trompe deux fois avant d'etre juste, et les deux pieges valent d'etre
connus : compter la difference de `COUNT(*)` rate les migrations qui ne font que des
`UPDATE` — justement celles qu'on veut voir venir — et `getRowsModified` ne rend que le
compte de la derniere instruction, que SQLite laisse inchange apres un `CREATE TABLE`.
Les deux cas ont leur test.

En pratique : ne pas lancer un gros import le meme jour qu'une grosse session de mise au
point, et passer toute nouvelle migration au compteur avant de la pousser.

## Simplifications assumées

- **La journée commence à minuit UTC**, pas à minuit heure française. Le plafond de
  nouvelles cartes se réinitialise donc vers 1h ou 2h du matin.
- **ぢ et づ** sont en base mais exclus des paquets par défaut : mêmes lectures que じ et ず,
  quasi disparus de l'usage courant, et ambigus dans un exercice.
- **La correction se fait côté navigateur.** Le serveur enregistre le résultat sans le
  revérifier. Sans conséquence pour un usage personnel ; à revoir si l'app s'ouvre.
- **Pas d'ORM.** Les requêtes sont en SQL direct sur D1. Drizzle deviendra utile quand
  les jointures phrase / mot / caractère arriveront.

## Suite

0.9 : mode histoire — un parcours guide qui **propose** sans jamais verrouiller.
Le cours decide de ce qu'on apprend ensuite, la repetition espacee decide de quand on
le revoit. Le cout n'est pas technique : un curriculum avec explications n'a pas
d'equivalent ouvert, chaque lecon devra etre ecrite.
Ensuite : glose des mots via JMdict, mobile, outil de trace, audio.
