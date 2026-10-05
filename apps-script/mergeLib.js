/**
 * Pure merge helpers for Apps Script (also sanity-checked under Node).
 * Keep in sync with src/lib/syncMerge.ts where applicable.
 */

function parseSyncTimestamp(value, fallback) {
  if (fallback === void 0) fallback = 0
  if (value instanceof Date && !isNaN(value.getTime())) return value.getTime()
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    var n = Number(value)
    if (isFinite(n)) return n
    var parsed = Date.parse(value)
    if (!isNaN(parsed)) return parsed
  }
  return fallback
}

function parseExpiryDate(cellValue, displayValue, timeZone) {
  if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(
        cellValue,
        timeZone || (typeof Session !== 'undefined' ? Session.getScriptTimeZone() : 'Etc/GMT'),
        'yyyy-MM-dd',
      )
    }
    return cellValue.toISOString().slice(0, 10)
  }
  var expiry = String(displayValue != null ? displayValue : cellValue || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return expiry
  return null
}

function isDeletedFlag(value) {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    var s = value.trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'yes'
  }
  return false
}

function mergeSyncItems(a, b) {
  var map = {}

  function consider(item) {
    if (!item) return
    var id = String(item.id || '').trim()
    if (!id) return
    var existing = map[id]
    if (!existing) {
      map[id] = item
      return
    }
    var aTs = parseSyncTimestamp(existing.updatedAt)
    var bTs = parseSyncTimestamp(item.updatedAt)
    if (bTs > aTs) map[id] = item
    else if (bTs === aTs && item.deleted && !existing.deleted) map[id] = item
  }

  for (var i = 0; i < a.length; i++) consider(a[i])
  for (var j = 0; j < b.length; j++) consider(b[j])

  return Object.keys(map).map(function (k) {
    return map[k]
  })
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseSyncTimestamp, parseExpiryDate, isDeletedFlag, mergeSyncItems }
}
