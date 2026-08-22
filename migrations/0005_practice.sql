-- Distingue une revision planifiee d'un entrainement libre.
-- Seules les lignes 'review' devront servir a reentrainer les parametres FSRS :
-- une reponse donnee hors echeance ne dit rien de la courbe d'oubli.
ALTER TABLE review_log ADD COLUMN mode TEXT NOT NULL DEFAULT 'review';

CREATE INDEX idx_log_mode ON review_log (mode, reviewed_at);
