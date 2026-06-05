-- 0006_add_group_permissions_default_uuid.sql
-- Add gen_random_uuid() default for group_permissions.id (safe, idempotent)

/* Ensure extension providing gen_random_uuid exists */
CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* Set default only if the table and column exist to avoid migration errors on unexpected schemas */
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_permissions'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'group_permissions' AND column_name = 'id'
    ) THEN
      EXECUTE 'ALTER TABLE group_permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()';
    END IF;
  END IF;
END
$$;
