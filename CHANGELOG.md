# Journal des versions

La version affichee en bas de l'application correspond a celle qui tourne sur le
serveur. Si ton onglet est reste ouvert pendant un deploiement, un bandeau te propose
de recharger.

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
