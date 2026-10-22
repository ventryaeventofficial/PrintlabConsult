// ==========================================================================
// TOAST NOTIFICATION UTILITY
// ==========================================================================
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="dismissToast(this.parentElement)">
      <i data-lucide="x"></i>
    </button>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Auto Dismiss
  setTimeout(() => {
    dismissToast(toast);
  }, duration);
}

function dismissToast(toastElement) {
  if (!toastElement || toastElement.classList.contains('toast-exit')) return;
  toastElement.classList.add('toast-exit');
  toastElement.addEventListener('animationend', () => {
    toastElement.remove();
  });
}

// Confirmation Modal Promise Helper
function showConfirmModal(itemName, title = 'Delete Confirmation') {
  return new Promise((resolve) => {
    const modal = document.getElementById('deleteModal');
    const titleEl = document.getElementById('deleteModalTitle');
    const nameEl = document.getElementById('deleteModalItemName');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');

    if (!modal) {
      resolve(confirm('Are you sure you want to delete this item?'));
      return;
    }

    if (titleEl) titleEl.innerText = title;
    if (nameEl) nameEl.innerText = itemName;

    modal.classList.remove('hidden');

    const handleConfirm = () => {
      cleanup();
      modal.classList.add('hidden');
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      modal.classList.add('hidden');
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Utility: HTML Sanitizer
function escapeHtml(str) {
  return str
    ? String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m]))
    : "";
}

// ==========================================================================
// 1. FIREBASE INITIALIZATION & GLOBAL CONFIG
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBc5AIvYXC3ts3IwDTSSEBRBETQDMOAGu0",
  authDomain: "printlab-consult.firebaseapp.com",
  projectId: "printlab-consult",
  storageBucket: "printlab-consult.firebasestorage.app",
  messagingSenderId: "548275857281",
  appId: "1:548275857281:web:0fb62e3e8ed2a2a4092a80",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Centralized API Base URL (Routes to backend port 5000 when running locally)
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

// App State
let allBookings = [];
let allServices = [];
let allTeamMembers = [];
let allTestimonials = [];
let allFaqs = [];
let allSubscribers = [];
const whatsappPhone = "2347073165168";

// ==========================================================================
// 2. UNIFIED AUTHENTICATED FETCH HELPER
// ==========================================================================
async function authFetch(endpoint, options = {}) {
  const user = auth.currentUser;
  let token = null;

  if (user) {
    token = await user.getIdToken(/* forceRefresh */ true);
    localStorage.setItem("adminToken", token);
  } else {
    token = localStorage.getItem("adminToken");
  }

  if (!token) {
    window.location.href = "login.html";
    throw new Error("User not authenticated.");
  }

  const headers = { ...(options.headers || {}) };
  headers["Authorization"] = `Bearer ${token}`;

  // Automatically set Content-Type ONLY if not sending FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  } else {
    delete headers["Content-Type"];
  }

  // FIXED TEMPLATE LITERAL SYNTAX HERE
  const fullUrl = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    await auth.signOut().catch(() => {});
    localStorage.removeItem("adminToken");
    window.location.href = "login.html";
    throw new Error("Unauthorized session expired.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  return response;
}

// Helper: Standard Headers with Token
const getAuthHeaders = () => {
  const token = localStorage.getItem("adminToken");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// ==========================================================================
// 3. AUTH STATE LISTENER (SINGLE ENTRY POINT)
// ==========================================================================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    localStorage.removeItem("adminToken");
    window.location.href = "login.html";
    return;
  }

  // Prevent Dashboard Flash: Reveal admin container only when authenticated
  const adminWrapper = document.getElementById("adminContent") || document.body;
  if (adminWrapper) {
    adminWrapper.style.display = "block";
  }

  const adminNameElement = document.getElementById("admin-name");
  if (adminNameElement) {
    adminNameElement.textContent = user.displayName || user.email;
  }

  // Load all initial dashboard data
  fetchBookings();
  fetchAdminServices();
  fetchAdminTeam();
  loadCategories();
  loadProjects();
  loadAdminTestimonials();
  fetchAdminFaqs();
  fetchAdminSubscribers();
});

