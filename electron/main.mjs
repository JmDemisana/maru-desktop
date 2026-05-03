import { app, BrowserWindow, ipcMain, session } from "electron";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multicastDns from "multicast-dns";
import electronUpdater from "electron-updater";
import QRCode from "qrcode";
const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "desktop-web-dist");
const runtimeLogPath = path.join(projectRoot, ".tmp", "desktop-runtime.log");
const defaultRoute = "/__desktop/shell";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const DESKTOP_APPLETS = [
  {
    id: "photo-serve",
    name: "PhotoServe",
    route: "/desktop-shell.html?applet=photo-serve",
    kicker: "Workstation",
    icon: "/icons/applet-photo-serve.svg",
    description: "4R photo crop, layout, export, and print.",
  },
  {
    id: "cup-cupper-cuppers",
    name: "Cup-Cupper-Cuppers",
    route: "/desktop-shell.html?applet=cup-cupper-cuppers",
    kicker: "Game",
    icon: "/icons/applet-cup-cupper-cuppers.svg",
    description: "Shuffled-cup duel.",
  },
  {
    id: "dael-single",
    name: "Dael or No Dael",
    route: "/desktop-shell.html?applet=dael-single",
    kicker: "Game",
    icon: "/icons/applet-dael.svg",
    description: "Single-player deal game.",
  },
  {
    id: "tup-grade-solver",
    name: "TUP Grade Solver",
    route: "/desktop-shell.html?applet=tup-grade-solver",
    kicker: "Utility",
    icon: "/icons/applet-tup-grade.svg",
    description: "Grade solver and PNG export.",
  },
  {
    id: "options",
    name: "Options",
    route: "/desktop-shell.html?applet=options",
    kicker: "Settings",
    icon: "/icons/mouse.png",
    description: "Themes, language, and desktop behavior.",
  },
  {
    id: "marucast-receiver",
    name: "Marucast Receiver",
    route: "/desktop-shell.html?applet=marucast-receiver",
    kicker: "Streaming",
    icon: "/icons/applet-marucast.svg",
    description: "Receive Marucast audio from devices on your network.",
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDesktopShellHtml() {
  const appletCards = DESKTOP_APPLETS.map(
    (applet) => `
      <button
        class="desktop-applet-card folder-card"
        data-applet-id="${escapeHtml(applet.id)}"
        data-route="${escapeHtml(applet.route)}"
        type="button"
      >
        <span class="folder-icon desktop-folder-icon" aria-hidden="true">
          <img
            src="${escapeHtml(applet.icon)}"
            alt=""
            class="folder-icon-main"
            decoding="async"
          />
        </span>
        <span class="desktop-applet-kicker">${escapeHtml(applet.kicker)}</span>
        <div class="folder-name">${escapeHtml(applet.name)}</div>
        <p class="folder-warning desktop-applet-copy">${escapeHtml(applet.description)}</p>
        <div class="folder-actions">
          <span class="desktop-applet-open">Open Applet</span>
        </div>
      </button>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>Maru Desktop</title>
    <style>
      :root {
        color-scheme: dark;
        --desktop-topbar-height: 42px;
        --desktop-border: rgba(255, 255, 255, 0.08);
        --desktop-surface: #0f141c;
        --desktop-surface-soft: rgba(20, 28, 40, 0.92);
        --desktop-text: #f2f6ff;
        --desktop-muted: rgba(242, 246, 255, 0.72);
        --desktop-hover: rgba(255, 255, 255, 0.12);
        --desktop-danger: #d85b67;
        --desktop-danger-hover: #ef6c78;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--desktop-surface);
        color: var(--desktop-text);
        font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      }

      body {
        border: 1px solid var(--desktop-border);
      }

      body[data-visual-style="amoled"] {
        --desktop-surface: #000;
        --desktop-surface-soft: rgba(0, 0, 0, 0.96);
        --desktop-border: rgba(255, 255, 255, 0.1);
        --desktop-text: rgba(244, 247, 255, 0.98);
        --desktop-muted: rgba(184, 194, 212, 0.78);
        --desktop-hover: rgba(255, 255, 255, 0.08);
      }

      body[data-visual-style="quiet_tide"] {
        --desktop-surface: #09111e;
        --desktop-surface-soft: rgba(9, 15, 28, 0.9);
        --desktop-border: rgba(187, 215, 255, 0.14);
        --desktop-text: rgba(240, 246, 255, 0.97);
        --desktop-muted: rgba(195, 210, 228, 0.8);
        --desktop-hover: rgba(235, 245, 255, 0.08);
      }

      body[data-visual-style="dark_corporate"] {
        --desktop-surface: #111315;
        --desktop-surface-soft: rgba(24, 25, 26, 0.96);
        --desktop-border: rgba(58, 59, 60, 1);
        --desktop-text: rgba(228, 230, 235, 0.96);
        --desktop-muted: rgba(176, 179, 184, 0.9);
        --desktop-hover: rgba(255, 255, 255, 0.08);
      }

      body[data-visual-style="urple"] {
        --desktop-surface: #1d0a31;
        --desktop-surface-soft: rgba(69, 24, 120, 0.56);
        --desktop-border: rgba(255, 202, 255, 0.22);
        --desktop-text: rgba(255, 245, 255, 0.97);
        --desktop-muted: rgba(245, 222, 255, 0.82);
        --desktop-hover: rgba(255, 214, 251, 0.1);
      }

      .desktop-shell {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: var(--desktop-topbar-height) minmax(0, 1fr);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 48%),
          var(--desktop-surface);
      }

      .desktop-titlebar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: stretch;
        background: var(--desktop-surface-soft);
        border-bottom: 1px solid var(--desktop-border);
        -webkit-app-region: drag;
        user-select: none;
      }

      .desktop-titlecopy {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 14px;
      }

      .desktop-nav {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 10px;
        display: inline-grid;
        place-items: center;
        background: transparent;
        color: var(--desktop-text);
        cursor: pointer;
        -webkit-app-region: no-drag;
        transition: background 120ms ease;
      }

      .desktop-nav:hover {
        background: var(--desktop-hover);
      }

      .desktop-nav[hidden] {
        display: none;
      }

      .desktop-titlecopy strong {
        font-size: 0.93rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .desktop-titlecopy span {
        font-size: 0.75rem;
        color: var(--desktop-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .desktop-controls {
        display: flex;
        align-items: stretch;
        -webkit-app-region: no-drag;
      }

      .desktop-control {
        width: 48px;
        border: 0;
        margin: 0;
        padding: 0;
        display: grid;
        place-items: center;
        background: transparent;
        color: var(--desktop-text);
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
      }

      .desktop-control:hover {
        background: var(--desktop-hover);
      }

      .desktop-control.close:hover {
        background: var(--desktop-danger-hover);
      }

      .desktop-control svg {
        width: 12px;
        height: 12px;
        stroke: currentColor;
        stroke-width: 1.8;
        fill: none;
        vector-effect: non-scaling-stroke;
      }

      .desktop-frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #0f141c;
      }

      .desktop-body {
        min-height: 0;
        position: relative;
      }

      .desktop-home,
      .desktop-applet-stage {
        position: absolute;
        inset: 0;
        min-height: 0;
      }

      .desktop-home {
        padding: 22px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 18px;
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.03), transparent 42%),
          var(--desktop-surface);
      }

      .desktop-home-copy {
        display: grid;
        gap: 6px;
      }

      .desktop-home-copy h1 {
        margin: 0;
        font-size: 1.55rem;
      }

      .desktop-home-copy p {
        margin: 0;
        color: var(--desktop-muted);
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .update-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 10px;
        background: rgba(98, 148, 228, 0.15);
        border: 1px solid rgba(98, 148, 228, 0.3);
        font-size: 0.82rem;
        margin-top: 8px;
      }

      .update-banner.is-ready {
        background: rgba(98, 228, 132, 0.15);
        border-color: rgba(98, 228, 132, 0.3);
      }

      .update-banner.is-error {
        background: rgba(216, 91, 103, 0.12);
        border-color: rgba(216, 91, 103, 0.3);
      }

      .update-banner[hidden] {
        display: none;
      }

      #update-action-btn {
        padding: 4px 12px;
        border: 0;
        border-radius: 8px;
        background: rgba(98, 148, 228, 0.3);
        color: var(--desktop-text);
        font-size: 0.8rem;
        cursor: pointer;
        margin-left: auto;
      }

      #update-action-btn:hover {
        background: rgba(98, 148, 228, 0.5);
      }

      .desktop-applet-list {
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 260px));
        align-content: start;
        gap: 18px;
        overflow: auto;
        padding: 40px 6px 6px;
      }

      .desktop-applet-card {
        text-align: left;
        width: 260px;
        height: 300px;
        position: relative;
        border: 1px solid var(--desktop-border);
        border-radius: 16px;
        background: rgba(6, 13, 26, 0.82);
        color: var(--desktop-text);
        padding: 5.5rem 1.6rem 1.6rem;
        display: grid;
        gap: 0.4rem;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
      }

      .desktop-applet-card:hover {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 0 0 1px rgba(120, 140, 255, 0.24),
          0 12px 30px rgba(0, 0, 0, 0.65),
          0 0 22px rgba(120, 140, 255, 0.18);
      }

      .desktop-applet-card.active {
        border-color: rgba(120, 176, 255, 0.55);
        background: rgba(98, 148, 228, 0.14);
      }

      .desktop-applet-kicker {
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(160, 199, 255, 0.78);
        justify-self: center;
      }

      .desktop-folder-icon {
        width: 86px;
        height: 86px;
        position: absolute;
        top: -34px;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 16px;
        padding: 10px;
        background: rgba(5, 8, 16, 0.82);
        border: 1px solid var(--desktop-border);
        box-shadow:
          0 12px 30px rgba(0, 0, 0, 0.65),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }

      .desktop-folder-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .folder-name {
        margin-top: 0.6rem;
        margin-bottom: 0.25rem;
        font-size: 1.35rem;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .desktop-applet-copy {
        margin: 0;
        color: var(--desktop-muted);
        font-size: 0.84rem;
        line-height: 1.52;
        text-align: center;
      }

      .folder-actions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: auto;
      }

      .desktop-applet-open {
        display: block;
        width: 100%;
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--desktop-text);
        font-size: 0.82rem;
        text-align: center;
      }

      .desktop-applet-stage {
        display: none;
      }

      .desktop-applet-stage.is-visible {
        display: block;
      }

      .desktop-home.is-hidden {
        display: none;
      }

      .desktop-receiver-stage {
        display: none;
        overflow: auto;
        padding: 22px;
      }

      .desktop-receiver-stage.is-visible {
        display: block;
      }

      .receiver-panel {
        max-width: 520px;
        margin: 0 auto;
        display: grid;
        gap: 18px;
      }

      .receiver-header h2 {
        margin: 0 0 4px;
        font-size: 1.4rem;
      }

      .receiver-header p {
        margin: 0;
        color: var(--desktop-muted);
        font-size: 0.85rem;
      }

      .receiver-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .receiver-qr {
        text-align: center;
        padding: 16px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        margin-bottom: 12px;
      }

      .receiver-qr p {
        margin: 0 0 12px;
        color: var(--desktop-muted);
        font-size: 0.85rem;
      }

      .receiver-qr img {
        border-radius: 8px;
        max-width: 180px;
      }

      .receiver-btn {
        padding: 10px 16px;
        border: 1px solid var(--desktop-border);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--desktop-text);
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 120ms ease;
      }

      .receiver-btn:hover {
        background: var(--desktop-hover);
      }

      .receiver-btn-primary {
        background: rgba(98, 148, 228, 0.2);
        border-color: rgba(98, 148, 228, 0.4);
      }

      .receiver-btn-primary:hover {
        background: rgba(98, 148, 228, 0.35);
      }

      .receiver-btn-danger {
        background: rgba(216, 91, 103, 0.15);
        border-color: rgba(216, 91, 103, 0.35);
      }

      .receiver-btn-danger:hover {
        background: rgba(216, 91, 103, 0.3);
      }

      .receiver-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .receiver-volume {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
      }

      .receiver-volume label {
        font-size: 0.85rem;
        color: var(--desktop-muted);
      }

      .receiver-volume input[type="range"] {
        width: 100%;
        accent-color: #6294e4;
      }

      .receiver-volume span {
        font-size: 0.85rem;
        min-width: 36px;
        text-align: right;
      }

      .receiver-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
      }

      .receiver-status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--desktop-muted);
      }

      .receiver-status-dot.is-discovering {
        background: #e4a862;
        animation: pulse-dot 1s ease-in-out infinite;
      }

      .receiver-status-dot.is-connected {
        background: #62e484;
      }

      .receiver-status-dot.is-error {
        background: #d85b67;
      }

      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .receiver-error {
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(216, 91, 103, 0.12);
        border: 1px solid rgba(216, 91, 103, 0.3);
        color: #ef6c78;
        font-size: 0.85rem;
      }

      .receiver-senders {
        display: grid;
        gap: 8px;
      }

      .receiver-sender-card {
        padding: 12px 14px;
        border: 1px solid var(--desktop-border);
        border-radius: 10px;
        background: rgba(6, 13, 26, 0.6);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }

      .receiver-sender-card:hover {
        background: var(--desktop-hover);
        border-color: rgba(120, 140, 255, 0.3);
      }

      .receiver-sender-card .sender-name {
        font-weight: 600;
        font-size: 0.95rem;
      }

      .receiver-sender-card .sender-host {
        font-size: 0.8rem;
        color: var(--desktop-muted);
      }

      .receiver-sender-card .sender-code {
        font-size: 0.75rem;
        color: rgba(160, 199, 255, 0.7);
        margin-top: 2px;
      }
    </style>
  </head>
  <body>
    <div class="desktop-shell">
      <header class="desktop-titlebar">
        <div class="desktop-titlecopy">
          <button class="desktop-nav" id="desktop-back" aria-label="Back" hidden>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5l-4 3.5 4 3.5M4 6h4.5" /></svg>
          </button>
          <strong id="desktop-title">Maru Desktop</strong>
          <span id="desktop-subtitle">Applets</span>
        </div>
        <div class="desktop-controls">
          <button class="desktop-control" id="desktop-minimize" aria-label="Minimize">
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg>
          </button>
          <button class="desktop-control" id="desktop-maximize" aria-label="Maximize">
            <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" /></svg>
          </button>
          <button class="desktop-control close" id="desktop-close" aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
          </button>
        </div>
      </header>
      <div class="desktop-body">
        <section class="desktop-home" id="desktop-home">
          <div class="desktop-home-copy">
            <h1>Applets</h1>
            <p>Choose a tool to open it.</p>
            <div id="update-banner" class="update-banner" hidden>
              <span id="update-banner-text"></span>
              <button id="update-action-btn" type="button" hidden>Update</button>
            </div>
          </div>
          <div class="desktop-applet-list">
            ${appletCards}
          </div>
        </section>
        <section class="desktop-applet-stage" id="desktop-applet-stage">
          <iframe
            class="desktop-frame"
            id="desktop-frame"
            src="about:blank"
            title="Maru Desktop App"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </section>
        <section class="desktop-applet-stage" id="desktop-receiver-stage">
          <div class="receiver-panel">
            <div class="receiver-header">
              <h2>Marucast Receiver</h2>
              <p>Discover and connect to Marucast senders on your network.</p>
            </div>
            <div class="receiver-qr" id="receiver-qr" hidden>
              <p>Scan with Maru Link app:</p>
              <img id="receiver-qr-image" alt="QR code" />
            </div>
            <div class="receiver-controls">
              <button class="receiver-btn receiver-btn-primary" id="receiver-discover" type="button">
                Discover Senders
              </button>
              <button class="receiver-btn" id="receiver-stop-discover" type="button" hidden>
                Stop Discovery
              </button>
              <button class="receiver-btn receiver-btn-danger" id="receiver-disconnect" type="button" hidden>
                Disconnect
              </button>
            </div>
            <div class="receiver-volume" id="receiver-volume-group" hidden>
              <label for="receiver-volume">Volume</label>
              <input type="range" id="receiver-volume" min="0" max="100" value="100" />
              <span id="receiver-volume-label">100%</span>
            </div>
            <div class="receiver-status" id="receiver-status">
              <span class="receiver-status-dot" id="receiver-status-dot"></span>
              <span id="receiver-status-text">Ready</span>
            </div>
            <div class="receiver-error" id="receiver-error" hidden></div>
            <div class="receiver-senders" id="receiver-senders"></div>
          </div>
        </section>
      </div>
    </div>
    <script>
      const desktop = window.maruDesktop;
      const receiver = window.marucast;
      const updater = desktop?.updater;
      const appletCards = Array.from(document.querySelectorAll(".desktop-applet-card"));
      const frame = document.getElementById("desktop-frame");
      const home = document.getElementById("desktop-home");
      const appletStage = document.getElementById("desktop-applet-stage");
      const receiverStage = document.getElementById("desktop-receiver-stage");
      const backButton = document.getElementById("desktop-back");
      const title = document.getElementById("desktop-title");
      const subtitle = document.getElementById("desktop-subtitle");

      const discoverBtn = document.getElementById("receiver-discover");
      const stopDiscoverBtn = document.getElementById("receiver-stop-discover");
      const disconnectBtn = document.getElementById("receiver-disconnect");
      const volumeGroup = document.getElementById("receiver-volume-group");
      const volumeSlider = document.getElementById("receiver-volume");
      const volumeLabel = document.getElementById("receiver-volume-label");
      const statusDot = document.getElementById("receiver-status-dot");
      const statusText = document.getElementById("receiver-status-text");
      const errorEl = document.getElementById("receiver-error");
      const sendersEl = document.getElementById("receiver-senders");

      const updateBanner = document.getElementById("update-banner");
      const updateBannerText = document.getElementById("update-banner-text");
      const updateActionBtn = document.getElementById("update-action-btn");

      let updateState = "idle";

      let receiverAudioCtx = null;
      let receiverScriptNode = null;
      let pcmQueue = [];

      function initReceiverAudio() {
        if (receiverAudioCtx) return;
        try {
          receiverAudioCtx = new AudioContext({ sampleRate: 48000 });
          receiverScriptNode = receiverAudioCtx.createScriptProcessor(8192, 0, 2);
          receiverScriptNode.onaudioprocess = (e) => {
            const left = e.outputBuffer.getChannelData(0);
            const right = e.outputBuffer.getChannelData(1);
            while (pcmQueue.length > 0 && left.length > 0) {
              const chunk = pcmQueue.shift();
              const count = Math.min(chunk.length / 2, left.length);
              for (let i = 0; i < count; i++) {
                left[i] = chunk[i * 2] / 32768;
                right[i] = chunk[i * 2 + 1] / 32768;
              }
              if (count * 2 < chunk.length) {
                pcmQueue.unshift(chunk.slice(count * 2));
              }
            }
          };
          receiverScriptNode.connect(receiverAudioCtx.destination);
        } catch (err) {
          console.error("[marucast] audio init failed", err);
        }
      }

      function pushPcmChunk(chunk) {
        pcmQueue.push(chunk);
        if (pcmQueue.length > 50) {
          pcmQueue = pcmQueue.slice(-30);
        }
      }

      window.addEventListener("message", (event) => {
        if (event.data?.type === "marucast:pcm" && event.data?.chunk) {
          pushPcmChunk(new Int16Array(event.data.chunk));
        }
      });

      if (receiver) {
        receiver.onPcm((chunk) => {
          if (receiverAudioCtx?.state === "suspended") {
            receiverAudioCtx.resume();
          }
          pushPcmChunk(new Int16Array(chunk));
        });

        receiver.onSenders((senders) => {
          renderSenders(senders);
        });

        receiver.onStatus((status) => {
          applyReceiverStatus(status);
        });
      }

      function renderSenders(senders) {
        if (!senders || !senders.length) {
          sendersEl.innerHTML = '<p class="receiver-empty">No senders found on this network.</p>';
          return;
        }
        sendersEl.innerHTML = senders.map((s) =>
          '<div class="receiver-sender-card" data-host="' + escapeHtmlClient(s.host) + '" data-port="' + s.port + '" data-name="' + escapeHtmlClient(s.name) + '" data-code="' + escapeHtmlClient(s.code || "") + '">' +
          '<div class="sender-name">' + escapeHtmlClient(s.title || s.name) + '</div>' +
          '<div class="sender-host">' + escapeHtmlClient(s.host) + ':' + s.port + '</div>' +
          (s.code ? '<div class="sender-code">Code: ' + escapeHtmlClient(s.code) + '</div>' : '') +
          '</div>'
        ).join("");
        sendersEl.querySelectorAll(".receiver-sender-card").forEach((card) => {
          card.addEventListener("click", () => {
            const host = card.dataset.host;
            const port = parseInt(card.dataset.port, 10);
            const name = card.dataset.name;
            const code = card.dataset.code;
            receiver?.connect(host, port, name, code);
            initReceiverAudio();
          });
        });
      }

      function applyReceiverStatus(status) {
        if (!status) return;
        statusDot.classList.remove("is-discovering", "is-connected", "is-error");
        if (status.connected) {
          statusDot.classList.add("is-connected");
          statusText.textContent = "Connected to " + status.senderName;
          disconnectBtn.hidden = false;
          volumeGroup.hidden = false;
          discoverBtn.hidden = true;
          stopDiscoverBtn.hidden = true;
        } else if (status.discovering) {
          statusDot.classList.add("is-discovering");
          statusText.textContent = "Discovering senders...";
          discoverBtn.hidden = true;
          stopDiscoverBtn.hidden = false;
          disconnectBtn.hidden = true;
          volumeGroup.hidden = true;
        } else if (status.lastError) {
          statusDot.classList.add("is-error");
          statusText.textContent = "Disconnected";
          discoverBtn.hidden = false;
          stopDiscoverBtn.hidden = true;
          disconnectBtn.hidden = true;
          volumeGroup.hidden = true;
          errorEl.textContent = status.lastError;
          errorEl.hidden = false;
        } else {
          statusText.textContent = "Ready";
          discoverBtn.hidden = false;
          stopDiscoverBtn.hidden = true;
          disconnectBtn.hidden = true;
          volumeGroup.hidden = true;
          errorEl.hidden = true;
        }
      }

      discoverBtn?.addEventListener("click", () => {
        errorEl.hidden = true;
        const siteOrigin = window.location.origin;
        window.marucast?.getQr("", siteOrigin).then((result) => {
          if (result?.ok && result?.dataUrl) {
            const qrEl = document.getElementById("receiver-qr");
            const qrImage = document.getElementById("receiver-qr-image");
            if (qrEl && qrImage) { qrEl.hidden = false; qrImage.src = result.dataUrl; }
          }
        });
        receiver?.startDiscovery();
      });

      stopDiscoverBtn?.addEventListener("click", () => {
        receiver?.stopDiscovery();
      });

      disconnectBtn?.addEventListener("click", () => {
        receiver?.disconnect();
        pcmQueue = [];
      });

      volumeSlider?.addEventListener("input", () => {
        const vol = parseInt(volumeSlider.value, 10) / 100;
        volumeLabel.textContent = volumeSlider.value + "%";
        receiver?.setVolume(vol);
      });

      function applyUpdateStatus(status) {
        if (!status || !updateBanner) return;
        updateState = status.stage;
        updateBanner.classList.remove("is-ready", "is-error");
        updateActionBtn.hidden = true;

        switch (status.stage) {
          case "checking":
            updateBanner.hidden = false;
            updateBannerText.textContent = "Checking for updates...";
            break;
          case "available":
            updateBanner.hidden = false;
            updateBannerText.textContent = "Version " + (status.version || "") + " available.";
            updateActionBtn.hidden = false;
            updateActionBtn.textContent = "Download";
            break;
          case "downloading":
            updateBanner.hidden = false;
            updateBannerText.textContent = "Downloading... " + (status.percent || 0) + "%";
            break;
          case "ready":
            updateBanner.hidden = false;
            updateBanner.classList.add("is-ready");
            updateBannerText.textContent = "Update ready. Restarting...";
            break;
          case "up-to-date":
            updateBanner.hidden = true;
            break;
          case "error":
            updateBanner.hidden = false;
            updateBanner.classList.add("is-error");
            updateBannerText.textContent = status.message || "Update check failed.";
            break;
          default:
            updateBanner.hidden = true;
        }
      }

      updateActionBtn?.addEventListener("click", () => {
        if (updateState === "available") {
          updater?.download();
        }
      });

      updater?.onStatus(applyUpdateStatus);

      updater?.isSupported().then((supported) => {
        if (!supported) {
          console.log("[maru-desktop] Updates not supported (portable build).");
        }
      }).catch(() => {});

      function applyStoredDesktopAppearance() {
        try {
          const raw = window.localStorage.getItem("app-options");
          const parsed = raw ? JSON.parse(raw) : null;
          const visualStyle = parsed?.visualStyle;
          const disableCardHoverNudge = parsed?.disableCardHoverNudge === true;
          const randomStyles = ["it_started_here", "quiet_tide", "amoled", "dark_corporate", "urple"];
          const appliedStyle =
            visualStyle === "random_refresh"
              ? randomStyles[Math.floor(Math.random() * randomStyles.length)]
              : visualStyle;

          if (appliedStyle && appliedStyle !== "it_started_here") {
            document.body.dataset.visualStyle = appliedStyle;
          } else {
            delete document.body.dataset.visualStyle;
          }

          document.body.classList.toggle("card-hover-nudge-disabled", disableCardHoverNudge);
        } catch {
          delete document.body.dataset.visualStyle;
          document.body.classList.remove("card-hover-nudge-disabled");
        }
      }

      function setActiveCard(nextCard) {
        appletCards.forEach((card) => {
          card.classList.toggle("active", card === nextCard);
        });
      }

      function showHome() {
        activeAppletId = null;
        setActiveCard(null);
        if (home) {
          home.classList.remove("is-hidden");
        }
        if (appletStage) {
          appletStage.classList.remove("is-visible");
        }
        if (receiverStage) {
          receiverStage.classList.remove("is-visible");
        }
        if (backButton) {
          backButton.hidden = true;
        }
        if (title) {
          title.textContent = "Maru Desktop";
        }
        if (subtitle) {
          subtitle.textContent = "Applets";
        }
        if (frame) {
          frame.src = "about:blank";
        }
      }

      function openApplet(nextCard) {
        if (!nextCard) return;

        activeAppletId = nextCard.dataset.appletId || null;
        setActiveCard(nextCard);
        if (home) {
          home.classList.add("is-hidden");
        }
        if (backButton) {
          backButton.hidden = false;
        }
        if (title) {
          title.textContent = nextCard.querySelector("strong")?.textContent || "Applet";
        }
        if (subtitle) {
          subtitle.textContent = nextCard.querySelector(".desktop-applet-kicker")?.textContent || "Applet";
        }

        if (activeAppletId === "marucast-receiver") {
          if (appletStage) {
            appletStage.classList.remove("is-visible");
          }
          if (receiverStage) {
            receiverStage.classList.add("is-visible");
          }
          receiver?.getStatus().then(applyReceiverStatus).catch(() => {});
          return;
        }

        if (receiverStage) {
          receiverStage.classList.remove("is-visible");
        }
        if (appletStage && frame) {
          appletStage.classList.add("is-visible");
          frame.src = nextCard.dataset.route || "/";
        }
      }

      appletCards.forEach((card) => {
        card.addEventListener("click", () => {
          openApplet(card);
        });
      });

      backButton?.addEventListener("click", () => {
        showHome();
      });

      document.getElementById("desktop-minimize")?.addEventListener("click", () => {
        console.log("[maru-desktop] minimize");
        void desktop?.windowControls?.minimize?.();
      });
      document.getElementById("desktop-maximize")?.addEventListener("click", () => {
        console.log("[maru-desktop] toggle-maximize");
        void desktop?.windowControls?.toggleMaximize?.();
      });
      document.getElementById("desktop-close")?.addEventListener("click", () => {
        console.log("[maru-desktop] close");
        void desktop?.windowControls?.close?.();
      });

      function escapeHtmlClient(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      window.addEventListener("app-options-change", applyStoredDesktopAppearance);
      applyStoredDesktopAppearance();
      showHome();
    </script>
  </body>
</html>`;
}

function isSafeRelativePath(relativePath) {
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

async function readBundledFile(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split("?")[0] || "/");
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const relativePath = normalizedPath.replace(/^\/+/, "");
  const candidatePath = path.resolve(distRoot, relativePath);
  const relativeCandidatePath = path.relative(distRoot, candidatePath);

  if (isSafeRelativePath(relativeCandidatePath)) {
    try {
      const stats = await fs.stat(candidatePath);
      if (stats.isFile()) {
        return {
          filePath: candidatePath,
          buffer: await fs.readFile(candidatePath),
        };
      }
    } catch {
      // Fall through to the app shell below.
    }
  }

  const indexPath = path.join(distRoot, "index.html");
  return {
    filePath: indexPath,
    buffer: await fs.readFile(indexPath),
  };
}

function buildDesktopApiResponse(requestPath) {
  const payload = JSON.stringify({
    error: "This feature is not available in the desktop app right now.",
    route: requestPath,
  });

  return {
    body: Buffer.from(payload, "utf8"),
    contentType: "application/json; charset=utf-8",
    statusCode: 503,
  };
}

async function writeRuntimeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    await fs.mkdir(path.dirname(runtimeLogPath), { recursive: true });
    await fs.appendFile(runtimeLogPath, line, "utf8");
  } catch {
    // Ignore local log write failures.
  }
}

async function startLocalServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = request.url || "/";

      if (requestPath === "/__desktop/shell") {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        });
        response.end(getDesktopShellHtml());
        return;
      }

      if (requestPath.startsWith("/api/")) {
        const desktopResponse = buildDesktopApiResponse(requestPath);
        response.writeHead(desktopResponse.statusCode, {
          "Cache-Control": "no-store",
          "Content-Type": desktopResponse.contentType,
        });
        response.end(desktopResponse.body);
        return;
      }

      const { filePath, buffer } = await readBundledFile(requestPath);
      const extension = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[extension] || "application/octet-stream";

      response.writeHead(200, {
        "Cache-Control":
          extension === ".html"
            ? "no-cache"
            : "public, max-age=31536000, immutable",
        "Content-Type": contentType,
      });
      response.end(buffer);
    } catch (error) {
      response.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(
        error instanceof Error
          ? `Maru Desktop could not load its bundled files.\n${error.message}`
          : "Maru Desktop could not load its bundled files.",
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(undefined);
    });
  });

  return server;
}

