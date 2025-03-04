import { Transcriber } from "@/components/transcriber"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            PokerScribe
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Record your poker hands verbally and convert them to standard hand history format instantly
          </p>
        </header>

        <Transcriber />

        <footer className="mt-20 text-center text-gray-500 text-sm">
          <p>Powered by OpenAI • © {new Date().getFullYear()} PokerScribe</p>
        </footer>
      </div>
    </main>
  )
}

