<template>
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;gap:16px;">
    <div style="width:64px;height:64px;background:rgba(99,102,241,0.12);border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
      <FileText :size="28" />
    </div>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">Blank Letterhead PDF</div>
      <div style="font-size:13px;color:var(--ct-muted);margin-top:4px;max-width:380px;">
        Downloads a single blank A4 page with only the company header and footer — same style as the AMC Contract PDF letterhead — ready to print or type over.
      </div>
    </div>
    <button class="btn-primary" @click="download" :disabled="downloading">
      <Download :size="16" /> {{ downloading ? 'Generating…' : 'Download Letterhead PDF' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download, FileText } from 'lucide-vue-next'
import { useUIStore } from '@/stores/ui'
import { useCompanyConfig } from '@/composables/useCompanyConfig'
import { buildLetterheadHtml } from '@/utils/letterheadTemplate'
import { convertHtmlToPdf, triggerDownload } from '@/composables/usePdfApiService'

const ui = useUIStore()
const { company, load } = useCompanyConfig()
const downloading = ref(false)

async function download() {
  downloading.value = true
  try {
    await load()
    const html = buildLetterheadHtml(company.value)
    const filename = `${(company.value.name || 'Letterhead').replace(/\s+/g, '-')}-Letterhead.pdf`
    const retrieveUrl = await convertHtmlToPdf(html, filename, 'letterhead')
    triggerDownload(retrieveUrl, filename)
    ui.success('Letterhead PDF download started.')
  } catch (e) {
    ui.error('Failed to generate letterhead: ' + (e?.message || e))
  } finally {
    downloading.value = false
  }
}
</script>
