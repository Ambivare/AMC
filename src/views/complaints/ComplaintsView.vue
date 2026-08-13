<template>
  <div class="complaints-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <MessageSquareWarning :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Complaints
        </h1>
        <p class="page-sub">Every concern logged, tracked, and resolved.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn-secondary btn-sm" @click="triggerExport('pdf')"><FileDown :size="14" /> PDF</button>
        <button class="btn-secondary btn-sm" @click="triggerExport('excel')"><FileText :size="14" /> Excel</button>
        <button class="btn-secondary btn-sm" @click="showImportModal = true">
          <Upload :size="14" /> Import Excel
        </button>
        <button v-if="authStore.can('canCreateService')" class="btn-primary" @click="openAdd">
          <Plus :size="16" /> New Complaint
        </button>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="tabs-nav" style="margin-bottom:20px;">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="['tab-btn', activeTab === tab.value && 'active']"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
        <span v-if="tabCount(tab.value)" style="margin-left:4px;font-size:11px;opacity:.7;">({{ tabCount(tab.value) }})</span>
      </button>
    </div>

    <!-- Filters Row -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;position:relative;">
        <Search :size="14" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ct-muted);" />
        <input v-model="search" class="input" style="padding-left:32px;" placeholder="Search by complaint # or client name…" />
      </div>
      <select v-model="filterPriority" class="input" style="width:160px;">
        <option value="">All Priorities</option>
        <option v-for="p in priorityOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
      </select>
      <select v-model="filterIssueType" class="input" style="width:180px;">
        <option value="">All Issue Types</option>
        <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" style="padding:48px;text-align:center;color:var(--ct-muted);">
        <Loader2 :size="28" style="animation:spin 1s linear infinite;" />
        <p style="margin-top:10px;font-size:13px;">Loading complaints…</p>
      </div>
      <div v-else-if="!filteredComplaints.length" class="empty-state">
        <MessageSquareWarning :size="40" style="opacity:.3;margin-bottom:12px;" />
        <p>No complaints found.</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Complaint #</th>
            <th>Project / Client</th>
            <th>Phone</th>
            <th>Location</th>
            <th>Issue Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Assigned To</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filteredComplaints" :key="c.id" @click="openView(c)" style="cursor:pointer;">
            <td style="font-family:monospace;font-size:12px;color:var(--ct-accent);">{{ c.complaintNumber || '—' }}</td>
            <td @click.stop="openView(c)">
              <div v-if="c.projectId" class="db-s" style="font-weight:600;color:var(--ct-primary);font-size:13px;">{{ projects.find(p => p.id === c.projectId)?.projectName || '—' }}</div>
              <div class="db-s" :style="c.projectId ? 'font-size:11px;color:var(--ct-muted);margin-top:1px;' : 'font-weight:500;color:var(--ct-primary);'">{{ c.clientName || '—' }}</div>
            </td>
            <td class="db-s" style="color:var(--ct-sub);">{{ c.clientPhone || '—' }}</td>
            <td class="db-s" style="color:var(--ct-sub);">{{ c.address || '—' }}</td>
            <td><span class="badge badge-info">{{ c.issueType || '—' }}</span></td>
            <td><span :class="['badge', priorityBadge(c.priority)]">{{ c.priority || '—' }}</span></td>
            <td><span :class="['badge', statusBadge(c.status)]">{{ formatStatus(c.status) }}</span></td>
            <td style="color:var(--ct-sub);">{{ (c.assignedTechnicians || [c.assignedTo]).filter(Boolean).join(', ') || '—' }}</td>
            <td style="color:var(--ct-muted);font-size:12px;">{{ formatDate(c.scheduledDate || c.createdAt) }}</td>
            <td>
              <div style="display:flex;gap:5px;flex-wrap:wrap;min-width:0;" @click.stop>
                <button v-if="c.status !== 'resolved' && c.status !== 'closed'" class="btn-success btn-sm" @click="openComplete(c)" title="Mark Complete" style="white-space:nowrap;padding:4px 8px;">
                  <CheckCircle :size="12" /> Complete
                </button>
                <button class="btn-secondary btn-sm" @click="openEdit(c)" title="Edit">
                  <Pencil :size="12" />
                </button>
                <button class="btn-secondary btn-sm" style="color:#818cf8;" @click="timelineRecord = c; showTimeline = true" title="Activity Timeline">
                  <History :size="12" />
                </button>
                <button class="btn-secondary btn-sm" @click="exportComplaintPDF(c)" title="Download Receipt PDF">
                  <FileText :size="12" />
                </button>
                <button class="btn-secondary btn-sm" style="color:#10b981;" @click="openPayment(c)" title="Log Payment Received">
                  <DollarSign :size="12" />
                </button>
                <button v-if="authStore.can('canDelete')" class="btn-danger btn-sm" @click="confirmDel(c)" title="Delete">
                  <Trash2 :size="12" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editingId ? 'Edit Complaint' : 'New Complaint'"
      :subtitle="editingId ? 'Update complaint details' : 'Log a new client complaint'"
      width="680px"
    >
      <form @submit.prevent="saveComplaint" class="form-grid">
        <!-- Project Selection Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(239,68,68,0.1);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fca5a5;">
                <FolderOpen :size="16" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link to Project</div>
                <div style="font-size:11px;color:var(--ct-muted);">Auto-fill client details &amp; address from an existing project</div>
              </div>
            </div>
            <button
              type="button"
              @click="useProject = !useProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${useProject ? '#ef4444' : 'rgba(255,255,255,0.12)'};position:relative;`"
            >
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${useProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>

        <!-- Project search (toggle ON) -->
        <div v-if="useProject" class="form-group form-full">
          <label class="label">Select Project *</label>
          <div style="position:relative;">
            <input
              v-model="cmpProjectSearch"
              class="input"
              placeholder="Search project name or client…"
              @focus="showCmpProjectDropdown = true"
              @blur="cmpDelayCloseDropdown"
            />
            <div v-if="showCmpProjectDropdown && cmpFilteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div
                v-for="p in cmpFilteredProjects"
                :key="p.id"
                @mousedown.prevent="selectCmpProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.projectId === p.id ? 'background:rgba(239,68,68,0.1);' : ''"
              >
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.address || p.city || '—' }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:8px;padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;font-size:12px;color:var(--ct-green);">
            ✓ {{ form.clientName }} · {{ form.address || 'No address on file' }}
          </div>
          <!-- Client selection from project -->
          <div v-if="form.projectId && selectedProject && selectedProject.clients && selectedProject.clients.length > 0" class="form-group" style="margin-top:10px;">
            <label class="label">Select Client Contact(s)</label>
            <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.12);border-radius:10px;">
              <label v-for="c in selectedProject.clients" :key="c.name + c.phone" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--ct-sub);">
                <input
                  type="checkbox"
                  :value="c"
                  :checked="form.selectedClients.some(sc => sc.name === c.name && sc.phone === c.phone)"
                  @change="e => { if (e.target.checked) form.selectedClients.push(c); else form.selectedClients = form.selectedClients.filter(sc => !(sc.name === c.name && sc.phone === c.phone)) }"
                  style="accent-color:#ef4444;width:15px;height:15px;"
                />
                <span><strong>{{ c.name }}</strong><span v-if="c.designation" style="color:var(--ct-muted);"> · {{ c.designation }}</span><span v-if="c.phone" style="color:var(--ct-muted);"> · {{ c.phone }}</span></span>
              </label>
            </div>
          </div>
          <!-- Lift selection -->
          <div v-if="form.projectId && selectedProject && selectedProject.buildings && selectedProject.buildings.length" class="form-group" style="margin-top:10px;">
            <label class="label">Select Buildings / Wings / Lifts</label>
            <LiftSelector v-model="form.liftSelection" :project="selectedProject" />
          </div>
        </div>

        <!-- Manual client details (toggle OFF) -->
        <template v-if="!useProject">
          <div class="form-group">
            <label class="label">Client Name *</label>
            <input v-model="form.clientName" class="input" required placeholder="Full name" />
          </div>
          <div class="form-group">
            <label class="label">Client Phone</label>
            <input
              :value="form.clientPhone"
              class="input"
              inputmode="tel"
              maxlength="14"
              placeholder="+91 XXXXX XXXXX"
              @input="form.clientPhone = formatPhone($event.target.value)"
            />
          </div>
          <div class="form-group form-full">
            <label class="label">Address / Location</label>
            <input v-model="form.address" class="input" placeholder="Site address" />
          </div>
        </template>

        <!-- When project linked, allow editing phone/address override -->
        <template v-if="useProject && form.projectId">
          <div class="form-group">
            <label class="label">Client Phone</label>
            <input
              :value="form.clientPhone"
              class="input"
              inputmode="tel"
              maxlength="14"
              placeholder="+91 XXXXX XXXXX"
              @input="form.clientPhone = formatPhone($event.target.value)"
            />
          </div>
          <div class="form-group form-full">
            <label class="label">Address / Location</label>
            <input v-model="form.address" class="input" placeholder="Site address" />
          </div>
        </template>
        <div class="form-group">
          <label class="label">Issue Type *</label>
          <select v-model="form.issueType" class="input" required>
            <option value="">— Select —</option>
            <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Priority *</label>
          <select v-model="form.priority" class="input" required>
            <option value="">— Select —</option>
            <option v-for="p in priorityOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Assigned Technicians</label>
          <TechnicianSelect v-model="form.assignedTechnicians" />
        </div>
        <div class="form-group">
          <label class="label">Scheduled Date</label>
          <input v-model="form.scheduledDate" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="label">Scheduled Time</label>
          <input v-model="form.scheduledTime" type="time" class="input" />
        </div>
        <div class="form-group form-full">
          <label class="label">Description</label>
          <textarea v-model="form.description" class="input" rows="3" placeholder="Describe the complaint in detail…" style="resize:vertical;"></textarea>
        </div>

        <!-- ── Completion / Resolution Section ── shown when resolved or closed -->
        <div v-if="['resolved','closed'].includes(form.status)" class="form-group form-full">
          <div style="border:1px solid rgba(239,68,68,0.2);border-radius:14px;overflow:hidden;">
            <div style="padding:14px 18px;background:rgba(239,68,68,0.06);border-bottom:1px solid rgba(239,68,68,0.15);display:flex;align-items:center;gap:10px;">
              <span style="font-size:16px;">📋</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--ct-primary);">Resolution Record</div>
                <div style="font-size:11px;color:var(--ct-muted);">Capture signatures and customer satisfaction</div>
              </div>
            </div>
            <div style="padding:18px;display:flex;flex-direction:column;gap:20px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div class="form-group" style="margin:0;">
                  <label class="label">Arrival Time</label>
                  <input v-model="form.arrivalTime" type="time" class="input" />
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="label">Resolution Time</label>
                  <input v-model="form.completionTime" type="time" class="input" />
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
                <SignatureCanvas
                  v-model="form.arrivalSignature"
                  label="Representative Signature (Arrival)"
                  border-color="#ef4444"
                />
                <SignatureCanvas
                  v-model="form.completionSignature"
                  label="Representative Signature (Resolution)"
                  border-color="#22c55e"
                />
              </div>
              <div style="padding:14px 16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;">
                <div style="font-size:12px;font-weight:600;color:var(--ct-sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Customer Satisfaction</div>
                <StarRating v-model="form.customerRating" />
                <textarea
                  v-model="form.customerFeedback"
                  class="input"
                  rows="2"
                  placeholder="Customer feedback or remarks (optional)…"
                  style="margin-top:12px;resize:vertical;"
                ></textarea>
              </div>
              <!-- Site Photos -->
              <div style="padding:14px 16px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
                <div style="font-size:12px;font-weight:600;color:var(--ct-sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Site Photos</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                  <div v-for="(p, i) in form.completionPhotos" :key="i" style="position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                    <img :src="p" style="width:100%;height:100%;object-fit:cover;" />
                    <button type="button" @click="form.completionPhotos.splice(i,1)" style="position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(239,68,68,0.8);border:none;border-radius:50%;color:#fff;font-size:12px;cursor:pointer;">×</button>
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <label class="btn-secondary btn-sm" style="cursor:pointer;">📁 Upload Photos<input type="file" accept="image/*" multiple style="display:none;" @change="addPhotos($event)" /></label>
                  <label class="btn-secondary btn-sm" style="cursor:pointer;">📷 Take Photo<input type="file" accept="image/*" capture="environment" style="display:none;" @change="addPhotos($event)" /></label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" type="button" @click="showModal = false">Cancel</button>
        <button class="btn-primary" type="button" :disabled="saving" @click="saveComplaint">
          <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
          <Save v-else :size="14" />
          {{ editingId ? 'Update' : 'Save Complaint' }}
        </button>
      </template>
    </AppModal>

    <!-- Confirm Delete -->
    <!-- Completion Modal -->
    <AppModal v-model="showCompleteModal" title="Mark as Resolved" subtitle="Capture completion details & signature" width="620px">
      <div style="display:flex;flex-direction:column;gap:16px;" v-if="completeTarget">
        <div style="padding:12px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;font-size:13px;color:#4ade80;">
          Marking complaint <strong>{{ completeTarget.complaintNumber }}</strong> as <strong>Resolved</strong> for {{ completeTarget.clientName }}
        </div>
        <div class="form-grid">
          <div class="form-group form-full">
            <label class="label">Description <span style="color:var(--ct-red)">*</span></label>
            <textarea v-model="completeForm.description" class="input" rows="3" placeholder="Describe what was done to resolve this complaint…" style="resize:vertical;"></textarea>
          </div>
          <div class="form-group">
            <label class="label">Arrival Date</label>
            <input type="date" v-model="completeForm.arrivalDate" class="input" />
          </div>
          <div class="form-group">
            <label class="label">Arrival Time</label>
            <input type="time" v-model="completeForm.arrivalTime" class="input" />
          </div>
          <div class="form-group form-full">
            <label class="label">Completed By</label>
            <select v-model="completeForm.completedBy" class="input" :disabled="isCompletedByLocked">
              <option value="">Select technician…</option>
              <option v-for="t in technicians" :key="t.id" :value="t.fullName || t.name">{{ t.fullName || t.name }}</option>
            </select>
            <span v-if="isCompletedByLocked" style="font-size:11px;color:var(--ct-muted);margin-top:4px;display:block;">
              You are the assigned technician — locked to your name.
            </span>
          </div>
          <div class="form-group">
            <label class="label">Signatory Name</label>
            <input v-model="completeForm.signatoryName" class="input" placeholder="Customer / representative name" />
          </div>
          <div class="form-group">
            <label class="label">Designation</label>
            <input v-model="completeForm.signatoryDesignation" class="input" placeholder="e.g. Building Manager" />
          </div>
        </div>
        <div class="form-group form-full">
          <label class="label">Customer Acknowledgement Signature</label>
          <SignatureCanvas v-model="completeForm.signature" label="Sign here to acknowledge completion" />
        </div>
        <div style="padding:12px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
          <div style="font-size:12px;color:var(--ct-muted);">Site Completion Photos</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;">
            <div v-for="(ph,i) in completeForm.photos" :key="i" style="position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
              <img :src="ph" style="width:100%;height:100%;object-fit:cover;" />
              <button type="button" @click="completeForm.photos.splice(i,1)" style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(239,68,68,0.8);border:none;border-radius:50%;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <label class="btn-secondary btn-sm" style="cursor:pointer;">📁 Upload <input type="file" accept="image/*" multiple style="display:none;" @change="addCompletePhotos" /></label>
            <label class="btn-secondary btn-sm" style="cursor:pointer;">📷 Camera <input type="file" accept="image/*" capture="environment" style="display:none;" @change="addCompletePhotos" /></label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showCompleteModal = false">Cancel</button>
        <button class="btn-success" @click="saveCompletion" :disabled="saving">
          <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
          <CheckCircle v-else :size="14" />
          Mark Resolved
        </button>
      </template>
    </AppModal>

    <!-- View Complaint Detail -->
    <AppModal v-model="showViewModal" title="Complaint Details" subtitle="Read-only view" width="720px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:16px;">
        <!-- Header banner -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:14px;">
          <div>
            <div v-if="viewTarget.projectId" style="font-size:11px;color:var(--ct-accent);font-weight:600;margin-bottom:2px;">{{ projects.find(p => p.id === viewTarget.projectId)?.projectName }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName || '—' }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:3px;">{{ viewTarget.complaintNumber || '' }}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span :class="['badge', priorityBadge(viewTarget.priority)]">{{ viewTarget.priority || '—' }}</span>
            <span :class="['badge', statusBadge(viewTarget.status)]">{{ formatStatus(viewTarget.status) }}</span>
          </div>
        </div>
        <!-- Details grid -->
        <div class="form-grid">
          <div class="form-group">
            <div class="label">Client Name</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.clientName || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Phone</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.clientPhone || '—' }}</div>
          </div>
          <div class="form-group form-full">
            <div class="label">Address / Location</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.address || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Issue Type</div>
            <div style="margin-top:4px;"><span class="badge badge-info">{{ viewTarget.issueType || '—' }}</span></div>
          </div>
          <div class="form-group">
            <div class="label">Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ formatDate(viewTarget.scheduledDate || viewTarget.createdAt) }}</div>
          </div>
          <div class="form-group form-full">
            <div class="label">Assigned To</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;">{{ (viewTarget.assignedTechnicians || [viewTarget.assignedTo]).filter(Boolean).join(', ') || '—' }}</div>
          </div>
          <div class="form-group form-full" v-if="viewTarget.description">
            <div class="label">Description</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.description }}</div>
          </div>
        </div>
        <!-- Completion info -->
        <div v-if="viewTarget.status === 'resolved' || viewTarget.status === 'closed'" style="padding:14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#10b981;margin-bottom:10px;">Resolution Details</div>
          <div class="form-grid" style="margin:0;">
            <div class="form-group" v-if="viewTarget.arrivalTime">
              <div class="label">Arrival Time</div>
              <div style="color:var(--ct-primary);font-size:13px;margin-top:3px;">{{ viewTarget.arrivalTime }}</div>
            </div>
            <div class="form-group" v-if="viewTarget.completionTime">
              <div class="label">Completion Time</div>
              <div style="color:var(--ct-primary);font-size:13px;margin-top:3px;">{{ viewTarget.completionTime }}</div>
            </div>
            <div class="form-group form-full" v-if="viewTarget.customerFeedback">
              <div class="label">Customer Feedback</div>
              <div style="color:var(--ct-sub);font-size:13px;margin-top:3px;">{{ viewTarget.customerFeedback }}</div>
            </div>
            <div class="form-group" v-if="viewTarget.customerRating">
              <div class="label">Rating</div>
              <div style="color:#fbbf24;font-size:18px;margin-top:3px;">{{ '★'.repeat(viewTarget.customerRating) }}{{ '☆'.repeat(5 - viewTarget.customerRating) }}</div>
            </div>
          </div>
          <div v-if="viewTarget.completionPhotos?.length" style="margin-top:10px;">
            <div class="label" style="margin-bottom:6px;">Completion Photos</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              <img v-for="(ph,i) in viewTarget.completionPhotos" :key="i" :src="ph" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
            </div>
          </div>
          <div v-if="viewTarget.completionSignature" style="margin-top:10px;">
            <div class="label" style="margin-bottom:6px;">Completion Signature</div>
            <img :src="viewTarget.completionSignature" style="max-height:80px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
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

    <ConfirmDialog
      v-model="showConfirm"
      title="Delete Complaint"
      :message="`Delete complaint from '${deleteTarget?.clientName}'? This cannot be undone.`"
      confirmLabel="Delete"
      :danger="true"
      @confirm="deleteComplaint"
    />

    <!-- Activity Timeline -->
    <ActivityTimeline
      v-model="showTimeline"
      :record-id="timelineRecord?.id || ''"
      :collection="Collections.COMPLAINTS"
      :title="`Complaint — ${timelineRecord?.issueType || ''}`"
      :record-summary="`${timelineRecord?.clientName} · Priority: ${timelineRecord?.priority} · ${formatStatus(timelineRecord?.status)}`"
    />

    <!-- Import Modal -->
    <AppModal v-model="showImportModal" title="Import Complaints from Excel" width="640px">
      <div style="margin-bottom:16px;">
        <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:16px;">
          <p style="font-size:12px;color:var(--ct-muted);margin:0 0 10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Expected Columns (in order)</p>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead><tr style="color:var(--ct-muted);"><th style="text-align:left;padding:4px 8px;">Column</th><th style="text-align:left;padding:4px 8px;">Example</th><th style="text-align:left;padding:4px 8px;">Required</th></tr></thead>
            <tbody>
              <tr v-for="col in importColumns" :key="col.key" style="border-top:1px solid rgba(255,255,255,0.04);">
                <td style="padding:5px 8px;color:var(--ct-accent);font-family:monospace;">{{ col.key }}</td>
                <td style="padding:5px 8px;color:var(--ct-sub);">{{ col.example }}</td>
                <td style="padding:5px 8px;"><span :class="col.required ? 'badge badge-danger' : 'badge badge-inactive'" style="font-size:10px;">{{ col.required ? 'Required' : 'Optional' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin-bottom:12px;">
          <label class="label">Select Excel / CSV File</label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px 16px;border:2px dashed rgba(99,102,241,0.3);border-radius:12px;cursor:pointer;background:rgba(99,102,241,0.04);">
            <Upload :size="20" style="color:#6366f1;flex-shrink:0;" />
            <span style="color:var(--ct-muted);font-size:13px;">{{ importFile ? importFile.name : 'Click to choose .xlsx, .xls or .csv' }}</span>
            <input type="file" accept=".xlsx,.xls,.csv" @change="onImportFile" style="display:none;" />
          </label>
        </div>
        <div v-if="importError" style="color:#f87171;font-size:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:10px;border:1px solid rgba(239,68,68,0.18);margin-bottom:10px;">{{ importError }}</div>
        <div v-if="importPreview.length" class="glass" style="padding:12px;border-radius:12px;">
          <p style="font-size:12px;color:var(--ct-green);margin:0 0 8px;">✓ {{ importPreview.length }} record(s) ready to import</p>
          <p v-if="importSkipped" style="font-size:11px;color:#fbbf24;margin:0 0 6px;">⚠ {{ importSkipped }} row(s) skipped (missing required fields)</p>
          <div style="max-height:120px;overflow-y:auto;font-size:11px;color:var(--ct-muted);">
            <div v-for="(r, i) in importPreview.slice(0,5)" :key="i" style="padding:2px 0;">{{ r.clientName }} — {{ r.issueType }} ({{ r.priority }})</div>
            <div v-if="importPreview.length > 5" style="color:var(--ct-muted);">…and {{ importPreview.length - 5 }} more</div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeImport">Cancel</button>
        <button class="btn-primary" :disabled="!importPreview.length || importing" @click="doImport">
          <Upload :size="14" /> {{ importing ? 'Importing…' : `Import ${importPreview.length} Records` }}
        </button>
      </template>
    </AppModal>

  <!-- Log Payment Modal -->
  <AppModal v-model="payModal" title="Log Payment Received" subtitle="Record a payment against this complaint" width="480px">
    <div v-if="payTarget" style="display:flex;flex-direction:column;gap:16px;">
      <div style="padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:10px;font-size:13px;color:#4ade80;">
        Logging payment for <strong>{{ payTarget.clientName || payTarget.id }}</strong>
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
      <div v-if="payTarget.paymentHistory?.length" style="padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
        <div style="font-size:11px;color:var(--ct-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Previous Payments</div>
        <div v-for="(ph, i) in payTarget.paymentHistory" :key="i" style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="color:var(--ct-sub);">{{ ph.date }} · {{ ph.method }}</span>
          <span style="color:#10b981;font-weight:600;">Rs. {{ Number(ph.amount).toLocaleString('en-IN') }}</span>
        </div>
        <div style="margin-top:6px;font-size:12px;font-weight:600;color:#10b981;">Total Paid: Rs. {{ Number(payTarget.paidAmount || 0).toLocaleString('en-IN') }}</div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="payModal = false">Cancel</button>
      <button class="btn-success" @click="savePayment" :disabled="saving">
        <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
        <span v-else>Save Payment</span>
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
import { ref, computed, onMounted, watch } from 'vue'
import {
  MessageSquareWarning, Plus, Search, Pencil, Trash2, ArrowRight,
  FileDown, Save, Loader2, Upload, FolderOpen, FileText, History, CheckCircle, DollarSign
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SignatureCanvas from '@/components/ui/SignatureCanvas.vue'
import StarRating from '@/components/ui/StarRating.vue'
import TechnicianSelect from '@/components/ui/TechnicianSelect.vue'
import LiftSelector from '@/components/ui/LiftSelector.vue'
import ActivityTimeline from '@/components/ui/ActivityTimeline.vue'
import { logTimeline } from '@/utils/timeline'
import { getAll, create, update, remove } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'
import { savePDF } from '@/utils/saveFile'
import { usePDF } from '@/composables/usePDF'
import { useExport } from '@/composables/useExport'
import { useAuthStore } from '@/stores/auth'
import { useActivityStore } from '@/stores/activity'
import * as XLSX from 'xlsx'

const ui = useUIStore()
const activity = useActivityStore()
const { exportTablePDF, _drawHeader, _drawFooter, _sectionLabel, _infoGrid, _toRs, _C, _MARGIN, _PAGE_W, _getCtx, _drawReceiptHeader, _drawReceiptFooter, _drawBlackSig, _RECEIPT } = usePDF()
const { showExportDialog, dialogVisible: expDlgVisible, selectedPeriod: expPeriod, exportType: expType, exporting: expRunning, runExport, cancelExport } = useExport()
const authStore = useAuthStore()

// ── Data ─────────────────────────────────────────────────────────────────────
const complaints = ref([])
const projects = ref([])
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(c) { viewTarget.value = c; showViewModal.value = true }
const technicians = ref([])
const loading = ref(false)
const saving = ref(false)

watch([() => ui.pendingAutoOpen, complaints], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== Collections.COMPLAINTS) return
  const record = complaints.value.find(r => r.id === pending.recordId)
  if (record) { openView(record); ui.clearPendingAutoOpen() }
})

// Payment tracking
const payModal = ref(false)
const payTarget = ref(null)
const payForm = ref({ amount: 0, date: new Date().toISOString().slice(0,10), method: 'cash', reference: '', note: '' })

// ── Filters ───────────────────────────────────────────────────────────────────
const search = ref('')
const activeTab = ref('')
const filterPriority = ref('')
const filterIssueType = ref('')

const statusTabs = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const issueTypes = ['Stuck Elevator', 'Door Issue', 'Noise', 'Speed', 'Other']

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const statusFlow = ['open', 'in-progress', 'resolved', 'closed']

// ── Project Selection ─────────────────────────────────────────────────────────
const useProject = ref(true)
const cmpProjectSearch = ref('')
const showCmpProjectDropdown = ref(false)

const cmpFilteredProjects = computed(() => {
  const q = cmpProjectSearch.value.toLowerCase()
  return projects.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) ||
    (p.clientName || '').toLowerCase().includes(q)
  )
})

