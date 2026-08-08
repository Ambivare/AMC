<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Users :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          HR
        </h1>
        <p class="page-sub">Manage technician accounts.</p>
      </div>
      <button class="btn-primary" @click="openAdd">
        <UserPlus :size="16" /> Add Technician
      </button>
    </div>

    <!-- Tabs -->
    <div class="tabs-nav" style="margin-bottom:24px;">
      <button :class="['tab-btn', activeTab === 'employees' && 'active']" @click="activeTab = 'employees'">
        <Users :size="14" style="display:inline;margin-right:4px;" /> Employees
      </button>
      <button :class="['tab-btn', activeTab === 'salary' && 'active']" @click="activeTab = 'salary'">
        <Banknote :size="14" style="display:inline;margin-right:4px;" /> Salary Slips
      </button>
    </div>

    <!-- EMPLOYEES TAB -->
    <template v-if="activeTab === 'employees'">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="search" class="input" placeholder="Search name or username…" />
        </div>
        <select v-model="statusFilter" class="input" style="width:140px;">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div v-if="loading" style="text-align:center;padding:60px;color:var(--ct-muted);">Loading…</div>
      <div v-else-if="!filteredEmployees.length" class="glass empty-state" style="padding:60px;">
        <Users :size="36" style="margin:0 auto 16px;opacity:.3;" />
        <p>No technicians yet. Add your first one above.</p>
      </div>

      <!-- Mobile card view -->
      <div v-else-if="isMobile" style="display:flex;flex-direction:column;gap:12px;">
        <div
          v-for="emp in pagedEmployees"
          :key="emp.id"
          class="glass"
          style="padding:16px;border-radius:16px;cursor:pointer;"
          @click="openView(emp)"
        >
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div class="emp-avatar" style="width:42px;height:42px;font-size:14px;flex-shrink:0;">{{ getInitials(emp.fullName) }}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;color:var(--ct-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ emp.fullName }}</div>
              <div style="font-size:11px;color:var(--ct-muted);">{{ emp.empId || '@' + emp.username }}</div>
            </div>
            <span :class="['badge', emp.status === 'inactive' ? 'badge-inactive' : 'badge-active']">{{ emp.status === 'inactive' ? 'Inactive' : 'Active' }}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Designation</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ emp.designation || '—' }}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Phone</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ emp.phone || '—' }}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;" @click.stop>
            <span :class="['badge', roleBadge(emp.role)]" style="margin-right:auto;text-transform:capitalize;">{{ emp.role || 'technician' }}</span>
            <button class="btn-secondary btn-sm" @click="openEdit(emp)" title="Edit"><Pencil :size="12" /></button>
            <button class="btn-secondary btn-sm" @click="openChangePwd(emp)" title="Change Password"><Key :size="12" /></button>
            <button class="btn-success btn-sm" @click="openSalarySlip(emp)" title="Salary Slip"><Banknote :size="12" /></button>
            <button class="btn-secondary btn-sm" @click="toggleStatus(emp)" :title="emp.status === 'inactive' ? 'Activate' : 'Deactivate'">
              <component :is="emp.status === 'inactive' ? CheckCircle2 : Ban" :size="12" />
            </button>
            <button class="btn-danger btn-sm" @click="confirmDel(emp)" title="Delete"><Trash2 :size="12" /></button>
          </div>
        </div>

        <div v-if="filteredEmployees.length > pageSize" style="display:flex;justify-content:center;align-items:center;gap:8px;padding:8px 0;">
          <button class="btn-secondary btn-sm" :disabled="empPage <= 1" @click="empPage--">← Prev</button>
          <span style="font-size:12px;color:var(--ct-muted);">{{ empPage }} / {{ Math.ceil(filteredEmployees.length / pageSize) }}</span>
          <button class="btn-secondary btn-sm" :disabled="empPage >= Math.ceil(filteredEmployees.length / pageSize)" @click="empPage++">Next →</button>
        </div>
      </div>

      <!-- Desktop table view -->
      <DataTable
        v-else
        :columns="empColumns"
        :rows="pagedEmployees"
        :loading="loading"
        :total="filteredEmployees.length"
        :page="empPage"
        :pageSize="pageSize"
        empty-text="No technicians found."
        :on-row-click="openView"
        @page="empPage = $event"
      >
        <template #default="{ row }">
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="emp-avatar">{{ getInitials(row.fullName) }}</div>
              <div>
                <div style="font-weight:600;color:var(--ct-primary);">{{ row.fullName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);">{{ row.empId || '@' + row.username }}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="color:var(--ct-sub);">{{ row.designation || '—' }}</div>
            <span :class="['badge', roleBadge(row.role)]" style="text-transform:capitalize;margin-top:2px;">{{ row.role || 'technician' }}</span>
          </td>
          <td>
            <div style="color:var(--ct-sub);font-size:12px;">{{ row.phone || '—' }}</div>
            <div style="font-size:11px;color:var(--ct-muted);">{{ row.email || '—' }}</div>
          </td>
          <td>
            <div style="color:var(--ct-accent);font-weight:500;">{{ formatCurrency(row.salary) }}</div>
            <div style="font-size:11px;color:var(--ct-muted);">{{ row.paymentMode || '—' }}</div>
          </td>
          <td>{{ row.joinDate ? formatDate(row.joinDate) : '—' }}</td>
          <td><span :class="['badge', row.status === 'inactive' ? 'badge-inactive' : 'badge-active']">{{ row.status === 'inactive' ? 'Inactive' : 'Active' }}</span></td>
          <td @click.stop>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn-secondary btn-sm" @click="openEdit(row)" title="Edit"><Pencil :size="12" /></button>
              <button class="btn-secondary btn-sm" @click="openChangePwd(row)" title="Change Password"><Key :size="12" /></button>
              <button class="btn-success btn-sm" @click="openSalarySlip(row)" title="Generate Salary Slip"><Banknote :size="12" /></button>
              <button class="btn-secondary btn-sm" @click="toggleStatus(row)" :title="row.status === 'inactive' ? 'Activate' : 'Deactivate'">
                <component :is="row.status === 'inactive' ? CheckCircle2 : Ban" :size="12" />
              </button>
              <button class="btn-danger btn-sm" @click="confirmDel(row)" title="Delete"><Trash2 :size="12" /></button>
            </div>
          </td>
        </template>
      </DataTable>
    </template>

    <!-- SALARY TAB -->
    <template v-else-if="activeTab === 'salary'">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="salarySearch" class="input" placeholder="Search salary slips…" />
        </div>
        <select v-model="salaryMonthFilter" class="input" style="width:160px;">
          <option value="">All Months</option>
          <option v-for="m in months" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <DataTable
        :columns="salaryColumns"
        :rows="pagedSalary"
        :loading="salaryLoading"
        :total="filteredSalary.length"
        :page="salaryPage"
        :pageSize="pageSize"
        empty-text="No salary slips found."
        @page="salaryPage = $event"
      >
        <template #default="{ row }">
          <td style="font-weight:500;color:var(--ct-primary);">{{ row.employeeName }}</td>
          <td style="color:var(--ct-sub);">{{ row.month }}</td>
          <td style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.basicSalary) }}</td>
          <td style="color:var(--ct-green);">{{ formatCurrency(row.totalEarnings || row.allowances) }}</td>
          <td style="color:#f87171;">{{ formatCurrency(row.totalDeductions || row.deductions) }}</td>
          <td style="color:var(--ct-accent);font-weight:700;">{{ formatCurrency(row.netSalary) }}</td>
          <td><span :class="['badge', row.paid ? 'badge-active' : 'badge-warning']">{{ row.paid ? 'Paid' : 'Pending' }}</span></td>
          <td @click.stop>
            <div style="display:flex;gap:6px;">
              <button class="btn-secondary btn-sm" @click="openEditSlip(row)" title="Edit"><Pencil :size="12" /></button>
              <button class="btn-success btn-sm" @click="exportSalarySlipPDF(row)" title="Download PDF"><Download :size="12" /></button>
              <button class="btn-danger btn-sm" @click="confirmDelSlip(row)" title="Delete"><Trash2 :size="12" /></button>
            </div>
          </td>
        </template>
      </DataTable>
    </template>

    <!-- Employee Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? viewTarget.fullName : 'Employee Details'" width="600px">
      <template v-if="viewTarget">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
          <div class="emp-avatar" style="width:52px;height:52px;font-size:18px;flex-shrink:0;">{{ getInitials(viewTarget.fullName) }}</div>
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.fullName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.empId || '@' + viewTarget.username }}</div>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <span :class="['badge', viewTarget.status === 'inactive' ? 'badge-inactive' : 'badge-active']">{{ viewTarget.status === 'inactive' ? 'Inactive' : 'Active' }}</span>
              <span :class="['badge', roleBadge(viewTarget.role)]" style="text-transform:capitalize;">{{ viewTarget.role || 'technician' }}</span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Designation</div>
            <div style="color:var(--ct-primary);">{{ viewTarget.designation || '—' }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Login Username</div>
            <div style="color:var(--ct-sub);">@{{ viewTarget.username }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Phone</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.phone || '—' }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Email</div>
            <div style="color:var(--ct-sub);font-size:12px;word-break:break-all;">{{ viewTarget.email || '—' }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Basic Salary</div>
            <div style="color:var(--ct-accent);font-weight:700;">{{ formatCurrency(viewTarget.salary) }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.paymentMode || '—' }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Join Date</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.joinDate ? formatDate(viewTarget.joinDate) : '—' }}</div>
          </div>
          <div v-if="viewTarget.address" class="glass" style="padding:12px 14px;grid-column:1/-1;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Address</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.address }}</div>
          </div>
          <div v-if="viewTarget.bankAccount" class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Bank Account</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.bankAccount }}</div>
            <div v-if="viewTarget.bankIfsc" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.bankIfsc }}</div>
          </div>
          <div v-if="viewTarget.pan" class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">PAN</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.pan }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-primary" @click="showViewModal = false; openEdit(viewTarget)">Edit</button>
      </template>
    </AppModal>

    <!-- Employee Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Technician' : 'Add Technician'" width="760px">
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Full Name *</label>
          <input v-model="form.fullName" class="input" placeholder="e.g. Ramesh Kumar" />
        </div>
        <div class="form-group">
          <label class="label">Employee ID</label>
          <input v-model="form.empId" class="input" placeholder="EMP-001" />
        </div>
        <div class="form-group">
          <label class="label">Designation</label>
          <input v-model="form.designation" class="input" placeholder="e.g. Senior Technician" />
        </div>
        <div class="form-group">
          <label class="label">Role</label>
          <select v-model="form.role" class="input">
            <option value="technician">Technician</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.phone" class="input" placeholder="+91 98765 43210" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="form.email" class="input" type="email" placeholder="tech@example.com" />
        </div>
        <div class="form-group">
          <label class="label">Join Date</label>
          <input v-model="form.joinDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Basic Salary (₹)</label>
          <input v-model.number="form.salary" class="input" type="number" min="0" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="label">Payment Mode</label>
          <select v-model="form.paymentMode" class="input">
            <option value="">Select…</option>
            <option value="bank-transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Login Username *</label>
          <input v-model="form.username" class="input" placeholder="e.g. ramesh" autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="label">{{ editing ? 'New Password' : 'Login Password *' }}<span v-if="editing" style="font-weight:400;color:var(--ct-muted);font-size:11px;"> (leave blank to keep current)</span></label>
          <input v-model="form.password" type="password" class="input" placeholder="Min. 6 characters" autocomplete="new-password" />
        </div>
        <div class="form-group form-full">
          <label class="label">Address</label>
          <textarea v-model="form.address" class="input" rows="2" placeholder="Technician's address…"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Aadhar Number</label>
          <input v-model="form.aadhar" class="input" placeholder="1234 5678 9012" />
        </div>
        <div class="form-group">
          <label class="label">PAN Number</label>
          <input v-model="form.pan" class="input" placeholder="AAAAA0000A" />
        </div>
        <div class="form-group">
          <label class="label">Bank Account</label>
          <input v-model="form.bankAccount" class="input" placeholder="Account number" />
        </div>
        <div class="form-group">
          <label class="label">IFSC Code</label>
          <input v-model="form.bankIfsc" class="input" placeholder="SBIN0001234" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving || !canSubmit" @click="save">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editing ? 'Update' : 'Add Technician') }}
        </button>
      </template>
    </AppModal>

    <!-- Salary Slip Modal -->
    <AppModal v-model="showSalaryModal" :title="editingSlip ? 'Edit Salary Slip' : 'Generate Salary Slip'" width="800px">
      <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Basic Info</div>
      <div class="form-grid" style="margin-bottom:20px;">
        <div class="form-group">
          <label class="label">Employee</label>
          <input :value="salaryForm.employeeName" class="input" readonly style="opacity:.7;" />
        </div>
        <div class="form-group">
          <label class="label">Month *</label>
          <input v-model="salaryForm.payMonth" class="input" type="month" @change="onPayMonthChange" />
        </div>
        <div class="form-group">
          <label class="label">Days in Month</label>
          <input v-model.number="salaryForm.daysInMonth" class="input" type="number" min="1" max="31" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Days Worked</label>
          <input v-model.number="salaryForm.daysWorked" class="input" type="number" min="0" :max="salaryForm.daysInMonth" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Days Absent</label>
          <input :value="Math.max(0, (salaryForm.daysInMonth || 0) - (salaryForm.daysWorked || 0))" class="input" readonly style="opacity:.6;" />
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Earnings</div>
      <div class="form-grid" style="margin-bottom:20px;">
        <div class="form-group">
          <label class="label">Basic Salary (₹)</label>
          <input v-model.number="salaryForm.basicSalary" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">HRA (₹)</label>
          <input v-model.number="salaryForm.hra" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">LTA (₹)</label>
          <input v-model.number="salaryForm.lta" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Medical Allowance (₹)</label>
          <input v-model.number="salaryForm.medicalAllowance" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Conveyance Allowance (₹)</label>
          <input v-model.number="salaryForm.conveyanceAllowance" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Incentives (₹)</label>
          <input v-model.number="salaryForm.incentives" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Other Allowances (₹)</label>
          <input v-model.number="salaryForm.otherAllowances" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Overtime Hours</label>
          <input v-model.number="salaryForm.overtimeHours" class="input" type="number" min="0" step="0.5" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Overtime Rate (₹/hr) <span style="font-size:10px;color:var(--ct-muted);">auto</span></label>
          <input v-model.number="salaryForm.overtimeRate" class="input" type="number" min="0" step="0.01" @input="salaryForm._overtimeRateManual = true; calcNet()" />
        </div>
        <div class="form-group">
          <label class="label">Overtime Amount (₹)</label>
          <input :value="salaryForm.overtimeAmount" class="input" readonly style="opacity:.7;" />
        </div>
        <div class="form-group" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:12px;">
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Earnings</div>
          <div style="font-size:18px;font-weight:700;color:var(--ct-green);">{{ formatCurrency(salaryForm.totalEarnings) }}</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Deductions</div>
      <div class="form-grid" style="margin-bottom:20px;">
        <div class="form-group">
          <label class="label">PF — 12% of Basic (₹)</label>
          <input v-model.number="salaryForm.pf" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">ESIC (₹)</label>
          <input v-model.number="salaryForm.esic" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Professional Tax (₹)</label>
          <input v-model.number="salaryForm.professionalTax" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">TDS (₹)</label>
          <input v-model.number="salaryForm.tds" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Advance Deduction (₹)</label>
          <input v-model.number="salaryForm.advanceDeduction" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group">
          <label class="label">Other Deductions (₹)</label>
          <input v-model.number="salaryForm.otherDeductions" class="input" type="number" min="0" @input="calcNet" />
        </div>
        <div class="form-group" style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px;">
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Deductions</div>
          <div style="font-size:18px;font-weight:700;color:#f87171;">{{ formatCurrency(salaryForm.totalDeductions) }}</div>
        </div>
      </div>

      <div class="glass" style="padding:16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;border-color:rgba(99,102,241,0.25);">
        <div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Earnings</div>
          <div style="font-size:16px;font-weight:700;color:var(--ct-green);">{{ formatCurrency(salaryForm.totalEarnings) }}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Deductions</div>
          <div style="font-size:16px;font-weight:700;color:#f87171;">{{ formatCurrency(salaryForm.totalDeductions) }}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Net Pay</div>
          <div style="font-size:22px;font-weight:700;color:var(--ct-accent);">{{ formatCurrency(salaryForm.netSalary) }}</div>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="label">Payment Status</label>
          <select v-model="salaryForm.paid" class="input">
            <option :value="false">Pending</option>
            <option :value="true">Paid</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Payment Date</label>
          <input v-model="salaryForm.paymentDate" class="input" type="date" />
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showSalaryModal = false">Cancel</button>
        <button class="btn-secondary" @click="exportSalarySlipPDF(salaryForm)" style="color:var(--ct-green);">
          <Download :size="14" /> Export PDF
        </button>
        <button class="btn-primary" @click="saveSalary" :disabled="savingSlip">
          {{ savingSlip ? 'Saving…' : (editingSlip ? 'Update' : 'Generate') }}
        </button>
      </template>
    </AppModal>

    <!-- Change Password Modal -->
    <AppModal v-model="showPwdModal" title="Change Technician Password" width="420px">
      <div style="margin-bottom:6px;color:var(--ct-muted);font-size:13px;">
        Setting new password for <strong style="color:var(--ct-primary);">{{ pwdEmp?.fullName }}</strong>
      </div>
      <div class="form-group" style="margin-top:16px;">
        <label class="label">New Password</label>
        <input v-model="pwdNew" type="password" class="input" placeholder="Min. 6 characters" @keyup.enter="saveEmpPassword" />
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label class="label">Confirm Password</label>
        <input v-model="pwdConfirm" type="password" class="input" placeholder="Re-enter password" @keyup.enter="saveEmpPassword" />
      </div>
      <div v-if="pwdNew && pwdConfirm && pwdNew !== pwdConfirm" style="margin-top:8px;font-size:12px;color:#f87171;">
        Passwords do not match
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showPwdModal = false">Cancel</button>
        <button class="btn-primary" @click="saveEmpPassword" :disabled="savingPwd || !pwdNew || !pwdConfirm">
          <Key :size="13" /> {{ savingPwd ? 'Saving…' : 'Update Password' }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Technician" @confirm="doDelete" />
    <ConfirmDialog ref="slipConfirmRef" title="Delete Salary Slip" @confirm="doDeleteSlip" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Users, UserPlus, Search, Pencil, Trash2, Save, CheckCircle2, Ban, Banknote, Download, Key } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import DataTable from '@/components/ui/DataTable.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { Collections } from '@/firebase/collections'
