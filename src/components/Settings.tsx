import { useId, useRef, useState } from 'react'
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../constants.ts'
import {
  backupStamp,
  parseBackup,
  shareOrDownload,
  toBackupCsv,
  toBackupJson,
} from '../lib/backup.ts'
import { notificationsSupported, requestNotifyPermission } from '../lib/alerts.ts'
import { isStandalone } from '../lib/theme.ts'
import type { SyncState } from '../lib/sheetSync.ts'
import type { AlertPrefs, PantryItem } from '../types.ts'

interface SettingsProps {
  items: PantryItem[]
  alertPrefs: AlertPrefs
  syncState: SyncState
  onSaveSyncUrl: (url: string) => void
  onSyncNow: () => void
  onAlertPrefs: (prefs: AlertPrefs) => void
  onClose: () => void
  onReplace: (items: PantryItem[]) => Promise<void>
  onMerge: (items: PantryItem[]) => Promise<void>
}

export function Settings({
  items,
  alertPrefs,
  syncState,
  onSaveSyncUrl,
  onSyncNow,
  onAlertPrefs,
  onClose,
  onReplace,
  onMerge,
}: SettingsProps) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ items: PantryItem[]; exportedAt: string | null } | null>(
    null,
  )
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [notifyNote, setNotifyNote] = useState<string | null>(null)
  const [syncUrlDraft, setSyncUrlDraft] = useState(syncState.url ?? '')
  const [syncBusy, setSyncBusy] = useState(false)
  const canNotify = notificationsSupported()
  const standalone = isStandalone()

  const exportJson = async () => {
    setError(null)
    try {
      await shareOrDownload(
        `pantry-${backupStamp()}.json`,
        toBackupJson(items),
        'application/json',
      )
      setMessage('JSON backup ready.')
    } catch {
      setError('Could not export JSON.')
    }
  }

  const exportCsv = async () => {
    setError(null)
    try {
      await shareOrDownload(`pantry-${backupStamp()}.csv`, toBackupCsv(items), 'text/csv')
      setMessage('CSV backup ready.')
    } catch {
      setError('Could not export CSV.')
    }
  }

  const onPickFile = async (file: File | undefined) => {
    setError(null)
    setMessage(null)
    setConfirmReplace(false)
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseBackup(text)
      setPending(parsed)
    } catch (err) {
      setPending(null)
      setError(err instanceof Error ? err.message : 'That file is not a Pantry JSON backup.')
    }
  }

  const runImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return
    if (mode === 'replace' && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (mode === 'replace') await onReplace(pending.items)
      else await onMerge(pending.items)
      setMessage(
        mode === 'replace'
          ? `Replaced pantry with ${pending.items.length} items.`
          : `Merged ${pending.items.length} items into the pantry.`,
      )
      setPending(null)
      setConfirmReplace(false)
    } catch {
      setError('Could not import that backup.')
    } finally {
      setBusy(false)
    }
  }

  const toggleNotify = async () => {
    if (alertPrefs.notifyOnOpen) {
      onAlertPrefs({ notifyOnOpen: false })
      setNotifyNote('In-app banner and Low filter still work.')
      return
    }
    if (!canNotify) {
      setNotifyNote('This browser cannot show system notifications. In-app alerts still work.')
      return
    }
    const permission = await requestNotifyPermission()
    if (permission === 'granted') {
      onAlertPrefs({ notifyOnOpen: true })
      setNotifyNote('Pantry can remind you when you open the app — once per day, if anything is low.')
      return
    }
    onAlertPrefs({ notifyOnOpen: false })
    setNotifyNote(
      permission === 'unsupported'
        ? 'System notifications are unavailable here. The in-app banner still flags low stock.'
        : 'Notifications are blocked. Pantry will still show the in-app banner when you open it.',
    )
  }

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="sheet-backdrop" aria-label="Close settings" onClick={onClose} />
      <section className="sheet settings-sheet">
        <header className="editor-head">
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
          <h2 id={titleId}>Settings</h2>
          <span />
        </header>

        <div className="settings-body">
          <section className="settings-block warning-block">
            <h3>Safari can erase this pantry</h3>
            <p>
              Data lives only on this device (IndexedDB, with a localStorage fallback). There is no
              cloud account. Safari may wipe site data after a stretch of unused time — more often if
              Pantry is not added to the Home Screen.
            </p>
            <p>
              Export a JSON backup to Files or iCloud Drive, and reopen the Home Screen app now and
              then so Safari keeps the data.
            </p>
          </section>

          <section className="settings-block">
            <h3>Sheet sync</h3>
            <p>
              Sync this phone with the shared <strong>Pantry Tracker</strong> Google Sheet. Data stays
              in IndexedDB for offline use; the sheet is the shared source of truth when online.
            </p>
            <label className="field-label" htmlFor="sync-url">
              Web app URL (include <code>?token=...</code>)
            </label>
            <input
              id="sync-url"
              className="text-input settings-wide"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://script.google.com/macros/s/…/exec?token=…"
              value={syncUrlDraft}
              onChange={(event) => setSyncUrlDraft(event.target.value)}
            />
            <div className="settings-actions">
              <button
                type="button"
                className="primary-btn"
                disabled={!syncUrlDraft.trim()}
                onClick={() => onSaveSyncUrl(syncUrlDraft.trim())}
              >
                Save sync URL
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={!syncState.url || syncBusy}
                onClick={() => {
                  setSyncBusy(true)
                  onSyncNow()
                  window.setTimeout(() => setSyncBusy(false), 800)
                }}
              >
                Sync now
              </button>
            </div>
            {syncState.lastSyncedAt ? (
              <p className="form-hint">
                Last synced {new Date(syncState.lastSyncedAt).toLocaleString()}.
              </p>
            ) : syncState.url ? (
              <p className="form-hint">Not synced yet.</p>
            ) : null}
            {syncState.lastError ? (
              <p className="form-error">{syncState.lastError}</p>
            ) : null}
          </section>

          <section className="settings-block">
            <h3>Backup</h3>
            <p>
              {items.length === 0
                ? 'Nothing to export yet.'
                : `${items.length} item${items.length === 1 ? '' : 's'} on this phone.`}
            </p>
            <div className="settings-actions">
              <button type="button" className="primary-btn" onClick={() => void exportJson()} disabled={items.length === 0}>
                Export JSON
              </button>
              <button type="button" className="ghost-btn" onClick={() => void exportCsv()} disabled={items.length === 0}>
                Export CSV
              </button>
            </div>
          </section>

          <section className="settings-block">
            <h3>Restore</h3>
            <p>
              Import a JSON backup. <strong>Replace</strong> is the usual restore after Safari clears
              storage — it overwrites everything here. <strong>Merge</strong> keeps current items and
              adds or updates matching ids from the file.
            </p>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                void onPickFile(file)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              className="ghost-btn settings-wide"
              onClick={() => fileRef.current?.click()}
            >
              Choose JSON backup
            </button>

            {pending ? (
              <div className="import-preview">
                <p>
                  This file has <strong>{pending.items.length}</strong> item
                  {pending.items.length === 1 ? '' : 's'}
                  {pending.exportedAt
                    ? ` · exported ${new Date(pending.exportedAt).toLocaleString()}`
                    : ''}
                  .
                </p>
                <button
                  type="button"
                  className="danger-btn"
                  disabled={busy}
                  onClick={() => void runImport('replace')}
                >
                  {confirmReplace ? 'Tap again to replace pantry' : 'Replace pantry'}
                </button>
                <button
                  type="button"
                  className="ghost-btn settings-wide"
                  disabled={busy}
                  onClick={() => void runImport('merge')}
                >
                  Merge into pantry
                </button>
              </div>
            ) : null}
          </section>

          <section className="settings-block">
            <h3>Low-stock alerts</h3>
            <p>
              Items with a count at or below their threshold show a Low badge. The default threshold is{' '}
              <strong>{DEFAULT_LOW_STOCK_THRESHOLD}</strong> when you leave it blank. Empty items still
              use the Out filter.
            </p>
            <p>
              Alerts are in-app: a banner when you open Pantry, the Low chip, and a Home Screen badge
              when the phone supports it. Background Web Push is not used — it is not reliable for an
              iPhone Home Screen PWA, and this app has no server.
            </p>
            {!standalone ? (
              <p>
                On iPhone, add Pantry to the Home Screen for the most reliable local alerts. The banner
                still works in Safari.
              </p>
            ) : null}
            <button
              type="button"
              className={`ghost-btn settings-wide ${alertPrefs.notifyOnOpen ? 'is-on' : ''}`}
              onClick={() => void toggleNotify()}
            >
              {alertPrefs.notifyOnOpen ? 'Opening reminder on' : 'Remind me when I open Pantry'}
            </button>
            {notifyNote ? <p className="form-hint">{notifyNote}</p> : null}
          </section>

          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-ok">{message}</p> : null}
        </div>
      </section>
    </div>
  )
}
