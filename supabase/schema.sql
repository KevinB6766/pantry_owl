create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text not null unique
);

create table if not exists items (
  id serial primary key,
  name text not null,
  description text,
  price numeric(8,2),
  image_url text,
  category_id int references categories(id),
  nutrition_query text, -- text used to search USDA FoodData Central
  barcode text,
  weight text,
  ingredients text
);

alter table items add column if not exists barcode text;
alter table items add column if not exists weight text;
alter table items add column if not exists ingredients text;
create unique index if not exists items_barcode_unique on items(barcode) where barcode is not null;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'cashier', 'stocker', 'admin'))
);

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create table if not exists shopping_list (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id int not null references items(id) on delete cascade,
  quantity int not null default 1,
  primary key (user_id, item_id)
);

-- The API uses the service key (bypasses RLS). RLS stays on as a safety net for direct access.
alter table categories enable row level security;
alter table items enable row level security;
alter table shopping_list enable row level security;
alter table profiles enable row level security;
drop policy if exists "public read categories" on categories;
drop policy if exists "public read items" on items;
drop policy if exists "own list" on shopping_list;
drop policy if exists "users read own profile" on profiles;
create policy "public read categories" on categories for select using (true);
create policy "public read items" on items for select using (true);
create policy "own list" on shopping_list for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own profile" on profiles for select using (auth.uid() = id);

insert into categories (name, slug) values
  ('Produce','produce'), ('Dairy & Eggs','dairy-eggs'), ('Meat','meat'), ('Bakery','bakery')
on conflict (slug) do nothing;

insert into items (name, description, price, category_id, nutrition_query)
select seed.name, seed.description, seed.price, categories.id, seed.nutrition_query
from (values
  ('Apple', 'Crisp red apples.', 0.79, 'produce', 'apple raw'),
  ('Banana', 'Ripe bananas, sold by the pound.', 0.59, 'produce', 'banana raw'),
  ('Broccoli', 'Fresh broccoli crowns.', 1.99, 'produce', 'broccoli raw'),
  ('Whole Milk', 'One gallon of whole milk.', 3.99, 'dairy-eggs', 'milk whole'),
  ('Eggs', 'One dozen large eggs.', 3.49, 'dairy-eggs', 'egg whole raw'),
  ('Chicken Breast', 'Boneless skinless chicken breast.', 5.99, 'meat', 'chicken breast raw'),
  ('Whole Wheat Bread', 'Sliced whole wheat loaf.', 3.29, 'bakery', 'bread whole wheat')
) as seed(name, description, price, category_slug, nutrition_query)
join categories on categories.slug = seed.category_slug
where not exists (
  select 1 from items existing where existing.name = seed.name
);
