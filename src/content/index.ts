import { debounce } from "es-toolkit";
import { resolveSiteRules } from "../shared/rules";
import { findEffectiveSite } from "../shared/sites";
import { loadConfig, siteKey, subscribeConfig } from "../shared/storage";
import type { PageIssue, Rule, SiteRule } from "../shared/types";
import { createEngine } from "./engine";
import { clearProbeCache, collectIssues, reportIssues } from "./issues";
import { collectCssSources, syncStyles } from "./styles";

let currentRules: Rule[] = [];
let cssIssues: PageIssue[] = [];
let currentIssues: PageIssue[] = [];
let lastSignature: string | null = null;
let generation = 0;
let domReady = false;
let syncQueue: Promise<void> = Promise.resolve();

const engine = createEngine(() => {
  refreshStyles();
});

async function updateIssues(): Promise<void> {
  const gen = generation;
  const issues = await collectIssues(currentRules, cssIssues);
  if (gen !== generation) return;
  currentIssues = issues;
  reportIssues(issues);
}

/** 同步自定义 CSS；串行化以避免多次注入互相覆盖 */
function refreshStyles(): void {
  const gen = generation;
  syncQueue = syncQueue
    .then(async () => {
      if (gen !== generation) return;
      const issues = await syncStyles(collectCssSources(currentRules), () => gen === generation);
      if (gen !== generation) return;
      cssIssues = issues;
      if (currentRules.length > 0) await updateIssues();
    })
    .catch(() => {
      // 注入失败已在 syncStyles 内部转为 issue
    });
}

const hasPendingStylesheets = (): boolean => {
  for (const link of document.querySelectorAll('link[rel~="stylesheet"]')) {
    if (link instanceof HTMLLinkElement && !link.sheet) return true;
  }
  return false;
};

function onDomReady(): void {
  if (document.readyState === "loading" || domReady) return;
  domReady = true;
  if (currentRules.length === 0) return;
  engine.start();
  if (hasPendingStylesheets()) {
    window.addEventListener("load", () => engine.reapply(), { once: true });
  }
  void updateIssues();
}

async function boot(): Promise<void> {
  let config: { rules: Rule[]; sites: SiteRule[] };
  try {
    config = await loadConfig();
  } catch {
    return;
  }

  const site = findEffectiveSite(location.hostname, config.sites);
  const ordered = site ? resolveSiteRules(site, config.rules) : [];
  const signature = JSON.stringify({ key: site ? siteKey(site) : null, rules: ordered });
  if (signature === lastSignature) return;

  lastSignature = signature;
  generation += 1;
  currentRules = ordered;
  engine.dispose();
  clearProbeCache();
  cssIssues = [];
  currentIssues = [];

  if (ordered.length === 0) {
    reportIssues([]);
    refreshStyles();
    return;
  }

  engine.setRules(ordered);
  if (domReady) {
    engine.start();
    void updateIssues();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
  } else {
    onDomReady();
  }
  refreshStyles();
}

chrome.runtime.onMessage.addListener(
  (message: { type?: string } | undefined, _sender, sendResponse) => {
    if (message?.type === "getPageIssues") {
      sendResponse({ issues: currentIssues });
    }
    return false;
  },
);

void boot();
subscribeConfig(
  debounce(() => {
    void boot();
  }, 100),
);
