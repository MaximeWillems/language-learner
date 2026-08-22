-- Colonnes propres aux kanji. Les kana n'utilisent que glyph + reading.
ALTER TABLE character ADD COLUMN meanings TEXT;
ALTER TABLE character ADD COLUMN meaning_lang TEXT;
ALTER TABLE character ADD COLUMN on_readings TEXT;
ALTER TABLE character ADD COLUMN kun_readings TEXT;
ALTER TABLE character ADD COLUMN grade INTEGER;
ALTER TABLE character ADD COLUMN strokes INTEGER;
ALTER TABLE character ADD COLUMN freq INTEGER;
ALTER TABLE character ADD COLUMN jlpt INTEGER;

CREATE INDEX idx_character_grade ON character (lang, kind, grade, freq);
