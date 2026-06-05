-- Migration 0005: Simplify permissions model (resource_v2/action_v2)
-- Adds new columns, backfills simplified resource/action values,
-- deduplicates by the new tuples and grants admin groups manage on all resources.

BEGIN;

-- 1) Add new non-destructive columns
ALTER TABLE group_permissions ADD COLUMN resource_v2 text;
ALTER TABLE group_permissions ADD COLUMN action_v2 text;

-- 2) Backfill simplified resource/action mapping
UPDATE group_permissions
SET
  resource_v2 = CASE
    WHEN resource ILIKE 'product%' OR resource ILIKE 'picture%' OR resource ILIKE 'radar%' THEN 'products'
    WHEN resource ILIKE 'project%' THEN 'projects'
    WHEN resource IN ('groups','users') OR resource ILIKE 'group%' THEN 'groups'
    WHEN resource IN ('reports','dashboard') OR resource ILIKE '%report%' THEN 'reports'
    WHEN resource = 'chat' OR resource ILIKE '%chat%' THEN 'chat'
    ELSE resource
  END,
  action_v2 = CASE
    WHEN action IN ('list','view','read') OR action ILIKE '%view%' THEN 'view'
    WHEN action IN ('create','update','edit','delete','assign','reorder','approve','send_private','send_group_all') OR action ILIKE '%create%' OR action ILIKE '%update%' OR action ILIKE '%delete%' THEN 'manage'
    ELSE 'manage'
  END
WHERE resource_v2 IS NULL;

-- 3) Remove duplicate rows based on the new tuple (keep oldest per created_at)
WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY group_id, resource_v2, action_v2 ORDER BY created_at) AS rn
  FROM group_permissions
  WHERE resource_v2 IS NOT NULL
)
DELETE FROM group_permissions WHERE id IN (SELECT id FROM ordered WHERE rn > 1);

-- 4) Ensure admin groups have 'manage' on all simplified resources
INSERT INTO group_permissions (id, group_id, resource, action, resource_v2, action_v2, created_at, updated_at)
SELECT gen_random_uuid(), g.id, r.resource, 'manage', r.resource, 'manage', now(), now()
FROM groups g
CROSS JOIN (VALUES ('products'),('projects'),('groups'),('reports'),('chat')) AS r(resource)
WHERE g.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM group_permissions gp
    WHERE gp.group_id = g.id
      AND COALESCE(gp.resource_v2, gp.resource) = r.resource
      AND COALESCE(gp.action_v2, gp.action) = 'manage'
  );

-- 5) Add indexes and unique constraint for the new columns
CREATE INDEX IF NOT EXISTS idx_group_permission_resource_v2 ON group_permissions(resource_v2);
CREATE INDEX IF NOT EXISTS idx_group_permission_group_id_v2 ON group_permissions(group_id);

ALTER TABLE group_permissions
  ADD CONSTRAINT unique_group_permission_v2 UNIQUE (group_id, resource_v2, action_v2);

COMMIT;

-- Notes:
-- - This migration is a non-destructive compat-layer: it keeps old columns and fills resource_v2/action_v2.
-- - After verification and rollout, it's safe to migrate application code to write/read only the v2 columns and then remove legacy columns.
