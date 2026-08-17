<template>
  <div class="projects-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <FolderKanban :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Projects
        </h1>
        <p class="page-sub">From first quote to final handover — every project, every detail.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-secondary btn-sm" @click="triggerExport('pdf')"><FileDown :size="14" /> PDF</button>
        <button class="btn-secondary btn-sm" @click="triggerExport('excel')"><FileSpreadsheet :size="14" /> Excel</button>
        <button class="btn-secondary btn-sm" @click="showImportModal = true">
          <Upload :size="14" /> Bulk Import
        </button>
        <button v-if="authStore.can('canCreateService')" class="btn-primary" @click="openAdd">
          <Plus :size="16" /> New Project
        </button>
      </div>
    </div>

    <!-- Filters Row -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search by project name or client…" />
      </div>
      <select v-model="filterStatus" class="input" style="width:160px;">
        <option value="">All Statuses</option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <select v-model="filterType" class="input" style="width:190px;">
        <option value="">All Types</option>
        <option v-for="t in projectTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filterLiftType" class="input" style="width:180px;">
        <option value="">All Lift Types</option>
        <option v-for="t in elevatorTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filterControllerType" class="input" style="width:190px;">
        <option value="">All Controllers</option>
        <option v-for="t in driveTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filterDoorType" class="input" style="width:175px;">
        <option value="">All Door Types</option>
        <option v-for="t in doorTypeOptions" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filterMachineRoom" class="input" style="width:175px;">
        <option value="">All Machine Rooms</option>
        <option v-for="t in machineRoomOptions" :key="t" :value="t">{{ t }}</option>
      </select>
      <button v-if="filterLiftType || filterControllerType || filterDoorType || filterMachineRoom" @click="clearLiftFilters" class="btn btn-ghost" style="font-size:12px;padding:6px 10px;">
        Clear Lift Filters
      </button>
      <div class="tabs-nav" style="border-radius:12px;padding:4px;">
        <button :class="['tab-btn', viewMode === 'cards' && 'active']" @click="viewMode = 'cards'">
          <LayoutGrid :size="14" />
        </button>
        <button :class="['tab-btn', viewMode === 'table' && 'active']" @click="viewMode = 'table'">
          <List :size="14" />
        </button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px;">
      <div v-for="stat in statusStats" :key="stat.label" class="glass" style="padding:16px;text-align:center;">
        <div :style="`font-size:22px;font-weight:700;color:${stat.color};`">{{ stat.count }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Cards View -->
    <div v-if="viewMode === 'cards'" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
      <div v-if="loading" v-for="i in 6" :key="i" class="glass" style="padding:24px;min-height:180px;opacity:.4;"></div>
      <div v-else-if="!pagedProjects.length" class="glass form-full" style="padding:60px;text-align:center;color:var(--ct-muted);grid-column:1/-1;">
        <FolderOpen :size="40" style="opacity:.3;margin:0 auto 12px;" />
        <p>No projects found.</p>
      </div>
      <div
        v-else
        v-for="proj in pagedProjects"
        :key="proj.id"
        class="glass glass-hover"
        style="padding:22px;cursor:pointer;"
        @click="openView(proj)"
      >
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;">
          <div style="flex:1;min-width:0;">
            <div class="db-s" style="font-weight:600;color:var(--ct-primary);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ proj.projectName }}</div>
            <div class="db-s" style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ (proj.clients && proj.clients[0]?.name) || proj.clientName || '—' }}{{ proj.clients && proj.clients.length > 1 ? ` +${proj.clients.length - 1} more` : '' }}</div>
          </div>
          <span :class="['badge', statusBadge(proj.status)]">{{ proj.status }}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div>
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Type</div>
            <div style="font-size:12px;color:var(--ct-sub);margin-top:2px;">{{ proj.type }}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Value</div>
            <div style="font-size:12px;color:var(--ct-accent);margin-top:2px;font-weight:600;">{{ formatCurrency(proj.value) }}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">City</div>
            <div style="font-size:12px;color:var(--ct-sub);margin-top:2px;">{{ proj.city || '—' }}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">Client</div>
            <div class="db-s" style="font-size:12px;color:var(--ct-sub);margin-top:2px;">{{ (proj.clients && proj.clients[0]?.name) || proj.clientName || '—' }}</div>
            <div v-if="(proj.clients && proj.clients[0]?.phone) || proj.clientPhone" class="db-s" style="font-size:11px;color:var(--ct-muted);">{{ (proj.clients && proj.clients[0]?.phone) || proj.clientPhone }}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--ct-muted);margin-bottom:10px;">
          {{ getTotalLifts(proj) }} lift(s) &bull; {{ getBuildingSummary(proj) }}
        </div>
        <hr class="divider" style="margin:10px 0;" />
        <div style="display:flex;gap:8px;justify-content:flex-end;" @click.stop>
          <button class="btn-secondary btn-sm" style="color:#4ade80;" @click="scheduleTargetProject = proj; showScheduleDialog = true" title="Create Services"><Zap :size="12" /> Services</button>
          <button class="btn-secondary btn-sm" @click="openEdit(proj)"><Pencil :size="12" /> Edit</button>
          <button class="btn-secondary btn-sm" style="color:#818cf8;" @click="timelineProject = proj; showTimeline = true" title="Activity Timeline"><History :size="12" /></button>
          <button v-if="authStore.can('canDelete')" class="btn-danger btn-sm" @click="confirmDelete(proj)"><Trash2 :size="12" /></button>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <DataTable
      v-if="viewMode === 'table'"
      :columns="columns"
      :rows="pagedProjects"
      :loading="loading"
      :total="filteredProjects.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No projects found."
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div class="db-s" style="font-weight:500;color:var(--ct-primary);">{{ row.projectName }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ row.city }}</div>
        </td>
        <td>
          <div class="db-s" style="color:var(--ct-sub);">{{ (row.clients && row.clients[0]?.name) || row.clientName || '—' }}</div>
          <div class="db-s" style="font-size:11px;color:var(--ct-muted);">{{ (row.clients && row.clients[0]?.phone) || row.clientPhone || '' }}</div>
        </td>
        <td><span class="badge badge-info">{{ row.type }}</span></td>
        <td><span :class="['badge', statusBadge(row.status)]">{{ row.status }}</span></td>
        <td style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.value) }}</td>
        <td style="color:var(--ct-muted);font-size:12px;">{{ row.projectManager || '—' }}</td>
        <td style="color:var(--ct-muted);font-size:12px;">{{ row.startDate ? formatDate(row.startDate) : '—' }}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-secondary btn-sm" @click="openView(row)" title="View Details"><Eye :size="12" /></button>
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <button class="btn-secondary btn-sm" style="color:#818cf8;" @click="timelineProject = row; showTimeline = true" title="Timeline"><History :size="12" /></button>
            <button v-if="authStore.can('canDelete')" class="btn-danger btn-sm" @click="confirmDelete(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Pagination for cards -->
    <div v-if="viewMode === 'cards' && filteredProjects.length > pageSize" style="display:flex;justify-content:center;gap:8px;margin-top:20px;">
      <button class="btn-secondary btn-sm" :disabled="page <= 1" @click="page--"><ChevronLeft :size="14" /></button>
      <span style="font-size:13px;color:var(--ct-muted);padding:6px 12px;">{{ page }} / {{ totalPages }}</span>
      <button class="btn-secondary btn-sm" :disabled="page >= totalPages" @click="page++"><ChevronRight :size="14" /></button>
    </div>

    <!-- View Project Detail -->
    <AppModal v-model="showViewModal" title="Project Details" subtitle="Read-only view" width="800px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:18px;">
        <!-- Header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:16px 20px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:16px;">
          <div>
            <div style="font-size:18px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.projectName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:4px;">{{ viewTarget.type }} · {{ viewTarget.city || '—' }}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <span :class="['badge', statusBadge(viewTarget.status)]">{{ viewTarget.status }}</span>
            <span style="font-size:15px;font-weight:700;color:var(--ct-accent);">{{ formatCurrency(viewTarget.value) }}</span>
          </div>
        </div>
        <!-- Main details -->
        <div class="form-grid">
          <div class="form-group">
            <div class="label">Project Manager</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;">{{ viewTarget.projectManager || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Start Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.startDate ? formatDate(viewTarget.startDate) : '—' }}</div>
          </div>
          <div v-if="viewTarget.fileNumber" class="form-group">
            <div class="label">File Number</div>
            <div style="color:var(--ct-accent);font-size:13px;font-weight:600;margin-top:4px;">{{ viewTarget.fileNumber }}</div>
          </div>
          <div class="form-group form-full" v-if="viewTarget.address">
            <div class="label">Address</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.address }}</div>
          </div>
          <div class="form-group form-full">
            <div class="label">Lifts Summary</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;">{{ getTotalLifts(viewTarget) }} lift(s) · {{ getBuildingSummary(viewTarget) }}</div>
          </div>
        </div>
        <!-- Clients -->
        <div>
          <div class="label" style="margin-bottom:10px;">Clients / Contacts</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div v-for="(cl,i) in (viewTarget.clients || (viewTarget.clientName ? [{ name: viewTarget.clientName, phone: viewTarget.clientPhone }] : []))" :key="i"
              style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
              <div style="width:36px;height:36px;border-radius:9px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--ct-accent);flex-shrink:0;">
                {{ (cl.name||'?')[0].toUpperCase() }}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:500;color:var(--ct-primary);font-size:13px;">{{ cl.name || '—' }}</div>
                <div style="font-size:11px;color:var(--ct-muted);">{{ cl.phone || '' }}{{ cl.designation ? ' · ' + cl.designation : '' }}</div>
              </div>
            </div>
            <div v-if="!(viewTarget.clients?.length) && !viewTarget.clientName" style="color:var(--ct-muted);font-size:13px;">No client info</div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-secondary" style="color:#4ade80;" @click="scheduleTargetProject = viewTarget; showScheduleDialog = true; showViewModal = false">
          <Zap :size="14" /> Create Services
        </button>
        <button class="btn-primary" @click="openEdit(viewTarget); showViewModal = false">
          <Pencil :size="14" /> Edit
        </button>
      </template>
    </AppModal>

    <!-- Add / Edit Modal (Wizard) -->
    <AppModal
      v-model="showProjectModal"
      :title="editingProject ? 'Edit Project' : 'New Project'"
      :subtitle="editingProject ? `Editing: ${editingProject.projectName}` : 'Fill in the details below'"
      width="920px"
      persistent
    >
      <!-- Step Indicator (always shown) -->
      <div class="step-indicator" style="margin-bottom:28px;">
        <div v-for="(step, i) in steps" :key="i" style="display:contents;">
          <div :class="['step-dot', wizardStep === i + 1 ? 'active' : wizardStep > i + 1 ? 'done' : '']">
            <Check v-if="wizardStep > i + 1" :size="14" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <div v-if="i < steps.length - 1" :class="['step-line', wizardStep > i + 1 ? 'done' : '']"></div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--ct-accent);margin-bottom:16px;">
        Step {{ wizardStep }}: {{ steps[wizardStep - 1] }}
      </div>

      <!-- Step 1: Project Details -->
      <div v-if="wizardStep === 1">
        <div class="form-grid">
          <div class="form-group">
            <label class="label">Project Name *</label>
            <input v-model="form.projectName" class="input" placeholder="e.g. Skyline Tower Lift Installation" />
          </div>
          <div class="form-group">
            <label class="label">File Number <span style="font-weight:400;font-size:10px;color:var(--ct-muted);">optional</span></label>
            <input v-model="form.fileNumber" class="input" placeholder="e.g. ARK-2024-001" />
          </div>
          <div class="form-group">
            <label class="label">Project Type *</label>
            <select v-model="form.type" class="input">
              <option value="">Select type</option>
              <option v-for="t in projectTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">Status</label>
            <select v-model="form.status" class="input">
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div v-if="form.status === 'discontinued'" class="form-group form-full">
            <label class="label">Discontinuation Reason / Remark</label>
            <input v-model="form.discontinuedReason" class="input" placeholder="Reason for discontinuing this project…" />
          </div>
          <!-- Multi-client box -->
          <div class="form-group form-full">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <label class="label" style="margin:0;">Clients *</label>
              <button type="button" class="btn-secondary btn-sm" @click="addClient" style="gap:4px;">
                <Plus :size="12" /> Add Client
              </button>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:14px;background:rgba(255,255,255,0.02);">
              <div v-for="(client, ci) in form.clients" :key="ci" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.12);border-radius:10px;position:relative;">
                <div style="position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:4px;">
                  <span style="font-size:10px;font-weight:700;background:rgba(99,102,241,0.2);color:var(--ct-accent);padding:1px 7px;border-radius:99px;">Contact {{ ci + 1 }}</span>
                  <button v-if="form.clients.length > 1" type="button" @click="removeClient(ci)" style="width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,0.15);border:none;color:#f87171;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;">×</button>
                </div>
                <div style="padding-top:20px;">
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Name *</div>
                  <input v-model="client.name" class="input" placeholder="Full name" style="font-size:12px;padding:7px 10px;" />
                </div>
                <div style="padding-top:20px;">
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Designation</div>
                  <input v-model="client.designation" class="input" placeholder="e.g. Project Manager" style="font-size:12px;padding:7px 10px;" />
                </div>
                <div>
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Phone</div>
                  <input v-model="client.phone" class="input" placeholder="+91 98765 43210" style="font-size:12px;padding:7px 10px;" />
                </div>
                <div>
                  <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Email</div>
                  <input v-model="client.email" class="input" type="email" placeholder="email@example.com" style="font-size:12px;padding:7px 10px;" />
                </div>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="label">Project Value (₹)</label>
            <input v-model.number="form.value" class="input" type="number" min="0" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="label">Advance Amount (₹)</label>
            <input v-model.number="form.advance" class="input" type="number" min="0" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="label">Project Manager</label>
            <input v-model="form.projectManager" class="input" placeholder="Assigned manager name" />
          </div>
          <div class="form-group">
            <label class="label">City</label>
            <input v-model="form.city" class="input" placeholder="e.g. Mumbai" />
          </div>
          <div class="form-group form-full">
            <label class="label">Address</label>
            <textarea v-model="form.address" class="input" rows="2" placeholder="Site address…"></textarea>
          </div>
          <!-- Location / Maps -->
          <div class="form-group form-full">
            <label class="label">Google Maps Link</label>
            <input v-model="form.locationLink" class="input" placeholder="https://maps.google.com/?q=..." />
          </div>
          <div class="form-group">
            <label class="label">Latitude</label>
            <input v-model.number="form.locationLat" class="input" type="number" step="any" placeholder="e.g. 19.0760" />
          </div>
          <div class="form-group">
            <label class="label">Longitude</label>
            <input v-model.number="form.locationLng" class="input" type="number" step="any" placeholder="e.g. 72.8777" />
          </div>
          <div class="form-group">
            <label class="label">Arrival Radius (km)</label>
            <input v-model.number="form.locationRadius" class="input" type="number" min="0.1" step="0.1" placeholder="e.g. 0.5" />
          </div>
          <div class="form-group">
            <label class="label">Start Date</label>
            <input v-model="form.startDate" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Expected Completion</label>
            <input v-model="form.expectedCompletion" class="input" type="date" />
          </div>
          <div class="form-group form-full">
            <label class="label">Description / Notes</label>
            <textarea v-model="form.description" class="input" rows="3" placeholder="Project notes…"></textarea>
          </div>
        </div>
      </div>

      <!-- Step 2: Building Config -->
      <div v-if="wizardStep === 2">
        <!-- Number of buildings control -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:14px 18px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            <label class="label" style="margin:0;white-space:nowrap;">Number of Buildings</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" @click="numBuildings > 1 && (numBuildings--, syncBuildings())" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--ct-primary);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">−</button>
              <span style="min-width:28px;text-align:center;font-size:15px;font-weight:700;color:var(--ct-accent);">{{ numBuildings }}</span>
              <button type="button" @click="numBuildings++; syncBuildings()" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--ct-primary);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">+</button>
            </div>
          </div>
          <div style="font-size:12px;color:var(--ct-muted);line-height:1.5;">
            Each building has wings, each wing has lifts. Lift IDs are auto-generated (e.g. <code style="background:rgba(99,102,241,0.1);color:var(--ct-accent);padding:1px 5px;border-radius:4px;">B1-W1-L01</code>).
          </div>
        </div>

        <!-- Buildings horizontal scroll -->
        <div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;align-items:flex-start;">
          <div
            v-for="(building, bi) in form.buildings"
            :key="bi"
            style="flex:0 0 300px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;min-height:200px;"
          >
            <!-- Building header -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <div style="width:28px;height:28px;background:rgba(99,102,241,0.18);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ct-accent);flex-shrink:0;">B{{ bi+1 }}</div>
              <span style="font-size:13px;font-weight:600;color:var(--ct-primary);">Building {{ bi+1 }}</span>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
              <label class="label" style="font-size:11px;">Building Name *</label>
              <input v-model="building.name" class="input" :placeholder="form.buildings.length === 1 ? 'Main Building' : `Building ${bi + 1}`" style="font-size:12px;padding:7px 10px;" />
            </div>
            <!-- Wing count control -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <label class="label" style="font-size:11px;margin:0;flex:1;">Wings:</label>
              <button type="button" @click="building.wings.length > 1 && syncWings(building, bi, building.wings.length - 1)" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--ct-primary);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">−</button>
              <span style="min-width:20px;text-align:center;font-size:13px;font-weight:600;color:#c084fc;">{{ building.wings.length }}</span>
              <button type="button" @click="syncWings(building, bi, building.wings.length + 1)" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--ct-primary);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</button>
            </div>

            <!-- Wings -->
            <div
              v-for="(wing, wi) in building.wings"
              :key="wi"
              style="background:rgba(168,85,247,0.04);border:1px solid rgba(168,85,247,0.12);border-radius:10px;padding:10px;margin-bottom:10px;"
            >
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <div style="width:20px;height:20px;background:rgba(168,85,247,0.18);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#c084fc;flex-shrink:0;">W{{ wi+1 }}</div>
                <span style="font-size:11px;font-weight:600;color:var(--ct-secondary);">Wing {{ wi+1 }}</span>
              </div>
              <div class="form-group" style="margin-bottom:8px;">
                <label class="label" style="font-size:10px;">Wing Name *</label>
                <input v-model="wing.name" class="input" :placeholder="building.wings.length === 1 ? 'Main Wing' : `Wing ${wi + 1}`" style="font-size:11px;padding:6px 8px;" />
              </div>
              <!-- Lift count + Same for all -->
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <label class="label" style="font-size:10px;margin:0;flex:1;">Lifts:</label>
                <button type="button" @click="wing.lifts.length > 1 && syncLifts(wing, bi, wi, wing.lifts.length - 1)" style="width:18px;height:18px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--ct-primary);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">−</button>
                <span style="min-width:16px;text-align:center;font-size:12px;font-weight:600;color:var(--ct-accent);">{{ wing.lifts.length }}</span>
                <button type="button" @click="syncLifts(wing, bi, wi, wing.lifts.length + 1)" style="width:18px;height:18px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--ct-primary);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</button>
              </div>
              <!-- Same for all toggle -->
              <div v-if="wing.lifts.length > 1" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 8px;background:rgba(99,102,241,0.07);border-radius:7px;border:1px solid rgba(99,102,241,0.15);">
                <button
                  type="button"
                  @click="wing.sameForAll = !wing.sameForAll; wing.sameForAll && applySameForAll(wing)"
                  :style="`width:34px;height:18px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${wing.sameForAll ? '#6366f1' : 'rgba(255,255,255,0.1)'};position:relative;flex-shrink:0;`"
                >
                  <span :style="`position:absolute;top:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:all .2s;left:${wing.sameForAll ? '18px' : '2px'};`"></span>
                </button>
                <span style="font-size:10px;color:var(--ct-accent);font-weight:500;">Same config for all lifts</span>
                <span v-if="wing.sameForAll" style="font-size:9px;color:var(--ct-muted);margin-left:auto;">Editing lift 1 updates all</span>
              </div>

              <!-- Lifts -->
              <div
                v-for="(lift, li) in wing.lifts"
                :key="li"
                v-show="!wing.sameForAll || li === 0"
                style="background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.12);border-radius:8px;padding:8px;margin-bottom:6px;"
              >
                <div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                  <span style="font-size:10px;font-weight:700;background:rgba(99,102,241,0.2);color:var(--ct-accent);padding:2px 8px;border-radius:99px;letter-spacing:.04em;">
                    {{ wing.sameForAll ? 'All Lifts' : lift.id }}
                  </span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Type</div>
                    <select v-model="lift.type" class="input" style="font-size:10px;padding:4px 6px;" @change="wing.sameForAll && li===0 && applySameForAll(wing)">
                      <option value="">—</option>
                      <option v-for="t in elevatorTypes" :key="t" :value="t">{{ t }}</option>
                    </select>
                    <input v-if="lift.type === 'Other'" v-model="lift.typeOther" class="input" placeholder="Specify type…" style="font-size:10px;padding:4px 6px;margin-top:3px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                    <template v-if="lift.type === 'Car Parking System'">
                      <select v-model="lift.parkingSubType" class="input" style="font-size:10px;padding:4px 6px;margin-top:3px;" @change="wing.sameForAll && li===0 && applySameForAll(wing)">
                        <option value="">Sub-type…</option>
                        <option v-for="s in carParkingSubTypes" :key="s" :value="s">{{ s }}</option>
                      </select>
                      <input v-if="lift.parkingSubType === 'Others'" v-model="lift.parkingSubTypeOther" class="input" placeholder="Specify parking type…" style="font-size:10px;padding:4px 6px;margin-top:3px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                    </template>
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Controller Type</div>
                    <select v-model="lift.drive" class="input" style="font-size:10px;padding:4px 6px;" @change="wing.sameForAll && li===0 && applySameForAll(wing)">
                      <option value="">—</option>
                      <option v-for="d in driveTypes" :key="d" :value="d">{{ d }}</option>
                    </select>
                    <input v-if="lift.drive === 'Other'" v-model="lift.driveOther" class="input" placeholder="Specify controller…" style="font-size:10px;padding:4px 6px;margin-top:3px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Capacity (kg)</div>
                    <input v-model="lift.capacity" class="input" placeholder="e.g. 630" style="font-size:10px;padding:4px 6px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Speed (m/s)</div>
                    <input v-model="lift.speed" class="input" placeholder="e.g. 1.0" style="font-size:10px;padding:4px 6px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">OEM / Brand</div>
                    <input v-model="lift.oem" class="input" placeholder="e.g. Otis" style="font-size:10px;padding:4px 6px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Stops</div>
                    <input v-model="lift.stops" class="input" placeholder="e.g. 10" style="font-size:10px;padding:4px 6px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Door Type</div>
                    <select v-model="lift.doorType" class="input" style="font-size:10px;padding:4px 6px;" @change="wing.sameForAll && li===0 && applySameForAll(wing)">
                      <option value="">—</option>
                      <option>Auto Sliding</option>
                      <option>Manual Swing</option>
                      <option>Centre Opening</option>
                      <option>Side Opening</option>
                      <option>Telescopic</option>
                      <option>Other</option>
                    </select>
                    <input v-if="lift.doorType === 'Other'" v-model="lift.doorTypeOther" class="input" placeholder="Specify door type…" style="font-size:10px;padding:4px 6px;margin-top:3px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div>
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Machine Room</div>
                    <select v-model="lift.machineRoom" class="input" style="font-size:10px;padding:4px 6px;" @change="wing.sameForAll && li===0 && applySameForAll(wing)">
                      <option value="">—</option>
                      <option>With MR</option>
                      <option>MRL (No MR)</option>
                      <option>Basement</option>
                      <option>Hydraulic</option>
                      <option>Other</option>
                    </select>
                    <input v-if="lift.machineRoom === 'Other'" v-model="lift.machineRoomOther" class="input" placeholder="Specify machine room…" style="font-size:10px;padding:4px 6px;margin-top:3px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                  <div style="grid-column:1/-1;">
                    <div style="font-size:9px;color:var(--ct-muted);margin-bottom:3px;">Rated Load (persons)</div>
                    <input v-model="lift.ratedLoad" class="input" placeholder="e.g. 8" style="font-size:10px;padding:4px 6px;" @input="wing.sameForAll && li===0 && applySameForAll(wing)" />
                  </div>
                </div>
              </div>
              <div v-if="wing.sameForAll && wing.lifts.length > 1" style="font-size:10px;color:var(--ct-muted);text-align:center;padding:4px 0;">
                +{{ wing.lifts.length - 1 }} more lift(s) — same config applied
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Review -->
      <div v-if="wizardStep === 3">
        <div class="glass" style="padding:20px;border-radius:14px;margin-bottom:16px;">
          <div style="font-size:12px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Project Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div v-for="field in reviewFields" :key="field.key">
              <div style="font-size:11px;color:var(--ct-muted);">{{ field.label }}</div>
              <div style="font-size:13px;color:var(--ct-primary);font-weight:500;margin-top:2px;">{{ reviewValue(field) }}</div>
            </div>
          </div>
          <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
            <div style="font-size:11px;color:var(--ct-muted);margin-bottom:8px;">Clients</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div v-for="(c, ci) in form.clients" :key="ci" style="font-size:12px;color:var(--ct-primary);">
                <span style="font-weight:600;">{{ c.name }}</span>
                <span v-if="c.designation" style="color:var(--ct-muted);"> · {{ c.designation }}</span>
                <span v-if="c.phone" style="color:var(--ct-muted);"> · {{ c.phone }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="glass" style="padding:20px;border-radius:14px;">
          <div style="font-size:12px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Building Configuration</div>
          <div v-if="form.buildings && form.buildings.length" style="display:flex;flex-direction:column;gap:10px;">
            <div v-for="(building, bi) in form.buildings" :key="bi" style="background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.12);border-radius:10px;padding:12px;">
              <div style="font-size:13px;font-weight:600;color:var(--ct-accent);margin-bottom:8px;">
                B{{ bi+1 }} — {{ building.name || `Building ${bi + 1}` }}
              </div>
              <div v-for="(wing, wi) in building.wings" :key="wi" style="margin-bottom:6px;padding-left:10px;border-left:2px solid rgba(168,85,247,0.3);">
                <div style="font-size:11px;color:#c084fc;font-weight:600;margin-bottom:4px;">W{{ wi+1 }} — {{ wing.name || `Wing ${wi + 1}` }}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  <span v-for="lift in wing.lifts" :key="lift.id" style="font-size:10px;background:rgba(99,102,241,0.15);color:var(--ct-accent);padding:2px 8px;border-radius:99px;">
                    {{ lift.id }}{{ lift.type ? ` · ${lift.type}` : '' }}{{ lift.capacity ? ` · ${lift.capacity}kg` : '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else style="font-size:13px;color:var(--ct-muted);">No buildings configured.</div>
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="cancelWizard">Cancel</button>
        <button v-if="wizardStep > 1" class="btn-secondary" @click="wizardStep--">
          <ChevronLeft :size="14" /> Back
        </button>
        <button
          v-if="wizardStep < 3"
          class="btn-primary"
          @click="nextStep"
        >
          Next <ChevronRight :size="14" />
        </button>
        <button
          v-if="wizardStep === 3 && editingProject"
          class="btn-secondary"
          style="color:#4ade80;"
          @click="scheduleTargetProject = { ...form, id: editingProject.id }; showScheduleDialog = true; showProjectModal = false; openedFromLead = false"
        >
          <Zap :size="14" /> Create Services
        </button>
        <SwipeToConfirm
          v-if="wizardStep === 3"
          ref="projectSwipeRef"
          style="width:100%;"
          :label="editingProject ? 'Swipe to update project' : 'Swipe to create project'"
          :done-label="editingProject ? 'Project updated' : 'Project created'"
          :loading="saving"
          @confirm="saveProject"
        />
      </template>
    </AppModal>

    <!-- Bulk Import Modal -->
    <AppModal v-model="showImportModal" title="Bulk Import Projects" subtitle="Import multiple projects via Excel" width="640px">
      <div v-if="!importPreview.length">
        <div class="glass" style="padding:20px;border-radius:12px;margin-bottom:16px;border-color:rgba(99,102,241,0.2);">
          <div style="font-size:13px;color:var(--ct-accent);font-weight:600;margin-bottom:10px;">
            <FileSpreadsheet :size="16" style="display:inline;margin-right:6px;vertical-align:-3px;" />
            Excel Column Headers
          </div>
          <div style="font-size:12px;color:var(--ct-sub);line-height:1.9;margin:0;">
            <span style="color:#f87171;font-weight:600;">* Required:</span>
            <code style="background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px;font-size:11px;color:#f87171;margin:0 4px;">projectName</code>
            <code style="background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px;font-size:11px;color:#f87171;margin:0 4px;">clientName</code>
            <code style="background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px;font-size:11px;color:#f87171;margin:0 4px;">clientPhone</code>
            <br/>
            <span style="color:var(--ct-muted);font-weight:600;">Optional:</span>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">type</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">status</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">clientEmail</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">city</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">address</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">value</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">advance</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">projectManager</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">startDate</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">expectedCompletion</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">lifts</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">floors</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">elevatorType</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">driveType</code>
            <code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--ct-accent);margin:0 2px;">capacity</code>
          </div>
        </div>
        <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:14px;margin-bottom:16px;">
          <div style="font-size:12px;color:#fbbf24;font-weight:600;margin-bottom:6px;">Notes:</div>
          <ul style="font-size:12px;color:var(--ct-sub);margin:0;padding-left:18px;line-height:1.8;">
            <li><span style="color:#f87171;">projectName, clientName, clientPhone are required</span> — rows missing these are skipped</li>
            <li>projectManager is optional</li>
            <li>Date format: YYYY-MM-DD</li>
            <li>Status: active | in-progress | completed | on-hold | cancelled</li>
            <li>Type: New Installation | AMC | Modernisation | Repair</li>
            <li>First row must be the header row — download the sample to get started</li>
          </ul>
        </div>
        <div v-if="importError" style="color:#f87171;font-size:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:10px;border:1px solid rgba(239,68,68,0.18);margin-bottom:12px;">{{ importError }}</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="btn-secondary" @click="downloadSampleExcel">
            <FileSpreadsheet :size="14" /> Download Sample Excel
          </button>
          <label class="btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <Upload :size="14" /> Choose Excel / CSV File
            <input type="file" accept=".xlsx,.xls,.csv" style="display:none;" @change="handleImportFile" />
          </label>
        </div>
      </div>

      <!-- Preview -->
      <div v-else>
        <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-bottom:10px;">
          Preview — {{ importPreview.length }} project(s) ready to import
        </div>
        <div style="max-height:300px;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:rgba(255,255,255,0.04);position:sticky;top:0;">
                <th style="padding:8px 12px;text-align:left;color:var(--ct-muted);font-weight:600;">#</th>
                <th style="padding:8px 12px;text-align:left;color:var(--ct-muted);font-weight:600;">Project Name</th>
                <th style="padding:8px 12px;text-align:left;color:var(--ct-muted);font-weight:600;">Client</th>
                <th style="padding:8px 12px;text-align:left;color:var(--ct-muted);font-weight:600;">Type</th>
                <th style="padding:8px 12px;text-align:left;color:var(--ct-muted);font-weight:600;">Status</th>
                <th style="padding:8px 12px;text-align:left;color:var(--ct-muted);font-weight:600;">City</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in importPreview" :key="i" style="border-top:1px solid rgba(255,255,255,0.05);">
                <td style="padding:7px 12px;color:var(--ct-muted);">{{ i + 1 }}</td>
                <td style="padding:7px 12px;color:var(--ct-primary);font-weight:500;">{{ row.projectName }}</td>
                <td style="padding:7px 12px;color:var(--ct-sub);">{{ row.clientName || '—' }}</td>
                <td style="padding:7px 12px;color:var(--ct-sub);">{{ row.type || '—' }}</td>
                <td style="padding:7px 12px;color:var(--ct-sub);">{{ row.status || '—' }}</td>
                <td style="padding:7px 12px;color:var(--ct-sub);">{{ row.city || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--ct-muted);">
          Review the data above before importing. This cannot be undone easily.
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="importPreview = []; showImportModal = false">Cancel</button>
        <button v-if="importPreview.length" class="btn-secondary" @click="importPreview = []">
          ← Back
        </button>
        <button v-if="importPreview.length" class="btn-primary" @click="doImport" :disabled="importing">
          <Loader2 v-if="importing" :size="14" style="animation:spin 1s linear infinite;" />
          <Upload v-else :size="14" />
          {{ importing ? 'Importing…' : `Import ${importPreview.length} Projects` }}
        </button>
      </template>
    </AppModal>

    <!-- Confirm Delete -->
    <ConfirmDialog ref="confirmRef" title="Delete Project" @confirm="deleteProject" />

    <!-- Activity Timeline -->
    <ActivityTimeline
      v-model="showTimeline"
      :record-id="timelineProject?.id || ''"
      :collection="Collections.PROJECT_TIMELINE"
      :title="`Project — ${timelineProject?.projectName || ''}`"
      :record-summary="`${(timelineProject?.clients && timelineProject.clients[0]?.name) || timelineProject?.clientName || '—'} · ${timelineProject?.type || ''} · Status: ${timelineProject?.status || '—'}`"
    />

  <ExportDialog
    v-model="expDlgVisible"
    v-model:selectedPeriod="expPeriod"
    v-model:exportType="expType"
    :exporting="expRunning"
    @confirm="runExport"
    @cancel="cancelExport"
  />

  <!-- Schedule Service Dialog -->
  <AppModal v-model="showScheduleDialog" title="Schedule a Service?" subtitle="Navigate to a service module with this project pre-filled" width="520px">
    <div v-if="scheduleTargetProject" style="display:flex;flex-direction:column;gap:16px;">
      <div style="padding:14px 18px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:14px;">
        <div style="font-size:15px;font-weight:700;color:var(--ct-primary);">{{ scheduleTargetProject.projectName }}</div>
        <div style="font-size:12px;color:var(--ct-muted);margin-top:4px;">
          {{ scheduleTargetProject.clientName || (scheduleTargetProject.clients && scheduleTargetProject.clients[0]?.name) || '—' }}
          <span v-if="scheduleTargetProject.type"> · {{ scheduleTargetProject.type }}</span>
        </div>
      </div>
      <div style="font-size:13px;color:var(--ct-sub);">Choose which service to schedule for this project. All details will be pre-filled.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button
          class="btn-secondary"
          :style="scheduleTargetProject.type === 'New Installation' ? 'border-color:rgba(99,102,241,0.5);background:rgba(99,102,241,0.1);' : ''"
          @click="scheduleService('installation')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border-radius:12px;position:relative;"
        >
          <span v-if="serviceExists.installation" style="position:absolute;top:-7px;right:-7px;font-size:9px;font-weight:700;background:#10b981;color:#fff;padding:2px 7px;border-radius:99px;">✓ Exists</span>
          <Zap :size="22" style="color:#6366f1;" />
          <span style="font-size:13px;font-weight:600;">Installation</span>
          <span style="font-size:11px;color:var(--ct-muted);">{{ serviceExists.installation ? 'Already scheduled' : 'Log installation activity' }}</span>
        </button>
        <button
          class="btn-secondary"
          :style="scheduleTargetProject.type === 'AMC' ? 'border-color:rgba(16,185,129,0.5);background:rgba(16,185,129,0.08);' : ''"
          @click="scheduleService('amc')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border-radius:12px;position:relative;"
        >
          <span v-if="serviceExists.amc" style="position:absolute;top:-7px;right:-7px;font-size:9px;font-weight:700;background:#10b981;color:#fff;padding:2px 7px;border-radius:99px;">✓ Exists</span>
          <Shield :size="22" style="color:#10b981;" />
          <span style="font-size:13px;font-weight:600;">AMC Contract</span>
          <span style="font-size:11px;color:var(--ct-muted);">{{ serviceExists.amc ? 'Already created' : 'Create AMC contract' }}</span>
        </button>
        <button
          class="btn-secondary"
          :style="scheduleTargetProject.type === 'Modernisation' ? 'border-color:rgba(168,85,247,0.5);background:rgba(168,85,247,0.08);' : ''"
          @click="scheduleService('modernisation')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border-radius:12px;position:relative;"
        >
          <span v-if="serviceExists.modernisation" style="position:absolute;top:-7px;right:-7px;font-size:9px;font-weight:700;background:#10b981;color:#fff;padding:2px 7px;border-radius:99px;">✓ Exists</span>
          <RefreshCw :size="22" style="color:#a855f7;" />
          <span style="font-size:13px;font-weight:600;">Modernisation</span>
          <span style="font-size:11px;color:var(--ct-muted);">{{ serviceExists.modernisation ? 'Already scheduled' : 'Log modernisation work' }}</span>
        </button>
        <button
          class="btn-secondary"
          :style="scheduleTargetProject.type === 'Repair' ? 'border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.08);' : ''"
          @click="scheduleService('repairs')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border-radius:12px;position:relative;"
        >
          <span v-if="serviceExists.repairs" style="position:absolute;top:-7px;right:-7px;font-size:9px;font-weight:700;background:#10b981;color:#fff;padding:2px 7px;border-radius:99px;">✓ Exists</span>
          <Wrench :size="22" style="color:#f59e0b;" />
          <span style="font-size:13px;font-weight:600;">Repair</span>
          <span style="font-size:11px;color:var(--ct-muted);">{{ serviceExists.repairs ? 'Already logged' : 'Log a repair job' }}</span>
        </button>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="showScheduleDialog = false; scheduleTargetProject = null">Skip for now</button>
    </template>
  </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Search, Pencil, Trash2, Check, Loader2,
  ChevronLeft, ChevronRight, Upload, FolderKanban,
  FolderOpen, LayoutGrid, List, FileSpreadsheet, FileDown, History, Eye,
  Zap, Shield, RefreshCw, Wrench
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import SwipeToConfirm from '@/components/ui/SwipeToConfirm.vue'
import { useCollection } from '@/composables/useCollection'
import { getAll } from '@/firebase/firestore'
import { where } from 'firebase/firestore'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useActivityStore } from '@/stores/activity'
import { Collections } from '@/firebase/collections'
import ActivityTimeline from '@/components/ui/ActivityTimeline.vue'
import { logTimeline } from '@/utils/timeline'
import { usePDF } from '@/composables/usePDF'
import { useExport } from '@/composables/useExport'
import * as XLSX from 'xlsx'
import { saveExcel } from '@/utils/saveFile'

const ui = useUIStore()
const authStore = useAuthStore()
const router = useRouter()

const activity = useActivityStore()
const { exportTablePDF } = usePDF()
const { showExportDialog, dialogVisible: expDlgVisible, selectedPeriod: expPeriod, exportType: expType, exporting: expRunning, runExport, cancelExport } = useExport()
const { items: projects, loading, add, edit, del } = useCollection(Collections.PROJECTS)

const showScheduleDialog = ref(false)
const scheduleTargetProject = ref(null)
const openedFromLead = ref(false)
const serviceExists = ref({ installation: false, amc: false, modernisation: false, repairs: false })

// Auto-open project card when navigated from lead-won flow
watch([() => ui.pendingAutoOpen, projects], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== Collections.PROJECTS) return
  const record = projects.value.find(p => p.id === pending.recordId)
  if (record) {
    openEdit(record, pending.fromLead || false)
    ui.clearPendingAutoOpen()
  }
})

