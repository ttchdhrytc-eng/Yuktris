import type { Page } from 'playwright';

export interface LinkedInProfileReadiness {
  ready: boolean;
  code: 'profile_ready' | 'profile_hydration_timeout' | 'security_surface' | 'target_mismatch';
  finalUrl: string;
  targetMatched: boolean;
  documentReadyState: string;
  mainFound: boolean;
  headerFound: boolean;
  skeletonDetected: boolean;
  actionRowFound: boolean;
  relevantActions: string[];
  moreFound: boolean;
  overlayCategories: string[];
  attemptCount: number;
  elapsedMs: number;
  stableObservations: number;
  recoveryUsed: boolean;
}

type Snapshot = Omit<LinkedInProfileReadiness, 'ready' | 'code' | 'attemptCount' | 'elapsedMs' | 'stableObservations' | 'recoveryUsed'> & { signature: string };

export function profileReadinessSatisfied(snapshot: Pick<LinkedInProfileReadiness, 'targetMatched' | 'mainFound' | 'headerFound' | 'actionRowFound' | 'skeletonDetected'>, stableObservations: number): boolean {
  return snapshot.targetMatched && snapshot.mainFound && snapshot.headerFound && snapshot.actionRowFound && !snapshot.skeletonDetected && stableObservations >= 2;
}

const normalize = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname) || !url.pathname.startsWith('/in/')) return null;
    return `https://www.linkedin.com${url.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch { return null; }
};

async function observe(page: Page, expectedTarget: string): Promise<Snapshot> {
  return page.evaluate((expected) => {
    const visible = (element: Element): boolean => {
      const node = element as HTMLElement; const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const label = (element: Element) => [element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('data-control-name'), element.textContent]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href;
    const normalizeInPage = (value: string): string | null => {
      try { const url = new URL(value); return `https://www.linkedin.com${url.pathname.replace(/\/+$/, '').toLowerCase()}`; } catch { return null; }
    };
    const main = document.querySelector('main, .scaffold-layout__main, [data-view-name*="profile"]');
    const headings = Array.from(document.querySelectorAll('main h1, main h2, main [role="heading"], .scaffold-layout__main h1, .scaffold-layout__main [role="heading"]')).filter(visible);
    const header = headings.find(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.top < Math.max(700, innerHeight);
    }) ?? null;
    const controls = Array.from(document.querySelectorAll('main button, main a[role="button"], main [role="button"], .scaffold-layout__main button, .scaffold-layout__main [role="button"]'))
      .filter(element => visible(element) && element.getBoundingClientRect().top < Math.max(1000, innerHeight + 200));
    const labels = controls.map(label);
    const category = (value: string): string | null => {
      if (/\bpending\b|invitation\s+sent|withdraw\s+invitation/.test(value)) return 'pending';
      if (/\bremove\s+connection\b|\bconnection\s+since\b/.test(value)) return 'connected';
      if (/\bconnect\b/.test(value)) return 'connect';
      if (/\bmessage\b/.test(value)) return 'message';
      if (/\bfollowing\b|\bunfollow\b/.test(value)) return 'following';
      if (/\bfollow\b/.test(value)) return 'follow';
      if (/\bmore\b|additional\s+actions|overflow/.test(value)) return 'more';
      return null;
    };
    const actions = [...new Set(labels.map(category).filter((value): value is string => !!value))].sort();
    const skeletonDetected = !!document.querySelector('main .artdeco-loader, main [class*="skeleton" i], main [aria-busy="true"], .scaffold-layout__main [class*="skeleton" i]');
    const pageSignals = `${location.pathname} ${document.title}`.toLowerCase();
    const overlayLabels = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(visible).map(label);
    const overlays = new Set<string>();
    if (/checkpoint|challenge|security verification|captcha/.test(pageSignals) || overlayLabels.some(value => /security verification|captcha|checkpoint|challenge/.test(value))) overlays.add('security');
    if (/\/login|authwall|sign in/.test(pageSignals) || overlayLabels.some(value => /sign in|join linkedin/.test(value))) overlays.add('authentication');
    if (overlayLabels.some(value => /cookie|consent/.test(value))) overlays.add('consent');
    if (overlayLabels.some(value => /messaging|chat/.test(value))) overlays.add('messaging');
    const snapshot = {
      finalUrl: location.href,
      targetMatched: normalizeInPage(canonical) === expected,
      documentReadyState: document.readyState,
      mainFound: !!main,
      headerFound: !!header,
      skeletonDetected,
      actionRowFound: actions.some(value => ['connect','message','pending','follow','following','connected','more'].includes(value)),
      relevantActions: actions,
      moreFound: actions.includes('more'),
      overlayCategories: [...overlays].sort(),
    };
    return { ...snapshot, signature: JSON.stringify(snapshot) };
  }, expectedTarget);
}

export async function waitForLinkedInProfileReady(page: Page, targetUrl: string, timeoutMs = 20_000): Promise<LinkedInProfileReadiness> {
  const expected = normalize(targetUrl);
  if (!expected) throw new Error('A canonical LinkedIn profile target is required');
  const started = Date.now();
  let attempts = 0; let stable = 0; let previous = ''; let recoveryUsed = false; let last: Snapshot | null = null;

  const navigate = async (reload: boolean) => {
    if (reload) await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    else await page.goto(expected, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => {});
  };
  await navigate(false);

  while (Date.now() - started < timeoutMs) {
    attempts++;
    last = await observe(page, expected);
    stable = last.signature === previous ? stable + 1 : 1;
    previous = last.signature;
    const security = last.overlayCategories.includes('security') || last.overlayCategories.includes('authentication');
    if (security) return { ...last, ready: false, code: 'security_surface', attemptCount: attempts, elapsedMs: Date.now() - started, stableObservations: stable, recoveryUsed };
    if (profileReadinessSatisfied(last, stable)) return { ...last, ready: true, code: 'profile_ready', attemptCount: attempts, elapsedMs: Date.now() - started, stableObservations: stable, recoveryUsed };
    if (!recoveryUsed && Date.now() - started >= Math.min(8_000, timeoutMs / 2) && (!last.mainFound || !last.headerFound || !last.actionRowFound)) {
      recoveryUsed = true; stable = 0; previous = '';
      await navigate(true);
    } else {
      await page.waitForTimeout(750);
    }
  }
  const fallback = last ?? await observe(page, expected);
  return { ...fallback, ready: false, code: fallback.targetMatched ? 'profile_hydration_timeout' : 'target_mismatch', attemptCount: attempts, elapsedMs: Date.now() - started, stableObservations: stable, recoveryUsed };
}
