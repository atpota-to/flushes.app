-- Create a function to execute raw SQL queries safely
-- This allows direct SQL execution for better performance and reliability

CREATE OR REPLACE FUNCTION execute_raw_query(raw_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Only allow SELECT queries for security
  IF position('SELECT' in upper(raw_query)) != 1 THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Execute the query and convert result to JSON
  EXECUTE 'SELECT json_agg(t) FROM (' || raw_query || ') t' INTO result;
  
  -- Return empty array instead of null if no results
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Test the function
SELECT execute_raw_query('SELECT id, did, handle, text FROM flushing_records ORDER BY id DESC LIMIT 3');