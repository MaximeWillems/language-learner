# Kotoba

Apprentissage du japonais par répétition espacée : les kana d'abord, les kanji et les
phrases ensuite. Prévu pour tourner sur un sous-domaine de `pikilab.app`, entièrement
sur les offres gratuites de Cloudflare.

## Prérequis

**Node 22 LTS minimum.** La version installée sur cette machine (20.18.1) est trop
ancienne pour Vite et pour Wrangler : les deux le signalent au démarrage, et
l'installation laisse de côté un binaire natif nécessaire à la compilation.
À télécharger sur [nodejs.org](https://nodejs.org) et à extraire à côté de
l'installation actuelle (`C:\Users\maxime.willems\tools\node\`).

## Mise en route

```
npm install
npx wrangler login
npx wrangler d1 create kotoba
```

La dernière commande affiche un `database_id` : le recopier dans `wrangler.jsonc`
à la place de `A_REMPLACER_APRES_npm_run_db_create`.

Ensuite, créer les tables et charger les 208 kana en local :

```
npm run db:migrate
```

Puis lancer les deux processus, dans deux terminaux :

```
npm run dev:api     # le Worker + la base, sur 8787
npm run dev:web     # l'interface, sur 5173
```

L'interface appelle `/api` et Vite le redirige vers le Worker.

## Déploiement

```
npm run db:migrate:remote
npm run deploy
```

Puis, dans le tableau de bord Cloudflare :

- **Workers & Pages → kotoba → Settings → Domains** : ajouter `kotoba.pikilab.app`
- **Zero Trust → Access → Applications** : créer une application *self-hosted* sur ce
  domaine, avec une règle limitée à ton adresse mail. L'app lit ensuite l'en-tête
  `Cf-Access-Authenticated-User-Email` pour identifier l'utilisateur — aucun code
  d'authentification à écrire. Sans Access, tout tombe sur l'utilisateur `local`.

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
