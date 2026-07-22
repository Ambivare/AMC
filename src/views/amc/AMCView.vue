<template>
  <div class="amc-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <ClipboardList :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          AMC Management
        </h1>
        <p class="page-sub">Contracts that keep every lift running on schedule.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-secondary btn-sm" @click="triggerExport('pdf')"><FileDown :size="14" /> PDF</button>
        <button class="btn-secondary btn-sm" @click="triggerExport('excel')"><FileText :size="14" /> Excel</button>
        <button v-if="authStore.can('canCreateService')" class="btn-primary" @click="openAddContract">
          <Plus :size="16" /> New Contract
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-nav" style="margin-bottom:24px;">
      <button :class="['tab-btn', activeTab === 'contracts' && 'active']" @click="activeTab = 'contracts'">
        <FileText :size="14" /> Contracts
        <span class="badge badge-info" style="margin-left:4px;">{{ contracts.length }}</span>
      </button>
      <button :class="['tab-btn', activeTab === 'monthly' && 'active']" @click="activeTab = 'monthly'">
        <CalendarCheck :size="14" /> Monthly Maintenance
      </button>
      <button :class="['tab-btn', activeTab === 'renewals' && 'active']" @click="activeTab = 'renewals'">
        <RefreshCw :size="14" /> Renewals
        <span v-if="expiringContracts.length" class="badge badge-warning" style="margin-left:4px;">{{ expiringContracts.length }}</span>
      </button>
      <button :class="['tab-btn', activeTab === 'payments' && 'active']" @click="activeTab = 'payments'">
        <DollarSign :size="14" /> Payments
      </button>
      <button :class="['tab-btn', activeTab === 'cumulative' && 'active']" @click="activeTab = 'cumulative'">
        <TrendingUp :size="14" /> Cumulative Payments
      </button>
    </div>

    <!-- ── CONTRACTS TAB ────────────────────────────────────────── -->
    <div v-if="activeTab === 'contracts'">
      <!-- Search & Filter -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="contractSearch" class="input" placeholder="Search by client or contract #…" />
        </div>
        <select v-model="contractStatusFilter" class="input" style="width:160px;">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="expiring">Expiring Soon</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select v-model="comprehensiveFilter" class="input" style="width:185px;">
          <option value="">All Contract Types</option>
          <option value="true">Comprehensive</option>
          <option value="false">Non-Comprehensive</option>
        </select>
      </div>

      <!-- Stats Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--ct-green);">{{ activeContracts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Active</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#fbbf24;">{{ expiringContracts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Expiring ≤30d</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#f87171;">{{ expiredContracts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Expired</div>
        </div>
        <div v-if="!isTech" class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--ct-accent);">{{ formatCurrency(totalContractValue) }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Total Value</div>
        </div>
      </div>

      <DataTable
        :columns="contractColumns"
        :rows="pagedContracts"
        :loading="loading"
        :total="filteredContracts.length"
        :page="contractPage"
        :pageSize="pageSize"
        empty-text="No AMC contracts found."
        :on-row-click="openView"
        @page="contractPage = $event"
      >
        <template #default="{ row }">
          <td>
            <div style="font-weight:500;color:var(--ct-primary);">{{ row.contractNumber || '—' }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ row.frequency }}</div>
          </td>
          <td>
            <div class="db-s" style="color:var(--ct-sub);">{{ row.projectId ? getProjectName(row.projectId) || row.clientName : row.clientName }}</div>
            <div class="db-s" style="font-size:11px;color:var(--ct-muted);">{{ row.projectId ? row.clientName : row.clientPhone }}</div>
          </td>
          <td style="color:var(--ct-muted);font-size:12px;">{{ formatDate(row.startDate) }}</td>
          <td>
            <span style="font-size:12px;" :style="{ color: isExpiring(row) ? '#fbbf24' : '#94a3b8' }">
              {{ formatDate(row.endDate) }}
            </span>
          </td>
          <td v-if="!isTech" style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.totalWithGST || row.contractValue) }}</td>
          <td><span :class="['badge', contractStatusBadge(effectiveStatus(row))]">{{ effectiveStatus(row) }}</span></td>
          <td style="color:var(--ct-muted);font-size:12px;">{{ (row.technicians || []).join(', ') || '—' }}</td>
          <td @click.stop>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn-secondary btn-sm" @click="openEditContract(row)" title="Edit"><Pencil :size="12" /></button>
              <button class="btn-secondary btn-sm" @click="openContractPdf(row)" title="Create Contract PDF"><FilePlus2 :size="12" /></button>
              <button class="btn-success btn-sm" @click="exportContractPDF(row)" title="Export PDF"><Download :size="12" /></button>
              <button class="btn-warning btn-sm" @click="emailContract(row)" title="Email Contract" :disabled="amcEmailPdfGenerating && amcEmailTarget?.id === row.id"><Mail :size="12" /></button>
              <button class="btn-secondary btn-sm" style="color:#10b981;" @click="openPayment(row)" title="Log Payment Received"><DollarSign :size="12" /></button>
              <button class="btn-danger btn-sm" @click="confirmDeleteContract(row)" title="Delete"><Trash2 :size="12" /></button>
            </div>
          </td>
        </template>
      </DataTable>
    </div>

    <!-- ── MONTHLY MAINTENANCE TAB ─────────────────────────────── -->
    <div v-if="activeTab === 'monthly'">
      <!-- Sub-tab nav -->
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <button v-if="isAdmin || isReception" :class="['btn-sm', monthlySubTab === 'overview' ? 'btn-primary' : 'btn-secondary']" @click="monthlySubTab = 'overview'">
          Overview
        </button>
        <button :class="['btn-sm', monthlySubTab === 'contracts' ? 'btn-primary' : 'btn-secondary']" @click="monthlySubTab = 'contracts'">
          Contracts
        </button>
      </div>

      <!-- ── OVERVIEW sub-tab (admin + reception) ── -->
      <div v-if="monthlySubTab === 'overview' && (isAdmin || isReception)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          <!-- Month navigator -->
          <button class="btn-secondary btn-sm" style="padding:5px 10px;" @click="shiftOverviewMonth(-1)">&#8249;</button>
          <select v-model="overviewMonthKey" class="input" style="width:190px;font-size:13px;">
            <option v-for="m in overviewMonthOptions" :key="m.key" :value="m.key">{{ m.label }}</option>
          </select>
          <button class="btn-secondary btn-sm" style="padding:5px 10px;" :disabled="overviewMonthKey >= currentMonthKey" @click="shiftOverviewMonth(1)">&#8250;</button>
          <span style="font-size:12px;color:var(--ct-muted);">
            <span style="color:#4ade80;font-weight:600;">{{ contractMonthOverview.filter(c=>c.hasLog).length }} done</span>
            &nbsp;&bull;&nbsp;
            <span style="color:#fbbf24;font-weight:600;">{{ contractMonthOverview.filter(c=>!c.hasLog).length }} pending</span>
          </span>
        </div>
        <div v-if="!contractMonthOverview.length" class="glass empty-state" style="padding:60px;">
          <CalendarCheck :size="36" style="margin:0 auto 16px;opacity:.3;" />
          <p>No contracts found.</p>
        </div>
        <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
          <div v-for="c in contractMonthOverview" :key="c.id" class="glass" style="padding:16px;"
            :style="c.hasLog ? 'border-color:rgba(74,222,128,0.2);' : 'border-color:rgba(245,158,11,0.15);'"
          >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
              <div>
                <div v-if="c.projectId" style="font-size:10px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(c.projectId) }}</div>
                <div style="font-weight:600;color:var(--ct-primary);font-size:13px;">{{ c.clientName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);">{{ c.contractNumber }} &bull; {{ c.frequency }}</div>
              </div>
              <span :class="['badge', c.hasLog ? 'badge-active' : 'badge-warning']">
                {{ c.hasLog ? (c.currentLogs.length > 1 ? c.currentLogs.length + ' Visits' : 'Done') : 'Pending' }}
              </span>
            </div>
            <div v-if="c.hasLog">
              <div v-for="(lg, li) in c.currentLogs" :key="lg.id || li"
                :style="li > 0 ? 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);' : ''"
                style="font-size:11px;color:var(--ct-muted);"
              >
                <div v-if="c.currentLogs.length > 1" style="font-size:10px;color:var(--ct-accent);margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em;">Visit {{ li + 1 }}</div>
                <div>Date: <span style="color:var(--ct-sub);">{{ formatDate(lg.date) }}</span></div>
                <div>Tech: <span style="color:var(--ct-sub);">{{ lg.technician }}</span></div>
                <div v-if="lg.buildingName">{{ lg.buildingName }}{{ lg.wingName ? ' · ' + lg.wingName : '' }}{{ lg.liftNo ? ' · Lift ' + lg.liftNo : '' }}</div>
                <div v-if="expandedOverviewIds.includes(c.id + '_' + li) && lg.remarks" style="margin-top:4px;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:6px;">{{ lg.remarks }}</div>
                <button v-if="lg.remarks" class="btn-secondary btn-sm" style="margin-top:5px;font-size:10px;" @click="toggleOverviewExpand(c.id + '_' + li)">
                  {{ expandedOverviewIds.includes(c.id + '_' + li) ? 'Hide' : 'Remarks' }}
                </button>
              </div>
              <button class="btn-secondary btn-sm" style="width:100%;justify-content:center;margin-top:10px;color:var(--ct-accent);"
                @click="selectedContractId = c.id; monthlySubTab = 'contracts'; openLogMaintenance(overviewMonthKey)">
                <Plus :size="11" /> Log Another
              </button>
            </div>
            <button v-if="!c.hasLog" class="btn-primary btn-sm" style="width:100%;justify-content:center;" @click="selectedContractId = c.id; monthlySubTab = 'contracts'; openLogMaintenance(overviewMonthKey)">
              <Plus :size="12" /> Log Maintenance
            </button>
          </div>
        </div>
      </div>

      <!-- ── CONTRACTS sub-tab ── -->
      <div v-if="monthlySubTab === 'contracts'">
        <!-- Contract Selector -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:flex-end;">
          <div style="flex:1;min-width:240px;">
            <label class="label">Search Contract</label>
            <input v-model="monthlyContractSearch" class="input" placeholder="Search by project name or client…" />
          </div>
          <div style="flex:2;min-width:280px;">
            <label class="label">Select Contract</label>
            <select v-model="selectedContractId" class="input">
              <option value="">— Choose a contract —</option>
              <option v-for="c in filteredMonthlyContracts" :key="c.id" :value="c.id">
                {{ c.contractNumber }} — {{ c.clientName }}{{ getProjectName(c.projectId) ? ' · ' + getProjectName(c.projectId) : '' }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="!selectedContractId" class="empty-state glass" style="padding:60px;">
          <CalendarCheck :size="36" style="margin:0 auto 16px;opacity:.3;" />
          <p>Select a contract to view monthly maintenance schedule.</p>
        </div>

        <div v-else>
          <div class="glass" style="padding:18px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
              <div>
                <div v-if="selectedContract?.projectId" style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(selectedContract.projectId) }}</div>
                <div style="font-weight:600;color:var(--ct-primary);">{{ selectedContract?.clientName }}</div>
                <div style="font-size:12px;color:var(--ct-muted);">{{ selectedContract?.contractNumber }} &bull; {{ selectedContract?.frequency }}</div>
              </div>
              <button class="btn-primary btn-sm" @click="openLogMaintenance()">
                <Plus :size="14" /> Log Maintenance
              </button>
            </div>
          </div>

          <!-- Monthly grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
            <div v-for="month in maintenanceMonths" :key="month.key" class="glass" style="padding:18px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="font-weight:600;color:var(--ct-primary);font-size:13px;">{{ month.label }}</div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span :class="['badge', month.done ? 'badge-active' : 'badge-warning']">
                    {{ month.done ? (month.logs.length > 1 ? month.logs.length + ' Visits' : 'Done') : 'Pending' }}
                  </span>
                </div>
              </div>
              <div v-if="month.done">
                <!-- Show each logged entry -->
                <div v-for="(lg, li) in month.logs" :key="lg.id || li"
                  :style="li > 0 ? 'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);' : ''"
                >
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <div style="font-size:10px;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">
                      {{ month.logs.length > 1 ? 'Visit ' + (li + 1) : 'Visit' }}
                    </div>
                    <div v-if="isAdmin || isReception" style="display:flex;gap:4px;">
                      <button class="btn-secondary btn-sm" style="padding:2px 6px;" @click.stop="openEditLog(lg)" title="Edit"><Pencil :size="10" /></button>
                      <button v-if="isAdmin" class="btn-danger btn-sm" style="padding:2px 6px;" @click.stop="confirmDeleteLog(lg)" title="Delete"><Trash2 :size="10" /></button>
                    </div>
                  </div>
                  <div style="font-size:12px;color:var(--ct-muted);">Date: <span style="color:var(--ct-sub);">{{ formatDate(lg.date) }}</span></div>
                  <div style="font-size:12px;color:var(--ct-muted);margin-top:3px;">Tech: <span style="color:var(--ct-sub);">{{ lg.technician }}</span></div>
                  <div v-if="lg.buildingName" style="font-size:11px;color:var(--ct-muted);margin-top:3px;">
                    {{ lg.buildingName }}{{ lg.wingName ? ' · ' + lg.wingName : '' }}{{ lg.liftNo ? ' · Lift ' + lg.liftNo : '' }}
                  </div>
                  <div v-if="lg.remarks" style="font-size:11px;color:var(--ct-muted);margin-top:5px;font-style:italic;">{{ lg.remarks }}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                    <button class="btn-secondary btn-sm" @click.stop="regenerateAndDownloadReceipt(lg)" title="Download Service Report">
                      <Download :size="11" /> Service Report
                    </button>
                    <button
                      class="btn-secondary btn-sm"
                      style="color:#25D366;"
                      @click.stop="shareLogOnWhatsApp(lg, month.key)"
                      title="Send Receipt via WhatsApp"
                    ><MessageCircle :size="11" /> WhatsApp</button>
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
                  <button class="btn-secondary btn-sm" style="color:var(--ct-accent);" @click.stop="openLogMaintenance(month.key)" title="Log Another Visit">
                    <Plus :size="11" /> Log Another
                  </button>
                </div>
              </div>
              <div v-else>
                <div style="font-size:12px;color:var(--ct-muted);margin-bottom:10px;">No maintenance logged.</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button class="btn-secondary btn-sm" @click.stop="openLogMaintenance(month.key)" title="Log Maintenance Visit">
                    <Plus :size="11" /> Log Visit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RENEWALS TAB ────────────────────────────────────────── -->
    <div v-if="activeTab === 'renewals'">
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
        <div class="search-box" style="flex:1;min-width:200px;">
          <Search :size="14" class="search-icon" />
          <input v-model="renewalSearch" class="input" placeholder="Search client or contract #…" />
        </div>
        <button
          v-for="days in [30, 60, 90]"
          :key="days"
          :class="['btn-sm', !renewalShowExpired && renewalFilter === days ? 'btn-primary' : 'btn-secondary']"
          @click="renewalShowExpired = false; renewalFilter = renewalFilter === days ? null : days"
        >Expiring ≤ {{ days }} days</button>
        <button
          :class="['btn-sm', renewalShowExpired ? 'btn-danger' : 'btn-secondary']"
          @click="renewalShowExpired = !renewalShowExpired"
        ><AlertTriangle :size="12" /> Expired</button>
        <input v-if="!renewalShowExpired" v-model="renewalMonthFilter" type="month" class="input" style="width:160px;" title="Filter by specific expiry month" />
        <button v-if="renewalMonthFilter && !renewalShowExpired" class="btn-secondary btn-sm" @click="renewalMonthFilter = ''" title="Clear month filter">✕ Clear Month</button>
      </div>

      <div v-if="!renewalContracts.length" class="glass empty-state" style="padding:60px;">
        <CheckCircle2 :size="36" style="margin:0 auto 16px;opacity:.3;color:var(--ct-green);" />
        <p>{{ renewalShowExpired ? 'No expired contracts.' : renewalMonthFilter ? 'No contracts due for renewal in the selected month.' : renewalFilter ? `No contracts expiring within ${renewalFilter} days.` : 'Select a filter or month to view renewals.' }}</p>
      </div>

      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;">
        <div v-for="c in renewalContracts" :key="c.id" class="glass" style="padding:22px;border-color:rgba(245,158,11,0.2);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:14px;">
            <div>
              <div v-if="c.projectId" style="font-size:16px;font-weight:700;color:var(--ct-primary);margin-bottom:3px;line-height:1.3;">{{ getProjectName(c.projectId) }}</div>
              <div v-else style="font-size:16px;font-weight:700;color:var(--ct-primary);margin-bottom:3px;line-height:1.3;">{{ c.clientName }}</div>
              <div v-if="c.projectId" style="font-size:12px;color:var(--ct-sub);margin-bottom:2px;">{{ c.clientName }}</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ c.contractNumber }}</div>
            </div>
            <span :class="['badge', c.status === 'expired' ? 'badge-danger' : 'badge-warning']">
              {{ c.status === 'expired' ? 'Expired' : daysUntilExpiry(c) + 'd left' }}
            </span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Expires</div>
              <div style="font-size:12px;color:#fbbf24;margin-top:2px;">{{ formatDate(c.endDate) }}</div>
            </div>
            <div v-if="!isTech">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Value</div>
              <div style="font-size:12px;color:var(--ct-accent);margin-top:2px;font-weight:600;">{{ formatCurrency(c.contractValue) }}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Frequency</div>
              <div style="font-size:12px;color:var(--ct-sub);margin-top:2px;">{{ c.frequency }}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Technician</div>
              <div style="font-size:12px;color:var(--ct-sub);margin-top:2px;">{{ c.technician || '—' }}</div>
            </div>
          </div>
          <button class="btn-primary btn-sm" style="width:100%;justify-content:center;" @click="quickRenew(c)">
            <RefreshCw :size="12" /> Quick Renew
          </button>
        </div>
      </div>
    </div>

    <!-- ── PAYMENTS TAB ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'payments'">
      <!-- Filters -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:200px;">
          <Search :size="14" class="search-icon" />
          <input v-model="paymentsSearch" class="input" placeholder="Search client or contract #…" />
        </div>
        <select v-model="paymentsContractFilter" class="input" style="width:220px;">
          <option value="">All Contracts</option>
          <option v-for="c in visibleContracts.filter(c => c.status !== 'cancelled' && c.status !== 'inactive')" :key="c.id" :value="c.id">
            {{ c.contractNumber }} — {{ c.clientName }}
          </option>
        </select>
        <select v-model="paymentsStatusFilter" class="input" style="width:160px;">
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <input v-model="paymentsMonthFilter" type="month" class="input" style="width:160px;" title="Filter by due month" />
        <button v-if="paymentsMonthFilter" class="btn-secondary btn-sm" @click="paymentsMonthFilter = ''">✕ Clear</button>
      </div>

      <div v-if="!filteredInstallments.length" class="glass empty-state" style="padding:60px;">
        <DollarSign :size="36" style="margin:0 auto 16px;opacity:.3;" />
        <p>No installments found for the selected filters.</p>
      </div>

      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
        <div v-for="inst in filteredInstallments" :key="inst.contractId + '_' + inst.installmentNo"
          class="glass" style="padding:18px;"
          :style="inst.isOverdue ? 'border-color:rgba(248,113,113,0.3);' : inst.isPaid ? 'border-color:rgba(74,222,128,0.2);' : 'border-color:rgba(99,102,241,0.15);'"
        >
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
            <div>
              <div v-if="inst.projectId" style="font-size:10px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(inst.projectId) }}</div>
              <div style="font-weight:600;color:var(--ct-primary);font-size:13px;">{{ inst.clientName }}</div>
              <div style="font-size:11px;color:var(--ct-muted);">{{ inst.contractNumber }}</div>
            </div>
            <span :class="['badge', inst.isPaid ? 'badge-active' : inst.isOverdue ? 'badge-danger' : 'badge-info']" style="flex-shrink:0;">
              {{ inst.isPaid ? 'Paid' : inst.isOverdue ? 'Overdue' : 'Pending' }}
            </span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Installment</div>
              <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-top:2px;">{{ inst.installmentNo }} / {{ inst.totalInstallments }}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Amount</div>
              <div style="font-size:13px;font-weight:600;color:var(--ct-accent);margin-top:2px;">{{ formatCurrency(inst.amount) }}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Due Date</div>
              <div style="font-size:12px;margin-top:2px;" :style="{ color: inst.isOverdue ? '#f87171' : 'var(--ct-sub)' }">{{ inst.dueDate || '—' }}</div>
            </div>
            <div v-if="inst.isPaid">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Paid On</div>
              <div style="font-size:12px;color:#4ade80;margin-top:2px;">{{ inst.paidDate || '—' }}</div>
            </div>
          </div>
          <div v-if="inst.isPaid">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--ct-muted);padding:8px 10px;background:rgba(74,222,128,0.04);border-radius:8px;border:1px solid rgba(74,222,128,0.12);">
              <span>✓ {{ formatCurrency(inst.paidAmount) }} via {{ inst.paidMethod || '—' }}<span v-if="inst.paidReference"> · Ref: {{ inst.paidReference }}</span></span>
              <button class="btn-secondary btn-sm" style="padding:3px 7px;flex-shrink:0;" title="Download Receipt" @click.stop="downloadPaymentReceipt(getContractById(inst.contractId), { amount: inst.paidAmount, date: inst.paidDate, method: inst.paidMethod, reference: inst.paidReference }, inst.paidHistoryIdx)">
                <Download :size="11" />
              </button>
              <button v-if="isAdmin || isReception" class="btn-secondary btn-sm" style="padding:3px 7px;flex-shrink:0;" title="Edit payment" @click.stop="editingInstPay?.contractId === inst.contractId && editingInstPay?.origIdx === inst.paidHistoryIdx ? editingInstPay = null : openInstPayEdit(inst)">
                <Pencil :size="11" />
              </button>
            </div>
            <div v-if="editingInstPay && editingInstPay.contractId === inst.contractId && editingInstPay.origIdx === inst.paidHistoryIdx"
              style="margin-top:8px;padding:10px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:8px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:11px;font-weight:600;color:var(--ct-accent);margin-bottom:2px;">Edit Payment</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:110px;">
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Amount (₹)</div>
                  <input v-model.number="editInstPayForm.amount" type="number" class="input" style="padding:5px 8px;font-size:12px;" />
                </div>
                <div style="flex:1;min-width:110px;">
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Payment Date</div>
                  <input v-model="editInstPayForm.date" type="date" class="input" style="padding:5px 8px;font-size:12px;" />
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:110px;">
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Method</div>
                  <select v-model="editInstPayForm.method" class="input" style="padding:5px 8px;font-size:12px;">
                    <option value="cash">Cash</option>
                    <option value="bank-transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style="flex:1;min-width:110px;">
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Reference</div>
                  <input v-model="editInstPayForm.reference" class="input" style="padding:5px 8px;font-size:12px;" placeholder="Ref / Cheque No." />
                </div>
              </div>
              <div style="display:flex;gap:6px;justify-content:flex-end;">
                <button class="btn-secondary btn-sm" @click="editingInstPay = null">Cancel</button>
                <button class="btn-primary btn-sm" :disabled="amcSaving" @click="saveInstPayEdit">
                  <Save :size="11" /> {{ amcSaving ? 'Saving…' : 'Update' }}
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="inst.isOverdue" style="font-size:11px;color:#f87171;padding:8px 10px;background:rgba(248,113,113,0.04);border-radius:8px;border:1px solid rgba(248,113,113,0.12);margin-bottom:8px;">
            ⚠ Payment overdue — due {{ inst.dueDate }}
          </div>
          <div v-else style="font-size:11px;color:var(--ct-muted);padding:8px 10px;background:rgba(99,102,241,0.04);border-radius:8px;border:1px solid rgba(99,102,241,0.1);margin-bottom:8px;">
            Due {{ inst.dueDate || 'date not set' }}
          </div>
          <button v-if="!inst.isPaid" class="btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:4px;" @click="openPaymentForInstallment(inst)">
            <DollarSign :size="12" /> Log Payment
          </button>
        </div>
      </div>
    </div>

    <!-- ── CUMULATIVE PAYMENTS TAB ────────────────────────────────────────── -->
    <div v-if="activeTab === 'cumulative'">
      <!-- Month navigator -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <button class="btn-secondary btn-sm" style="padding:5px 10px;" @click="shiftCumulativeMonth(-1)">&#8249;</button>
        <select v-model="cumulativeMonthKey" class="input" style="width:210px;font-size:13px;">
          <option v-for="m in cumulativeMonthOptions" :key="m.key" :value="m.key">{{ m.label }}</option>
        </select>
        <button class="btn-secondary btn-sm" style="padding:5px 10px;" :disabled="cumulativeMonthKey >= currentMonthKey" @click="shiftCumulativeMonth(1)">&#8250;</button>
      </div>

      <!-- Summary stat cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
        <div class="glass" style="padding:20px;text-align:center;border-color:rgba(99,102,241,0.2);">
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Total Receivable</div>
          <div style="font-size:22px;font-weight:700;color:var(--ct-accent);">{{ formatCurrency(cumulativeSummary.total) }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">{{ cumulativeSummary.contractCount }} contracts</div>
        </div>
        <div class="glass" style="padding:20px;text-align:center;border-color:rgba(74,222,128,0.2);">
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Received</div>
          <div style="font-size:22px;font-weight:700;color:#4ade80;">{{ formatCurrency(cumulativeSummary.received) }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">{{ cumulativeSummary.paidCount }} payments</div>
        </div>
        <div class="glass" style="padding:20px;text-align:center;border-color:rgba(248,113,113,0.2);">
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Yet to Receive</div>
          <div style="font-size:22px;font-weight:700;color:#f87171;">{{ formatCurrency(cumulativeSummary.pending) }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">{{ cumulativeSummary.pendingCount }} pending</div>
        </div>
        <div class="glass" style="padding:20px;text-align:center;border-color:rgba(251,191,36,0.2);">
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Overdue</div>
          <div style="font-size:22px;font-weight:700;color:#fbbf24;">{{ formatCurrency(cumulativeSummary.overdue) }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">{{ cumulativeSummary.overdueCount }} overdue</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="cumulativeSummary.total > 0" style="margin-bottom:24px;padding:16px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;color:var(--ct-muted);">Collection Rate</span>
          <span style="font-size:13px;font-weight:600;color:#4ade80;">{{ Math.round(cumulativeSummary.received / cumulativeSummary.total * 100) }}%</span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
          <div :style="`height:100%;border-radius:99px;background:linear-gradient(90deg,#4ade80,#22c55e);width:${Math.min(100, Math.round(cumulativeSummary.received / cumulativeSummary.total * 100))}%;transition:width .4s;`"></div>
        </div>
      </div>

      <!-- Per-contract payment cards -->
      <div v-if="!cumulativeContracts.length" class="glass empty-state" style="padding:60px;">
        <TrendingUp :size="36" style="margin:0 auto 16px;opacity:.3;" />
        <p>No receivable payments found for {{ cumulativeMonthLabel }}.</p>
      </div>
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
        <div v-for="item in cumulativeContracts" :key="item.contractId"
          class="glass" style="padding:18px;"
          :style="item.isOverdue ? 'border-color:rgba(248,113,113,0.3);' : item.isPaid ? 'border-color:rgba(74,222,128,0.2);' : 'border-color:rgba(99,102,241,0.15);'"
        >
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
            <div style="min-width:0;">
              <div v-if="item.projectId" style="font-size:13px;font-weight:700;color:var(--ct-primary);margin-bottom:2px;line-height:1.3;">{{ getProjectName(item.projectId) || item.clientName }}</div>
              <div v-else style="font-size:13px;font-weight:700;color:var(--ct-primary);margin-bottom:2px;">{{ item.clientName }}</div>
              <div v-if="item.projectId" style="font-size:11px;color:var(--ct-sub);">{{ item.clientName }}</div>
              <div style="font-size:11px;color:var(--ct-muted);">{{ item.contractNumber }}</div>
            </div>
            <span :class="['badge', item.isPaid ? 'badge-active' : item.isOverdue ? 'badge-danger' : 'badge-info']" style="flex-shrink:0;margin-left:8px;">
              {{ item.isPaid ? 'Received' : item.isOverdue ? 'Overdue' : 'Pending' }}
            </span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Receivable</div>
              <div style="font-size:14px;font-weight:700;color:var(--ct-accent);margin-top:2px;">{{ formatCurrency(item.amount) }}</div>
            </div>
            <div v-if="item.installmentNo">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Installment</div>
              <div style="font-size:13px;color:var(--ct-sub);margin-top:2px;">{{ item.installmentNo }} / {{ item.totalInstallments }}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Due Date</div>
              <div style="font-size:12px;margin-top:2px;" :style="{ color: item.isOverdue ? '#f87171' : 'var(--ct-sub)' }">{{ item.dueDate || '—' }}</div>
            </div>
            <div v-if="item.isPaid">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Received On</div>
              <div style="font-size:12px;color:#4ade80;margin-top:2px;">{{ item.paidDate || '—' }}</div>
            </div>
          </div>

          <!-- Received detail -->
          <div v-if="item.isPaid" style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--ct-muted);padding:8px 10px;background:rgba(74,222,128,0.04);border-radius:8px;border:1px solid rgba(74,222,128,0.12);">
            <span>✓ {{ formatCurrency(item.paidAmount ?? item.amount) }} via {{ item.paidMethod || '—' }}<span v-if="item.paidReference"> · Ref: {{ item.paidReference }}</span></span>
            <button class="btn-secondary btn-sm" style="padding:3px 7px;flex-shrink:0;" title="Download Receipt" @click.stop="downloadPaymentReceipt(getContractById(item.contractId), { amount: item.paidAmount ?? item.amount, date: item.paidDate, method: item.paidMethod, reference: item.paidReference }, Math.max(0, item.paidHistoryIdx))">
              <Download :size="11" />
            </button>
          </div>
          <div v-else-if="item.isOverdue" style="font-size:11px;color:#f87171;padding:8px 10px;background:rgba(248,113,113,0.04);border-radius:8px;border:1px solid rgba(248,113,113,0.12);">
            ⚠ Overdue since {{ item.dueDate }}
          </div>
          <div v-else style="font-size:11px;color:var(--ct-muted);padding:8px 10px;background:rgba(99,102,241,0.04);border-radius:8px;border:1px solid rgba(99,102,241,0.1);">
            Due {{ item.dueDate || 'not set' }}
          </div>

          <button v-if="!item.isPaid && !isTech" class="btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:8px;" @click="openPaymentForInstallmentById(item)">
            <DollarSign :size="12" /> Log Payment
          </button>
        </div>
      </div>
    </div>

    <!-- ── Contract Add/Edit Modal ─────────────────────────────── -->
    <AppModal
      v-model="showContractModal"
      :title="editingContract ? 'Edit Contract' : 'New AMC Contract'"
      :subtitle="editingContract ? editingContract.contractNumber : 'Create a new Annual Maintenance Contract'"
      width="740px"
    >
      <div class="form-grid">
        <!-- Project Selection Toggle -->
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
            <button
              type="button"
              @click="amcUseProject = !amcUseProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${amcUseProject ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`"
            >
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${amcUseProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>

        <!-- Project Search (when toggle ON) -->
        <div v-if="amcUseProject" class="form-group form-full">
          <label class="label">Select Project *</label>
          <div style="position:relative;">
            <input
              v-model="amcProjectSearch"
              class="input"
              placeholder="Search project name…"
              @focus="amcShowProjectDropdown = true"
              @blur="amcDelayCloseDropdown"
            />
            <div v-if="amcShowProjectDropdown && amcFilteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div
                v-for="p in amcFilteredProjects"
                :key="p.id"
                @mousedown.prevent="selectAmcProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="contractForm.projectId === p.id ? 'background:rgba(99,102,241,0.15);' : ''"
              >
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.city || p.address || '—' }}</div>
              </div>
              <div v-if="!amcFilteredProjects.length" style="padding:12px 14px;font-size:12px;color:var(--ct-muted);">No projects found</div>
            </div>
          </div>
          <div v-if="contractForm.projectId && !amcShowProjectDropdown" style="margin-top:8px;padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;font-size:12px;color:var(--ct-green);">
            ✓ Project linked — client details auto-filled below
          </div>
          <!-- Lift selection -->
          <div v-if="contractForm.projectId && selectedAmcProject && selectedAmcProject.buildings && selectedAmcProject.buildings.length" class="form-group" style="margin-top:10px;">
            <label class="label">Select Buildings / Wings / Lifts</label>
            <LiftSelector v-model="contractForm.liftSelection" :project="selectedAmcProject" />
          </div>
        </div>

        <div class="form-group">
          <label class="label">Contract Number</label>
          <input v-model="contractForm.contractNumber" class="input" placeholder="AMC-001" />
        </div>
        <div class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="contractForm.clientName" class="input" placeholder="Client / Company name" :readonly="amcUseProject && !!contractForm.projectId" :style="amcUseProject && contractForm.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Client Phone</label>
          <input v-model="contractForm.clientPhone" class="input" placeholder="+91 98765 43210" :readonly="amcUseProject && !!contractForm.projectId" :style="amcUseProject && contractForm.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Client Email</label>
          <input v-model="contractForm.clientEmail" class="input" type="email" placeholder="client@example.com" :readonly="amcUseProject && !!contractForm.projectId" :style="amcUseProject && contractForm.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group form-full">
          <label class="label">Client Address</label>
          <textarea v-model="contractForm.clientAddress" class="input" rows="2" placeholder="Address…" :readonly="amcUseProject && !!contractForm.projectId" :style="amcUseProject && contractForm.projectId ? 'opacity:.8;' : ''"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Start Date *</label>
          <input v-model="contractForm.startDate" class="input" type="date" @change="calcEndDate" />
        </div>
        <div class="form-group">
          <label class="label">Duration (months)</label>
          <select v-model.number="contractForm.durationMonths" class="input" @change="calcEndDate">
            <option :value="12">12 months (1 year)</option>
            <option :value="24">24 months (2 years)</option>
            <option :value="36">36 months (3 years)</option>
            <option :value="6">6 months</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">End Date (auto-calculated)</label>
          <input v-model="contractForm.endDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Frequency</label>
          <select v-model="contractForm.frequency" class="input">
            <option value="monthly">Monthly (every month)</option>
            <option value="bi-monthly">Every 2 Months</option>
            <option value="quarterly">Quarterly (every 3 months)</option>
            <option value="4-monthly">Every 4 Months</option>
            <option value="half-yearly">Half-Yearly (every 6 months)</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <!-- Comprehensive / Non-Comprehensive toggle -->
        <div class="form-group form-full">
          <label class="label">Contract Type</label>
          <div style="display:flex;gap:10px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);font-size:13px;color:var(--ct-sub);transition:all .15s;" :style="contractForm.isComprehensive === true ? 'background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:var(--ct-green);' : ''">
              <input type="radio" :value="true" v-model="contractForm.isComprehensive" style="accent-color:#10b981;" />
              Comprehensive
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);font-size:13px;color:var(--ct-sub);transition:all .15s;" :style="contractForm.isComprehensive === false ? 'background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.3);color:#fbbf24;' : ''">
              <input type="radio" :value="false" v-model="contractForm.isComprehensive" style="accent-color:#f59e0b;" />
              Non-Comprehensive
            </label>
          </div>
        </div>
        <div v-if="!isTech" class="form-group">
          <label class="label">Contract Value (₹) *</label>
          <input v-model.number="contractForm.contractValue" class="input" type="number" min="0" @input="calcGST" placeholder="0" />
        </div>
        <div v-if="!isTech" class="form-group">
          <label class="label">GST (%)</label>
          <select v-model.number="contractForm.gstPercent" class="input" @change="calcGST">
            <option :value="0">0%</option>
            <option :value="5">5%</option>
            <option :value="12">12%</option>
            <option :value="18">18%</option>
          </select>
        </div>
        <div v-if="!isTech" class="form-group">
          <label class="label">GST Amount (₹)</label>
          <input :value="contractForm.gstAmount" class="input" readonly style="opacity:.7;" />
        </div>
        <div v-if="!isTech" class="form-group">
          <label class="label">Total with GST (₹)</label>
          <input :value="contractForm.totalWithGST" class="input" readonly style="color:var(--ct-accent);font-weight:600;opacity:.9;" />
        </div>
        <div v-if="!isTech" class="form-group">
          <label class="label">Payment Type</label>
          <select v-model="contractForm.paymentType" class="input">
            <option value="full">Full Payment</option>
            <option value="installments">Installments</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="contractForm.status" class="input">
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="expiring">Expiring Soon</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Assigned Technicians (select multiple)</label>
          <TechnicianSelect v-model="contractForm.technicians" />
        </div>
        <!-- Installment breakdown -->
        <div v-if="!isTech && contractForm.paymentType === 'installments'" class="form-full glass" style="padding:16px;border-radius:12px;border-color:rgba(99,102,241,0.2);">
          <div style="font-size:12px;color:var(--ct-accent);font-weight:600;margin-bottom:10px;">Installment Breakdown</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
            <div v-for="(inst, i) in installments" :key="i" class="glass" style="padding:10px;border-radius:8px;">
              <div style="font-size:11px;color:var(--ct-muted);">Installment {{ i + 1 }}</div>
              <div style="font-size:13px;color:var(--ct-accent);font-weight:600;margin-top:2px;">{{ formatCurrency(inst) }}</div>
            </div>
          </div>
        </div>
        <div class="form-group form-full">
          <label class="label">Notes</label>
          <textarea v-model="contractForm.notes" class="input" rows="3" placeholder="Additional notes…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showContractModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving" @click="saveContract">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editingContract ? 'Update Contract' : 'Create Contract') }}
        </button>
      </template>
    </AppModal>

    <!-- Log Maintenance Modal -->
    <AppModal v-model="showLogModal" :title="editingLog ? 'Edit Maintenance Visit' : 'Log Maintenance Visit'" :subtitle="selectedContract?.clientName" width="680px">
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Month *</label>
          <select v-model="logForm.month" class="input">
            <option v-for="m in monthNames" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Year</label>
          <input v-model.number="logForm.year" class="input" type="number" :min="2020" :max="2030" />
        </div>
        <div class="form-group">
          <label class="label">Visit Date *</label>
          <input v-model="logForm.date" class="input" type="date"
            :readonly="isTech"
            :style="isTech ? 'opacity:0.7;cursor:not-allowed;background:rgba(99,102,241,0.06);' : ''"
            :title="isTech ? 'Date is locked to today for technicians' : ''"
          />
          <div v-if="isTech" style="font-size:10px;color:var(--ct-accent);margin-top:4px;">Locked to today — cannot be changed</div>
        </div>
        <div class="form-group">
          <label class="label">Technician</label>
          <select v-model="logForm.technician" class="input">
            <option value="">Select technician…</option>
            <option v-for="t in (selectedContract?.technicians || [])" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <!-- Building / Wing / Lift -->
        <div v-if="selectedContract?.projectId && projectForLog && projectForLog.buildings && projectForLog.buildings.length" class="form-group" style="grid-column:1/-1;">
          <label class="label">Select Building / Wing / Lift</label>
          <LiftSelector v-model="logLiftSelection" :project="projectForLog" />
        </div>
        <template v-else>
          <div class="form-group">
            <label class="label">Building / Tower</label>
            <select v-if="selectedContractBuildings.length" v-model="logForm.buildingName" class="input">
              <option value="">— Select Building —</option>
              <option v-for="b in selectedContractBuildings" :key="b" :value="b">{{ b }}</option>
            </select>
            <input v-else v-model="logForm.buildingName" class="input" placeholder="e.g. Tower A, Block 1" />
          </div>
          <div class="form-group">
            <label class="label">Wing / Floor</label>
            <input v-model="logForm.wingName" class="input" placeholder="e.g. A Wing, 5th Floor" />
          </div>
          <div class="form-group">
            <label class="label">Lift No.</label>
            <input v-model="logForm.liftNo" class="input" placeholder="e.g. L-01, Lift 1" />
          </div>
        </template>
        <!-- Service checklist -->
        <div class="form-group form-full" style="border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;margin-top:4px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">
            Service Checklist
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px;">
            <div v-for="(item, i) in SERVICE_CHECKLIST_LEFT" :key="'l'+i" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12.5px;color:var(--ct-sub);border-bottom:1px solid rgba(255,255,255,0.04);">
              <input type="checkbox" v-model="logForm.checklist['l'+i]" style="width:15px;height:15px;flex-shrink:0;" />
              <span>{{ item }}</span>
            </div>
            <div v-for="(item, i) in SERVICE_CHECKLIST_RIGHT" :key="'r'+i" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12.5px;color:var(--ct-sub);border-bottom:1px solid rgba(255,255,255,0.04);">
              <input type="checkbox" v-model="logForm.checklist['r'+i]" style="width:15px;height:15px;flex-shrink:0;" />
              <span>{{ item }}</span>
            </div>
          </div>
        </div>

        <div class="form-group form-full">
          <label class="label">Remarks / Work Done</label>
          <textarea v-model="logForm.remarks" class="input" rows="3" placeholder="Work done, observations, parts replaced…"></textarea>
        </div>

        <!-- Technician signature -->
        <div class="form-group form-full">
          <label class="label">Technician Signature</label>
          <SignatureCanvas v-model="logForm.technicianSignature" />
        </div>

        <!-- Signatory details -->
        <div style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;margin-top:4px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">
            Customer Acknowledgement
          </div>
          <div class="form-grid" style="margin-bottom:0;">
            <div class="form-group">
              <label class="label">Signatory Name</label>
              <input v-model="logForm.signatoryName" class="input" placeholder="Person signing on behalf of client" />
            </div>
            <div class="form-group">
              <label class="label">Designation / Role</label>
              <input v-model="logForm.signatoryDesignation" class="input" placeholder="e.g. Facility Manager, Society Secretary" />
            </div>
          </div>
        </div>

        <!-- E-Signature -->
        <div class="form-group form-full">
          <label class="label">Customer Signature</label>
          <SignatureCanvas v-model="logForm.signature" />
        </div>

        <!-- Optional: Upload signature image instead of drawing -->
        <div class="form-group form-full" style="margin-top:4px;">
          <label class="label" style="margin-bottom:6px;">Or Upload Signature Image <span style="font-size:10px;color:var(--ct-muted);font-weight:400;">(optional)</span></label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:12px;color:var(--ct-secondary);background:rgba(255,255,255,0.04);">
              <Upload :size="13" /> Browse Image
              <input type="file" accept="image/*" style="display:none;" @change="handleSigImageUpload" />
            </label>
            <span v-if="logForm.signatureImage" style="font-size:11px;color:var(--ct-green);">✓ Image selected</span>
            <button v-if="logForm.signatureImage" type="button" class="btn-danger btn-sm" @click="logForm.signatureImage = ''">Remove</button>
          </div>
          <img v-if="logForm.signatureImage" :src="logForm.signatureImage" style="margin-top:8px;max-height:80px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);display:block;" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showLogModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving" @click="saveLog">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editingLog ? 'Update Visit' : 'Log Visit & Generate Receipt') }}
        </button>
      </template>
    </AppModal>

    <!-- Quick Renew Modal -->
    <AppModal v-model="showRenewModal" title="Renew Contract" :subtitle="renewTarget?.clientName" width="680px">
      <div style="display:flex;flex-direction:column;gap:14px;">
        <!-- Previous period info -->
        <div v-if="renewTarget" style="padding:10px 14px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:10px;font-size:12px;color:var(--ct-muted);">
          <span style="color:#f87171;font-weight:600;">Previous period:</span>
          {{ formatDate(renewTarget.startDate) }} → {{ formatDate(renewTarget.endDate) }}
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="label">New Start Date</label>
            <input v-model="renewForm.startDate" class="input" type="date" @change="calcRenewEndDate" />
          </div>
          <div class="form-group">
            <label class="label">Duration (months)</label>
            <select v-model.number="renewForm.durationMonths" class="input" @change="calcRenewEndDate">
              <option :value="12">12 months</option>
              <option :value="24">24 months</option>
              <option :value="36">36 months</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">New End Date</label>
            <input v-model="renewForm.endDate" class="input" type="date" />
          </div>
          <div v-if="!isTech" class="form-group">
            <label class="label">Contract Value (₹)</label>
            <input v-model.number="renewForm.contractValue" class="input" type="number" min="0" @input="calcRenewGST" />
          </div>
          <div v-if="!isTech" class="form-group">
            <label class="label">GST (%)</label>
            <select v-model.number="renewForm.gstPercent" class="input" @change="calcRenewGST">
              <option :value="0">0%</option>
              <option :value="5">5%</option>
              <option :value="12">12%</option>
              <option :value="18">18%</option>
            </select>
          </div>
          <div v-if="!isTech" class="form-group">
            <label class="label">Total with GST (₹)</label>
            <input :value="renewForm.totalWithGST" class="input" readonly style="color:var(--ct-accent);font-weight:600;" />
          </div>
          <div class="form-group form-full">
            <label class="label">Renewal Notes <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
            <textarea v-model="renewForm.notes" class="input" rows="2" placeholder="e.g. Rate revised, new scope added…"></textarea>
          </div>
        </div>

        <!-- Renewal Letter Details -->
        <div style="padding:14px;background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.18);border-radius:10px;">
          <div style="font-size:13px;font-weight:600;color:#10b981;margin-bottom:12px;">Renewal Letter Details</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="label">Letter Date</label>
              <input v-model="renewForm.letterDate" class="input" type="date" />
            </div>
            <div class="form-group">
              <label class="label">Contact Person</label>
              <input v-model="renewForm.contactPerson" class="input" placeholder="e.g. Mr. Sharma" />
            </div>
            <div class="form-group">
              <label class="label">Previous Contract Amount</label>
              <input v-model="renewForm.prevAmount" class="input" placeholder="e.g. ₹20,000/-" />
            </div>
            <div class="form-group">
              <label class="label">Years Maintained</label>
              <input v-model="renewForm.yearsMaintained" class="input" placeholder="e.g. four" />
            </div>
            <div class="form-group">
              <label class="label">Increase %</label>
              <input v-model="renewForm.increasePct" class="input" placeholder="e.g. 10%" />
            </div>
            <div class="form-group">
              <label class="label">New Amount</label>
              <input v-model="renewForm.newAmount" class="input" placeholder="e.g. ₹22,000/-" />
            </div>
            <div class="form-group form-full">
              <label class="label">Authorized Signatory</label>
              <input v-model="renewForm.authorizedSignatory" class="input" placeholder="e.g. RAMAKRISHNAN M.V." />
            </div>
            <div class="form-group">
              <label class="label">Lift Make</label>
              <input v-model="renewForm.liftMake" class="input" placeholder="e.g. Escon" />
            </div>
            <div class="form-group">
              <label class="label">Door Type</label>
              <input v-model="renewForm.liftDoorType" class="input" placeholder="e.g. Automatic Centre Opening" />
            </div>
            <div class="form-group">
              <label class="label">Typology</label>
              <input v-model="renewForm.liftTypology" class="input" placeholder="e.g. Geared Machine" />
            </div>
            <div class="form-group">
              <label class="label">Load / Capacity</label>
              <input v-model="renewForm.liftLoad" class="input" placeholder="e.g. 06 Passenger" />
            </div>
            <div class="form-group">
              <label class="label">Height / Floors</label>
              <input v-model="renewForm.liftHeight" class="input" placeholder="e.g. G+6" />
            </div>
            <div class="form-group">
              <label class="label">No of Stops</label>
              <input v-model="renewForm.noOfStops" class="input" placeholder="e.g. 05" />
            </div>
            <div class="form-group">
              <label class="label">Type of Lock</label>
              <input v-model="renewForm.liftLockType" class="input" placeholder="e.g. Electro mechanic" />
            </div>
            <div class="form-group">
              <label class="label">Number of Lifts</label>
              <input v-model.number="renewForm.numberOfLifts" class="input" type="number" min="1" />
            </div>
            <div class="form-group">
              <label class="label">Contract Type</label>
              <select v-model="renewForm.contractType" class="input">
                <option value="Comprehensive">Comprehensive</option>
                <option value="Non-Comprehensive">Non-Comprehensive</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Rate Per Lift (p.a.)</label>
              <input v-model="renewForm.ratePerLift" class="input" placeholder="e.g. ₹22,000/-" />
            </div>
            <div class="form-group">
              <label class="label">Billing Cycle</label>
              <input v-model="renewForm.billingCycle" class="input" placeholder="e.g. Yearly" />
            </div>
            <div class="form-group">
              <label class="label">Payment Terms</label>
              <input v-model="renewForm.paymentTerms" class="input" placeholder="e.g. 100% Advance" />
            </div>
            <div class="form-group form-full">
              <label class="label" style="display:flex;align-items:center;gap:10px;">
                Discount
                <button type="button" @click="renewForm.discountEnabled = !renewForm.discountEnabled"
                  :style="`width:40px;height:22px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${renewForm.discountEnabled ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`">
                  <span :style="`position:absolute;top:3px;${renewForm.discountEnabled ? 'right:3px' : 'left:3px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:all .2s;`"></span>
                </button>
                <span style="font-size:11px;color:var(--ct-muted);">{{ renewForm.discountEnabled ? 'Enabled' : 'Disabled' }}</span>
              </label>
              <input v-if="renewForm.discountEnabled" v-model="renewForm.discountAmount" class="input" style="margin-top:8px;" placeholder="e.g. ₹2,000/-" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showRenewModal = false">Cancel</button>
        <button class="btn-secondary" :disabled="renewalPdfGenerating" @click="generateRenewalPdf" style="color:#10b981;border-color:#10b981;">
          <FilePlus2 :size="14" /> {{ renewalPdfGenerating ? 'Generating…' : 'Generate Renewal PDF' }}
        </button>
        <button class="btn-primary" :disabled="saving" @click="confirmRenew">
          <RefreshCw :size="14" /> {{ saving ? 'Renewing…' : 'Renew Contract' }}
        </button>
      </template>
    </AppModal>

    <!-- Contract PDF Modal -->
    <AppModal v-model="showContractPdfModal" :title="contractPdfTarget?.contractPdfUrl ? 'Contract PDFs' : 'Create AMC Contract PDF'" subtitle="Generate contract document for this client" width="620px">
      <div v-if="contractPdfTarget" style="display:flex;flex-direction:column;gap:14px;">
        <!-- Client banner -->
        <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:10px;font-size:13px;">
          <strong>{{ contractPdfTarget.clientName }}</strong> — {{ contractPdfTarget.contractNumber }}
        </div>

        <!-- Historical contracts from renewalHistory -->
        <div v-if="(contractPdfTarget.renewalHistory || []).some(h => h.contractPdfUrl)" style="display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:11px;font-weight:700;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Previous Contracts</div>
          <div
            v-for="(h, idx) in [...(contractPdfTarget.renewalHistory || [])].reverse().filter(h => h.contractPdfUrl)"
            :key="idx"
            style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:8px;"
          >
            <div style="font-size:12px;color:var(--ct-sub);">
              {{ formatDate(h.previousStartDate) }} → {{ formatDate(h.previousEndDate) }}
              <span style="font-size:10px;color:var(--ct-muted);margin-left:6px;">Renewed {{ formatDate(h.renewedOn) }}</span>
            </div>
            <button class="btn-secondary btn-sm" @click="triggerDownload(h.contractPdfUrl, (contractPdfTarget.contractNumber || 'CONTRACT') + '-AMC-CONTRACT-' + (idx+1) + '.pdf')">
              <Download :size="12" /> Download
            </button>
          </div>
        </div>

        <!-- Current contract PDF section -->
        <div v-if="contractPdfTarget.contractPdfUrl" style="padding:12px 14px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.2);border-radius:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--ct-accent);">Current Contract PDF</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
                {{ formatDate(contractPdfTarget.startDate) }} → {{ formatDate(contractPdfTarget.endDate) }}
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn-secondary btn-sm" @click="triggerDownload(contractPdfTarget.contractPdfUrl, (contractPdfTarget.contractNumber || 'CONTRACT') + '-AMC-CONTRACT.pdf')">
                <Download :size="12" /> Download
              </button>
              <!-- Edit toggle -->
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;color:var(--ct-muted);">Edit</span>
                <button type="button" @click="contractPdfEditEnabled = !contractPdfEditEnabled"
                  :style="`width:40px;height:22px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${contractPdfEditEnabled ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`">
                  <span :style="`position:absolute;top:3px;${contractPdfEditEnabled ? 'right:3px' : 'left:3px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:all .2s;`"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Form fields — shown when editing or no existing PDF -->
        <div v-if="!contractPdfTarget.contractPdfUrl || contractPdfEditEnabled" class="form-grid">
          <div v-if="contractPdfTarget.contractPdfUrl" style="grid-column:1/-1;font-size:11px;color:#fbbf24;padding:6px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:6px;">
            Editing will regenerate and overwrite the current contract PDF.
          </div>
          <div class="form-group form-full">
            <label class="label">Letter Date</label>
            <input v-model="contractPdfForm.date" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Lift Make</label>
            <input v-model="contractPdfForm.liftMake" class="input" placeholder="e.g. Escon" />
          </div>
          <div class="form-group">
            <label class="label">Door Type</label>
            <input v-model="contractPdfForm.liftDoorType" class="input" placeholder="e.g. Automatic Centre Opening" />
          </div>
          <div class="form-group">
            <label class="label">Typology</label>
            <input v-model="contractPdfForm.liftTypology" class="input" placeholder="e.g. Geared Machine" />
          </div>
          <div class="form-group">
            <label class="label">Load / Capacity</label>
            <input v-model="contractPdfForm.liftLoad" class="input" placeholder="e.g. 06 passenger" />
          </div>
          <div class="form-group">
            <label class="label">Height / Floors</label>
            <input v-model="contractPdfForm.liftHeight" class="input" placeholder="e.g. G+6" />
          </div>
          <div class="form-group">
            <label class="label">Number of Lifts</label>
            <input v-model.number="contractPdfForm.numberOfLifts" class="input" type="number" min="1" />
          </div>
          <div class="form-group">
            <label class="label">Non-Comp AMC Offer</label>
            <input v-model="contractPdfForm.nonCompAmc" class="input" placeholder="e.g. Rs. 14,160 PER LIFT*/-" />
          </div>
          <div class="form-group form-full">
            <label class="label" style="display:flex;align-items:center;gap:10px;">
              Discount
              <button type="button" @click="contractPdfForm.discountEnabled = !contractPdfForm.discountEnabled"
                :style="`width:40px;height:22px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${contractPdfForm.discountEnabled ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`">
                <span :style="`position:absolute;top:3px;${contractPdfForm.discountEnabled ? 'right:3px' : 'left:3px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:all .2s;`"></span>
              </button>
              <span style="font-size:11px;color:var(--ct-muted);">{{ contractPdfForm.discountEnabled ? 'Enabled — will appear in contract' : 'Disabled — discount row hidden' }}</span>
            </label>
            <input v-if="contractPdfForm.discountEnabled" v-model="contractPdfForm.discountAmount" class="input" style="margin-top:8px;" placeholder="e.g. Rs. 2,160" />
          </div>
          <div class="form-group form-full">
            <label class="label">Final AMC Offer (highlighted)</label>
            <input v-model="contractPdfForm.finalAmc" class="input" placeholder="e.g. Rs. 12,000 PER LIFT*/- Per Annum" />
          </div>
          <div class="form-group">
            <label class="label">Payment Terms</label>
            <input v-model="contractPdfForm.paymentTerms" class="input" placeholder="100% ADVANCE" />
          </div>
          <div class="form-group">
            <label class="label">Duration</label>
            <input v-model="contractPdfForm.duration" class="input" placeholder="12 MONTHS FROM DATE OF CONTRACT" />
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showContractPdfModal = false">Cancel</button>
        <button v-if="!contractPdfTarget?.contractPdfUrl || contractPdfEditEnabled" class="btn-primary" :disabled="contractPdfGenerating" @click="generateContractPdf">
          <FilePlus2 :size="14" /> {{ contractPdfGenerating ? 'Generating PDF…' : (contractPdfTarget?.contractPdfUrl ? 'Regenerate & Save' : 'Generate Contract PDF') }}
        </button>
      </template>
    </AppModal>

    <!-- Confirm Delete -->
    <ConfirmDialog ref="confirmRef" title="Delete Contract" @confirm="deleteContract" />
    <ConfirmDialog ref="confirmLogRef" title="Delete Visit Log" @confirm="deleteLog" />

  <!-- Log Payment Modal -->
  <AppModal v-model="payModal" title="Log Payment Received" subtitle="Record a payment against this AMC contract" width="520px">
    <div v-if="payTarget" style="display:flex;flex-direction:column;gap:16px;">
      <div style="padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:10px;font-size:13px;color:#4ade80;">
        Logging payment for <strong>{{ payTarget.clientName || payTarget.id }}</strong>
        <span v-if="payTarget.paymentType === 'installments'" style="font-size:11px;color:var(--ct-muted);margin-left:6px;">(Installment Contract)</span>
      </div>

      <!-- Previous Payments at TOP -->
      <div v-if="payTarget.paymentHistory?.length" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
        <div style="padding:10px 14px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Payment History ({{ payTarget.paymentHistory.length }})</span>
          <span style="font-size:12px;font-weight:600;color:#10b981;">Total: Rs. {{ Number(payTarget.paidAmount || 0).toLocaleString('en-IN') }}</span>
        </div>
        <div style="max-height:200px;overflow-y:auto;">
          <div v-for="(ph, i) in payTarget.paymentHistory" :key="i" style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
            <!-- Normal view -->
            <template v-if="editPayIdx !== i">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="color:var(--ct-sub);font-size:12px;">{{ ph.date }}</span>
                    <span style="color:var(--ct-muted);font-size:11px;padding:1px 6px;background:rgba(255,255,255,0.06);border-radius:4px;">{{ ph.method }}</span>
                    <span v-if="ph.installmentNo != null" style="color:var(--ct-muted);font-size:11px;">Inst. {{ ph.installmentNo }}</span>
                  </div>
                  <div v-if="ph.reference" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">Ref: {{ ph.reference }}</div>
                  <div v-if="ph.note" style="font-size:11px;color:var(--ct-muted);margin-top:2px;font-style:italic;">{{ ph.note }}</div>
                  <div v-if="ph.loggedAt" style="font-size:10px;color:var(--ct-muted);margin-top:3px;">
                    Logged {{ new Date(ph.loggedAt).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }}
                    <span v-if="ph.loggedBy"> by {{ ph.loggedBy }}</span>
                  </div>
                  <div v-if="ph.editedAt" style="font-size:10px;color:#f59e0b;margin-top:2px;">
                    Edited {{ new Date(ph.editedAt).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }}
                    <span v-if="ph.editedBy"> by {{ ph.editedBy }}</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                  <span style="color:#10b981;font-weight:600;font-size:13px;">Rs. {{ Number(ph.amount).toLocaleString('en-IN') }}</span>
                  <button class="btn-secondary btn-sm" @click="downloadPaymentReceipt(payTarget, ph, i)" style="padding:3px 7px;" title="Download Receipt">
                    <Download :size="11" />
                  </button>
                  <button v-if="isAdmin || isReception" class="btn-secondary btn-sm" @click="startEditPay(i)" style="padding:3px 7px;" title="Edit payment">
                    <Pencil :size="11" />
                  </button>
                </div>
              </div>
            </template>
            <!-- Inline edit form (admin only) -->
            <template v-else>
              <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:80px;">
                    <label class="label" style="font-size:10px;margin-bottom:3px;">Amount (Rs.)</label>
                    <input v-model.number="editPayForm.amount" type="number" class="input" style="padding:6px 8px;font-size:12px;" />
                  </div>
                  <div style="flex:1;min-width:100px;">
                    <label class="label" style="font-size:10px;margin-bottom:3px;">Date</label>
                    <input v-model="editPayForm.date" type="date" class="input" style="padding:6px 8px;font-size:12px;" />
                  </div>
                  <div style="flex:1;min-width:90px;">
                    <label class="label" style="font-size:10px;margin-bottom:3px;">Method</label>
                    <select v-model="editPayForm.method" class="input" style="padding:6px 8px;font-size:12px;">
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <input v-model="editPayForm.reference" class="input" style="flex:1;padding:6px 8px;font-size:12px;" placeholder="Reference / Cheque No." />
                  <input v-model="editPayForm.note" class="input" style="flex:1;padding:6px 8px;font-size:12px;" placeholder="Note" />
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;">
                  <button class="btn-secondary btn-sm" @click="editPayIdx = -1">Cancel</button>
                  <button class="btn-success btn-sm" @click="saveEditPay" :disabled="amcSaving">Save</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Installment selector (only for installment contracts) -->
      <div v-if="payTarget.paymentType === 'installments'" style="padding:12px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
        <label class="label" style="margin-bottom:6px;">Select Installment *</label>
        <select v-model.number="payInstallmentIdx" class="input" @change="onInstallmentSelect">
          <option value="-1">— Select installment —</option>
          <option
            v-for="(inst, i) in payTargetInstallments"
            :key="i"
            :value="i"
            :disabled="inst.isPaid"
          >
            Installment {{ i + 1 }} / {{ payTargetInstallments.length }}
            — {{ inst.dueDate || 'no date' }}
            — {{ formatCurrency(inst.amount) }}
            {{ inst.isPaid ? '(Paid)' : inst.isOverdue ? '(Overdue)' : '' }}
          </option>
        </select>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="label">Amount (Rs.) *</label>
          <input v-model.number="payForm.amount" type="number" class="input" min="0" step="0.01" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label class="label">Date *</label>
          <input v-model="payForm.date" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="label">Payment Method</label>
          <select v-model="payForm.method" class="input">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Reference / Cheque No.</label>
          <input v-model="payForm.reference" class="input" placeholder="Optional" />
        </div>
        <div class="form-group form-full">
          <label class="label">Note</label>
          <input v-model="payForm.note" class="input" placeholder="Optional note" />
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="payModal = false">Cancel</button>
      <button class="btn-success" @click="savePayment" :disabled="amcSaving">
        <span>Save Payment</span>
      </button>
    </template>
  </AppModal>

  <!-- Contract Detail View Modal -->
  <AppModal v-model="showViewModal" :title="viewTarget ? (viewTarget.contractNumber || 'Contract Details') : 'Contract Details'" width="680px">
    <template v-if="viewTarget">
      <div style="display:flex;flex-direction:column;gap:14px;">

        <!-- Expired warning banner -->
        <div v-if="viewTarget.status === 'expired'" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:10px;color:#f87171;">
          <AlertTriangle :size="16" style="flex-shrink:0;" />
          <div>
            <div style="font-size:13px;font-weight:600;">Contract Expired</div>
            <div style="font-size:12px;margin-top:2px;opacity:.85;">This contract expired on {{ formatDate(viewTarget.endDate) }}. Renew to re-activate and log payments.</div>
          </div>
        </div>

        <!-- Header info -->
        <div style="padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
          <div v-if="viewTarget.projectId" style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(viewTarget.projectId) }}</div>
          <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName }}</div>
          <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.contractNumber }} &bull; {{ viewTarget.frequency }}</div>
          <div style="margin-top:8px;">
            <span :class="['badge', contractStatusBadge(viewTarget.status)]">{{ viewTarget.status }}</span>
            <span v-if="viewTarget.comprehensive" class="badge badge-info" style="margin-left:6px;">Comprehensive</span>
          </div>
        </div>

        <!-- Details grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Start Date</div>
            <div style="color:var(--ct-sub);">{{ formatDate(viewTarget.startDate) }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">End Date</div>
            <div :style="`color:${viewTarget.status === 'expired' ? '#f87171' : isExpiring(viewTarget) ? '#fbbf24' : 'var(--ct-sub)'}`">{{ formatDate(viewTarget.endDate) }}</div>
          </div>
          <div v-if="!isTech" class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Contract Value</div>
            <div style="color:var(--ct-accent);font-weight:700;">{{ formatCurrency(viewTarget.contractValue) }}</div>
          </div>
          <div v-if="!isTech" class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total with GST</div>
            <div style="color:var(--ct-accent);font-weight:700;">{{ formatCurrency(viewTarget.totalWithGST || viewTarget.contractValue) }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Phone</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.clientPhone || '—' }}</div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Technicians</div>
            <div style="color:var(--ct-sub);font-size:12px;">{{ (viewTarget.technicians || []).join(', ') || '—' }}</div>
          </div>
          <div v-if="viewTarget.clientAddress" class="glass" style="padding:12px 14px;grid-column:1/-1;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Address</div>
            <div style="color:var(--ct-sub);">{{ viewTarget.clientAddress }}</div>
          </div>
        </div>

        <!-- Payments received -->
        <div v-if="viewTarget.paidAmount || (viewTarget.paymentHistory && viewTarget.paymentHistory.length)" style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.15);border-radius:10px;overflow:hidden;">
          <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.06);border-bottom:1px solid rgba(16,185,129,0.1);">
            <span style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:.05em;">Payments Received</span>
            <span style="font-size:13px;font-weight:700;color:#10b981;">{{ formatCurrency(viewTarget.paidAmount) }}</span>
          </div>
          <div v-if="viewTarget.paymentHistory && viewTarget.paymentHistory.length" style="max-height:180px;overflow-y:auto;">
            <div v-for="(ph, i) in viewTarget.paymentHistory" :key="i" style="padding:8px 14px;border-bottom:1px solid rgba(16,185,129,0.06);display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="font-size:12px;color:var(--ct-sub);">{{ ph.date }}</span>
                  <span style="font-size:10px;color:var(--ct-muted);padding:1px 5px;background:rgba(255,255,255,0.06);border-radius:4px;">{{ ph.method }}</span>
                </div>
                <div v-if="ph.reference" style="font-size:10px;color:var(--ct-muted);margin-top:2px;">Ref: {{ ph.reference }}</div>
                <div v-if="ph.note" style="font-size:10px;color:var(--ct-muted);font-style:italic;margin-top:2px;">{{ ph.note }}</div>
                <div v-if="ph.loggedAt" style="font-size:10px;color:var(--ct-muted);margin-top:2px;">
                  Logged {{ new Date(ph.loggedAt).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }}<span v-if="ph.loggedBy"> by {{ ph.loggedBy }}</span>
                </div>
              </div>
              <span style="color:#4ade80;font-weight:600;font-size:12px;flex-shrink:0;">{{ formatCurrency(ph.amount) }}</span>
            </div>
          </div>
          <div v-else style="padding:8px 14px;font-size:11px;color:var(--ct-muted);">No detailed payment log available.</div>
        </div>

        <!-- Monthly maintenance log history -->
        <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
            <div style="font-size:12px;font-weight:600;color:var(--ct-primary);">Monthly Maintenance Log</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              <button
                v-for="yr in viewContractLogYears"
                :key="yr"
                @click="viewSelectedYear = yr"
                :class="['btn-sm', viewSelectedYear === yr ? 'btn-primary' : 'btn-secondary']"
                style="min-width:52px;font-size:12px;"
              >{{ yr }}</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;">
            <div
              v-for="(mName, idx) in VIEW_MONTHS"
              :key="idx"
              :style="`padding:8px 4px;border-radius:8px;text-align:center;font-size:11px;border:1px solid ${viewYearLogs.some(l => l.monthKey === String(viewSelectedYear) + '-' + String(idx+1).padStart(2,'0')) ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.06)'};background:${viewYearLogs.some(l => l.monthKey === String(viewSelectedYear) + '-' + String(idx+1).padStart(2,'0')) ? 'rgba(74,222,128,0.08)' : 'transparent'};`"
            >
              <div :style="`font-weight:600;color:${viewYearLogs.some(l => l.monthKey === String(viewSelectedYear) + '-' + String(idx+1).padStart(2,'0')) ? '#4ade80' : 'var(--ct-muted)'};`">{{ mName }}</div>
              <div style="margin-top:3px;font-size:10px;">
                <span v-if="viewYearLogs.some(l => l.monthKey === String(viewSelectedYear) + '-' + String(idx+1).padStart(2,'0'))">✓</span>
                <span v-else style="color:var(--ct-muted);">—</span>
              </div>
            </div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--ct-muted);">
            {{ viewYearLogs.length }} of 12 months completed in {{ viewSelectedYear }}
          </div>
        </div>

        <!-- Renewal history -->
        <div v-if="viewTarget.renewalHistory?.length" style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-primary);margin-bottom:10px;">Renewal History</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div
              v-for="(renewal, idx) in [...viewTarget.renewalHistory].reverse()"
              :key="idx"
              style="padding:10px 12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:8px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;"
            >
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--ct-sub);">
                  {{ formatDate(renewal.previousStartDate) }} → {{ formatDate(renewal.previousEndDate) }}
                </div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:3px;">
                  Expired: {{ formatDate(renewal.expiredOn) }} &bull; Renewed: {{ formatDate(renewal.renewedOn) }}
                </div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
                  By: {{ renewal.renewedBy || '—' }}
                  <span v-if="!isTech"> &bull; Value: {{ formatCurrency(renewal.previousTotalWithGST || renewal.previousContractValue) }}</span>
                </div>
                <div v-if="renewal.notes" style="font-size:11px;color:var(--ct-accent);margin-top:3px;">{{ renewal.notes }}</div>
              </div>
              <button
                class="btn-secondary btn-sm"
                style="flex-shrink:0;"
                title="Download historical contract PDF"
                @click="exportHistoricalPDF(viewTarget, renewal)"
              >
                <Download :size="12" /> PDF
              </button>
            </div>
          </div>
        </div>

      </div>
    </template>
    <template #footer>
      <button class="btn-secondary" @click="showViewModal = false">Close</button>
      <button v-if="viewTarget?.contractPdfUrl" class="btn-secondary" @click="triggerDownload(viewTarget.contractPdfUrl, (viewTarget.contractNumber || 'CONTRACT') + '-AMC-CONTRACT.pdf')">
        <Download :size="14" /> Contract PDF
      </button>
      <button v-if="viewTarget?.renewalPdfUrl" class="btn-secondary" style="color:#10b981;border-color:#10b981;" @click="triggerDownload(viewTarget.renewalPdfUrl, (viewTarget.contractNumber || 'CONTRACT') + '-AMC-RENEWAL.pdf')">
        <Download :size="14" /> Renewal PDF
      </button>
      <!-- Renew: always visible for non-tech, but disabled if contract is not expired/expiring -->
      <button
        v-if="!isTech"
        :class="['btn-success', (effectiveStatus(viewTarget) === 'expired' || isExpiring(viewTarget)) ? '' : 'btn-secondary']"
        :disabled="!(effectiveStatus(viewTarget) === 'expired' || isExpiring(viewTarget))"
        :title="(effectiveStatus(viewTarget) === 'expired' || isExpiring(viewTarget)) ? 'Renew this contract' : 'Contract is active — renewal available within 30 days of expiry'"
        :style="!(effectiveStatus(viewTarget) === 'expired' || isExpiring(viewTarget)) ? 'opacity:0.45;cursor:not-allowed;' : ''"
        @click="showViewModal = false; quickRenew(viewTarget)"
      >
        <RefreshCw :size="14" /> Renew
      </button>
      <button class="btn-primary" @click="showViewModal = false; openEditContract(viewTarget)">Edit</button>
    </template>
  </AppModal>

  <ExportDialog
    v-model="expDlgVisible"
    v-model:selectedPeriod="expPeriod"
    v-model:exportType="expType"
    :exporting="expRunning"
    @confirm="runExport"
    @cancel="cancelExport"
  />

  <AmcEmailModal
    :show="showAmcEmailModal"
    :row="amcEmailTarget"
    :pdf-buffer="amcEmailPdfBuffer"
    :pdf-filename="amcEmailPdfFilename"
    @close="showAmcEmailModal = false"
  />

  <!-- ── Inspection Modal ────────────────────────────────────────────── -->
  <AppModal v-model="showInspectionModal" title="Lift Inspection" :subtitle="inspectionContract?.clientName" width="760px">
    <div v-if="loadingChecklist" style="text-align:center;padding:30px;color:var(--ct-muted);">Loading checklist…</div>
    <div v-else>
      <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;font-size:12px;color:var(--ct-accent);margin-bottom:14px;">
        {{ inspectionContract?.contractNumber || '—' }} — {{ inspectionMonthLabel }} ({{ inspectionMonthKey }})
      </div>
      <div v-if="!checklistItems.length" style="text-align:center;padding:24px;color:var(--ct-muted);font-size:13px;">
        No checklist items found. Add items in Configurations → Checklist.
      </div>
      <div v-else style="display:flex;flex-direction:column;gap:14px;max-height:450px;overflow-y:auto;padding-right:4px;">
        <template v-for="sec in ['A', 'B', 'C', 'D']" :key="sec">
          <div v-if="inspectionResults.filter(r => r.section === sec).length">
            <div style="font-size:11px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding:4px 8px;background:rgba(99,102,241,0.08);border-radius:6px;display:inline-block;">
              Section {{ sec }}
              <span style="font-size:10px;font-weight:400;color:var(--ct-muted);margin-left:4px;">
                {{ sec === 'A' ? '— General Inspection' : sec === 'B' ? '— Cleaning' : sec === 'C' ? '— Lubrication' : '— Safety Check' }}
              </span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div
                v-for="item in inspectionResults.filter(r => r.section === sec)"
                :key="item.itemId"
                style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;"
              >
                <div style="flex:1;min-width:0;">
                  <div style="font-size:12px;font-weight:600;color:var(--ct-primary);">{{ item.title }}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;">
                  <template v-if="sec === 'A' || sec === 'D'">
                    <button @click="item.status = 'pass'" :class="['btn-sm', item.status === 'pass' ? 'btn-success' : 'btn-secondary']" style="min-width:36px;padding:4px 8px;">OK</button>
                    <button @click="item.status = 'fail'" :class="['btn-sm', item.status === 'fail' ? 'btn-danger' : 'btn-secondary']" style="min-width:52px;padding:4px 8px;">Not OK</button>
                  </template>
                  <template v-else>
                    <button @click="item.status = 'pass'" :class="['btn-sm', item.status === 'pass' ? 'btn-success' : 'btn-secondary']" style="min-width:42px;padding:4px 8px;">Done</button>
                    <button @click="item.status = 'fail'" :class="['btn-sm', item.status === 'fail' ? 'btn-danger' : 'btn-secondary']" style="min-width:58px;padding:4px 8px;">Not Done</button>
                  </template>
                  <input v-model="item.remarks" class="input" style="width:110px;padding:4px 7px;font-size:11px;" placeholder="Remarks" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
      <div style="margin-top:14px;display:flex;gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="label">Checked By</label>
          <input v-model="inspectionCheckedBy" class="input" placeholder="Inspector name" />
        </div>
        <div class="form-group" style="flex:1;">
          <label class="label">Date</label>
          <input v-model="inspectionDate" class="input" type="date" />
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="showInspectionModal = false">Cancel</button>
      <button class="btn-primary" :disabled="savingInspection || !checklistItems.length" @click="saveInspection">
        <Save :size="14" /> {{ savingInspection ? 'Saving…' : 'Save & Generate PDF' }}
      </button>
    </template>
  </AppModal>

  <!-- ── View Inspection Modal ─────────────────────────────────────── -->
  <AppModal v-model="showViewInspectionModal" title="Inspection Report" :subtitle="viewInspectionData?.clientName" width="660px">
    <div v-if="viewInspectionData">
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="glass" style="padding:10px 14px;flex:1;">
          <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Month</div>
          <div style="color:var(--ct-primary);font-weight:600;">{{ viewInspectionData.monthKey }}</div>
        </div>
        <div class="glass" style="padding:10px 14px;flex:1;">
          <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Checked By</div>
          <div style="color:var(--ct-primary);font-weight:600;">{{ viewInspectionData.checkedBy }}</div>
        </div>
        <div class="glass" style="padding:10px 14px;flex:1;">
          <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Date</div>
          <div style="color:var(--ct-primary);font-weight:600;">{{ formatDate(viewInspectionData.date) }}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto;">
        <div
          v-for="item in viewInspectionData.checklistResults"
          :key="item.itemId"
          style="display:flex;align-items:center;gap:12px;padding:8px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;"
        >
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:var(--ct-primary);">{{ item.title }}</div>
            <div v-if="item.description" style="font-size:11px;color:var(--ct-muted);">{{ item.description }}</div>
          </div>
          <span
            :class="['badge', item.status === 'pass' ? 'badge-active' : item.status === 'fail' ? 'badge-danger' : 'badge-warning']"
          >{{ item.status === 'pass' ? 'OK' : item.status === 'fail' ? 'Fail' : 'N/A' }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="showViewInspectionModal = false">Close</button>
      <button
        v-if="viewInspectionData?.receiptUrl"
        class="btn-primary"
        @click="triggerDownload(viewInspectionData.receiptUrl, 'Inspection-' + viewInspectionData.monthKey + '.pdf')"
      >
        <Download :size="14" /> Download PDF
      </button>
      <button v-else class="btn-primary" @click="generateInspectionPdf(viewInspectionData)">
        <Download :size="14" /> Generate PDF
      </button>
    </template>
  </AppModal>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  Plus, Search, Pencil, Trash2, Save, Download, Mail,
  ClipboardList, FileText, FileDown, CalendarCheck, RefreshCw,
  CheckCircle2, FolderOpen, Upload, DollarSign, FilePlus2, AlertTriangle,
  ClipboardCheck, Eye, TrendingUp, MessageCircle
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TechnicianSelect from '@/components/ui/TechnicianSelect.vue'
import SignatureCanvas from '@/components/ui/SignatureCanvas.vue'
import LiftSelector from '@/components/ui/LiftSelector.vue'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import AmcEmailModal from '@/components/ui/AmcEmailModal.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { savePDF } from '@/utils/saveFile'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { create, update } from '@/firebase/firestore'
import { usePDF } from '@/composables/usePDF'
import { useExport } from '@/composables/useExport'
import { convertHtmlToPdf, triggerDownload } from '@/composables/usePdfApiService'
import { buildCompletionMessage, whatsAppChatUrl } from '@/utils/whatsapp'
import { notifyWorker } from '@/utils/notifyWorker'
import { SERVICE_CHECKLIST_LEFT, SERVICE_CHECKLIST_RIGHT, defaultServiceChecklist, generateServiceReportPdf } from '@/utils/serviceReport'
import { generatePaymentReceiptPdf } from '@/utils/paymentReceipt'

const ui = useUIStore()
const authStore = useAuthStore()
const activity = useActivityStore()
const { _drawHeader, _drawFooter, _sectionLabel, _infoGrid, _toRs, _C, _MARGIN, _PAGE_W, _getCtx, _drawReceiptHeader, _drawReceiptFooter, _drawBlackSig, _RECEIPT } = usePDF()
const { showExportDialog, dialogVisible: expDlgVisible, selectedPeriod: expPeriod, exportType: expType, exporting: expRunning, runExport, cancelExport } = useExport()
const { items: contracts, loading, add, edit, del } = useCollection(Collections.AMC)
const { items: monthlyLogs, add: addLog, del: delLog, edit: editLog } = useCollection(Collections.AMC_MONTHLY)
const { items: allProjects } = useCollection(Collections.PROJECTS)
const { items: inspections, add: addInspection, edit: editInspection } = useCollection(Collections.INSPECTIONS)
const { items: checklistItems, loading: loadingChecklist } = useCollection(Collections.CHECKLIST_ITEMS)

// ── Inspection helpers ────────────────────────────────────────────────
function getMonthInspection(contractId, monthKey) {
  return inspections.value.find(i => i.contractId === contractId && i.monthKey === monthKey) || null
}

const showInspectionModal = ref(false)
const showViewInspectionModal = ref(false)
const inspectionContract = ref(null)
const inspectionMonthKey = ref('')
const inspectionMonthLabel = ref('')
const inspectionResults = ref([])
const inspectionCheckedBy = ref('')
const inspectionDate = ref(new Date().toISOString().split('T')[0])
const savingInspection = ref(false)
const viewInspectionData = ref(null)

function openInspectionModal(contract, monthKey, monthLabel) {
  inspectionContract.value = contract
  inspectionMonthKey.value = monthKey
  inspectionMonthLabel.value = monthLabel || monthKey
  inspectionDate.value = new Date().toISOString().split('T')[0]
  inspectionCheckedBy.value = authStore.user?.fullName || authStore.user?.username || ''
  const sorted = [...checklistItems.value].sort((a, b) => {
    const sa = a.section || 'A', sb = b.section || 'A'
    if (sa !== sb) return sa.localeCompare(sb)
    return (a.order || 0) - (b.order || 0)
  })
  inspectionResults.value = sorted.map(item => ({
    itemId: item.id,
    title: item.title || '',
    description: item.description || '',
    section: item.section || 'A',
    status: 'na',
    remarks: '',
  }))
  showInspectionModal.value = true
}

function viewInspection(inspection) {
  viewInspectionData.value = inspection
  showViewInspectionModal.value = true
}

async function saveInspection() {
  if (!inspectionCheckedBy.value) { ui.error('Please enter the inspector name.'); return }
  savingInspection.value = true
  try {
    const data = {
      contractId: inspectionContract.value.id,
      contractNumber: inspectionContract.value.contractNumber || '',
      clientName: inspectionContract.value.clientName || '',
      monthKey: inspectionMonthKey.value,
      checkedBy: inspectionCheckedBy.value,
      date: inspectionDate.value,
      checklistResults: inspectionResults.value,
    }
    const newId = await addInspection(data)
    ui.success('Inspection saved.')
    showInspectionModal.value = false
    try {
      const savedInspection = { id: newId, ...data }
      await generateInspectionPdf(savedInspection)
    } catch (e) {
      console.error('[Inspection] PDF generation failed:', e)
    }
  } catch (e) {
    ui.error('Failed to save inspection.')
  } finally {
    savingInspection.value = false
  }
}

function _buildAmcInspectionSectionRows(results, section, colType) {
  const items = results.filter(r => (r.section || 'A') === section)
  if (!items.length) return '<tr><td colspan="5" style="padding:10px;text-align:center;color:#94a3b8;font-size:11px;">No items in this section.</td></tr>'
  return items.map((r, idx) => {
    const isOkNotOk = colType === 'ok_notok'
    const ok = r.status === 'pass'
    const notOk = r.status === 'fail'
    const done = r.status === 'pass'
    const td = 'padding:7px 9px;border:1px solid #cbd5e1;font-size:11.5px;'
    const check = '✓', cross = '✗'
    if (isOkNotOk) {
      return `<tr style="page-break-inside:avoid;">
        <td style="${td}text-align:center;color:#475569;">${idx + 1}</td>
        <td style="${td}color:#1e293b;">${r.title || ''}</td>
        <td style="${td}text-align:center;font-weight:700;color:${ok ? '#16a34a' : '#e2e8f0'};">${ok ? check : ''}</td>
        <td style="${td}text-align:center;font-weight:700;color:${notOk ? '#dc2626' : '#e2e8f0'};">${notOk ? cross : ''}</td>
        <td style="${td}color:#475569;">${r.remarks || ''}</td>
      </tr>`
    } else {
      return `<tr style="page-break-inside:avoid;">
        <td style="${td}text-align:center;color:#475569;">${idx + 1}</td>
        <td style="${td}color:#1e293b;">${r.title || ''}</td>
        <td style="${td}text-align:center;font-weight:700;color:${done ? '#16a34a' : '#dc2626'};">${r.status !== 'na' ? (done ? check : cross) : ''}</td>
        <td style="${td}color:#475569;">${r.remarks || ''}</td>
      </tr>`
    }
  }).join('')
}

async function generateInspectionPdf(inspection) {
  try {
    const ctx = await _getCtx()
    const template = ctx?.inspectionHtml || ''
    if (!template.trim()) {
      ui.warning('No inspection template found. Add it in Configurations → Inspection Format.')
      return
    }
    const results = inspection.checklistResults || []
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    const naCount = results.filter(r => r.status === 'na').length
    const sectionARows = _buildAmcInspectionSectionRows(results, 'A', 'ok_notok')
    const sectionBRows = _buildAmcInspectionSectionRows(results, 'B', 'done')
    const sectionCRows = _buildAmcInspectionSectionRows(results, 'C', 'done')
    const sectionDRows = _buildAmcInspectionSectionRows(results, 'D', 'ok_notok')
    const legacyRows = results.map((r, idx) => {
      const statusText = r.status === 'pass' ? 'OK' : r.status === 'fail' ? 'Fail' : 'N/A'
      const statusColor = r.status === 'pass' ? '#16a34a' : r.status === 'fail' ? '#dc2626' : '#64748b'
      return `<tr><td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:12px;">${idx + 1}</td><td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;">${r.title || ''}</td><td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:${statusColor};font-size:13px;">${statusText}</td><td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;">${r.remarks || ''}</td></tr>`
    }).join('')
    const dateStr = inspection.date
      ? new Date(inspection.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : ''
    const [year, month] = (inspection.monthKey || '').split('-')
    const monthYearStr = year && month
      ? new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      : inspection.monthKey || ''
    const co = ctx?.company || {}
    const coAddr = [co.address, co.city, co.state, co.pincode].filter(Boolean).join(', ')
    let html = template
    html = html.replaceAll('{{COMPANY_NAME}}', co.name || '')
    html = html.replaceAll('{{COMPANY_ADDRESS}}', coAddr)
    html = html.replaceAll('{{COMPANY_PHONE}}', co.phone || '')
    html = html.replaceAll('{{COMPANY_EMAIL}}', co.email || '')
    html = html.replaceAll('{{COMPANY_GST}}', co.gst || '')
    html = html.replaceAll('{{CLIENT_NAME}}', inspection.clientName || '')
    html = html.replaceAll('{{SOCIETY_NAME}}', inspection.clientName || '')
    html = html.replaceAll('{{CONTRACT_NO}}', inspection.contractNumber || '')
    html = html.replaceAll('{{INSPECTION_DATE}}', dateStr)
    html = html.replaceAll('{{CHECKED_BY}}', inspection.checkedBy || '')
    html = html.replaceAll('{{MONTH_YEAR}}', monthYearStr)
    html = html.replaceAll('{{LIFT_NO}}', inspection.liftNo || '')
    html = html.replaceAll('{{SECTION_A_ROWS}}', sectionARows)
    html = html.replaceAll('{{SECTION_B_ROWS}}', sectionBRows)
    html = html.replaceAll('{{SECTION_C_ROWS}}', sectionCRows)
    html = html.replaceAll('{{SECTION_D_ROWS}}', sectionDRows)
    html = html.replaceAll('{{CHECKLIST_ROWS}}', legacyRows)
    html = html.replaceAll('{{PASS_COUNT}}', String(passCount))
    html = html.replaceAll('{{FAIL_COUNT}}', String(failCount))
    html = html.replaceAll('{{NA_COUNT}}', String(naCount))
    const filename = `Inspection-${inspection.contractNumber || inspection.clientName}-${inspection.monthKey}.pdf`
    const retrieveUrl = await convertHtmlToPdf(html, filename, inspection.contractNumber || inspection.id || 'inspection')
    triggerDownload(retrieveUrl, filename)
    if (inspection.id) {
      try { await editInspection(inspection.id, { receiptUrl: retrieveUrl }) } catch {}
    }
    ui.success('Inspection PDF downloaded.')
  } catch (e) {
    ui.error('Failed to generate inspection PDF: ' + (e?.message || e))
  }
}

async function regenerateAndDownloadReceipt(log) {
  if (!log) return
  try {
    await generateMaintenanceReceipt(log)
  } catch { ui.error('Could not generate receipt.') }
}

async function shareLogOnWhatsApp(log, monthKey) {
  const phone = selectedContract.value?.clientPhone
  const chatUrl = whatsAppChatUrl(phone, buildCompletionMessage(monthKey))
  if (!chatUrl) {
    ui.error('No valid phone number saved for this client. Add one in the AMC contract.')
    return
  }
  try {
    await generateMaintenanceReceipt(log)
  } catch { ui.error('Could not generate receipt.') }
  window.open(chatUrl, '_blank')
  ui.info('WhatsApp opened — attach the downloaded receipt in the chat.')
}

// View modal
const showViewModal = ref(false)
const viewTarget = ref(null)
const viewSelectedYear = ref(new Date().getFullYear())

function openView(row) {
  viewTarget.value = row
  viewSelectedYear.value = new Date().getFullYear()
  showViewModal.value = true
}

const VIEW_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const viewContractLogYears = computed(() => {
  if (!viewTarget.value) return [new Date().getFullYear()]
  const logs = monthlyLogs.value.filter(l => l.contractId === viewTarget.value.id)
  const years = [...new Set(logs.map(l => l.monthKey?.split('-')[0]).filter(Boolean))].map(Number).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  if (!years.includes(currentYear)) years.unshift(currentYear)
  return years
})

const viewYearLogs = computed(() => {
  if (!viewTarget.value) return []
  const prefix = String(viewSelectedYear.value)
  return monthlyLogs.value.filter(l => l.contractId === viewTarget.value.id && l.monthKey?.startsWith(prefix))
})

// Payment tracking
const payModal = ref(false)
const payTargetId = ref(null)
const payTarget = computed(() => contracts.value.find(c => c.id === payTargetId.value) || null)
const payForm = ref({ amount: 0, date: new Date().toISOString().slice(0,10), method: 'cash', reference: '', note: '' })
const amcSaving = ref(false)
const payInstallmentIdx = ref(-1)
const editPayIdx = ref(-1)
const editPayForm = ref({ amount: 0, date: '', method: 'cash', reference: '', note: '' })

const editingInstPay = ref(null) // { contractId, origIdx } for inline card editing
const editInstPayForm = ref({ amount: 0, date: '', method: 'cash', reference: '' })

function openInstPayEdit(inst) {
  editingInstPay.value = { contractId: inst.contractId, origIdx: inst.paidHistoryIdx }
  editInstPayForm.value = { amount: inst.paidAmount ?? inst.amount, date: inst.paidDate || '', method: inst.paidMethod || 'cash', reference: inst.paidReference || '' }
}

async function saveInstPayEdit() {
  if (!editingInstPay.value) return
  const { contractId, origIdx } = editingInstPay.value
  const contract = contracts.value.find(c => c.id === contractId)
  if (!contract || origIdx < 0) return
  const history = [...(contract.paymentHistory || [])]
  history[origIdx] = { ...history[origIdx], ...editInstPayForm.value, editedAt: new Date().toISOString(), editedBy: authStore.user?.fullName || authStore.user?.username || 'Admin' }
  const newPaid = history.reduce((s, p) => s + Number(p.amount || 0), 0)
  amcSaving.value = true
  try {
    await update(Collections.AMC, contractId, { paymentHistory: history, paidAmount: newPaid })
    activity.log({ action: 'updated', module: 'amc', tab: 'AMC', summary: `Edited installment payment for ${contract.clientName || contract.contractNumber}`, details: { contractNo: contract.contractNumber, clientName: contract.clientName } })
    ui.success('Payment updated.')
    editingInstPay.value = null
  } catch { ui.error('Failed to update payment.') }
  finally { amcSaving.value = false }
}

// ── Payments Tab ──────────────────────────────────────────────────────────────
const paymentsContractFilter = ref('')
const paymentsStatusFilter = ref('')
const paymentsMonthFilter = ref('')
const paymentsSearch = ref('')

const FREQ_TO_MONTHS = {
  'monthly': 1, 'bi-monthly': 2, 'quarterly': 3,
  '4-monthly': 4, 'half-yearly': 6, 'yearly': 12,
}

const allInstallments = computed(() => {
  const result = []
  for (const c of visibleContracts.value) {
    if (c.status === 'cancelled' || c.status === 'inactive') continue
    if (c.paymentType !== 'installments') continue
    const total = c.totalWithGST || c.contractValue || 0
    const dur = c.durationMonths || 12
    const freqMonths = FREQ_TO_MONTHS[c.frequency] || 3
    const count = Math.max(1, Math.ceil(dur / freqMonths))
    const amount = Math.round(total / count)
    const startDate = c.startDate ? new Date(c.startDate + 'T00:00:00') : null
    const paymentsWithIdx = (c.paymentHistory || [])
      .map((p, origIdx) => ({ ...p, _origIdx: origIdx }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    for (let i = 0; i < count; i++) {
      let dueDate = null
      if (startDate) {
        const d = new Date(startDate)
        d.setMonth(d.getMonth() + i * freqMonths)
        dueDate = d.toISOString().split('T')[0]
      }
      const paidEntry = paymentsWithIdx[i]
      const isOverdue = !paidEntry && !!dueDate && new Date(dueDate) < new Date()
      result.push({
        contractId: c.id,
        contractNumber: c.contractNumber,
        clientName: c.clientName,
        projectId: c.projectId,
        installmentNo: i + 1,
        totalInstallments: count,
        amount,
        dueDate,
        isPaid: !!paidEntry,
        paidDate: paidEntry?.date,
        paidAmount: paidEntry?.amount,
        paidMethod: paidEntry?.method,
        paidReference: paidEntry?.reference,
        paidHistoryIdx: paidEntry?._origIdx ?? -1,
        isOverdue,
      })
    }
  }
  return result
})

const filteredInstallments = computed(() => {
  let list = allInstallments.value
  if (paymentsSearch.value) {
    const q = paymentsSearch.value.toLowerCase()
    list = list.filter(i => i.clientName?.toLowerCase().includes(q) || i.contractNumber?.toLowerCase().includes(q) || (getProjectName(i.projectId) || '').toLowerCase().includes(q))
  }
  if (paymentsContractFilter.value) list = list.filter(i => i.contractId === paymentsContractFilter.value)
  if (paymentsStatusFilter.value === 'paid') list = list.filter(i => i.isPaid)
  if (paymentsStatusFilter.value === 'pending') list = list.filter(i => !i.isPaid && !i.isOverdue)
  if (paymentsStatusFilter.value === 'overdue') list = list.filter(i => i.isOverdue)
  if (paymentsMonthFilter.value) list = list.filter(i => i.dueDate?.startsWith(paymentsMonthFilter.value))
  return list
})

const payTargetInstallments = computed(() => {
  if (!payTarget.value || payTarget.value.paymentType !== 'installments') return []
  const total = payTarget.value.totalWithGST || payTarget.value.contractValue || 0
  const dur = payTarget.value.durationMonths || 12
  const freqMonths = FREQ_TO_MONTHS[payTarget.value.frequency] || 3
  const count = Math.max(1, Math.ceil(dur / freqMonths))
  const amount = Math.round(total / count)
  const startDate = payTarget.value.startDate ? new Date(payTarget.value.startDate + 'T00:00:00') : null
  const payments = [...(payTarget.value.paymentHistory || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return Array.from({ length: count }, (_, i) => {
    let dueDate = null
    if (startDate) {
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + i * freqMonths)
      dueDate = d.toISOString().split('T')[0]
    }
    const paidEntry = payments[i]
    return {
      installmentNo: i + 1,
      amount,
      dueDate,
      isPaid: !!paidEntry,
      isOverdue: !paidEntry && !!dueDate && new Date(dueDate) < new Date(),
    }
  })
})

// ── Contract PDF ──────────────────────────────────────────────────────
const showContractPdfModal = ref(false)
const contractPdfTarget = ref(null)
const contractPdfGenerating = ref(false)
const contractPdfEditEnabled = ref(false)
const contractPdfForm = ref({
  date: new Date().toISOString().slice(0, 10),
  liftMake: '', liftDoorType: '', liftTypology: '', liftLoad: '', liftHeight: '',
  numberOfLifts: 1,
  nonCompAmc: '', discountEnabled: false, discountAmount: '',
  finalAmc: '', paymentTerms: '100% ADVANCE',
  duration: '12 MONTHS FROM DATE OF CONTRACT',
})

// ── AMC Project Selection ──────────────────────────────────────────────
const amcUseProject = ref(true)
const amcProjectSearch = ref('')
const amcShowProjectDropdown = ref(false)

const amcFilteredProjects = computed(() => {
  const q = amcProjectSearch.value.toLowerCase()
  return allProjects.value.filter(p => (p.projectName || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q))
})

function selectAmcProject(p) {
  contractForm.value.projectId = p.id
  amcProjectSearch.value = p.projectName
  amcShowProjectDropdown.value = false
  contractForm.value.clientName = p.clientName || ''
  contractForm.value.clientPhone = p.phone || p.clientPhone || ''
  contractForm.value.clientEmail = p.email || p.clientEmail || ''
  contractForm.value.clientAddress = p.address || p.clientAddress || ''
}

function amcDelayCloseDropdown() {
  setTimeout(() => { amcShowProjectDropdown.value = false }, 200)
}

// ── Tabs ─────────────────────────────────────────────────────────────
const activeTab = ref('contracts')

// Auto-open from Reminders
watch([() => ui.pendingAutoOpen, contracts], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== 'amc') return
  if (pending.tab) activeTab.value = pending.tab
  if (pending.tab === 'monthly') {
    selectedContractId.value = pending.recordId
    ui.clearPendingAutoOpen()
    return
  }
  const record = contracts.value.find(r => r.id === pending.recordId)
  if (record) { openView(record); ui.clearPendingAutoOpen() }
})

// ── Computed ─────────────────────────────────────────────────────────
const activeContracts = computed(() => contracts.value.filter(c => effectiveStatus(c) === 'active'))
const expiredContracts = computed(() => contracts.value.filter(c => effectiveStatus(c) === 'expired'))
const expiringContracts = computed(() => contracts.value.filter(c => isExpiring(c)))
const totalContractValue = computed(() => contracts.value.reduce((sum, c) => sum + (Number(c.contractValue) || 0), 0))

// ── Contracts Filter ──────────────────────────────────────────────────
const contractSearch = ref('')
const contractStatusFilter = ref('')
const comprehensiveFilter = ref('')
const contractPage = ref(1)
const pageSize = 20

const myName = computed(() => authStore.user?.fullName || authStore.user?.username || '')
const isTech = computed(() => authStore.role === 'technician')
const isAdmin = computed(() => authStore.role === 'admin')
const isReception = computed(() => authStore.role === 'reception')

// Technicians only see their assigned contracts
const visibleContracts = computed(() => {
  if (isTech.value) {
    return contracts.value.filter(c => (c.technicians || []).includes(myName.value))
  }
  return contracts.value
})

const filteredContracts = computed(() => {
  let list = visibleContracts.value
  if (contractSearch.value) {
    const q = contractSearch.value.toLowerCase()
    list = list.filter(c =>
      c.clientName?.toLowerCase().includes(q) ||
      c.contractNumber?.toLowerCase().includes(q) ||
      getProjectName(c.projectId)?.toLowerCase().includes(q)
    )
  }
  if (contractStatusFilter.value) list = list.filter(c => effectiveStatus(c) === contractStatusFilter.value)
  if (comprehensiveFilter.value !== '') list = list.filter(c => String(c.isComprehensive) === comprehensiveFilter.value)
  return list
})

const pagedContracts = computed(() => {
  const start = (contractPage.value - 1) * pageSize
  return filteredContracts.value.slice(start, start + pageSize)
})

watch([contractSearch, contractStatusFilter, comprehensiveFilter], () => { contractPage.value = 1 })

// ── Helpers ───────────────────────────────────────────────────────────
function effectiveStatus(c) {
  if (!c) return 'active'
  if ((c.status === 'active' || !c.status) && c.endDate) {
    const end = c.endDate.toDate ? c.endDate.toDate() : new Date(c.endDate)
    if (!isNaN(end.getTime()) && end < new Date()) return 'expired'
  }
  return c.status || 'active'
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}
function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return '₹' + Number(val).toLocaleString('en-IN')
}
function isExpiring(contract) {
  if (!contract.endDate || effectiveStatus(contract) !== 'active') return false
  const end = contract.endDate.toDate ? contract.endDate.toDate() : new Date(contract.endDate)
  const diff = (end - new Date()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 30
}
function daysUntilExpiry(contract) {
  if (!contract.endDate) return 0
  const end = contract.endDate.toDate ? contract.endDate.toDate() : new Date(contract.endDate)
  return Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)))
}
function contractStatusBadge(status) {
  const map = { active: 'badge-active', expired: 'badge-danger', expiring: 'badge-warning', cancelled: 'badge-inactive' }
  return map[status] || 'badge-inactive'
}

