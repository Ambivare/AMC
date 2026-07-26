<template>
  <div>
    <!-- Toolbar -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search quotations…" />
      </div>
      <select v-model="statusFilter" class="input" style="width:160px;">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="accepted">Accepted</option>
        <option value="rejected">Rejected</option>
        <option value="converted">Converted to PI</option>
      </select>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="16" /> New Quotation
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No quotations found."
      :on-row-click="openView"
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div style="font-weight:500;color:var(--ct-primary);">{{ row.docNumber }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ formatDate(row.date) }}</div>
        </td>
        <td>
          <div class="db-s" style="color:var(--ct-sub);">{{ row.projectId ? getProjectName(row.projectId) : row.clientName }}</div>
          <div class="db-s" style="font-size:11px;color:var(--ct-muted);">{{ row.projectId ? row.clientName : row.clientGST }}</div>
        </td>
        <td>
          <div style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.total) }}</div>
          <div v-if="row.numberOfLifts" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
            {{ row.numberOfLifts }} lift{{ row.numberOfLifts > 1 ? 's' : '' }}
          </div>
        </td>
        <td><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'draft' }}</span></td>
        <td @click.stop>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <button class="btn-success btn-sm" :disabled="pdfLoading[row.id]" @click="downloadPDF(row)" title="PDF">
              <Loader2 v-if="pdfLoading[row.id]" :size="12" class="spin" />
              <Download v-else :size="12" />
            </button>
            <button class="btn-excel btn-sm" @click="downloadRowExcel(row)" title="Download Excel"><FileSpreadsheet :size="12" /></button>
            <button style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;font-size:12px;background:rgba(34,197,94,0.1);color:#4ade80;border:1px solid rgba(34,197,94,0.2);cursor:pointer;" @click="openEmail(row)" title="Send Email"><Mail :size="12" /></button>
            <button class="btn-warning btn-sm" @click="convertToPI(row)" title="Convert to Proforma Invoice" :disabled="row.status === 'converted'">
              <ArrowRight :size="12" />
            </button>
            <button class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Quotation' : 'New Quotation'" width="800px">
      <div class="form-grid" style="margin-bottom:20px;">
        <!-- Project Link Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
                <FolderOpen :size="16" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link to Project</div>
                <div style="font-size:11px;color:var(--ct-muted);">Auto-fill client details from an existing project</div>
              </div>
            </div>
            <button type="button" @click="billUseProject = !billUseProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${billUseProject ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`">
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${billUseProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>
        <!-- Project Search (when toggle ON) -->
        <div v-if="billUseProject" class="form-group form-full">
          <label class="label">Select Project</label>
          <div style="position:relative;">
            <input v-model="billProjectSearch" class="input" placeholder="Search project name…"
              @focus="billShowProjectDropdown = true" @blur="billDelayCloseDropdown" />
            <div v-if="billShowProjectDropdown && billFilteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div v-for="p in billFilteredProjects" :key="p.id" @mousedown.prevent="selectBillProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.projectId === p.id ? 'background:rgba(99,102,241,0.15);' : ''">
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.city || p.address || '—' }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:6px;font-size:12px;color:var(--ct-green);">✓ Project linked — client details auto-filled below</div>
        </div>

        <!-- Wings / Lifts Selector (when project linked and has buildings) -->
        <div v-if="billUseProject && form.projectId && selectedProjectBuildings.length" class="form-group form-full">
          <label class="label">Select Lifts for this Quotation</label>
          <div style="background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px 14px;">
            <div v-for="(b, bi) in selectedProjectBuildings" :key="bi" style="margin-bottom:10px;">
              <div style="font-size:12px;font-weight:600;color:var(--ct-primary);margin-bottom:6px;">
                {{ b.name || `Building ${bi + 1}` }}
              </div>
              <div v-for="(w, wi) in (b.wings || [])" :key="wi" style="margin-left:10px;margin-bottom:6px;">
                <div style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">{{ w.name || `Wing ${wi + 1}` }}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  <label v-for="(l, li) in (w.lifts || [])" :key="li"
                    style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.05);">
                    <input type="checkbox" :value="l.id" v-model="form.selectedLiftIds" style="margin:0;" />
                    <span>{{ l.id }}{{ l.type ? ' – ' + l.type : '' }}</span>
                  </label>
                </div>
              </div>
            </div>
            <div v-if="form.selectedLiftIds.length" style="margin-top:6px;font-size:11px;color:var(--ct-accent);">
              {{ form.selectedLiftIds.length }} lift{{ form.selectedLiftIds.length > 1 ? 's' : '' }} selected
            </div>
          </div>
        </div>

        <!-- BOM Link Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(16,185,129,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#10b981;">
                <Layers :size="16" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link BOM</div>
                <div style="font-size:11px;color:var(--ct-muted);">Attach a Bill of Materials — printed after quotation in PDF</div>
              </div>
            </div>
            <button type="button" @click="toggleBomLink"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${useBom ? '#10b981' : 'rgba(255,255,255,0.12)'};position:relative;`">
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${useBom ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>
        <!-- BOM Search (when toggle ON) -->
        <div v-if="useBom" class="form-group form-full">
          <label class="label">Select BOM</label>
          <div style="position:relative;">
            <input v-model="bomSearch" class="input" placeholder="Search BOM number or project…"
              @focus="bomDropdownOpen = true" @blur="bomDelayClose" />
            <div v-if="bomDropdownOpen && filteredBoms.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:220px;overflow-y:auto;margin-top:4px;">
              <div v-for="b in filteredBoms" :key="b.id" @mousedown.prevent="selectBom(b)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.linkedBomId === b.id ? 'background:rgba(16,185,129,0.15);' : ''">
                <div style="font-weight:600;">{{ b.bomNumber }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
                  {{ getBomProjectName(b.projectId) }} · {{ b.items?.length || 0 }} items · {{ b.status || 'draft' }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="form.linkedBomId" style="margin-top:6px;font-size:12px;color:#10b981;">✓ BOM linked — will be appended as additional page(s) in PDF</div>
          <div v-else-if="useBom" style="margin-top:6px;font-size:12px;color:var(--ct-muted);">No BOM selected yet</div>
        </div>

        <div class="form-group">
          <label class="label">Quotation Number</label>
          <div style="display:flex;gap:6px;">
            <input v-model="form.docNumber" class="input" :placeholder="`Q-${String(items.length + 1).padStart(3, '0')}`" style="flex:1;min-width:0;" />
            <button type="button" class="btn-secondary btn-sm" style="flex-shrink:0;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;" @click="generateQtnNumber" title="Generate: ContractNo/ProjectName/MQTN/FY/Date/Initials">
              <Wand2 :size="12" /> Generate
            </button>
          </div>
          <div style="font-size:10px;color:var(--ct-muted);margin-top:4px;">Format: ContractNo/Project/MQTN/FY/DDMMYYYY/Initials</div>
        </div>
        <div class="form-group">
          <label class="label">Date</label>
          <input v-model="form.date" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client / Company"
            :readonly="billUseProject && !!form.projectId"
            :style="billUseProject && form.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group form-full">
          <label class="label">Client Address</label>
          <textarea v-model="form.clientAddress" class="input" rows="2" placeholder="Address…"
            :readonly="billUseProject && !!form.projectId"
            :style="billUseProject && form.projectId ? 'opacity:.8;' : ''"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Client GST Number</label>
          <input v-model="form.clientGST" class="input" placeholder="22AAAAA0000A1Z5" />
        </div>
        <div class="form-group">
          <label class="label">Contact Person</label>
          <input v-model="form.contactPerson" class="input" placeholder="Name of contact person" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.clientPhone" class="input" placeholder="+91 98765 43210"
            :readonly="billUseProject && !!form.projectId"
            :style="billUseProject && form.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="form.clientEmail" class="input" type="email" placeholder="client@example.com" />
        </div>
        <div class="form-group form-full">
          <label class="label">Lift Description</label>
          <input v-model="form.liftDescription" class="input" placeholder="e.g. 8-Passenger MRL Elevator" />
        </div>
        <div class="form-group">
          <label class="label">Number of Lifts</label>
          <input v-model.number="form.numberOfLifts" class="input" type="number" min="1" placeholder="1" @input="recalc()" />
        </div>
        <div class="form-group">
          <label class="label">Valid Until</label>
          <input v-model="form.validUntil" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">GST (%)</label>
          <select v-model.number="form.gstPercent" class="input" @change="recalc">
            <option :value="0">0%</option>
            <option :value="5">5%</option>
            <option :value="12">12%</option>
            <option :value="18">18%</option>
          </select>
        </div>
      </div>

      <!-- Line Items -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Line Items</div>
          <button class="btn-secondary btn-sm" @click="addLineItem"><Plus :size="12" /> Add Item</button>
        </div>
        <div class="glass" style="border-radius:12px;overflow:hidden;">
          <!-- Header row -->
          <div class="li-header">
            <span class="li-desc">Description</span>
            <span class="li-qty">Qty</span>
            <span class="li-unit">Unit</span>
            <span class="li-rate">Rate (₹)</span>
            <span class="li-amt">Amount (₹)</span>
            <span style="width:36px;flex-shrink:0;"></span>
          </div>
          <!-- Item rows -->
          <div v-for="(item, i) in form.items" :key="i" class="li-row">
            <div class="li-field li-desc"><span class="li-label">Description</span><input v-model="item.description" class="input li-input" placeholder="Item description" @input="recalc" /></div>
            <div class="li-field li-qty"><span class="li-label">Qty</span><input v-model.number="item.quantity" class="input li-input" type="number" min="0" step="1" placeholder="1" @input="calcLine(item); recalc()" /></div>
            <div class="li-field li-unit"><span class="li-label">Unit</span><input v-model="item.unit" class="input li-input li-unit-input" placeholder="Nos" /></div>
            <div class="li-field li-rate"><span class="li-label">Rate (₹)</span><input v-model.number="item.rate" class="input li-input" type="number" min="0" placeholder="0" @input="calcLine(item); recalc()" /></div>
            <div class="li-field li-amt"><span class="li-label">Amount (₹)</span><input :value="item.amount" class="input li-input li-amt-input" readonly /></div>
            <button class="btn-danger btn-sm btn-icon li-del" @click="removeLineItem(i)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>

      <!-- Discount Toggle -->
      <div class="form-group form-full" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.18);border-radius:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <Tag :size="14" style="color:#f59e0b;" />
            <span style="font-size:13px;font-weight:600;color:var(--ct-primary);">Apply Discount</span>
          </div>
          <button type="button" @click="form.discountEnabled = !form.discountEnabled; recalc()"
            :style="`width:40px;height:22px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${form.discountEnabled ? '#f59e0b' : 'rgba(255,255,255,0.12)'};position:relative;`">
            <span :style="`position:absolute;top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${form.discountEnabled ? '20px' : '2px'};`"></span>
          </button>
        </div>
        <div v-if="form.discountEnabled" style="display:flex;gap:10px;margin-top:8px;align-items:flex-end;">
          <div style="flex:1;">
            <label class="label">Discount Type</label>
            <select v-model="form.discountType" class="input" @change="recalc">
              <option value="flat">Flat Amount (₹)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </div>
          <div style="flex:1;">
            <label class="label">{{ form.discountType === 'percent' ? 'Discount %' : 'Discount Amount (₹)' }}</label>
            <input v-model.number="form.discountValue" class="input" type="number" min="0" placeholder="0" @input="recalc" />
          </div>
          <div style="flex:1;">
            <label class="label">Discount Amount</label>
            <input :value="formatCurrency(form.discountAmount)" class="input" readonly style="opacity:.7;" />
          </div>
        </div>
      </div>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;">
        <div class="glass" style="padding:16px 20px;border-radius:12px;min-width:260px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">Subtotal</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.subtotal) }}</span>
          </div>
          <div v-if="form.discountEnabled && form.discountAmount > 0" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:#f59e0b;">Discount{{ form.discountType === 'percent' ? ` (${form.discountValue}%)` : '' }}</span>
            <span style="color:#f59e0b;">− {{ formatCurrency(form.discountAmount) }}</span>
          </div>
          <div v-if="form.discountEnabled && form.discountAmount > 0" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">After Discount</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.discountedSubtotal) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">GST ({{ form.gstPercent }}%)</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.gstAmount) }}</span>
          </div>
          <hr class="divider" style="margin:8px 0;" />
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;">
            <span style="color:var(--ct-primary);">{{ form.numberOfLifts > 1 ? 'Per Lift Total' : 'Total' }}</span>
            <span style="color:var(--ct-accent);">{{ formatCurrency(form.total) }}</span>
          </div>
          <template v-if="form.numberOfLifts > 1">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ct-muted);margin-top:8px;padding:4px 0;">
              <span style="font-style:italic;">× {{ form.numberOfLifts }} Lifts</span>
              <span></span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-top:4px;padding-top:8px;border-top:2px solid rgba(16,185,129,0.35);">
              <span style="color:var(--ct-primary);">Grand Total</span>
              <span style="color:#10b981;">{{ formatCurrency(form.grandTotal) }}</span>
            </div>
          </template>
        </div>
      </div>

      <div class="form-group form-full" style="margin-top:16px;">
        <label class="label">Notes</label>
        <textarea v-model="form.notes" class="input" rows="3" placeholder="Terms, validity, notes…"></textarea>
      </div>

      <!-- Payment Terms -->
      <div style="margin-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Payment Terms</div>
          <button class="btn-secondary btn-sm" type="button" @click="form.paymentTerms.push('')"><Plus :size="12" /> Add Line</button>
        </div>
        <div v-for="(_, i) in form.paymentTerms" :key="'pt'+i" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
          <input v-model="form.paymentTerms[i]" class="input" placeholder="e.g. 30% advance on order confirmation" />
          <button class="btn-danger btn-sm btn-icon" type="button" style="padding:6px;flex-shrink:0;" @click="form.paymentTerms.splice(i,1)"><Trash2 :size="12" /></button>
        </div>
        <div v-if="!form.paymentTerms.length" style="font-size:12px;color:var(--ct-muted);">No payment terms added yet.</div>
      </div>

      <!-- Work Schedule -->
      <div style="margin-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Work Schedule</div>
          <button class="btn-secondary btn-sm" type="button" @click="form.workSchedule.push('')"><Plus :size="12" /> Add Line</button>
        </div>
        <div v-for="(_, i) in form.workSchedule" :key="'ws'+i" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
          <input v-model="form.workSchedule[i]" class="input" placeholder="e.g. Installation: 4–6 weeks from order" />
          <button class="btn-danger btn-sm btn-icon" type="button" style="padding:6px;flex-shrink:0;" @click="form.workSchedule.splice(i,1)"><Trash2 :size="12" /></button>
        </div>
        <div v-if="!form.workSchedule.length" style="font-size:12px;color:var(--ct-muted);">No work schedule added yet.</div>
      </div>

      <!-- Terms & Conditions -->
      <div style="margin-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Terms &amp; Conditions</div>
          <button class="btn-secondary btn-sm" type="button" @click="form.termsConditions.push('')"><Plus :size="12" /> Add Line</button>
        </div>
        <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:8px;margin-bottom:8px;cursor:pointer;">
          <input type="checkbox" v-model="form.freeAmc" style="width:16px;height:16px;accent-color:#10b981;cursor:pointer;" />
          <span style="font-size:12px;font-weight:600;color:#10b981;">Include Free 1 Year AMC</span>
          <span style="font-size:11px;color:var(--ct-muted);margin-left:auto;">Prints in PDF &amp; Excel when enabled</span>
        </label>
        <div v-for="(_, i) in form.termsConditions" :key="'tc'+i" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
          <input v-model="form.termsConditions[i]" class="input" placeholder="e.g. Warranty: 1 year on parts and labour" />
          <button class="btn-danger btn-sm btn-icon" type="button" style="padding:6px;flex-shrink:0;" @click="form.termsConditions.splice(i,1)"><Trash2 :size="12" /></button>
        </div>
        <div v-if="!form.termsConditions.length" style="font-size:12px;color:var(--ct-muted);">No terms added yet.</div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving" @click="save">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editing ? 'Update' : 'Create Quotation') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Quotation" @confirm="doDelete" />
    <EmailModal :show="showEmailModal" :row="emailRow" template-key="quotation" @close="showEmailModal = false" />

    <!-- Quotation Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? (viewTarget.docNumber || 'Quotation') : 'Quotation'" width="600px">
      <template v-if="viewTarget">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div v-if="viewTarget.projectId" style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(viewTarget.projectId) }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.docNumber }} &bull; {{ formatDate(viewTarget.date) }}</div>
            <div style="margin-top:8px;"><span :class="['badge', statusBadge(viewTarget.status)]">{{ viewTarget.status || 'draft' }}</span></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total</div>
              <div style="color:var(--ct-accent);font-weight:700;font-size:15px;">{{ formatCurrency(viewTarget.total) }}</div>
            </div>
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Valid Until</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.validUntil ? formatDate(viewTarget.validUntil) : '—' }}</div>
            </div>
            <div v-if="viewTarget.clientPhone" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Phone</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.clientPhone }}</div>
            </div>
            <div v-if="viewTarget.numberOfLifts" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Lifts</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.numberOfLifts }}</div>
            </div>
            <div v-if="viewTarget.liftDescription" class="glass" style="padding:12px 14px;grid-column:1/-1;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Lift Description</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.liftDescription }}</div>
            </div>
            <div v-if="viewTarget.clientAddress" class="glass" style="padding:12px 14px;grid-column:1/-1;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Address</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.clientAddress }}</div>
            </div>
          </div>
          <div v-if="(viewTarget.items || []).length" class="glass" style="padding:12px 14px;border-radius:10px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Line Items</div>
            <div v-for="(item, i) in viewTarget.items" :key="i" style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="color:var(--ct-sub);">{{ item.description }}</span>
              <span style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(item.amount) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:8px;">
              <span style="color:var(--ct-sub);">Subtotal</span>
              <span style="color:var(--ct-accent);">{{ formatCurrency(viewTarget.subtotal) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;color:var(--ct-muted);">
              <span>GST {{ viewTarget.gstPercent }}%</span>
              <span>{{ formatCurrency(viewTarget.gstAmount) }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-primary" @click="showViewModal = false; openEdit(viewTarget)">Edit</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Search, Pencil, Trash2, Save, Download, ArrowRight, FileSpreadsheet, FolderOpen, Layers, Tag, Loader2, Mail, Wand2 } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmailModal from '@/components/ui/EmailModal.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { db } from '@/firebase/config'
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore'
import { downloadExcel } from '@/composables/useBillingExcel'
import { loadBillingConfig, renderBillingHtml, renderQuotationWithBomHtml, getDocMeta } from '@/composables/useBillingPDF'
import { generateOrGetPdf, triggerDownload } from '@/composables/usePdfApiService'

const emit = defineEmits(['convert-to-pi'])
const ui = useUIStore()
const auth = useAuthStore()
const { items, loading, add, edit, del } = useCollection(Collections.QUOTATIONS)

function tsMs(ts) {
  if (!ts) return 0
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return new Date(ts).getTime()
}
const { items: allProjects } = useCollection(Collections.PROJECTS)
const { items: allBoms } = useCollection(Collections.BOM)

// ── Project Link ─────────────────────────────────────────────────────
const billUseProject = ref(false)
const billProjectSearch = ref('')
const billShowProjectDropdown = ref(false)

const billFilteredProjects = computed(() => {
  const q = billProjectSearch.value.toLowerCase()
  return allProjects.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) ||
    (p.clientName || '').toLowerCase().includes(q)
  )
})

function selectBillProject(p) {
  form.value.projectId = p.id
  billProjectSearch.value = p.projectName
  billShowProjectDropdown.value = false
  form.value.projectName = p.projectName || ''
  form.value.clientName = p.clientName || ''
  form.value.clientPhone = p.phone || p.clientPhone || ''
  form.value.clientAddress = p.address || p.clientAddress || ''
  form.value.clientEmail = p.email || p.clientEmail || ''
}

function billDelayCloseDropdown() {
  setTimeout(() => { billShowProjectDropdown.value = false }, 200)
}

const selectedProjectBuildings = computed(() => {
  if (!form.value.projectId) return []
  const proj = allProjects.value.find(p => p.id === form.value.projectId)
  return proj?.buildings || []
})

// ── BOM Link ─────────────────────────────────────────────────────────
const useBom = ref(false)
const bomSearch = ref('')
const bomDropdownOpen = ref(false)

const filteredBoms = computed(() => {
  const q = bomSearch.value.toLowerCase()
  return allBoms.value.filter(b =>
    (b.bomNumber || '').toLowerCase().includes(q) ||
    getBomProjectName(b.projectId).toLowerCase().includes(q)
  )
})

function getBomProjectName(projectId) {
  if (!projectId) return '—'
  return allProjects.value.find(p => p.id === projectId)?.projectName || '—'
}
function getProjectName(projectId) {
  if (!projectId) return ''
  return allProjects.value.find(p => p.id === projectId)?.projectName || ''
}

function selectBom(b) {
  form.value.linkedBomId = b.id
  bomSearch.value = b.bomNumber
  bomDropdownOpen.value = false
}

function bomDelayClose() {
  setTimeout(() => { bomDropdownOpen.value = false }, 200)
}

function toggleBomLink() {
  useBom.value = !useBom.value
  if (!useBom.value) {
    form.value.linkedBomId = ''
    bomSearch.value = ''
  }
}

// ── Table & Filtering ─────────────────────────────────────────────────
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 20

const filtered = computed(() => {
  let list = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.docNumber?.toLowerCase().includes(q) || r.clientName?.toLowerCase().includes(q) || r.projectName?.toLowerCase().includes(q) || getProjectName(r.projectId)?.toLowerCase().includes(q))
  }
  if (statusFilter.value) list = list.filter(r => r.status === statusFilter.value)
  return list
})
const pagedItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, statusFilter], () => { page.value = 1 })

const columns = [
  { key: 'docNumber', label: 'Quotation #' },
  { key: 'client', label: 'Client' },
  { key: 'total', label: 'Total / Lifts', width: '130px' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'actions', label: 'Actions', width: '200px' },
]

function statusBadge(s) {
  const m = { draft: 'badge-inactive', sent: 'badge-info', accepted: 'badge-active', rejected: 'badge-danger', converted: 'badge-purple' }
  return m[s] || 'badge-inactive'
}
function formatDate(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}
function formatCurrency(v) {
  if (!v && v !== 0) return '—'
  return '₹' + Number(v).toLocaleString('en-IN')
}

// ── Form ─────────────────────────────────────────────────────────────
const showModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }
const editing = ref(null)
const saving = ref(false)
const pdfLoading = ref({})

const defaultForm = () => {
  const today = new Date()
  const validity = new Date(today)
  validity.setDate(today.getDate() + 30)
  return {
    projectId: '', linkedBomId: '', projectName: '',
    docNumber: '', date: today.toISOString().split('T')[0],
    validUntil: validity.toISOString().split('T')[0],
    status: 'draft', clientName: '', clientAddress: '', clientGST: '',
    contactPerson: '', clientPhone: '', clientEmail: '', liftDescription: '', numberOfLifts: 1,
    selectedLiftIds: [],
    items: [{ description: '', quantity: 1, unit: '', rate: 0, amount: 0 }],
    subtotal: 0, gstPercent: 18, gstAmount: 0, total: 0, grandTotal: 0, notes: '',
    discountEnabled: false, discountType: 'flat', discountValue: 0,
    discountAmount: 0, discountedSubtotal: 0,
    paymentStatus: 'unpaid', paidAmount: 0,
    paymentTerms: [], workSchedule: [], termsConditions: [], freeAmc: false,
  }
}
const form = ref(defaultForm())

function addLineItem() { form.value.items.push({ description: '', quantity: 1, unit: '', rate: 0, amount: 0 }) }
function removeLineItem(i) { form.value.items.splice(i, 1); recalc() }

function calcLine(item) {
  item.amount = Math.round((item.quantity || 0) * (item.rate || 0) * 100) / 100
}

function recalc() {
  const subtotal = form.value.items.reduce((s, i) => s + (i.amount || 0), 0)
  form.value.subtotal = subtotal

  let discountAmount = 0
  if (form.value.discountEnabled) {
    if (form.value.discountType === 'percent') {
      discountAmount = Math.round(subtotal * (form.value.discountValue || 0) / 100 * 100) / 100
    } else {
      discountAmount = Math.min(form.value.discountValue || 0, subtotal)
    }
  }
  form.value.discountAmount = discountAmount
  form.value.discountedSubtotal = subtotal - discountAmount

  form.value.gstAmount = Math.round(form.value.discountedSubtotal * (form.value.gstPercent || 0) / 100)
  form.value.total = form.value.discountedSubtotal + form.value.gstAmount
  form.value.grandTotal = form.value.total * (form.value.numberOfLifts || 1)
}

// ── Quotation number generator ────────────────────────────────────────
function getFinancialYear(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  return month >= 4
    ? `${String(year).slice(2)}-${String(year + 1).slice(2)}`
    : `${String(year - 1).slice(2)}-${String(year).slice(2)}`
}

function getUserInitials(name) {
  if (!name) return ''
  return name.trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('')
}

function generateQtnNumber() {
  const project = allProjects.value.find(p => p.id === form.value.projectId)
  const contractNo = project?.fileNumber || project?.contractNo || project?.contractNumber || ''
  const projectName = form.value.projectName || project?.projectName || ''
  const fy = getFinancialYear(form.value.date)
  let datePart = ''
  if (form.value.date) {
    const d = new Date(form.value.date)
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      datePart = `${dd}${mm}${d.getFullYear()}`
    }
  }
  const initials = getUserInitials(auth.user?.fullName || auth.user?.name || auth.user?.username || '')
  const parts = [contractNo, projectName, 'MQTN', fy, datePart, initials].filter(Boolean)
  form.value.docNumber = parts.join('/')
}

function openAdd() {
  editing.value = null
  const num = `Q-${String(items.value.length + 1).padStart(3, '0')}`
  form.value = { ...defaultForm(), docNumber: num }
  billUseProject.value = false
  billProjectSearch.value = ''
  useBom.value = false
  bomSearch.value = ''
  showModal.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = {
    ...defaultForm(), ...row,
    items: row.items?.map(i => ({ ...i })) || [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    selectedLiftIds: row.selectedLiftIds ? [...row.selectedLiftIds] : [],
    paymentTerms: row.paymentTerms ? [...row.paymentTerms] : [],
    workSchedule: row.workSchedule ? [...row.workSchedule] : [],
    termsConditions: row.termsConditions ? [...row.termsConditions] : [],
  }
  billUseProject.value = !!row.projectId
  if (row.projectId) {
    const proj = allProjects.value.find(p => p.id === row.projectId)
    billProjectSearch.value = proj?.projectName || ''
  } else {
    billProjectSearch.value = ''
  }
  useBom.value = !!row.linkedBomId
  if (row.linkedBomId) {
    const bom = allBoms.value.find(b => b.id === row.linkedBomId)
    bomSearch.value = bom?.bomNumber || ''
  } else {
    bomSearch.value = ''
  }
  showModal.value = true
}

async function save() {
  if (!form.value.clientName) { ui.error('Client name is required.'); return }
  if (!form.value.items?.length) { ui.error('At least one line item is required.'); return }
  saving.value = true
  try {
    const data = { ...form.value, updatedAt: new Date() }
    if (editing.value) {
      const prevTotal = editing.value.total
      await edit(editing.value.id, data, { action: 'updated', module: 'quotations', tab: 'Billing', summary: `Updated Quotation ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      // Propagate total change to linked Proforma Invoices and Tax Invoices
      if (prevTotal !== data.total && editing.value.id) {
        try {
          const batch = writeBatch(db)
          const piSnap = await getDocs(query(collection(db, Collections.PROFORMA_INVOICES), where('quotationId', '==', editing.value.id)))
          piSnap.forEach(d => {
            const pi = d.data()
            const ratio = prevTotal > 0 ? data.total / prevTotal : 1
            const newSubtotal = Math.round((pi.subtotal || 0) * ratio * 100) / 100
            const newGst = Math.round(newSubtotal * ((pi.gstPercent || 18) / 100) * 100) / 100
            batch.update(doc(db, Collections.PROFORMA_INVOICES, d.id), {
              subtotal: newSubtotal, gstAmount: newGst,
              total: newSubtotal + newGst, updatedAt: new Date(),
            })
          })
          const tiSnap = await getDocs(query(collection(db, Collections.TAX_INVOICES), where('quotationId', '==', editing.value.id)))
          tiSnap.forEach(d => {
            const ti = d.data()
            const ratio = prevTotal > 0 ? data.total / prevTotal : 1
            const newSubtotal = Math.round((ti.subtotal || 0) * ratio * 100) / 100
            const newGst = Math.round(newSubtotal * ((ti.gstPercent || 18) / 100) * 100) / 100
            batch.update(doc(db, Collections.TAX_INVOICES, d.id), {
              subtotal: newSubtotal, gstAmount: newGst,
              total: newSubtotal + newGst, updatedAt: new Date(),
            })
          })
          await batch.commit()
        } catch (e) {
          console.warn('[Quotation] Failed to propagate total to linked docs:', e)
        }
      }
      ui.success('Quotation updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'quotations', tab: 'Billing', summary: `Created Quotation ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total, numberOfLifts: data.numberOfLifts, status: data.status || 'draft' } })
      ui.success('Quotation created.')
    }
    showModal.value = false
  } catch { ui.error('Failed to save quotation.') }
  finally { saving.value = false }
}

