# Neon Marble Popper

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-blue.svg" alt="React 19.0">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue.svg" alt="TypeScript 5.8">
  <img src="https://img.shields.io/badge/Tailwind-4.1-purple.svg" alt="Tailwind 4.1">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License MIT">
</p>

An addictive arcade marble puzzle game with neon aesthetics. Match 3+ colored marbles to clear zones, destroy obstacles, collect power-ups, and aim for the highest score!

## Features

### Core Gameplay
- **Match-3 Mechanics** - Shoot marbles to create chains of 3+ matching colors
- **20 Progressive Zones** - Each zone increases in difficulty with unique path patterns
- **Combo System** - Chain reactions earn multiplied points
- **Power-Ups** - Bomb (explosive), Lightning (clear color), Slow-Mo (temporarily slow time)

### Obstacles
- **Static** - Basic blockers
- **Rotating** - Push marbles away based on rotation direction and speed
- **Magnetic** - Pull marbles toward them (configurable strength & radius)
- **Breakable** - Can be destroyed
- **Barriers** - Require power-ups to break
- **Portals** - Teleport marbles to linked portals
- **Moving Platforms** - Deflect projectiles

### Visual & Audio
- **Neon Aesthetics** - Glowing effects, particles, and smooth animations
- **Dark/Light Themes** - Toggle between modes
- **Sound Effects** - Synthesized audio for shooting, matching, explosions
- **Smooth Transitions** - Fade effects between zones
- **Power-up Visual Effects** - Glowing auras and particle effects on activation

### Controls
- **Mouse** - Aim and click to shoot
- **Touch** - Touch and tap to shoot (mobile-optimized)
- **Gamepad** - Analog stick to aim, button to shoot

### Settings
- Game speed adjustment (0.5x - 2.0x)
- Magnetic pull strength configuration
- Magnetic pull radius configuration
- Sound on/off toggle
- Dark/Light theme toggle

### Responsive Design
- Fully responsive layout for mobile, tablet, and desktop
- Optimized touch interactions for mobile
- Adaptive HUD positioning per screen size

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **Motion (Framer Motion)** - Animations
- **Canvas API** - Game rendering

## Getting Started

### Prerequisites
- Node.js 18+

### Installation

```bash
# Clone or download the project
cd neon-marble-popper

# Install dependencies
npm install
```

### Running the Game

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## How to Play

1. **Aim** - Move your mouse/touch/gamepad to aim the shooter
2. **Shoot** - Click/tap to fire a marble into the chain
3. **Match** - Connect 3+ marbles of the same color to clear them
4. **Survive** - Don't let the chain reach the end of the path
5. **Clear Zone** - Clear all marbles to advance to the next zone
6. **Score** - Earn points through matches, combos, and bonuses

### Tips

- Use **Bomb** power-ups to clear clusters and destroy obstacles
- Use **Lightning** power-ups to instantly clear all marbles of a specific color
- Use **Slow-Mo** power-ups when the chain is moving too fast
- Watch out for **Rotating Obstacles** - they push marbles away!
- **Magnetic Obstacles** can pull marbles off course - adjust your aim

## Project Structure

```
neon-marble-popper/
├── src/
│   ├── App.tsx       # Main game component
│   ├── main.tsx      # Entry point
│   └── index.css     # Global styles
├── index.html        # HTML template
├── package.json      # Dependencies
├── vite.config.ts    # Vite configuration
└── tsconfig.json     # TypeScript configuration
```

## License

MIT License - Feel free to use this project for learning or personal projects.

---

<p align="center">Made with 💜 using React + Canvas</p>