// ==========================================================================
// 4. BOOKINGS MANAGEMENT
// ==========================================================================
async function fetchBookings() {
  const tbody = document.getElementById("bookingsTableBody");
  const tableLoader = document.getElementById("tableLoader");
  const emptyState = document.getElementById("emptyState");

  if (tableLoader) tableLoader.classList.remove("hidden");
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("hidden");

  try {
    const res = await authFetch("/api/admin/bookings");
    const data = await res.json();

    if (data.success) {
      allBookings = data.bookings;
      renderDashboard();
    } else {
      throw new Error(data.message || "Failed to load bookings");
    }
  } catch (err) {
    console.error("Failed to load bookings:", err);
    if (tableLoader) {
      tableLoader.textContent = err.message || "Error connecting to backend server.";
    }
  } finally {
    if (tableLoader) tableLoader.classList.add("hidden");
  }
}

function renderDashboard() {
  const totalCount = document.getElementById("totalCount");
  const pendingCount = document.getElementById("pendingCount");
  const confirmedCount = document.getElementById("confirmedCount");
  const completedCount = document.getElementById("completedCount");

  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const serviceFilter = document.getElementById("serviceFilter");
  const tbody = document.getElementById("bookingsTableBody");
  const emptyState = document.getElementById("emptyState");

  // Update Counters
  if (totalCount) totalCount.textContent = allBookings.length;
  if (pendingCount) pendingCount.textContent = allBookings.filter((b) => b.status === "Pending").length;
  if (confirmedCount) confirmedCount.textContent = allBookings.filter((b) => b.status === "Confirmed").length;
  if (completedCount) completedCount.textContent = allBookings.filter((b) => b.status === "Completed").length;

  // Filter Logic
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const selStatus = statusFilter ? statusFilter.value : "ALL";
  const selService = serviceFilter ? serviceFilter.value : "ALL";

  const filtered = allBookings.filter((b) => {
    const matchesSearch =
      (b.name && b.name.toLowerCase().includes(query)) ||
      (b.email && b.email.toLowerCase().includes(query)) ||
      (b.id && b.id.toLowerCase().includes(query));

    const matchesStatus = selStatus === "ALL" || b.status === selStatus;
    const matchesService = selService === "ALL" || b.service === selService;

    return matchesSearch && matchesStatus && matchesService;
  });

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  tbody.innerHTML = filtered
    .map(
      (b) => `
      <tr>
        <td>
          <strong>${escapeHtml(b.id)}</strong><br/>
          <small style="color:#888;">${new Date(b.createdAt).toLocaleDateString()}</small>
        </td>
        <td>
          <strong>${escapeHtml(b.name)}</strong><br/>
          <small style="color:#aaa;">${escapeHtml(b.phone)} • ${escapeHtml(b.email)}</small>
        </td>
        <td><strong>${escapeHtml(b.service)}</strong></td>
        <td>${escapeHtml(b.date)}<br/><small style="color:#aaa;">@ ${escapeHtml(b.time)}</small></td>
        <td>
          <select class="status-select ${b.status}" onchange="updateStatus('${b.id}', this.value)">
            <option value="Pending" ${b.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Confirmed" ${b.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
            <option value="Completed" ${b.status === "Completed" ? "selected" : ""}>Completed</option>
            <option value="Cancelled" ${b.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon wa" title="Message Client on WhatsApp" onclick="openWhatsApp('${escapeHtml(b.name)}', '${escapeHtml(b.phone)}', '${escapeHtml(b.service)}')">
              <i data-lucide="message-square"></i>
            </button>
            <button class="btn-icon delete" title="Delete Booking" onclick="deleteBooking('${b.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

window.updateStatus = async (id, newStatus) => {
  try {
    const res = await authFetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();

    if (data.success) {
      const item = allBookings.find((b) => b.id === id);
      if (item) item.status = newStatus;
      renderDashboard();
      showToast(`Booking ${id} status updated to ${newStatus}`, "success");
    } else {
      showToast(data.message || "Failed to update status.", "error");
    }
  } catch (err) {
    console.error("Update Status Error:", err);
    showToast("Failed to update status.", "error");
  }
};

window.openWhatsApp = (name, phone, service) => {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const text = `Hello ${name}, this is Printlab Consult following up on your booking request for "${service}".`;
  window.open(`https://wa.me/${cleanPhone || whatsappPhone}?text=${encodeURIComponent(text)}`, "_blank");
};

window.deleteBooking = (id) => {
  openDeleteModal("Delete Booking", `Booking ${id}`, async () => {
    const res = await authFetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (data.success) {
      allBookings = allBookings.filter((b) => b.id !== id);
      renderDashboard();
      showToast(`Booking ${id} deleted successfully.`, "success");
    } else {
      showToast(data.message || "Failed to delete booking.", "error");
    }
  });
};

// ==========================================================================
// 5. SERVICES MANAGEMENT
// ==========================================================================
async function fetchAdminServices() {
  const container = document.getElementById("services-grid-admin");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/services`);
    const data = await res.json();

    if (data.success) {
      allServices = data.services;
      renderAdminServices();
    }
  } catch (err) {
    console.error("Error fetching services:", err);
  }
}

function renderAdminServices() {
  const container = document.getElementById("services-grid-admin");
  if (!container) return;

  if (allServices.length === 0) {
    container.innerHTML = `<p style="color: #888;">No services created yet.</p>`;
    return;
  }

  container.innerHTML = allServices
    .map(
      (s) => `
      <div style="background: #222; padding: 16px; border-radius: 8px; border: 1px solid #333; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="color: #fff; font-size: 16px; margin: 0;">${escapeHtml(s.title)}</h4>
          <button onclick="deleteService('${s._id}', '${escapeHtml(s.title)}')" style="background: none; border: none; color: #ff4d4d; cursor: pointer; padding: 4px;">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <p style="color: #aaa; font-size: 13px; margin-bottom: 12px;">${escapeHtml(s.description)}</p>
        <div style="display: flex; gap: 8px;">
          <small style="color: #25D366; background: rgba(37,211,102,0.1); padding: 2px 8px; border-radius: 4px;">Icon: ${escapeHtml(s.icon)}</small>
          ${s.badge ? `<small style="color: #4da6ff; background: rgba(77,166,255,0.1); padding: 2px 8px; border-radius: 4px;">Badge: ${escapeHtml(s.badge)}</small>` : ''}
        </div>
      </div>
    `
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

window.deleteService = (id, serviceTitle) => {
  openDeleteModal("Delete Service", `"${serviceTitle || "this service"}"`, async () => {
    const res = await authFetch(`/api/admin/services/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (data.success) {
      showToast("Service deleted successfully.", "success");
      fetchAdminServices();
    } else {
      showToast(data.message || "Failed to delete service.", "error");
    }
  });
};

