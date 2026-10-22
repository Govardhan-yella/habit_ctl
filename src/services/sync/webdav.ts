import { SyncProvider, SyncSnapshot, SyncTestResult } from './types';

export interface WebDavConfig {
  url: string;
  user?: string;
  password?: string;
  /** Folder inside the DAV root (created on demand). */
  path?: string;
  /** Snapshot file name. */
  fileName: string;
}

/** Join URL parts without doubling or dropping slashes. */
export function joinUrl(...parts: (string | undefined)[]): string {
  const cleaned = parts
    .filter((p): p is string => !!p)
    .map(p => p.replace(/^\/+|\/+$/g, ''))
    .filter(p => p.length > 0);
  if (!cleaned.length) return '';
  return cleaned.join('/');
}

/**
 * Syncs against any WebDAV server — Nextcloud, ownCloud, Synology DSM,
 * Seafile, or a plain nginx dav module.
 *
 * The whole dataset is stored as a single JSON file, which keeps the server
 * requirements trivial (GET + PUT) and the merge logic in one place.
 */
export class WebDavProvider implements SyncProvider {
  readonly id = 'webdav';
  readonly name = 'WebDAV';

  constructor(private cfg: WebDavConfig) {}

  /** Absolute URL of the snapshot file. */
  fileUrl(): string {
    const base = joinUrl(this.cfg.url, this.cfg.path);
    return base ? `${base}/${this.cfg.fileName}` : this.cfg.fileName;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this.cfg.user) {
      const raw = `${this.cfg.user}:${this.cfg.password ?? ''}`;
      // btoa only handles latin1, so encode UTF-8 first.
      const encoded = btoa(unescape(encodeURIComponent(raw)));
      h['Authorization'] = `Basic ${encoded}`;
    }
    return h;
  }

  async pull(): Promise<SyncSnapshot | null> {
    const res = await fetch(this.fileUrl(), { method: 'GET', headers: this.headers(), cache: 'no-store' });
    if (res.status === 404 || res.status === 409) return null;
    if (!res.ok) throw new Error(`WebDAV read failed (HTTP ${res.status})`);
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as SyncSnapshot;
    } catch {
      throw new Error('Remote file is not valid JSON');
    }
  }

  async push(snapshot: SyncSnapshot): Promise<void> {
    const body = JSON.stringify(snapshot, null, 2);
    const put = await fetch(this.fileUrl(), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body,
    });
    if (!put.ok) throw new Error(`WebDAV write failed (HTTP ${put.status})`);
  }

  async test(): Promise<SyncTestResult> {
    try {
      const url = this.fileUrl();
      const res = await fetch(url, { method: 'GET', headers: this.headers(), cache: 'no-store' });
      if (res.ok) return { ok: true, message: `Connected — ${url}` };
      if (res.status === 404) {
        // A missing file is fine: the folder exists but nothing is stored yet.
        const probe = await fetch(this.cfg.url, { method: 'PROPFIND', headers: this.headers({ Depth: '0' }) });
        if (probe.ok || probe.status === 207) return { ok: true, message: `Connected — no snapshot yet at ${url}` };
        return { ok: false, message: `Folder not reachable (HTTP ${probe.status})` };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, message: 'Authentication failed — check user and app password' };
      return { ok: false, message: `Unexpected response (HTTP ${res.status})` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
