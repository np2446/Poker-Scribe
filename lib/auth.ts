import { supabase, UserProfile, AuthResponse } from './supabase'

// Register a new user
export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        // Skip email verification by setting this to false
        data: {
          email_confirmed: true
        }
      }
    })

    if (error) {
      console.error('Error registering user:', error)
      return { success: false, error: error.message }
    }

    // Automatically sign in the user after registration
    if (data?.user) {
      // Create automatic sign-in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (signInError) {
        console.error('Error automatically signing in after registration:', signInError)
      }
      
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
      .select('id, email, created_at, updated_at')
      .eq('id', userId)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') { // No rows found
        console.error('Error fetching user profile:', error);
      }
      return null;
    }
    
    // Fetch the API key separately using the secure endpoint
    try {
      const response = await fetch(`/api/secure-key?userId=${userId}`);
      const keyData = await response.json();
      
      if (keyData.success && keyData.apiKey) {
        return {
          ...data,
          openai_api_key: keyData.apiKey
        } as UserProfile;
      }
    } catch (keyError) {
      console.error('Error fetching API key:', keyError);
      // Continue without the API key
    }
    
    return data as UserProfile;
  } catch (error) {
    console.error('Exception fetching user profile:', error);
    return null;
  }
}

// Save or update user's OpenAI API key
export async function saveUserApiKey(userId: string, apiKey: string): Promise<boolean> {
  try {
    // Use the secure API endpoint to save the encrypted API key
    const response = await fetch('/api/secure-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, apiKey }),
    });

    const data = await response.json();
    
    if (!data.success) {
      console.error('Error saving API key:', data.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception saving API key:', error);
    return false;
  }
} 