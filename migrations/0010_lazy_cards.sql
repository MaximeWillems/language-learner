-- Les cartes etaient creees d'avance pour tout le contenu ajoute au paquet : cocher les
-- quatre niveaux de phrases ecrivait 12 000 lignes pour des cartes qu'on ne verrait pas
-- avant un an. On stocke desormais une simple selection, et la carte n'est creee qu'au
-- moment ou l'element est reellement introduit dans une seance.

CREATE TABLE deck_selection (
  user_id TEXT NOT NULL,
  lang    TEXT NOT NULL REFERENCES language(code),
  script  TEXT NOT NULL,
  grp     TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lang, script, grp)
);

-- Tout ce qui peut devenir une carte, avant qu'aucune carte n'existe.
CREATE VIEW content AS
SELECT 'character' AS item_type, id AS item_id, lang, kind AS script, grp, ord, glyph AS text
  FROM character
 WHERE grp <> 'rare'
UNION ALL
SELECT 'sentence', id, lang, 'sentence', 'level' || level, 100000 + id, text
  FROM sentence;

CREATE INDEX idx_card_item_lookup ON card (user_id, item_type, item_id);
