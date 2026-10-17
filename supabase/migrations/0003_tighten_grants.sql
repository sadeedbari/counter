-- Least privilege for signed-in staff.
-- Stores are created only through create_store(); members can be added and renamed but never
-- linked to a login from the client; login members cannot be deleted from the client.
revoke insert, delete on stores from authenticated;

revoke insert, update on members from authenticated;
grant insert (store_id, name) on members to authenticated;
grant update (name) on members to authenticated;

drop policy own_members on members;
create policy members_read on members for select to authenticated using (store_id = (select my_store()));
create policy members_add on members for insert to authenticated with check (store_id = (select my_store()) and user_id is null);
create policy members_rename on members for update to authenticated using (store_id = (select my_store())) with check (store_id = (select my_store()));
create policy members_remove on members for delete to authenticated using (store_id = (select my_store()) and user_id is null);

-- Anonymous visitors have no business touching any table.
revoke all on all tables in schema public from anon;
