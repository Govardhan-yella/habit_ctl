import { SyncProvider, SyncSnapshot, SyncTestResult } from './types';

/* Minimal typings for the File System Access API — not in the default lib. */
interface FsWritable {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
  queryPermission?(desc?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(desc?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}
interface FsWindow {
  showSaveFilePicker?(opts?: any): Promise<FsFileHandle>;
  showOpenFilePicker?(opts?: any): Promise<FsFileHandle[]>;
}

function fsWindow(): FsWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as FsWindow);
}

/** True when the browser can write to a local file without a download dialog. */
export function supportsFileSystemAccess(): boolean {
  return typeof fsWindow()?.showSaveFilePicker === 'function';
}

/**
 * Syncs the snapshot to a file on the user's own disk (iCloud Drive,
 * Google Drive's local folder, Dropbox, a NAS mount, ...).
 *
 * Uses the File System Access API when available, so the write happens
 * silently in the background. Otherwise the app falls back to an explicit
 * download/upload pair, which still gives working (if manual) sync.
 */
export class FileProvider implements SyncProvider {
  readonly id = 'file';
  readonly name = 'Local file';

  constructor(private cfg: { fileName: string }, private handle: FsFileHandle | null = null) {}

  setHandle(handle: FsFileHandle | null): void { this.handle = handle; }
  getHandle(): FsFileHandle | null { return this.handle; }

  /** Ask the user where to store the snapshot. Returns the chosen handle. */
  async pick(): Promise<FsFileHandle | null> {
    const w = fsWindow();
    if (!w?.showSaveFilePicker) return null;
    const handle = await w.showSaveFilePicker({
      suggestedName: this.cfg.fileName,
      types: [{ description: 'habit_ctl snapshot', accept: { 'application/json': ['.json'] } }],
    });
    this.handle = handle;
    return handle;
  }

  /** Ask the user for an existing snapshot to merge from. */
  async pickExisting(): Promise<string | null> {
    const w = fsWindow();
    if (w?.showOpenFilePicker) {
      const [handle] = await w.showOpenFilePicker({
        types: [{ description: 'habit_ctl snapshot', accept: { 'application/json': ['.json'] } }],
      });
      if (handle) return (await handle.getFile()).text();
      return null;
    }
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const f = (input.files || [])[0];
        resolve(f ? await f.text() : null);
      };
      input.click();
    });
  }

  async pull(): Promise<SyncSnapshot | null> {
    if (!this.handle) return null;
    const perm = await this.handle.queryPermission?.({ mode: 'readwrite' });
    if (perm === 'denied') throw new Error('Permission to read the file was denied');
    const file = await this.handle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as SyncSnapshot;
    } catch {
      throw new Error('Snapshot file is not valid JSON');
    }
  }

  async push(snapshot: SyncSnapshot): Promise<void> {
    if (!this.handle) throw new Error('No file selected yet');
    const perm = await this.handle.requestPermission?.({ mode: 'readwrite' });
    if (perm === 'denied') throw new Error('Permission to write the file was denied');
    const writable = await this.handle.createWritable();
    await writable.write(JSON.stringify(snapshot, null, 2));
    await writable.close();
  }

  async test(): Promise<SyncTestResult> {
    if (!this.handle) return { ok: false, message: 'No file selected yet' };
    try {
      const perm = await this.handle.queryPermission?.({ mode: 'readwrite' });
      if (perm === 'denied') return { ok: false, message: 'Permission denied for the selected file' };
      return { ok: true, message: `Ready — ${this.handle.name}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