// Check which service types already exist for this project when dialog opens
watch(showScheduleDialog, async (open) => {
  if (!open || !scheduleTargetProject.value?.id) return
  const pid = scheduleTargetProject.value.id
  const [inst, amc, mod, rep] = await Promise.all([
    getAll(Collections.INSTALLATION, [where('projectId', '==', pid)]),
    getAll(Collections.AMC, [where('projectId', '==', pid)]),
    getAll(Collections.MODERNISATION, [where('projectId', '==', pid)]),
    getAll(Collections.REPAIRS, [where('projectId', '==', pid)]),
  ])
  serviceExists.value = {
    installation: inst.length > 0,
    amc: amc.length > 0,
    modernisation: mod.length > 0,
    repairs: rep.length > 0,
  }
})
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(proj) { viewTarget.value = proj; showViewModal.value = true }

// ── Constants ───────────────────────────────────────────────────────
const projectTypes = ['New Installation', 'AMC', 'Modernisation', 'Repair']
const elevatorTypes = [
  'Passenger', 'Goods / Freight', 'Hospital / Bed Elevator',
  'Dumbwaiter', 'Hydraulic', 'MRL (Machine Room Less)',
  'Home Lift', 'Observation / Glass', 'Service Elevator',
  'Fire Evacuation Elevator', 'Car Parking System',
  'Capsule / Panoramic', 'Escalator', 'Other',
]
const carParkingSubTypes = [
  'Car Stack', 'Bike Stack', 'Puzzle Parking', 'Tower Parking',
  'Rotary Parking', 'No Post Parking', 'Two Post Parking', 'Others',
]
const driveTypes = [
  'VVVF', 'VVF', 'AC2 (Two Speed AC)', 'AC1 (Single Speed AC)',
  'Gearless Traction', 'Geared Traction', 'Hydraulic Drive',
  'MRL Belt Drive', 'Chain Drive', 'Linear Motor', 'Pneumatic', 'Other',
]
const doorTypeOptions = [
  'Auto Sliding', 'Manual Swing', 'Centre Opening', 'Side Opening', 'Telescopic', 'Other',
]
const machineRoomOptions = [
  'With MR', 'MRL (No MR)', 'Basement', 'Hydraulic', 'Other',
]
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'discontinued', label: 'Discontinued' },
]
const steps = ['Project Details', 'Building Configuration', 'Review & Submit']

