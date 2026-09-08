<template>
  <div>
    <!-- Toolbar -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search bill invoices…" />
      </div>
      <select v-model="statusFilter" class="input" style="width:175px;">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="converted">Converted to TI</option>
      </select>
      <select v-model="paymentFilter" class="input" style="width:150px;">
        <option value="">All Payments</option>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
      </select>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="16" /> New Bill Invoice
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No bill invoices found."
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
        <td style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.total) }}</td>
        <td>
          <div><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'draft' }}</span></div>
          <div style="margin-top:4px;"><span :class="['badge', paymentBadge(row.paymentStatus)]">{{ row.paymentStatus || 'unpaid' }}</span></div>
        </td>
        <td style="color:var(--ct-muted);font-size:12px;">{{ formatCurrency(row.paidAmount) }}</td>
        <td @click.stop>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <PDFDownloadButton class="btn-success btn-sm" :row="resolveRow(row)" template-key="proforma" title="Download Bill Invoice PDF"><Download :size="12" /> PI</PDFDownloadButton>
            <PDFDownloadButton class="btn-info btn-sm" :row="resolveRow(row)" template-key="invoice" title="Download Invoice PDF" style="background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.25);"><Download :size="12" /> INV</PDFDownloadButton>
            <button class="btn-excel btn-sm" @click="downloadRowExcel(row)" title="Download Excel"><FileSpreadsheet :size="12" /></button>
            <button class="btn-warning btn-sm" @click="openPayment(row)" title="Record Payment"><CreditCard :size="12" /></button>
            <button class="btn-info btn-sm" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;font-size:12px;background:rgba(168,85,247,0.1);color:#c084fc;border:1px solid rgba(168,85,247,0.2);cursor:pointer;" @click="convertToTI(row)" title="Convert to Tax Invoice" :disabled="row.status === 'converted'">
              <ArrowRight :size="12" />
            </button>
            <button class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Bill Invoice' : 'New Bill Invoice'" width="800px">
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
        <div class="form-group">
          <label class="label">PI Number</label>
          <input v-model="form.docNumber" class="input" placeholder="PI-001" />
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
          </select>
        </div>
        <div class="form-group">
          <label class="label">Site Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Site / Project name"
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
        <div class="form-group form-full">
          <label class="label">Site Address</label>
          <textarea v-model="form.siteAddress" class="input" rows="2" placeholder="Site / delivery address if different from billing address…"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Contract No</label>
          <input v-model="form.contractNo" class="input" placeholder="Contract / PO number" />
        </div>
        <div class="form-group">
          <label class="label">Ref No (Quotation)</label>
          <input v-model="form.refNo" class="input" placeholder="e.g. Q-001" />
        </div>
        <div class="form-group">
          <label class="label">Ref Date</label>
          <input v-model="form.refDate" class="input" type="date" />
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
          <div class="li-header">
            <span class="li-desc">Description</span>
            <span class="li-qty">Qty</span>
            <span class="li-unit">Unit</span>
            <span class="li-rate">Rate (₹)</span>
            <span class="li-amt">Amount (₹)</span>
            <span style="width:36px;flex-shrink:0;"></span>
          </div>
          <div v-for="(item, i) in form.items" :key="i" class="li-row">
            <div class="li-field li-desc"><span class="li-label">Description</span><input v-model="item.description" class="input li-input" placeholder="Item description" @input="recalc" /></div>
            <div class="li-field li-qty"><span class="li-label">Qty</span><input v-model.number="item.quantity" class="input li-input" type="number" min="0" placeholder="1" @input="calcLine(item); recalc()" /></div>
            <div class="li-field li-unit"><span class="li-label">Unit</span><input v-model="item.unit" class="input li-input li-unit-input" placeholder="Nos" /></div>
            <div class="li-field li-rate"><span class="li-label">Rate (₹)</span><input v-model.number="item.rate" class="input li-input" type="number" min="0" placeholder="0" @input="calcLine(item); recalc()" /></div>
            <div class="li-field li-amt"><span class="li-label">Amount (₹)</span><input :value="item.amount" class="input li-input li-amt-input" readonly /></div>
            <button class="btn-danger btn-sm btn-icon li-del" @click="removeLineItem(i)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <div class="glass" style="padding:16px 20px;border-radius:12px;min-width:240px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">Subtotal</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.subtotal) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">GST ({{ form.gstPercent }}%)</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.gstAmount) }}</span>
          </div>
          <hr class="divider" style="margin:8px 0;" />
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;">
            <span style="color:var(--ct-primary);">Total</span>
            <span style="color:var(--ct-accent);">{{ formatCurrency(form.total) }}</span>
          </div>
        </div>
      </div>

      <div class="form-group form-full">
        <label class="label">Notes</label>
        <textarea v-model="form.notes" class="input" rows="3" placeholder="Terms, conditions…"></textarea>
      </div>

      <template #footer>
        <SwipeToConfirm
          ref="piSwipeRef"
          style="width:100%;"
          :label="editing ? 'Swipe to update invoice' : 'Swipe to create invoice'"
          :done-label="editing ? 'Invoice updated' : 'Invoice created'"
          :loading="saving"
          @confirm="save"
        />
      </template>
    </AppModal>

    <!-- Payment Modal -->
    <AppModal v-model="showPaymentModal" title="Record Payment" :subtitle="paymentTarget?.docNumber" width="500px">
      <div style="display:flex;flex-direction:column;gap:14px;">
        <!-- Summary banner -->
        <div style="display:flex;gap:10px;">
          <div class="glass" style="flex:1;padding:10px 14px;text-align:center;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Invoice Total</div>
            <div style="font-size:15px;font-weight:700;color:var(--ct-accent);margin-top:2px;">{{ formatCurrency(paymentTarget?.total) }}</div>
          </div>
          <div class="glass" style="flex:1;padding:10px 14px;text-align:center;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Total Paid</div>
            <div style="font-size:15px;font-weight:700;color:#10b981;margin-top:2px;">{{ formatCurrency(piCurrentPaid) }}</div>
          </div>
          <div class="glass" style="flex:1;padding:10px 14px;text-align:center;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Balance</div>
            <div style="font-size:15px;font-weight:700;margin-top:2px;" :style="{ color: (paymentTarget?.total || 0) - piCurrentPaid > 0 ? '#f87171' : '#10b981' }">{{ formatCurrency(Math.max(0, (paymentTarget?.total || 0) - piCurrentPaid)) }}</div>
          </div>
        </div>

        <!-- Previous payment history -->
        <div v-if="piPaymentHistory.length" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
          <div style="padding:8px 14px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Payment History ({{ piPaymentHistory.length }})</span>
          </div>
          <div style="max-height:180px;overflow-y:auto;">
            <div v-for="(ph, i) in piPaymentHistory" :key="i" style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="font-size:12px;color:var(--ct-sub);">{{ ph.date }}</span>
                  <span style="font-size:10px;color:var(--ct-muted);padding:1px 6px;background:rgba(255,255,255,0.06);border-radius:4px;">{{ ph.mode }}</span>
                </div>
                <div v-if="ph.remarks" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ ph.remarks }}</div>
                <div v-if="ph.loggedAt" style="font-size:10px;color:var(--ct-muted);margin-top:2px;">
                  {{ new Date(ph.loggedAt).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }}<span v-if="ph.loggedBy"> · {{ ph.loggedBy }}</span>
                </div>
              </div>
              <span style="color:#10b981;font-weight:600;font-size:13px;flex-shrink:0;">{{ formatCurrency(ph.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- Add new payment -->
        <div style="padding:14px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.18);border-radius:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);margin-bottom:12px;">Add New Payment</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="label">Amount (₹) *</label>
              <input v-model.number="paymentForm.paidAmount" class="input" type="number" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label class="label">Payment Date</label>
              <input v-model="paymentForm.paymentDate" class="input" type="date" />
            </div>
            <div class="form-group">
              <label class="label">Payment Mode</label>
              <select v-model="paymentForm.paymentMode" class="input">
                <option value="cash">Cash</option>
                <option value="bank-transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Remarks / Reference</label>
              <input v-model="paymentForm.remarks" class="input" placeholder="Ref No., cheque number…" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showPaymentModal = false">Close</button>
        <button class="btn-success" :disabled="saving || !paymentForm.paidAmount" @click="savePayment">
          <CreditCard :size="14" /> {{ saving ? 'Saving…' : 'Add Payment' }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Bill Invoice" @confirm="doDelete" />

    <!-- Bill Invoice Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? (viewTarget.docNumber || 'Bill Invoice') : 'Bill Invoice'" width="580px">
      <template v-if="viewTarget">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div v-if="viewTarget.projectId" style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(viewTarget.projectId) }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.docNumber }} &bull; {{ formatDate(viewTarget.date) }}</div>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <span :class="['badge', statusBadge(viewTarget.status)]">{{ viewTarget.status || 'draft' }}</span>
              <span :class="['badge', paymentBadge(viewTarget.paymentStatus)]">{{ viewTarget.paymentStatus || 'unpaid' }}</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total</div>
              <div style="color:var(--ct-accent);font-weight:700;font-size:15px;">{{ formatCurrency(viewTarget.total) }}</div>
            </div>
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Paid</div>
              <div style="color:#10b981;font-weight:600;">{{ formatCurrency(viewTarget.paidAmount) }}</div>
            </div>
            <div v-if="viewTarget.paidAmount" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Balance</div>
              <div :style="`color:${(viewTarget.total||0)-(viewTarget.paidAmount||0) > 0 ? '#f87171':'#10b981'};font-weight:600;`">{{ formatCurrency(Math.max(0,(viewTarget.total||0)-(viewTarget.paidAmount||0))) }}</div>
            </div>
            <div v-if="viewTarget.clientPhone" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Phone</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.clientPhone }}</div>
            </div>
            <div v-if="viewTarget.sourceQuotation" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Source Quotation</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.sourceQuotation }}</div>
            </div>
            <div v-if="viewTarget.liftDescription" class="glass" style="padding:12px 14px;grid-column:1/-1;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Description</div>
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
              <span style="color:var(--ct-sub);">Total</span>
              <span style="color:var(--ct-accent);">{{ formatCurrency(viewTarget.total) }}</span>
            </div>
          </div>
          <div v-if="viewTarget.paidAmount || (viewTarget.paymentHistory && viewTarget.paymentHistory.length)" style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
            <div style="padding:8px 14px;background:rgba(16,185,129,0.07);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Payments Received</span>
              <span style="font-weight:700;color:#10b981;">{{ formatCurrency(viewTarget.paidAmount) }}</span>
            </div>
            <div v-if="viewTarget.paymentHistory && viewTarget.paymentHistory.length" style="max-height:200px;overflow-y:auto;">
              <div v-for="(ph, i) in viewTarget.paymentHistory" :key="i" style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:var(--ct-sub);">{{ ph.date }}</span>
                    <span style="font-size:10px;color:var(--ct-muted);padding:1px 6px;background:rgba(255,255,255,0.06);border-radius:4px;">{{ ph.mode }}</span>
                  </div>
                  <div v-if="ph.remarks" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ ph.remarks }}</div>
                  <div v-if="ph.loggedAt" style="font-size:10px;color:var(--ct-muted);margin-top:2px;">
                    {{ new Date(ph.loggedAt).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }}<span v-if="ph.loggedBy"> · {{ ph.loggedBy }}</span>
                  </div>
                </div>
                <span style="color:#10b981;font-weight:600;font-size:13px;flex-shrink:0;">{{ formatCurrency(ph.amount) }}</span>
              </div>
            </div>
            <div v-else style="padding:10px 14px;font-size:12px;color:var(--ct-muted);">No detailed payment log available.</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;">
          <button class="btn-secondary" @click="showViewModal = false">Close</button>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;">
            <PDFDownloadButton v-if="viewTarget" class="btn-success btn-sm" :row="resolveRow(viewTarget)" template-key="proforma" title="Download Bill Invoice PDF"><Download :size="12" /> PI</PDFDownloadButton>
            <PDFDownloadButton v-if="viewTarget" class="btn-info btn-sm" :row="resolveRow(viewTarget)" template-key="invoice" title="Download Invoice PDF" style="background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.25);"><Download :size="12" /> INV</PDFDownloadButton>
            <button class="btn-excel btn-sm" @click="downloadRowExcel(viewTarget)" title="Download Excel"><FileSpreadsheet :size="12" /></button>
            <button class="btn-warning btn-sm" @click="showViewModal = false; openPayment(viewTarget)" title="Record Payment"><CreditCard :size="12" /></button>
            <button class="btn-info btn-sm" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;font-size:12px;background:rgba(168,85,247,0.1);color:#c084fc;border:1px solid rgba(168,85,247,0.2);cursor:pointer;" @click="convertToTI(viewTarget)" title="Convert to Tax Invoice" :disabled="viewTarget.status === 'converted'">
              <ArrowRight :size="12" />
            </button>
            <button class="btn-danger btn-sm" @click="showViewModal = false; confirmDel(viewTarget)"><Trash2 :size="12" /></button>
            <button class="btn-primary" @click="showViewModal = false; openEdit(viewTarget)">Edit</button>
          </div>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Search, Pencil, Trash2, Download, ArrowRight, CreditCard, FileSpreadsheet, FolderOpen } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PDFDownloadButton from '@/components/ui/PDFDownloadButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SwipeToConfirm from '@/components/ui/SwipeToConfirm.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { downloadExcel } from '@/composables/useBillingExcel'
