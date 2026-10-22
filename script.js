const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

// Initialize Lucide Icons
if (window.lucide) {
  lucide.createIcons();
}

// Responsive Mobile Menu (Hamburger Toggle)
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navLinks = document.getElementById('navLinks');

if (hamburgerBtn && navLinks) {
  hamburgerBtn.addEventListener('click', () => {
    hamburgerBtn.classList.toggle('nav-open');
    navLinks.classList.toggle('nav-open');
  });

  // Close mobile menu automatically when a navigation link is clicked
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      hamburgerBtn.classList.remove('nav-open');
      navLinks.classList.remove('nav-open');
    });
  });
}

// Scroll controls for Category Cards
const track = document.getElementById('categoriesTrack');
const scrollLeftBtn = document.getElementById('scrollLeft');
const scrollRightBtn = document.getElementById('scrollRight');

if (track && scrollLeftBtn && scrollRightBtn) {
  scrollLeftBtn.addEventListener('click', () => {
    track.scrollBy({ left: -320, behavior: 'smooth' });
  });

  scrollRightBtn.addEventListener('click', () => {
    track.scrollBy({ left: 320, behavior: 'smooth' });
  });
}

/* ==========================================
   AUTO-SCROLL + MANUAL (SERVICES SECTION ONLY)
========================================== */
function setupServicesAutoScroll(trackId, leftBtnId, rightBtnId, scrollAmount = 368, intervalTime = 3500) {
  const track = document.getElementById(trackId);
  const leftBtn = document.getElementById(leftBtnId);
  const rightBtn = document.getElementById(rightBtnId);

  if (!track) return;

  let autoScrollTimer;
  let isPaused = false;

  const scrollNext = () => {
    if (isPaused) return;

    const maxScrollLeft = track.scrollWidth - track.clientWidth;

    if (track.scrollLeft >= maxScrollLeft - 10) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const startAutoScroll = () => {
    clearInterval(autoScrollTimer);
    autoScrollTimer = setInterval(scrollNext, intervalTime);
  };

  track.addEventListener('mouseenter', () => { isPaused = true; });
  track.addEventListener('mouseleave', () => { isPaused = false; });
  track.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
  track.addEventListener('touchend', () => { isPaused = false; });

  if (leftBtn) {
    leftBtn.addEventListener('click', () => {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      startAutoScroll();
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener('click', () => {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      startAutoScroll();
    });
  }

  startAutoScroll();
}

setupServicesAutoScroll('servicesTrack', 'servicesScrollLeft', 'servicesScrollRight', 368, 3500);

/* ==========================================
   SCROLL TO TOP BUTTON LOGIC
========================================== */
const scrollTopBtn = document.getElementById('scrollToTopBtn');

if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add('show');
    } else {
      scrollTopBtn.classList.remove('show');
    }
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// ==========================================================================
// DYNAMIC PORTFOLIO & CATEGORY SCROLLER
// ==========================================================================
const initPortfolioSection = async () => {
  const categoriesTrack = document.getElementById("categoriesTrack");
  const scrollLeftBtn = document.getElementById("scrollLeft");
  const scrollRightBtn = document.getElementById("scrollRight");

  if (!categoriesTrack) return;

  const escapeHtml = (str) =>
    str ? String(str).replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])) : '';

  const DEFAULT_THUMB = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";

  try {
    // Fetch Categories and Projects from API
    const [catRes, projRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/categories`),
      fetch(`${API_BASE_URL}/api/projects`)
    ]);

    const catData = await catRes.json();
    const projData = await projRes.json();

    const categories = catData.success ? catData.categories : [];
    const projects = projData.success ? projData.projects : [];

    // Render Category Cards as Direct Links to category.html
    const renderCategoryTrack = () => {
      let trackHtml = `
        <a href="category.html?catId=all" class="category-card" style="text-decoration: none; color: inherit;">
          <div class="category-img">
            <img src="${projects.length > 0 ? projects[0].imageUrl : DEFAULT_THUMB}" alt="All Projects" />
          </div>
          <div class="category-info">
            <h3>All Projects</h3>
            <div class="category-arrow"><i data-lucide="arrow-up-right" style="width: 16px;"></i></div>
          </div>
        </a>
      `;

      categories.forEach((cat) => {
        const catProjects = projects.filter((p) => p.category && p.category._id === cat._id);
        const coverImg = catProjects.length > 0 ? catProjects[0].imageUrl : DEFAULT_THUMB;

        trackHtml += `
          <a href="category.html?catId=${cat._id}" class="category-card" style="text-decoration: none; color: inherit;">
            <div class="category-img">
              <img src="${coverImg}" alt="${escapeHtml(cat.name)}" />
            </div>
            <div class="category-info">
              <h3>${escapeHtml(cat.name)}</h3>
              <div class="category-arrow"><i data-lucide="arrow-up-right" style="width: 16px;"></i></div>
            </div>
          </a>
        `;
      });

      categoriesTrack.innerHTML = trackHtml;

      if (window.lucide) lucide.createIcons();
    };

    if (scrollLeftBtn && scrollRightBtn) {
      scrollLeftBtn.addEventListener("click", () => {
        categoriesTrack.scrollBy({ left: -320, behavior: "smooth" });
      });
      scrollRightBtn.addEventListener("click", () => {
        categoriesTrack.scrollBy({ left: 320, behavior: "smooth" });
      });
    }

    renderCategoryTrack();

  } catch (err) {
    console.error("Error setting up dynamic portfolio:", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initPortfolioSection();
});

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


/* ==========================================
   MODAL, FORM SUBMISSION & WHATSAPP INTEGRATION
========================================== */
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("bookingModal");
  const openBtn = document.getElementById("openModalBtn");
  const closeBtn = document.getElementById("closeModalBtn");
  const bookingForm = document.getElementById("bookingForm");
  const whatsappBtn = document.getElementById("whatsappBookingBtn");
  const statusBanner = document.getElementById("formStatusBanner");

  const whatsappPhone = "2347073165168";

  const getFormData = () => ({
    name: document.getElementById("clientName")?.value.trim() || "",
    phone: document.getElementById("clientPhone")?.value.trim() || "",
    email: document.getElementById("clientEmail")?.value.trim() || "",
    service: document.getElementById("serviceSelect")?.value || "",
    date: document.getElementById("deliveryDate")?.value || "",
    time: document.getElementById("deliveryTime")?.value || "",
  });

  const showStatus = (type, message) => {
    if (!statusBanner) return;
    statusBanner.className = `status-banner ${type}`;
    statusBanner.textContent = message;
  };

  const clearStatus = () => {
    if (!statusBanner) return;
    statusBanner.className = "status-banner hidden";
    statusBanner.textContent = "";
  };

  if (openBtn && modal) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearStatus();
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
    });
  }

  const closeModal = () => {
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      setTimeout(clearStatus, 300);
    }
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeModal();
    }
  });

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearStatus();

      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      const payload = getFormData();

      submitBtn.disabled = true;
      submitBtn.classList.add("btn-loading");
      submitBtn.innerHTML = `<span class="btn-spinner"></span> Submitting...`;

      try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showStatus("success", `✓ Booking received! We'll contact you shortly.`);
          bookingForm.reset();
          setTimeout(closeModal, 2500);
        } else {
          showStatus("error", result.message || "Unable to submit booking. Please try again.");
        }
      } catch (err) {
        console.error("Submission Error:", err);
        showStatus("error", "Network error. Please check your backend server or use WhatsApp.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("btn-loading");
        submitBtn.innerHTML = originalText;
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener("click", () => {
      const data = getFormData();
      if (!data.name || !data.service) {
        showStatus("error", "Please fill in your Name and Service before redirecting to WhatsApp.");
        return;
      }

      const message = `Hello Printlab Consult, I would like to book a service:
• Name: ${data.name}
• Phone: ${data.phone || 'N/A'}
• Email: ${data.email || 'N/A'}
• Service: ${data.service}
• Target Delivery Date: ${data.date || 'N/A'}
• Preferred Time: ${data.time || 'N/A'}`;

      window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, "_blank");
    });
  }

  const servicesTrack = document.getElementById("servicesTrack");

  const loadPublicServices = async () => {
    if (!servicesTrack) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/services`);
      const data = await res.json();

      if (data.success && data.services.length > 0) {
        servicesTrack.innerHTML = data.services
          .map((service) => {
            const iconName = service.icon || "layers";
            const badgeText = service.badge || "Service";

            const iconHtml = iconName.startsWith("fa-")
              ? `<i class="${escapeHtml(iconName)}"></i>`
              : `<i data-lucide="${escapeHtml(iconName)}"></i>`;

            return `
              <div class="service-card">
                <div>
                  <div class="service-card-top">
                    <div class="service-icon">
                      ${iconHtml}
                    </div>
                    <span class="service-badge">${escapeHtml(badgeText)}</span>
                  </div>
                  <h3>${escapeHtml(service.title)}</h3>
                  <p>${escapeHtml(service.description)}</p>
                </div>
              </div>
            `;
          })
          .join("");

        if (window.lucide) {
          lucide.createIcons();
        }
      }
    } catch (err) {
      console.error("Failed to render backend services:", err);
    }
  };

  const escapeHtml = (str) =>
    str ? String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) : "";

  function setupTeamAutoScroll(trackId, leftBtnId, rightBtnId, scrollAmount = 300, intervalTime = 3000) {
    const track = document.getElementById(trackId);
    const leftBtn = document.getElementById(leftBtnId);
    const rightBtn = document.getElementById(rightBtnId);

    if (!track) return;

    let autoScrollTimer;
    let isPaused = false;

    const scrollNext = () => {
      if (isPaused) return;

      const maxScrollLeft = track.scrollWidth - track.clientWidth;

      if (track.scrollLeft >= maxScrollLeft - 10) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    };

    const startAutoScroll = () => {
      clearInterval(autoScrollTimer);
      autoScrollTimer = setInterval(scrollNext, intervalTime);
    };

    track.addEventListener('mouseenter', () => { isPaused = true; });
    track.addEventListener('mouseleave', () => { isPaused = false; });
    track.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
    track.addEventListener('touchend', () => { isPaused = false; });

    if (leftBtn) {
      leftBtn.addEventListener('click', () => {
        track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        startAutoScroll();
      });
    }

    if (rightBtn) {
      rightBtn.addEventListener('click', () => {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        startAutoScroll();
      });
    }

    startAutoScroll();
  }

  const fetchPublicTeam = async () => {
    const container = document.getElementById("public-team-container");
    if (!container) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/team`);
      const data = await res.json();

      if (data.success && data.team.length > 0) {
        container.innerHTML = data.team
          .map(
            (member) => `
            <div class="team-card">
              <div class="team-card-image">
                <img src="${member.imageUrl || 'https://via.placeholder.com/400x400?text=Team+Member'}" alt="${escapeHtml(member.name)}" loading="lazy" />
              </div>
              <div class="team-card-content">
                <h3>${escapeHtml(member.name)}</h3>
                <span class="team-role">${escapeHtml(member.role)}</span>
                ${member.bio ? `<p class="team-bio">${escapeHtml(member.bio)}</p>` : ''}
                
                <div class="team-socials">
                  ${member.linkedin ? `<a href="${escapeHtml(member.linkedin)}" target="_blank" rel="noopener noreferrer"><i data-lucide="linkedin"></i></a>` : ''}
                  ${member.twitter ? `<a href="${escapeHtml(member.twitter)}" target="_blank" rel="noopener noreferrer"><i data-lucide="twitter"></i></a>` : ''}
                </div>
              </div>
            </div>
          `
          )
          .join("");

        if (window.lucide) lucide.createIcons();
        setupTeamAutoScroll("public-team-container", "teamScrollLeft", "teamScrollRight", 300, 3000);

      } else {
        container.innerHTML = `<p>Our team details are coming soon.</p>`;
      }
    } catch (err) {
      console.error("Error fetching public team:", err);
    }
  };

  loadPublicServices();
  fetchPublicTeam();


  /* ==========================================
AUTO-SCROLL TESTIMONIALS LOGIC 
========================================== */
let testimonialScrollInterval = null;