// ── Search / Filter ─────────────────────────────────────────────────
const search = ref('')
const filterStatus = ref('')
const filterType = ref('')
const filterLiftType = ref('')
const filterControllerType = ref('')
const filterDoorType = ref('')
const filterMachineRoom = ref('')
const viewMode = ref('cards')
const page = ref(1)
const pageSize = 12

function projectMatchesLiftFilters(p) {
  const liftType = filterLiftType.value
  const ctrlType = filterControllerType.value
  const doorType = filterDoorType.value
  const machRoom = filterMachineRoom.value
  if (!liftType && !ctrlType && !doorType && !machRoom) return true
  for (const b of (p.buildings || [])) {
    for (const w of (b.wings || [])) {
      for (const l of (w.lifts || [])) {
        const matchLift = !liftType || l.type === liftType
        const matchCtrl = !ctrlType || l.drive === ctrlType
        const matchDoor = !doorType || l.doorType === doorType
        const matchMach = !machRoom || l.machineRoom === machRoom
        if (matchLift && matchCtrl && matchDoor && matchMach) return true
      }
    }
  }
  return false
}

function clearLiftFilters() {
  filterLiftType.value = ''
  filterControllerType.value = ''
  filterDoorType.value = ''
  filterMachineRoom.value = ''
}