import { nextDocNumber } from '@/composables/useDocNumber'

const emit = defineEmits(['convert-to-ti'])
const ui = useUIStore()
const auth = useAuthStore()
const { items, loading, add, edit, del } = useCollection(Collections.PROFORMA_INVOICES)
const { items: allProjects } = useCollection(Collections.PROJECTS)
const { edit: editQuotation } = useCollection(Collections.QUOTATIONS, { autoLoad: false })

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

function getProjectName(projectId) {
  if (!projectId) return ''
  return allProjects.value.find(p => p.id === projectId)?.projectName || ''
}

function resolveRow(row) {
  if (row.projectName || !row.projectId) return row
  return { ...row, projectName: getProjectName(row.projectId) }
}

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

const search = ref('')
const statusFilter = ref('')
const paymentFilter = ref('')
const page = ref(1)
const pageSize = 20

const filtered = computed(() => {
  let list = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.docNumber?.toLowerCase().includes(q) || r.clientName?.toLowerCase().includes(q) || r.projectName?.toLowerCase().includes(q) || getProjectName(r.projectId)?.toLowerCase().includes(q))
  }
  if (statusFilter.value) list = list.filter(r => r.status === statusFilter.value)
  if (paymentFilter.value) list = list.filter(r => (r.paymentStatus || 'unpaid') === paymentFilter.value)
  return list
})
const pagedItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, statusFilter, paymentFilter], () => { page.value = 1 })

