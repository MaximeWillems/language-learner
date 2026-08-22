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
shared/       types et comparaison des réponses, utilisés des deux côtés
src/          l'interface React
migrations/   le schéma SQL et les kana
scripts/      generation des donnees : kana (migration 0002), kanji (migration 0004)
```

## Ce qui marche

**Kana** — 208 signes : hiragana et katakana, gojuon + dakuten + yoon. Deux cartes
chacun : lire le signe (saisie libre) et le reconnaitre parmi quatre.

**Kanji** — les 2 136 joyo, les plus courants d'abord, groupes par niveau scolaire
(6 annees de primaire + college). Deux cartes chacun : donner le sens (parmi quatre)
et donner une lecture (saisie libre). 1 987 ont un sens en francais ; les 149 restants,
tous de niveau college, s'affichent en anglais avec une mention.

**Le moteur** — planification par FSRS (`ts-fsrs`), avec l'intervalle de chaque note
affiche avant de choisir. Plafond de 20 nouvelles cartes par jour, revisions et
nouveautes melangees. Chaque reponse est journalisee dans `review_log` : c'est cette
table qui permettra plus tard de reentrainer les parametres sur ton propre historique.

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

## Licences des donnees

KANJIDIC2 est publie par l'Electronic Dictionary Research and Development Group sous
licence CC BY-SA : **la mention de la source est obligatoire**. Elle figure en bas de
l'ecran d'accueil. Toute source ajoutee plus tard (JMdict, Tatoeba, KanjiVG) porte la
meme obligation.

## Raccourcis clavier

`Entrée` valide la réponse, puis accepte la note suggérée. `1` `2` `3` `4` choisissent
directement Encore / Dur / Bon / Facile.

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

Phase 02 : les phrases — script d'import avec decoupage en mots, liens
phrase / mot / caractere, traduction et texte a trous.
Ensuite : ecran de statistiques, confort d'ajout, mobile, outil de trace.
