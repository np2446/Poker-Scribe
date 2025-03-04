import { supabase, UserProfile, AuthResponse } from './supabase'

// Register a new user
export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error('Error registering user:', error)
      return { success: false, error: error.message }
    }

    if (data?.user) {
      return { 
        success: true, 
        user: {
          id: data.user.id,
          email: data.user.email || email,
          created_at: data.user.created_at
        } 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Exception registering user:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during registration' 
    }
  }
}

// Login an existing user
export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Error logging in user:', error)
      return { success: false, error: error.message }
    }

    if (data?.user) {
      const profile = await getUserProfile(data.user.id)
      
      return { 
        success: true, 
        user: profile || {
          id: data.user.id,
          email: data.user.email || email,
          created_at: data.user.created_at
        } 
      }
    }

    return { success: false, error: 'No user data returned' }
  } catch (error) {
    console.error('Exception logging in user:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during login' 
    }
  }
}

// Logout current user
export async function logoutUser(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error logging out:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Exception logging out:', error)
    return false
  }
}

// Get current logged in user
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const profile = await getUserProfile(user.id)
      if (profile) {
        return profile
      }
      
      // If no profile exists yet, create one with basic info
      return {
        id: user.id,
        email: user.email || '',
      }
    }
    
    return null
  } catch (error) {
    console.error('Exception getting current user:', error)
    return null
  }
}

// Get user profile from profiles table
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      if (error.code !== 'PGRST116') { // No rows found
        console.error('Error fetching user profile:', error)
      }
      return null
    }
    
    return data as UserProfile
  } catch (error) {
    console.error('Exception fetching user profile:', error)
    return null
  }
}

// Save or update user's OpenAI API key
export async function saveUserApiKey(userId: string, apiKey: string): Promise<boolean> {
  try {
    // Check if profile exists
    const existingProfile = await getUserProfile(userId)
    
    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({ openai_api_key: apiKey, updated_at: new Date().toISOString() })
        .eq('id', userId)
      
      if (error) {
        console.error('Error updating API key:', error)
        return false
      }
    } else {
      // Create new profile
      const { error } = await supabase
        .from('profiles')
        .insert({ 
          id: userId, 
          openai_api_key: apiKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('Error creating profile with API key:', error)
        return false
      }
    }
    
    return true
  } catch (error) {
    console.error('Exception saving API key:', error)
    return false
  }
} 