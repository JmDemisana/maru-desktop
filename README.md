# Maru Desktop

Offline desktop shell for Maru applets. Built with Electron.

## Downloads

Get the latest release from the [Releases page](https://github.com/JmDemisana/maru-desktop/releases).

### Available Platforms
- **Windows** - Portable .exe (no installation required)
- **Linux** - AppImage and .deb packages
- **macOS** - DMG for Intel and Apple Silicon

## Included Applets

- **PhotoServe** - Photo layout and print workstation
- **Cup-Cupper-Cuppers** - Shuffled-cup duel game
- **Dael or No Dael** - Single-player deal game
- **TUP Grade Solver** - Grade calculator with PNG export
- **Options** - Desktop settings and themes

## Building Locally

### Prerequisites
- Node.js 20+
- npm

### Install Dependencies
```bash
npm install
```

### Copy Web Assets
Before building, copy the `desktop-web-dist/` folder from the main maru-website repo:
```bash
# From the main repo:
npm run build:desktop-web

# Then copy the output:
cp -r desktop-web-dist/ /path/to/maru-desktop/
```

### Run Development
```bash
npm start
```

### Build Distribution
```bash
# Build for current platform
npm run dist

# Build specific platform
npm run dist -- --win portable    # Windows portable
npm run dist -- --linux AppImage  # Linux AppImage
npm run dist -- --mac dmg         # macOS DMG
```

## CI/CD

GitHub Actions automatically builds for all platforms when a git tag is pushed:

```bash
git tag v0.0.1
git push origin v0.0.1
```

This triggers builds for Windows, Linux, and macOS, and creates a GitHub Release with all artifacts.

## License

Copyright © 2026 Maru. All rights reserved.