const columns = [
  { key: 'docNumber', label: 'PI Number' },
  { key: 'client', label: 'Client' },
  { key: 'total', label: 'Total', width: '120px' },
  { key: 'status', label: 'Status', width: '130px' },
  { key: 'paidAmount', label: 'Paid', width: '110px' },
  { key: 'actions', label: 'Actions', width: '220px' },
]

function statusBadge(s) {
  const m = { draft: 'badge-inactive', sent: 'badge-info', converted: 'badge-purple' }
  return m[s] || 'badge-inactive'
}
function paymentBadge(s) {
  const m = { unpaid: 'badge-danger', partial: 'badge-warning', paid: 'badge-active' }
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

const showModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }
const editing = ref(null)
const saving = ref(false)

const defaultForm = () => ({
  projectId: '', projectName: '',
  docNumber: '', date: new Date().toISOString().split('T')[0],
  status: 'draft', clientName: '', clientAddress: '', clientGST: '',
  contactPerson: '', clientPhone: '', clientEmail: '', liftDescription: '',
  siteAddress: '', contractNo: '', refNo: '', refDate: '',
  items: [{ description: '', quantity: 1, unit: '', rate: 0, amount: 0 }],
  subtotal: 0, gstPercent: 18, gstAmount: 0, total: 0, notes: '',
  paymentStatus: 'unpaid', paidAmount: 0,
})
const form = ref(defaultForm())

