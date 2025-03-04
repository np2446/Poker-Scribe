"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { transcribeAudio, formatHandHistory } from "@/lib/transcription"
import { Loader2, StopCircle, Mic, Volume2, Save, Trash2, Copy, AlertCircle, Settings } from "lucide-react"
import { GameSettings } from "@/components/game-settings"
import { z } from "zod"

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
}

export function Transcriber() {
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

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
      if (processingQueue.length > 0 && !isProcessing && apiKeyStatus === "set") {
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
  }, [processingQueue, isProcessing, apiKey, apiKeyStatus])

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

        if (!continuousMode) {
          processRecording(audioBlob)
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
    console.log("Recording stopped completely")
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
    setIsProcessing(true)
    setTranscription("")
    
    try {
      // Transcribe audio
      const transcribedText = await transcribeAudio(blob, apiKey)
      setTranscription(transcribedText)
      
      // Prepare context with game settings if available
      let contextPrompt = transcribedText
      
      if (gameSettings) {
        const { gameType, tableSize, smallBlind, bigBlind, ante, startingStack, currency } = gameSettings
        
        // Add game settings context to the transcription
        let settingsContext = "Additional context: "
        
        if (gameType) {
          settingsContext += `Game type: ${gameType === "cash" ? "Cash Game" : "Tournament"}. `
        }
        
        if (gameType === "cash" && smallBlind && bigBlind) {
          settingsContext += `Stakes: ${currency || "$"}${smallBlind}/${currency || "$"}${bigBlind}. `
          
          if (ante && ante !== "0") {
            settingsContext += `Ante: ${currency || "$"}${ante}. `
          }
        }
        
        if (tableSize) {
          settingsContext += `${tableSize}-max table. `
        }
        
        if (startingStack) {
          settingsContext += `Starting stack: ${startingStack}${gameType === "cash" ? "BB" : " chips"}. `
        }
        
        // Prepend the context to the transcription
        contextPrompt = `${settingsContext}\n\n${transcribedText}`
      }

      // Format hand history with the context
      const formatted = await formatHandHistory(contextPrompt, apiKey)
      
      // Add the formatted hand to our list
      setFormattedHands((prev) => [
        ...prev,
        {
          id: `hand-${Date.now()}`,
          text: formatted,
          timestamp: new Date(),
        },
      ])
    } catch (error) {
      console.error("Error processing recording:", error)
      setApiKeyError("Error processing recording. Please check your API key.")
    } finally {
      setIsProcessing(false)
    }
  }

  const markNewHand = () => {
    if (!isRecording || !mediaRecorderRef.current) return

    // Stop the current recording
    mediaRecorderRef.current.stop()

    // Create a blob from the current chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })

    // Add this segment to the processing queue
    setProcessingQueue((prev) => [
      ...prev,
      {
        blob: audioBlob,
        start: currentSegment.start,
        end: recordingTime,
      },
    ])

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

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm p-6 rounded-xl shadow-xl">
          {/* API Key Section - Always visible at the top */}
          <div className="mb-6 p-4 bg-gray-900/50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-300 mb-3">OpenAI API Key</h3>

            {apiKeyStatus !== "set" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Enter your OpenAI API key to enable transcription. Your key is stored locally in your browser.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setApiKeyError(null)
                    }}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Button
                    onClick={saveApiKey}
                    disabled={apiKeyStatus === "validating" || !apiKey.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {apiKeyStatus === "validating" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Key
                  </Button>
                </div>
                {apiKeyError && <p className="text-sm text-red-400">{apiKeyError}</p>}
                <p className="text-xs text-gray-500">
                  Get your API key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    OpenAI's dashboard
                  </a>
                </p>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <p className="text-sm text-green-400 flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  API key is set and ready to use
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearApiKey}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  Clear Key
                </Button>
              </div>
            )}
          </div>

          <Tabs defaultValue="record" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-900/50">
              <TabsTrigger value="record" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Record
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Game Setup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="mt-0">
              <div className="flex flex-col items-center mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    id="continuous-mode"
                    checked={continuousMode}
                    onCheckedChange={setContinuousMode}
                    disabled={isRecording}
                  />
                  <Label htmlFor="continuous-mode" className="text-gray-300">
                    Continuous Recording Mode
                  </Label>
                </div>

                {/* Recording button */}
                <div className="relative mb-4">
                  <Button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isInitializingRecording || apiKeyStatus !== "set" || micPermissionStatus === "denied"}
                    className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 border-0",
                      isRecording
                        ? "bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-500/30"
                        : "bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:bg-blue-500/30",
                      (isInitializingRecording || apiKeyStatus !== "set" || micPermissionStatus === "denied") &&
                        "opacity-70 cursor-not-allowed",
                    )}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full opacity-30",
                        isRecording && "animate-ping bg-red-500",
                      )}
                      style={{
                        transform: isRecording ? `scale(${1 + audioLevel * 0.5})` : "scale(1)",
                        opacity: isRecording ? 0.2 + audioLevel * 0.3 : 0.2,
                      }}
                    ></div>

                    {isInitializingRecording ? (
                      <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                    ) : isRecording ? (
                      <StopCircle className="w-12 h-12 text-red-500 animate-pulse" />
                    ) : (
                      <Mic className="w-12 h-12 text-blue-400" />
                    )}
                  </Button>

                  {isRecording && (
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-900 px-3 py-1 rounded-full text-red-400 text-sm font-mono">
                      {formatTime(recordingTime)}
                    </div>
                  )}
                </div>

                <p className="text-gray-400 text-center mt-2">{getRecordingStatusText()}</p>

                {/* Recording error message */}
                {recordingError && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-md flex items-start gap-2 max-w-md">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{recordingError}</p>
                  </div>
                )}

                {isRecording && (
                  <div className="flex flex-col items-center mt-4">
                    <div className="flex items-center text-sm text-gray-500 mb-4">
                      <Volume2 className="w-4 h-4 mr-2" />
                      <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
                          style={{ width: `${audioLevel * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {continuousMode && (
                      <Button
                        onClick={markNewHand}
                        variant="outline"
                        className="border-blue-700 bg-blue-900/30 text-blue-300 hover:bg-blue-800/50"
                      >
                        Mark New Hand
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {(isProcessing || processingQueue.length > 0) && (
                <div className="flex flex-col items-center justify-center my-4 p-3 bg-gray-900/50 rounded-lg">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-2" />
                  <p className="text-sm text-gray-400">
                    {processingQueue.length > 0
                      ? `Processing ${processingQueue.length + (isProcessing ? 1 : 0)} hand${processingQueue.length > 1 ? "s" : ""}...`
                      : "Processing hand..."}
                  </p>
                </div>
              )}

              {!isRecording && formattedHands.length === 0 && !isProcessing && (
                <div className="bg-gray-900/50 rounded-lg p-4 text-gray-400 text-sm">
                  <h3 className="font-medium text-gray-300 mb-2">How to use:</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Enter your OpenAI API key at the top</li>
                    <li>Toggle "Continuous Recording Mode" if you want to record multiple hands</li>
                    <li>Click the microphone button to start recording</li>
                    <li>Clearly describe your poker hand (positions, actions, bet sizes)</li>
                    <li>In continuous mode, click "Mark New Hand" when you finish describing a hand</li>
                    <li>Click the stop button when you're done recording all hands</li>
                    <li>View your formatted hands in the "History" tab</li>
                  </ol>
                  <p className="mt-4 text-xs text-gray-500">
                    Example: "I was in the big blind with Ace King suited. UTG raised to 3BB, I 3-bet to 9BB, they
                    called. Flop came Ace of spades, Ten of hearts, Two of diamonds..."
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              {formattedHands.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-300">Recorded Hands</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportAllHands}
                        className="text-gray-300 border-gray-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Export All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetAll}
                        className="text-red-400 border-gray-700 hover:bg-red-900/20 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    {formattedHands.map((hand, index) => (
                      <AccordionItem key={hand.id} value={hand.id} className="border-gray-700">
                        <AccordionTrigger className="hover:bg-gray-800/30 px-4 rounded-lg">
                          <div className="flex items-center">
                            <span className="text-gray-300 font-medium">Hand #{formattedHands.length - index}</span>
                            <span className="ml-3 text-xs text-gray-500">{hand.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 overflow-auto max-h-96 mb-2">
                            <pre className="whitespace-pre-wrap">{hand.text}</pre>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(hand.id)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              {copied === hand.id ? "Copied!" : "Copy"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHand(hand.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <p>No hands recorded yet</p>
                  <Button
                    variant="link"
                    onClick={() => {
                      const tabsList = document.querySelector('[role="tablist"]')
                      const recordTab = tabsList?.querySelector('[data-value="record"]')
                      if (recordTab) {
                        ;(recordTab as HTMLElement).click()
                      }
                    }}
                    className="mt-2 text-blue-400"
                  >
                    Go to recording
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings">
              <GameSettings onSettingsSaved={handleGameSettingsSaved} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