const initTestimonialAutoScroll = () => {
  const container = document.getElementById("publicTestimonialsGrid");
  if (!container) return;

  if (testimonialScrollInterval) clearInterval(testimonialScrollInterval);

  const scrollSpeed = 1; // Pixels per tick

  const stepScroll = () => {
    // Halfway mark calculation (since items are duplicated)
    const halfWidth = container.scrollWidth / 2;

    // Once scroll reaches or passes the first set of items, jump back to start instantly
    if (container.scrollLeft >= halfWidth) {
      container.scrollLeft = 0;
    } else {
      container.scrollLeft += scrollSpeed;
    }
  };

  const startAutoScroll = () => {
    if (!testimonialScrollInterval) {
      testimonialScrollInterval = setInterval(stepScroll, 20); // Smooth ~50fps motion
    }
  };

  const stopAutoScroll = () => {
    if (testimonialScrollInterval) {
      clearInterval(testimonialScrollInterval);
      testimonialScrollInterval = null;
    }
  };

  // Start scrolling
  startAutoScroll();

  // Pause on hover or touch
  container.addEventListener("mouseenter", stopAutoScroll);
  container.addEventListener("mouseleave", startAutoScroll);
  container.addEventListener("touchstart", stopAutoScroll, { passive: true });
  container.addEventListener("touchend", startAutoScroll, { passive: true });
};

