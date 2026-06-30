create or replace function get_dm_channel(user1 uuid, user2 uuid)
returns uuid
language sql
security definer
as $$
  select cm1.channel_id
  from channel_members cm1
  join channel_members cm2 on cm2.channel_id = cm1.channel_id
  join channels ch on ch.id = cm1.channel_id
  where cm1.user_id = user1
    and cm2.user_id = user2
    and ch.type = 'dm'
  limit 1;
$$;
