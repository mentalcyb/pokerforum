-- Diagnostic only — run this first in Supabase SQL Editor to see what indexes
-- already exist on the tables the app queries most. Nothing here modifies data.

SELECT
  t.relname  AS table_name,
  i.relname  AS index_name,
  a.attname  AS column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r'
  AND t.relname IN ('posts', 'replies', 'profiles', 'messages', 'categories', 'tournaments')
ORDER BY t.relname, i.relname;

-- Also worth checking: are there any duplicate usernames already in profiles?
-- (relevant before adding a UNIQUE constraint — see recommended_indexes.sql)
SELECT username, COUNT(*) AS n
FROM public.profiles
GROUP BY username
HAVING COUNT(*) > 1;
