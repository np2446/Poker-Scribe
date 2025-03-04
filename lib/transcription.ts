// This file handles the audio transcription and formatting logic

/**
 * Transcribes audio using OpenAI's Whisper API
 */
export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  try {
    // Create form data to send to the API
    const formData = new FormData()
    formData.append("file", audioBlob, "recording.webm")
    formData.append("model", "whisper-1")
    formData.append("apiKey", apiKey)

    // Call the server action to handle the API request
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Transcription failed: ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    return data.text
  } catch (error) {
    console.error("Error transcribing audio:", error)
    throw error
  }
}

/**
 * Formats transcribed text into standard poker hand history format using OpenAI
 * @param transcription The raw transcription text, optionally with game settings context
 * @param apiKey OpenAI API key
 * @returns Formatted hand history
 */
export async function formatHandHistory(transcription: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("/api/format-hand", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcription, apiKey }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Formatting failed: ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    return data.formattedHand
  } catch (error) {
    console.error("Error formatting hand history:", error)
    throw error
  }
}