// ── Contract Columns ──────────────────────────────────────────────────
const contractColumns = computed(() => [
  { key: 'contractNumber', label: 'Contract #' },
  { key: 'client', label: 'Client' },
  { key: 'startDate', label: 'Start', width: '110px' },
  { key: 'endDate', label: 'End', width: '110px' },
  ...(!isTech.value ? [{ key: 'value', label: 'Value', width: '120px' }] : []),
  { key: 'status', label: 'Status', width: '110px' },
  { key: 'technician', label: 'Technician', width: '130px' },
  { key: 'actions', label: 'Actions', width: '180px' },
])

// ── Add / Edit Contract ───────────────────────────────────────────────
const showContractModal = ref(false)
const editingContract = ref(null)
const saving = ref(false)

const defaultContractForm = () => ({
  projectId: '',
  liftSelection: { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
  contractNumber: '', clientName: '', clientPhone: '', clientEmail: '', clientAddress: '',
  startDate: '', endDate: '', durationMonths: 12,
  contractValue: 0, gstPercent: 18, gstAmount: 0, totalWithGST: 0,
  frequency: 'monthly', paymentType: 'full',
  isComprehensive: true,
  status: 'active', technicians: [], notes: '',
})

const contractForm = ref(defaultContractForm())

const selectedAmcProject = computed(() => allProjects.value.find(p => p.id === contractForm.value.projectId) || null)
// Project to use for log modal: prefer the currently selected contract's project, fallback to contract form project
const projectForLog = computed(() => {
  const pid = selectedContractId.value ? (selectedContract.value?.projectId || '') : ''
  return allProjects.value.find(p => p.id === (pid || contractForm.value.projectId)) || null
})

function calcEndDate() {
  if (!contractForm.value.startDate || !contractForm.value.durationMonths) return
  const start = new Date(contractForm.value.startDate)
  start.setMonth(start.getMonth() + contractForm.value.durationMonths)
  start.setDate(start.getDate() - 1)
  contractForm.value.endDate = start.toISOString().split('T')[0]
}

function calcGST() {
  const val = Number(contractForm.value.contractValue) || 0
  const pct = Number(contractForm.value.gstPercent) || 0
  contractForm.value.gstAmount = Math.round(val * pct / 100)
  contractForm.value.totalWithGST = val + contractForm.value.gstAmount
}

const installments = computed(() => {
  const total = contractForm.value.totalWithGST || 0
  const dur = contractForm.value.durationMonths || 12
  const freqMonths = FREQ_TO_MONTHS[contractForm.value.frequency] || 3
  const count = Math.max(1, Math.ceil(dur / freqMonths))
  return Array.from({ length: count }, () => Math.round(total / count))
})

function openAddContract() {
  editingContract.value = null
  contractForm.value = defaultContractForm()
  amcUseProject.value = true
  amcProjectSearch.value = ''
  showContractModal.value = true
}

function openEditContract(contract) {
  editingContract.value = contract
  contractForm.value = { ...defaultContractForm(), ...contract }
  amcUseProject.value = !!contract.projectId
  if (contract.projectId) {
    const proj = allProjects.value.find(p => p.id === contract.projectId)
    amcProjectSearch.value = proj?.projectName || ''
  } else {
    amcProjectSearch.value = ''
  }
  showContractModal.value = true
}

async function saveContract() {
  if (!contractForm.value.clientName || !contractForm.value.startDate) {
    ui.error('Client name and start date are required.')
    return
  }
  if (contractForm.value.projectId) {
    const dup = contracts.value.find(c =>
      c.projectId === contractForm.value.projectId &&
      (!editingContract.value || c.id !== editingContract.value.id)
    )
    if (dup) {
      ui.error(`A contract already exists for this project (${dup.contractNumber || dup.id}). Edit the existing contract instead.`)
      return
    }
  }
  saving.value = true
  try {
    const data = { ...contractForm.value, updatedAt: new Date() }
    if (editingContract.value) {
      await edit(editingContract.value.id, data, { action: 'updated', module: 'amc', tab: 'AMC', summary: `Updated AMC contract ${data.contractNumber} for ${data.clientName}`, details: { contractNo: data.contractNumber, clientName: data.clientName, status: data.status } })
      ui.success('Contract updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'amc', tab: 'AMC', summary: `Created AMC contract ${data.contractNumber} for ${data.clientName}`, details: { contractNo: data.contractNumber, clientName: data.clientName, status: data.status } })
      ui.success('AMC contract created.')
    }
    showContractModal.value = false
  } catch (e) {
    ui.error('Failed to save contract.')
  } finally {
    saving.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────
const confirmRef = ref(null)
const deleteTarget = ref(null)

function confirmDeleteContract(contract) {
  deleteTarget.value = contract
  confirmRef.value?.open(`Delete AMC contract for "${contract.clientName}"? This cannot be undone.`)
}

async function deleteContract() {
  try {
    await del(deleteTarget.value.id, { action: 'deleted', module: 'amc', tab: 'AMC', summary: `Deleted AMC contract for ${deleteTarget.value.clientName}`, details: { contractNo: deleteTarget.value.contractNumber, clientName: deleteTarget.value.clientName } })
    ui.success('Contract deleted.')
  } catch (e) {
    ui.error('Failed to delete contract.')
  }
}

// ── Contract PDF Generation ───────────────────────────────────────────
function openContractPdf(row) {
  contractPdfTarget.value = row
  const saved = row.contractPdfFormData || {}

  // Start with saved values
  let liftMake      = saved.liftMake || ''
  let liftDoorType  = saved.liftDoorType || ''
  let liftLoad      = saved.liftLoad || ''
  let liftHeight    = saved.liftHeight || ''
  let liftTypology  = saved.liftTypology || ''
  let numberOfLifts = saved.numberOfLifts || 1

  // Auto-fill from linked project when fields are still blank
  if (row.projectId && (!liftMake || !liftDoorType || !liftLoad || !liftHeight || !liftTypology)) {
    const proj = allProjects.value.find(p => p.id === row.projectId)
    if (proj) {
      const firstLift = proj.buildings?.[0]?.wings?.[0]?.lifts?.[0] || null
      if (!liftMake     && firstLift?.oem)                         liftMake     = firstLift.oem
      if (!liftDoorType && firstLift?.doorType)                    liftDoorType = firstLift.doorType
      if (!liftLoad     && (firstLift?.capacity || firstLift?.ratedLoad))
        liftLoad = (firstLift.capacity || firstLift.ratedLoad) + ' kg'
      if (!liftHeight   && (firstLift?.stops || proj.floors))
        liftHeight = (firstLift?.stops || proj.floors) + ' Floors'
      if (!liftTypology && (firstLift?.type || firstLift?.drive))  liftTypology = firstLift.type || firstLift.drive
      if (!saved.numberOfLifts) {
        let cnt = 0
        proj.buildings?.forEach(b => b.wings?.forEach(w => (cnt += w.lifts?.length || 0)))
        if (cnt > 0) numberOfLifts = cnt
      }
    }
  }

  contractPdfForm.value = {
    date: saved.date || new Date().toISOString().slice(0, 10),
    liftMake, liftDoorType, liftTypology, liftLoad, liftHeight, numberOfLifts,
    nonCompAmc: saved.nonCompAmc || (row.contractValue ? `Rs. ${Number(row.contractValue).toLocaleString('en-IN')} PER LIFT*/- Per Annum` : ''),
    discountEnabled: saved.discountEnabled || false,
    discountAmount: saved.discountAmount || '',
    finalAmc: saved.finalAmc || (row.contractValue ? `Rs. ${Number(row.contractValue).toLocaleString('en-IN')} PER LIFT*/- Per Annum` : ''),
    paymentTerms: saved.paymentTerms || '100% ADVANCE',
    duration: saved.duration || '12 MONTHS FROM DATE OF CONTRACT',
  }
  contractPdfEditEnabled.value = !row.contractPdfUrl
  showContractPdfModal.value = true
}

async function generateContractPdf() {
  contractPdfGenerating.value = true
  try {
    const ctx = await _getCtx()
    const template = ctx?.contractHtml || ''
    if (!template.trim()) {
      ui.error('No contract template found. Please add the HTML template in Configurations → Contract Format.')
      return
    }
    const row = contractPdfTarget.value
    const f = contractPdfForm.value
    const dateStr = f.date ? new Date(f.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''

    let html = template
    html = html.replaceAll('{{LETTER_DATE}}', dateStr)
    html = html.replaceAll('{{CLIENT_NAME}}', row?.clientName || '')
    html = html.replaceAll('{{CLIENT_ADDRESS}}', (row?.clientAddress || '').replace(/\n/g, ', '))
    html = html.replaceAll('{{CONTACT_PERSON}}', row?.contactPerson || '')
    html = html.replaceAll('{{CONTACT_PHONE}}', row?.clientPhone || '')
    html = html.replaceAll('{{LIFT_MAKE}}', f.liftMake || '')
    html = html.replaceAll('{{LIFT_DOOR_TYPE}}', f.liftDoorType || '')
    html = html.replaceAll('{{LIFT_TYPOLOGY}}', f.liftTypology || '')
    html = html.replaceAll('{{LIFT_LOAD}}', f.liftLoad || '')
    html = html.replaceAll('{{LIFT_HEIGHT}}', f.liftHeight || '')
    html = html.replaceAll('{{NUM_LIFTS}}', String(f.numberOfLifts || 1))
    html = html.replaceAll('{{OFFER_NON_COMP}}', f.nonCompAmc || '')
    html = html.replaceAll('{{OFFER_DISCOUNT}}', f.discountAmount || '')
    html = html.replaceAll('{{OFFER_FINAL}}', f.finalAmc || '')
    html = html.replaceAll('{{PAYMENT_TERMS}}', f.paymentTerms || '')
    html = html.replaceAll('{{DURATION}}', f.duration || '')

    // Strip or unwrap conditional discount row
    if (!f.discountEnabled) {
      html = html.replace(/<!--\s*DISCOUNT_ROW_START\s*-->[\s\S]*?<!--\s*DISCOUNT_ROW_END\s*-->/g, '')
    } else {
      html = html.replace(/<!--\s*DISCOUNT_ROW_START\s*-->/g, '').replace(/<!--\s*DISCOUNT_ROW_END\s*-->/g, '')
    }

    const contractNo = row?.contractNumber || row?.id || 'CONTRACT'
    const filename = `${contractNo}-AMC-CONTRACT.pdf`

    const retrieveUrl = await convertHtmlToPdf(html, filename, contractNo)

    // Save URL and form data back to contract record
    await edit(row.id, {
      contractPdfUrl: retrieveUrl,
      contractPdfFormData: { ...f },
      contractPdfGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    // Update local target so UI reflects new URL immediately
    contractPdfTarget.value = { ...row, contractPdfUrl: retrieveUrl }
    contractPdfEditEnabled.value = false

    triggerDownload(retrieveUrl, filename)
    ui.success('Contract PDF saved and download started.')
  } catch (e) {
    ui.error('Failed to generate contract PDF: ' + (e?.message || e))
  } finally {
    contractPdfGenerating.value = false
  }
}

// ── Project Name Helper ───────────────────────────────────────────────
function getProjectName(projectId) {
  if (!projectId) return null
  return allProjects.value.find(p => p.id === projectId)?.projectName || null
}

function getContractById(contractId) {
  return contracts.value.find(c => c.id === contractId) || null
}

// ── Delete Monthly Visit Log (admin only) ─────────────────────────────
const confirmLogRef = ref(null)
const logDeleteTarget = ref(null)

function confirmDeleteLog(log) {
  logDeleteTarget.value = log
  confirmLogRef.value?.open(`Delete the maintenance visit log for ${log?.monthKey || 'this month'}? This action cannot be undone.`)
}

async function deleteLog() {
  if (!logDeleteTarget.value) return
  try {
    await delLog(logDeleteTarget.value.id)
    activity.log({ action: 'deleted', module: 'amcMonthlyMaintenance', tab: 'AMC', summary: 'Deleted AMC visit log', details: { id: logDeleteTarget.value.id } })
    ui.success('Visit log deleted.')
  } catch (e) {
    ui.error('Failed to delete log.')
  }
  logDeleteTarget.value = null
}

// ── Monthly Maintenance ───────────────────────────────────────────────
const monthlySubTab = ref('contracts')
const selectedContractId = ref('')
const selectedContract = computed(() => contracts.value.find(c => c.id === selectedContractId.value))
const monthlyContractSearch = ref('')

// Overview helpers
const expandedOverviewIds = ref([])
function toggleOverviewExpand(id) {
  const idx = expandedOverviewIds.value.indexOf(id)
  if (idx >= 0) expandedOverviewIds.value.splice(idx, 1)
  else expandedOverviewIds.value.push(id)
}

const currentMonthKey = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

// Overview month filter — defaults to current month, can go back up to 24 months
const overviewMonthKey = ref(currentMonthKey.value)

const overviewMonthOptions = computed(() => {
  const options = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    options.push({ key, label })
  }
  return options
})

function shiftOverviewMonth(delta) {
  const [y, m] = overviewMonthKey.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const newKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (newKey <= currentMonthKey.value) overviewMonthKey.value = newKey
}

// ── Cumulative Payments Tab ─────────────────────────────────────────────
const cumulativeMonthKey = ref(currentMonthKey.value)

const cumulativeMonthOptions = computed(() => {
  const options = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    options.push({ key, label })
  }
  return options
})

const cumulativeMonthLabel = computed(() => {
  const opt = cumulativeMonthOptions.value.find(m => m.key === cumulativeMonthKey.value)
  return opt?.label || cumulativeMonthKey.value
})

function shiftCumulativeMonth(delta) {
  const [y, m] = cumulativeMonthKey.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const newKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (newKey <= currentMonthKey.value) cumulativeMonthKey.value = newKey
}

const cumulativeContracts = computed(() => {
  const result = []
  const monthKey = cumulativeMonthKey.value
  const todayStr = new Date().toISOString().split('T')[0]

  for (const c of visibleContracts.value) {
    if (c.status === 'cancelled' || c.status === 'inactive') continue

    if (c.paymentType === 'installments') {
      const instItems = allInstallments.value.filter(i => i.contractId === c.id && i.dueDate?.startsWith(monthKey))
      for (const i of instItems) {
        result.push({
          contractId: c.id,
          contractNumber: c.contractNumber,
          clientName: c.clientName,
          projectId: c.projectId,
          installmentNo: i.installmentNo,
          totalInstallments: i.totalInstallments,
          amount: i.amount,
          dueDate: i.dueDate,
          isPaid: i.isPaid,
          paidDate: i.paidDate,
          isOverdue: i.isOverdue,
          paidHistoryIdx: i.paidHistoryIdx,
        })
      }
    } else {
      const start = c.startDate || ''
      if (!start.startsWith(monthKey)) continue
      const total = c.totalWithGST || c.contractValue || 0
      const isPaid = total > 0 && (c.paidAmount || 0) >= total
      const isOverdue = !isPaid && !!start && start < todayStr
      result.push({
        contractId: c.id,
        contractNumber: c.contractNumber,
        clientName: c.clientName,
        projectId: c.projectId,
        installmentNo: null,
        totalInstallments: null,
        amount: total,
        dueDate: start,
        isPaid,
        paidDate: isPaid ? (c.paymentHistory?.[0]?.date || null) : null,
        isOverdue,
        paidHistoryIdx: -1,
      })
    }
  }

  return result.sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    return (a.clientName || '').localeCompare(b.clientName || '')
  })
})

const cumulativeSummary = computed(() => {
  const items = cumulativeContracts.value
  const paid    = items.filter(i => i.isPaid)
  const pending = items.filter(i => !i.isPaid && !i.isOverdue)
  const overdue = items.filter(i => i.isOverdue)
  return {
    total:         items.reduce((s, i) => s + (i.amount || 0), 0),
    received:      paid.reduce((s, i) => s + (i.amount || 0), 0),
    pending:       pending.reduce((s, i) => s + (i.amount || 0), 0),
    overdue:       overdue.reduce((s, i) => s + (i.amount || 0), 0),
    contractCount: new Set(items.map(i => i.contractId)).size,
    paidCount:     paid.length,
    pendingCount:  pending.length,
    overdueCount:  overdue.length,
  }
})

function openPaymentForInstallmentById(item) {
  if (item.installmentNo) {
    openPaymentForInstallment(item)
  } else {
    const contract = contracts.value.find(c => c.id === item.contractId)
    if (contract) openPayment(contract)
  }
}

const contractMonthOverview = computed(() => {
  return [...visibleContracts.value]
    .sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''))
    .map(c => {
      const logs = monthlyLogs.value.filter(l => l.contractId === c.id && l.monthKey === overviewMonthKey.value)
      return { ...c, currentLogs: logs, currentLog: logs[0] || null, hasLog: logs.length > 0 }
    })
})

const selectedContractBuildings = computed(() => {
  const ls = selectedContract.value?.liftSelection
  if (!ls) return []
  return (ls.buildings || []).filter(Boolean)
})
const filteredMonthlyContracts = computed(() => {
  const q = monthlyContractSearch.value.trim().toLowerCase()
  if (!q) return visibleContracts.value
  return visibleContracts.value.filter(c =>
    (c.clientName || '').toLowerCase().includes(q) ||
    (c.contractNumber || '').toLowerCase().includes(q) ||
    (getProjectName(c.projectId) || '').toLowerCase().includes(q)
  )
})

const monthNames = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
]

