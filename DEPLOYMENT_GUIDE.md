# Maru Apps Deployment Guide

This guide explains how to set up and deploy the desktop and mobile apps using separate GitHub repositories and GitHub Releases.

## Repository Structure

| Repository | Purpose | URL |
|------------|---------|-----|
| `maru-website` | Main website (existing) | `github.com/JmDemisana/maru-website` |
| `maru-desktop` | Desktop app builds | `github.com/JmDemisana/maru-desktop` |
| `maru-mobile` | Android helper app builds | `github.com/JmDemisana/maru-mobile` |

## Desktop App Setup (maru-desktop)

### 1. Initialize the Repository

```bash
# Create a new folder for the desktop repo
mkdir maru-desktop
cd maru-desktop
git init

# Copy these files from the main repo:
# - electron/
# - desktop-shell.html
# - vite.desktop.config.ts
# - src/desktop/
# - src/pages/DesktopApp.tsx (optional, for reference)
# - src/pages/DesktopOptions.tsx (optional, for reference)
# - shared/helperAppMetadata.ts
# - shared/nativeAppCatalog.ts (or data/nativeAppCatalog.ts)
# - .github/workflows/build-desktop.yml
# - package.json (modified version below)

# Create a minimal package.json for the desktop repo
cat > package.json << 'EOF'
{
  "name": "maru-desktop",
  "version": "0.0.1",
  "description": "Maru Desktop - Offline applet shell",
  "main": "electron/main.mjs",
  "scripts": {
    "build:desktop-web": "echo 'Build from main repo'",
    "desktop:all": "echo 'Run from main repo'",
    "desktop:portable": "echo 'Run from main repo'",
    "desktop:linux": "echo 'Run from main repo'"
  },
  "build": {
    "appId": "io.maru.desktop",
    "productName": "Maru Desktop",
    "artifactName": "Maru-Desktop-${os}-${arch}.${ext}",
    "npmRebuild": false,
    "files": [
      "desktop-web-dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "directories": {
      "buildResources": "public",
      "output": "desktop-dist"
    },
    "win": {
      "icon": "public/app-icon.png",
      "target": [{"target": "portable", "arch": ["x64"]}]
    },
    "linux": {
      "icon": "public/app-icon.png",
      "target": ["AppImage", "deb"],
      "category": "Utility"
    },
    "mac": {
      "icon": "public/app-icon.png",
      "target": ["dmg"],
      "category": "public.app-category.utilities"
    }
  },
  "devDependencies": {
    "electron": "^41.3.0",
    "electron-builder": "^26.8.1"
  }
}
EOF

git add .
git commit -m "Initial desktop app setup"
git remote add origin https://github.com/JmDemisana/maru-desktop.git
git push -u origin main
```

### 2. Build Process

The desktop app build is a two-repo process:

1. **Main repo** (`maru-website`): Builds the web assets
   ```bash
   npm run build:desktop-web
   ```
   This outputs to `desktop-web-dist/`

2. **Desktop repo** (`maru-desktop`): Packages with Electron
   - Copy `desktop-web-dist/` from main repo to desktop repo
   - Run electron-builder to create platform-specific builds

### 3. GitHub Actions Workflow

The workflow in `.github/workflows/build-desktop.yml` automatically:
- Triggers on git tags (e.g., `v0.0.1`)
- Builds for Windows, Linux, and macOS in parallel
- Creates a GitHub Release with all artifacts

To trigger a build:
```bash
git tag v0.0.1
git push origin v0.0.1
```

### 4. Download URLs

The website's `src/pages/DesktopApp.tsx` points to:
```
https://github.com/JmDemisana/maru-desktop/releases/latest/download/
```

Expected artifact names:
- `Maru-Desktop-win-x64.exe`
- `Maru-Desktop-linux-x64.AppImage`
- `Maru-Desktop-linux-x64.deb`
- `Maru-Desktop-macos-x64.dmg`
- `Maru-Desktop-macos-arm64.dmg`

## Mobile App Setup (maru-mobile)

### 1. Initialize the Repository

```bash
# Create a new folder for the mobile repo
mkdir maru-mobile
cd maru-mobile
git init

# Copy these files from the main repo:
# - helper-web/
# - vite.helper.config.ts
# - android/
# - .github/workflows/build-mobile.yml (create this)
# - package.json (modified version below)

# Create a minimal package.json
cat > package.json << 'EOF'
{
  "name": "maru-mobile",
  "version": "1.5.42",
  "description": "Maru Link Service - Android helper app",
  "scripts": {
    "build:helper": "echo 'Build from main repo'",
    "android:sync": "echo 'Sync from main repo'",
    "android:app:debug": "./android/gradlew :app:assembleDebug",
    "android:tv:debug": "./android/gradlew :tvapp:assembleDebug"
  }
}
EOF

git add .
git commit -m "Initial mobile app setup"
git remote add origin https://github.com/JmDemisana/maru-mobile.git
git push -u origin main
```

### 2. Build Process

The mobile app build is also a two-repo process:

1. **Main repo** (`maru-website`): Builds the helper web assets
   ```bash
   npm run build:helper
   ```
   This outputs to `helper-dist/`

2. **Mobile repo** (`maru-mobile`): Builds the Android APK
   ```bash
   # Copy helper-dist/ from main repo
   # Sync with Capacitor
   npx cap sync android
   # Build APK
   ./android/gradlew :app:assembleDebug
   ```

### 3. GitHub Actions Workflow

Create `.github/workflows/build-mobile.yml`:

```yaml
name: Build Mobile App

on:
  workflow_dispatch:
  push:
    tags:
      - 'v*'

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Build Debug APK
        run: ./android/gradlew :app:assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: helper-apk
          path: android/app/build/outputs/apk/debug/*.apk
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ github.ref_name }}
          name: Maru Link Service ${{ github.ref_name }}
          files: android/app/build/outputs/apk/debug/*.apk
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Website Integration (maru-website)

The main website already has download buttons pointing to the correct GitHub Releases URLs:

- **Desktop App**: `/desktop-app` page → `github.com/JmDemisana/maru-desktop/releases`
- **Mobile App**: `/mobile-app` page → `public/downloads/` (or update to GitHub Releases)

### Update Mobile App Download URL

To point the mobile app downloads to GitHub Releases instead of local files, update `src/utils/helperApp.ts`:

```typescript
const MOBILE_RELEASES_URL = "https://github.com/JmDemisana/maru-mobile/releases/latest/download";

export function getHelperApkDownloadPath(variant: HelperApkVariant = "regular") {
  if (variant === "karaoke") {
    return `${MOBILE_RELEASES_URL}/maru-helper-karaoke.apk`;
  }
  return `${MOBILE_RELEASES_URL}/maru-helper-debug.apk`;
}
```

## Summary

1. **maru-website**: Main website + builds web assets
2. **maru-desktop**: Desktop Electron app (Windows/Linux/macOS)
3. **maru-mobile**: Android helper app (APK)

All apps are built via GitHub Actions and distributed through GitHub Releases. The website links to these releases for downloads.