function selectCmpProject(p) {
  form.value.projectId = p.id
  form.value.clientName = p.clientName || ''
  form.value.clientPhone = p.phone || p.clientPhone || ''
  form.value.address = p.address || p.clientAddress || (p.city ? `${p.city}` : '')
  form.value.selectedClients = []
  cmpProjectSearch.value = p.projectName
  showCmpProjectDropdown.value = false
}

function cmpDelayCloseDropdown() {
  setTimeout(() => { showCmpProjectDropdown.value = false }, 200)
}

// ── Modal / Form ──────────────────────────────────────────────────────────────
const showModal = ref(false)
const showConfirm = ref(false)
const showCompleteModal = ref(false)
const completeTarget = ref(null)
const completeForm = ref({ description: '', arrivalDate: '', arrivalTime: '', completedBy: '', signatoryName: '', signatoryDesignation: '', signature: '', photos: [] })

// True when the logged-in user is a technician assigned to this complaint — locks the Completed By dropdown
const isCompletedByLocked = computed(() => {
  if (!completeTarget.value) return false
  const userName = authStore.user?.fullName || authStore.user?.username || ''
  return authStore.user?.role === 'technician' &&
    (completeTarget.value.assignedTechnicians || []).includes(userName)
})

function openComplete(c) {
  completeTarget.value = c
  const now = new Date()
  const todayDate = now.toISOString().slice(0, 10)
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  const userName = authStore.user?.fullName || authStore.user?.username || ''
  const locked = authStore.user?.role === 'technician' &&
    (c.assignedTechnicians || []).includes(userName)
  completeForm.value = {
    description: '',
    arrivalDate: todayDate,
    arrivalTime: currentTime,
    completedBy: locked ? userName : '',
    signatoryName: '',
    signatoryDesignation: '',
    signature: '',
    photos: [],
  }
  showCompleteModal.value = true
}

