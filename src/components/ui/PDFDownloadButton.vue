<template>
  <!--
    Single-click PDF download for Billing documents and BOM.
    Uses HTML-to-PDF API → S3 storage → Firestore-cached retrieveUrl.
    Re-conversion only happens when the document has been edited since last download.
    Saves straight to the device's Downloads folder — no Share sheet.
  -->
  <button
    v-bind="$attrs"
    :disabled="loading"
    :title="loading ? 'Generating PDF…' : ($attrs.title || 'Download PDF')"
    @click.stop="download"
  >
    <Loader2 v-if="loading" :size="12" class="spin" />
    <slot v-else />
  </button>
</template>

<script setup>
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { loadBillingConfig, renderBillingHtml, getDocMeta } from '@/composables/useBillingPDF'
import { generateOrGetPdf, downloadPdfToDownloads } from '@/composables/usePdfApiService'
import { useUIStore } from '@/stores/ui'

const props = defineProps({
  row:         { type: Object, required: true },
  templateKey: { type: String, required: true },
})

const ui      = useUIStore()
const loading = ref(false)

async function download() {
  if (loading.value) return
  loading.value = true
  try {
    const config           = await loadBillingConfig()
    const html             = renderBillingHtml(props.row, props.templateKey, config)
    const { filename }     = getDocMeta(props.row, props.templateKey)
    const url              = await generateOrGetPdf(props.row, props.templateKey, html, filename, config.updatedAt)
    await downloadPdfToDownloads(url, filename, ui)
  } catch (e) {
    ui.error(e?.message || 'PDF generation failed. Please try again.')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
