/**
 * Pantry Tracker — Google Sheet sync web app
 *
 * Deploy: Extensions → Apps Script → paste these files → Deploy → New deployment → Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Replace SYNC_TOKEN before deploying. Clients pass ?token=... on every request.
 */

// --- DEPLOYER: set your shared secret here ---
var SYNC_TOKEN = 'REPLACE_WITH_TOKEN'
// -------------------------------------------

var SHEET_TAB = 'Items'

var BASE_HEADERS = [
  'id',
  'name',
  'quantity',
  'unit',
  'category',
  'expiryDate',
  'notes',
  'lowStockThreshold',
  'barcode',
  'createdAt',
  'updatedAt',
  'deleted',
]

var BRAND_HEADER = 'brand'
var IMAGE_URL_HEADER = 'image_url'
var HEADERS = BASE_HEADERS.concat([BRAND_HEADER, IMAGE_URL_HEADER])

var TEXT_COLUMNS = { id: 1, expiryDate: 6, barcode: 9, brand: 13, imageUrl: 14 }

function doGet(e) {
  return handleRequest_(e, null)
}

function doPost(e) {
  var body = e && e.postData ? e.postData.contents : ''
  return handleRequest_(e, body)
}

function handleRequest_(e, postBody) {
  try {
    if (!checkToken_(e)) {
      return jsonResponse_({ ok: false, error: 'Unauthorized' }, 401)
    }

    if (postBody !== null) {
      var incoming
      try {
        incoming = JSON.parse(postBody)
      } catch (err) {
        return jsonResponse_({ ok: false, error: 'Invalid JSON body' }, 400)
      }
      var items = syncPost_(incoming)
      return jsonResponse_({ ok: true, items: items })
    }

    var all = readAllItems_()
    return jsonResponse_({ ok: true, items: all })
  } catch (err) {
    return jsonResponse_(
      { ok: false, error: err && err.message ? err.message : String(err) },
      500,
    )
  }
}

function checkToken_(e) {
  var token = (e && e.parameter && e.parameter.token) || ''
  return token && token === SYNC_TOKEN
}

function jsonResponse_(obj, statusCode) {
  if (obj && Array.isArray(obj.items)) {
    obj = { ok: obj.ok, error: obj.error, items: obj.items.map(publicItem_) }
  }
  var out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
  if (statusCode) {
    // Apps Script web apps cannot set HTTP status codes; include ok/error in JSON.
  }
  return out
}

function getItemsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(SHEET_TAB)
  if (!sheet) {
    throw new Error('Sheet tab "' + SHEET_TAB + '" not found')
  }
  return sheet
}

function syncPost_(payload) {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) {
    throw new Error('Could not acquire lock')
  }
  try {
    var sheet = getItemsSheet_()
    ensureHeader_(sheet)
    var sheetItems = readAllItems_(sheet)
    assignBlankIds_(sheet, sheetItems)
    sheetItems = readAllItems_(sheet)

    var incomingPairs = []
    if (payload && Array.isArray(payload.items)) {
      for (var i = 0; i < payload.items.length; i++) {
        var raw = payload.items[i]
        var normalized = normalizeIncoming_(raw)
        if (!normalized || !normalized.item || !normalized.item.id) continue
        incomingPairs.push(normalized)
      }
    }

    var merged = mergePostItems(sheetItems, incomingPairs)
    writeAllItems_(sheet, merged)
    return merged
  } finally {
    lock.releaseLock()
  }
}

function ensureHeader_(sheet) {
  var baseRow = sheet.getRange(1, 1, 1, BASE_HEADERS.length).getValues()[0]
  var baseOk = true
  for (var i = 0; i < BASE_HEADERS.length; i++) {
    if (String(baseRow[i] || '').trim() !== BASE_HEADERS[i]) {
      baseOk = false
      break
    }
  }
  if (!baseOk) {
    sheet.getRange(1, 1, 1, BASE_HEADERS.length).setValues([BASE_HEADERS])
    sheet.getRange(1, 1, 1, BASE_HEADERS.length).setFontWeight('bold')
  }
  var brandCell = sheet.getRange(1, HEADERS.length - 1)
  if (String(brandCell.getDisplayValue()).trim() !== BRAND_HEADER) {
    brandCell.setValue(BRAND_HEADER)
    brandCell.setFontWeight('bold')
  }
  var imageCell = sheet.getRange(1, HEADERS.length)
  if (String(imageCell.getDisplayValue()).trim() !== IMAGE_URL_HEADER) {
    imageCell.setValue(IMAGE_URL_HEADER)
    imageCell.setFontWeight('bold')
  }
}

