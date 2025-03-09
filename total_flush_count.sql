-- Create a simple function to get the total count of records
-- This uses a different counting mechanism to avoid any potential caching issues

CREATE OR REPLACE FUNCTION get_total_flush_count()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  -- Simple, direct query to count all records
  SELECT COUNT(id)::INTEGER
  FROM flushing_records;
$$;

-- Test the function
SELECT get_total_flush_count();