# Journal des versions

La version affichee en bas de l'application correspond a celle qui tourne sur le
serveur. Si ton onglet est reste ouvert pendant un deploiement, un bandeau te propose
de recharger.

## 0.10.0 — 2 septembre 2026

- **Ce que tu peux lire.** L'ecran de statistiques ouvre desormais sur le nombre de
  phrases du corpus dont tu connais tous les kanji, et sur celles auxquelles il ne
  manque qu'un seul kanji. C'est une mesure de capacite et non de volume : elle monte
  quand on apprend et **redescend quand on oublie**, ce qui la rend credible la ou une
  barre de progression de cours ment.
- Elle ne demande aucune ecriture en base : parfaitement compatible avec le plafond
  quotidien de D1.
- La courbe est lente au debut — c'est la langue qui veut ca — mais elle decolle vite :
  200 kanji donnent 297 phrases, 500 en donnent 1 161, 800 en donnent 1 820. Chaque
  nouveau kanji en debloque plusieurs.

## 0.9.2 — 2 septembre 2026

Rien de visible : cette version outille le projet plutot que l'application.

- **43 tests**, lances par `npm run check`. `sql.js` rejoue les migrations en memoire,
  donc les tests portent sur le vrai schema et le vrai moteur SQLite.
- Les requetes SQL et l'ordonnancement de la file sont sortis de `api/index.ts` vers
  `shared/sql.ts` et `shared/queue.ts`, importes par le Worker **et** par les tests :
  une requete recopiee dans un test finit toujours par diverger de la vraie.
- Chaque panne deja vecue a son test de non-regression : famine des kanji, cartes de
  phrase comptees comme des kanji, cout d'une selection, cartes jumelles qui se
  suivaient, entrainement libre qui aurait pu deplacer une revision.
- `npm run budget` chiffre ce que chaque migration ecrit et echoue si recreer la base
  depassait le quota quotidien de D1. Etat actuel : 53 039 lignes, 53 % d'une journee.
- Un test a corrige une idee fausse au passage : le rang d'introduction n'a pas besoin
  d'etre unique globalement — あ et ア partagent le leur — mais il doit l'etre au sein
  d'une famille, puisque c'est la que l'alternance ordonne.

## 0.9.1 — 22 aout 2026

- **Correction** : le quota d'ecriture quotidien de D1 a ete atteint. Ajouter du contenu
  au paquet creait immediatement deux cartes par element — cocher les quatre niveaux de
  phrases ecrivait **12 000 lignes** pour des cartes qu'on ne verrait pas avant un an au
  rythme de 20 nouveautes par jour.
- Le paquet enregistre desormais une **selection** (une ligne par groupe choisi), et la
  carte n'est creee qu'au moment ou l'element est reellement introduit dans une seance.
  La meme selection coute 6 lignes au lieu de 12 000 ; une seance de 20 nouveautes en
  ecrit 20.
- Les ecrans distinguent ce qui est **choisi** de ce qui est **deja introduit**.
- Les cartes creees avant ce changement restent valides : rien n'est a refaire.

## 0.9.0 — 22 aout 2026

- **Le parcours guide**, en prototype : deux chapitres, cinq lecons ecrites a la main.
  « Les kana » pose les trois ecritures, « La phrase minimale » couvre です, la question
  en か, la particule の, et la difference entre は et が.
- **Rien n'est verrouille.** Tous les chapitres sont ouverts, dans n'importe quel ordre.
  L'ordre affiche suit la grammaire parce qu'elle est reellement sequentielle, pas pour
  contraindre.
- **Les cartes sont proposees, jamais ajoutees d'office.** En fin de lecon, chaque mot et
  chaque exemple porte une case a cocher, pre-cochee seulement s'il n'est pas deja au
  paquet. Un bouton « je connais deja tout ca » marque la lecon sans rien ajouter.
- **La couverture est visible avant d'ouvrir** : chaque lecon affiche combien de ses
  elements sont deja au paquet et combien sont acquis. Elle se calcule sur les elements,
  donc une phrase partagee entre deux lecons compte pour les deux.
- **Les mots deviennent une famille de cartes** a part entiere, avec leur propre parcours
  de revision. Leur traduction vient de la lecon qui les enseigne — inutile d'importer un
  dictionnaire entier pour quelques centaines de mots.
- Les exemples ne sont pas ecrits mais **selectionnes dans le corpus** et resolus par leur
  texte au moment de la migration : les 14 exemples des cinq lecons en viennent tous.

## 0.8.0 — 22 aout 2026

- **Navigation par onglets** : Reviser, Caracteres, Phrases, Statistiques, Reglages.
  L'accueil empilait tout dans une seule page qui n'arretait pas de s'allonger.
- Chaque famille de contenu a son propre ecran : on y ajoute au paquet et on s'y
  entraine librement, sans passer par les reglages de l'autre.
- **Statistiques** : repartition acquises / en cours / jamais vues, taux de bonnes
  reponses, serie de jours consecutifs, revisions des quatorze derniers jours et
  **charge planifiee des quatorze prochains**. Ce dernier graphique est le plus utile :
  un pic annonce une journee lourde, donc le moment de lever le pied sur les nouveautes.
- Les reglages regroupent le rythme et les cartes a problème, avec une pastille dans
  l'onglet quand une carte demande une decision.
- `App.tsx` depassait les 400 lignes et melangeait cinq ecrans : decoupe en `Home`,
  `Deck`, `Stats`, `Settings` et un squelette de navigation.

## 0.7.0 — 22 aout 2026