function addCompletePhotos(event) {
  Array.from(event.target.files || []).forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => { completeForm.value.photos = [...completeForm.value.photos, e.target.result] }
    reader.readAsDataURL(file)
  })
  event.target.value = ''
}

async function saveCompletion() {
  if (!completeTarget.value) return
  if (!completeForm.value.description?.trim()) {
    ui.error('Please enter a description of what was done')
    return
  }
  saving.value = true
  try {
    await update(Collections.COMPLAINTS, completeTarget.value.id, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      completionDescription: completeForm.value.description,
      arrivalDate: completeForm.value.arrivalDate,
      arrivalTime: completeForm.value.arrivalTime,
      completedBy: completeForm.value.completedBy,
      completionSignature: completeForm.value.signature,
      signatoryName: completeForm.value.signatoryName,
      signatoryDesignation: completeForm.value.signatoryDesignation,
      completionPhotos: completeForm.value.photos,
    })
    await logTimeline(Collections.COMPLAINTS, completeTarget.value.id, 'status_change', `Marked as Resolved by ${authStore.user?.fullName || 'User'}`)
    ui.success('Complaint marked as resolved')
    showCompleteModal.value = false
    await loadData()
  } catch { ui.error('Failed to save completion') }
  finally { saving.value = false }
}

