export type DesktopVisualStyle =
  | "it_started_here"
  | "quiet_tide"
  | "amoled"
  | "dark_corporate"
  | "urple"
  | "random_refresh";

export type AppliedDesktopVisualStyle = Exclude<
  DesktopVisualStyle,
  "random_refresh"
>;

export type DesktopAppOptions = {
  lang: "en" | "ja" | "fil";
  visualStyle: DesktopVisualStyle;
  disableCardHoverNudge: boolean;
};

const APP_OPTIONS_KEY = "app-options";
const RANDOM_VISUAL_STYLES: AppliedDesktopVisualStyle[] = [
  "it_started_here",
  "quiet_tide",
  "amoled",
  "dark_corporate",
  "urple",
];

export function getDefaultDesktopOptions(): DesktopAppOptions {
  return {
    lang: "en",
    visualStyle: "it_started_here",
    disableCardHoverNudge: false,
  };
}

export function resolveAppliedDesktopVisualStyle(
  visualStyle: DesktopVisualStyle,
): AppliedDesktopVisualStyle {
  if (visualStyle !== "random_refresh") {
    return visualStyle;
  }

  return RANDOM_VISUAL_STYLES[
    Math.floor(Math.random() * RANDOM_VISUAL_STYLES.length)
  ];
}

export function readDesktopAppOptions(): DesktopAppOptions {
  if (typeof window === "undefined") {
    return getDefaultDesktopOptions();
  }

  const defaults = getDefaultDesktopOptions();
  const raw = window.localStorage.getItem(APP_OPTIONS_KEY);

  if (!raw) {
    return {
      ...defaults,
      lang: readStoredSiteLang(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DesktopAppOptions>;
    return {
      lang:
        parsed.lang === "ja" || parsed.lang === "fil" || parsed.lang === "en"
          ? parsed.lang
          : readStoredSiteLang(),
      visualStyle:
        parsed.visualStyle === "quiet_tide" ||
        parsed.visualStyle === "amoled" ||
        parsed.visualStyle === "dark_corporate" ||
        parsed.visualStyle === "urple" ||
        parsed.visualStyle === "random_refresh"
          ? parsed.visualStyle
          : defaults.visualStyle,
      disableCardHoverNudge:
        typeof parsed.disableCardHoverNudge === "boolean"
          ? parsed.disableCardHoverNudge
          : defaults.disableCardHoverNudge,
    };
  } catch {
    return {
      ...defaults,
      lang: readStoredSiteLang(),
    };
  }
}

export function saveDesktopAppOptions(partial: Partial<DesktopAppOptions>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readDesktopAppOptions();
  const next = {
    ...current,
    ...partial,
  };

  const raw = window.localStorage.getItem(APP_OPTIONS_KEY);
  let parsed = {} as Record<string, unknown>;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  const merged = {
    ...parsed,
    ...next,
  };

  window.localStorage.setItem(APP_OPTIONS_KEY, JSON.stringify(merged));
  window.localStorage.setItem("site-lang", next.lang);
  window.dispatchEvent(new Event("app-options-change"));
  window.dispatchEvent(new Event("site-lang-change"));
  applyDesktopAppearance(next);
}

export function resetDesktopAppOptions() {
  saveDesktopAppOptions(getDefaultDesktopOptions());
}

export function applyDesktopAppearance(options = readDesktopAppOptions()) {
  if (typeof document === "undefined") {
    return;
  }

  const appliedStyle = resolveAppliedDesktopVisualStyle(options.visualStyle);

  if (appliedStyle === "it_started_here") {
    delete document.body.dataset.visualStyle;
  } else {
    document.body.dataset.visualStyle = appliedStyle;
  }

  document.body.classList.toggle(
    "card-hover-nudge-disabled",
    options.disableCardHoverNudge,
  );
}

function readStoredSiteLang(): DesktopAppOptions["lang"] {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("site-lang");
  return stored === "ja" || stored === "fil" ? stored : "en";
}
