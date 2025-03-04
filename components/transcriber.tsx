"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { transcribeAudio, formatHandHistory } from "@/lib/transcription"
import { Loader2, StopCircle, Mic, Volume2, Save, Trash2, Copy, AlertCircle, Settings, XCircle, Activity, X } from "lucide-react"
import { GameSettings } from "@/components/game-settings"
import { z } from "zod"
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { GameSettingsManager } from '@/components/game-settings-manager'
import ReactMarkdown from 'react-markdown'
import { saveHandHistory, getHandHistories, deleteHandHistory, saveHandAnalysis, getHandAnalysis } from '@/lib/database'
import { supabase } from "@/lib/supabase"
import type { HandHistory, HandAnalysis, GameSettingConfig } from "@/lib/supabase"
import { getDefaultGameSettingConfig } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

// Add SpeechRecognition type
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type SpeechRecognition = any;

// Define a type for game settings
type GameSettingsType = {
  gameType?: "cash" | "tournament"
  tableSize?: string
  smallBlind?: string
  bigBlind?: string
  ante?: string
  buyIn?: string
  startingStack?: string
  currency?: string
  aiModel?: "gpt-3.5-turbo" | "gpt-4o" | "o1" | "o3-mini"
}

interface TranscriberProps {
  userId: string
  userApiKey?: string
}

// Define HandHistoryInsert type for database insertion
type HandHistoryInsert = Omit<HandHistory, 'id' | 'created_at' | 'updated_at'>;

