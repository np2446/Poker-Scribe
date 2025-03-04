-- Add IV field for API key encryption if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS openai_key_iv TEXT;

-- Update RLS policies to ensure security
CREATE POLICY IF NOT EXISTS "Users can view and update their own profile" ON profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMENT ON COLUMN profiles.openai_key_iv IS 'Initialization vector for API key encryption'; 