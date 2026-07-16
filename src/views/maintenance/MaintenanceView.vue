<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <ClipboardList :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Maintenance
        </h1>
        <p class="page-sub">Scheduled, logged, and never missed.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-secondary btn-sm" @click="triggerExport('pdf')"><FileDown :size="14" /> PDF</button>
        <button class="btn-secondary btn-sm" @click="triggerExport('excel')"><FileText :size="14" /> Excel</button>
        <button class="btn-primary" @click="openAdd">
          <Plus :size="16" /> Schedule Maintenance
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════
         AMC CONTRACT MAINTENANCE SECTION
    ════════════════════════════════════════════════════════════════ -->
    <div class="glass" style="border-radius:14px;margin-bottom:24px;overflow:hidden;">
      <div
        style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:rgba(99,102,241,0.06);border-bottom:1px solid rgba(99,102,241,0.12);"
        @click="showAmcSection = !showAmcSection"
      >
        <div style="display:flex;align-items:center;gap:10px;">
          <Shield :size="16" style="color:#818cf8;" />
          <span style="font-size:14px;font-weight:600;color:var(--ct-primary);">AMC Contract Maintenance</span>
          <span class="badge badge-info" style="margin-left:4px;">{{ amcContracts.length }}</span>
        </div>
        <ChevronDown v-if="showAmcSection" :size="16" style="color:var(--ct-muted);" />
        <ChevronRight v-else :size="16" style="color:var(--ct-muted);" />
      </div>

      <div v-if="showAmcSection" style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <!-- Search bar -->
        <div style="position:relative;">
          <Search :size="14" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ct-muted);pointer-events:none;" />
          <input
            v-model="amcContractSearch"
            class="input"
            style="padding-left:32px;font-size:13px;"
            placeholder="Search by client name or contract number…"
          />
        </div>

        <div v-if="!amcContracts.length" style="text-align:center;padding:30px;color:var(--ct-muted);font-size:13px;">
          No AMC contracts found. Create contracts in the AMC tab.
        </div>
        <div v-else-if="!filteredAmcContracts.length" style="text-align:center;padding:20px;color:var(--ct-muted);font-size:13px;">
          No contracts match "{{ amcContractSearch }}".
        </div>

        <div
          v-for="contract in filteredAmcContracts"
          :key="contract.id"
          style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;"
        >
          <!-- Contract Card Header -->
          <div
            class="amc-contract-header"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;cursor:pointer;gap:10px;"
            @click="toggleContractExpand(contract.id)"
          >
            <div class="contract-info" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
              <div style="width:36px;height:36px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <FileText :size="15" style="color:#818cf8;" />
              </div>
              <div style="flex:1;min-width:0;">
                <div class="db-s" style="font-size:13px;font-weight:600;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {{ contract.projectId ? (getProjectName(contract.projectId) || contract.clientName) : contract.clientName }}
                </div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
                  <span v-if="contract.projectId && getProjectName(contract.projectId)" class="db-s" style="color:var(--ct-muted);">{{ contract.clientName }} &bull; </span>{{ contract.contractNumber || '—' }} &bull; {{ contract.frequency || '—' }}
                  <span v-if="contract.isComprehensive !== undefined" style="margin-left:6px;padding:1px 6px;border-radius:99px;font-size:10px;" :style="contract.isComprehensive ? 'background:rgba(16,185,129,0.12);color:var(--ct-green);' : 'background:rgba(245,158,11,0.12);color:#fbbf24;'">
                    {{ contract.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive' }}
                  </span>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;max-width:220px;">
              <span :class="['badge', contractStatusBadge(contract.status)]">{{ contract.status || 'active' }}</span>
              <span class="contract-dates" style="font-size:11px;color:var(--ct-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">
                {{ formatDate(contract.startDate) }} – {{ formatDate(contract.endDate) }}
              </span>
              <ChevronDown v-if="expandedContracts[contract.id]" :size="14" style="color:var(--ct-muted);" />
              <ChevronRight v-else :size="14" style="color:var(--ct-muted);" />
            </div>
          </div>

          <!-- Expanded Contract Body: maintenance visits -->
          <div v-if="expandedContracts[contract.id]" style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
              <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Maintenance Visits</div>
              <div style="display:flex;gap:6px;">
                <button v-if="isAdmin || isTech || isReception" class="btn-primary btn-sm" @click.stop="openMonthCompletion(contract)">
                  <Plus :size="12" /> Log Visit
                </button>
                <button
                  v-if="(isAdmin || isTech || isReception) && !isCurrentMonthLogged(contract.id)"
                  class="btn-success btn-sm"
                  @click.stop="openMonthCompletion(contract)"
                >
                  <CalendarCheck :size="12" /> Complete Month
                </button>
                <span
                  v-if="isCurrentMonthLogged(contract.id)"
                  style="font-size:11px;color:var(--ct-green);display:flex;align-items:center;gap:4px;padding:4px 8px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:6px;"
                >
                  ✓ Month completed
                </span>
              </div>
            </div>

            <div v-if="!getContractVisits(contract.id).length" style="text-align:center;padding:16px;color:var(--ct-muted);font-size:12px;">
              No visits logged yet.
            </div>
            <div
              v-for="visit in getContractVisits(contract.id)"
              :key="visit.id"
              style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);"
            >
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;color:var(--ct-secondary);">{{ visit.monthKey || formatDate(visit.scheduledDate) }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:1px;">{{ visit.technicianName || visit.technician || '—' }} &bull; {{ visit.notes || visit.remarks || '' }}</div>
                <div v-if="visit.completedAt" style="font-size:10px;color:var(--ct-accent);margin-top:2px;">
                  ✓ Completed by {{ visit.completedBy || (visit.technicianName || visit.technician || '—') }}
                </div>
                <!-- Inspection status -->
                <div v-if="getVisitInspection(contract.id, visit.monthKey)" style="font-size:10px;color:var(--ct-green);margin-top:2px;">
                  Inspected by {{ getVisitInspection(contract.id, visit.monthKey).checkedBy }}
                </div>
                <!-- Receipt / Inspect action buttons for completed visits -->
                <div v-if="visit.status === 'completed' || visit.completedAt" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;">
                  <button
                    v-if="visit.receiptUrl"
                    class="btn-secondary btn-sm"
                    style="font-size:10px;"
                    @click.stop="triggerMaintDownload(visit.receiptUrl, 'AMC-Receipt-' + (visit.contractNumber || visit.clientName) + '-' + visit.monthKey + '.pdf')"
                    title="Download Receipt"
                  >
                    <FileDown :size="10" /> Receipt
                  </button>
                  <button
                    v-if="!getVisitInspection(contract.id, visit.monthKey)"
                    class="btn-secondary btn-sm"
                    style="font-size:10px;"
                    @click.stop="openMaintInspection(contract, visit.monthKey)"
                    title="Log Inspection"
                  >
                    <ClipboardCheck :size="10" /> Inspect
                  </button>
                  <button
                    v-else
                    class="btn-secondary btn-sm"
                    style="font-size:10px;"
                    @click.stop="openViewMaintInspection(getVisitInspection(contract.id, visit.monthKey))"
                    title="View Inspection"
                  >
                    <Eye :size="10" /> Inspection
                  </button>
                  <button
                    class="btn-secondary btn-sm"
                    style="font-size:10px;color:#25D366;"
                    @click.stop="shareVisitOnWhatsApp(visit, contract.clientPhone)"
                    title="Send Receipt via WhatsApp"
                  >
                    <MessageCircle :size="10" /> WhatsApp
                  </button>
                </div>
              </div>
              <span :class="['badge', visitStatusBadge(visit.status || 'completed')]">{{ visit.status || 'completed' }}</span>
              <div style="display:flex;gap:5px;flex-shrink:0;">
                <button
                  v-if="(visit.status || 'scheduled') !== 'completed'"
                  class="btn-success btn-sm"
                  title="Mark complete"
                  @click.stop="markAmcVisitComplete(visit)"
                >
                  <CheckCircle :size="11" />
                </button>
                <button v-if="isAdmin || isReception" class="btn-secondary btn-sm" @click.stop="openEditAmcVisit(visit, contract)">
                  <Pencil :size="11" />
                </button>
                <button v-if="auth.can('canDelete')" class="btn-danger btn-sm" @click.stop="deleteAmcVisit(visit)">
                  <Trash2 :size="11" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════
         REGULAR MAINTENANCE RECORDS
    ════════════════════════════════════════════════════════════════ -->

    <!-- Status Filter Tabs -->
    <div class="tabs-nav" style="margin-bottom:20px;">
      <button :class="['tab-btn', statusTab === '' && 'active']" @click="statusTab = ''">
        All <span class="badge badge-info" style="margin-left:4px;">{{ items.length }}</span>
      </button>
      <button :class="['tab-btn', statusTab === 'scheduled' && 'active']" @click="statusTab = 'scheduled'">Scheduled</button>
      <button :class="['tab-btn', statusTab === 'in-progress' && 'active']" @click="statusTab = 'in-progress'">In Progress</button>
      <button :class="['tab-btn', statusTab === 'completed' && 'active']" @click="statusTab = 'completed'">Completed</button>
      <button :class="['tab-btn', statusTab === 'overdue' && 'active']" @click="statusTab = 'overdue'">
        Overdue
        <span v-if="overdueCount" class="badge badge-danger" style="margin-left:4px;">{{ overdueCount }}</span>
      </button>
    </div>

    <!-- Search & Filters -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search by client or elevator…" />
      </div>
      <select v-model="typeFilter" class="input" style="width:170px;">
        <option value="">All Types</option>
        <option value="routine">Routine</option>
        <option value="preventive">Preventive</option>
        <option value="emergency">Emergency</option>
        <option value="annual">Annual</option>
      </select>
      <select v-model="comprehensiveFilter" class="input" style="width:180px;">
        <option value="">All Contracts</option>
        <option value="comprehensive">Comprehensive</option>
        <option value="non-comprehensive">Non-Comprehensive</option>
      </select>
      <input v-model="dateFrom" class="input" type="date" style="width:150px;" title="From date" />
      <input v-model="dateTo" class="input" type="date" style="width:150px;" title="To date" />
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No maintenance records found."
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div class="db-s" style="font-weight:500;color:var(--ct-primary);">{{ row.projectId ? (getProjectName(row.projectId) || row.clientName) : row.clientName }}</div>
          <div v-if="row.projectId && getProjectName(row.projectId)" class="db-s" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ row.clientName }}</div>
          <div v-else style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ row.location || '—' }}</div>
        </td>
        <td>
          <div style="color:var(--ct-sub);">{{ row.elevatorId || row.elevatorNumber || '—' }}</div>
        </td>
        <td>
          <span :class="['badge', typeBadge(row.maintenanceType)]">{{ row.maintenanceType || '—' }}</span>
          <div v-if="row.comprehensiveType" style="font-size:10px;margin-top:3px;" :style="row.comprehensiveType === 'comprehensive' ? 'color:var(--ct-green);' : 'color:#fbbf24;'">
            {{ row.comprehensiveType === 'comprehensive' ? 'Comprehensive' : 'Non-Comprehensive' }}
          </div>
        </td>
        <td>
          <div style="color:var(--ct-sub);font-size:12px;">{{ row.technicianName || '—' }}</div>
        </td>
        <td>
          <div :style="{ color: isOverdue(row) ? '#f87171' : '#64748b' }" style="font-size:13px;">
            {{ formatDate(row.scheduledDate) }}
          </div>
          <div style="font-size:11px;color:var(--ct-muted);">Done: {{ formatDate(row.completedDate) }}</div>
        </td>
        <td>
          <span :class="['badge', statusBadge(row.status)]">{{ row.status || 'scheduled' }}</span>
        </td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openView(row)" title="View Details"><Eye :size="12" /></button>
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <button
              v-if="(row.status || 'scheduled') !== 'completed'"
              class="btn-success btn-sm"
              title="Mark complete"
              @click="openCompletion(row)"
            >
              <CheckCircle :size="12" />
            </button>
            <button v-if="auth.can('canDelete') && !isTech" class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- View Maintenance Detail -->
    <AppModal v-model="showViewModal" title="Maintenance Details" subtitle="Read-only view" width="640px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:14px;">
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:3px;">{{ viewTarget.location || '' }}</div>
          </div>
          <span :class="['badge', statusBadge(viewTarget.status)]">{{ viewTarget.status || 'scheduled' }}</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <div class="label">Elevator ID</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.elevatorId || viewTarget.elevatorNumber || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Maintenance Type</div>
            <div style="margin-top:4px;"><span :class="['badge', typeBadge(viewTarget.maintenanceType)]">{{ viewTarget.maintenanceType || '—' }}</span></div>
          </div>
          <div class="form-group">
            <div class="label">Contract Type</div>
            <div style="font-size:13px;margin-top:4px;" :style="viewTarget.comprehensiveType === 'comprehensive' ? 'color:var(--ct-green);' : 'color:#fbbf24;'">
              {{ viewTarget.comprehensiveType === 'comprehensive' ? 'Comprehensive' : viewTarget.comprehensiveType === 'non-comprehensive' ? 'Non-Comprehensive' : '—' }}
            </div>
          </div>
          <div class="form-group">
            <div class="label">Technician</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;">{{ viewTarget.technicianName || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Scheduled Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;" :style="isOverdue(viewTarget) ? 'color:#f87171;' : ''">{{ formatDate(viewTarget.scheduledDate) }}</div>
          </div>
          <div class="form-group">
            <div class="label">Completed Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.completedDate ? formatDate(viewTarget.completedDate) : '—' }}</div>
          </div>
          <div class="form-group form-full" v-if="viewTarget.remarks">
            <div class="label">Remarks</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.remarks }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-primary" @click="openEdit(viewTarget); showViewModal = false">
          <Pencil :size="14" /> Edit
        </button>
      </template>
    </AppModal>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Maintenance' : 'Schedule Maintenance'" width="700px">
      <div class="form-grid">

        <!-- Project Link Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;background:rgba(99,102,241,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
                <FolderOpen :size="14" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link to Project</div>
                <div style="font-size:11px;color:var(--ct-muted);">Auto-fill client details from an existing project</div>
              </div>
            </div>
            <button
              type="button"
              @click="maintUseProject = !maintUseProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${maintUseProject ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`"
            >
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${maintUseProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>

        <!-- Project Search -->
        <div v-if="maintUseProject" class="form-group form-full">
          <label class="label">Select Project *</label>
          <div style="position:relative;">
            <input
              v-model="maintProjectSearch"
              class="input"
              placeholder="Search project name…"
              @focus="maintShowProjectDropdown = true"
              @blur="maintDelayCloseDropdown"
            />
            <div v-if="maintShowProjectDropdown && maintFilteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div
                v-for="p in maintFilteredProjects"
                :key="p.id"
                @mousedown.prevent="selectMaintProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
              >
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.city || p.address || '—' }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:6px;font-size:12px;color:var(--ct-green);">✓ Project linked — client details auto-filled</div>
        </div>

        <div class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client name" :readonly="maintUseProject && !!form.projectId" :style="maintUseProject && form.projectId ? 'opacity:.7;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Location / Site</label>
          <input v-model="form.location" class="input" placeholder="Building / site address" :readonly="maintUseProject && !!form.projectId" :style="maintUseProject && form.projectId ? 'opacity:.7;' : ''" />
        </div>

        <!-- Lift Selector when project is linked -->
        <div v-if="maintUseProject && form.projectId && projectForMaint" class="form-group form-full">
          <label class="label">Select Building / Wing / Lift</label>
          <LiftSelector v-model="maintLiftSelection" :project="projectForMaint" />
        </div>

        <div class="form-group">
          <label class="label">Elevator ID / No.</label>
          <input v-model="form.elevatorId" class="input" placeholder="EL-001" :readonly="!!(maintUseProject && form.projectId && projectForMaint)" :style="maintUseProject && form.projectId && projectForMaint ? 'opacity:.7;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Maintenance Type</label>
          <select v-model="form.maintenanceType" class="input">
            <option value="">Select…</option>
            <option value="routine">Routine</option>
            <option value="preventive">Preventive</option>
            <option value="emergency">Emergency</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        <!-- Comprehensive / Non-Comprehensive -->
        <div class="form-group form-full">
          <label class="label">Contract Type</label>
          <div style="display:flex;gap:10px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:12px;color:var(--ct-sub);" :style="form.comprehensiveType === 'comprehensive' ? 'background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:var(--ct-green);' : ''">
              <input type="radio" v-model="form.comprehensiveType" value="comprehensive" style="accent-color:#10b981;" />
              Comprehensive
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:12px;color:var(--ct-sub);" :style="form.comprehensiveType === 'non-comprehensive' ? 'background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.3);color:#fbbf24;' : ''">
              <input type="radio" v-model="form.comprehensiveType" value="non-comprehensive" style="accent-color:#f59e0b;" />
              Non-Comprehensive
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="label">Technician Name</label>
          <select v-model="form.technicianName" class="input">
            <option value="">Select…</option>
            <option v-for="e in technicians" :key="e.id" :value="e.fullName || e.name">{{ e.fullName || e.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Scheduled Date</label>
          <input v-model="form.scheduledDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Completed Date</label>
          <input v-model="form.completedDate" class="input" type="date" />
        </div>
        <div class="form-group form-full">
          <label class="label">Work Performed</label>
          <textarea v-model="form.workPerformed" class="input" rows="3" placeholder="Describe work performed…"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Parts Used</label>
          <input v-model="form.partsUsed" class="input" placeholder="Parts / materials used" />
        </div>
        <div class="form-group">
          <label class="label">Next Service Date</label>
          <input v-model="form.nextServiceDate" class="input" type="date" />
        </div>
        <div class="form-group form-full">
          <label class="label">Remarks</label>
          <textarea v-model="form.remarks" class="input" rows="2" placeholder="Additional remarks…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" @click="save" :disabled="saving">
          {{ saving ? 'Saving…' : (editing ? 'Update' : 'Schedule') }}
        </button>
      </template>
    </AppModal>

    <!-- AMC Visit Modal -->
    <AppModal v-model="showAmcVisitModal" :title="editingAmcVisit ? 'Edit Visit' : 'Log AMC Visit'" width="560px">
      <div class="form-grid">
        <div class="form-group form-full" v-if="amcVisitContract">
          <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border-radius:10px;font-size:12px;color:var(--ct-accent);">
            Contract: {{ amcVisitContract.contractNumber || '—' }} — {{ amcVisitContract.clientName }}
          </div>
        </div>
        <div class="form-group">
          <label class="label">Scheduled Date</label>
          <input v-model="amcVisitForm.scheduledDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Technician Name</label>
          <select v-model="amcVisitForm.technicianName" class="input">
            <option value="">Select…</option>
            <option v-for="e in technicians" :key="e.id" :value="e.fullName || e.name">{{ e.fullName || e.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="amcVisitForm.status" class="input">
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Completed Date</label>
          <input v-model="amcVisitForm.completedDate" class="input" type="date" />
        </div>
        <div class="form-group form-full">
          <label class="label">Notes</label>
          <textarea v-model="amcVisitForm.notes" class="input" rows="2" placeholder="Visit notes…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showAmcVisitModal = false">Cancel</button>
        <button class="btn-primary" @click="saveAmcVisit" :disabled="savingVisit">
          {{ savingVisit ? 'Saving…' : (editingAmcVisit ? 'Update' : 'Log Visit') }}
        </button>
      </template>
    </AppModal>

    <!-- ── Month Completion Modal ──────────────────────────────────────── -->
    <AppModal
      v-model="showMonthCompletionModal"
      title="Log Maintenance Visit"
      :subtitle="monthCompletionContract?.clientName"
      width="680px"
    >
      <div class="form-grid">
        <!-- Contract info banner -->
        <div class="form-group form-full">
          <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;font-size:12px;color:var(--ct-accent);">
            Contract: {{ monthCompletionContract?.contractNumber || '—' }} — {{ monthCompletionContract?.clientName }}
          </div>
        </div>

        <!-- Month selector -->
        <div class="form-group">
          <label class="label">Month *</label>
          <select v-model="monthCompletionForm.month" class="input">
            <option v-for="m in monthNames" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Year</label>
          <input v-model.number="monthCompletionForm.year" class="input" type="number" :min="2020" :max="2035" />
        </div>

        <!-- Visit date — locked for technicians -->
        <div class="form-group">
          <label class="label">Visit Date *</label>
          <input
            v-model="monthCompletionForm.date"
            class="input"
            type="date"
            :readonly="isTech"
            :style="isTech ? 'opacity:0.7;cursor:not-allowed;background:rgba(99,102,241,0.06);' : ''"
            :title="isTech ? 'Date locked to today for technicians' : ''"
          />
          <div v-if="isTech" style="font-size:10px;color:var(--ct-accent);margin-top:4px;">Locked to today — cannot be changed</div>
        </div>

        <!-- Technician -->
        <div class="form-group">
          <label class="label">Technician *</label>
          <select v-model="monthCompletionForm.technicianName" class="input">
            <option value="">Select technician…</option>
            <option v-for="e in technicians" :key="e.id" :value="e.fullName || e.name">{{ e.fullName || e.name }}</option>
          </select>
        </div>

        <!-- Building / Wing / Lift -->
        <div v-if="projectForMonth" class="form-group" style="grid-column:1/-1;">
          <label class="label">Select Building / Wing / Lift</label>
          <LiftSelector v-model="monthCompletionLiftSelection" :project="projectForMonth" />
        </div>
        <template v-else>
          <div class="form-group">
            <label class="label">Building / Tower</label>
            <input v-model="monthCompletionForm.buildingName" class="input" placeholder="e.g. Tower A, Block 1" />
          </div>
          <div class="form-group">
            <label class="label">Wing / Floor</label>
            <input v-model="monthCompletionForm.wingName" class="input" placeholder="e.g. A Wing, 5th Floor" />
          </div>
          <div class="form-group">
            <label class="label">Lift No.</label>
            <input v-model="monthCompletionForm.liftNo" class="input" placeholder="e.g. L-01, Lift 1" />
          </div>
        </template>

        <!-- Remarks -->
        <div class="form-group form-full">
          <label class="label">Remarks / Work Done</label>
          <textarea v-model="monthCompletionForm.remarks" class="input" rows="3" placeholder="Work done, observations, parts replaced…"></textarea>
        </div>

        <!-- Signatory details -->
        <div style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;margin-top:4px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Customer Acknowledgement</div>
          <div class="form-grid" style="margin-bottom:0;">
            <div class="form-group">
              <label class="label">Signatory Name</label>
              <input v-model="monthCompletionForm.signatoryName" class="input" placeholder="Person signing on behalf of client" />
            </div>
            <div class="form-group">
              <label class="label">Designation / Role</label>
              <input v-model="monthCompletionForm.signatoryDesignation" class="input" placeholder="e.g. Facility Manager, Society Secretary" />
            </div>
          </div>
        </div>

        <!-- E-Signature canvas -->
        <div class="form-group form-full">
          <label class="label">Customer Signature</label>
          <SignatureCanvas v-model="monthCompletionForm.signature" />
        </div>

        <!-- Or upload signature image -->
        <div class="form-group form-full" style="margin-top:4px;">
          <label class="label" style="margin-bottom:6px;">Or Upload Signature Image <span style="font-size:10px;color:var(--ct-muted);font-weight:400;">(optional)</span></label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:12px;color:var(--ct-secondary);background:rgba(255,255,255,0.04);">
              <Upload :size="13" /> Browse Image
              <input type="file" accept="image/*" style="display:none;" @change="handleMonthSigImageUpload" />
            </label>
            <span v-if="monthCompletionForm.signatureImage" style="font-size:11px;color:var(--ct-green);">✓ Image selected</span>
            <button v-if="monthCompletionForm.signatureImage" type="button" class="btn-danger btn-sm" @click="monthCompletionForm.signatureImage = ''">Remove</button>
          </div>
          <img v-if="monthCompletionForm.signatureImage" :src="monthCompletionForm.signatureImage" style="margin-top:8px;max-height:80px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);display:block;" />
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showMonthCompletionModal = false">Cancel</button>
        <button class="btn-success" :disabled="savingMonthCompletion" @click="saveMonthCompletion">
          <Save :size="14" /> {{ savingMonthCompletion ? 'Saving…' : 'Mark Month Complete & Generate Receipt' }}
        </button>
      </template>
    </AppModal>

    <!-- ── Scheduled Maintenance Completion Modal ────────────────────── -->
    <AppModal
      v-model="showCompletionModal"
      title="Complete Maintenance"
      :subtitle="completionTarget?.clientName || completionTarget?.projectId ? getProjectName(completionTarget?.projectId) : ''"
      width="680px"
    >
      <div v-if="completionTarget" class="form-grid">
        <!-- Info banner -->
        <div class="form-group form-full">
          <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;font-size:12px;color:var(--ct-accent);">
            {{ completionTarget.projectId ? (getProjectName(completionTarget.projectId) || completionTarget.clientName) : completionTarget.clientName }}
            <span v-if="completionTarget.elevatorId"> — {{ completionTarget.elevatorId }}</span>
            <span v-if="completionTarget.maintenanceType" style="margin-left:8px;opacity:.7;">{{ completionTarget.maintenanceType }}</span>
          </div>
        </div>

        <!-- Completion date -->
        <div class="form-group">
          <label class="label">Completion Date *</label>
          <input
            v-model="completionForm.completedDate"
            class="input"
            type="date"
            :readonly="isTech"
            :style="isTech ? 'opacity:0.7;cursor:not-allowed;' : ''"
          />
          <div v-if="isTech" style="font-size:10px;color:var(--ct-accent);margin-top:4px;">Locked to today for technicians</div>
        </div>

        <!-- Technician -->
        <div class="form-group">
          <label class="label">Technician *</label>
          <select v-model="completionForm.technicianName" class="input">
            <option value="">Select technician…</option>
            <option v-for="e in technicians" :key="e.id" :value="e.fullName || e.name">{{ e.fullName || e.name }}</option>
          </select>
        </div>

        <!-- Building / Wing / Lift Selector -->
        <div v-if="projectForCompletion" class="form-group form-full">
          <label class="label">Select Building / Wing / Lift</label>
          <LiftSelector v-model="completionLiftSel" :project="projectForCompletion" />
        </div>
        <template v-else>
          <div class="form-group">
            <label class="label">Building / Tower</label>
            <input v-model="completionForm.buildingName" class="input" placeholder="e.g. Tower A, Block 1" />
          </div>
          <div class="form-group">
            <label class="label">Wing / Floor</label>
            <input v-model="completionForm.wingName" class="input" placeholder="e.g. A Wing, 5th Floor" />
          </div>
        </template>

        <!-- Work Performed -->
        <div class="form-group form-full">
          <label class="label">Work Performed</label>
          <textarea v-model="completionForm.workPerformed" class="input" rows="3" placeholder="Describe work performed, parts replaced…"></textarea>
        </div>

        <!-- Parts Used -->
        <div class="form-group">
          <label class="label">Parts Used</label>
          <input v-model="completionForm.partsUsed" class="input" placeholder="Parts / materials used" />
        </div>

        <!-- Remarks -->
        <div class="form-group">
          <label class="label">Remarks</label>
          <input v-model="completionForm.remarks" class="input" placeholder="Additional remarks" />
        </div>

        <!-- Customer Acknowledgement -->
        <div style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;margin-top:4px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Customer Acknowledgement</div>
          <div class="form-grid" style="margin-bottom:0;">
            <div class="form-group">
              <label class="label">Signatory Name</label>
              <input v-model="completionForm.signatoryName" class="input" placeholder="Person signing on behalf of client" />
            </div>
            <div class="form-group">
              <label class="label">Designation / Role</label>
              <input v-model="completionForm.signatoryDesignation" class="input" placeholder="e.g. Facility Manager" />
            </div>
          </div>
        </div>

        <!-- Signature -->
        <div class="form-group form-full">
          <label class="label">Customer Signature</label>
          <SignatureCanvas v-model="completionForm.signature" />
        </div>
        <div class="form-group form-full" style="margin-top:4px;">
          <label class="label" style="margin-bottom:6px;">Or Upload Signature Image <span style="font-size:10px;color:var(--ct-muted);font-weight:400;">(optional)</span></label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:12px;color:var(--ct-secondary);background:rgba(255,255,255,0.04);">
              <Upload :size="13" /> Browse Image
              <input type="file" accept="image/*" style="display:none;" @change="handleCompletionSigImage" />
            </label>
            <span v-if="completionForm.signatureImage" style="font-size:11px;color:var(--ct-green);">✓ Image selected</span>
            <button v-if="completionForm.signatureImage" type="button" class="btn-danger btn-sm" @click="completionForm.signatureImage = ''">Remove</button>
          </div>
          <img v-if="completionForm.signatureImage" :src="completionForm.signatureImage" style="margin-top:8px;max-height:80px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);display:block;" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showCompletionModal = false">Cancel</button>
        <button class="btn-success" :disabled="savingCompletion" @click="saveCompletion">
          <Save :size="14" /> {{ savingCompletion ? 'Saving…' : 'Mark Complete' }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" @confirm="doDelete" />
    <ConfirmDialog ref="confirmVisitRef" @confirm="doDeleteAmcVisit" />

    <!-- ── Maintenance Inspection Modal ────────────────────────────── -->
    <AppModal v-model="showMaintInspectionModal" title="Lift Inspection" :subtitle="maintInspContract?.clientName" width="760px">
      <div v-if="maintLoadingChecklist" style="text-align:center;padding:30px;color:var(--ct-muted);">Loading checklist…</div>
      <div v-else>
        <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;font-size:12px;color:var(--ct-accent);margin-bottom:14px;">
          {{ maintInspContract?.contractNumber || '—' }} — {{ maintInspMonthKey }}
        </div>
        <div v-if="!maintChecklistItems.length" style="text-align:center;padding:24px;color:var(--ct-muted);font-size:13px;">
          No checklist items. Add items in Configurations → Checklist.
        </div>
        <div v-else style="display:flex;flex-direction:column;gap:14px;max-height:450px;overflow-y:auto;padding-right:4px;">
          <!-- Section A & D: OK / Not OK / Remarks -->
          <template v-for="sec in ['A', 'B', 'C', 'D']" :key="sec">
            <div v-if="maintInspResults.filter(r => r.section === sec).length">
              <div style="font-size:11px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding:4px 8px;background:rgba(99,102,241,0.08);border-radius:6px;display:inline-block;">
                Section {{ sec }}
                <span style="font-size:10px;font-weight:400;color:var(--ct-muted);margin-left:4px;">
                  {{ sec === 'A' ? '— General Inspection' : sec === 'B' ? '— Cleaning' : sec === 'C' ? '— Lubrication' : '— Safety Check' }}
                </span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div
                  v-for="item in maintInspResults.filter(r => r.section === sec)"
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
            <input v-model="maintInspCheckedBy" class="input" placeholder="Inspector name" />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="label">Date</label>
            <input v-model="maintInspDate" class="input" type="date" />
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showMaintInspectionModal = false">Cancel</button>
        <button class="btn-primary" :disabled="savingMaintInspection || !maintChecklistItems.length" @click="saveMaintInspection">
          <Save :size="14" /> {{ savingMaintInspection ? 'Saving…' : 'Save Inspection' }}
        </button>
      </template>
    </AppModal>

    <!-- ── View Inspection Modal ────────────────────────────────────── -->
    <AppModal v-model="showViewMaintInspModal" title="Inspection Report" :subtitle="viewMaintInspData?.clientName" width="660px">
      <div v-if="viewMaintInspData">
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          <div class="glass" style="padding:10px 14px;flex:1;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Month</div>
            <div style="color:var(--ct-primary);font-weight:600;">{{ viewMaintInspData.monthKey }}</div>
          </div>
          <div class="glass" style="padding:10px 14px;flex:1;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Checked By</div>
            <div style="color:var(--ct-primary);font-weight:600;">{{ viewMaintInspData.checkedBy }}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:380px;overflow-y:auto;">
          <div
            v-for="item in viewMaintInspData.checklistResults"
            :key="item.itemId"
            style="display:flex;align-items:center;gap:12px;padding:8px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;"
          >
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:600;color:var(--ct-primary);">{{ item.title }}</div>
              <div v-if="item.description" style="font-size:11px;color:var(--ct-muted);">{{ item.description }}</div>
            </div>
            <span :class="['badge', item.status === 'pass' ? 'badge-active' : item.status === 'fail' ? 'badge-danger' : 'badge-warning']">
              {{ item.status === 'pass' ? 'OK' : item.status === 'fail' ? 'Fail' : 'N/A' }}
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewMaintInspModal = false">Close</button>
        <button class="btn-primary" @click="generateMaintInspectionPdf(viewMaintInspData)">
          <FileDown :size="14" /> Download PDF
        </button>
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
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  ClipboardList, Plus, Search, Pencil, Trash2, CheckCircle,
  ChevronDown, ChevronRight, Shield, FileText, FileDown, FolderOpen,
  Save, Upload, CalendarCheck, Eye, ClipboardCheck, MessageCircle
} from 'lucide-vue-next'
import DataTable from '@/components/ui/DataTable.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import SignatureCanvas from '@/components/ui/SignatureCanvas.vue'
import LiftSelector from '@/components/ui/LiftSelector.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { usePDF } from '@/composables/usePDF'
import { useExport } from '@/composables/useExport'
import { triggerDownload, convertHtmlToPdf } from '@/composables/usePdfApiService'
import { buildCompletionMessage, whatsAppChatUrl } from '@/utils/whatsapp'
import { notifyWorker } from '@/utils/notifyWorker'

const ui = useUIStore()
const activity = useActivityStore()
const auth = useAuthStore()
const { exportTablePDF, _getCtx } = usePDF()
const { showExportDialog, dialogVisible: expDlgVisible, selectedPeriod: expPeriod, exportType: expType, exporting: expRunning, runExport, cancelExport } = useExport()
const isTech       = computed(() => auth.role === 'technician')
const isAdmin      = computed(() => auth.role === 'admin')
const isReception  = computed(() => auth.role === 'reception')

function triggerMaintDownload(url, filename) { triggerDownload(url, filename) }

function getProjectName(projectId) {
  if (!projectId) return null
  return projects.value.find(p => p.id === projectId)?.projectName || null
}

const { items, loading, add, edit, del } = useCollection(Collections.MAINTENANCE)
const employees = useCollection(Collections.EMPLOYEES)
const { items: amcContracts } = useCollection(Collections.AMC)
const { items: amcMonthlyRecords, add: addAmcVisit, edit: editAmcVisit, del: delAmcVisit } = useCollection(Collections.AMC_MONTHLY)
const { items: projects } = useCollection(Collections.PROJECTS)
const { items: maintInspections, add: addMaintInspection, edit: editMaintInspection } = useCollection(Collections.INSPECTIONS)
const { items: maintChecklistItems, loading: maintLoadingChecklist } = useCollection(Collections.CHECKLIST_ITEMS)

// ── Inspection helpers for Maintenance view ──────────────────────────
function getVisitInspection(contractId, monthKey) {
  if (!monthKey) return null
  return maintInspections.value.find(i => i.contractId === contractId && i.monthKey === monthKey) || null
}

const showMaintInspectionModal = ref(false)
const showViewMaintInspModal = ref(false)
const maintInspContract = ref(null)
const maintInspMonthKey = ref('')
const maintInspResults = ref([])
const maintInspCheckedBy = ref('')
const maintInspDate = ref(new Date().toISOString().split('T')[0])
const savingMaintInspection = ref(false)
const viewMaintInspData = ref(null)

function openMaintInspection(contract, monthKey) {
  maintInspContract.value = contract
  maintInspMonthKey.value = monthKey || ''
  maintInspDate.value = new Date().toISOString().split('T')[0]
  maintInspCheckedBy.value = auth.user?.fullName || auth.user?.username || ''
  const sorted = [...maintChecklistItems.value].sort((a, b) => {
    const sa = a.section || 'A', sb = b.section || 'A'
    if (sa !== sb) return sa.localeCompare(sb)
    return (a.order || 0) - (b.order || 0)
  })
  maintInspResults.value = sorted.map(item => ({
    itemId: item.id,
    title: item.title || '',
    description: item.description || '',
    section: item.section || 'A',
    status: 'na',
    remarks: '',
  }))
  showMaintInspectionModal.value = true
}

function openViewMaintInspection(inspection) {
  viewMaintInspData.value = inspection
  showViewMaintInspModal.value = true
}

async function saveMaintInspection() {
  if (!maintInspCheckedBy.value) { ui.error('Please enter the inspector name.'); return }
  savingMaintInspection.value = true
  try {
    const inspData = {
      contractId: maintInspContract.value.id,
      contractNumber: maintInspContract.value.contractNumber || '',
      clientName: maintInspContract.value.clientName || '',
      monthKey: maintInspMonthKey.value,
      checkedBy: maintInspCheckedBy.value,
      date: maintInspDate.value,
      checklistResults: maintInspResults.value,
    }
    const newInspId = await addMaintInspection(inspData)
    ui.success('Inspection saved.')
    showMaintInspectionModal.value = false
    // Generate and store PDF in background
    try {
      const savedInsp = { ...inspData, id: newInspId }
      await generateMaintInspectionPdf(savedInsp)
    } catch {}
  } catch (e) {
    ui.error('Failed to save inspection.')
  } finally {
    savingMaintInspection.value = false
  }
}

function _buildInspectionSectionRows(results, section, colType) {
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

async function generateMaintInspectionPdf(inspection) {
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
    const sectionARows = _buildInspectionSectionRows(results, 'A', 'ok_notok')
    const sectionBRows = _buildInspectionSectionRows(results, 'B', 'done')
    const sectionCRows = _buildInspectionSectionRows(results, 'C', 'done')
    const sectionDRows = _buildInspectionSectionRows(results, 'D', 'ok_notok')
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
      try { await editMaintInspection(inspection.id, { receiptUrl: retrieveUrl }) } catch {}
    }
    ui.success('Inspection PDF downloaded.')
  } catch (e) {
    ui.error('Failed to generate inspection PDF: ' + (e?.message || e))
  }
}

// ── Search / Filter ──────────────────────────────────────────────────
const search = ref('')
const statusTab = ref('')
const typeFilter = ref('')
const comprehensiveFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const pageSize = 25
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }

watch([() => ui.pendingAutoOpen, items], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== Collections.MAINTENANCE) return
  const record = items.value.find(r => r.id === pending.recordId)
  if (record) { openView(record); ui.clearPendingAutoOpen() }
})

const confirmRef = ref(null)
let pendingDeleteId = null

// ── AMC section state ────────────────────────────────────────────────
const amcContractSearch = ref('')
const filteredAmcContracts = computed(() => {
  const q = amcContractSearch.value.toLowerCase().trim()
  if (!q) return amcContracts.value
  return amcContracts.value.filter(c =>
    (c.clientName || '').toLowerCase().includes(q) ||
    (c.contractNumber || '').toLowerCase().includes(q) ||
    (getProjectName(c.projectId) || '').toLowerCase().includes(q)
  )
})
const showAmcSection = ref(true)
const expandedContracts = ref({})
const showAmcVisitModal = ref(false)
const editingAmcVisit = ref(null)
const savingVisit = ref(false)
const amcVisitContract = ref(null)
const confirmVisitRef = ref(null)
let pendingDeleteVisitId = null

const amcVisitEmptyForm = () => ({
  contractId: '', scheduledDate: '', technicianName: '',
  status: 'scheduled', completedDate: '', notes: '',
})
const amcVisitForm = ref(amcVisitEmptyForm())

// ── Month Completion Modal ────────────────────────────────────────────
const showMonthCompletionModal = ref(false)
const monthCompletionContract = ref(null)
const savingMonthCompletion = ref(false)
const currentYear = new Date().getFullYear()
const monthNames = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
]
const monthCompletionEmptyForm = () => ({
  month: new Date().getMonth() + 1,
  year: currentYear,
  date: new Date().toISOString().split('T')[0],
  technicianName: '',
  buildingName: '',
  wingName: '',
  liftNo: '',
  remarks: '',
  signatoryName: '',
  signatoryDesignation: '',
  signature: '',
  signatureImage: '',
})
const monthCompletionForm = ref(monthCompletionEmptyForm())