const currentYear = new Date().getFullYear()

const maintenanceMonths = computed(() => {
  return monthNames.map(m => {
    const key = `${currentYear}-${String(m.value).padStart(2, '0')}`
    const logs = monthlyLogs.value.filter(l => l.contractId === selectedContractId.value && l.monthKey === key)
    return { ...m, key, done: logs.length > 0, logs, log: logs[0] || null }
  })
})

const showLogModal = ref(false)
const editingLog = ref(null)
const defaultLogForm = () => ({ month: new Date().getMonth() + 1, year: currentYear, date: new Date().toISOString().split('T')[0], technician: '', remarks: '', signatoryName: '', signatoryDesignation: '', signature: '', signatureImage: '', buildingName: '', wingName: '', liftNo: '', checklist: defaultServiceChecklist(), technicianSignature: '' })
const logForm = ref(defaultLogForm())

// Lift selection for the Log Maintenance modal (keeps names/ids in sync)
const logLiftSelection = ref({ buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] })

// When selector changes, populate the text fields used in logForm
watch(logLiftSelection, (v) => {
  if (!v) return
  // building name: prefer the first selected building name if available
  logForm.value.buildingName = (v.buildings && v.buildings.length) ? v.buildings[0] : ''
  // wing name: prefer the first selected wing name if available
  logForm.value.wingName = (v.wings && v.wings.length) ? v.wings[0] : ''
  // lift no: prefer first selected lift id (string)
  logForm.value.liftNo = (v.liftIds && v.liftIds.length) ? v.liftIds[0] : ''
}, { deep: true })

