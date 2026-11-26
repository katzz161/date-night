create extension if not exists pgcrypto;

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table public.members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  points integer not null default 0
);

create table public.dates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  date_on date not null,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_space(p_display_name text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  new_space_id uuid;
  new_code text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'You already belong to a space';
  end if;

  new_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.spaces(invite_code) values (new_code) returning id into new_space_id;
  insert into public.members(space_id, user_id, display_name)
  values (new_space_id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Partner'));
  return new_code;
end;
$$;

create or replace function public.join_space(p_invite_code text, p_display_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  found_space_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'You already belong to a space';
  end if;

  select id into found_space_id
  from public.spaces
  where invite_code = upper(trim(p_invite_code));

  if found_space_id is null then raise exception 'Invite code not found'; end if;

  insert into public.members(space_id, user_id, display_name)
  values (found_space_id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Partner'));
end;
$$;

create or replace function public.add_point(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_space_id uuid;
begin
  select space_id into target_space_id
  from public.members where user_id = p_member_id;

  if target_space_id is null or not public.is_space_member(target_space_id) then
    raise exception 'Not allowed';
  end if;

  update public.members set points = points + 1
  where user_id = p_member_id and space_id = target_space_id;
end;
$$;

alter table public.spaces enable row level security;
alter table public.members enable row level security;
alter table public.dates enable row level security;

create policy "Members can view their space"
on public.spaces for select
using (public.is_space_member(id));

create policy "Members can view each other"
on public.members for select
using (public.is_space_member(space_id));

create policy "Members can view dates"
on public.dates for select
using (public.is_space_member(space_id));

create policy "Members can add dates"
on public.dates for insert
with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
);

create policy "Members can remove dates"
on public.dates for delete
using (public.is_space_member(space_id));

grant execute on function public.create_space(text) to authenticated;
grant execute on function public.join_space(text, text) to authenticated;
grant execute on function public.add_point(uuid) to authenticated;