const filteredProjects = computed(() => {
  let list = projects.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p => {
      const clientMatch = (p.clients || []).some(c => c.name?.toLowerCase().includes(q)) || p.clientName?.toLowerCase().includes(q)
      return p.projectName?.toLowerCase().includes(q) || clientMatch || p.city?.toLowerCase().includes(q)
    })
  }
  if (filterStatus.value) list = list.filter(p => p.status === filterStatus.value)
  if (filterType.value) list = list.filter(p => p.type === filterType.value)
  if (filterLiftType.value || filterControllerType.value || filterDoorType.value || filterMachineRoom.value) {
    list = list.filter(p => projectMatchesLiftFilters(p))
  }
  return list
})

watch([search, filterStatus, filterType, filterLiftType, filterControllerType, filterDoorType, filterMachineRoom], () => { page.value = 1 })

const pagedProjects = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredProjects.value.slice(start, start + pageSize)
})
const totalPages = computed(() => Math.ceil(filteredProjects.value.length / pageSize) || 1)

// ── Stats ────────────────────────────────────────────────────────────
const activeCount = computed(() => projects.value.filter(p => p.status === 'active' || p.status === 'in-progress').length)
const statusStats = computed(() => [
  { label: 'Total', count: projects.value.length, color: '#a5b4fc' },
  { label: 'Active', count: projects.value.filter(p => p.status === 'active').length, color: '#34d399' },
  { label: 'In Progress', count: projects.value.filter(p => p.status === 'in-progress').length, color: '#60a5fa' },
  { label: 'Completed', count: projects.value.filter(p => p.status === 'completed').length, color: '#94a3b8' },
  { label: 'On Hold', count: projects.value.filter(p => p.status === 'on-hold').length, color: '#fbbf24' },
  { label: 'Active Lifts', count: projects.value.filter(p => p.status === 'active' || p.status === 'in-progress').reduce((sum, p) => sum + getTotalLifts(p), 0), color: '#fb923c' },
])

