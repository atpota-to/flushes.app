-- Create a function to get the latest flushing entries
-- This function will be called from our API
CREATE OR REPLACE FUNCTION get_latest_entries(max_entries INTEGER)
RETURNS SETOF flushing_records
LANGUAGE SQL
AS $$
  -- Direct SQL query to get the latest entries by ID
  -- This bypasses any caching and pagination issues
  SELECT * FROM flushing_records
  ORDER BY id DESC
  LIMIT max_entries;
$$;

-- Test the function with a limit of 5 entries
SELECT * FROM get_latest_entries(5);