function mapLogToLiftSelection(projParam) {
  // attempt to map existing logForm building/wing/lift values back to indexes/keys for the selector
  const proj = projParam || projectForLog.value || selectedAmcProject.value
  if (!proj) { logLiftSelection.value = { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] }; return }
  const bIndexes = []
  const wKeys = []
  const lIds = []
  proj.buildings?.forEach((b, bi) => {
    if (b && b.name && logForm.value.buildingName && String(b.name) === String(logForm.value.buildingName)) {
      bIndexes.push(bi)
      b.wings?.forEach((w, wi) => {
        if (w && w.name && logForm.value.wingName && String(w.name) === String(logForm.value.wingName)) {
          wKeys.push(`${bi}-${wi}`)
          ;(w.lifts || []).forEach(l => {
            if (String(l.id) === String(logForm.value.liftNo) || String(l.name || '') === String(logForm.value.liftNo)) lIds.push(l.id)
          })
        }
      })
    }
  })
  const buildings = bIndexes.map(i => proj.buildings?.[i]?.name || '')
  const wings = wKeys.map(k => { const [bi, wi] = k.split('-').map(Number); return proj.buildings?.[bi]?.wings?.[wi]?.name || '' })
  logLiftSelection.value = { buildingIndexes: bIndexes, wingKeys: wKeys, liftIds: lIds, buildings, wings }
}