function isLocalAppUrl(targetUrl) {
  return (
    targetUrl.protocol === "http:" &&
    (targetUrl.hostname === "127.0.0.1" || targetUrl.hostname === "localhost")
  );
}

function isAllowedDesktopRequest(targetUrl) {
  return (
    targetUrl.protocol === "data:" ||
    targetUrl.protocol === "blob:" ||
    targetUrl.protocol === "about:" ||
    isLocalAppUrl(targetUrl)
  );
}

function lockSessionToLocalOnly() {
  const activeSession = session.defaultSession;

  activeSession.webRequest.onBeforeRequest((details, callback) => {
    try {
      const targetUrl = new URL(details.url);
      callback({ cancel: !isAllowedDesktopRequest(targetUrl) });
      return;
    } catch {
      callback({ cancel: true });
    }
  });

  activeSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function createMainWindow(serverPort) {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    resizable: true,
    backgroundColor: "#0f141c",
    title: "Maru Desktop",
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    void writeRuntimeLog(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(
      `[maru-desktop] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`,
    );
    void writeRuntimeLog(
      `[maru-desktop] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`,
    );
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[maru-desktop] render-process-gone", details);
    void writeRuntimeLog(`[maru-desktop] render-process-gone ${JSON.stringify(details)}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: "#ffffff",
        },
      };
    }

    try {
      const parsed = new URL(url);
      if (isAllowedDesktopRequest(parsed)) {
        return { action: "allow" };
      }
    } catch {
      // Fall through to deny below.
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      if (isAllowedDesktopRequest(parsed)) {
        return;
      }
    } catch {
      // Treat malformed URLs as blocked external navigations.
    }

    event.preventDefault();
  });

  void mainWindow.loadURL(`http://127.0.0.1:${serverPort}${defaultRoute}`);
  mainWindowInstance = mainWindow;
  return mainWindow;
}

let activeServer = null;

ipcMain.handle("maru-desktop:get-environment", () => ({
  isDesktopApp: true,
  platform: process.platform,
}));

ipcMain.handle("maru-desktop:open-external", async (_event, targetUrl) => {
  if (typeof targetUrl !== "string" || !targetUrl.trim()) {
    return { ok: false };
  }

  return { ok: false };
});

const SERVICE_TYPE = "_marucast._tcp.local.";
const SAMPLE_RATE = 48000;
const READ_CHUNK_SIZE = 8192;

let mainWindowInstance = null;
let marucastReceiver = null;

class MarucastReceiver {
  constructor() {
    this.mdns = null;
    this.discovering = false;
    this.senders = [];
    this.connected = false;
    this.senderName = "";
    this.senderHost = "";
    this.senderPort = 0;
    this.pairingCode = "";
    this.volume = 1.0;
    this.lastError = "";
    this.socket = null;
    this.reading = false;
  }

  startDiscovery(window) {
    if (this.discovering) return;
    this.discovering = true;
    this.lastError = "";
    this.senders = [];

    try {
      this.mdns = multicastDns();
      this.mdns.on("response", (packet) => {
        if (!packet.answers || !packet.answers.length) return;
        for (const answer of packet.answers) {
          if (answer.type !== "SRV") continue;
          const name = answer.name.replace(`.${SERVICE_TYPE}`, "");
          const host = answer.data.target;
          const port = answer.data.port;
          if (!host || !port) continue;

          const exists = this.senders.find((s) => s.name === name);
          if (exists) continue;

          this.senders.push({
            name,
            host: host.endsWith(".local") ? host.replace(/\.local$/, "") : host,
            port,
            code: "",
            title: "",
            mode: "",
          });
        }
        if (this.senders.length) {
          this._emitSenders(window);
        }
      });

      this.mdns.query({
        questions: [{ name: SERVICE_TYPE, type: "SRV" }],
      });

      setTimeout(() => this._requery(window), 1500);
      setTimeout(() => this._requery(window), 3000);
    } catch (err) {
      this.discovering = false;
      this.lastError = "Could not start Marucast discovery.";
      this._emitStatus(window);
    }
  }

  _requery(window) {
    if (!this.discovering || !this.mdns) return;
    try {
      this.mdns.query({ questions: [{ name: SERVICE_TYPE, type: "SRV" }] });
    } catch {}
  }

  stopDiscovery() {
    this.discovering = false;
    if (this.mdns) {
      try { this.mdns.destroy(); } catch {}
      this.mdns = null;
    }
  }

  connect(window, host, port, name, code = "") {
    if (this.connected) this.disconnect();
    this.lastError = "";
    this.connected = true;
    this.senderHost = host;
    this.senderPort = port;
    this.senderName = name;
    this.pairingCode = code;
    this._emitStatus(window);

    this.socket = createConnection(port, host, () => {
      this.socket.setNoDelay(true);
      const request = `GET /live.pcm HTTP/1.1\r\nHost: ${host}:${port}\r\nAccept: application/octet-stream\r\n\r\n`;
      this.socket.write(request);
      this.reading = true;
      this._readLoop(window);
    });

    this.socket.on("error", (err) => {
      if (this.connected) {
        this.lastError = `Connection error: ${err.message}`;
        this.connected = false;
        this._emitStatus(window);
      }
    });

    this.socket.on("close", () => {
      if (this.connected) {
        this.connected = false;
        this.lastError = "Connection to sender lost.";
        this._emitStatus(window);
      }
    });
  }

  _readLoop(window) {
    if (!this.reading || !this.socket) return;
    let buffer = Buffer.alloc(0);
    let headersParsed = false;

    const onData = (chunk) => {
      if (!this.reading) {
        this.socket?.off("data", onData);
        return;
      }

      if (!headersParsed) {
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd < 0) return;
        buffer = buffer.subarray(headerEnd + 4);
        headersParsed = true;
        this.socket?.off("data", onData);
        this._streamLoop(window);
        return;
      }
    };

    this.socket.on("data", onData);
    this.socket.setTimeout(5000);
    this.socket.on("timeout", () => {
      if (this.connected) {
        this.lastError = "Connection to sender timed out.";
        this.connected = false;
        this._emitStatus(window);
        this.disconnect();
      }
    });
  }

  _streamLoop(window) {
    const streamData = (chunk) => {
      if (!this.connected) return;
      const int16 = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 2);
      window.webContents.send("marucast:pcm", Array.from(int16));
    };

    this.socket.on("data", streamData);
    this.socket.off("timeout", () => {});
    this.socket.setTimeout(0);
  }

  disconnect() {
    this.connected = false;
    this.reading = false;
    if (this.socket) {
      try { this.socket.destroy(); } catch {}
      this.socket = null;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  getSendersJson() {
    return JSON.stringify(this.senders);
  }

  _emitSenders(window) {
    if (window && !window.isDestroyed()) {
      window.webContents.send("marucast:senders", this.senders);
    }
  }

  _emitStatus(window) {
    if (window && !window.isDestroyed()) {
      window.webContents.send("marucast:status", {
        connected: this.connected,
        senderName: this.senderName,
        senderHost: this.senderHost,
        senderPort: this.senderPort,
        pairingCode: this.pairingCode,
        volume: this.volume,
        discovering: this.discovering,
        lastError: this.lastError,
      });
    }
  }
}

ipcMain.handle("maru-desktop:window-action", (event, action) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  console.log("[maru-desktop] window-action", action, Boolean(targetWindow));
  void writeRuntimeLog(
    `[maru-desktop] window-action ${action} target=${Boolean(targetWindow)}`,
  );
  if (!targetWindow) {
    return { ok: false };
  }

  if (action === "minimize") {
    targetWindow.minimize();
    return { ok: true };
  }

  if (action === "toggle-maximize") {
    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize();
    } else {
      targetWindow.maximize();
    }
    return { ok: true };
  }

  if (action === "close") {
    targetWindow.close();
    return { ok: true };
  }

  return { ok: false };
});

ipcMain.handle("marucast:start-discovery", () => {
  if (!marucastReceiver) marucastReceiver = new MarucastReceiver();
  marucastReceiver.startDiscovery(mainWindowInstance);
  return { ok: true };
});

ipcMain.handle("marucast:stop-discovery", () => {
  marucastReceiver?.stopDiscovery();
  return { ok: true };
});

ipcMain.handle("marucast:connect", (_event, host, port, name, code) => {
  if (!marucastReceiver) marucastReceiver = new MarucastReceiver();
  marucastReceiver.connect(mainWindowInstance, host, port, name, code);
  return { ok: true };
});

ipcMain.handle("marucast:disconnect", () => {
  marucastReceiver?.disconnect();
  return { ok: true };
});

ipcMain.handle("marucast:set-volume", (_event, vol) => {
  marucastReceiver?.setVolume(vol);
  return { ok: true };
});

ipcMain.handle("marucast:get-status", () => {
  if (!marucastReceiver) {
    return {
      connected: false,
      senderName: "",
      senderHost: "",
      senderPort: 0,
      pairingCode: "",
      volume: 1.0,
      discovering: false,
      lastError: "",
    };
  }
  return {
    connected: marucastReceiver.connected,
    senderName: marucastReceiver.senderName,
    senderHost: marucastReceiver.senderHost,
    senderPort: marucastReceiver.senderPort,
    pairingCode: marucastReceiver.pairingCode,
    volume: marucastReceiver.volume,
    discovering: marucastReceiver.discovering,
    lastError: marucastReceiver.lastError,
  };
});

ipcMain.handle("marucast:get-qr", async (_event, token, siteOrigin) => {
  if (!token || !siteOrigin) return { ok: false };
  const url = `maruhelper://?token=${encodeURIComponent(token)}&siteOrigin=${encodeURIComponent(siteOrigin)}&target=marucast`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
    return { ok: true, dataUrl };
  } catch { return { ok: false }; }
});

