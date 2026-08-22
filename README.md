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
scripts/      génération du jeu de kana (regénère migrations/0002)
```

## Ce qui marche

- 208 kana en base : hiragana et katakana, gojūon + dakuten + yōon
- Deux cartes par kana : **lire** le signe (saisie libre) et le **reconnaître** parmi quatre
- Planification par FSRS via `ts-fsrs`, avec l'intervalle de chaque note affiché avant de choisir
- Plafond de 20 nouvelles cartes par jour, révisions et nouveautés mélangées
- Réponses acceptées en rōmaji Hepburn ou kunrei (`shi` = `si`, `tsu` = `tu`, `fu` = `hu`),
  directement en kana, en hiragana pour un katakana, majuscules et espaces ignorés
- Bouton « en fait c'était juste » pour corriger une note trop sévère
- Chaque réponse est journalisée dans `review_log` — c'est cette table qui permettra
  plus tard de réentraîner les paramètres FSRS sur ton propre historique

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

Phase 01 : import de KANJIDIC, cartes de lecture on/kun, écran de statistiques.
Phase 02 : les phrases — script d'import avec découpage en mots, texte à trous.
