const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

const escapeHtml = (str) =>
  str ? String(str).replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])) : '';

document.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) lucide.createIcons();

  // Read ?catId=... from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  let activeCatId = urlParams.get('catId') || 'all';

  const titleEl = document.getElementById("selectedCategoryTitle");
  const badgeEl = document.getElementById("projectCountBadge");
  const pillsContainer = document.getElementById("categoryPills");
  const gridEl = document.getElementById("categoryProjectsGrid");

  // Modal DOM Elements
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalTitle = document.getElementById("modalTitle");
  const modalBadge = document.getElementById("modalBadge");
  const modalClient = document.getElementById("modalClient");
  const modalDesc = document.getElementById("modalDesc");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalOverlay = document.getElementById("modalOverlay");

  const openModal = (proj) => {
    if (!modal) return;
    modalImg.src = proj.imageUrl;
    modalImg.alt = proj.title || 'Project Preview';
    modalTitle.textContent = proj.title || 'Untitled Project';
    modalBadge.textContent = proj.category ? proj.category.name : 'Branding';

    if (proj.clientName) {
      modalClient.textContent = `Client: ${proj.clientName}`;
      modalClient.style.display = 'block';
    } else {
      modalClient.style.display = 'none';
    }

    if (proj.description) {
      modalDesc.textContent = proj.description;
      modalDesc.style.display = 'block';
    } else {
      modalDesc.style.display = 'none';
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; // Restore scrolling
  };

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (modalOverlay) modalOverlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeModal();
    }
  });

  try {
    const [catRes, projRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/categories`),
      fetch(`${API_BASE_URL}/api/projects`)
    ]);

    const catData = await catRes.json();
    const projData = await projRes.json();

    const categories = catData.success ? catData.categories : [];
    const projects = projData.success ? projData.projects : [];

    // Render Pill Buttons at top
    const renderPills = () => {
      let pillsHtml = `
        <button class="pill-btn ${activeCatId === 'all' ? 'active' : ''}" data-id="all">
          All Work
        </button>
      `;

      categories.forEach((cat) => {
        pillsHtml += `
          <button class="pill-btn ${activeCatId === cat._id ? 'active' : ''}" data-id="${cat._id}">
            ${escapeHtml(cat.name)}
          </button>
        `;
      });

      pillsContainer.innerHTML = pillsHtml;

      // Click event for pill buttons
      pillsContainer.querySelectorAll(".pill-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCatId = btn.getAttribute("data-id");

          // Update URL query string without page refresh
          const newUrl = new URL(window.location);
          newUrl.searchParams.set('catId', activeCatId);
          window.history.pushState({}, '', newUrl);

          renderPills();
          renderGrid();
        });
      });
    };

    // Render Project Cards Grid
    const renderGrid = () => {
      const filtered = activeCatId === "all"
        ? projects
        : projects.filter((p) => p.category && p.category._id === activeCatId);

      if (activeCatId === "all") {
        titleEl.textContent = "All Work";
      } else {
        const currentCat = categories.find((c) => c._id === activeCatId);
        titleEl.textContent = currentCat ? currentCat.name : "Category Projects";
      }

      badgeEl.textContent = `${filtered.length} Item${filtered.length === 1 ? '' : 's'}`;

      if (filtered.length === 0) {
        gridEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: #a1a1aa;">
            <p>No projects uploaded under this category yet.</p>
          </div>
        `;
        return;
      }

      gridEl.innerHTML = filtered.map((proj) => `
        <div class="project-card" data-id="${proj._id}">
          <div class="project-card-image">
            <img src="${proj.imageUrl}" alt="${escapeHtml(proj.title)}" loading="lazy" />
            <span class="project-badge">${escapeHtml(proj.category ? proj.category.name : 'Branding')}</span>
          </div>
          <div class="project-card-body">
            <h3>${escapeHtml(proj.title)}</h3>
            ${proj.clientName ? `<p class="client-name">Client: ${escapeHtml(proj.clientName)}</p>` : ''}
            ${proj.description ? `<p class="proj-desc">${escapeHtml(proj.description)}</p>` : ''}
          </div>
        </div>
      `).join("");

      // Attach Click Listener to Each Card to Open Enlarged Modal View
      gridEl.querySelectorAll(".project-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = card.getAttribute("data-id");
          const projectObj = projects.find((p) => String(p._id) === String(id));
          if (projectObj) {
            openModal(projectObj);
          }
        });
      });
    };

    renderPills();
    renderGrid();

  } catch (err) {
    console.error("Error loading category page:", err);
    if (gridEl) gridEl.innerHTML = `<p style="color: red; text-align: center;">Unable to load projects right now.</p>`;
  }
});