const editingId = ref(null)
const deleteTarget = ref(null)
const showTimeline = ref(false)
const timelineRecord = ref(null)
let editingStatus = ''

const defaultForm = () => ({
  clientName: '',
  clientPhone: '',
  selectedClients: [],
  address: '',
  projectId: '',
  liftSelection: { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
  issueType: '',
  priority: 'medium',
  description: '',
  assignedTo: '',
  assignedTechnicians: [],
  scheduledDate: '', scheduledTime: '',
  status: 'open',
  arrivalTime: '',
  completionTime: '',
  arrivalSignature: '',
  completionSignature: '',
  customerRating: 0,
  customerFeedback: '',
  completionPhotos: [],
})
const form = ref(defaultForm())

const selectedProject = computed(() => projects.value.find(p => p.id === form.value.projectId) || null)

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredComplaints = computed(() => {
  const q = search.value.toLowerCase()
  return complaints.value.filter(c => {
    const matchTab = !activeTab.value || c.status === activeTab.value
    const projectName = c.projectId ? (projects.value.find(p => p.id === c.projectId)?.projectName || '') : ''
    const matchSearch = !q ||
      (c.complaintNumber || '').toLowerCase().includes(q) ||
      (c.clientName || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.issueType || '').toLowerCase().includes(q) ||
      projectName.toLowerCase().includes(q)
    const matchPriority = !filterPriority.value || c.priority === filterPriority.value
    const matchIssue = !filterIssueType.value || c.issueType === filterIssueType.value
    return matchTab && matchSearch && matchPriority && matchIssue
  })
})

const openCount = computed(() => complaints.value.filter(c => c.status === 'open').length)

function tabCount(val) {
  if (!val) return 0
  return complaints.value.filter(c => c.status === val).length
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  const local = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits
  if (!local) return ''
  const d = local.slice(0, 10)
  if (d.length <= 5) return `+91 ${d}`
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
}

function formatDate(val) {
  if (!val) return '—'
  const d = val?.toDate ? val.toDate() : new Date(val)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatStatus(s) {
  return { 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved', 'closed': 'Closed' }[s] || s
}

function addPhotos(event) {
  const files = Array.from(event.target.files || [])
  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => { form.value.completionPhotos = [...(form.value.completionPhotos || []), e.target.result] }
    reader.readAsDataURL(file)
  })
  event.target.value = ''
}

function statusBadge(s) {
  return { 'open': 'badge-warning', 'in-progress': 'badge-info', 'resolved': 'badge-active', 'closed': 'badge-inactive' }[s] || ''
}

function priorityBadge(p) {
  return { 'low': 'badge-active', 'medium': 'badge-info', 'high': 'badge-warning', 'urgent': 'badge-danger' }[p] || ''
}

function generateComplaintNumber() {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  return `CMP-${y}${m}-${rand}`
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const [c, p, e] = await Promise.all([
      getAll(Collections.COMPLAINTS),
      getAll(Collections.PROJECTS),
      getAll(Collections.EMPLOYEES),
    ])
    complaints.value = c.filter(item => !item.recordId && !item.type).sort((a, b) => {
      const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
      const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
      return db2 - da
    })
    projects.value = p
    technicians.value = e.filter(emp => emp.role === 'technician' || emp.department === 'Technical')
  } catch (e) {
    ui.error('Failed to load complaints')
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingId.value = null
  const now = new Date()
  form.value = defaultForm()
  form.value.scheduledDate = now.toISOString().slice(0, 10)
  form.value.scheduledTime = now.toTimeString().slice(0, 5)
  useProject.value = true
  cmpProjectSearch.value = ''
  showModal.value = true
}

function openEdit(c) {
  editingId.value = c.id
  editingStatus = c.status || 'open'
  useProject.value = !!c.projectId
  if (c.projectId) {
    const proj = projects.value.find(p => p.id === c.projectId)
    cmpProjectSearch.value = proj?.projectName || ''
  } else {
    cmpProjectSearch.value = ''
  }
  form.value = {
    clientName: c.clientName || '',
    clientPhone: c.clientPhone || '',
    address: c.address || '',
    projectId: c.projectId || '',
    selectedClients: Array.isArray(c.selectedClients) ? [...c.selectedClients] : [],
    liftSelection: c.liftSelection ? { ...c.liftSelection } : { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
    issueType: c.issueType || '',
    priority: c.priority || 'medium',
    description: c.description || '',
    assignedTo: c.assignedTo || '',
    assignedTechnicians: Array.isArray(c.assignedTechnicians) ? [...c.assignedTechnicians] : [],
    scheduledDate: c.scheduledDate || '',
    scheduledTime: c.scheduledTime || '',
    status: c.status || 'open',
    arrivalTime: c.arrivalTime || '',
    completionTime: c.completionTime || '',
    arrivalSignature: c.arrivalSignature || '',
    completionSignature: c.completionSignature || '',
    customerRating: c.customerRating || 0,
    customerFeedback: c.customerFeedback || '',
  }
  showModal.value = true
}

async function saveComplaint() {
  if (!form.value.clientName || !form.value.issueType || !form.value.priority) {
    ui.warning('Please fill all required fields')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await update(Collections.COMPLAINTS, editingId.value, { ...form.value })
      activity.log({ action: 'updated', module: 'complaints', tab: 'Complaints', summary: `Updated complaint for ${form.value.clientName || '—'}`, details: { clientName: form.value.clientName, issueType: form.value.issueType, priority: form.value.priority, status: form.value.status } })
      ui.success('Complaint updated')
      if (editingStatus && editingStatus !== form.value.status) {
        await logTimeline(Collections.COMPLAINTS, editingId.value, 'status_change',
          `Status changed: ${formatStatus(editingStatus)} → ${formatStatus(form.value.status)}`)
      } else {
        await logTimeline(Collections.COMPLAINTS, editingId.value, 'updated', 'Complaint record updated')
      }
    } else {
      const newId = await create(Collections.COMPLAINTS, { ...form.value, complaintNumber: generateComplaintNumber() })
      activity.log({ action: 'created', module: 'complaints', tab: 'Complaints', summary: `Logged complaint for ${form.value.clientName || '—'}: ${form.value.issueType}`, details: { clientName: form.value.clientName, issueType: form.value.issueType, priority: form.value.priority } })
      ui.success('Complaint logged')
      await logTimeline(Collections.COMPLAINTS, newId, 'created',
        `Complaint created — ${form.value.issueType} by ${form.value.clientName || '—'}`)
    }
    showModal.value = false
    await loadData()
  } catch (e) {
    ui.error('Failed to save complaint')
  } finally {
    saving.value = false
  }
}

async function cycleStatus(c) {
  const idx = statusFlow.indexOf(c.status)
  if (idx >= statusFlow.length - 1) { ui.warning('Complaint is already closed'); return }
  const next = statusFlow[idx + 1]
  try {
    await update(Collections.COMPLAINTS, c.id, { status: next })
    ui.success(`Status updated to ${formatStatus(next)}`)
    await logTimeline(Collections.COMPLAINTS, c.id, 'status_change',
      `Status changed: ${formatStatus(c.status)} → ${formatStatus(next)}`)
    await loadData()
  } catch {
    ui.error('Failed to update status')
  }
}

function confirmDel(c) {
  deleteTarget.value = c
  showConfirm.value = true
}

async function deleteComplaint() {
  if (!deleteTarget.value) return
  try {
    await remove(Collections.COMPLAINTS, deleteTarget.value.id)
    activity.log({ action: 'deleted', module: 'complaints', tab: 'Complaints', summary: `Deleted complaint for ${deleteTarget.value.clientName || deleteTarget.value.id}`, details: { clientName: deleteTarget.value.clientName, issueType: deleteTarget.value.issueType } })
    ui.success('Complaint deleted')
    await loadData()
  } catch {
    ui.error('Failed to delete complaint')
  }
}

// ── Payment Tracking ──────────────────────────────────────────────────────────
function openPayment(record) {
  payTarget.value = record
  payForm.value = { amount: 0, date: new Date().toISOString().slice(0, 10), method: 'cash', reference: '', note: '' }
  payModal.value = true
}

async function savePayment() {
  if (!payTarget.value || !payForm.value.amount || payForm.value.amount <= 0) {
    ui.error('Enter a valid amount')
    return
  }
  saving.value = true
  try {
    const existing = payTarget.value.paymentHistory || []
    const newEntry = {
      ...payForm.value,
      loggedBy: authStore.user?.fullName || authStore.user?.username || 'User',
      loggedAt: new Date().toISOString(),
    }
    const updatedHistory = [...existing, newEntry]
    const newPaid = updatedHistory.reduce((s, p) => s + Number(p.amount || 0), 0)
    await update(Collections.COMPLAINTS, payTarget.value.id, {
      paymentHistory: updatedHistory,
      paidAmount: newPaid,
    })
    ui.success(`Payment of Rs. ${Number(payForm.value.amount).toLocaleString('en-IN')} logged.`)
    payModal.value = false
    await loadData()
  } catch { ui.error('Failed to log payment') }
  finally { saving.value = false }
}

// ── Per-record Complaint Receipt PDF ──────────────────────────────────────────
async function exportComplaintPDF(c) {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()
    const M = _MARGIN
    const W = _PAGE_W

    let y = await _drawReceiptHeader(doc, 'Complaint Service Receipt', `#${c.complaintNumber || c.id?.slice(0, 10) || '—'} · ${c.priority || '—'} priority`)

    // ── Complaint Details ────────────────────────────────────────────────────
    y = _sectionLabel(doc, 'Complaint Details', y, _C.red)
    y = _infoGrid(doc, [
      ['Client Name', c.clientName || '—'],
      ['Status', formatStatus(c.status)],
      ['Client Phone', c.clientPhone || '—'],
      ['Scheduled Date', formatDate(c.scheduledDate || c.createdAt)],
      ['Address', c.address || '—'],
      ['Assigned To', (c.assignedTechnicians || [c.assignedTo]).filter(Boolean).join(', ') || '—'],
      ['Arrival Date', c.arrivalDate ? formatDate(c.arrivalDate) : '—'],
      ['Arrival Time', c.arrivalTime || '—'],
      ['Completed By', c.completedBy || '—'],
      ['Resolved At', c.resolvedAt ? formatDate(c.resolvedAt) : '—'],
    ], y)

    // ── Issue Information ─────────────────────────────────────────────────────
    y = _sectionLabel(doc, 'Issue Information', y, _C.greyText)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(..._C.midGrey)
    doc.text('Issue Type', M, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
    doc.text(c.issueType || '—', M, y + 5)
    y += 12

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(..._C.midGrey)
    doc.text('Complaint Description', M, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
    const descLines = doc.splitTextToSize(c.description || '—', W - M * 2)
    doc.text(descLines, M, y + 5)
    y += descLines.length * 5 + 10

    if (c.completionDescription) {
      if (y > _RECEIPT.CONTENT_MAX_Y) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(..._C.midGrey)
      doc.text('Resolution Description (What Was Done)', M, y)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
      const resLines = doc.splitTextToSize(c.completionDescription, W - M * 2)
      doc.text(resLines, M, y + 5)
      y += resLines.length * 5 + 10
    }

    // ── Customer Satisfaction ────────────────────────────────────────────────
    if (c.customerRating) {
      if (y > _RECEIPT.CONTENT_MAX_Y) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      y = _sectionLabel(doc, 'Customer Satisfaction', y, _C.greyText)
      const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(..._C.black)
      doc.text(`Rating: ${c.customerRating} / 5  (${ratingLabels[c.customerRating] || ''})`, M, y)
      y += 7
      if (c.customerFeedback) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.midGrey)
        const fbLines = doc.splitTextToSize(`"${c.customerFeedback}"`, W - M * 2)
        doc.text(fbLines, M, y)
        y += fbLines.length * 5 + 6
      }
    }

    // ── Signatures ───────────────────────────────────────────────────────────
    if (c.arrivalSignature || c.completionSignature) {
      if (y > _RECEIPT.CONTENT_MAX_Y - 40) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      y = _sectionLabel(doc, 'Signatures', y, _C.greyText)
      y += 2
      const sigW = (W - M * 2 - 6) / 2
      _drawBlackSig(doc, M, y, sigW, 38, 'ARRIVAL SIGNATURE', c.arrivalSignature, c.signatoryName || '—', c.signatoryDesignation)
      _drawBlackSig(doc, M + sigW + 6, y, sigW, 38, 'RESOLUTION SIGNATURE', c.completionSignature, c.completedBy || '—', '')
      y += 42
    }

    await _drawReceiptFooter(doc)
    await savePDF(doc, `Complaint-Receipt-${(c.clientName || c.id || 'record').replace(/\s+/g, '_')}.pdf`, ui)
    ui.success('Receipt PDF downloaded')
  } catch (e) {
    console.error(e)
    ui.error('Failed to generate PDF')
  }
}

