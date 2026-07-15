<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Receipt :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Billing
        </h1>
        <p class="page-sub">Quotes, proforma invoices, purchase orders &amp; tax invoices — all in one place.</p>
      </div>
    </div>

    <div class="tabs-nav" style="margin-bottom:24px;">
      <button :class="['tab-btn', activeTab === 'quotations' && 'active']" @click="activeTab = 'quotations'">
        <FileText :size="14" style="display:inline;margin-right:4px;" />
        Quotations
      </button>
      <button :class="['tab-btn', activeTab === 'proforma' && 'active']" @click="activeTab = 'proforma'">
        <FileCheck :size="14" style="display:inline;margin-right:4px;" />
        Proforma Invoices
      </button>
      <button :class="['tab-btn', activeTab === 'po' && 'active']" @click="activeTab = 'po'">
        <ShoppingCart :size="14" style="display:inline;margin-right:4px;" />
        Purchase Orders
      </button>
      <button :class="['tab-btn', activeTab === 'tax' && 'active']" @click="activeTab = 'tax'">
        <Receipt :size="14" style="display:inline;margin-right:4px;" />
        Tax Invoices
      </button>
    </div>

    <div class="table-container" style="padding:20px;">
      <QuotationsTab
        v-if="activeTab === 'quotations'"
        ref="quotationsTabRef"
        @convert-to-pi="handleConvertToPI"
      />
      <ProformaInvoicesTab
        v-else-if="activeTab === 'proforma'"
        ref="proformaTabRef"
        @convert-to-ti="handleConvertToTI"
      />
      <PurchaseOrdersTab v-else-if="activeTab === 'po'" />
      <TaxInvoicesTab v-else-if="activeTab === 'tax'" ref="taxTabRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Receipt, FileText, FileCheck, ShoppingCart } from 'lucide-vue-next'
import QuotationsTab from './tabs/QuotationsTab.vue'
import ProformaInvoicesTab from './tabs/ProformaInvoicesTab.vue'
import PurchaseOrdersTab from './tabs/PurchaseOrdersTab.vue'
import TaxInvoicesTab from './tabs/TaxInvoicesTab.vue'

const activeTab = ref('quotations')
const quotationsTabRef = ref(null)
const proformaTabRef = ref(null)
const taxTabRef = ref(null)

async function handleConvertToPI(quotationRow) {
  activeTab.value = 'proforma'
  await nextTick()
  proformaTabRef.value?.openWithData(quotationRow)
}

async function handleConvertToTI(piRow) {
  activeTab.value = 'tax'
  await nextTick()
  taxTabRef.value?.openWithData(piRow)
}
</script>

<style scoped>
.page-container { padding: 28px; }
</style>
