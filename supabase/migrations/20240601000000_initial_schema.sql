-- Create profiles table to store user information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  openai_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create game_setting_configs table to store saved game settings
CREATE TABLE IF NOT EXISTS game_setting_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  game_settings JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (user_id, name)
);

-- Create hand_histories table to store poker hand histories
CREATE TABLE IF NOT EXISTS hand_histories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  game_settings JSONB NOT NULL,
  game_settings_id UUID REFERENCES game_setting_configs(id) ON DELETE SET NULL
);

-- Create hand_analyses table to store analyses of poker hands
CREATE TABLE IF NOT EXISTS hand_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hand_id UUID REFERENCES hand_histories(id) ON DELETE CASCADE NOT NULL,
  analysis_text TEXT NOT NULL,
  model_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (hand_id)
);

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when a new user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Set up Row Level Security (RLS) policies
-- Profiles: Users can only read and update their own profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Game Settings: Users can only access their own game settings
ALTER TABLE game_setting_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own game settings" 
  ON game_setting_configs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game settings" 
  ON game_setting_configs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own game settings" 
  ON game_setting_configs FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own game settings" 
  ON game_setting_configs FOR DELETE 
  USING (auth.uid() = user_id);

-- Hand Histories: Users can only access their own hand histories
ALTER TABLE hand_histories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hand histories" 
  ON hand_histories FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hand histories" 
  ON hand_histories FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hand histories" 
  ON hand_histories FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hand histories" 
  ON hand_histories FOR DELETE 
  USING (auth.uid() = user_id);

-- Hand Analyses: Users can only access analyses for their own hands
ALTER TABLE hand_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses for their own hands" 
  ON hand_analyses FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM hand_histories 
    WHERE hand_histories.id = hand_analyses.hand_id 
    AND hand_histories.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert analyses for their own hands" 
  ON hand_analyses FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM hand_histories 
    WHERE hand_histories.id = hand_analyses.hand_id 
    AND hand_histories.user_id = auth.uid()
  ));

CREATE POLICY "Users can update analyses for their own hands" 
  ON hand_analyses FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM hand_histories 
    WHERE hand_histories.id = hand_analyses.hand_id 
    AND hand_histories.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete analyses for their own hands" 
  ON hand_analyses FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM hand_histories 
    WHERE hand_histories.id = hand_analyses.hand_id 
    AND hand_histories.user_id = auth.uid()
  )); 