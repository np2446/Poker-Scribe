import { supabase, HandHistory, HandAnalysis, GameSettingConfig } from './supabase'

// --- Game Setting Configurations ---

export async function saveGameSettingConfig(config: GameSettingConfig): Promise<GameSettingConfig | null> {
  try {
    // If it's being set as default, clear other defaults first
    if (config.is_default) {
      await supabase
        .from('game_setting_configs')
        .update({ is_default: false })
        .eq('user_id', config.user_id)
    }
    
    // Check if config with this name already exists for user
    let existingId: string | undefined
    
    if (config.id) {
      existingId = config.id
    } else {
      const { data } = await supabase
        .from('game_setting_configs')
        .select('id')
        .eq('user_id', config.user_id)
        .eq('name', config.name)
        .single()
      
      if (data) {
        existingId = data.id
      }
    }
    
    if (existingId) {
      // Update existing config
      const { data, error } = await supabase
        .from('game_setting_configs')
        .update({
          name: config.name,
          is_default: config.is_default,
          game_settings: config.game_settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingId)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating game setting config:', error)
        return null
      }
      
      return data
    } else {
      // Insert new config
      const { data, error } = await supabase
        .from('game_setting_configs')
        .insert({
          user_id: config.user_id,
          name: config.name,
          is_default: config.is_default,
          game_settings: config.game_settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating game setting config:', error)
        return null
      }
      
      return data
    }
  } catch (error) {
    console.error('Exception saving game setting config:', error)
    return null
  }
}

export async function getGameSettingConfigs(userId: string): Promise<GameSettingConfig[]> {
  try {
    const { data, error } = await supabase
      .from('game_setting_configs')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    
    if (error) {
      console.error('Error fetching game setting configs:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Exception fetching game setting configs:', error)
    return []
  }
}

export async function getDefaultGameSettingConfig(userId: string): Promise<GameSettingConfig | null> {
  try {
    const { data, error } = await supabase
      .from('game_setting_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single()
    
    if (error) {
      if (error.code !== 'PGRST116') { // No rows found
        console.error('Error fetching default game setting config:', error)
      }
      return null
    }
    
    return data
  } catch (error) {
    console.error('Exception fetching default game setting config:', error)
    return null
  }
}

export async function deleteGameSettingConfig(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('game_setting_configs')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting game setting config:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Exception deleting game setting config:', error)
    return false
  }
}

// --- Hand Histories ---

export async function saveHandHistory(hand: HandHistory): Promise<HandHistory | null> {
  try {
    const { data, error } = await supabase
      .from('hand_histories')
      .insert(hand)
      .select()
      .single()
    
    if (error) {
      console.error('Error saving hand history:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Exception saving hand history:', error)
    return null
  }
}

export async function getHandHistories(userId: string): Promise<HandHistory[]> {
  try {
    const { data, error } = await supabase
      .from('hand_histories')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
    
    if (error) {
      console.error('Error fetching hand histories:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Exception fetching hand histories:', error)
    return []
  }
}

export async function deleteHandHistory(id: string): Promise<boolean> {
  try {
    // First delete any associated analyses
    await supabase
      .from('hand_analyses')
      .delete()
      .eq('hand_id', id)
    
    // Then delete the hand history
    const { error } = await supabase
      .from('hand_histories')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting hand history:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Exception deleting hand history:', error)
    return false
  }
}

// --- Hand Analyses ---

export async function saveHandAnalysis(analysis: HandAnalysis): Promise<HandAnalysis | null> {
  try {
    // Check if an analysis for this hand already exists
    const { data: existingAnalysis } = await supabase
      .from('hand_analyses')
      .select('*')
      .eq('hand_id', analysis.hand_id)
      .single()
    
    // If it exists, update it
    if (existingAnalysis) {
      const { data, error } = await supabase
        .from('hand_analyses')
        .update({
          analysis_text: analysis.analysis_text,
          model_used: analysis.model_used,
        })
        .eq('id', existingAnalysis.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating hand analysis:', error)
        return null
      }
      
      return data
    }
    
    // Otherwise, insert a new one
    const { data, error } = await supabase
      .from('hand_analyses')
      .insert(analysis)
      .select()
      .single()
    
    if (error) {
      console.error('Error saving hand analysis:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Exception saving hand analysis:', error)
    return null
  }
}

export async function getHandAnalysis(handId: string): Promise<HandAnalysis | null> {
  try {
    const { data, error } = await supabase
      .from('hand_analyses')
      .select('*')
      .eq('hand_id', handId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned, which is fine
        return null
      }
      console.error('Error fetching hand analysis:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Exception fetching hand analysis:', error)
    return null
  }
} 