# Maru Desktop

Offline desktop shell for Maru applets. Built with Electron.

## License

**GNU General Public License v3.0 (GPL-3.0)** - See [LICENSE](LICENSE) for full text.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

## Building on macOS

**Note:** Electron macOS builds can only be created on a macOS machine. You cannot cross-compile for macOS from Windows or Linux.

If you have a Mac, follow these steps:

### Prerequisites

- macOS 12 or later
- Node.js 20+
- Xcode Command Line Tools

### Setup

1. Clone the repo:
```bash
git clone https://github.com/JmDemisana/maru-desktop.git
cd maru-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Build web assets from the main website repo:
```bash
# In maru-website:
npm run build:desktop-web

# Copy to desktop repo:
cp -r desktop-web-dist/ /path/to/maru-desktop/
```

### Building for macOS

```bash
npm run dist -- --mac dmg
```

This creates a `.dmg` installer in the `dist/` folder.

### Running Development

```bash
npm start
```

## Building on Windows

### Prerequisites

- Windows 10/11
- Node.js 20+

### Setup

1. Clone the repo:
```bash
git clone https://github.com/JmDemisana/maru-desktop.git
cd maru-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Build web assets from the main website repo:
```bash
# In maru-website:
npm run build:desktop-web

# Copy to desktop repo:
cp -r desktop-web-dist/ C:\path\to\maru-desktop\
```

### Building for Windows

**Portable (no install):**
```bash
npm run dist -- --win portable
```

**Installer:**
```bash
npm run dist -- --win nsis
```

The executables will be in the `dist/` folder.

## Building on Linux

### Prerequisites

- Linux (Ubuntu 20.04+ recommended)
- Node.js 20+

### Setup

```bash
git clone https://github.com/JmDemisana/maru-desktop.git
cd maru-desktop
npm install
```

Copy web assets similarly to Windows.

### Building for Linux

```bash
npm run dist -- --linux AppImage
# or
npm run dist -- --linux deb
```

## CI/CD

GitHub Actions automatically builds for all platforms (Windows, macOS, Linux) when a git tag is pushed:

```bash
git tag v0.0.1
git push origin v0.0.1
```

This triggers builds for all platforms and creates a GitHub Release with all artifacts.

## Project Structure

- `src/` - Electron main process code
- `src/preload.ts` - Preload script for IPC
- `dist/` - Built executables
- `desktop-web-dist/` - Web assets (copy from maru-website)

## Notes

- The desktop app runs the Maru website locally in an embedded browser
- No internet required after initial setup
- Uses local storage for settings