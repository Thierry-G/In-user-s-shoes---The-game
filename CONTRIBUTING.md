# Contributing to In User's Shoes - The Game

Thank you for your interest in contributing to this project! Here are some guidelines to help you get started.

## Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/In-user-s-shoes---The-game.git
   cd In-user-s-shoes---The-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development**
   ```bash
   npm run watch
   ```
   This will watch for TypeScript changes and compile automatically.

## Project Structure

- `ts/` - TypeScript source files
- `js/` - Compiled JavaScript (auto-generated)
- `css/` - Stylesheets
- `img/` - Game assets
- `index.html` - Main game entry point

## Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the TypeScript files (`ts/` directory)

3. **Test your changes** by opening `index.html` in a browser

4. **Compile and verify**
   ```bash
   npm run build
   ```

## Code Style

- Use TypeScript for all game logic
- Follow existing naming conventions
- Add comments for complex game mechanics
- Ensure mobile compatibility for new features

## Submitting Changes

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub

## Types of Contributions

- 🐛 Bug fixes
- ✨ New features
- 🎨 UI/UX improvements
- 📱 Mobile enhancements
- 🎮 Game mechanics improvements
- 📚 Documentation updates
- 🧪 Testing improvements

## Reporting Issues

When reporting bugs, please include:
- Browser and version
- Device type (desktop/mobile)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

Thank you for contributing! 🎮👟
