begin;

do $$
begin
  if exists (
    select 1
    from public.location_items li
    join public.items i on i.id = li.item_id
    where i.barcode is null
      and i.name in ('Apple', 'Banana', 'Broccoli', 'Whole Milk', 'Eggs', 'Chicken Breast', 'Whole Wheat Bread')
  ) then
    raise exception 'Remove location stock for demo catalog items before replacing them';
  end if;

  if exists (
    select 1
    from public.order_items oi
    join public.items i on i.id = oi.item_id
    where i.barcode is null
      and i.name in ('Apple', 'Banana', 'Broccoli', 'Whole Milk', 'Eggs', 'Chicken Breast', 'Whole Wheat Bread')
  ) then
    raise exception 'Demo catalog items have order history and cannot be replaced automatically';
  end if;

  if exists (
    select 1
    from public.shopping_list sl
    join public.items i on i.id = sl.item_id
    where i.barcode is null
      and i.name in ('Apple', 'Banana', 'Broccoli', 'Whole Milk', 'Eggs', 'Chicken Breast', 'Whole Wheat Bread')
  ) then
    raise exception 'Remove demo catalog items from saved lists before replacing them';
  end if;
end;
$$;

delete from public.items
where barcode is null
  and name in ('Apple', 'Banana', 'Broccoli', 'Whole Milk', 'Eggs', 'Chicken Breast', 'Whole Wheat Bread');

insert into public.items (
  barcode, name, description, image_url, nutrition_query, weight, ingredients, tags
)
values
  (
    '070222026713', 'French Style Green Beans', null,
    'https://images.openfoodfacts.org/images/products/007/022/202/6713/front_en.3.400.jpg',
    'French Style Green Beans', null, null, array['canned-goods', 'vegetables']
  ),
  (
    '050100402600', 'Chicken Noodle', 'Healthy Choice · 425 g',
    'https://images.openfoodfacts.org/images/products/005/010/040/2600/front_en.29.400.jpg',
    'Chicken Noodle soup', '425 g',
    'Chicken Broth, Cooked Chicken (White Meat Chicken, Water, Modified Rice Starch, Isolated Soy Protein, Salt, Sodium Phosphates), Carrots, Enriched Egg Noodles (Durum Wheat Semolina, Whole Egg, Egg White, Niacin, Iron [Ferrous Sulfate], Thiamine Mononitrate, Riboflavin, Folic Acid), Celery, Less Than 2% Of: Modified Corn Starch, Flavorings, Potassium Chloride, Yeast Extract, Salt, Sugar, Rendered Chicken Fat, Chicken Fat, Chicken Powder, Lactic Acid, Malic Acid, Beta Carotene. CONTAINS: WHEAT, SOY, EGG.',
    array['canned-goods', 'soup']
  ),
  (
    '078742256184', 'Tomato sauce', 'Member''s Mark · 15 oz',
    'https://images.openfoodfacts.org/images/products/007/874/225/6184/front_en.13.400.jpg',
    'Tomato sauce', '15 oz',
    'Tomatoes and less than 2% of: sea salt, dehydrated onions, dehydrated garlic, spices, natural flavorings, dehydrated sweet bell pepper, citric acid.',
    array['canned-goods', 'sauces']
  ),
  (
    '832460000890', 'Chunk Light Tuna in Water', 'mercantile&fancy · 5 oz',
    'https://images.openfoodfacts.org/images/products/083/246/000/0890/front_en.8.400.jpg',
    'Chunk Light Tuna in Water', '5 oz', null, array['canned-goods', 'seafood']
  ),
  (
    '017000009469', 'Potted Meat', 'Armour · 85 g',
    'https://images.openfoodfacts.org/images/products/001/700/000/9469/front_en.21.400.jpg',
    'Potted Meat', '85 g',
    'Mechanically separated chicken, partially defatted pork fatty tissue (tocopherol, natural flavors and citric acid), water, salt, contains 2% or less of: mustard, vinegar, dextrose, sodium erythorbate, garlic powder, natural flavors, sodium nitrite.',
    array['canned-goods', 'meat']
  ),
  (
    '078742196206', 'Premium Natural Chunk Chicken Breast in Water', 'Member''s Mark · 354 g',
    'https://images.openfoodfacts.org/images/products/007/874/219/6206/front_en.150.400.jpg',
    'Chunk chicken breast in water', '354 g',
    'Chicken breast meat, water, salt.',
    array['canned-goods', 'meat']
  ),
  (
    '021000028092', 'Mac & cheese', 'Kraft · 7.25 oz (206 g)',
    'https://images.openfoodfacts.org/images/products/002/100/002/8092/front_en.85.400.jpg',
    'Macaroni and cheese', '7.25 oz (206 g)',
    'Enriched macaroni (wheat flour, durum flour, niacin, ferrous sulfate [iron], thiamin mononitrate [vitamin B1], riboflavin [vitamin B2], folic acid); cheese sauce mix (whey, milkfat, milk protein concentrate, salt, sodium triphosphate, contains less than 2% of citric acid, lactic acid, sodium phosphate, calcium phosphate, with paprika, turmeric, and annatto added for color, enzymes, cheese culture).',
    array['pasta', 'prepared-foods']
  ),
  (
    '851206007955', 'Long Grain Brown Rice', 'Flickertail',
    'https://images.openfoodfacts.org/images/products/085/120/600/7955/front_en.8.400.jpg',
    'Long grain brown rice', null, 'Long grain brown rice.', array['grains', 'rice']
  )
on conflict (barcode) where barcode is not null do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  nutrition_query = excluded.nutrition_query,
  weight = excluded.weight,
  ingredients = excluded.ingredients,
  tags = excluded.tags;

commit;
