'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserProfile } from '@/lib/supabase'
import { getCurrentUser, loginUser, registerUser, logoutUser } from '@/lib/auth'

type AuthContextType = {
  user: UserProfile | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<boolean>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (err) {
        console.error('Error checking authentication:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await loginUser(email, password)
      if (response.success && response.user) {
        setUser(response.user)
        return { success: true }
      }
      return { success: false, error: response.error || 'Authentication failed' }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  const register = async (email: string, password: string) => {
    try {
      const response = await registerUser(email, password)
      if (response.success && response.user) {
        setUser(response.user)
        return { success: true }
      }
      return { success: false, error: response.error || 'Registration failed' }
    } catch (err) {
      console.error('Registration error:', err)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  const logout = async () => {
    try {
      const success = await logoutUser()
      if (success) {
        setUser(null)
      }
      return success
    } catch (err) {
      console.error('Logout error:', err)
      return false
    }
  }

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (err) {
      console.error('Error refreshing user:', err)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 