// Lift selector state for Month Completion modal
const monthCompletionLiftSelection = ref({ buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] })
const projectForMonth = computed(() => projects.value.find(p => p.id === monthCompletionContract.value?.projectId) || null)

watch(monthCompletionLiftSelection, (v) => {
  if (!v) return
  monthCompletionForm.value.buildingName = (v.buildings && v.buildings.length) ? v.buildings[0] : ''
  monthCompletionForm.value.wingName = (v.wings && v.wings.length) ? v.wings[0] : ''
  monthCompletionForm.value.liftNo = (v.liftIds && v.liftIds.length) ? v.liftIds[0] : ''
}, { deep: true })

// ── Lift selector for schedule maintenance form ──────────────────────
const maintLiftSelection = ref({ buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] })
const projectForMaint = computed(() => projects.value.find(p => p.id === form.value.projectId) || null)

watch(maintLiftSelection, (v) => {
  if (!v) return
  if (v.liftIds?.length) form.value.elevatorId = v.liftIds[0]
  form.value.liftSelection = { ...v }
}, { deep: true })

// ── Project link for maintenance form ───────────────────────────────
const maintUseProject = ref(false)
const maintProjectSearch = ref('')
const maintShowProjectDropdown = ref(false)

const maintFilteredProjects = computed(() => {
  const q = maintProjectSearch.value.toLowerCase()
  return projects.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) ||
    (p.clientName || '').toLowerCase().includes(q)
  )
})