let updateSupported = true;

function isPortableBuild() {
  return process.env.PORTABLE_EXECUTABLE_DIR != null ||
    app.getAppPath().toLowerCase().includes("portable");
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("checking-for-update", () => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.webContents.send("update:status", { stage: "checking" });
  }
});

autoUpdater.on("update-available", (info) => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.webContents.send("update:status", {
      stage: "available",
      version: info.version,
    });
  }
});

autoUpdater.on("update-not-available", () => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.webContents.send("update:status", { stage: "up-to-date" });
  }
});

autoUpdater.on("error", (err) => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.webContents.send("update:status", {
      stage: "error",
      message: err.message,
    });
  }
});

autoUpdater.on("download-progress", (progress) => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.webContents.send("update:status", {
      stage: "downloading",
      percent: Math.round(progress.percent),
    });
  }
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.webContents.send("update:status", { stage: "ready" });
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 2000);
  }
});

ipcMain.handle("updater:check", () => {
  if (isPortableBuild()) {
    updateSupported = false;
    return { ok: false, portable: true };
  }
  try {
    autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle("updater:download", () => {
  try {
    autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle("updater:is-supported", () => !isPortableBuild());

app.whenReady().then(async () => {
  void writeRuntimeLog("[maru-desktop] app ready");
  lockSessionToLocalOnly();
  activeServer = await startLocalServer();
  const address = activeServer.address();
  const serverPort = typeof address === "object" && address ? address.port : 0;
  void writeRuntimeLog(`[maru-desktop] local server on ${serverPort}`);
  createMainWindow(serverPort);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
  createMainWindow(serverPort);

  if (!isPortableBuild()) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 3000);
  }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  marucastReceiver?.disconnect();
  marucastReceiver?.stopDiscovery();
  activeServer?.close();
});
