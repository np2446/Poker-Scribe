# Poker Scribe

A web application for recording, converting, analyzing, and managing poker hand histories.

## Features

- **User Authentication**: Register and login to securely store your poker data
- **Voice Recording**: Record your poker hands verbally
- **Hand Conversion**: Convert spoken or typed descriptions into standard hand history format
- **Hand Analysis**: Get AI-powered analysis of your poker hands
- **Game Settings**: Configure and save different game settings profiles
- **Hand History Management**: Save, view, and manage your hand histories

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI API

## Setup Instructions

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/np2446/poker-transcriber.git
   cd poker-transcriber
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a Supabase project:
   - Go to [Supabase](https://supabase.com/) and create a new project
   - Note your project URL and anon key

4. Set up environment variables:
   - Copy the `.env.local.example` file to `.env.local`
   - Fill in your Supabase URL and anon key:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

5. Set up the database:
   - Go to the SQL Editor in your Supabase dashboard
   - Run the SQL script from `supabase/migrations/20240601000000_initial_schema.sql`

6. Enable email authentication in Supabase:
   - Go to Authentication > Providers
   - Enable Email provider
   - Configure as needed (password length, etc.)

7. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Register/Login**: Create an account or log in to an existing one
2. **Set API Key**: Add your OpenAI API key in the Account tab
3. **Configure Game Settings**: Set up your poker game parameters
4. **Record Hand**: Use the microphone button to record your hand or type it manually
5. **Convert Hand**: Convert your recording to standard hand history format
6. **Analyze Hand**: Get AI-powered analysis of your poker play
7. **Save Settings**: Save your game settings for future use

## License

MIT

## Acknowledgements

- [OpenAI](https://openai.com/) for the AI models
- [Supabase](https://supabase.com/) for the backend infrastructure
- [shadcn/ui](https://ui.shadcn.com/) for the UI components
- [Next.js](https://nextjs.org/) for the framework