function selectMaintProject(p) {
  form.value.projectId = p.id
  form.value.clientName = p.clientName || ''
  form.value.location = p.address || p.city || ''
  maintProjectSearch.value = p.projectName
  maintShowProjectDropdown.value = false

  // Pre-fill from linked AMC contract if one exists
  const linkedAmc = amcContracts.value.find(c => c.projectId === p.id)
  if (linkedAmc) {
    form.value.comprehensiveType = linkedAmc.isComprehensive === false ? 'non-comprehensive' : 'comprehensive'
    if (linkedAmc.frequency) form.value.maintenanceType = linkedAmc.frequency === 'monthly' ? 'routine' : 'preventive'
    const liftSel = linkedAmc.liftSelection
    if (liftSel?.liftIds?.length) form.value.elevatorId = liftSel.liftIds[0]
    else if (liftSel?.wings?.length) form.value.elevatorId = liftSel.wings[0]
  }
}
function maintDelayCloseDropdown() {
  setTimeout(() => { maintShowProjectDropdown.value = false }, 200)
}

const today = new Date().toISOString().slice(0, 10)

const technicians = computed(() => employees.items.value.filter(e => e.role === 'technician' || e.designation?.toLowerCase().includes('tech')))

const emptyForm = () => ({
  projectId: '', clientName: '', location: '', elevatorId: '', maintenanceType: '',
  comprehensiveType: '', technicianName: '', status: 'scheduled',
  scheduledDate: '', completedDate: '', workPerformed: '',
  partsUsed: '', nextServiceDate: '', remarks: '',
})
const form = ref(emptyForm())

