-- Prevent deleting the final admin of an existing group.
-- Covers explicit membership deletion and user-deletion cascades.

CREATE TRIGGER protect_group_last_admin_delete
BEFORE DELETE ON group_members
FOR EACH ROW
WHEN
  OLD.role = 'admin'
  AND EXISTS (
    SELECT 1
    FROM groups
    WHERE id = OLD.group_id
  )
  AND (
    SELECT COUNT(*)
    FROM group_members
    WHERE group_id = OLD.group_id
      AND role = 'admin'
  ) <= 1
BEGIN
  SELECT RAISE(ABORT, 'GROUP_LAST_ADMIN');
END;
