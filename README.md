# Configuration Type script

1. Options du compilateur:

    `tsconfig.json`
    
    ```json
    {
      "compilerOptions": {
        "target": "es6",
        "module": "es2020",
        "outDir": "./js",
        "rootDir": "./ts",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
      },
      "include": ["ts/**/*"]
    }
    ```

2. Packages du compilateur:

   ```bash
   npm install typescript @types/node --save-dev
   ```

3. Compilation on Save:
    
    `# In User's Shoes - The Game

A challenging puzzle game where you must catch falling shoes to complete pairs and score points. Test your reflexes and strategy as you navigate through multiple rounds with increasing difficulty!

## 🎮 Game Features

- **Responsive Design**: Optimized for both desktop and mobile devices
- **Progressive Web App**: Install and play offline
- **Multiple Rounds**: Battle through rounds with increasing challenges
- **Score System**: Earn points by matching shoe pairs
- **High Score Tracking**: Beat your personal best with golden notifications
- **Level Progression**: Advance through levels as you improve
- **Touch & Mouse Support**: Full input compatibility across devices
- **Explosion Effects**: Dynamic visual feedback for matches
- **iOS Fullscreen Support**: Enhanced mobile experience

## 🚀 Play Now

Simply open `index.html` in your browser or visit the live demo!

## 🛠️ Development

### Prerequisites

- Node.js (for TypeScript compilation)
- A modern web browser

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Thierry-G/In-user-s-shoes---The-game.git
   cd In-user-s-shoes---The-game
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```
   
   Or for continuous development:
   ```bash
   npm run watch
   ```

### Project Structure

```
├── index.html          # Main game page
├── manifest.webmanifest # PWA manifest
├── sw.js               # Service worker for offline support
├── ts/                 # TypeScript source files
│   ├── theGame.ts      # Main game logic
│   ├── Board.ts        # Game board and scoring
│   ├── Player.ts       # Player component
│   ├── Shoes.ts        # Shoe sprites and rendering
│   ├── Levels.ts       # Level configurations
│   ├── Ui.ts           # UI management
│   ├── UIEffects.ts    # Visual effects
│   └── GameTypes.ts    # Type definitions
├── js/                 # Compiled JavaScript (auto-generated)
├── css/                # Stylesheets
├── img/                # Game assets and sprites
└── scss/               # Sass source files
```

## 🎯 How to Play

1. **Objective**: Catch falling shoes with your player character
2. **Movement**: Use arrow keys, WASD, or touch/swipe on mobile
3. **Matching**: Collect left and right shoes of the same type to score points
4. **Rounds**: Complete multiple rounds to progress
5. **Scoring**: Higher matches and combos earn more points
6. **Levels**: Advance levels by reaching score thresholds

## 📱 Mobile Support

- Optimized touch controls with half-block precision
- iOS fullscreen support with canvas recalculation
- Responsive layout adapting to screen sizes
- Touch gestures for intuitive gameplay

## 🏆 Features Implemented

- ✅ Symmetric player movement constraints
- ✅ iOS fullscreen with canvas recalculation  
- ✅ Mobile touch coordinate system fixes
- ✅ Automatic scoring validation with delay timer
- ✅ Post-explosion shoe visibility fixes
- ✅ High score notifications with golden effects
- ✅ Progressive Web App capabilities
- ✅ Offline gameplay support

## 🔧 TypeScript Configuration

The project uses TypeScript with the following configuration:

```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "es2020", 
    "outDir": "./js",
    "rootDir": "./ts",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["ts/**/*"]
}
```

### Build Scripts

- `npm run build` - Compile TypeScript once
- `npm run watch` - Watch for changes and compile automatically

## 📝 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License**.

🆓 **Free for non-commercial use** - You can:
- Play, share, and modify the game for personal use
- Use it for educational purposes
- Create derivative works for non-commercial purposes

💼 **Commercial use requires permission** - Contact the author for commercial licensing.

For the full license terms, see the [LICENSE](LICENSE) file or visit [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

---

**Enjoy playing "In User's Shoes"!** 👟🎮`

    ```json
    {
	"version": "2.0.0",
	"tasks": [
		{
			"label": "tsc: build - tsconfig.json",
			"type": "shell",
			"command": "tsc -p .",
			"problemMatcher": [
				"$tsc"
			],
			"group": "build"
		},
		{
			"label": "tsc: watch - tsconfig.json",
			"type": "shell",
			"command": "tsc -p . --watch",
			"isBackground": true,
			"problemMatcher": [
				"$tsc"
			],
			"group": "build"
		}
	]
    }
    ```




 `tsc: watch - tsconfig.json`