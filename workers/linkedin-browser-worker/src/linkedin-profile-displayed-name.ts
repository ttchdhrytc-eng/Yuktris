import type { Page } from 'playwright';
import { normalizeLinkedInDisplayName } from './linkedin-profile-identity.js';

export type DisplayedNameSignal = {
  source: 'visible_primary_heading' | 'semantic_primary_heading' | 'primary_intro_structure' | 'primary_accessible_name' | 'structured_person_metadata';
  value: string;
  primary: boolean;
};

export type DisplayedNameExtraction =
  | { status: 'found'; name: string; corroboratingSources: string[]; candidateCount: number }
  | { status: 'missing' | 'ambiguous' | 'security_surface'; name: null; corroboratingSources: string[]; candidateCount: number };

const excludedSurface = /more profiles|people also viewed|recommend|messaging|notification|education|activity|feed|comment|advertis|company|organization/i;

export function resolveDisplayedNameSignals(signals: DisplayedNameSignal[]): DisplayedNameExtraction {
  const primary = signals
    .filter(signal => signal.primary && signal.source !== 'structured_person_metadata' && !excludedSurface.test(signal.source))
    .map(signal => ({ ...signal, normalized: normalizeLinkedInDisplayName(signal.value) }))
    .filter((signal): signal is typeof signal & { normalized: string } => !!signal.normalized);
  const names = [...new Set(primary.map(signal => signal.normalized))];
  if (names.length === 0) return { status: 'missing', name: null, corroboratingSources: [], candidateCount: 0 };
  if (names.length > 1) return { status: 'ambiguous', name: null, corroboratingSources: primary.map(signal => signal.source), candidateCount: names.length };
  const name = names[0];
  const corroboratingSources = [...new Set(signals
    .filter(signal => normalizeLinkedInDisplayName(signal.value) === name)
    .map(signal => signal.source))];
  return { status: 'found', name, corroboratingSources, candidateCount: 1 };
}

async function collect(page: Page): Promise<{ signals: DisplayedNameSignal[]; security: boolean }> {
  return page.evaluate(() => {
    type Signal = DisplayedNameSignal;
    const visible = (element: Element): boolean => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        && element.getAttribute('aria-hidden') !== 'true';
    };
    const excluded = (element: Element): boolean => {
      if (element.closest('nav,aside,footer,[role="dialog"],[aria-modal="true"],.msg-overlay-container,[class*="messaging" i]')) return true;
      const region = element.closest('section,article,[aria-label],[data-view-name]');
      const descriptor = [region?.getAttribute('aria-label'), region?.getAttribute('data-view-name'), region?.querySelector('h2,h3')?.textContent]
        .filter(Boolean).join(' ');
      return /more profiles|people also viewed|recommend|messaging|notification|education|activity|feed|comment|advertis|company|organization/i.test(descriptor);
    };
    const clean = (value: string | null | undefined): string | null => {
      const result = value?.normalize('NFKC').replace(/\s+/gu, ' ').trim() ?? '';
      return result && result.length <= 120 ? result : null;
    };
    const main = document.querySelector('main, .scaffold-layout__main');
    const signals: Signal[] = [];
    const add = (source: Signal['source'], element: Element, value: string | null | undefined) => {
      const cleaned = clean(value);
      if (!cleaned || !visible(element) || excluded(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.top < -100 || rect.top > Math.max(900, innerHeight)) return;
      signals.push({ source, value: cleaned, primary: true });
    };
    if (main) {
      main.querySelectorAll('h1').forEach(element => add('visible_primary_heading', element, element.textContent));
      main.querySelectorAll('[role="heading"][aria-level="1"], [role="heading"][aria-level="2"]')
        .forEach(element => add('semantic_primary_heading', element, element.getAttribute('aria-label') || element.textContent));
      main.querySelectorAll('[data-view-name*="profile-top" i] h1,[data-view-name*="profile-top" i] h2,[data-view-name*="profile-intro" i] h1,[data-view-name*="profile-intro" i] h2,[itemprop="name"],section:first-of-type h2')
        .forEach(element => add('primary_intro_structure', element, element.textContent));
      main.querySelectorAll('[data-view-name*="profile-top" i] [aria-label],[data-view-name*="profile-intro" i] [aria-label],[aria-label][itemprop="name"]')
        .forEach(element => add('primary_accessible_name', element, element.getAttribute('aria-label')));
    }
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    if (canonical && /linkedin[.]com\/in\//i.test(canonical)) {
      document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"],meta[name="twitter:title"]')
        .forEach(element => {
          const value = clean(element.content.replace(/\s*[|–-]\s*LinkedIn\s*$/i, ''));
          if (value) signals.push({ source: 'structured_person_metadata', value, primary: false });
        });
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach(element => {
        try {
          const parsed = JSON.parse(element.textContent || 'null');
          const values = Array.isArray(parsed) ? parsed : [parsed];
          values.filter(value => value && value['@type'] === 'Person').forEach(value => {
            const name = clean(value.name);
            const url = typeof value.url === 'string' ? value.url : canonical;
            if (name && url && new URL(url, location.href).pathname.replace(/\/+$/, '').toLowerCase() === new URL(canonical).pathname.replace(/\/+$/, '').toLowerCase())
              signals.push({ source: 'structured_person_metadata', value: name, primary: false });
          });
        } catch { /* untrusted metadata is ignored */ }
      });
    }
    const surface = `${location.pathname} ${document.title} ${document.body?.innerText.slice(0, 1000) ?? ''}`;
    return { signals, security: /checkpoint|security verification|captcha|\/login|authwall|sign in to linkedin/i.test(surface) };
  });
}

export async function extractLinkedInDisplayedName(page: Page, timeoutMs = 8_000): Promise<DisplayedNameExtraction> {
  const started = Date.now();
  let previous = ''; let stable = 0; let last: DisplayedNameExtraction = { status: 'missing', name: null, corroboratingSources: [], candidateCount: 0 };
  while (Date.now() - started < timeoutMs) {
    const observed = await collect(page);
    if (observed.security) return { status: 'security_surface', name: null, corroboratingSources: [], candidateCount: 0 };
    last = resolveDisplayedNameSignals(observed.signals);
    const signature = JSON.stringify(last);
    stable = signature === previous ? stable + 1 : 1;
    previous = signature;
    if (last.status === 'found' && stable >= 2) return last;
    if (last.status === 'ambiguous' && stable >= 2) return last;
    await page.waitForTimeout(500);
  }
  return last;
}
