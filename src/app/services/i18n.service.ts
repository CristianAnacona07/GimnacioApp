import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/**
 * I18nService — foundational, dependency-free internationalization.
 *
 * Loads a nested JSON dictionary from `assets/i18n/<lang>.json` and resolves
 * dot-path keys (e.g. `translate('common.guardar')`). If a key is missing the
 * key itself is returned, so the UI degrades gracefully.
 *
 * Current language defaults to 'es' and is persisted in localStorage ('lang').
 *
 * HOW TO EXPAND:
 *  1. Add new keys to BOTH `assets/i18n/es.json` and `assets/i18n/en.json`
 *     (keep the key structure identical across languages).
 *  2. To add a language, drop a new `assets/i18n/<code>.json` file and add the
 *     code to `SUPPORTED_LANGS`.
 *  3. In a component: `t = inject(I18nService); ... this.t.translate('nav.perfil')`.
 *     `dictionary()` is a signal, so template bindings re-render on `setLang()`.
 *  4. For reactive templates you can also read `dictionary()` directly, or build
 *     a pipe on top of `translate()` later without touching this service.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private http = inject(HttpClient);

  private readonly STORAGE_KEY = 'lang';
  private readonly DEFAULT_LANG = 'es';
  private readonly SUPPORTED_LANGS = ['es', 'en'];

  /** Reactive dictionary — components can read via `dictionary()`. */
  readonly dictionary = signal<Record<string, unknown>>({});

  /** Reactive current language code. */
  readonly lang = signal<string>(this.DEFAULT_LANG);

  constructor() {
    const stored = this.readStoredLang();
    this.lang.set(stored);
    this.load(stored);
  }

  /** Change the active language, persist it and reload its dictionary. */
  setLang(lang: string): void {
    if (!this.SUPPORTED_LANGS.includes(lang)) {
      return;
    }
    this.lang.set(lang);
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch {
      // localStorage may be unavailable (e.g. SSR / private mode) — ignore.
    }
    this.load(lang);
  }

  /**
   * Resolve a dot-path key against the loaded dictionary.
   * Returns the key unchanged when the path is missing or not a string.
   */
  translate(key: string): string {
    if (!key) {
      return key;
    }
    const value = key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, this.dictionary());

    return typeof value === 'string' ? value : key;
  }

  private load(lang: string): void {
    this.http.get<Record<string, unknown>>(`assets/i18n/${lang}.json`).subscribe({
      next: (dict) => this.dictionary.set(dict ?? {}),
      error: () => this.dictionary.set({}),
    });
  }

  private readStoredLang(): string {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && this.SUPPORTED_LANGS.includes(stored)) {
        return stored;
      }
    } catch {
      // Ignore storage access errors and fall back to default.
    }
    return this.DEFAULT_LANG;
  }
}