// ==========================================================================
// 6. TEAM MANAGEMENT
// ==========================================================================
async function fetchAdminTeam() {
  try {
    const res = await authFetch(`/api/team`);
    const data = await res.json();
    if (data.success) {
      allTeamMembers = data.team;
      renderAdminTeamList(allTeamMembers);
    }
  } catch (err) {
    console.error("Failed to load team members:", err);
  }
}

function renderAdminTeamList(members) {
  const container = document.getElementById("admin-team-list");
  if (!container) return;

  if (!members || members.length === 0) {
    container.innerHTML = `<p style="color:#888;">No team members added yet.</p>`;
    return;
  }

  container.innerHTML = members
    .map(
      (m) => `
    <div class="team-card">
      <img src="${m.imageUrl || "https://via.placeholder.com/200?text=No+Image"}" alt="${escapeHtml(m.name)}" />
      <div class="team-info">
        <h4>${escapeHtml(m.name)}</h4>
        <p class="role">${escapeHtml(m.role)}</p>
        <div class="card-actions">
          <button type="button" class="btn-sm btn-edit" onclick="editTeamMember('${m._id}')">Edit</button>
          <button type="button" class="btn-sm btn-delete" onclick="deleteTeamMember('${m._id}', '${escapeHtml(m.name)}')">Delete</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

window.editTeamMember = (id) => {
  const member = allTeamMembers.find((m) => m._id === id);
  if (!member) return;

  const teamForm = document.getElementById("team-form");
  const previewContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("team-image-preview");

  document.getElementById("team-member-id").value = member._id;
  document.getElementById("team-name").value = member.name;
  document.getElementById("team-role").value = member.role;
  document.getElementById("team-bio").value = member.bio || "";
  document.getElementById("team-linkedin").value = member.linkedin || "";
  document.getElementById("team-twitter").value = member.twitter || "";

  if (member.imageUrl && imagePreview && previewContainer) {
    imagePreview.src = member.imageUrl;
    previewContainer.classList.remove("hidden");
  } else if (previewContainer) {
    previewContainer.classList.add("hidden");
  }

  const titleEl = document.getElementById("team-form-title");
  const saveBtn = document.getElementById("save-team-btn");
  const cancelBtn = document.getElementById("cancel-team-edit-btn");

  if (titleEl) titleEl.textContent = "Edit Team Member";
  if (saveBtn) saveBtn.textContent = "Update Member";
  if (cancelBtn) cancelBtn.classList.remove("hidden");

  if (teamForm) teamForm.scrollIntoView({ behavior: "smooth" });
};

window.deleteTeamMember = (id, name) => {
  openDeleteModal("Delete Team Member", `"${name || "this team member"}"`, async () => {
    const res = await authFetch(`/api/admin/team/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast("Team member deleted successfully.", "success");
      fetchAdminTeam();
    } else {
      showToast(data.message || "Failed to delete member.", "error");
    }
  });
};