const loadPublicTestimonials = async () => {
  const container = document.getElementById("publicTestimonialsGrid");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/testimonials`);
    const data = await res.json();

    if (data.success && data.testimonials.length > 0) {
      // Build card template
      const cardsHtml = data.testimonials.map((item) => {
        const fullStars = '<i data-lucide="star" style="fill: #f59e0b; color: #f59e0b; width: 16px;"></i>'.repeat(item.rating);
        const emptyStars = '<i data-lucide="star" style="color: #e4e4e7; width: 16px;"></i>'.repeat(5 - item.rating);

        return `
          <div class="testimonial-card">
            <div class="stars-wrap" style="display: flex; gap: 4px;">
              ${fullStars}${emptyStars}
            </div>
            
            <div class="testimonial-text-wrap">
              <p class="testimonial-text">"${escapeHtml(item.testimony)}"</p>
            </div>

            <div class="testimonial-author">
              <h4 style="margin: 0; font-weight: 700; font-size: 0.95rem; color: #111;">${escapeHtml(item.name)}</h4>
              <span style="font-size: 0.82rem; color: #666;">${escapeHtml(item.role)}</span>
            </div>
          </div>
        `;
      }).join("");

      // Duplicate array for seamless infinite scroll loop if 2 or more testimonials
      const finalHtml = data.testimonials.length > 1 ? cardsHtml + cardsHtml : cardsHtml;

      container.innerHTML = finalHtml;

      if (window.lucide) {
        lucide.createIcons();
      }

      if (data.testimonials.length > 1) {
        initTestimonialAutoScroll();
      }
    } else {
      container.innerHTML = `<p style="text-align: center; color: #777; width: 100%;">No client feedback available yet.</p>`;
    }
  } catch (err) {
    console.error("Error loading testimonials on homepage:", err);
  }
};


  loadPublicTestimonials();


//////////////////////////////REVIEW MODAL//////////////////////////////
const openReviewBtn = document.getElementById("openReviewModalBtn");
  const reviewModal = document.getElementById("clientReviewModal");
  const closeReviewBtn = document.getElementById("closeReviewModalBtn");
  const reviewOverlay = document.getElementById("reviewModalOverlay");
  const reviewForm = document.getElementById("clientReviewForm");
  const statusMsg = document.getElementById("reviewStatusMsg");

  // Open Modal
  if (openReviewBtn && reviewModal) {
    openReviewBtn.addEventListener("click", () => {
      reviewModal.classList.add("active");
      reviewModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    });
  }

  // Close Modal
  const closeReviewModal = () => {
    if (!reviewModal) return;
    reviewModal.classList.remove("active");
    reviewModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (statusMsg) statusMsg.style.display = "none";
  };

  if (closeReviewBtn) closeReviewBtn.addEventListener("click", closeReviewModal);
  if (reviewOverlay) reviewOverlay.addEventListener("click", closeReviewModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && reviewModal && reviewModal.classList.contains("active")) {
      closeReviewModal();
    }
  });

  // Handle Form Submission
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("submitReviewBtn");
      const originalText = submitBtn.innerHTML;

      const payload = {
        name: document.getElementById("crName").value.trim(),
        role: document.getElementById("crRole").value.trim(),
        rating: document.getElementById("crRating").value,
        testimony: document.getElementById("crTestimony").value.trim()
      };

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Submitting...";

      try {
        const response = await fetch(`${API_BASE_URL}/api/testimonials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
          statusMsg.style.display = "block";
          statusMsg.style.background = "#dcfce7";
          statusMsg.style.color = "#15803d";
          statusMsg.textContent = "✓ Thank you! Your review has been published.";

          reviewForm.reset();

          if (typeof loadPublicTestimonials === "function") {
            loadPublicTestimonials();
          }

          setTimeout(() => {
            closeReviewModal();
          }, 2000);
        } else {
          statusMsg.style.display = "block";
          statusMsg.style.background = "#fee2e2";
          statusMsg.style.color = "#b91c1c";
          statusMsg.textContent = data.message || "Failed to submit review. Please try again.";
        }
      } catch (err) {
        console.error("Error submitting review:", err);
        statusMsg.style.display = "block";
        statusMsg.style.background = "#fee2e2";
        statusMsg.style.color = "#b91c1c";
        statusMsg.textContent = "Server error. Please check your internet connection.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

});