import { usePDF } from '@/composables/usePDF'

const ui = useUIStore()
const { _drawHeader, _drawFooter, _sectionLabel, _infoGrid, _toRs, _C, _MARGIN, _PAGE_W, _getCtx } = usePDF()
const { items: employees, loading, add, edit, del } = useCollection(Collections.EMPLOYEES)
const { items: slipItems, loading: salaryLoading, add: addSlip, edit: editSlip, del: delSlip } = useCollection(Collections.SALARY_SLIPS)

const activeTab = ref('employees')
const search = ref('')
const statusFilter = ref('')
const salarySearch = ref('')
const salaryMonthFilter = ref('')
const empPage = ref(1)
const salaryPage = ref(1)
const pageSize = 25

const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)
function onResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

const showModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const editing = ref(null)
const saving = ref(false)
function openView(emp) { viewTarget.value = emp; showViewModal.value = true }

const showSalaryModal = ref(false)
const editingSlip = ref(null)
const savingSlip = ref(false)
const confirmRef = ref(null)
const slipConfirmRef = ref(null)
let pendingDeleteId = null
let pendingSlipId = null

const months = computed(() => [...new Set(slipItems.value.map(s => s.month).filter(Boolean))].sort().reverse())

const emptyForm = () => ({
  fullName: '', empId: '', designation: '', role: 'technician',
  status: 'active', phone: '', email: '', joinDate: '', salary: 0,
  paymentMode: '', username: '', password: '', address: '', aadhar: '',
  pan: '', bankAccount: '', bankIfsc: '',
})
const form = ref(emptyForm())