function addLineItem() { form.value.items.push({ description: '', quantity: 1, unit: '', rate: 0, amount: 0 }) }
function removeLineItem(i) { form.value.items.splice(i, 1); recalc() }
function calcLine(item) { item.amount = Math.round((item.quantity || 0) * (item.rate || 0) * 100) / 100 }
function recalc() {
  form.value.subtotal = form.value.items.reduce((s, i) => s + (i.amount || 0), 0)
  form.value.gstAmount = Math.round(form.value.subtotal * (form.value.gstPercent || 0) / 100)
  form.value.total = form.value.subtotal + form.value.gstAmount
}

function openAdd() {
  editing.value = null
  const num = nextDocNumber(items.value, 'PI')
  form.value = { ...defaultForm(), docNumber: num }
  billUseProject.value = false
  billProjectSearch.value = ''
  showModal.value = true
}
function openEdit(row) {
  editing.value = row
  form.value = { ...defaultForm(), ...row, items: row.items?.map(i => ({ ...i })) || [{ description: '', quantity: 1, rate: 0, amount: 0 }] }
  billUseProject.value = !!row.projectId
  if (row.projectId) {
    const proj = allProjects.value.find(p => p.id === row.projectId)
    billProjectSearch.value = proj?.projectName || ''
  } else {
    billProjectSearch.value = ''
  }
  showModal.value = true
}