export function Transcriber({ userId, userApiKey }: TranscriberProps) {
  const { toast } = useToast()
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcription, setTranscription] = useState("")
  const [formattedHands, setFormattedHands] = useState<{ id: string; text: string; timestamp: Date }[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [continuousMode, setContinuousMode] = useState(false)
  const [currentSegment, setCurrentSegment] = useState<{ start: number; isProcessing: boolean }>({
    start: 0,
    isProcessing: false,
  })
  const [processingQueue, setProcessingQueue] = useState<{ blob: Blob; start: number; end: number }[]>([])
  const [activeTab, setActiveTab] = useState<string>("record")

  // Add a cancellation flag
  const [isCancelling, setIsCancelling] = useState(false)

  // Game settings state
  const [gameSettings, setGameSettings] = useState<GameSettingsType | null>(null)
  
  // API key state
  const [apiKey, setApiKey] = useState<string>("")
  const [apiKeyStatus, setApiKeyStatus] = useState<"unset" | "set" | "validating" | "invalid">("unset")
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  // Recording state and errors
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [micPermissionStatus, setMicPermissionStatus] = useState<"prompt" | "granted" | "denied">("prompt")
  const [isInitializingRecording, setIsInitializingRecording] = useState(false)

  const [analyzingHand, setAnalyzingHand] = useState<string | null>(null)
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({})
  const [analysisError, setAnalysisError] = useState<Record<string, string>>({})

  const [generalError, setGeneralError] = useState<string | null>(null)

  const [processingStep, setProcessingStep] = useState<string>("")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null)

  // Load API key and game settings from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai-api-key")
    if (savedApiKey) {
      setApiKey(savedApiKey)
      setApiKeyStatus("set")
    }

    // Load saved game settings
    const savedSettings = localStorage.getItem("poker-game-settings")
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setGameSettings(parsedSettings)
      } catch (e) {
        console.error("Error parsing saved game settings:", e)
      }
    }

    // Check if browser supports MediaRecorder
    if (!window.MediaRecorder) {
      setRecordingError(
        "Your browser doesn't support audio recording. Please try a modern browser like Chrome, Firefox, or Edge.",
      )
    }

    // Check microphone permission status if possible
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          setMicPermissionStatus(permissionStatus.state as "prompt" | "granted" | "denied")

          permissionStatus.onchange = () => {
            setMicPermissionStatus(permissionStatus.state as "prompt" | "granted" | "denied")
          }
        })
        .catch((err) => {
          console.error("Error checking microphone permission:", err)
        })
    }

    // Clean up on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Process the queue of audio segments
  useEffect(() => {
    const processQueue = async () => {
      if (processingQueue.length > 0 && !isProcessing && apiKeyStatus === "set" && !isCancelling) {
        setIsProcessing(true)
        const segment = processingQueue[0]

        try {
          // Process the segment
          const transcribedText = await transcribeAudio(segment.blob, apiKey)
          const formatted = await formatHandHistory(transcribedText, apiKey)

          // Add the formatted hand to our list
          setFormattedHands((prev) => [
            ...prev,
            {
              id: `hand-${Date.now()}`,
              text: formatted,
              timestamp: new Date(),
            },
          ])

          // Remove the processed segment from the queue
          setProcessingQueue((prev) => prev.slice(1))
        } catch (error) {
          console.error("Error processing segment:", error)
          setApiKeyError("Error processing audio. Please check your API key.")
        } finally {
          setIsProcessing(false)
        }
      }
    }

    processQueue()
  }, [processingQueue, isProcessing, apiKey, apiKeyStatus, isCancelling])

  // Set up audio visualization
  const setupAudioVisualization = (stream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256

        const source = audioContextRef.current.createMediaStreamSource(stream)
        source.connect(analyserRef.current)

        const updateAudioLevel = () => {
          if (!analyserRef.current || !isRecording) return

          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)

          // Calculate average level
          const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length
          setAudioLevel(average / 128) // Normalize to 0-1

          if (isRecording) {
            requestAnimationFrame(updateAudioLevel)
          }
        }

        updateAudioLevel()
      }
    } catch (error) {
      console.error("Error setting up audio visualization:", error)
      // Continue without visualization if it fails
    }
  }

  const startRecording = async () => {
    // Clear any previous errors
    setRecordingError(null)
    // Reset cancellation flag
    setIsCancelling(false)

    // Check if already recording
    if (isRecording) {
      console.log("Already recording, ignoring start request")
      return
    }

    // Check if initializing
    if (isInitializingRecording) {
      console.log("Recording initialization in progress, ignoring start request")
      return
    }

    // Check if API key is set
    if (apiKeyStatus !== "set") {
      setApiKeyError("Please set your OpenAI API key first")
      return
    }

    // Set initializing flag
    setIsInitializingRecording(true)

    console.log("Starting recording...")

    try {
      console.log("Requesting microphone access...")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Update permission status
      setMicPermissionStatus("granted")

      console.log("Microphone access granted")
      micStreamRef.current = stream

      // Set up audio visualization
      setupAudioVisualization(stream)

      // Create MediaRecorder instance
      console.log("Creating MediaRecorder...")
      const options = { mimeType: "audio/webm" }
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options)
      } catch (e) {
        console.log("audio/webm not supported, trying alternative...")
        mediaRecorderRef.current = new MediaRecorder(stream)
      }

      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event)
        setRecordingError("An error occurred while recording. Please try again.")
        stopRecording()
      }

      mediaRecorderRef.current.onstop = () => {
        console.log("MediaRecorder stopped")
        if (audioChunksRef.current.length === 0) {
          console.warn("No audio data collected")
          setRecordingError("No audio data was recorded. Please try again.")
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        console.log(`Audio blob created: ${audioBlob.size} bytes`)
        setAudioBlob(audioBlob)

        // Only process if we're not cancelling
        if (!isCancelling) {
          if (!continuousMode) {
            processRecording(audioBlob)
          }
        } else {
          console.log("Recording was cancelled - not processing")
        }
      }

      // Start the MediaRecorder
      console.log("Starting MediaRecorder...")
      mediaRecorderRef.current.start()
      setIsRecording(true)

      // Start timer
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Set the start time for the current segment
      setCurrentSegment({
        start: 0,
        isProcessing: false,
      })

      console.log("Recording started successfully")
    } catch (error) {
      console.error("Error starting recording:", error)

      if ((error as DOMException).name === "NotAllowedError") {
        setMicPermissionStatus("denied")
        setRecordingError("Microphone access was denied. Please allow microphone access and try again.")
      } else if ((error as DOMException).name === "NotFoundError") {
        setRecordingError("No microphone was found. Please connect a microphone and try again.")
      } else {
        setRecordingError(`Failed to start recording: ${(error as Error).message || "Unknown error"}`)
      }
    } finally {
      setIsInitializingRecording(false)
    }
  }

  const stopRecording = () => {
    console.log("Stopping recording...")

    if (!isRecording) {
      console.log("Not recording, ignoring stop request")
      return
    }

    // Ensure the cancellation flag is reset (this is a normal stop)
    setIsCancelling(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
        console.log("MediaRecorder stopped")
      } catch (error) {
        console.error("Error stopping MediaRecorder:", error)
      }
    } else {
      console.warn("MediaRecorder not active, can't stop")
    }

    setIsRecording(false)

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Stop microphone
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("Audio track stopped")
      })
      micStreamRef.current = null
    }

    setAudioLevel(0)
  }

  // Cancel recording without processing
  const cancelRecording = () => {
    console.log("Canceling recording...")

    if (!isRecording) {
      console.log("Not recording, ignoring cancel request")
      return
    }

    // Set the cancellation flag to true before stopping
    setIsCancelling(true)

    // First stop the recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
        console.log("MediaRecorder stopped (canceled)")
      } catch (error) {
        console.error("Error stopping MediaRecorder during cancel:", error)
      }
    } else {
      console.warn("MediaRecorder not active, can't cancel")
    }

    setIsRecording(false)

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Stop microphone
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("Audio track stopped (canceled)")
      })
      micStreamRef.current = null
    }

    // Clear the audio chunks to discard the recording
    audioChunksRef.current = []
    setAudioBlob(null)
    setRecordingTime(0)
    setAudioLevel(0)
    
    console.log("Recording canceled and discarded")
  }

  // Save API key
  const saveApiKey = async () => {
    setApiKeyError(null)

    if (!apiKey.trim().startsWith("sk-")) {
      setApiKeyError("API key must start with 'sk-'")
      setApiKeyStatus("invalid")
      return
    }

    setApiKeyStatus("validating")

    try {
      // Test the API key with a simple request
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        setApiKeyError("Invalid API key. Please check and try again.")
        setApiKeyStatus("invalid")
        return
      }

      localStorage.setItem("openai-api-key", apiKey)
      setApiKeyStatus("set")
    } catch (error) {
      console.error("Error validating API key:", error)
      setApiKeyError("Error validating API key. Please check your internet connection.")
      setApiKeyStatus("invalid")
    }
  }

  // Clear API key
  const clearApiKey = () => {
    localStorage.removeItem("openai-api-key")
    setApiKey("")
    setApiKeyStatus("unset")
  }

  // Handle game settings update
  const handleGameSettingsSaved = (settings: GameSettingsType) => {
    setGameSettings(settings)
    setActiveTab("record") // Switch back to record tab after saving settings
  }

  // Function to format transcribed text with game settings context
  const processRecording = async (blob: Blob) => {
    if (!userApiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please add your OpenAI API key in the Account settings',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProcessingStep('transcribing')

    try {
      // Use the user's API key securely 
      const transcription = await transcribeAudio(blob, userApiKey)
      setTranscription(transcription)
      
      // Process with formatting if we got a transcription
      if (transcription) {
        setProcessingStep('formatting')
        const formatted = await formatHandHistory(transcription, userApiKey)
        if (formatted) {
          // Add the formatted hand to the display list
          const newHandId = `hand-${Date.now()}`
          setFormattedHands(prev => [
            ...prev,
            {
              id: newHandId,
              text: formatted,
              timestamp: new Date(),
            },
          ])
          
          // Save formatted hand to database if logged in
          if (userId) {
            await saveHandToDatabase(transcription, formatted)
          }
        }
      }
    } catch (err) {
      console.error('Error processing recording:', err)
      toast({
        title: 'Processing Error',
        description: 'Failed to process the recording',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProcessingStep('')
    }
  }

  const markNewHand = () => {
    if (!isRecording || !mediaRecorderRef.current || isCancelling) return

    // Stop the current recording
    mediaRecorderRef.current.stop()

    // Create a blob from the current chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })

    // Only add to processing queue if we're not cancelling
    if (!isCancelling) {
      // Add this segment to the processing queue
      setProcessingQueue((prev) => [
        ...prev,
        {
          blob: audioBlob,
          start: currentSegment.start,
          end: recordingTime,
        },
      ])
    }
    
    // Reset audio chunks for the next segment
    audioChunksRef.current = []

    // Start a new recording segment if in continuous mode
    if (continuousMode) {
      // Start recording again
      mediaRecorderRef.current.start()

      // Update the current segment
      setCurrentSegment({
        start: recordingTime,
        isProcessing: true,
      })
    } else {
      setIsRecording(false)

      // Stop microphone
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      setAudioLevel(0)
    }
  }

  const copyToClipboard = (id: string) => {
    const hand = formattedHands.find((h) => h.id === id)
    if (hand) {
      navigator.clipboard.writeText(hand.text)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  const exportAllHands = () => {
    const allHands = formattedHands
      .map((hand, index) => {
        return `--- Hand #${index + 1} (${hand.timestamp.toLocaleString()}) ---\n\n${hand.text}\n\n`
      })
      .join("\n")

    const blob = new Blob([allHands], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `poker-hands-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const deleteHand = (id: string) => {
    setFormattedHands((prev) => prev.filter((hand) => hand.id !== id))
  }

  const resetAll = () => {
    setTranscription("")
    setFormattedHands([])
    setAudioBlob(null)
    setProcessingQueue([])
  }

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Get recording button status text
  const getRecordingStatusText = () => {
    if (isInitializingRecording) {
      return "Initializing microphone..."
    }

    if (isRecording) {
      return continuousMode ? "Recording continuously... Click stop when finished" : "Recording... Click to stop"
    }

    if (isProcessing) {
      return "Processing your recording..."
    }

    if (apiKeyStatus !== "set") {
      return "Set your API key to start recording"
    }

    if (micPermissionStatus === "denied") {
      return "Microphone access denied. Please check browser settings."
    }

    return "Click to start recording your hand"
  }

  const analyzeHand = async (id: string) => {
    const hand = formattedHands.find((h) => h.id === id)
    if (!hand || !apiKey) return
    
    setAnalyzingHand(id)
    setAnalysisError((prev) => ({ ...prev, [id]: '' }))
    setGeneralError(null)
    
    try {
      console.log("Analyzing hand:", id)
      
      // Use the selected model or default to gpt-3.5-turbo
      const modelToUse = gameSettings?.aiModel || "gpt-3.5-turbo"
      console.log("Using AI model:", modelToUse)
      
      const response = await fetch("/api/analyze-hand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handText: hand.text,
          apiKey,
          model: modelToUse,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.text()
        console.error("Error response from analyze-hand API:", response.status, errorData)
        const errorMessage = `Error: ${response.status}${errorData ? ` - ${errorData}` : ''}`
        setGeneralError(errorMessage)
        throw new Error(errorMessage)
      }
      
      console.log("Received streaming response, status:", response.status)
      
      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error("Failed to get response reader")
      
      let analysis = `Analysis by OpenAI ${modelToUse}:\n\n`
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        // Convert the chunk to text and append to accumulated result
        const chunk = new TextDecoder().decode(value)
        analysis += chunk
        
        // Update the analysis in real-time
        setAnalysisResults((prev) => ({ ...prev, [id]: analysis }))
      }
      
      console.log("Analysis complete for hand:", id)
    } catch (error) {
      console.error("Error analyzing hand:", error)
      setAnalysisError((prev) => ({ 
        ...prev, 
        [id]: error instanceof Error ? error.message : "Failed to analyze hand" 
      }))
    } finally {
      setAnalyzingHand(null)
    }
  }

  const handleConvertClick = async () => {
    if (!transcription.trim()) {
      toast({
        title: 'Error',
        description: 'Please record or enter a hand history first',
        variant: 'destructive',
      })
      return
    }

    if (!userApiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please add your OpenAI API key in your account settings',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/convert-hand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: transcription,
          gameSettings,
          apiKey: userApiKey
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`)
      }
      
      const data = await response.json()
      setFormattedHands((prev) => [
        ...prev,
        {
          id: `hand-${Date.now()}`,
          text: data.result,
          timestamp: new Date(),
        },
      ])
      
      // Save the hand history to database
      if (data.result) {
        await saveHandToDatabase(transcription, data.result)
      }
    } catch (err) {
      console.error('Error converting hand:', err)
      toast({
        title: 'Conversion Failed',
        description: 'Failed to convert hand history. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const saveHandToDatabase = async (rawText: string, convertedText: string) => {
    if (!userId) return null
    
    try {
      const handHistory: Omit<HandHistory, 'id' | 'created_at'> = {
        user_id: userId,
        text: convertedText,
        timestamp: new Date().toISOString(),
        game_settings: gameSettings || undefined
      }
      
      const savedHand = await saveHandHistory(handHistory)
      if (savedHand) {
        toast({
          title: 'Hand Saved',
          description: 'Hand history saved successfully',
        })
        await loadHandHistories()
      }
    } catch (err) {
      console.error('Error saving hand history:', err)
      toast({
        title: 'Error',
        description: 'Failed to save hand history',
        variant: 'destructive',
      })
    }
  }

  const handleSelectHistory = (hand: { id: string; text: string; timestamp: Date }) => {
    setFormattedHands([
      {
        id: hand.id,
        text: hand.text,
        timestamp: hand.timestamp,
      },
    ])
    setTranscription(hand.text)
    setGameSettings(null)
    setActiveTab("recorder")
  }

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteHandHistory(id)
      toast({
        title: 'Hand Deleted',
        description: 'Hand history deleted successfully',
      })
      setFormattedHands((prev) => prev.filter((hand) => hand.id !== id))
      setTranscription("")
      setGameSettings(null)
      setActiveTab("recorder")
      await loadHandHistories()
    } catch (err) {
      console.error('Error deleting hand history:', err)
      toast({
        title: 'Error',
        description: 'Failed to delete hand history',
        variant: 'destructive',
      })
    }
  }

  const loadHandHistories = async () => {
    if (!userId) return
    
    try {
      const histories = await getHandHistories(userId)
      setFormattedHands(histories.map((hand) => ({
        id: hand.id || `hand-${Date.now()}`,
        text: hand.text,
        timestamp: new Date(hand.timestamp),
      })))
    } catch (err) {
      console.error('Error loading hand histories:', err)
      toast({
        title: 'Error',
        description: 'Failed to load hand histories',
        variant: 'destructive',
      })
    }
  }

  const loadDefaultGameSettings = async () => {
    if (!userId) return
    
    try {
      const defaultConfig = await getDefaultGameSettingConfig(userId)
      if (defaultConfig) {
        setGameSettings(castToGameSettingsType(defaultConfig.game_settings))
      }
    } catch (err) {
      console.error('Error loading default game settings:', err)
    }
  }

  // Function to safely cast database game settings to the required type
  const castToGameSettingsType = (settings: any): GameSettingsType => {
    return {
      ...settings,
      gameType: settings.gameType === "cash" || settings.gameType === "tournament" 
        ? settings.gameType as "cash" | "tournament" 
        : undefined,
      aiModel: ["gpt-3.5-turbo", "gpt-4o", "o1", "o3-mini"].includes(settings.aiModel)
        ? settings.aiModel as "gpt-3.5-turbo" | "gpt-4o" | "o1" | "o3-mini"
        : undefined
    }
  }

  const handleGameSettingsChange = (newSettings: any) => {
    setGameSettings(newSettings as GameSettingsType)
  }

  const handleConfigSelect = (config: GameSettingConfig) => {
    setGameSettings(castToGameSettingsType(config.game_settings))
    toast({
      title: 'Settings Loaded',
      description: `Loaded settings: ${config.name}`,
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="recorder">Recorder</TabsTrigger>
            <TabsTrigger value="history">Hand History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="recorder" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Record Your Hand</CardTitle>
                <CardDescription>
                  Speak or type your poker hand, then convert it to standard format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant={isRecording ? "destructive" : "default"}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <>
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" />
                        Start Recording
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setTranscription('')}
                    disabled={isRecording || !transcription}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
                
                <Textarea
                  placeholder="Record or type your poker hand here..."
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="h-40 font-mono text-sm"
                  disabled={isRecording}
                />
                
                <Button 
                  className="w-full" 
                  onClick={handleConvertClick}
                  disabled={isProcessing || !transcription.trim() || !userApiKey}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    'Convert to Hand History'
                  )}
                </Button>
                
                {!userApiKey && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please add your OpenAI API key in account settings
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Converted Hand History</CardTitle>
                <CardDescription>
                  Standard format hand history generated from your recording
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={formattedHands.length > 0 ? formattedHands[formattedHands.length - 1].text : transcription}
                  onChange={(e) => {
                    // This is a placeholder for the Textarea component
                  }}
                  className="h-60 font-mono text-sm"
                  placeholder="Converted hand history will appear here..."
                />
                
                <div className="flex justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // This is a placeholder for the Analyze button
                    }}
                    disabled={isProcessing || formattedHands.length === 0 || !userApiKey}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Activity className="mr-2 h-4 w-4" />
                        Analyze Hand
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
              
              {generalError && (
                <CardFooter>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{generalError}</AlertDescription>
                  </Alert>
                </CardFooter>
              )}
            </Card>
            
            {formattedHands.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Hand Analysis</CardTitle>
                    <CardDescription>
                      AI-powered analysis of your poker hand
                    </CardDescription>
                  </div>
                  {gameSettings && (
                    <Badge variant="outline" className="ml-2">
                      Model: {gameSettings.aiModel || "gpt-3.5-turbo"}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="max-h-[500px] overflow-y-auto prose prose-sm dark:prose-invert">
                    {analysisResults[formattedHands[formattedHands.length - 1].id] && (
                      <ReactMarkdown>{analysisResults[formattedHands[formattedHands.length - 1].id]}</ReactMarkdown>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Save className="mr-2 h-5 w-5" />
                  Saved Hand Histories
                </CardTitle>
                <CardDescription>
                  Your previously saved poker hand histories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isProcessing ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : formattedHands.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    No saved hand histories yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Accordion type="single" collapsible className="w-full">
                      {formattedHands.map((hand) => (
                        <AccordionItem value={hand.id || 'unknown'} key={hand.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="text-left font-medium">
                                {hand.timestamp.toLocaleString()}
                              </div>
                              <div className="flex space-x-2">
                                <Badge variant="outline">
                                  {gameSettings?.aiModel ? "Live" : "Online"}
                                </Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              <div className="font-mono text-xs bg-muted p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
                                {hand.text}
                              </div>
                              <div className="flex justify-between">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSelectHistory(hand)}
                                >
                                  Open
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={() => handleDeleteHistory(hand.id!)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Game Settings</CardTitle>
                <CardDescription>
                  Configure settings for hand history conversion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GameSettings 
                  onSettingsSaved={handleGameSettingsChange} 
                />
              </CardContent>
            </Card>
            
            <GameSettingsManager 
              userId={userId}
              currentSettings={gameSettings}
              onSelectConfig={handleConfigSelect}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