const columns = [
  { key: 'client', label: 'Client' },
  { key: 'elevator', label: 'Elevator' },
  { key: 'type', label: 'Type' },
  { key: 'technician', label: 'Technician' },
  { key: 'dates', label: 'Scheduled / Done' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', width: '130px' },
]

const isOverdue = (row) => (row.status || 'scheduled') !== 'completed' && row.scheduledDate && row.scheduledDate < today

const filtered = computed(() => items.value.filter(m => {
  if (statusTab.value === 'overdue') {
    if (!isOverdue(m)) return false
  } else if (statusTab.value && (m.status || 'scheduled') !== statusTab.value) return false
  const q = search.value.toLowerCase()
  if (q && !m.clientName?.toLowerCase().includes(q) && !m.elevatorId?.toLowerCase().includes(q) && !m.location?.toLowerCase().includes(q) && !(getProjectName(m.projectId) || '').toLowerCase().includes(q)) return false
  if (typeFilter.value && m.maintenanceType !== typeFilter.value) return false
  if (comprehensiveFilter.value && m.comprehensiveType !== comprehensiveFilter.value) return false
  if (dateFrom.value && m.scheduledDate && m.scheduledDate < dateFrom.value) return false
  if (dateTo.value && m.scheduledDate && m.scheduledDate > dateTo.value) return false
  return true
}))

const pagedItems = computed(() => {
  const s = (page.value - 1) * pageSize
  return filtered.value.slice(s, s + pageSize)
})

const pendingCount = computed(() => items.value.filter(m => (m.status || 'scheduled') === 'scheduled').length)
const overdueCount = computed(() => items.value.filter(isOverdue).length)

// ── AMC helpers ───────────────────────────────────────────────────────
function toggleContractExpand(id) {
  expandedContracts.value[id] = !expandedContracts.value[id]
}
function getContractVisits(contractId) {
  return amcMonthlyRecords.value.filter(r => r.contractId === contractId)
    .sort((a, b) => (b.monthKey || b.scheduledDate || '').localeCompare(a.monthKey || a.scheduledDate || ''))
}
function isCurrentMonthLogged(contractId) {
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return amcMonthlyRecords.value.some(r => r.contractId === contractId && r.monthKey === currentMonthKey)
}
function openAmcVisit(contract) {
  editingAmcVisit.value = null
  amcVisitContract.value = contract
  amcVisitForm.value = amcVisitEmptyForm()
  amcVisitForm.value.contractId = contract.id
  showAmcVisitModal.value = true
}
function openEditAmcVisit(visit, contract) {
  editingAmcVisit.value = visit
  amcVisitContract.value = contract
  amcVisitForm.value = { ...amcVisitEmptyForm(), ...visit }
  showAmcVisitModal.value = true
}
async function saveAmcVisit() {
  if (!amcVisitForm.value.contractId) { ui.error('Contract is required.'); return }
  savingVisit.value = true
  try {
    if (editingAmcVisit.value) {
      await editAmcVisit(editingAmcVisit.value.id, amcVisitForm.value)
      ui.success('Visit updated')
    } else {
      await addAmcVisit({ ...amcVisitForm.value, createdAt: new Date() })
      ui.success('Visit logged')
    }
    showAmcVisitModal.value = false
  } catch { ui.error('Save failed') }
  finally { savingVisit.value = false }
}
async function markAmcVisitComplete(visit) {
  const now = new Date()
  await editAmcVisit(visit.id, {
    status: 'completed',
    completedDate: today,
    completedAt: now,
    completedBy: auth.user?.fullName || auth.user?.username || '',
  })
  ui.success('Marked complete')
}
function deleteAmcVisit(visit) {
  pendingDeleteVisitId = visit.id
  confirmVisitRef.value?.open('Delete this maintenance visit?')
}
async function doDeleteAmcVisit() {
  await delAmcVisit(pendingDeleteVisitId)
  ui.success('Visit deleted')
}

function openMonthCompletion(contract) {
  monthCompletionContract.value = contract
  monthCompletionForm.value = monthCompletionEmptyForm()
  // Pre-fill technician for technician role
  if (auth.role === 'technician') {
    const myName = auth.user?.fullName || auth.user?.username || ''
    monthCompletionForm.value.technicianName = myName
  }
  // initialize lift selector from contract's saved selection when available
  const saved = contract?.liftSelection
  if (saved) {
    monthCompletionLiftSelection.value = {
      buildingIndexes: saved.buildingIndexes || [],
      wingKeys: saved.wingKeys || [],
      liftIds: saved.liftIds || [],
      buildings: saved.buildings || [],
      wings: saved.wings || [],
    }
  } else {
    monthCompletionLiftSelection.value = { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] }
  }
  showMonthCompletionModal.value = true
}

function handleMonthSigImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { monthCompletionForm.value.signatureImage = ev.target.result }
  reader.readAsDataURL(file)
  e.target.value = ''
}

async function saveMonthCompletion() {
  const form = monthCompletionForm.value
  const contract = monthCompletionContract.value
  if (!form.month || !form.year) { ui.error('Month and year are required.'); return }
  if (!form.technicianName) { ui.error('Technician name is required.'); return }
  savingMonthCompletion.value = true
  try {
    const monthKey = `${form.year}-${String(form.month).padStart(2, '0')}`
    // For technicians lock date to today
    const visitDate = isTech.value ? new Date().toISOString().split('T')[0] : form.date
    const completedAt = new Date()
    const logData = {
      contractId: contract.id,
      clientName: contract.clientName,
      clientAddress: contract.clientAddress || '',
      contractNumber: contract.contractNumber || '',
      monthKey,
      date: visitDate,
      technician: form.technicianName,
      technicianName: form.technicianName,
      buildingName: form.buildingName || '',
      wingName: form.wingName || '',
      liftNo: form.liftNo || '',
      remarks: form.remarks,
      signatoryName: form.signatoryName,
      signatoryDesignation: form.signatoryDesignation,
      signature: form.signature,
      signatureImage: form.signatureImage || '',
      loggedAt: completedAt,
      completedAt,
      completedBy: auth.user?.fullName || auth.user?.username || '',
      // For MaintenanceView visit tracker compatibility
      scheduledDate: visitDate,
      status: 'completed',
      completedDate: visitDate,
    }
    const newLogId = await addAmcVisit(logData)
    notifyWorker('amc_monthly_completed', { ...logData, id: newLogId, status: 'completed' }, { status: 'pending' })
    ui.success('Month marked as completed.')
    try {
      const receiptUrl = await generateAmcReceipt(logData)
      if (receiptUrl && newLogId) await editAmcVisit(newLogId, { receiptUrl })
    } catch (e) {
      console.error('[AMC] Receipt generation failed:', e)
      ui.warning('Month saved but receipt PDF could not be generated.')
    }
    showMonthCompletionModal.value = false
  } catch (e) {
    ui.error('Failed to save completion.')
  } finally {
    savingMonthCompletion.value = false
  }
}

