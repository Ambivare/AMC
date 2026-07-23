import { Capacitor } from '@capacitor/core'

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