function readAllItems_(optSheet) {
  var sheet = optSheet || getItemsSheet_()
  ensureHeader_(sheet)
  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return []

  var numRows = lastRow - 1
  var range = sheet.getRange(2, 1, numRows, HEADERS.length)
  var values = range.getValues()
  var display = range.getDisplayValues()
  var timeZone = sheet.getParent().getSpreadsheetTimeZone()
  var items = []

  for (var r = 0; r < values.length; r++) {
    if (isEmptyDataRow_(display[r])) continue
    var item = rowToItem_(values[r], display[r], timeZone)
    if (item) items.push(item)
  }
  return items
}

function isEmptyDataRow_(row) {
  for (var c = 0; c < row.length; c++) {
    if (String(row[c] || '').trim()) return false
  }
  return true
}

function rowToItem_(valuesRow, displayRow, timeZone) {
  var now = Date.now()
  var name = String(displayRow[1] || '').trim()
  if (!name) return null

  var lowVal = valuesRow[7]
  var lowStockThreshold =
    lowVal === '' || lowVal == null ? null : Number(lowVal)
  if (lowStockThreshold !== null && !isFinite(lowStockThreshold)) lowStockThreshold = null

  return {
    id: String(displayRow[0] != null ? displayRow[0] : valuesRow[0] || '').trim(),
    name: name,
    quantity: Number(valuesRow[2]) || 0,
    unit: String(displayRow[3] || 'pcs').trim() || 'pcs',
    category: String(displayRow[4] || '').trim(),
    expiryDate: parseExpiryDate(valuesRow[5], displayRow[5], timeZone),
    notes: String(displayRow[6] || '').trim(),
    lowStockThreshold: lowStockThreshold,
    barcode: String(displayRow[8] != null ? displayRow[8] : valuesRow[8] || '').trim(),
    createdAt: parseSyncTimestamp(valuesRow[9], now),
    updatedAt: parseSyncTimestamp(valuesRow[10], now),
    deleted: isDeletedFlag(displayRow[11] != null ? displayRow[11] : valuesRow[11]),
    brand: String(displayRow[12] != null ? displayRow[12] : valuesRow[12] || '').trim(),
    imageUrl: String(displayRow[13] != null ? displayRow[13] : valuesRow[13] || '').trim(),
  }
}

function publicItem_(item) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    expiryDate: item.expiryDate,
    notes: item.notes,
    lowStockThreshold: item.lowStockThreshold,
    barcode: item.barcode,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deleted: item.deleted,
    brand: item.brand || '',
    image_url: item.imageUrl || '',
  }
}

function normalizeIncoming_(raw) {
  if (!raw || typeof raw !== 'object') return null
  var now = Date.now()
  var name = String(raw.name || '').trim()
  if (!name) return null

  var expiry = raw.expiryDate
  var expiryStr = null
  if (typeof expiry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expiry)) expiryStr = expiry

  var low = raw.lowStockThreshold
  var lowStockThreshold = low == null || low === '' ? null : Number(low)
  if (lowStockThreshold !== null && !isFinite(lowStockThreshold)) lowStockThreshold = null

  var hadBrand = Object.prototype.hasOwnProperty.call(raw, 'brand')
  var brand = hadBrand ? String(raw.brand || '').trim() : ''

  var hadImageUrl =
    Object.prototype.hasOwnProperty.call(raw, 'imageUrl') ||
    Object.prototype.hasOwnProperty.call(raw, 'image_url')
  var imageUrl = ''
  if (Object.prototype.hasOwnProperty.call(raw, 'imageUrl')) {
    imageUrl = String(raw.imageUrl || '').trim()
  } else if (Object.prototype.hasOwnProperty.call(raw, 'image_url')) {
    imageUrl = String(raw.image_url || '').trim()
  }

  return {
    hadBrand: hadBrand,
    hadImageUrl: hadImageUrl,
    item: {
      id: String(raw.id || '').trim(),
      name: name,
      quantity: Number(raw.quantity) || 0,
      unit: String(raw.unit || 'pcs').trim() || 'pcs',
      category: String(raw.category || '').trim(),
      expiryDate: expiryStr,
      notes: String(raw.notes || '').trim(),
      lowStockThreshold: lowStockThreshold,
      barcode: String(raw.barcode || '').trim(),
      createdAt: parseSyncTimestamp(raw.createdAt, now),
      updatedAt: parseSyncTimestamp(raw.updatedAt, now),
      deleted: isDeletedFlag(raw.deleted),
      brand: brand,
      imageUrl: imageUrl,
    },
  }
}

