<template>
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;gap:16px;">
    <div style="width:64px;height:64px;background:rgba(99,102,241,0.12);border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
      <FileText :size="28" />
    </div>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">Blank Letterhead</div>
      <div style="font-size:13px;color:var(--ct-muted);margin-top:4px;max-width:380px;">
        Downloads a single blank A4 page with only the company header and footer — same style as the AMC Contract PDF letterhead — ready to print or type over.
      </div>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn-primary" @click="downloadPdf" :disabled="downloading">
        <Download :size="16" /> {{ downloading === 'pdf' ? 'Generating…' : 'Download as PDF' }}
      </button>
      <button class="btn-secondary" @click="downloadWord" :disabled="downloading">
        <FileText :size="16" /> {{ downloading === 'word' ? 'Generating…' : 'Download as Word' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download, FileText } from 'lucide-vue-next'
import { useUIStore } from '@/stores/ui'
import { buildLetterheadHtml } from '@/utils/letterheadTemplate'
import { convertHtmlToPdf, triggerDownload } from '@/composables/usePdfApiService'
import { loadBillingConfig } from '@/composables/useBillingPDF'

const ui = useUIStore()
const downloading = ref(false)

async function downloadPdf() {
  downloading.value = 'pdf'
  try {
    const ctx = await loadBillingConfig()
    const company = ctx?.company || {}
    const html = buildLetterheadHtml(company)
    const filename = `${(company.name || 'Letterhead').replace(/\s+/g, '-')}-Letterhead.pdf`
    const retrieveUrl = await convertHtmlToPdf(html, filename, 'letterhead')
    triggerDownload(retrieveUrl, filename)
    ui.success('Letterhead PDF download started.')
  } catch (e) {
    ui.error('Failed to generate letterhead: ' + (e?.message || e))
  } finally {
    downloading.value = false
  }
}

async function downloadWord() {
  downloading.value = 'word'
  try {
    const ctx = await loadBillingConfig()
    const company = ctx?.company || {}
    const { buildLetterheadDocxBase64 } = await import('@/utils/letterheadDocx')
    const base64 = await buildLetterheadDocxBase64(company)
    const filename = `${(company.name || 'Letterhead').replace(/\s+/g, '-')}-Letterhead.docx`
    const { saveBytesToDownloads } = await import('@/utils/saveFile')
    await saveBytesToDownloads(filename, base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ui)
  } catch (e) {
    ui.error('Failed to generate letterhead: ' + (e?.message || e))
  } finally {
    downloading.value = false
  }
}
</script>
