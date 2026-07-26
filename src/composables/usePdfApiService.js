/**
 * usePdfApiService — HTML-to-PDF via external API with Firestore caching.
 *
 * Flow:
 *  1. Check Firestore pdfCache for a stored retrieveUrl for this document.
 *  2. If the document hasn't changed since the last conversion → return cached URL (no API call).
 *  3. Otherwise call the API, save retrieveUrl to Firestore, return the new URL.
 *
 * The retrieveUrl is permanent (S3-backed redirect). Store it — never the downloadUrl (1-hour expiry).
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'

const API_BASE = 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com'
const API_KEY  = 'Ambivare@9822091922'

// Bump this when rendering logic changes significantly (e.g. new placeholders added).
// Any cached PDFs from a previous render version are discarded.
const RENDER_VERSION = 6

// ── Timestamp normalisation ──────────────────────────────────────────────────

function toMs(ts) {
  if (!ts) return 0
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()     // Firestore Timestamp
  if (ts instanceof Date)             return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000           // raw Firestore Timestamp shape
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime()
  return 0
}

// ── Firestore cache ──────────────────────────────────────────────────────────

function cacheRef(docId, templateKey) {
  return doc(db, 'pdfCache', `${docId}_${templateKey}`)
}

async function getCached(docId, templateKey) {
  try {
    const snap = await getDoc(cacheRef(docId, templateKey))
    return snap.exists() ? snap.data() : null
  } catch { return null }
}

async function saveCache(docId, templateKey, pdfId, retrieveUrl, docUpdatedAt, configUpdatedAt) {
  try {
    await setDoc(cacheRef(docId, templateKey), {
      pdfId,
      retrieveUrl,
      docUpdatedAt:    toMs(docUpdatedAt),
      configUpdatedAt: toMs(configUpdatedAt),
      renderVersion:   RENDER_VERSION,
      cachedAt:        Date.now(),
    })
  } catch (e) {
    console.warn('[PdfApiService] cache write failed:', e)
  }
}

// ── API call ─────────────────────────────────────────────────────────────────

async function callApi(html, filename, documentRef) {
  const res = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key':    API_KEY,
    },
    body: JSON.stringify({
      type:        'html',
      content:     html,
      output:      's3',
      softwareId:  'micro-elevators',
      documentRef: documentRef || 'doc',
      filename:    filename    || 'document.pdf',
      page: {
        size:   'A4',
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      },
      pdf:    { printBackground: true },
      render: { deviceScaleFactor: 2, waitUntil: 'networkidle0' },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `PDF API returned ${res.status}`)
  }

  const data = await res.json()
  // Expected: { id, retrieveUrl, downloadUrl, sizeBytes, generatedAt }
  if (!data.retrieveUrl) throw new Error('PDF API response missing retrieveUrl')
  return data
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * One-shot HTML → PDF conversion without Firestore caching.
 * Use this for documents whose content depends on runtime form inputs
 * (e.g. AMC contracts) where caching by document ID isn't meaningful.
 */
export async function convertHtmlToPdf(html, filename, documentRef) {
  const result = await callApi(html, filename, documentRef)
  return result.retrieveUrl
}

/**
 * Download a PDF from a URL.
 * - Native APK: fetches bytes, writes to the app's private cache (the only
 *   directory writable without special permission on Android 10+ scoped
 *   storage), then hands off to the native Share sheet so the user can save
 *   it to Downloads, Drive, WhatsApp, etc. themselves.
 * - Browser: triggers standard <a> download.
 */
export async function triggerDownload(retrieveUrl, filename) {
  const fname = filename || 'document.pdf'
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const response = await fetch(retrieveUrl)
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
      const blob = await response.blob()
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await Filesystem.writeFile({ path: fname, data: base64, directory: Directory.Cache, recursive: true })
      const { uri } = await Filesystem.getUri({ path: fname, directory: Directory.Cache })
      const { Share } = await import('@capacitor/share')
      await Share.share({ title: fname, files: [uri], dialogTitle: 'Save or share' })
      return
    }
  } catch (e) {
    if (/cancel/i.test(e?.message || '')) return
    console.warn('[PDF] Native download failed, falling back to browser:', e)
  }
  // Browser fallback
  const a = document.createElement('a')
  a.href     = retrieveUrl
  a.target   = '_blank'
  a.rel      = 'noopener'
  a.download = fname
  document.body.appendChild(a)
  a.click()
  setTimeout(() => document.body.removeChild(a), 200)
}

/**
 * Main entry point used by PDFDownloadButton.
 *
 * - Reads Firestore cache keyed by `${row.id}_${templateKey}`.
 * - If the document's updatedAt matches the cache, returns the stored retrieveUrl (no API call).
 * - Otherwise calls the API, saves the new retrieveUrl to Firestore, returns it.
 *
 * @param {Object} row          Firestore document row (must have .id and .updatedAt)
 * @param {string} templateKey  'quotation' | 'proforma' | 'taxInvoice' | 'purchaseOrder' | 'bom'
 * @param {string} html         Rendered HTML string for the document
 * @param {string} filename     Desired filename, e.g. "Q-001-QUOTATION.pdf"
 * @returns {Promise<string>}   Permanent retrieveUrl
 */
export async function generateOrGetPdf(row, templateKey, html, filename, configUpdatedAt) {
  const docId          = row.id
  const docUpdatedMs   = toMs(row.updatedAt)
  const cfgUpdatedMs   = toMs(configUpdatedAt)

  // 1. Check cache — re-use only if BOTH the document AND the config template haven't changed
  if (docId) {
    const cached = await getCached(docId, templateKey)
    if (cached?.retrieveUrl && docUpdatedMs > 0) {
      const docMatch = Math.abs(docUpdatedMs - (cached.docUpdatedAt || 0)) < 3000
      const cfgMatch = cfgUpdatedMs > 0
        ? Math.abs(cfgUpdatedMs - (cached.configUpdatedAt || 0)) < 3000
        : true
      const versionMatch = (cached.renderVersion || 1) === RENDER_VERSION
      if (docMatch && cfgMatch && versionMatch) {
        return cached.retrieveUrl
      }
    }
  }

  // 2. Call API
  const documentRef = row.docNumber || row.bomNumber || docId || 'doc'
  const result = await callApi(html, filename, documentRef)

  // 4. Persist retrieveUrl in Firestore for future re-downloads
  if (docId) {
    await saveCache(docId, templateKey, result.id, result.retrieveUrl, row.updatedAt, configUpdatedAt)
  }

  return result.retrieveUrl
}