function resetTeamForm() {
  const teamForm = document.getElementById("team-form");
  const previewContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("team-image-preview");
  const titleEl = document.getElementById("team-form-title");
  const saveBtn = document.getElementById("save-team-btn");
  const cancelBtn = document.getElementById("cancel-team-edit-btn");

  if (teamForm) teamForm.reset();
  const idInput = document.getElementById("team-member-id");
  if (idInput) idInput.value = "";

  if (previewContainer) previewContainer.classList.add("hidden");
  if (imagePreview) imagePreview.src = "";
  if (titleEl) titleEl.textContent = "Add New Team Member";
  if (saveBtn) saveBtn.textContent = "Add Member";
  if (cancelBtn) cancelBtn.classList.add("hidden");
}

// ==========================================================================
// 7. CATEGORIES, PROJECTS & TESTIMONIALS LOGIC (GLOBAL SCOPE)
// ==========================================================================
async function loadCategories() {
  const categoriesList = document.getElementById("categoriesList");
  const projectCategorySelect = document.getElementById("projectCategory");
  if (!categoriesList || !projectCategorySelect) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    const data = await res.json();

    if (data.success) {
      projectCategorySelect.innerHTML = '<option value="">-- Choose a Category --</option>';
      categoriesList.innerHTML = '';

      if (data.categories.length === 0) {
        categoriesList.innerHTML = '<li>No categories created yet.</li>';
        return;
      }

      data.categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat._id;
        option.textContent = cat.name;
        projectCategorySelect.appendChild(option);

        const li = document.createElement("li");
        li.className = "category-item";
        li.innerHTML = `
          <span><strong>${escapeHtml(cat.name)}</strong> ${cat.description ? `- ${escapeHtml(cat.description)}` : ''}</span>
          <button class="btn-delete-sm" style="background: #dc3545; color: #fff; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;" onclick="deleteCategory('${cat._id}', '${escapeHtml(cat.name)}')">Delete</button>
        `;
        categoriesList.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

async function loadProjects() {
  const projectsTableBody = document.getElementById("projectsTableBody");
  if (!projectsTableBody) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/projects`);
    const data = await res.json();

    if (data.success) {
      projectsTableBody.innerHTML = "";

      if (data.projects.length === 0) {
        projectsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">No past projects uploaded yet.</td></tr>`;
        return;
      }

      data.projects.forEach((proj) => {
        const row = document.createElement("tr");
        const createdDate = new Date(proj.createdAt).toLocaleDateString();
        const categoryName = proj.category ? proj.category.name : "Uncategorized";

        row.innerHTML = `
          <td>
            <img src="${proj.imageUrl}" alt="${escapeHtml(proj.title)}" class="table-thumb" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />
          </td>
          <td><strong>${escapeHtml(proj.title)}</strong></td>
          <td><span class="badge-category">${escapeHtml(categoryName)}</span></td>
          <td>${escapeHtml(proj.clientName || 'N/A')}</td>
          <td>${createdDate}</td>
          <td>
            <button class="btn-delete-sm" style="background: #dc3545; color: #fff; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;" onclick="deleteProject('${proj._id}', '${escapeHtml(proj.title)}')">Delete</button>
          </td>
        `;
        projectsTableBody.appendChild(row);
      });
    }
  } catch (err) {
    console.error("Error loading projects:", err);
  }
}

