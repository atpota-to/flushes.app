-- Setup script for Supabase database

-- Users table to store user profile information
CREATE TABLE IF NOT EXISTS users (
  did TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to create users table if it doesn't exist
CREATE OR REPLACE FUNCTION create_users_table_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
    CREATE TABLE users (
      did TEXT PRIMARY KEY,
      handle TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Flushing entries table to store flushing status records
CREATE TABLE IF NOT EXISTS flushing_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uri TEXT UNIQUE NOT NULL,
  cid TEXT NOT NULL,
  author_did TEXT NOT NULL,
  author_handle TEXT,
  text TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to create flushing_entries table if it doesn't exist
CREATE OR REPLACE FUNCTION create_flushing_entries_table_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'flushing_entries') THEN
    CREATE TABLE flushing_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      uri TEXT UNIQUE NOT NULL,
      cid TEXT NOT NULL,
      author_did TEXT NOT NULL,
      author_handle TEXT,
      text TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_flushing_entries_created_at ON flushing_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flushing_entries_author_did ON flushing_entries(author_did);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

-- Create a trigger to update the users table when a flushing entry is inserted with an author_handle
CREATE OR REPLACE FUNCTION update_user_from_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.author_handle IS NOT NULL THEN
    INSERT INTO users (did, handle, updated_at)
    VALUES (NEW.author_did, NEW.author_handle, NOW())
    ON CONFLICT (did) 
    DO UPDATE SET 
      handle = EXCLUDED.handle,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_update_user_from_entry ON flushing_entries;
CREATE TRIGGER trigger_update_user_from_entry
AFTER INSERT OR UPDATE ON flushing_entries
FOR EACH ROW
EXECUTE FUNCTION update_user_from_entry();