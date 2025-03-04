# PokerScribe

A powerful poker hand transcription tool that converts verbal descriptions into standard hand history format using OpenAI's Whisper and GPT-4o.

## Overview

PokerScribe is a specialized tool designed for poker players who want to quickly document and analyze their hands. It uses advanced AI technology to transcribe verbal descriptions of poker hands and format them into standard hand history notation for later study and analysis.

### Key Features

- **Voice-to-Text Transcription**: Record verbal descriptions of poker hands using your device's microphone
- **AI-Powered Formatting**: Automatically converts natural language descriptions into standard poker hand history format
- **Hand History Management**: Save, copy, export, and organize your transcribed hands
- **Continuous Recording Mode**: Record multiple hands in a single session with automatic segmentation
- **Offline Capability**: Process recordings after your session is complete
- **Modern, Responsive UI**: Works on desktop and mobile devices

## Use Cases

- **Live Poker Sessions**: Quickly record notable hands during breaks (if you're okay with people at the table looking at you like you're weird)
- **Online Poker**: Track hands while playing on apps that don't provide hand tracking (like ClubWPTGold)
- **Study Sessions**: Convert verbal hand reviews into formatted histories for analysis
- **Poker Coaching**: Easily document student hands for review and feedback

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, or Safari)
- OpenAI API key with access to Whisper and GPT-4o models
- Microphone access

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/np2446/poker-transcriber.git
   cd poker-transcriber
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Configuration

1. Enter your OpenAI API key in the settings panel
2. Grant microphone permissions when prompted
3. Customize recording settings as needed

## How to Use

### Basic Usage

1. Click the "Record" button and describe the poker hand
2. Speak clearly, including details about:
   - Game type and stakes
   - Player positions and stack sizes
   - Cards and actions on each street
   - Pot sizes and results
3. Click "Stop" when finished
4. Review the transcribed and formatted hand history
5. Copy, save, or export the hand as needed

### Example Voice Input

"$1/$2 No-Limit Hold'em cash game. I'm in the cutoff with Ace-King of spades. UTG raises to $7, I three-bet to $21. Only UTG calls. Flop comes Queen of hearts, Ten of diamonds, Three of clubs. UTG checks, I c-bet $25 into a $45 pot. UTG calls. Turn is the Jack of spades. UTG checks, I bet $60 into $95. UTG calls. River is the Nine of hearts, giving me a straight. UTG checks, I bet $120 into $215. UTG thinks and calls. I show my straight and win the pot of $455."

### Continuous Recording Mode

1. Enable "Continuous Mode" in the settings
2. Start recording your session
3. Use the "Mark New Hand" button to segment different hands
4. Each hand will be processed separately in the background

## Advanced Features

### Hand Management

- **Copy**: Quickly copy formatted hand histories to clipboard
- **Export**: Download all hands as a text file
- **Delete**: Remove individual hands or reset all data
- **Organize**: Hands are automatically timestamped and sorted

### Recording Settings

- **Audio Visualization**: Visual feedback of microphone input levels
- **Recording Timer**: Track the duration of your recordings
- **Error Handling**: Clear feedback for permission issues or processing errors

## Future Implementations

### Persistent Hand Storage

- **Cloud Synchronization**: Store hand histories securely in the cloud for access across devices
- **User Accounts**: Create accounts to manage and organize your hand library
- **Session Management**: Group hands by session, venue, or tournament
- **Data Export/Import**: Seamlessly transfer hand histories between PokerScribe and poker tracking software

### Game Setup Presets

- **Table Profiles**: Save and load table configurations with preset stakes and player information
- **Quick Start Templates**: Create templates for your regular games with predefined stakes, formats, and stack sizes
- **Voice Commands**: Use voice commands like "New $2/$5 session" to automatically configure game parameters
- **Player Recognition**: Save regular opponents' playing styles and automatically include them in hand histories

### Advanced Analytics

- **Hand Tagging**: Categorize hands by concepts (3-bet pots, missed draws, etc.)
- **Integrated Study Tools**: Basic equity calculations and decision point analysis
- **Play Pattern Recognition**: Identify trends in your play across multiple sessions
- **Win/Loss Tracking**: Basic bankroll management and session results


### Integration Capabilities

- **Poker Training Site Integration**: Export hands directly to poker training platforms
- **Study Group Sharing**: Share hand histories with study partners or coaches
- **GTO Solver Export**: Format hands for import into GTO solvers for deeper analysis
- **Video Recording**: Synchronize hand histories with video recordings of online sessions

## Technical Details

PokerScribe is built with:

- **Next.js**: React framework for the frontend
- **OpenAI Whisper**: State-of-the-art speech recognition model
- **OpenAI GPT-4o**: Advanced language model for hand formatting
- **Web Audio API**: For audio recording and visualization
- **Tailwind CSS**: For responsive, modern UI design

## Privacy and Security

- Your OpenAI API key is stored locally in your browser
- Audio recordings are processed on-demand and not stored on our servers
- Hand histories remain in your browser's local storage until explicitly exported

## Troubleshooting

### Common Issues

- **Microphone Access Denied**: Check browser permissions and ensure microphone access is granted
- **API Key Errors**: Verify your OpenAI API key has access to required models
- **Recording Issues**: Try refreshing the page or using a different browser
- **Formatting Errors**: Ensure your verbal descriptions include all necessary details

### Support

If you encounter any issues or have questions, please [open an issue](https://github.com/np2446/poker-transcriber/issues) on GitHub.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for providing the AI models that power this application
- The poker community for inspiration and feedback

---

Built with ♠️ ♥️ ♦️ ♣️ by Noah Perelmuter