function openLogMaintenance(monthKeyOverride) {
  editingLog.value = null
  logForm.value = defaultLogForm()
  if (monthKeyOverride && typeof monthKeyOverride === 'string') {
    const [y, m] = monthKeyOverride.split('-').map(Number)
    logForm.value.month = m
    logForm.value.year  = y
  }
  // initialize selector from the selected contract's saved liftSelection when available
  const saved = selectedContract.value?.liftSelection
  if (saved) {
    logLiftSelection.value = {
      buildingIndexes: saved.buildingIndexes || [],
      wingKeys: saved.wingKeys || [],
      liftIds: saved.liftIds || [],
      buildings: saved.buildings || [],
      wings: saved.wings || [],
    }
  } else {
    logLiftSelection.value = { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] }
  }
  showLogModal.value = true
}

function openEditLog(log) {
  if (!log) return
  editingLog.value = log
  const [year, month] = (log.monthKey || '').split('-').map(Number)
  logForm.value = {
    month: month || new Date().getMonth() + 1,
    year: year || currentYear,
    date: log.date || new Date().toISOString().split('T')[0],
    technician: log.technician || '',
    remarks: log.remarks || '',
    signatoryName: log.signatoryName || '',
    signatoryDesignation: log.signatoryDesignation || '',
    signature: log.signature || '',
    signatureImage: log.signatureImage || '',
    buildingName: log.buildingName || '',
    wingName: log.wingName || '',
    liftNo: log.liftNo || '',
    checklist: log.checklist || defaultServiceChecklist(),
    technicianSignature: log.technicianSignature || '',
  }
  showLogModal.value = true
  // attempt to map existing building/wing/lift from the log back into the selector
  setTimeout(() => { mapLogToLiftSelection(projectForLog.value) }, 0)
}

function handleSigImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { logForm.value.signatureImage = ev.target.result }
  reader.readAsDataURL(file)
  e.target.value = ''
}

async function saveLog() {
  if (!logForm.value.date) {
    ui.error('Date is required.')
    return
  }
  saving.value = true
  try {
    const monthKey = `${logForm.value.year}-${String(logForm.value.month).padStart(2, '0')}`
    // For technicians, always lock visit date to today (prevent backdating)
    const visitDate = isTech.value ? new Date().toISOString().split('T')[0] : logForm.value.date
    const completedAt = new Date()
    const logData = {
      contractId: selectedContractId.value,
      clientName: selectedContract.value?.clientName,
      clientAddress: selectedContract.value?.clientAddress,
      contractNumber: selectedContract.value?.contractNumber,
      monthKey,
      date: visitDate,
      technician: logForm.value.technician,
      remarks: logForm.value.remarks,
      buildingName: logForm.value.buildingName || '',
      wingName: logForm.value.wingName || '',
      liftNo: logForm.value.liftNo || '',
      signatoryName: logForm.value.signatoryName,
      signatoryDesignation: logForm.value.signatoryDesignation,
      signature: logForm.value.signature,
      signatureImage: logForm.value.signatureImage || '',
      checklist: logForm.value.checklist,
      technicianSignature: logForm.value.technicianSignature || '',
      loggedAt: completedAt,
      completedAt,
      completedBy: authStore.user?.fullName || authStore.user?.username || '',
    }
    if (editingLog.value) {
      const logId = editingLog.value.id
      await editLog(logId, logData)
      activity.log({ action: 'updated', module: 'amcMonthlyMaintenance', tab: 'AMC', summary: `Edited AMC visit log for ${selectedContract.value?.clientName}`, details: { contractNo: selectedContract.value?.contractNumber, clientName: selectedContract.value?.clientName, month: logData.monthKey, technician: logData.technician } })
      ui.success('Maintenance visit log updated.')
      showLogModal.value = false
      editingLog.value = null
      return
    }
    const newLogId = await addLog(logData)
    activity.log({ action: 'created', module: 'amcMonthlyMaintenance', tab: 'AMC', summary: `Logged AMC visit for ${selectedContract.value?.clientName}`, details: { contractNo: selectedContract.value?.contractNumber, clientName: selectedContract.value?.clientName, month: logData.monthKey, technician: logData.technician } })
    notifyWorker('amc_monthly_log_created', { ...logData, id: newLogId })
    ui.success('Maintenance visit logged.')
    showLogModal.value = false
    // Auto-generate and download the Service Report
    try {
      await generateMaintenanceReceipt(logData)
    } catch (e) {
      console.error('[AMC] Receipt generation failed:', e)
      ui.warning('Visit saved but the service report PDF could not be generated.')
    }
  } catch (e) {
    ui.error(editingLog.value ? 'Failed to update log.' : 'Failed to log maintenance.')
  } finally {
    saving.value = false
  }
}

