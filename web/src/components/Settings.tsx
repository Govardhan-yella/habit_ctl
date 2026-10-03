import { useCallback, useState } from 'react';
import { useTheme } from '../themes/index';
import { useHabitStore } from '../hooks/useHabitStore';
import { exportData, importData, resetAll } from '../data/habitStore';
import type { ExportFile } from '@shared/types';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { themeId, setThemeId, themes } = useTheme();
  const { refresh } = useHabitStore();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportedBlobUrl, setExportedBlobUrl] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setImportError(null);
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      setExportedBlobUrl(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habitctl-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setImportError('Export failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const json = await file.text();
      const data: ExportFile = JSON.parse(json);
      await importData(data);
      await refresh();
      onClose();
    } catch (err) {
      setImportError('Import failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
    }
  }, [refresh, onClose]);

  const handleImportChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImportFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }, [handleImportFile]);

  const handleReset = useCallback(async () => {
    setResetting(true);
    setImportError(null);
    try {
      await resetAll();
      await refresh();
      onClose();
    } catch (err) {
      setImportError('Reset failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetting(false);
    }
  }, [refresh, onClose]);

  const cleanupBlob = useCallback(() => {
    if (exportedBlobUrl) {
      URL.revokeObjectURL(exportedBlobUrl);
      setExportedBlobUrl(null);
    }
  }, [exportedBlobUrl]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ gap: 18 }}>
          {/* ── Theme ── */}
          <div className="field">
            <label className="field-label">Theme</label>
            <select
              className="field-select"
              value={themeId}
              onChange={e => setThemeId(e.target.value as any)}
            >
              {(Object.keys(themes) as Array<keyof typeof themes>).map(id => (
                <option key={id} value={id}>{themes[id].name}</option>
              ))}
            </select>
          </div>

          {/* ── Export ── */}
          <div className="field">
            <label className="field-label">Export data</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Exporting…' : 'Download JSON'}
              </button>
              {exportedBlobUrl && (
                <button
                  className="btn"
                  onClick={cleanupBlob}
                  title="Remove downloaded file reference"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  Clear
                </button>
              )}
            </div>
            <span style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 4 }}>
              Downloads all habits, check-ins, streaks, and progress as a JSON file.
            </span>
          </div>

          {/* ── Import ── */}
          <div className="field">
            <label className="field-label">Import data</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="btn" style={{ cursor: 'pointer', borderColor: 'var(--border-bright)' }}>
                Choose file
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportChange}
                  disabled={importing}
                  style={{ display: 'none' }}
                />
              </label>
              {importing && <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Importing…</span>}
            </div>
            <span style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 4 }}>
              Replaces all existing data with the imported file.
            </span>
          </div>

          {/* ── Danger zone ── */}
          <div className="field" style={{ paddingTop: 4 }}>
            <label className="field-label" style={{ color: 'var(--danger)' }}>Danger zone</label>
            <button
              className="btn btn-danger"
              onClick={handleReset}
              disabled={resetting}
              style={{ width: '100%', marginTop: 4 }}
            >
              {resetting ? 'Resetting…' : 'Reset all data'}
            </button>
            <span style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 4, display: 'block' }}>
              Deletes all habits, check-ins, streaks, and progress. Cannot be undone.
            </span>
          </div>

          {/* ── Error message ── */}
          {importError && (
            <div
              style={{
                background: 'var(--danger)',
                color: 'var(--bg)',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {importError}
            </div>
          )}

          {/* ── Version info ── */}
          <div style={{ fontSize: 10, color: 'var(--fg-dim)', textAlign: 'center', marginTop: 4 }}>
            habitctl v0.1.0 · local first · no account needed
          </div>
        </div>
      </div>
    </div>
  );
}