const confirmRef = ref(null)
const deleteTarget = ref(null)
function confirmDel(row) { deleteTarget.value = row; confirmRef.value?.open(`Delete ${row.docNumber}? This cannot be undone.`) }
async function doDelete() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'quotations', tab: 'Billing', summary: 'Deleted quotation', details: { id: deleteTarget.value.id } }); ui.success('Quotation deleted.') }
  catch { ui.error('Failed to delete.') }
}

async function downloadRowExcel(row) {
  const resolved = row.projectName || !row.projectId ? row
    : { ...row, projectName: allProjects.value.find(p => p.id === row.projectId)?.projectName || '' }
  try { await downloadExcel(resolved, 'quotation') }
  catch (e) { ui.error('Failed to generate Excel: ' + (e?.message || e)) }
}

async function downloadPDF(row) {
  if (pdfLoading.value[row.id]) return
  pdfLoading.value[row.id] = true
  const resolved = row.projectName || !row.projectId ? row
    : { ...row, projectName: allProjects.value.find(p => p.id === row.projectId)?.projectName || '' }
  try {
    const config = await loadBillingConfig()
    let html
    let bomRow = null
    if (resolved.linkedBomId) {
      const rawBom = allBoms.value.find(b => b.id === resolved.linkedBomId)
      if (rawBom) {
        bomRow = {
          ...rawBom,
          clientName: rawBom.clientName || resolved.clientName || '',
          clientPhone: rawBom.clientPhone || resolved.clientPhone || '',
          clientAddress: rawBom.clientAddress || resolved.clientAddress || '',
          projectName: rawBom.projectName || resolved.projectName || '',
        }
        html = renderQuotationWithBomHtml(resolved, bomRow, config)
      } else {
        html = renderBillingHtml(resolved, 'quotation', config)
      }
    } else {
      html = renderBillingHtml(resolved, 'quotation', config)
    }
    const { filename } = getDocMeta(resolved, 'quotation')
    const effectiveConfigTs = bomRow?.updatedAt
      ? (tsMs(bomRow.updatedAt) > tsMs(config.updatedAt) ? bomRow.updatedAt : config.updatedAt)
      : config.updatedAt
    const url = await generateOrGetPdf(resolved, 'quotation', html, filename, effectiveConfigTs)
    await triggerDownload(url, filename)
    ui.success('PDF ready — opening download.')
  } catch (e) {
    ui.error(e?.message || 'PDF generation failed. Please try again.')
  } finally {
    pdfLoading.value[row.id] = false
  }
}

