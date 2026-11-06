begin;

alter table public.orders
  add column if not exists temple_id_verified boolean not null default false;

create table if not exists public.splash_notices (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  title text not null,
  body text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at < ends_at)
);
create index if not exists splash_notices_location_active_period_idx
  on public.splash_notices(location_id, active, starts_at, ends_at);

create unique index if not exists locations_name_campus_unique
  on public.locations(name, campus);
create unique index if not exists location_hours_window_unique
  on public.location_hours(location_id, day_of_week, opens_at, closes_at);

do $$
declare
  v_location_id uuid;
begin
  insert into public.locations (
    name, campus, street_address, city, state, postal_code,
    timezone, weekly_points, week_start_day, accessibility_note, active
  )
  values (
    'Main Campus Cherry Pantry',
    'Main Campus',
    '1755 N 13th St',
    'Philadelphia',
    'PA',
    '19122',
    'America/New_York',
    16,
    1,
    'Wheelchair accessible',
    true
  )
  on conflict (name, campus) do nothing
  returning id into v_location_id;

  if v_location_id is null then
    select id into v_location_id
    from public.locations
    where name = 'Main Campus Cherry Pantry' and campus = 'Main Campus';
  end if;

  insert into public.location_hours(location_id, day_of_week, opens_at, closes_at)
  values
    (v_location_id, 1, '10:00', '17:00'),
    (v_location_id, 2, '10:00', '19:00'),
    (v_location_id, 3, '10:00', '19:00'),
    (v_location_id, 4, '10:00', '17:00'),
    (v_location_id, 5, '10:00', '14:00')
  on conflict (location_id, day_of_week, opens_at, closes_at) do nothing;
end;
$$;

create or replace function public.assert_location_open(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location public.locations%rowtype;
  v_local_now timestamp;
  v_day smallint;
  v_local_time time;
  v_closure public.location_closures%rowtype;
begin
  select * into v_location
  from public.locations
  where id = p_location_id and active
  for share;
  if not found then
    raise exception 'Location is missing or inactive' using errcode = '22023';
  end if;

  v_local_now := timezone(v_location.timezone, now());
  v_day := extract(dow from v_local_now)::smallint;
  v_local_time := v_local_now::time;

  select * into v_closure
  from public.location_closures
  where location_id = p_location_id
    and starts_at <= now() and ends_at > now()
  order by starts_at desc
  limit 1;

  if found then
    if v_closure.is_closed then
      raise exception 'Location is closed: %', coalesce(v_closure.message, 'closed for this period')
        using errcode = '22023';
    end if;
    if v_closure.opens_at is null
      or v_closure.closes_at is null
      or v_closure.opens_at >= v_closure.closes_at then
      raise exception 'Special hours are misconfigured'
        using errcode = '22023';
    end if;
    if not (v_local_time >= v_closure.opens_at and v_local_time < v_closure.closes_at) then
      raise exception 'Location is closed outside its special hours'
        using errcode = '22023';
    end if;
    return;
  end if;

  if not exists (
    select 1 from public.location_hours
    where location_id = p_location_id
      and day_of_week = v_day
      and v_local_time >= opens_at
      and v_local_time < closes_at
  ) then
    raise exception 'Location is closed at this time' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.checkout_order_verified(
  p_location_id uuid,
  p_temple_id text,
  p_qr_nonce uuid,
  p_cashier_id uuid,
  p_lines jsonb,
  p_temple_id_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
begin
  if p_temple_id_verified is distinct from true then
    raise exception 'Cashier must verify the physical Temple ID' using errcode = '42501';
  end if;

  perform public.assert_location_open(p_location_id);
  v_order_id := public.checkout_order(
    p_location_id, p_temple_id, p_qr_nonce, p_cashier_id, p_lines
  );
  update public.orders
  set temple_id_verified = true
  where id = v_order_id;
  return v_order_id;
end;
$$;

revoke all on function public.assert_location_open(uuid) from public, anon, authenticated;
revoke all on function public.checkout_order(uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.checkout_order_verified(uuid, text, uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.checkout_order_verified(uuid, text, uuid, uuid, jsonb, boolean)
  to service_role;

alter table public.splash_notices enable row level security;
drop policy if exists "public read active splash notices" on public.splash_notices;
create policy "public read active splash notices" on public.splash_notices
  for select using (
    active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and exists (select 1 from public.locations where id = location_id and active)
  );

commit;
