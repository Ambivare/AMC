// Shared company logo for PDF generation — same image as the app icon.
// Cached as a base64 data URI so it's embeddable in HTML sent to the
// external PDF API (which can't resolve our app's relative asset paths)
// and in jsPDF's addImage (which needs raw image data anyway).

let cached = null
let triedFetch = false

export async function getLogoDataUri() {
  if (cached) return cached
  if (triedFetch) return null
  triedFetch = true
  try {
    const res = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    cached = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return cached
  } catch {
    return null
  }
}

// Generic path -> data URI cache, used for the Installation Proposal's
// image-based header.jpg / footer.jpg (as opposed to a CSS-built header).
const staticImgCache = {}

export async function getStaticImageDataUri(path) {
  if (staticImgCache[path]) return staticImgCache[path]
  const p = (async () => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  })()
  staticImgCache[path] = p
  return p
}

export const getHeaderImgDataUri = () => getStaticImageDataUri('/static/header.jpg')
export const getFooterImgDataUri = () => getStaticImageDataUri('/static/footer.jpg')