- **Cartes a problème.** Une carte oubliee six fois ou plus est signalee pendant la
  seance et regroupee dans un panneau dedie, avec son nombre d'oublis et son taux de
  reussite reel.
- Trois actions, depuis la seance ou depuis le panneau : **mettre de cote** (la carte
  sort de la file sans disparaitre), **remettre a zero** (planification effacee, la
  carte redevient une nouveaute), **reactiver**.
- **Historique par carte** : les trente dernieres reponses, avec la note, ce qui a ete
  tape, et si la reponse venait d'une revision ou d'un entrainement.
- L'historique survit a la remise a zero : c'est lui qui garde la trace du probleme.

## 0.6.1 — 22 aout 2026

- **Deux parcours separes** au lieu d'une seule seance melangee : « Caracteres » et
  « Phrases », chacun avec son propre compteur et son propre bouton. Travailler un
  kanji isole et une phrase complete ne demande pas le meme etat d'esprit.
- La file de revision accepte les memes filtres que l'entrainement libre ; les deux
  routes partagent desormais la meme construction de filtre.
- Deux cartes d'un meme element ne se suivent plus : le texte a trous devoilait la
  traduction que la carte de comprehension allait demander juste apres, et le sens
  d'un kanji donnait sa lecture.
- Le plafond quotidien de nouveautes reste global : il se repartit sur le parcours
  que tu ouvres, il ne double pas.

## 0.6.0 — 22 aout 2026

- **Les phrases.** 6 000 phrases reelles traduites en francais, classees en quatre
  niveaux, avec leur decoupage en mots. Deux cartes chacune : comprendre le sens, et
  retrouver un mot masque parmi quatre.
- Le texte a trous est a choix multiples et non en saisie libre : sans methode de
  saisie japonaise, taper une forme flechie au clavier romaji est impossible.
- Les phrases entrent dans l'alternance des nouveautes, au meme titre que les kana et
  les kanji — le piege de la 0.3.1 ne se reproduit pas.
- Nouvelle forme de carte « retourner et se juger », pour les questions qu'aucune
  comparaison automatique ne peut trancher.
- Vue SQL unifiee : la file de revision traite caracteres et phrases par les memes
  requetes, la ou tout etait ecrit pour les seuls caracteres.
- **Correction** : la composition du paquet joignait les cartes aux caracteres par un
  identifiant sans verifier le type. Les 900 cartes de phrase etaient comptees comme
  des kanji et des kana.
- 40 363 phrases japonaises ont une traduction francaise sur Tatoeba, pas quelques
  milliers comme annonce dans l'analyse initiale. Le francais est la langue d'appui.

## 0.5.1 — 22 aout 2026

- **Correction** : une carte ratee ne revenait jamais dans la seance en cours. La file
  etait chargee une seule fois au demarrage, donc « revoir dans 1 min » ne se produisait
  qu'a la seance suivante. Une carte replanifiee a moins de 20 minutes est desormais
  reinseree quatre cartes plus loin, jusqu'a quatre fois par seance.
- Consequence visible : une seance presente plus de cartes qu'annonce au depart. C'est
  normal — une carte neuve demande deux « Bon » pour passer des paliers en minutes
  (1 / 6 / 10 min) aux intervalles en jours.

## 0.5.0 — 22 aout 2026

- Mise en page sur deux colonnes a partir de 900 px de large : l'action du jour et
  l'entrainement a gauche, le suivi et la configuration a droite. La colonne unique
  de 33 rem laissait les trois quarts d'un ecran de bureau vides.
- Corps de texte passe a 17 px, interlignage et tailles secondaires releves
- Gris de texte assombri en clair, eclairci en sombre : le contraste precedent etait
  a la limite du lisible pour les petites tailles
- Glyphe de revision porte a 9,5 rem sur grand ecran, champ de reponse et boutons de
  choix agrandis en consequence
- Le suivi passe en lignes libelle / valeur dans sa colonne, au lieu de trois cases
  serrees
- Les quatre sens d'un kanji s'affichent sur deux colonnes plutot qu'empiles

## 0.4.0 — 22 aout 2026

- Ecran d'accueil reorganise : l'action du jour d'abord, la configuration repliee
  dans un panneau « Gerer le paquet »
- Numero de version affiche, avec detection des onglets perimes
- Statistiques hierarchisees : ce qui est du ressort immediat se distingue du suivi
- Carte de revision resserree, notes plus lisibles

## 0.3.1 — 22 aout 2026

- **Correction** : les kanji ajoutes n'apparaissaient jamais en revision. Les
  nouvelles cartes suivaient un tri global sur l'ordre des caracteres, ou les kana
  precedent tous les kanji — cinq jours d'attente a 20 nouvelles par jour. Elles
  alternent desormais entre ecritures.
- La composition reelle du paquet est affichee
- Les combinaisons d'entrainement impossibles sont desactivees plutot que vides

## 0.3.0 — 22 aout 2026

- Entrainement libre : tirage au hasard, sans limite, filtrable, sans effet sur la
  planification des revisions
- Plafond de nouvelles cartes par jour reglable

## 0.2.0 — 22 aout 2026

- 2 136 kanji joyo importes de KANJIDIC2, groupes par niveau scolaire
- Deux cartes par kanji : le sens et une lecture
- Typographie japonaise passee en gothic, plus lisible que le mincho initial

## 0.1.0 — 22 aout 2026

- Boucle de revision complete sur les 208 kana
- Planification FSRS, plafond quotidien, journal des reponses