const canSubmit = computed(() => {
  if (!form.value.fullName.trim() || !form.value.username.trim()) return false
  if (!editing.value && form.value.password.length < 6) return false
  if (form.value.password && form.value.password.length < 6) return false
  return true
})

const emptySalaryForm = () => ({
  employeeId: '', employeeName: '', empId: '', designation: '',
  pan: '', bankAccount: '', bankIfsc: '', paymentMode: '',
  payMonth: '', month: '',
  daysInMonth: 30, daysWorked: 30,
  basicSalary: 0, hra: 0, lta: 0, medicalAllowance: 0,
  conveyanceAllowance: 0, incentives: 0, otherAllowances: 0,
  overtimeHours: 0, overtimeRate: 0, overtimeAmount: 0,
  totalEarnings: 0,
  pf: 0, esic: 0, professionalTax: 0, tds: 0,
  advanceDeduction: 0, otherDeductions: 0,
  totalDeductions: 0,
  netSalary: 0,
  paid: false, paymentDate: '',
  allowances: 0, deductions: 0,
})
const salaryForm = ref(emptySalaryForm())

const empColumns = [
  { key: 'name', label: 'Technician' },
  { key: 'designation', label: 'Designation / Role' },
  { key: 'contact', label: 'Contact' },
  { key: 'salary', label: 'Salary' },
  { key: 'joinDate', label: 'Join Date' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', width: '170px' },
]
const salaryColumns = [
  { key: 'name', label: 'Technician' },
  { key: 'month', label: 'Month' },
  { key: 'basic', label: 'Basic' },
  { key: 'allowances', label: 'Allowances' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'net', label: 'Net Pay' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', width: '110px' },
]

const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  return employees.value.filter(e => {
    if (q && !(e.fullName || '').toLowerCase().includes(q) && !(e.username || '').toLowerCase().includes(q)) return false
    if (statusFilter.value && (e.status || 'active') !== statusFilter.value) return false
    return true
  }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
})
const pagedEmployees = computed(() => {
  const s = (empPage.value - 1) * pageSize
  return filteredEmployees.value.slice(s, s + pageSize)
})

const filteredSalary = computed(() => slipItems.value.filter(s => {
  const q = salarySearch.value.toLowerCase()
  if (q && !s.employeeName?.toLowerCase().includes(q)) return false
  if (salaryMonthFilter.value && s.month !== salaryMonthFilter.value) return false
  return true
}))
const pagedSalary = computed(() => {
  const s = (salaryPage.value - 1) * pageSize
  return filteredSalary.value.slice(s, s + pageSize)
})

function calcNet() {
  const f = salaryForm.value
  if (f.basicSalary && f.daysInMonth && !f._overtimeRateManual) {
    f.overtimeRate = Math.round((f.basicSalary / ((f.daysInMonth || 30) * 8)) * 1.5 * 100) / 100
  }
  f.overtimeAmount = Math.round((f.overtimeHours || 0) * (f.overtimeRate || 0) * 100) / 100
  const totalEarnings = (f.basicSalary || 0) + (f.hra || 0) + (f.lta || 0) +
    (f.medicalAllowance || 0) + (f.conveyanceAllowance || 0) +
    (f.incentives || 0) + (f.otherAllowances || 0) + (f.overtimeAmount || 0)
  const totalDeductions = (f.pf || 0) + (f.esic || 0) + (f.professionalTax || 0) +
    (f.tds || 0) + (f.advanceDeduction || 0) + (f.otherDeductions || 0)
  f.totalEarnings = totalEarnings
  f.totalDeductions = totalDeductions
  f.netSalary = totalEarnings - totalDeductions
  f.allowances = (f.hra || 0) + (f.otherAllowances || 0)
  f.deductions = totalDeductions
}

function onPayMonthChange() {
  const v = salaryForm.value.payMonth
  if (!v) return
  const d = new Date(v + '-01')
  salaryForm.value.month = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  salaryForm.value.daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  salaryForm.value.daysWorked = salaryForm.value.daysInMonth
  calcNet()
}

function openAdd() {
  editing.value = null
  form.value = emptyForm()
  form.value.empId = `EMP-${String(employees.value.length + 1).padStart(3, '0')}`
  showModal.value = true
}
function openEdit(emp) {
  editing.value = emp
  form.value = { ...emptyForm(), ...emp, password: '' }
  showModal.value = true
}

async function save() {
  if (!canSubmit.value) return
  const username = form.value.username.trim().toLowerCase()
  const dup = employees.value.find(e =>
    (e.username || '').toLowerCase() === username && (!editing.value || e.id !== editing.value.id)
  )
  if (dup) { ui.error('That username is already taken.'); return }

  saving.value = true
  try {
    const data = { ...form.value, username }
    if (!data.password) delete data.password

    if (editing.value) {
      await edit(editing.value.id, data, { action: 'updated', module: 'hr', tab: 'HR', summary: `Updated technician ${data.fullName}` })
      ui.success('Technician updated.')
    } else {
      await add(data, { action: 'created', module: 'hr', tab: 'HR', summary: `Added technician ${data.fullName}` })
      ui.success('Technician added.')
    }
    showModal.value = false
  } catch (e) {
    ui.error('Failed to save technician.')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(emp) {
  const newStatus = emp.status === 'inactive' ? 'active' : 'inactive'
  try {
    await edit(emp.id, { status: newStatus }, { action: 'updated', module: 'hr', tab: 'HR', summary: `${newStatus === 'inactive' ? 'Deactivated' : 'Activated'} technician ${emp.fullName}` })
    ui.success(`Technician ${newStatus === 'inactive' ? 'deactivated' : 'activated'}.`)
  } catch {
    ui.error('Failed to update status.')
  }
}

// ── Change Password ─────────────────────────────────────────────────────────
const showPwdModal = ref(false)
const pwdEmp       = ref(null)
const pwdNew       = ref('')
const pwdConfirm   = ref('')
const savingPwd    = ref(false)

function openChangePwd(emp) {
  pwdEmp.value     = emp
  pwdNew.value     = ''
  pwdConfirm.value = ''
  showPwdModal.value = true
}

async function saveEmpPassword() {
  if (!pwdNew.value) return ui.error('Enter a new password')
  if (pwdNew.value.length < 6) return ui.error('Password must be at least 6 characters')
  if (pwdNew.value !== pwdConfirm.value) return ui.error('Passwords do not match')
  savingPwd.value = true
  try {
    await edit(pwdEmp.value.id, { password: pwdNew.value }, { action: 'updated', module: 'hr', tab: 'HR', summary: `Changed password for ${pwdEmp.value.fullName}` })
    ui.success(`Password updated for ${pwdEmp.value.fullName}.`)
    showPwdModal.value = false
  } catch {
    ui.error('Failed to update password.')
  } finally {
    savingPwd.value = false
  }
}

// ── Salary Slips ─────────────────────────────────────────────────────────────
function openSalarySlip(emp) {
  editingSlip.value = null
  const f = emptySalaryForm()
  f.employeeId = emp.id
  f.employeeName = emp.fullName
  f.empId = emp.empId || ''
  f.designation = emp.designation || ''
  f.pan = emp.pan || ''
  f.bankAccount = emp.bankAccount || ''
  f.bankIfsc = emp.bankIfsc || ''
  f.paymentMode = emp.paymentMode || ''
  f.basicSalary = emp.salary || 0
  const now = new Date()
  f.payMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  f.month = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  f.daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  f.daysWorked = f.daysInMonth
  f.pf = Math.round((emp.salary || 0) * 0.12)
  salaryForm.value = f
  calcNet()
  showSalaryModal.value = true
}
function openEditSlip(slip) {
  editingSlip.value = slip
  salaryForm.value = { ...emptySalaryForm(), ...slip }
  showSalaryModal.value = true
}
async function saveSalary() {
  if (!salaryForm.value.month.trim()) return ui.error('Month required')
  savingSlip.value = true
  try {
    if (editingSlip.value) {
      await editSlip(editingSlip.value.id, salaryForm.value, { action: 'updated', module: 'hr', tab: 'HR', summary: `Updated salary slip for ${salaryForm.value.employeeName}` })
      ui.success('Salary slip updated.')
    } else {
      await addSlip(salaryForm.value, { action: 'created', module: 'hr', tab: 'HR', summary: `Generated salary slip for ${salaryForm.value.employeeName}` })
      ui.success('Salary slip generated.')
    }
    showSalaryModal.value = false
  } catch {
    ui.error('Save failed.')
  } finally {
    savingSlip.value = false
  }
}

async function exportSalarySlipPDF(slip) {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()
    const M = _MARGIN
    const W = _PAGE_W

    let y = await _drawHeader(doc, {
      company,
      userName,
      title: 'Salary Slip',
      subtitle: `${slip.employeeName || '—'} · ${slip.month || '—'} · Status: ${slip.paid ? 'PAID' : 'PENDING'}`,
      accent: _C.indigo,
    })

    y = _sectionLabel(doc, 'Employee Details', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Employee Name', slip.employeeName || '—'],
      ['Employee ID', slip.empId || '—'],
      ['Designation', slip.designation || '—'],
      ['Pay Month', slip.month || '—'],
      ['Payment Mode', slip.paymentMode || '—'],
      ['Days in Month', String(slip.daysInMonth || 30)],
      ['Days Worked', String(slip.daysWorked || 30)],
      ['Absent Days', String(Math.max(0, (slip.daysInMonth || 30) - (slip.daysWorked || 30)))],
      ['Payment Date', slip.paymentDate || '—'],
    ], y)

    y = _sectionLabel(doc, 'Earnings and Deductions', y, _C.greyText)

    const earnings = [
      ['Basic Salary', slip.basicSalary || 0],
      ['HRA', slip.hra || 0],
      ['LTA', slip.lta || 0],
      ['Medical Allowance', slip.medicalAllowance || 0],
      ['Conveyance Allowance', slip.conveyanceAllowance || 0],
      ['Incentives', slip.incentives || 0],
      [`Overtime (${slip.overtimeHours || 0} hrs)`, slip.overtimeAmount || 0],
      ['Other Allowances', slip.otherAllowances || 0],
    ].filter(([, v]) => v > 0)

    const deductions = [
      ['Provident Fund (PF)', slip.pf || 0],
      ['ESIC', slip.esic || 0],
      ['Professional Tax', slip.professionalTax || 0],
      ['TDS', slip.tds || 0],
      ['Advance Deduction', slip.advanceDeduction || 0],
      ['Other Deductions', slip.otherDeductions || 0],
    ].filter(([, v]) => v > 0)

    const maxRows = Math.max(earnings.length, deductions.length)
    const tableBody = []
    for (let i = 0; i < maxRows; i++) {
      const e = earnings[i] || ['', '']
      const d = deductions[i] || ['', '']
      tableBody.push([e[0], e[1] ? _toRs(e[1]) : '', d[0], d[1] ? _toRs(d[1]) : ''])
    }
    tableBody.push(['TOTAL EARNINGS', _toRs(slip.totalEarnings || 0), 'TOTAL DEDUCTIONS', _toRs(slip.totalDeductions || 0)])

    doc.autoTable({
      startY: y,
      head: [['Earnings Component', 'Amount', 'Deductions', 'Amount']],
      body: tableBody,
      styles: { fontSize: 8.5, cellPadding: 3.5, textColor: _C.black },
      headStyles: { fillColor: _C.indigo, textColor: _C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: _C.lightGrey },
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell(data) {
        if (data.row.raw?.[0] === 'TOTAL EARNINGS' || data.row.raw?.[2] === 'TOTAL DEDUCTIONS') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = _C.indigo
          data.cell.styles.textColor = _C.white
        }
      },
      margin: { left: M, right: M },
    })
    y = doc.lastAutoTable.finalY + 5

    doc.setFillColor(..._C.darkGrey)
    doc.rect(M, y, W - M * 2, 14, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(..._C.white)
    doc.text(`NET PAY: ${_toRs(slip.netSalary || 0)}`, M + 4, y + 9)
    doc.setFontSize(9)
    doc.text(`Status: ${slip.paid ? 'PAID' : 'PENDING'}`, W - M - 2, y + 9, { align: 'right' })
    y += 20

    if (slip.bankAccount || slip.pan) {
      y = _sectionLabel(doc, 'Payment Information', y, _C.midGrey)
      y = _infoGrid(doc, [
        ['Bank Account', slip.bankAccount || '—'],
        ['IFSC Code', slip.bankIfsc || '—'],
        ['PAN', slip.pan || '—'],
        ['Payment Mode', slip.paymentMode || '—'],
      ], y)
    }

    if (y > 255) { doc.addPage(); y = 14 }
    y += 8
    doc.setDrawColor(..._C.silver); doc.setLineWidth(0.5)
    doc.line(M, y, M + 70, y)
    doc.line(W - M - 70, y, W - M, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(..._C.midGrey)
    doc.text('Employer Signature', M, y + 5)
    doc.text('Employee Signature', W - M, y + 5, { align: 'right' })

    _drawFooter(doc, { company: company.name, title: 'Salary Slip', note: 'Confidential · For Employee Use Only · Internal Document' })
    const { savePDF } = await import('@/utils/saveFile')
    const name = (slip.employeeName || 'Employee').replace(/\s+/g, '_')
    await savePDF(doc, `SalarySlip_${name}_${(slip.month || 'slip').replace(/\s+/g, '_')}.pdf`, ui)
    ui.success('Salary slip PDF downloaded.')
  } catch (e) {
    ui.error('PDF export failed: ' + e.message)
  }
}

function confirmDel(row) { pendingDeleteId = row.id; confirmRef.value?.open(`Delete technician "${row.fullName}"? This also removes their login access.`) }
async function doDelete() { await del(pendingDeleteId, { action: 'deleted', module: 'hr', tab: 'HR', summary: 'Deleted technician' }); ui.success('Technician deleted.') }
function confirmDelSlip(row) { pendingSlipId = row.id; slipConfirmRef.value?.open('Delete this salary slip?') }
async function doDeleteSlip() { await delSlip(pendingSlipId, { action: 'deleted', module: 'hr', tab: 'HR', summary: 'Deleted salary slip' }); ui.success('Salary slip deleted.') }

const getInitials = (n) => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
const roleBadge = (r) => ({ admin: 'badge-danger', technician: 'badge-warning' }[r] || 'badge-inactive')
const formatCurrency = (v) => `₹${(v || 0).toLocaleString('en-IN')}`
function formatDate(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}
</script>

<style scoped>
.page-container { padding: 28px; }
.emp-avatar {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
  border: 1px solid rgba(99,102,241,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--ct-accent);
}
</style>