async function loadAdminTestimonials() {
  const adminTestimonialList = document.getElementById("adminTestimonialList");
  if (!adminTestimonialList) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/testimonials`);
    const data = await res.json();

    if (data.success && data.testimonials.length > 0) {
      adminTestimonialList.innerHTML = data.testimonials.map((item) => `
        <div style="background: #111827; color: #fcfafa; padding: 1.2rem; border-radius: 10px; border: 1px solid #1f293d; position: relative;">
          <div style="color: #f59e0b; font-size: 0.9rem; margin-bottom: 0.4rem;">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</div>
          <p style="font-style: italic; font-size: 0.95rem; margin-bottom: 0.8rem;">"${escapeHtml(item.testimony)}"</p>
          <h4 style="margin: 0; font-size: 1rem; color: #f3f4f6;">${escapeHtml(item.name)}</h4>
          <span style="font-size: 0.85rem; color: #666;">${escapeHtml(item.role)}</span>
          <button onclick="deleteTestimonial('${item._id}')" style="margin-top: 1rem; background: #ef4444; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>
        </div>
      `).join("");
    } else {
      adminTestimonialList.innerHTML = `<p style="color: #888;">No testimonials added yet.</p>`;
    }
  } catch (err) {
    console.error("Error loading testimonials:", err);
  }
}

window.deleteCategory = async (id, name) => {
  openDeleteModal("Delete Category", `"${name}" (and all its related projects)`, async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/categories/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success) {
      showToast("Category deleted successfully.", "success");
      loadCategories();
      loadProjects();
    } else {
      showToast(`Error: ${data.message}`, "error");
    }
  });
};

window.deleteProject = async (id, title) => {
  openDeleteModal("Delete Project", `"${title}"`, async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/projects/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success) {
      showToast("Project deleted successfully.", "success");
      loadProjects();
    } else {
      showToast(`Error: ${data.message}`, "error");
    }
  });
};

window.deleteTestimonial = async (id) => {
  openDeleteModal("Delete testimonial", `"${id}"`, async () => {
    const res = await fetch(`${API_BASE_URL}/api/testimonials/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success) {
      showToast("Review deleted successfully.", "success");
      loadAdminTestimonials();
    } else {
      showToast(`Error: ${data.message}`, "error");
    }
  });
};

// ==========================================================================
// 8. FAQ & SUBSCRIBER MANAGEMENT
// ==========================================================================
window.handleAddFaq = async function(e) {
  if (e) e.preventDefault();

  const questionInput = document.getElementById("faq-question");
  const answerInput = document.getElementById("faq-answer");
  const submitBtn = document.getElementById("faq-submit-btn");

  const question = questionInput.value.trim();
  const answer = answerInput.value.trim();

  if (!question || !answer) {
    showToast("Please fill in both question and answer.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const res = await authFetch("/api/admin/faqs", {
      method: "POST",
      body: JSON.stringify({ question, answer }),
    });

    const data = await res.json();

    if (data.success) {
      showToast("FAQ added successfully!", "success");
      questionInput.value = "";
      answerInput.value = "";
      fetchAdminFaqs();
    } else {
      showToast(data.message || "Failed to add FAQ.", "error");
    }
  } catch (err) {
    console.error("Error adding FAQ:", err);
    showToast("An error occurred while saving FAQ.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add FAQ";
  }
};

async function fetchAdminFaqs() {
  const container = document.getElementById("admin-faqs-list");
  if (!container) return;

  try {
    const res = await authFetch("/api/admin/faqs");
    const data = await res.json();

    if (data.success) {
      allFaqs = data.faqs;
      renderAdminFaqs();
    }
  } catch (err) {
    console.error("Failed to load FAQs:", err);
  }
}