// ── Bulk Export ───────────────────────────────────────────────────────────────
function triggerExport(type) {
  showExportDialog({
    rows: complaints.value,
    dateField: 'scheduledDate',
    columns: ['Complaint #', 'Client', 'Phone', 'Issue Type', 'Priority', 'Status', 'Assigned To', 'Date'],
    title: 'Complaints Report',
    filename: 'complaints',
    accent: [245, 158, 11],
    ui,
    pdfRowMapper: c => [
      c.complaintNumber || '—',
      c.clientName || '—',
      c.clientPhone || '—',
      c.issueType || '—',
      c.priority || '—',
      formatStatus(c.status),
      c.assignedTo || '—',
      formatDate(c.scheduledDate || c.createdAt),
    ],
    excelRowMapper: c => [
      c.complaintNumber || '—',
      c.clientName || '—',
      c.clientPhone || '—',
      c.issueType || '—',
      c.priority || '—',
      formatStatus(c.status),
      c.assignedTo || '—',
      formatDate(c.scheduledDate || c.createdAt),
    ],
  })
  if (type) expType.value = type
}

// ── Excel Import ──────────────────────────────────────────────────────────────
const showImportModal = ref(false)
const importFile = ref(null)
const importPreview = ref([])
const importError = ref('')
const importSkipped = ref(0)
const importing = ref(false)

