import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

export async function POST(req: NextRequest) {
  try {
    const { transcription, apiKey } = await req.json()

    if (!transcription) {
      return NextResponse.json({ error: "No transcription provided" }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 })
    }

    // Create a custom OpenAI client with the provided API key
    const customOpenAI = createOpenAI({
      apiKey: apiKey,
    })

    // Look for "Additional context:" in the transcription, which indicates game settings are included
    const hasGameSettings = transcription.includes("Additional context:")

    // Use the AI SDK to format the hand history with the provided API key
    const { text: formattedHand } = await generateText({
      model: customOpenAI("gpt-4o"),
      prompt: `
        You are a poker hand history formatter. Convert the following verbal description of a poker hand into standard poker hand history format.
        
        ${hasGameSettings ? `The input may include an "Additional context:" section with game settings. Use this information to enhance the hand history output.` : ''}
        
        Follow these formatting rules:
        1. Include game type, stakes, and table information in the header
        2. List all players with positions and stack sizes
        3. Format each street (preflop, flop, turn, river) with proper indentation
        4. Include all actions (fold, call, raise) with bet sizes
        5. Format cards as: Ah (ace of hearts), Kd (king of diamonds), etc.
        6. Include pot sizes after each street
        7. Show the winner and amount won
        
        Here's the ${hasGameSettings ? 'input with context and' : ''} verbal description:
        ${transcription}
        
        Return ONLY the formatted hand history text with no additional explanation.
      `,
    })

    return NextResponse.json({ formattedHand })
  } catch (error) {
    console.error("Error in format-hand route:", error)
    return NextResponse.json(
      {
        error: "Internal server error: " + (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 },
    )
  }
}

