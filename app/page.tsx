'use client'

import { useState } from 'react'
import { Transcriber } from '@/components/transcriber'
import { AuthForm } from '@/components/auth-form'
import { UserProfile } from '@/components/user-profile'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/auth-context'

export default function Home() {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('transcriber')

  if (isLoading) {
    return (
      <div className="container py-8 space-y-8">
        <Skeleton className="h-12 w-48 mb-8" />
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-12">
        <div className="w-full max-w-md">
          <AuthForm />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="transcriber">Poker Transcriber</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transcriber" className="space-y-4 pt-4">
          <Transcriber userId={user.id} userApiKey={user.openai_api_key} />
        </TabsContent>
        
        <TabsContent value="account" className="space-y-4 pt-4">
          <UserProfile />
        </TabsContent>
      </Tabs>
    </div>
  )
}