function renderAdminFaqs() {
  const container = document.getElementById("admin-faqs-list");
  if (!container) return;

  if (!allFaqs || allFaqs.length === 0) {
    container.innerHTML = `<p style="color:#888;">No FAQs added yet.</p>`;
    return;
  }

  container.innerHTML = allFaqs
    .map(
      (faq) => `
      <div class="admin-card" style="background: #222; padding: 16px; border-radius: 8px; border: 1px solid #333; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div style="flex: 1;">
            <h4 style="color: #fff; margin: 0; font-size: 15px; overflow-wrap: break-word;">${escapeHtml(faq.question)}</h4>
            <p style="color: #ccc; font-size: 13px; margin-top: 8px; line-height: 1.4; overflow-wrap: break-word;">${escapeHtml(faq.answer)}</p>
          </div>
          <button class="btn-icon delete" title="Delete FAQ" onclick="deleteFaq('${faq._id}', '${escapeHtml(faq.question)}')">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

window.deleteFaq = (id, questionText) => {
  openDeleteModal(
    "Delete FAQ",
    `question "${questionText}"`,
    async () => {
      const res = await authFetch(`/api/admin/faqs/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        showToast("FAQ deleted successfully.", "success");
        fetchAdminFaqs();
      } else {
        showToast(data.message || "Failed to delete FAQ.", "error");
      }
    }
  );
};

async function fetchAdminSubscribers() {
  const container = document.getElementById("admin-subscribers-list");
  if (!container) return;

  try {
    const res = await authFetch("/api/admin/subscribers");
    const data = await res.json();

    if (data.success) {
      allSubscribers = data.subscribers;
      
      const badge = document.getElementById("subscriber-count-badge");
      if (badge) badge.textContent = `${allSubscribers.length} Subscriber${allSubscribers.length === 1 ? '' : 's'}`;

      renderAdminSubscribers();
    }
  } catch (err) {
    console.error("Failed to load subscribers:", err);
  }
}

function renderAdminSubscribers() {
  const container = document.getElementById("admin-subscribers-list");
  if (!container) return;

  if (!allSubscribers || allSubscribers.length === 0) {
    container.innerHTML = `<p style="color:#888;">No subscribers yet.</p>`;
    return;
  }

  container.innerHTML = allSubscribers
    .map(
      (sub) => `
      <div class="admin-card" style="background: #222; padding: 16px; border-radius: 8px; border: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
        <div style="overflow: hidden;">
          <p style="color: #fff; font-weight: 600; margin: 0; font-size: 14px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${escapeHtml(sub.email)}
          </p>
          <small style="color: #777; font-size: 11px;">Joined ${new Date(sub.createdAt).toLocaleDateString()}</small>
        </div>
        <button class="btn-icon delete" title="Remove Subscriber" onclick="deleteSubscriber('${sub._id}', '${escapeHtml(sub.email)}')" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 6px;">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

window.deleteSubscriber = (id, email) => {
  openDeleteModal(
    "Remove Subscriber",
    `subscriber "${email}"`,
    async () => {
      const res = await authFetch(`/api/admin/subscribers/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        showToast("Subscriber removed.", "success");
        fetchAdminSubscribers();
      } else {
        showToast(data.message || "Failed to remove subscriber.", "error");
      }
    }
  );
};

window.exportSubscribersToCSV = function () {
  if (!allSubscribers || allSubscribers.length === 0) {
    showToast("No subscribers available to export.", "error");
    return;
  }

  const headers = ["ID", "Email Address", "Date Subscribed"];
  const rows = allSubscribers.map((sub) => {
    const id = `"${(sub._id || "").replace(/"/g, '""')}"`;
    const email = `"${(sub.email || "").replace(/"/g, '""')}"`;
    const dateFormatted = sub.createdAt
      ? `"${new Date(sub.createdAt).toLocaleDateString()} ${new Date(sub.createdAt).toLocaleTimeString()}"`
      : '""';

    return [id, email, dateFormatted].join(",");
  });

  const csvString = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const dateStamp = new Date().toISOString().split("T")[0];
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", url);
  downloadAnchor.setAttribute("download", `newsletter_subscribers_${dateStamp}.csv`);
  downloadAnchor.style.display = "none";

  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);

  URL.revokeObjectURL(url);
  showToast("Subscribers exported to CSV successfully!", "success");
};

