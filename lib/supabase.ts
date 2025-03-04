import { createClient } from '@supabase/supabase-js'

// These values should be stored in .env.local
// For now we'll use placeholders that will be replaced with actual values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey)

// Define types for database tables and entities

// User Profile extended from Supabase auth
export type UserProfile = {
  id: string
  email: string
  openai_api_key?: string
  created_at?: string
  updated_at?: string
}

// Game setting configurations that can be saved and reused
export type GameSettingConfig = {
  id?: string
  user_id: string
  name: string  // Configuration name (e.g., "Home Game", "Casino $1/$2", etc.)
  is_default?: boolean
  game_settings: {
    gameType: string
    tableSize?: string
    smallBlind?: string
    bigBlind?: string
    ante?: string
    buyIn?: string
    startingStack?: string
    currency?: string
    aiModel?: string
  }
  created_at?: string
  updated_at?: string
}

// Hand history with user association
export type HandHistory = {
  id?: string
  user_id: string
  text: string 
  timestamp: string
  game_settings_id?: string  // Reference to the game settings configuration used
  game_settings?: {
    gameType?: string
    tableSize?: string
    smallBlind?: string
    bigBlind?: string
    ante?: string
    buyIn?: string
    startingStack?: string
    currency?: string
    aiModel?: string
  }
  created_at?: string
}

// Analysis of a hand
export type HandAnalysis = {
  id?: string
  hand_id: string
  user_id: string
  analysis_text: string
  model_used: string
  created_at?: string
}

// Auth response type
export type AuthResponse = {
  success: boolean
  error?: string
  user?: UserProfile
} 