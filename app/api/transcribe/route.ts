import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await req.formData()
    const audioFile = formData.get("file") as File
    const apiKey = formData.get("apiKey") as string

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 })
    }

    // Convert the file to a Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a FormData object for the OpenAI API
    const openaiFormData = new FormData()
    const blob = new Blob([buffer], { type: audioFile.type })
    openaiFormData.append("file", blob, "audio.webm")
    openaiFormData.append("model", "whisper-1")

    // Call the OpenAI API
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("OpenAI API error:", errorData)
      return NextResponse.json({ error: "Failed to transcribe audio" }, { status: response.status })
    }

    const data = await response.json()

    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error("Error in transcribe route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

