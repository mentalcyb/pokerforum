-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Adds English names/descriptions to forum categories so the EN language toggle
-- translates them too, and tidies up a few Georgian texts.
-- Safe to run more than once.

-- 1. New optional columns (Georgian stays in the existing name/description columns)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name_en        TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 2. English translations for the existing categories (matched by their Georgian name)
UPDATE public.categories SET name_en = 'Beginners',
       description_en = 'Rules and core concepts'
 WHERE name LIKE 'დამწყებ%';

UPDATE public.categories SET name_en = 'Online Poker Rooms',
       description_en = 'CoinPoker, GGPoker and more'
 WHERE name LIKE 'ონლაინ პოკერ%';

UPDATE public.categories SET name_en = 'Home Games & Clubs',
       description_en = 'Tbilisi clubs'
 WHERE name LIKE '%გეიმ%';

UPDATE public.categories SET name_en = 'Strategy',
       description_en = 'Preflop, postflop, GTO'
 WHERE name LIKE 'სტრატეგი%';

UPDATE public.categories SET name_en = 'Session Blogs',
       description_en = 'Session notes'
 WHERE name LIKE 'სესიებ%';

UPDATE public.categories SET name_en = 'Tournaments',
       description_en = 'Online & offline, local and international tournaments'
 WHERE name LIKE 'ტურნირ%';

UPDATE public.categories SET name_en = 'Poker Movies & Podcasts',
       description_en = '🍿 📺 ⭐'
 WHERE name LIKE 'ფილმებ%';

-- 3. Georgian text fixes
UPDATE public.categories SET name = 'ფილმები და პოდკასტები პოკერზე'
 WHERE name LIKE 'ფილმებ%';

UPDATE public.categories SET description = 'ონლაინ და ოფლაინ, ადგილობრივი და საერთაშორისო ტურნირები'
 WHERE name LIKE 'ტურნირ%';

-- 4. Check the result: every row should now have name_en filled in.
--    If one is empty, add its translation in the Admin panel → Categories → Edit.
SELECT id, name, name_en, description, description_en FROM public.categories ORDER BY id;