function _buildMaintReceiptHtml(log, company) {
  const headerUrl = company?.headerUrl || company?.logoUrl || ''
  const footerUrl = company?.footerUrl || ''
  const companyName = company?.name || 'S.K Elevators'
  const dateStr = log.date
    ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const completedTs = log.completedAt?.toDate?.() || (log.completedAt ? new Date(log.completedAt) : null)
  const completedStr = completedTs ? completedTs.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const sigSrc = log.signatureImage?.startsWith('data:image') ? log.signatureImage
               : log.signature?.startsWith('data:image') ? log.signature : null
  const building = [log.buildingName, log.wingName, log.liftNo ? 'Lift ' + log.liftNo : ''].filter(Boolean).join(' · ')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;}
    .page{width:210mm;min-height:297mm;background:#fff;}
    .header-img,.footer-img{width:100%;display:block;}
    .footer-img{position:fixed;bottom:0;left:0;}
    .content{padding:16mm 20mm 24mm;}
    h1{font-size:16px;font-weight:700;color:#1e3a5f;margin-bottom:4px;}
    .sub{font-size:11px;color:#64748b;margin-bottom:18px;}
    .sec{font-size:10px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;
         border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
    .item label{font-size:10px;color:#64748b;display:block;}
    .item span{font-size:12px;font-weight:600;color:#1e293b;}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:12px;color:#374151;}
    .sig-box{border:1px solid #e2e8f0;border-radius:6px;padding:12px;min-height:100px;}
    .sig-box img{max-height:80px;}
    .sig-name{font-weight:700;font-size:12px;margin-top:8px;border-top:1px solid #cbd5e1;padding-top:6px;}
    .sig-desg{font-size:10px;color:#64748b;}
  </style></head><body><div class="page">
  ${headerUrl ? `<img class="header-img" src="${headerUrl}"/>` : `<div style="background:#1e3a5f;padding:14px 20mm;color:#fff;font-size:14px;font-weight:700;">${companyName}</div>`}
  <div class="content">
    <h1>AMC Maintenance Service Report</h1>
    <div class="sub">Contract: ${log.contractNumber || '—'} &nbsp;|&nbsp; Month: ${log.monthKey || '—'} &nbsp;|&nbsp; Date: ${dateStr}</div>
    <div class="sec">Visit Details</div>
    <div class="grid">
      <div class="item"><label>Client Name</label><span>${log.clientName || '—'}</span></div>
      <div class="item"><label>Contract No.</label><span>${log.contractNumber || '—'}</span></div>
      <div class="item"><label>Visit Date</label><span>${dateStr}</span></div>
      <div class="item"><label>Month</label><span>${log.monthKey || '—'}</span></div>
      <div class="item"><label>Technician</label><span>${log.technician || log.technicianName || '—'}</span></div>
      <div class="item"><label>Address</label><span>${log.clientAddress || '—'}</span></div>
      ${building ? `<div class="item"><label>Building / Wing</label><span>${building}</span></div>` : ''}
      ${completedStr ? `<div class="item"><label>Completed At</label><span>${completedStr}</span></div>` : ''}
      <div class="item"><label>Completed By</label><span>${log.completedBy || '—'}</span></div>
    </div>
    <div class="sec">Work Done / Remarks</div>
    <div class="box">${log.remarks || 'Routine maintenance completed as per schedule.'}</div>
    <div class="sec">Customer Acknowledgement</div>
    <div class="sig-box">
      ${sigSrc ? `<img src="${sigSrc}"/>` : '<div style="color:#94a3b8;font-size:11px;padding:12px 0;">[ Signature not provided ]</div>'}
      <div class="sig-name">${log.signatoryName || '—'}</div>
      <div class="sig-desg">${log.signatoryDesignation || '—'}</div>
    </div>
  </div>
  ${footerUrl ? `<img class="footer-img" src="${footerUrl}"/>` : ''}
  </div></body></html>`
}

async function generateAmcReceipt(log) {
  const ctx = await _getCtx()
  const html = _buildMaintReceiptHtml(log, ctx?.company)
  const filename = `AMC-Receipt-${log.contractNumber || log.clientName}-${log.monthKey}.pdf`
  const url = await convertHtmlToPdf(html, filename, log.contractNumber || 'receipt')
  triggerDownload(url, filename)
  return url
}

async function shareVisitOnWhatsApp(visit, phone) {
  const chatUrl = whatsAppChatUrl(phone, buildCompletionMessage(visit.monthKey))
  if (!chatUrl) {
    ui.error('No valid phone number saved for this client. Add one in the AMC contract.')
    return
  }
  try {
    if (visit.receiptUrl) {
      triggerMaintDownload(visit.receiptUrl, 'AMC-Receipt-' + (visit.contractNumber || visit.clientName) + '-' + visit.monthKey + '.pdf')
    } else {
      await generateAmcReceipt(visit)
    }
  } catch { ui.error('Could not generate receipt.') }
  window.open(chatUrl, '_blank')
  ui.info('WhatsApp opened — attach the downloaded receipt in the chat.')
}

// ── Completion modal ──────────────────────────────────────────────────
const showCompletionModal = ref(false)
const completionTarget = ref(null)
const savingCompletion = ref(false)

const completionEmptyForm = () => ({
  completedDate: new Date().toISOString().split('T')[0],
  technicianName: '',
  buildingName: '',
  wingName: '',
  workPerformed: '',
  partsUsed: '',
  remarks: '',
  signatoryName: '',
  signatoryDesignation: '',
  signature: '',
  signatureImage: '',
})
const completionForm = ref(completionEmptyForm())
const completionLiftSel = ref({ buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] })
const projectForCompletion = computed(() => projects.value.find(p => p.id === completionTarget.value?.projectId) || null)

watch(completionLiftSel, (v) => {
  if (!v) return
  completionForm.value.buildingName = v.buildings?.length ? v.buildings[0] : ''
  completionForm.value.wingName = v.wings?.length ? v.wings[0] : ''
}, { deep: true })

function openCompletion(row) {
  completionTarget.value = row
  completionForm.value = completionEmptyForm()
  completionForm.value.technicianName = row.technicianName || ''
  if (isTech.value) {
    completionForm.value.technicianName = auth.user?.fullName || auth.user?.username || completionForm.value.technicianName
  }
  // Pre-fill lift selection from saved data
  const saved = row.liftSelection
  if (saved) {
    completionLiftSel.value = {
      buildingIndexes: saved.buildingIndexes || [],
      wingKeys: saved.wingKeys || [],
      liftIds: saved.liftIds || [],
      buildings: saved.buildings || [],
      wings: saved.wings || [],
    }
  } else {
    completionLiftSel.value = { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] }
  }
  showCompletionModal.value = true
}

function handleCompletionSigImage(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { completionForm.value.signatureImage = ev.target.result }
  reader.readAsDataURL(file)
  e.target.value = ''
}

async function saveCompletion() {
  const f = completionForm.value
  const row = completionTarget.value
  if (!f.technicianName) { ui.error('Technician name is required.'); return }
  savingCompletion.value = true
  try {
    const completedDate = isTech.value ? today : (f.completedDate || today)
    const updates = {
      status: 'completed',
      completedDate,
      completedAt: new Date(),
      completedBy: auth.user?.fullName || auth.user?.username || '',
      technicianName: f.technicianName,
      workPerformed: f.workPerformed,
      partsUsed: f.partsUsed,
      remarks: f.remarks,
      buildingName: f.buildingName || '',
      wingName: f.wingName || '',
      signatoryName: f.signatoryName,
      signatoryDesignation: f.signatoryDesignation,
      signature: f.signature,
      signatureImage: f.signatureImage || '',
    }
    await edit(row.id, updates, {
      action: 'completed',
      module: 'maintenance',
      tab: 'Maintenance',
      summary: `Marked maintenance complete for ${row.clientName}`,
      details: { clientName: row.clientName, elevatorId: row.elevatorId, completedDate },
    })
    ui.success('Maintenance marked as completed.')
    showCompletionModal.value = false
  } catch { ui.error('Failed to save completion.') }
  finally { savingCompletion.value = false }
}

// ── Regular maintenance CRUD ──────────────────────────────────────────
function openAdd() {
  editing.value = null
  maintUseProject.value = false
  maintProjectSearch.value = ''
  maintLiftSelection.value = { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] }
  form.value = emptyForm()
  showModal.value = true
}
function openEdit(row) {
  editing.value = row
  maintUseProject.value = !!row.projectId
  if (row.projectId) {
    const proj = projects.value.find(p => p.id === row.projectId)
    maintProjectSearch.value = proj?.projectName || ''
  } else {
    maintProjectSearch.value = ''
  }
  const saved = row.liftSelection
  if (saved) {
    maintLiftSelection.value = {
      buildingIndexes: saved.buildingIndexes || [],
      wingKeys: saved.wingKeys || [],
      liftIds: saved.liftIds || [],
      buildings: saved.buildings || [],
      wings: saved.wings || [],
    }
  } else {
    maintLiftSelection.value = { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] }
  }
  form.value = { ...emptyForm(), ...row }
  showModal.value = true
}

async function save() {
  if (!form.value.clientName.trim()) return ui.error('Client name required')
  saving.value = true
  try {
    if (editing.value) {
      await edit(editing.value.id, form.value, { action: 'updated', module: 'maintenance', tab: 'Maintenance', summary: `Updated maintenance record for ${form.value.clientName}`, details: { clientName: form.value.clientName, maintenanceType: form.value.maintenanceType, status: form.value.status } })
      ui.success('Maintenance updated')
    } else {
      await add(form.value, { action: 'created', module: 'maintenance', tab: 'Maintenance', summary: `Scheduled maintenance for ${form.value.clientName}`, details: { clientName: form.value.clientName, maintenanceType: form.value.maintenanceType, scheduledDate: form.value.scheduledDate } })
      ui.success('Maintenance scheduled')
    }
    showModal.value = false
  } catch { ui.error('Save failed') }
  finally { saving.value = false }
}

function confirmDel(row) {
  pendingDeleteId = row.id
  confirmRef.value?.open(`Delete maintenance record for "${row.clientName}"?`)
}
async function doDelete() {
  const row = items.value.find(r => r.id === pendingDeleteId)
  await del(pendingDeleteId, { action: 'deleted', module: 'maintenance', tab: 'Maintenance', summary: `Deleted maintenance record for ${row?.clientName || pendingDeleteId}`, details: { clientName: row?.clientName, maintenanceType: row?.maintenanceType } })
  ui.success('Record deleted')
}

// ── Badges / Helpers ─────────────────────────────────────────────────
const typeBadge = (t) => ({ routine: 'badge-info', preventive: 'badge-blue', emergency: 'badge-danger', annual: 'badge-purple' }[t] || 'badge-inactive')
const statusBadge = (s) => ({ scheduled: 'badge-warning', 'in-progress': 'badge-info', completed: 'badge-active', overdue: 'badge-danger', cancelled: 'badge-inactive' }[s] || 'badge-inactive')
const visitStatusBadge = statusBadge
const contractStatusBadge = (s) => ({ active: 'badge-active', expired: 'badge-danger', expiring: 'badge-warning', cancelled: 'badge-inactive' }[s] || 'badge-inactive')
function formatDate(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}

// ── Bulk Export ───────────────────────────────────────────────────────────────
function triggerExport(type) {
  showExportDialog({
    rows: items.value,
    dateField: 'scheduledDate',
    columns: ['Client', 'Location', 'Elevator ID', 'Type', 'Technician', 'Scheduled Date', 'Status'],
    title: 'Maintenance Records Report',
    filename: 'maintenance-records',
    accent: [99, 102, 241],
    ui,
    pdfRowMapper: m => [
      m.clientName || '—',
      m.location || '—',
      m.elevatorId || m.elevatorNumber || '—',
      m.maintenanceType || '—',
      m.technicianName || '—',
      formatDate(m.scheduledDate),
      m.status || 'scheduled',
    ],
    excelRowMapper: m => [
      m.clientName || '—',
      m.location || '—',
      m.elevatorId || m.elevatorNumber || '—',
      m.maintenanceType || '—',
      m.technicianName || '—',
      formatDate(m.scheduledDate),
      m.status || 'scheduled',
    ],
  })
  if (type) expType.value = type
}
</script>

<style scoped>
.page-container { padding: 28px; }
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
@media (max-width: 640px) {
  .amc-contract-header { flex-wrap: wrap; }
  .amc-contract-header .contract-dates { display: none; }
  .amc-contract-header .contract-info { min-width: 0; max-width: calc(100% - 80px); }
}
</style>
