create table categories (
  id serial primary key,
  name text not null,
  slug text not null unique
);

create table items (
  id serial primary key,
  name text not null,
  description text,
  price numeric(8,2),
  image_url text,
  category_id int references categories(id),
  nutrition_query text  -- text used to search USDA FoodData Central
);

create table shopping_list (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id int not null references items(id) on delete cascade,
  quantity int not null default 1,
  primary key (user_id, item_id)
);

-- The API uses the service key (bypasses RLS). RLS stays on as a safety net for direct access.
alter table categories enable row level security;
alter table items enable row level security;
alter table shopping_list enable row level security;
create policy "public read categories" on categories for select using (true);
create policy "public read items" on items for select using (true);
create policy "own list" on shopping_list for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into categories (name, slug) values
  ('Produce','produce'), ('Dairy & Eggs','dairy-eggs'), ('Meat','meat'), ('Bakery','bakery');

insert into items (name, description, price, category_id, nutrition_query) values
  ('Apple', 'Crisp red apples.', 0.79, 1, 'apple raw'),
  ('Banana', 'Ripe bananas, sold by the pound.', 0.59, 1, 'banana raw'),
  ('Broccoli', 'Fresh broccoli crowns.', 1.99, 1, 'broccoli raw'),
  ('Whole Milk', 'One gallon of whole milk.', 3.99, 2, 'milk whole'),
  ('Eggs', 'One dozen large eggs.', 3.49, 2, 'egg whole raw'),
  ('Chicken Breast', 'Boneless skinless chicken breast.', 5.99, 3, 'chicken breast raw'),
  ('Whole Wheat Bread', 'Sliced whole wheat loaf.', 3.29, 4, 'bread whole wheat');