// Generates and downloads the "Service Report" PDF (checklist + signatures)
// for a monthly visit log. jsPDF-based (landscape, matches printed stationery)
// so it downloads instantly with no external API round-trip.
async function generateMaintenanceReceipt(log) {
  try {
    const ctx = await _getCtx()
    const sigSrc = log.signatureImage?.startsWith('data:image') ? log.signatureImage
                 : log.signature?.startsWith('data:image') ? log.signature : ''
    await generateServiceReportPdf({
      company: ctx?.company || {},
      siteName: log.clientName || '',
      reportNo: (log.contractNumber || '') + (log.monthKey ? '/' + log.monthKey : ''),
      date: log.date,
      checklist: log.checklist || defaultServiceChecklist(),
      remarks: log.remarks,
      technicianName: log.technician || log.technicianName || '',
      technicianSignature: log.technicianSignature || '',
      customerName: log.signatoryName || '',
      customerSignature: sigSrc,
    }, ui)
    return true
  } catch (e) {
    console.error('[AMC] Service report generation failed:', e)
    return null
  }
}

// ── Renewals ──────────────────────────────────────────────────────────
const renewalFilter = ref(null)
const renewalShowExpired = ref(false)
const renewalMonthFilter = ref('')
const renewalSearch = ref('')

const renewalContracts = computed(() => {
  return visibleContracts.value.filter(c => {
    if (renewalShowExpired.value) {
      if (effectiveStatus(c) !== 'expired') return false
    } else {
      const end = c.endDate ? (c.endDate.toDate ? c.endDate.toDate() : new Date(c.endDate)) : null
      if (!end) return false
      if (renewalMonthFilter.value) {
        // Month filter: selecting month M shows contracts expiring in month M-1
        // (contracts expiring in August need to be renewed in September)
        if (effectiveStatus(c) === 'expired') return false
        const [filterYear, filterMonth] = renewalMonthFilter.value.split('-').map(Number)
        const prevMonthDate = new Date(filterYear, filterMonth - 2, 1)
        const endMonthKey = end.getFullYear() * 12 + end.getMonth()
        const targetKey = prevMonthDate.getFullYear() * 12 + prevMonthDate.getMonth()
        if (endMonthKey !== targetKey) return false
      } else if (renewalFilter.value !== null) {
        // Days filter only: show contracts expiring within N days
        const days = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))
        if (days < 0 || days > renewalFilter.value) return false
      } else {
        return false
      }
    }
    if (renewalSearch.value) {
      const q = renewalSearch.value.toLowerCase()
      if (!c.clientName?.toLowerCase().includes(q) && !c.contractNumber?.toLowerCase().includes(q) && !(getProjectName(c.projectId) || '').toLowerCase().includes(q)) return false
    }
    return true
  })
})

const showRenewModal = ref(false)
const renewTarget = ref(null)
const renewForm = ref({
  startDate: '', durationMonths: 12, endDate: '', contractValue: 0,
  gstPercent: 18, gstAmount: 0, totalWithGST: 0, notes: '',
  // Renewal letter fields
  letterDate: new Date().toISOString().slice(0,10),
  contactPerson: '', prevAmount: '', yearsMaintained: '',
  increasePct: '', newAmount: '', authorizedSignatory: '',
  // Renewal contract body fields
  liftMake: '', liftDoorType: '', liftTypology: '', liftLoad: '', liftHeight: '',
  noOfStops: '', liftLockType: '',
  numberOfLifts: 1, contractType: 'Comprehensive', ratePerLift: '',
  billingCycle: 'Yearly', paymentTerms: '100% Advance',
  discountEnabled: false, discountAmount: '',
})
const renewalPdfGenerating = ref(false)

function calcRenewEndDate() {
  if (!renewForm.value.startDate) return
  const start = new Date(renewForm.value.startDate)
  start.setMonth(start.getMonth() + renewForm.value.durationMonths)
  start.setDate(start.getDate() - 1)
  renewForm.value.endDate = start.toISOString().split('T')[0]
}

function calcRenewGST() {
  const val = Number(renewForm.value.contractValue) || 0
  const pct = Number(renewForm.value.gstPercent) || 0
  renewForm.value.gstAmount = Math.round(val * pct / 100)
  renewForm.value.totalWithGST = val + renewForm.value.gstAmount
}

function quickRenew(contract) {
  renewTarget.value = contract
  const today = new Date().toISOString().split('T')[0]
  renewForm.value = {
    startDate: today,
    durationMonths: 12,
    endDate: '',
    contractValue: contract.contractValue || 0,
    gstPercent: contract.gstPercent || 18,
    gstAmount: 0,
    totalWithGST: 0,
    notes: '',
    // Pre-fill renewal letter fields
    letterDate: today,
    contactPerson: contract.contactPerson || '',
    prevAmount: contract.contractValue ? `₹${Number(contract.contractValue).toLocaleString('en-IN')}/-` : '',
    yearsMaintained: '',
    increasePct: '',
    newAmount: '',
    authorizedSignatory: '',
    // Renewal contract body fields
    liftMake: '',
    liftDoorType: '',
    liftTypology: '',
    liftLoad: '',
    liftHeight: '',
    noOfStops: '',
    liftLockType: '',
    numberOfLifts: 1,
    contractType: contract.comprehensive ? 'Comprehensive' : 'Non-Comprehensive',
    ratePerLift: '',
    billingCycle: 'Yearly',
    paymentTerms: '100% Advance',
    discountEnabled: false,
    discountAmount: '',
  }
  calcRenewEndDate()
  calcRenewGST()
  showRenewModal.value = true
}

async function confirmRenew() {
  saving.value = true
  try {
    const contract = renewTarget.value
    const now = new Date().toISOString()
    const historyEntry = {
      renewedOn: now,
      expiredOn: contract.endDate || '',
      previousStartDate: contract.startDate || '',
      previousEndDate: contract.endDate || '',
      previousContractValue: contract.contractValue || 0,
      previousTotalWithGST: contract.totalWithGST || contract.contractValue || 0,
      previousDurationMonths: contract.durationMonths || 12,
      renewedBy: authStore.user?.fullName || authStore.user?.username || 'User',
      notes: renewForm.value.notes || '',
      // Preserve the old contract PDF URL in history so it's downloadable later
      contractPdfUrl: contract.contractPdfUrl || '',
    }
    const updatedHistory = [...(contract.renewalHistory || []), historyEntry]
    await edit(contract.id, {
      startDate: renewForm.value.startDate,
      endDate: renewForm.value.endDate,
      contractValue: renewForm.value.contractValue,
      gstPercent: renewForm.value.gstPercent,
      gstAmount: renewForm.value.gstAmount,
      totalWithGST: renewForm.value.totalWithGST,
      durationMonths: renewForm.value.durationMonths,
      status: 'active',
      renewalHistory: updatedHistory,
      // Clear old contract PDF so user must generate a new one for the renewed period
      contractPdfUrl: '',
      contractPdfFormData: null,
      updatedAt: new Date(),
    }, { action: 'renewed', module: 'amc', tab: 'AMC', summary: `Renewed AMC contract ${contract.contractNumber} for ${contract.clientName}`, details: { contractNo: contract.contractNumber, clientName: contract.clientName, renewalDate: renewForm.value.startDate } })
    ui.success('Contract renewed successfully.')
    showRenewModal.value = false
  } catch (e) {
    ui.error('Failed to renew contract.')
  } finally {
    saving.value = false
  }
}