function itemToRow_(item) {
  return [
    String(item.id || ''),
    String(item.name || ''),
    Number(item.quantity) || 0,
    String(item.unit || 'pcs'),
    String(item.category || ''),
    item.expiryDate ? String(item.expiryDate) : '',
    String(item.notes || ''),
    item.lowStockThreshold == null ? '' : item.lowStockThreshold,
    item.barcode != null ? String(item.barcode) : '',
    parseSyncTimestamp(item.createdAt, Date.now()),
    parseSyncTimestamp(item.updatedAt, Date.now()),
    item.deleted ? 'TRUE' : '',
    item.brand != null ? String(item.brand) : '',
    item.imageUrl != null ? String(item.imageUrl) : '',
  ]
}

function writeAllItems_(sheet, items) {
  ensureHeader_(sheet)
  var lastRow = sheet.getLastRow()
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent()
  }

  if (!items.length) return

  var rows = items.map(itemToRow_)
  var numRows = rows.length

  // Text format before setValues so dates/barcodes are not coerced.
  sheet.getRange(2, TEXT_COLUMNS.id, numRows, 1).setNumberFormat('@')
  sheet.getRange(2, TEXT_COLUMNS.expiryDate, numRows, 1).setNumberFormat('@')
  sheet.getRange(2, TEXT_COLUMNS.barcode, numRows, 1).setNumberFormat('@')
  sheet.getRange(2, TEXT_COLUMNS.brand, numRows, 1).setNumberFormat('@')
  sheet.getRange(2, TEXT_COLUMNS.imageUrl, numRows, 1).setNumberFormat('@')
  sheet.getRange(2, 10, numRows, 1).setNumberFormat('0')
  sheet.getRange(2, 11, numRows, 1).setNumberFormat('0')

  sheet.getRange(2, 1, numRows, HEADERS.length).setValues(rows)
}

function assignBlankIds_(sheet, items) {
  var now = Date.now()
  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return

  var display = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues()
  var changed = false

  for (var r = 0; r < display.length; r++) {
    var row = display[r]
    if (isEmptyDataRow_(row)) continue
    var id = String(row[0] || '').trim()
    var name = String(row[1] || '').trim()
    if (id || !name) continue

    var newId = Utilities.getUuid()
    var sheetRow = r + 2
    sheet.getRange(sheetRow, 1).setNumberFormat('@')
    sheet.getRange(sheetRow, 1).setValue(newId)
    sheet.getRange(sheetRow, 11).setNumberFormat('0')
    sheet.getRange(sheetRow, 11).setValue(now)
    if (!String(row[9] || '').trim()) {
      sheet.getRange(sheetRow, 10).setNumberFormat('0')
      sheet.getRange(sheetRow, 10).setValue(now)
    }
    changed = true
  }

  if (changed) {
    SpreadsheetApp.flush()
  }
}

/**
 * Bump updatedAt when a human edits item fields in the sheet UI (not header row).
 */
/**
 * One-off: fill column N (image_url) for rows that have a barcode in the bundled map.
 * Set THUMB_BASE to your deployed app origin before running (Extensions → Apps Script → Run).
 * Do not run against production without reviewing a copy of the sheet first.
 */
function backfillImageUrls() {
  var THUMB_BASE = 'https://kchaisor.github.io/Pantry-tracker-/thumbs/'
  var THUMB_BARCODE_SLUG = {
    '8410660098804': 'la-espanola-olive-oil',
  }
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) {
    throw new Error('Could not acquire lock')
  }
  try {
    var sheet = getItemsSheet_()
    ensureHeader_(sheet)
    var items = readAllItems_(sheet)
    var changed = false
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      if (item.imageUrl) continue
      var code = String(item.barcode || '').trim()
      var slug = code ? THUMB_BARCODE_SLUG[code] : null
      if (!slug) continue
      item.imageUrl = THUMB_BASE + slug + '.jpg'
      changed = true
    }
    if (changed) writeAllItems_(sheet, items)
  } finally {
    lock.releaseLock()
  }
}

function onEdit(e) {
  if (!e || !e.range) return
  var sheet = e.range.getSheet()
  if (sheet.getName() !== SHEET_TAB) return
  if (e.range.getRow() < 2) return

  var col = e.range.getColumn()
  // Column 11 = updatedAt, 12 = deleted — skip if editing those directly
  if (col === 11 || col === 12) return

  var row = e.range.getRow()
  var idCell = sheet.getRange(row, 1)
  var nameCell = sheet.getRange(row, 2)
  if (!String(nameCell.getDisplayValue()).trim()) return

  if (!String(idCell.getDisplayValue()).trim()) {
    idCell.setNumberFormat('@')
    idCell.setValue(Utilities.getUuid())
  }

  sheet.getRange(row, 11).setNumberFormat('0')
  sheet.getRange(row, 11).setValue(Date.now())
}