// ==========================================================================
// 9. DELETE MODAL LOGIC
// ==========================================================================
let pendingDeleteCallback = null;

const openDeleteModal = (title, itemName, onConfirm) => {
  const deleteModal = document.getElementById("deleteModal");
  const deleteModalTitle = document.getElementById("deleteModalTitle");
  const deleteModalItemName = document.getElementById("deleteModalItemName");

  if (deleteModalTitle) deleteModalTitle.textContent = title;
  if (deleteModalItemName) deleteModalItemName.textContent = itemName;

  pendingDeleteCallback = onConfirm;
  if (deleteModal) deleteModal.classList.remove("hidden");
};

const hideDeleteModal = () => {
  const deleteModal = document.getElementById("deleteModal");
  pendingDeleteCallback = null;
  if (deleteModal) deleteModal.classList.add("hidden");
};

// ==========================================================================
// 10. DOM EVENT LISTENERS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const serviceFilter = document.getElementById("serviceFilter");
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logout-btn");

  if (searchInput) searchInput.addEventListener("input", renderDashboard);
  if (statusFilter) statusFilter.addEventListener("change", renderDashboard);
  if (serviceFilter) serviceFilter.addEventListener("change", renderDashboard);
  if (refreshBtn) refreshBtn.addEventListener("click", fetchBookings);

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
        localStorage.removeItem("adminToken");
        window.location.href = "login.html";
      } catch (error) {
        console.error("Logout Error:", error);
      }
    });
  }

  // Delete Modal Buttons
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const deleteModal = document.getElementById("deleteModal");

  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) hideDeleteModal();
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (typeof pendingDeleteCallback !== "function") return;

      const originalText = confirmDeleteBtn.textContent;
      confirmDeleteBtn.textContent = "Deleting...";
      confirmDeleteBtn.disabled = true;

      try {
        await pendingDeleteCallback();
      } catch (err) {
        console.error("Delete Action Error:", err);
        showToast("An error occurred during deletion.", "error");
      } finally {
        confirmDeleteBtn.textContent = originalText;
        confirmDeleteBtn.disabled = false;
        hideDeleteModal();
      }
    });
  }

  // Add Service Form Handler
  const addServiceForm = document.getElementById("add-service-form") || document.getElementById("service-form");
  if (addServiceForm) {
    addServiceForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = document.getElementById("service-title")?.value.trim() || "";
      const description = (document.getElementById("service-desc") || document.getElementById("service-description"))?.value.trim() || "";
      const icon = document.getElementById("service-icon")?.value.trim() || "default-icon";
      const badge = document.getElementById("service-badge")?.value.trim() || "Service";

      try {
        const res = await authFetch("/api/admin/services", {
          method: "POST",
          body: JSON.stringify({ title, description, badge, icon }),
        });

        const data = await res.json();

        if (data.success) {
          showToast("Service added successfully!", "success");
          addServiceForm.reset();
          fetchAdminServices();
        } else {
          showToast(data.message || "Failed to add service.", "error");
        }
      } catch (err) {
        console.error("Add Service Error:", err);
        showToast("Failed to add service.", "error");
      }
    });
  }

  // Team Form Handler
  const teamForm = document.getElementById("team-form");
  const imageFileInput = document.getElementById("team-image-file");
  const previewContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("team-image-preview");
  const cancelTeamEditBtn = document.getElementById("cancel-team-edit-btn");

  if (imageFileInput) {
    imageFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file && imagePreview && previewContainer) {
        imagePreview.src = URL.createObjectURL(file);
        previewContainer.classList.remove("hidden");
      }
    });
  }

  if (cancelTeamEditBtn) {
    cancelTeamEditBtn.addEventListener("click", resetTeamForm);
  }

  if (teamForm) {
    teamForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("team-member-id")?.value;
      const isEdit = Boolean(id);

      const formData = new FormData();
      formData.append("name", document.getElementById("team-name")?.value.trim() || "");
      formData.append("role", document.getElementById("team-role")?.value.trim() || "");
      formData.append("bio", document.getElementById("team-bio")?.value.trim() || "");
      formData.append("linkedin", document.getElementById("team-linkedin")?.value.trim() || "");
      formData.append("twitter", document.getElementById("team-twitter")?.value.trim() || "");

      if (imageFileInput?.files[0]) {
        formData.append("image", imageFileInput.files[0]);
      }

      const endpoint = isEdit ? `/api/admin/team/${id}` : `/api/admin/team`;
      const method = isEdit ? "PUT" : "POST";

      try {
        const res = await authFetch(endpoint, {
          method,
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          showToast(`Team member ${isEdit ? "updated" : "added"} successfully!`, "success");
          resetTeamForm();
          fetchAdminTeam();
        } else {
          showToast(data.message || "Operation failed.", "error");
        }
      } catch (err) {
        console.error("Error saving team member:", err);
        showToast("Failed to save team member.", "error");
      }
    });
  }

  // Create Category Form
  const createCategoryForm = document.getElementById("createCategoryForm");
  if (createCategoryForm) {
    createCategoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("categoryName")?.value.trim();
      const description = document.getElementById("categoryDescription")?.value.trim();

      if (!name) return showToast("Category name is required.", "error");

      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/categories`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, description }),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Category created successfully!", "success");
          createCategoryForm.reset();
          loadCategories();
        } else {
          showToast(`Error: ${data.message}`, "error");
        }
      } catch (err) {
        console.error("Error creating category:", err);
        showToast("Failed to create category.", "error");
      }
    });
  }

  // Upload Project Form
  const uploadProjectForm = document.getElementById("uploadProjectForm");
  const projectCategorySelect = document.getElementById("projectCategory");
  if (uploadProjectForm) {
    uploadProjectForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = document.getElementById("projectTitle")?.value.trim();
      const categoryId = projectCategorySelect?.value;
      const clientName = document.getElementById("clientName")?.value.trim();
      const description = document.getElementById("projectDescription")?.value.trim();
      const imageFile = document.getElementById("projectImage")?.files[0];

      if (!title || !categoryId || !imageFile) {
        return showToast("Title, Category, and Image are required.", "error");
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("categoryId", categoryId);
      formData.append("clientName", clientName);
      formData.append("description", description);
      formData.append("image", imageFile);

      const submitBtn = document.getElementById("uploadProjectBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading an Item...";
      }

      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${API_BASE_URL}/api/admin/projects`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          showToast("Project uploaded successfully!", "success");
          uploadProjectForm.reset();
          loadProjects();
        } else {
          showToast(`Upload Failed: ${data.message}`, "error");
        }
      } catch (err) {
        console.error("Error uploading project:", err);
        showToast("Failed to upload project.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Upload Project";
        }
      }
    });
  }

  // Testimonials Form
  const testimonialForm = document.getElementById("testimonialForm");
  if (testimonialForm) {
    testimonialForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        name: document.getElementById("tClientName").value.trim(),
        role: document.getElementById("tClientRole").value.trim(),
        rating: document.getElementById("tRating").value,
        testimony: document.getElementById("tContent").value.trim()
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/testimonials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
          showToast("Review added successfully.", "success");
          testimonialForm.reset();
          loadAdminTestimonials();
        } else {
          showToast(`Error: ${data.message}`, "error");
        }
      } catch (err) {
        console.error("Submission Error:", err);
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('admin-sidebar');
  const mainContent = document.querySelector('.admin-main');
  const toggleBtn = document.getElementById('toggle-sidebar-btn');
  const expandBtn = document.getElementById('expand-sidebar-btn');

  function collapseSidebar() {
    sidebar.classList.add('collapsed');
    mainContent.classList.add('expanded');
    expandBtn.classList.remove('hidden');
    localStorage.setItem('sidebarCollapsed', 'true');
  }

  function expandSidebar() {
    sidebar.classList.remove('collapsed');
    mainContent.classList.remove('expanded');
    expandBtn.classList.add('hidden');
    localStorage.setItem('sidebarCollapsed', 'false');
  }

  if (toggleBtn) toggleBtn.addEventListener('click', collapseSidebar);
  if (expandBtn) expandBtn.addEventListener('click', expandSidebar);

  // Preserve user preference across page reloads
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    collapseSidebar();
  }
});