async function generateRenewalPdf() {
  renewalPdfGenerating.value = true
  try {
    const ctx = await _getCtx()
    const template = ctx?.amcRenewalHtml || ''
    if (!template.trim()) {
      ui.error('No renewal template found. Please add the HTML template in Configurations → AMC Renewal Format.')
      return
    }
    const contract = renewTarget.value
    const f = renewForm.value

    // Format dates helper
    const fmtDate = (iso) => {
      if (!iso) return ''
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    }

    const renewalStartStr = fmtDate(f.startDate)
    const renewalEndStr = fmtDate(f.endDate)
    const letterDateStr = fmtDate(f.letterDate)

    let html = template
    // Cover letter placeholders
    html = html.replaceAll('{{LETTER_DATE}}', letterDateStr)
    html = html.replaceAll('{{CLIENT_NAME}}', contract?.clientName || '')
    html = html.replaceAll('{{CLIENT_ADDRESS}}', (contract?.clientAddress || '').replace(/\n/g, ', '))
    html = html.replaceAll('{{CONTACT_PERSON}}', f.contactPerson || contract?.contactPerson || '')
    html = html.replaceAll('{{CONTRACT_NO}}', contract?.contractNumber || '')
    html = html.replaceAll('{{RENEWAL_START}}', renewalStartStr)
    html = html.replaceAll('{{RENEWAL_END}}', renewalEndStr)
    html = html.replaceAll('{{PREV_AMOUNT}}', f.prevAmount || '')
    html = html.replaceAll('{{YEARS_MAINTAINED}}', f.yearsMaintained || '')
    html = html.replaceAll('{{INCREASE_PCT}}', f.increasePct || '')
    html = html.replaceAll('{{NEW_AMOUNT}}', f.newAmount || '')
    html = html.replaceAll('{{AUTHORIZED_SIGNATORY}}', f.authorizedSignatory || '')
    // Contract body placeholders
    html = html.replaceAll('{{CONTACT_PHONE}}', contract?.clientPhone || '')
    html = html.replaceAll('{{LIFT_MAKE}}', f.liftMake || '')
    html = html.replaceAll('{{LIFT_DOOR_TYPE}}', f.liftDoorType || '')
    html = html.replaceAll('{{LIFT_TYPOLOGY}}', f.liftTypology || '')
    html = html.replaceAll('{{LIFT_LOAD}}', f.liftLoad || '')
    html = html.replaceAll('{{LIFT_HEIGHT}}', f.liftHeight || '')
    html = html.replaceAll('{{NO_OF_STOPS}}', f.noOfStops || '')
    html = html.replaceAll('{{LIFT_LOCK_TYPE}}', f.liftLockType || '')
    html = html.replaceAll('{{NUM_LIFTS}}', String(f.numberOfLifts || 1))
    html = html.replaceAll('{{CONTRACT_TYPE}}', f.contractType || 'Comprehensive')
    html = html.replaceAll('{{RATE_PER_LIFT}}', f.ratePerLift || '')
    html = html.replaceAll('{{COMMENCEMENT_DATE}}', renewalStartStr)
    html = html.replaceAll('{{BILLING_CYCLE}}', f.billingCycle || 'Yearly')
    html = html.replaceAll('{{TOTAL_AMOUNT}}', f.newAmount || '')
    html = html.replaceAll('{{PAYMENT_TERMS}}', f.paymentTerms || '')
    html = html.replaceAll('{{OFFER_DISCOUNT}}', f.discountAmount || '')

    // Strip or unwrap conditional discount row
    if (!f.discountEnabled) {
      html = html.replace(/<!--\s*DISCOUNT_ROW_START\s*-->[\s\S]*?<!--\s*DISCOUNT_ROW_END\s*-->/g, '')
    } else {
      html = html.replace(/<!--\s*DISCOUNT_ROW_START\s*-->/g, '').replace(/<!--\s*DISCOUNT_ROW_END\s*-->/g, '')
    }

    const contractNo = contract?.contractNumber || contract?.id || 'CONTRACT'
    const filename = `${contractNo}-AMC-RENEWAL.pdf`

    const retrieveUrl = await convertHtmlToPdf(html, filename, contractNo)
    // Save renewalPdfUrl on the contract
    await edit(contract.id, { renewalPdfUrl: retrieveUrl, updatedAt: new Date() })
    triggerDownload(retrieveUrl, filename)
    ui.success('Renewal PDF ready — download started.')
  } catch (e) {
    ui.error('Failed to generate renewal PDF: ' + (e?.message || e))
  } finally {
    renewalPdfGenerating.value = false
  }
}

async function exportHistoricalPDF(contract, renewal) {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()

    let y = await _drawHeader(doc, {
      company,
      userName,
      title: 'AMC Contract (Historical Record)',
      subtitle: `Contract No: ${contract.contractNumber || '—'} · Period: ${renewal.previousStartDate} to ${renewal.previousEndDate}`,
      accent: _C.indigo,
    })

    y = _sectionLabel(doc, 'Contract Details', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Contract Number', contract.contractNumber || '—'],
      ['Client Name', contract.clientName || '—'],
      ['Client Phone', contract.clientPhone || '—'],
      ['Start Date', formatDate(renewal.previousStartDate)],
      ['End Date', formatDate(renewal.previousEndDate)],
      ['Duration', `${renewal.previousDurationMonths || 12} months`],
      ['Contract Value', _toRs(renewal.previousContractValue || 0)],
      ['Total with GST', _toRs(renewal.previousTotalWithGST || renewal.previousContractValue || 0)],
    ], y)

    y = _sectionLabel(doc, 'Renewal Record', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Expired On', formatDate(renewal.expiredOn)],
      ['Renewed On', formatDate(renewal.renewedOn)],
      ['Renewed By', renewal.renewedBy || '—'],
      ...(renewal.notes ? [['Notes', renewal.notes]] : []),
    ], y)

    await _drawFooter(doc)
    const filename = `AMC-History-${contract.contractNumber || contract.clientName}-${renewal.previousStartDate || 'past'}.pdf`
    await savePDF(doc, filename, ui)
  } catch (e) {
    console.error('[AMCView] exportHistoricalPDF error', e)
    ui.error('Could not generate historical PDF.')
  }
}

// ── PDF & Email ───────────────────────────────────────────────────────
async function exportContractPDF(contract) {
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
      title: 'AMC Contract',
      subtitle: `Contract No: ${contract.contractNumber || '—'} · Type: ${contract.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive'}`,
      accent: _C.indigo,
    })

    // ── Contract Details ─────────────────────────────────────────────────────
    y = _sectionLabel(doc, 'Contract Details', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Contract Number', contract.contractNumber || '—'],
      ['Status', contract.status || '—'],
      ['Client Name', contract.clientName || '—'],
      ['Client Phone', contract.clientPhone || '—'],
      ['Address', contract.clientAddress || '—'],
      ['Technician', contract.technician || '—'],
      ['Start Date', formatDate(contract.startDate)],
      ['End Date', formatDate(contract.endDate)],
      ['Frequency', contract.frequency || '—'],
      ['Type', contract.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive'],
    ], y)

    // ── Lifts ─────────────────────────────────────────────────────────────────
    if (contract.lifts?.length) {
      y = _sectionLabel(doc, 'Lift Details', y, _C.greyText)
      doc.autoTable({
        startY: y,
        head: [['Lift ID / Number', 'Type', 'Floor / Notes']],
        body: contract.lifts.map(l => [l.liftId || l.number || '—', l.type || '—', l.floor || '—']),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: _C.black },
        headStyles: { fillColor: _C.indigo, textColor: _C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: _C.lightGrey },
        margin: { left: M, right: M },
      })
      y = doc.lastAutoTable.finalY + 5
    }

    // ── Financial Summary ─────────────────────────────────────────────────────
    y = _sectionLabel(doc, 'Financial Summary', y, _C.indigo)
    doc.autoTable({
      startY: y,
      body: [
        ['Contract Value', _toRs(contract.contractValue || 0)],
        [`GST (${contract.gstPercent || 0}%)`, _toRs(contract.gstAmount || 0)],
        ['TOTAL AMOUNT', _toRs(contract.totalWithGST || contract.contractValue || 0)],
      ],
      styles: { fontSize: 9, cellPadding: 4, textColor: _C.black },
      alternateRowStyles: { fillColor: _C.lightGrey },
      columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell(data) {
        if (data.row.raw?.[0] === 'TOTAL AMOUNT') {
          data.cell.styles.fillColor = _C.indigo
          data.cell.styles.textColor = _C.white
          data.cell.styles.fontSize = 10
        }
      },
      margin: { left: M, right: M },
    })
    y = doc.lastAutoTable.finalY + 6

    // ── Notes ────────────────────────────────────────────────────────────────
    if (contract.notes) {
      y = _sectionLabel(doc, 'Notes', y, _C.greyText)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
      const nLines = doc.splitTextToSize(contract.notes, W - M * 2)
      doc.text(nLines, M, y)
      y += nLines.length * 5 + 6
    }

    _drawFooter(doc, { company: company.name, title: 'AMC Contract', note: 'Internal Document · Confidential · Not for External Distribution' })
    await savePDF(doc, `AMC-Contract-${(contract.contractNumber || contract.clientName || 'contract').replace(/\s+/g, '_')}.pdf`, ui)
    ui.success('PDF exported.')
  } catch (e) {
    ui.error('PDF export failed: ' + e.message)
  }
}

// ── Email Contract ────────────────────────────────────────────────────────────
const showAmcEmailModal = ref(false)
const amcEmailTarget = ref(null)
const amcEmailPdfBuffer = ref(null)
const amcEmailPdfFilename = ref('')
const amcEmailPdfGenerating = ref(false)

async function emailContract(contract) {
  amcEmailTarget.value = contract
  amcEmailPdfBuffer.value = null
  amcEmailPdfGenerating.value = true
  showAmcEmailModal.value = true
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
      title: 'AMC Contract',
      subtitle: `Contract No: ${contract.contractNumber || '—'} · Type: ${contract.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive'}`,
      accent: _C.indigo,
    })

    y = _sectionLabel(doc, 'Contract Details', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Contract Number', contract.contractNumber || '—'],
      ['Status', contract.status || '—'],
      ['Client Name', contract.clientName || '—'],
      ['Client Phone', contract.clientPhone || '—'],
      ['Client Email', contract.clientEmail || '—'],
      ['Address', contract.clientAddress || '—'],
      ['Technician', (contract.technicians || []).join(', ') || '—'],
      ['Start Date', formatDate(contract.startDate)],
      ['End Date', formatDate(contract.endDate)],
      ['Frequency', contract.frequency || '—'],
      ['Type', contract.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive'],
    ], y)

    if (contract.lifts?.length) {
      y = _sectionLabel(doc, 'Lift Details', y, _C.greyText)
      doc.autoTable({
        startY: y,
        head: [['Lift ID / Number', 'Type', 'Floor / Notes']],
        body: contract.lifts.map(l => [l.liftId || l.number || '—', l.type || '—', l.floor || '—']),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: _C.black },
        headStyles: { fillColor: _C.indigo, textColor: _C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: _C.lightGrey },
        margin: { left: M, right: M },
      })
      y = doc.lastAutoTable.finalY + 5
    }

    y = _sectionLabel(doc, 'Financial Summary', y, _C.indigo)
    doc.autoTable({
      startY: y,
      body: [
        ['Contract Value', _toRs(contract.contractValue || 0)],
        [`GST (${contract.gstPercent || 0}%)`, _toRs(contract.gstAmount || 0)],
        ['TOTAL AMOUNT', _toRs(contract.totalWithGST || contract.contractValue || 0)],
      ],
      styles: { fontSize: 9, cellPadding: 4, textColor: _C.black },
      alternateRowStyles: { fillColor: _C.lightGrey },
      columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell(data) {
        if (data.row.raw?.[0] === 'TOTAL AMOUNT') {
          data.cell.styles.fillColor = _C.indigo
          data.cell.styles.textColor = _C.white
          data.cell.styles.fontSize = 10
        }
      },
      margin: { left: M, right: M },
    })
    y = doc.lastAutoTable.finalY + 6

    if (contract.notes) {
      y = _sectionLabel(doc, 'Notes', y, _C.greyText)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
      const nLines = doc.splitTextToSize(contract.notes, W - M * 2)
      doc.text(nLines, M, y)
    }

    _drawFooter(doc, { company: company.name, title: 'AMC Contract', note: 'Confidential — For client use only' })

    amcEmailPdfBuffer.value = doc.output('arraybuffer')
    amcEmailPdfFilename.value = `AMC-Contract-${(contract.contractNumber || contract.clientName || 'contract').replace(/\s+/g, '_')}.pdf`
  } catch (e) {
    ui.error('Failed to generate contract PDF: ' + e.message)
    showAmcEmailModal.value = false
  } finally {
    amcEmailPdfGenerating.value = false
  }
}

// ── Payment Tracking ──────────────────────────────────────────────────────────
function onInstallmentSelect() {
  const idx = payInstallmentIdx.value
  if (idx >= 0 && payTargetInstallments.value[idx]) {
    payForm.value.amount = payTargetInstallments.value[idx].amount
    payForm.value.note = `Installment ${idx + 1} of ${payTargetInstallments.value.length}`
  }
}

function openPaymentForInstallment(inst) {
  const contract = contracts.value.find(c => c.id === inst.contractId)
  if (!contract) return
  payTargetId.value = inst.contractId
  payInstallmentIdx.value = inst.installmentNo - 1
  editPayIdx.value = -1
  payForm.value = {
    amount: inst.amount,
    date: new Date().toISOString().slice(0, 10),
    method: 'cash',
    reference: '',
    note: `Installment ${inst.installmentNo} of ${inst.totalInstallments}`,
  }
  payModal.value = true
}

function openPayment(record) {
  if (record.status === 'expired') {
    ui.warning('This contract has expired. Please renew it before logging payments.')
    return
  }
  payTargetId.value = record.id
  payInstallmentIdx.value = -1
  editPayIdx.value = -1
  payForm.value = { amount: 0, date: new Date().toISOString().slice(0, 10), method: 'cash', reference: '', note: '' }
  payModal.value = true
}

function startEditPay(idx) {
  const entry = payTarget.value?.paymentHistory?.[idx]
  if (!entry) return
  editPayIdx.value = idx
  editPayForm.value = { amount: entry.amount, date: entry.date, method: entry.method || 'cash', reference: entry.reference || '', note: entry.note || '' }
}

async function saveEditPay() {
  if (!payTarget.value || editPayIdx.value < 0) return
  const history = [...(payTarget.value.paymentHistory || [])]
  history[editPayIdx.value] = { ...history[editPayIdx.value], ...editPayForm.value, editedAt: new Date().toISOString(), editedBy: authStore.user?.fullName || authStore.user?.username || 'Admin' }
  const newPaid = history.reduce((s, p) => s + Number(p.amount || 0), 0)
  amcSaving.value = true
  try {
    await update(Collections.AMC, payTarget.value.id, { paymentHistory: history, paidAmount: newPaid })
    ui.success('Payment entry updated.')
    editPayIdx.value = -1
  } catch { ui.error('Failed to update payment entry.') }
  finally { amcSaving.value = false }
}

async function savePayment() {
  if (!payTarget.value || !payForm.value.amount || payForm.value.amount <= 0) {
    ui.error('Enter a valid amount')
    return
  }
  amcSaving.value = true
  try {
    const existing = payTarget.value.paymentHistory || []
    const newEntry = {
      ...payForm.value,
      ...(payTarget.value.paymentType === 'installments' && payInstallmentIdx.value >= 0
        ? { installmentNo: payInstallmentIdx.value + 1 } : {}),
      loggedBy: authStore.user?.fullName || authStore.user?.username || 'User',
      loggedAt: new Date().toISOString(),
    }
    const updatedHistory = [...existing, newEntry]
    const newPaid = updatedHistory.reduce((s, p) => s + Number(p.amount || 0), 0)
    await update(Collections.AMC, payTarget.value.id, {
      paymentHistory: updatedHistory,
      paidAmount: newPaid,
    })
    activity.log({ action: 'payment', module: 'amc', tab: 'AMC', summary: `Recorded payment for AMC ${payTarget.value.contractNumber || payTarget.value.clientName}`, details: { contractNo: payTarget.value.contractNumber, clientName: payTarget.value.clientName, paymentAmount: payForm.value.amount } })
    notifyWorker('amc_payment', { ...payTarget.value, paymentHistory: updatedHistory }, { paymentHistory: existing })
    ui.success(`Payment of Rs. ${Number(payForm.value.amount).toLocaleString('en-IN')} logged.`)
    payModal.value = false
  } catch { ui.error('Failed to log payment') }
  finally { amcSaving.value = false }
}

// Downloads the "Authorised Receipt" for a single payment history entry.
// Regenerated on demand from the stored entry data (no hosted URL needed).
async function downloadPaymentReceipt(contract, entry, historyIdx) {
  if (!contract || !entry) return
  try {
    const ctx = await _getCtx()
    await generatePaymentReceiptPdf({
      company: ctx?.company || {},
      receiptNo: String((historyIdx ?? 0) + 1).padStart(3, '0'),
      date: entry.date,
      receivedFrom: contract.clientName || '',
      amount: entry.amount,
      method: entry.method,
      reference: entry.reference,
      billNo: contract.contractNumber || '',
      forText: 'AMC Servicing',
      repairAmcText: contract.contractNumber || 'AMC',
    }, ui)
  } catch (e) {
    console.error('[AMC] Payment receipt generation failed:', e)
    ui.error('Could not generate payment receipt.')
  }
}

// ── Bulk Export ───────────────────────────────────────────────────────────────
function triggerExport(type) {
  showExportDialog({
    rows: contracts.value,
    dateField: 'startDate',
    columns: ['Contract #', 'Client', 'Type', 'Start Date', 'End Date', 'Frequency', 'Value', 'Status'],
    title: 'AMC Contracts Report',
    filename: 'amc-contracts',
    accent: _C.indigo,
    ui,
    pdfRowMapper: c => [
      c.contractNumber || '—',
      c.clientName || '—',
      c.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive',
      formatDate(c.startDate),
      formatDate(c.endDate),
      c.frequency || '—',
      formatCurrency(c.totalWithGST || c.contractValue),
      c.status || 'active',
    ],
    excelRowMapper: c => [
      c.contractNumber || '—',
      c.clientName || '—',
      c.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive',
      formatDate(c.startDate),
      formatDate(c.endDate),
      c.frequency || '—',
      c.totalWithGST || c.contractValue || 0,
      c.status || 'active',
    ],
  })
  if (type) expType.value = type
}

watch(() => ui.scheduleContext, (ctx) => {
  if (!ctx || ctx.tab !== 'amc') return
  editingContract.value = null
  contractForm.value = defaultContractForm()
  contractForm.value.projectId = ctx.projectId || ''
  contractForm.value.clientName = ctx.clientName || ''
  contractForm.value.clientPhone = ctx.clientPhone || ''
  contractForm.value.clientEmail = ctx.clientEmail || ''
  contractForm.value.clientAddress = ctx.clientAddress || ''
  if (ctx.startDate) {
    contractForm.value.startDate = ctx.startDate
    calcEndDate()
  }
  amcUseProject.value = true
  amcProjectSearch.value = ctx.projectName || ''
  activeTab.value = 'contracts'
  showContractModal.value = true
  ui.clearScheduleContext()
}, { immediate: true })
</script>

<style scoped>
.amc-view { padding: 0; }
.page-sub { font-size: 13px; color:var(--ct-muted); margin-top: 4px; }
.search-box { position: relative; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--ct-muted); }
.search-box .input { padding-left: 32px; }
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
</style>