// ── Table Columns ───────────────────────────────────────────────────
const columns = [
  { key: 'projectName', label: 'Project' },
  { key: 'client', label: 'Client' },
  { key: 'type', label: 'Type', width: '140px' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'value', label: 'Value', width: '120px' },
  { key: 'manager', label: 'Manager', width: '130px' },
  { key: 'startDate', label: 'Start Date', width: '110px' },
  { key: 'actions', label: 'Actions', width: '100px' },
]

// ── Badge / Helpers ─────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    active: 'badge-active',
    'in-progress': 'badge-info',
    completed: 'badge-inactive',
    'on-hold': 'badge-warning',
    cancelled: 'badge-danger',
    discontinued: 'badge-danger',
  }
  return map[status] || 'badge-inactive'
}
function formatCurrency(val) {
  if (!val) return '—'
  return '₹' + Number(val).toLocaleString('en-IN')
}
function formatDate(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// ── Form / Wizard ───────────────────────────────────────────────────
const showProjectModal = ref(false)
const editingProject = ref(null)
const wizardStep = ref(1)
const showTimeline = ref(false)
const timelineProject = ref(null)
let editingStatus = ''
const saving = ref(false)
const numBuildings = ref(1)

function generateLiftId(bi, wi, li) {
  return `B${bi + 1}-W${wi + 1}-L${String(li + 1).padStart(2, '0')}`
}
function defaultLift(bi, wi, li) {
  return { id: generateLiftId(bi, wi, li), type: '', typeOther: '', parkingSubType: '', parkingSubTypeOther: '', capacity: '', speed: '', oem: '', oemOther: '', drive: '', driveOther: '', doorType: '', doorTypeOther: '', stops: '', ratedLoad: '', machineRoom: '', machineRoomOther: '', notes: '' }
}
function defaultWing(bi, wi) {
  return { name: '', sameForAll: false, lifts: [defaultLift(bi, wi, 0)] }
}

function applySameForAll(wing) {
  if (!wing.sameForAll || wing.lifts.length < 2) return
  const src = wing.lifts[0]
  for (let i = 1; i < wing.lifts.length; i++) {
    const dst = wing.lifts[i]
    Object.assign(dst, {
      type: src.type, typeOther: src.typeOther,
      parkingSubType: src.parkingSubType, parkingSubTypeOther: src.parkingSubTypeOther,
      capacity: src.capacity, speed: src.speed,
      oem: src.oem, oemOther: src.oemOther,
      drive: src.drive, driveOther: src.driveOther,
      doorType: src.doorType, doorTypeOther: src.doorTypeOther,
      stops: src.stops, ratedLoad: src.ratedLoad,
      machineRoom: src.machineRoom, machineRoomOther: src.machineRoomOther,
    })
  }
}
function defaultBuilding(bi) {
  return { name: '', wings: [defaultWing(bi, 0)] }
}
function syncBuildings() {
  const n = Math.max(1, numBuildings.value || 1)
  numBuildings.value = n
  const cur = form.value.buildings.length
  if (n > cur) { for (let i = cur; i < n; i++) form.value.buildings.push(defaultBuilding(i)) }
  else { form.value.buildings.splice(n) }
}
function syncWings(building, bi, n) {
  n = Math.max(1, n || 1)
  const cur = building.wings.length
  if (n > cur) { for (let wi = cur; wi < n; wi++) building.wings.push(defaultWing(bi, wi)) }
  else { building.wings.splice(n) }
}
function syncLifts(wing, bi, wi, n) {
  n = Math.max(1, n || 1)
  const cur = wing.lifts.length
  if (n > cur) { for (let li = cur; li < n; li++) wing.lifts.push(defaultLift(bi, wi, li)) }
  else { wing.lifts.splice(n) }
}
function getTotalLifts(project) {
  if (project.buildings?.length) {
    return project.buildings.reduce((sum, b) => sum + (b.wings || []).reduce((ws, w) => ws + (w.lifts || []).length, 0), 0)
  }
  return project.lifts || 0
}
function getBuildingSummary(project) {
  if (project.buildings?.length) {
    const names = project.buildings.map(b => b.name || 'Building').join(', ')
    return `${project.buildings.length} building(s) · ${names}`
  }
  return project.floors ? `${project.floors} floors` : '—'
}

const defaultForm = () => ({
  projectName: '', fileNumber: '', type: '', status: 'active',
  clients: [{ name: '', designation: '', phone: '', email: '' }],
  address: '', city: '', value: 0, advance: 0,
  projectManager: '', startDate: '', expectedCompletion: '',
  description: '', discontinuedReason: '',
  locationLink: '', locationLat: null, locationLng: null, locationRadius: 0.5,
  buildings: [defaultBuilding(0)],
})

function addClient() {
  form.value.clients.push({ name: '', designation: '', phone: '', email: '' })
}
function removeClient(i) {
  if (form.value.clients.length > 1) form.value.clients.splice(i, 1)
}

const form = ref(defaultForm())

const reviewFields = [
  { key: 'projectName', label: 'Project Name' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'city', label: 'City' },
  { key: 'value', label: 'Project Value', format: 'currency' },
  { key: 'advance', label: 'Advance', format: 'currency' },
  { key: 'projectManager', label: 'Project Manager' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'locationLat', label: 'Latitude' },
  { key: 'locationLng', label: 'Longitude' },
  { key: 'locationRadius', label: 'Radius (km)' },
]

function reviewValue(field) {
  const v = form.value[field.key]
  if (!v && v !== 0) return '—'
  if (field.format === 'currency') return formatCurrency(v)
  return v
}

function openAdd() {
  editingProject.value = null
  form.value = defaultForm()
  numBuildings.value = 1
  wizardStep.value = 1
  scheduleTargetProject.value = null
  showProjectModal.value = true
}

function openEdit(project, fromLead = false) {
  editingProject.value = project
  openedFromLead.value = fromLead
  editingStatus = project.status || 'active'
  const base = defaultForm()
  form.value = { ...base, ...project }
  // Ensure buildings array is present
  if (!form.value.buildings || !form.value.buildings.length) {
    form.value.buildings = [defaultBuilding(0)]
  }
  // Ensure clients array is present (backward compat with old clientName field)
  if (!form.value.clients || !form.value.clients.length) {
    form.value.clients = [{ name: project.clientName || '', designation: '', phone: project.clientPhone || '', email: project.clientEmail || '' }]
  }
  numBuildings.value = form.value.buildings.length
  wizardStep.value = 1
  showProjectModal.value = true
}

function cancelWizard() {
  showProjectModal.value = false
  wizardStep.value = 1
  openedFromLead.value = false
}

function nextStep() {
  if (wizardStep.value === 1) {
    if (!form.value.projectName || !form.value.type || !form.value.clients[0]?.name) {
      ui.error('Project name, type, and at least one client name are required.')
      return
    }
  }
  wizardStep.value++
}

const projectSwipeRef = ref(null)
async function saveProject() {
  if (!form.value.projectName || !form.value.clients[0]?.name) {
    ui.error('Project name and client name are required.')
    projectSwipeRef.value?.reset()
    return
  }
  saving.value = true
  try {
    // Keep clientName for backward compat with display in other views
    const primaryClient = form.value.clients[0] || {}
    const data = { ...form.value, clientName: primaryClient.name, clientPhone: primaryClient.phone || '', clientEmail: primaryClient.email || '', updatedAt: new Date() }
    if (editingProject.value) {
      await edit(editingProject.value.id, data, { action: 'updated', module: 'projects', tab: 'Projects', summary: `Updated project ${data.projectName}`, details: { projectName: data.projectName, clientName: data.clientName, status: data.status } })
      ui.success('Project updated successfully.')
      if (editingStatus && editingStatus !== form.value.status) {
        await logTimeline(Collections.PROJECT_TIMELINE, editingProject.value.id, 'status_change',
          `Status changed: ${editingStatus} → ${form.value.status}`)
      } else {
        await logTimeline(Collections.PROJECT_TIMELINE, editingProject.value.id, 'updated',
          `Project details updated`)
      }
      // If opened from lead-won flow, still offer to schedule services
      if (openedFromLead.value) {
        scheduleTargetProject.value = { ...data, id: editingProject.value.id }
      }
      openedFromLead.value = false
    } else {
      data.createdAt = new Date()
      const newDoc = await add(data, { action: 'created', module: 'projects', tab: 'Projects', summary: `Created project ${data.projectName} for ${primaryClient.name}`, details: { projectName: data.projectName, clientName: primaryClient.name, status: data.status, type: data.type, location: data.city } })
      ui.success('Project created successfully.')
      const newId = newDoc?.id || newDoc
      if (newId) {
        await logTimeline(Collections.PROJECT_TIMELINE, newId, 'created',
          `Project created — ${form.value.projectName} for ${primaryClient.name}`)
      }
      scheduleTargetProject.value = { ...data, id: newId || null }
    }
    showProjectModal.value = false
    if (scheduleTargetProject.value) {
      await nextTick()
      showScheduleDialog.value = true
    }
  } catch (e) {
    ui.error('Failed to save project.')
    projectSwipeRef.value?.reset()
  } finally {
    saving.value = false
  }
}

// ── Delete ──────────────────────────────────────────────────────────
const confirmRef = ref(null)
const deleteTarget = ref(null)

function confirmDelete(project) {
  deleteTarget.value = project
  confirmRef.value?.open(`Delete project "${project.projectName}"? This action cannot be undone.`)
}

async function deleteProject() {
  try {
    await del(deleteTarget.value.id, { action: 'deleted', module: 'projects', tab: 'Projects', summary: `Deleted project ${deleteTarget.value.projectName}`, details: { projectName: deleteTarget.value.projectName, id: deleteTarget.value.id } })
    ui.success('Project deleted.')
  } catch (e) {
    ui.error('Failed to delete project.')
  }
}

// ── Schedule Service ─────────────────────────────────────────────────
function scheduleService(tab) {
  const proj = scheduleTargetProject.value
  if (!proj) return
  const primaryClient = (proj.clients && proj.clients[0]) || {}
  ui.setScheduleContext({
    tab,
    projectId: proj.id,
    projectName: proj.projectName,
    clientName: primaryClient.name || proj.clientName || '',
    clientPhone: primaryClient.phone || proj.clientPhone || '',
    clientEmail: primaryClient.email || proj.clientEmail || '',
    clientAddress: proj.address || '',
    startDate: proj.startDate || '',
  })
  showScheduleDialog.value = false
  scheduleTargetProject.value = null
  router.push('/' + tab)
}

// ── Bulk Export ──────────────────────────────────────────────────────
function triggerExport(type) {
  showExportDialog({
    rows: projects.value,
    dateField: 'createdAt',
    columns: ['Project', 'Client', 'Type', 'Status', 'Value', 'Manager', 'Start Date'],
    title: 'Projects Report',
    filename: 'projects',
    accent: [99, 102, 241],
    ui,
    pdfRowMapper: p => [
      p.projectName || '—',
      (p.clients && p.clients.map(c => c.name).filter(Boolean).join(', ')) || p.clientName || '—',
      p.type || '—',
      p.status || '—',
      p.value ? `Rs. ${Number(p.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
      p.projectManager || '—',
      formatDate(p.startDate),
    ],
    excelRowMapper: p => [
      p.projectName || '—',
      (p.clients && p.clients.map(c => c.name).filter(Boolean).join(', ')) || p.clientName || '—',
      p.type || '—',
      p.status || '—',
      p.value || 0,
      p.projectManager || '—',
      formatDate(p.startDate),
    ],
  })
  if (type) expType.value = type
}

// ── Bulk Import ─────────────────────────────────────────────────────
const showImportModal = ref(false)
const importPreview = ref([])
const importError = ref('')
const importing = ref(false)

function handleImportFile(e) {
  const file = e.target.files[0]
  if (!file) return
  importError.value = ''
  importPreview.value = []
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const valid = []
      let skipped = 0
      rows.forEach(row => {
        const name       = String(row.projectName  || row['Project Name']  || row['project_name']  || '').trim()
        const clientName = String(row.clientName   || row['Client Name']   || row['client_name']   || '').trim()
        const clientPhone= String(row.clientPhone  || row['Client Phone']  || row['client_phone']  || '').trim()
        if (!name || !clientName || !clientPhone) { skipped++; return }
        valid.push({
          projectName:        name,
          type:               String(row.type || row['Type'] || 'New Installation').trim(),
          status:             String(row.status || row['Status'] || 'active').trim(),
          clientName,
          clientPhone,
          clientEmail:        String(row.clientEmail || row['Client Email'] || '').trim(),
          city:               String(row.city || row['City'] || '').trim(),
          address:            String(row.address || row['Address'] || '').trim(),
          value:              Number(row.value || row['Value'] || 0),
          advance:            Number(row.advance || row['Advance'] || 0),
          projectManager:     String(row.projectManager || row['Project Manager'] || '').trim(),
          startDate:          String(row.startDate || row['Start Date'] || '').trim(),
          expectedCompletion: String(row.expectedCompletion || row['Expected Completion'] || '').trim(),
          lifts:              Number(row.lifts || row['Lifts'] || 1),
          floors:             Number(row.floors || row['Floors'] || 0),
          elevatorType:       String(row.elevatorType || row['Elevator Type'] || '').trim(),
          driveType:          String(row.driveType || row['Drive Type'] || '').trim(),
          capacity:           String(row.capacity || row['Capacity'] || '').trim(),
        })
      })
      if (!valid.length) { importError.value = `No valid rows found. ${skipped} row(s) skipped — projectName, clientName and clientPhone are all required.`; return }
      importPreview.value = valid
      if (skipped) ui.warning(`${skipped} row(s) skipped — missing projectName, clientName or clientPhone.`)
    } catch (err) {
      importError.value = 'Failed to parse file: ' + err.message
    }
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function doImport() {
  importing.value = true
  let success = 0
  for (const row of importPreview.value) {
    try {
      const doc = await add({ ...row, createdAt: new Date() })
      const newId = doc?.id || doc
      if (newId) await logTimeline(Collections.PROJECT_TIMELINE, newId, 'created', `Imported — ${row.projectName}`)
      success++
    } catch { /* skip failed rows */ }
  }
  importing.value = false
  if (success > 0) activity.log({ action: 'created', module: 'projects', tab: 'Projects', summary: `Imported ${success} projects`, details: { count: success } })
  ui.success(`Imported ${success} of ${importPreview.value.length} projects.`)
  importPreview.value = []
  showImportModal.value = false
}

async function downloadSampleExcel() {
  const headers = [
    'projectName', 'clientName', 'clientPhone',
    'clientEmail', 'type', 'status',
    'city', 'address', 'value', 'advance',
    'projectManager', 'startDate', 'expectedCompletion',
    'lifts', 'floors', 'elevatorType', 'driveType', 'capacity',
  ]
  const sample = [
    'Sunrise Towers', 'Rajesh Sharma', '+91 98765 43210',
    'rajesh@example.com', 'New Installation', 'active',
    'Mumbai', '12 MG Road, Andheri West', 850000, 200000,
    'Anil Kumar', '2025-01-15', '2025-06-30',
    2, 10, 'Passenger', 'VVVF', '630 kg',
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, sample])

  // Column widths for readability
  ws['!cols'] = headers.map((h, i) => ({ wch: [20, 18, 16, 24, 18, 12, 12, 28, 10, 10, 16, 12, 18, 6, 6, 14, 10, 10][i] || 14 }))

  // Bold the header row
  headers.forEach((_, c) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cell]) ws[cell].s = { font: { bold: true } }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Projects')
  await saveExcel(wb, 'SK_Elevators_Projects_Import_Sample.xlsx', ui)
}
</script>
