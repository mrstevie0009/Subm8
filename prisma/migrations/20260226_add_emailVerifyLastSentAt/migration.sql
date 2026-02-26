BEGIN;

-- 1) Falls die Spalte "emailVerifyLastSentAt" bereits korrekt existiert -> nichts tun
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'emailVerifyLastSentAt'
  ) THEN
    -- ok, already exists
    NULL;

  -- 2) Falls sie als lowercase (unquoted) existiert, z.B. emailverifylastsentat -> korrekt umbenennen
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'emailverifylastsentat'
  ) THEN
    EXECUTE 'ALTER TABLE "User" RENAME COLUMN emailverifylastsentat TO "emailVerifyLastSentAt"';

  -- 3) Sonst: Spalte neu hinzufügen
  ELSE
    EXECUTE 'ALTER TABLE "User" ADD COLUMN "emailVerifyLastSentAt" TIMESTAMPTZ';
  END IF;
END $$;

COMMIT;