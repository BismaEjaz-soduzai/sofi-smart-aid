create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.workspace_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  sender_name text,
  message_type text not null default 'text',
  file_name text,
  file_url text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.room_messages enable row level security;

create policy "view" on public.room_messages for select using (exists (select 1 from public.workspace_rooms wr where wr.id = room_messages.room_id and wr.user_id = auth.uid()));

create policy "insert" on public.room_messages for insert with check (auth.uid() = user_id and exists (select 1 from public.workspace_rooms wr where wr.id = room_messages.room_id and wr.user_id = auth.uid()));

create policy "delete" on public.room_messages for delete using (auth.uid() = user_id);

create index if not exists idx_room_messages_room on public.room_messages(room_id);

do $$ begin alter publication supabase_realtime add table public.room_messages; exception when others then null; end $$;