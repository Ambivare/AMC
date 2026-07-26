import { Capacitor, registerPlugin } from '@capacitor/core'

// Native plugin (android/app/src/main/java/com/sk/elevators/SaveToDownloadsPlugin.java)
// writes a file directly into the device's public Downloads folder via
// MediaStore (API 29+) or a permissioned legacy file write (API 23-28) —
// no Share sheet involved.
const SaveToDownloadsNative = registerPlugin('SaveToDownloads')

// Chunk-based base64 to avoid call stack overflow on large PDFs
function toBase64(data) {
  const bytes = data instanceof Uint8Array
    ? data
    : new Uint8Array(data instanceof ArrayBuffer ? data : (data.buffer || data))
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// Android 10+ (scoped storage) blocks direct writes to public storage
// (Directory.ExternalStorage / Directory.Documents) with EACCES unless the
// app holds the broad MANAGE_EXTERNAL_STORAGE permission, which this app
// doesn't request. The reliable, permission-free approach on every modern
// Android version: write to the app's private cache (always writable) and
// hand off to the native Share sheet (backed by the FileProvider already
// declared in AndroidManifest.xml) so the user can save it to Downloads,
// Drive, WhatsApp, etc. themselves.
async function writeToDevice(filename, base64, ui) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    })
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: filename, files: [uri], dialogTitle: 'Save or share' })
  } catch (e) {
    if (/cancel/i.test(e?.message || '')) return
    console.error('[saveFile] Save/share failed:', e)
    ui?.error('Could not save file: ' + (e?.message || 'Unknown error'))
  }
}

// Writes bytes directly into the device's public Downloads folder (native),
// or triggers a normal browser download (web) — no Share sheet involved.
export async function saveBytesToDownloads(filename, base64, mimeType, ui) {
  if (Capacitor.isNativePlatform()) {
    try {
      await SaveToDownloadsNative.save({ data: base64, filename, mimeType })
      ui?.success?.('Saved to Downloads: ' + filename)
    } catch (e) {
      if (/cancel/i.test(e?.message || '')) return
      console.error('[saveFile] Save to Downloads failed:', e)
      ui?.error?.('Could not save to Downloads: ' + (e?.message || 'Unknown error'))
    }
    return
  }
  const a = document.createElement('a')
  a.href = `data:${mimeType};base64,${base64}`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => document.body.removeChild(a), 200)
}

/**
 * Save a jsPDF document directly to the Downloads folder (native) or trigger
 * a normal browser download (web) — bypasses the Share sheet.
 */
export async function savePDFToDownloads(doc, filename, ui) {
  try {
    const buf = doc.output('arraybuffer')
    await saveBytesToDownloads(filename, toBase64(buf), 'application/pdf', ui)
  } catch (e) {
    console.error('[savePDFToDownloads]', e)
    ui?.error?.('PDF save failed: ' + (e?.message || e))
  }
}

/**
 * Save a jsPDF document.
 * Native Android: writes to app Documents folder (visible in Files > Phone > Android > data).
 * Browser: triggers standard browser download.
 */
export async function savePDF(doc, filename, ui) {
  if (Capacitor.isNativePlatform()) {
    try {
      const buf = doc.output('arraybuffer')
      await writeToDevice(filename, toBase64(buf), ui)
    } catch (e) {
      console.error('[savePDF]', e)
      ui?.error('PDF export failed: ' + (e?.message || e))
    }
  } else {
    doc.save(filename)
  }
}

/**
 * Save a SheetJS workbook.
 * Native Android: writes to app Documents folder.
 * Browser: triggers standard browser download.
 */
export async function saveExcel(wb, filename, ui) {
  if (Capacitor.isNativePlatform()) {
    try {
      const XLSX = await import('xlsx')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      await writeToDevice(filename, toBase64(new Uint8Array(buf)), ui)
    } catch (e) {
      console.error('[saveExcel]', e)
      ui?.error('Excel export failed: ' + (e?.message || e))
    }
  } else {
    const XLSX = await import('xlsx')
    XLSX.writeFile(wb, filename)
  }
}