const piSwipeRef = ref(null)
async function save() {
  if (!form.value.clientName) { ui.error('Client name is required.'); piSwipeRef.value?.reset(); return }
  if (!form.value.items?.length) { ui.error('At least one line item is required.'); piSwipeRef.value?.reset(); return }
  saving.value = true
  try {
    const data = { ...form.value, updatedAt: new Date() }
    if (editing.value) {
      await edit(editing.value.id, data, { action: 'updated', module: 'proformaInvoices', tab: 'Billing', summary: `Updated Bill Invoice ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      ui.success('Bill invoice updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'proformaInvoices', tab: 'Billing', summary: `Created Bill Invoice ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      // Only mark the source quotation as converted once the PI actually exists —
      // marking it earlier (when the convert button is first clicked) left
      // quotations stuck showing "converted" with no PI ever created if this
      // modal was closed without saving.
      if (data.quotationId) {
        try { await editQuotation(data.quotationId, { status: 'converted', updatedAt: new Date() }) }
        catch (e) { console.error('[ProformaInvoices] Failed to mark source quotation converted:', e) }
      }
      ui.success('Bill invoice created.')
    }
    showModal.value = false
  } catch { ui.error('Failed to save.'); piSwipeRef.value?.reset() }
  finally { saving.value = false }
}

// Payment
const showPaymentModal = ref(false)
const paymentTarget = ref(null)
const paymentForm = ref({ paidAmount: 0, paymentDate: '', paymentMode: 'bank-transfer', remarks: '' })

const piPaymentHistory = computed(() => paymentTarget.value?.paymentHistory || [])
const piCurrentPaid = computed(() => piPaymentHistory.value.reduce((sum, ph) => sum + (Number(ph.amount) || 0), 0))

function openPayment(row) {
  paymentTarget.value = row
  paymentForm.value = {
    paidAmount: null,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'bank-transfer',
    remarks: '',
  }
  showPaymentModal.value = true
}

async function savePayment() {
  const amount = Number(paymentForm.value.paidAmount) || 0
  if (!amount) { ui.error('Enter an amount to record.'); return }
  const existing = paymentTarget.value.paymentHistory || []
  const newEntry = {
    amount,
    date: paymentForm.value.paymentDate,
    mode: paymentForm.value.paymentMode,
    remarks: paymentForm.value.remarks,
    loggedAt: new Date().toISOString(),
    loggedBy: auth.user?.fullName || auth.user?.username || '',
  }
  const newHistory = [...existing, newEntry]
  const totalPaid = newHistory.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const total = Number(paymentTarget.value.total) || 0
  const paymentStatus = totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'
  saving.value = true
  try {
    await edit(paymentTarget.value.id, {
      paymentHistory: newHistory,
      paidAmount: totalPaid,
      paymentStatus,
      updatedAt: new Date(),
    }, { action: 'payment', module: 'proformaInvoices', tab: 'Billing', summary: `Recorded payment of ₹${amount} for PI ${paymentTarget.value.docNumber}`, details: { docNumber: paymentTarget.value.docNumber, clientName: paymentTarget.value.clientName, paymentAmount: amount, totalPaid } })
    ui.success('Payment recorded.')
    showPaymentModal.value = false
  } catch { ui.error('Failed to record payment.') }
  finally { saving.value = false }
}

const confirmRef = ref(null)
const deleteTarget = ref(null)
function confirmDel(row) { deleteTarget.value = row; confirmRef.value?.open(`Delete ${row.docNumber}? This cannot be undone.`) }
async function doDelete() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'proformaInvoices', tab: 'Billing', summary: 'Deleted bill invoice', details: { id: deleteTarget.value.id } }); ui.success('Bill invoice deleted.') }
  catch { ui.error('Failed to delete.') }
}