const showEmailModal = ref(false)
const emailRow = ref(null)
function openEmail(row) {
  if (!row.clientEmail) { ui.warning('No email address on this record. Edit the document and add a client email first.'); return }
  emailRow.value = row.projectName || !row.projectId ? row
    : { ...row, projectName: allProjects.value.find(p => p.id === row.projectId)?.projectName || '' }
  showEmailModal.value = true
}

async function convertToPI(row) {
  try {
    await edit(row.id, { status: 'converted', updatedAt: new Date() }, { action: 'converted', module: 'quotations', tab: 'Billing', summary: `Converted Quotation ${row.docNumber} to Proforma Invoice`, details: { docNumber: row.docNumber, clientName: row.clientName, amount: row.total } })
    ui.success('Converted to Proforma Invoice.')
    emit('convert-to-pi', row)
  } catch {
    ui.error('Failed to convert quotation. Please try again.')
  }
}

</script>

<style scoped>
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Line items layout ── */
.li-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
  color: #64748b;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.li-row {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.li-row:last-child { border-bottom: none; }
.li-field { display: flex; flex-direction: column; }
.li-label { display: none; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 4px; }
.li-desc { flex: 1; min-width: 0; }
.li-qty  { width: 82px;  flex-shrink: 0; }
.li-unit { width: 76px;  flex-shrink: 0; }
.li-rate { width: 120px; flex-shrink: 0; }
.li-amt  { width: 120px; flex-shrink: 0; }
.li-del  { flex-shrink: 0; width: 36px; padding: 7px !important; margin-bottom: 1px; }
.li-input { font-size: 14px !important; padding: 9px 12px !important; width: 100%; }
.li-amt-input { opacity: .65; }
.li-unit-input { min-width: 0; }
[data-theme="light"] .li-unit-input { border: 1px solid #cbd5e1 !important; background: #f8fafc !important; color: #1e293b !important; }
[data-theme="light"] .li-header { border-bottom-color: #e2e8f0; }
[data-theme="light"] .li-row { border-bottom-color: #f1f5f9; }

@media (max-width: 700px) {
  .li-header { display: none; }
  .li-label { display: block; }
  .li-row { flex-wrap: wrap; padding: 14px 12px 10px; gap: 8px; align-items: flex-start; }
  .li-desc { width: 100%; flex: none; }
  .li-qty, .li-unit { width: calc(50% - 4px); flex: none; }
  .li-rate, .li-amt { width: calc(50% - 4px); flex: none; }
  .li-del { width: auto; margin-left: auto; align-self: flex-end; }
}
</style>
