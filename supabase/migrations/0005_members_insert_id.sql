-- The app supplies the new member's id itself, so the insert grant must include it.
grant insert (id, store_id, name) on members to authenticated;
