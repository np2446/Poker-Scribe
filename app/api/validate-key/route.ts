import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json()

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return NextResponse.json({ error: "Invalid API key format" }, { status: 400 })
    }

    // Test the API key with a simple models list request
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error validating API key:", error)
    return NextResponse.json({ error: "Failed to validate API key" }, { status: 500 })
  }
}

