'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, User, LogOut, Save, Check } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { saveUserApiKey } from '@/lib/auth'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/components/ui/use-toast'

interface UserProfileProps {
  onApiKeySaved?: () => void
}

export function UserProfile({ onApiKeySaved }: UserProfileProps) {
  const { user, logout, refreshUser } = useAuth()
  const { toast } = useToast()
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (user) {
      setApiKey(user.openai_api_key || '')
    }
  }, [user])

  const handleSaveApiKey = async () => {
    if (!user) return
    
    setIsSaving(true)
    setError('')
    setSaveSuccess(false)
    
    try {
      await saveUserApiKey(user.id, apiKey)
      setSaveSuccess(true)
      await refreshUser() // Refresh user data to get updated API key
      
      toast({
        title: "API Key Saved",
        description: "Your OpenAI API key has been securely stored.",
        duration: 3000,
      })
      
      // Call callback if provided after a short delay to show success state
      setTimeout(() => {
        if (onApiKeySaved) {
          onApiKeySaved()
        }
      }, 1000)
    } catch (err) {
      console.error('Error saving API key:', err)
      setError('Failed to save API key')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      console.error('Error during logout:', err)
      setError('An unexpected error occurred during logout')
    }
  }

  if (!user) {
    return null
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="h-5 w-5 mr-2" />
          Account Settings
        </CardTitle>
        <CardDescription>
          Manage your account and API settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {saveSuccess && (
          <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
            <AlertDescription>API key saved successfully</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <div className="p-2 border rounded mt-1 bg-muted">
              {user?.email || 'Not available'}
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="apiKey">OpenAI API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Your API key is securely stored and used for analyzing poker hands.
            </p>
            <Button 
              onClick={handleSaveApiKey} 
              disabled={isSaving}
              className="w-full mt-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save API Key
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </CardFooter>
    </Card>
  )
} 