const importColumns = [
  { key: 'clientName', example: 'Sharma Towers', required: true },
  { key: 'clientPhone', example: '9876543210', required: false },
  { key: 'address', example: 'MG Road, Pune', required: false },
  { key: 'issueType', example: 'Door Issue', required: true },
  { key: 'priority', example: 'high', required: true },
  { key: 'status', example: 'open', required: false },
  { key: 'assignedTo', example: 'Ravi Kumar', required: false },
  { key: 'scheduledDate', example: '2024-03-15', required: false },
  { key: 'description', example: 'Cabin door not closing', required: false },
]

function onImportFile(e) {
  importError.value = ''
  importPreview.value = []
  importSkipped.value = 0
  const file = e.target.files[0]
  if (!file) return
  importFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const valid = []
      let skipped = 0
      rows.forEach(row => {
        const clientName = String(row.clientName || row['Client Name'] || row['client_name'] || '').trim()
        const issueType = String(row.issueType || row['Issue Type'] || row['issue_type'] || '').trim()
        const priority = String(row.priority || row['Priority'] || '').trim().toLowerCase()
        if (!clientName || !issueType || !priority) { skipped++; return }
        valid.push({
          clientName,
          clientPhone: String(row.clientPhone || row['Client Phone'] || '').trim(),
          address: String(row.address || row['Address'] || '').trim(),
          issueType,
          priority,
          status: String(row.status || 'open').trim(),
          assignedTo: String(row.assignedTo || row['Assigned To'] || '').trim(),
          scheduledDate: String(row.scheduledDate || row['Scheduled Date'] || '').trim(),
          description: String(row.description || row['Description'] || '').trim(),
        })
      })
      importPreview.value = valid
      importSkipped.value = skipped
      if (!valid.length) importError.value = 'No valid rows found. Check column names match expected format.'
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
      await create(Collections.COMPLAINTS, { ...row, complaintNumber: generateComplaintNumber(), createdAt: new Date() })
      success++
    } catch {}
  }
  ui.success(`Imported ${success} complaint(s).`)
  closeImport()
  await loadData()
  importing.value = false
}

function closeImport() {
  showImportModal.value = false
  importFile.value = null
  importPreview.value = []
  importError.value = ''
  importSkipped.value = 0
}

// ── Pre-fill from QR ticket ────────────────────────────────────────────────────
watch(() => ui.ticketContext, (ctx) => {
  if (!ctx || ctx.tab !== 'complaints') return
  editingId.value = null
  form.value = defaultForm()
  const now = new Date()
  form.value.scheduledDate = now.toISOString().slice(0, 10)
  form.value.scheduledTime = now.toTimeString().slice(0, 5)
  form.value.projectId = ctx.projectId || ''
  form.value.issueType = ctx.issueType || ''
  form.value.description = ctx.description ? `[QR Ticket ${ctx.ticketRef || ''}] ${ctx.description}` : ''
  useProject.value = true
  cmpProjectSearch.value = ctx.projectName || ''
  showModal.value = true
  ui.clearTicketContext()
}, { immediate: true })

onMounted(loadData)
</script>

<style scoped>
.complaints-view { padding: 0; }
.page-sub { font-size: 13px; color:var(--ct-muted); margin-top: 4px; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
</style>
