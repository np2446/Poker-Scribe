'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Settings, Save, PlusCircle, Trash2 } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GameSettings } from '@/components/game-settings'
import { GameSettingConfig } from '@/lib/supabase'
import { saveGameSettingConfig, getGameSettingConfigs, deleteGameSettingConfig } from '@/lib/database'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface GameSettingsManagerProps {
  userId: string
  currentSettings: any
  onSelectConfig: (config: GameSettingConfig) => void
}

export function GameSettingsManager({ userId, currentSettings, onSelectConfig }: GameSettingsManagerProps) {
  const [savedConfigs, setSavedConfigs] = useState<GameSettingConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [configName, setConfigName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)

  const loadConfigs = async () => {
    setIsLoading(true)
    try {
      const configs = await getGameSettingConfigs(userId)
      setSavedConfigs(configs)
    } catch (err) {
      console.error('Error loading game setting configs:', err)
      setError('Failed to load saved configurations')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      loadConfigs()
    }
  }, [userId])

  const handleSaveConfig = async () => {
    if (!configName.trim()) {
      setError('Please enter a name for this configuration')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccessMessage('')
    
    const newConfig: GameSettingConfig = {
      user_id: userId,
      name: configName,
      is_default: isDefault,
      game_settings: currentSettings,
    }
    
    try {
      await saveGameSettingConfig(newConfig)
      await loadConfigs()
      setSuccessMessage('Game settings configuration saved')
      setConfigName('')
      setIsDefault(false)
      setIsDialogOpen(false)
    } catch (err) {
      console.error('Error saving game settings config:', err)
      setError('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectConfig = (configId: string) => {
    const config = savedConfigs.find(c => c.id === configId)
    if (config) {
      setSelectedConfigId(configId)
      onSelectConfig(config)
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    try {
      await deleteGameSettingConfig(configId)
      await loadConfigs()
      if (selectedConfigId === configId) {
        setSelectedConfigId(null)
      }
    } catch (err) {
      console.error('Error deleting game settings config:', err)
      setError('Failed to delete configuration')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Game Settings Configurations
          </CardTitle>
          <CardDescription>
            Save and manage your poker game settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {successMessage && (
            <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="configSelect">Select Configuration</Label>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            
            <div className="flex space-x-2">
              <Select 
                value={selectedConfigId || ''} 
                onValueChange={handleSelectConfig}
                disabled={isLoading || savedConfigs.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a saved configuration" />
                </SelectTrigger>
                <SelectContent>
                  {savedConfigs.map(config => (
                    <SelectItem key={config.id} value={config.id!}>
                      {config.name} {config.is_default ? '(Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedConfigId && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDeleteConfig(selectedConfigId)}
                  title="Delete configuration"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Save Current Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Save Game Settings</DialogTitle>
                  <DialogDescription>
                    Save your current game settings as a named configuration.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="configName">Configuration Name</Label>
                    <Input
                      id="configName"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="e.g., Home Game"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isDefault"
                      checked={isDefault}
                      onCheckedChange={setIsDefault}
                    />
                    <Label htmlFor="isDefault">Set as default configuration</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleSaveConfig} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 