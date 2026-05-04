import { app, BrowserWindow, ipcMain, session } from "electron";
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "desktop-web-dist");
const runtimeLogPath = path.join(projectRoot, ".tmp", "desktop-runtime.log");
const defaultRoute = "/__desktop/shell";
const RENDER_BACKEND_ORIGIN = "https://maru-website.onrender.com";

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
    id: "schededit",
    name: "SchedEdit",
    route: "/desktop-shell.html?applet=schededit",
    kicker: "Planner",
    icon: "/icons/applet-schededit.svg",
    description: "Weekly class planner with shared account handoff.",
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
    route: "/marucast",
    kicker: "Streaming",
    icon: "/icons/applet-marucast.svg",
    description: "Open the Marucast receiver",
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
      </div>
    </div>
    <script>
      const desktop = window.maruDesktop;
      const updater = desktop?.updater;
      const appletCards = Array.from(document.querySelectorAll(".desktop-applet-card"));
      const frame = document.getElementById("desktop-frame");
      const home = document.getElementById("desktop-home");
      const appletStage = document.getElementById("desktop-applet-stage");
      const backButton = document.getElementById("desktop-back");
      const title = document.getElementById("desktop-title");
      const subtitle = document.getElementById("desktop-subtitle");

      const updateBanner = document.getElementById("update-banner");
      const updateBannerText = document.getElementById("update-banner-text");
      const updateActionBtn = document.getElementById("update-action-btn");

      let updateState = "idle";

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
          title.textContent = nextCard.querySelector(".folder-name")?.textContent || "Applet";
        }
        if (subtitle) {
          subtitle.textContent = nextCard.querySelector(".desktop-applet-kicker")?.textContent || "Applet";
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

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function proxyDesktopAuthRequest(request, response, requestPath) {
  const body = await readRequestBody(request);
  const targetUrl = `${RENDER_BACKEND_ORIGIN}${requestPath}`;
  const upstream = await fetch(targetUrl, {
    method: request.method || "POST",
    headers: {
      "Content-Type": request.headers["content-type"] || "application/json",
    },
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : body,
  });
  const upstreamBody = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, {
    "Cache-Control": "no-store",
    "Content-Type":
      upstream.headers.get("content-type") || "application/json; charset=utf-8",
  });
  response.end(upstreamBody);
}

async function proxyDesktopRenderHealth(response) {
  const upstream = await fetch(`${RENDER_BACKEND_ORIGIN}/healthz`, {
    method: "GET",
    headers: {
      Accept: "application/json,text/plain,*/*",
    },
  });
  const upstreamBody = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, {
    "Cache-Control": "no-store",
    "Content-Type":
      upstream.headers.get("content-type") || "application/json; charset=utf-8",
  });
  response.end(upstreamBody);
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

      if (requestPath.startsWith("/api/auth")) {
        await proxyDesktopAuthRequest(request, response, requestPath);
        return;
      }

      if (requestPath === "/healthz") {
        await proxyDesktopRenderHealth(response);
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

function isPrivateNetworkHostname(hostname) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const [a, b] = normalized.split(".").map((part) => Number.parseInt(part, 10));
    if (a === 10 || a === 127 || a === 0) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
  }

  return normalized.startsWith("[fd") || normalized.startsWith("[fe80:");
}

function isAllowedDesktopRequest(targetUrl) {
  return (
    targetUrl.protocol === "data:" ||
    targetUrl.protocol === "blob:" ||
    targetUrl.protocol === "about:" ||
    isLocalAppUrl(targetUrl) ||
    ((targetUrl.protocol === "http:" || targetUrl.protocol === "https:") &&
      isPrivateNetworkHostname(targetUrl.hostname))
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

let mainWindowInstance = null;

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
    }
  });

  if (!isPortableBuild()) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 3000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  activeServer?.close();
});