// ==========================================================================
// LOAD & RENDER FAQS ON INDEX.HTML
// ==========================================================================
async function loadPublicFaqs() {
  const faqContainer = document.getElementById("faq-accordion") || document.querySelector(".faq-accordion");
  if (!faqContainer) return;

  try {
    const res = await fetch("http://localhost:5000/api/faqs");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();

    if (data.success && data.faqs && data.faqs.length > 0) {
      faqContainer.innerHTML = data.faqs
        .map(
          (faq, index) => `
          <details class="faq-item" ${index === 0 ? "open" : ""}>
            <summary>
              ${escapeHtml(faq.question)}
              <span class="faq-icon">+</span>
            </summary>
            <div class="faq-answer">
              ${escapeHtml(faq.answer)}
            </div>
          </details>
        `
        )
        .join("");
    } else {
      faqContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">No FAQs available at the moment.</p>`;
    }
  } catch (err) {
    console.error("Failed to load public FAQs:", err);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", loadPublicFaqs);

// ==========================================================================
// NEWSLETTER FORM SUBMISSION (INDEX PAGE)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const newsletterForm = document.getElementById("newsletter-form");
  if (!newsletterForm) return;

  newsletterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = newsletterForm.querySelector('input[type="email"]');
    const submitBtn = newsletterForm.querySelector('button[type="submit"]');

    if (!emailInput) return;

    const email = emailInput.value.trim();
    if (!email) return;

    const originalBtnText = submitBtn ? submitBtn.textContent : "Subscribe";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Subscribing...";
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || "Thank you for subscribing!", "success");
        emailInput.value = "";
      } else {
        showToast(data.message || "Something went wrong.", "error");
      }
    } catch (err) {
      console.error("Newsletter submission error:", err);
      showToast("Failed to subscribe. Please try again later.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
});