async function downloadRowExcel(row) {
  const resolved = row.projectName || !row.projectId ? row
    : { ...row, projectName: allProjects.value.find(p => p.id === row.projectId)?.projectName || '' }
  try { await downloadExcel(resolved, 'proforma', ui) }
  catch (e) { ui.error('Failed to generate Excel: ' + (e?.message || e)) }
}

function convertToTI(row) {
  // The PI is only marked "converted" once the Tax Invoice opened below is
  // actually saved (see TaxInvoicesTab.vue's save()).
  emit('convert-to-ti', row)
}

function openWithData(quotationRow) {
  editing.value = null
  const num = nextDocNumber(items.value, 'PI')
  form.value = {
    ...defaultForm(),
    docNumber: num,
    projectId: quotationRow.projectId || '',
    projectName: quotationRow.projectName || '',
    clientName: quotationRow.clientName || '',
    clientAddress: quotationRow.clientAddress || '',
    clientGST: quotationRow.clientGST || '',
    contactPerson: quotationRow.contactPerson || '',
    clientPhone: quotationRow.clientPhone || '',
    clientEmail: quotationRow.clientEmail || '',
    liftDescription: quotationRow.liftDescription || '',
    gstPercent: quotationRow.gstPercent || 18,
    items: (quotationRow.items || []).map(i => ({ ...i })),
    subtotal: quotationRow.subtotal || 0,
    gstAmount: quotationRow.gstAmount || 0,
    total: quotationRow.total || 0,
    notes: quotationRow.notes || '',
    sourceQuotation: quotationRow.docNumber || '',
    quotationId: quotationRow.id || '',
    refNo: quotationRow.docNumber || '',
    refDate: quotationRow.date || '',
  }
  billUseProject.value = !!quotationRow.projectId
  if (quotationRow.projectId) {
    const proj = allProjects.value.find(p => p.id === quotationRow.projectId)
    billProjectSearch.value = proj?.projectName || quotationRow.projectName || ''
  } else {
    billProjectSearch.value = ''
  }
  showModal.value = true
}


defineExpose({ items, openWithData })
</script>

<style scoped>
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }

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
