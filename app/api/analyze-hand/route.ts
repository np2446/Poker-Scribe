import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    const { handText, apiKey, model } = await req.json()

    if (!handText) {
      return NextResponse.json({ error: "No hand text provided" }, { status: 400 })
    }

    if (!apiKey || !apiKey.trim().startsWith("sk-")) {
      return NextResponse.json({ error: "Invalid API key format" }, { status: 400 })
    }

    // Create an OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey.trim(),
    })

    // Create the prompt for the hand analysis
    const prompt = `
      You are an expert poker coach with deep knowledge of GTO (Game Theory Optimal) strategy and poker analysis.
      
      Please analyze the following poker hand history and provide detailed feedback:
      
      ${handText}
      
      Your analysis should include:
      1. Assessment of preflop decisions and hand selection
      2. Analysis of bet sizings and strategic choices on each street
      3. Evaluation of the final outcome and whether it was a good result
      4. Specific suggestions for how the hand could have been played better
      5. Any GTO considerations or deviations from optimal play
      
      Be direct, honest, and provide actionable advice. Use poker terminology but explain complex concepts.
    `

    // Use the provided model or default to gpt-3.5-turbo
    const modelToUse = model || "gpt-3.5-turbo"
    console.log(`Using OpenAI model: ${modelToUse} for hand analysis`)

    try {
      // Create a streaming response
      const stream = await openai.chat.completions.create({
        model: modelToUse,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
      })

      // Return the streaming response
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || ""
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text))
                }
              }
              controller.close()
            } catch (error) {
              console.error("Error in stream processing:", error)
              const errorMessage = error instanceof Error ? error.message : String(error)
              controller.enqueue(new TextEncoder().encode(`\n\nError during streaming: ${errorMessage}`))
              controller.close()
            }
          },
        })
      )
    } catch (error) {
      console.error("Error creating completion:", error)
      
      // Get detailed error message
      let errorMessage = "Unknown error"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === "object" && error !== null) {
        errorMessage = JSON.stringify(error)
      } else {
        errorMessage = String(error)
      }
      
      return NextResponse.json(
        {
          error: `Failed to create completion: ${errorMessage}`,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error in analyze-hand route:", error)
    return NextResponse.json(
      {
        error: "Internal server error: " + (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    )
  }
} 