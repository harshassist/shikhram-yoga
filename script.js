const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Synchronize primary navigation, direct links, and header actions across all pages
function initNavigation() {
  const currentPath = window.location.pathname.replace(/\/$/, '');
  const isHome = currentPath === '' || currentPath.endsWith('/index.html') || currentPath === '/';
  const homePrefix = isHome ? '' : 'index.html';

  const isStory = currentPath.endsWith('/story.html');
  const isTeachers = currentPath.endsWith('/teachers.html');
  const isForYou = currentPath.endsWith('/for-you.html');
  const isCorporate = currentPath.endsWith('/corporate.html');
  const isRetreats = currentPath.endsWith('/retreats.html');
  const isPartnerships = currentPath.endsWith('/partnerships.html');
  const isShop = currentPath.endsWith('/shop.html');
  const isBlog = currentPath.endsWith('/blog.html');
  const isNutrition = currentPath.endsWith('/nutrition.html');

  // Synchronize brand link and approved logo lockup across all pages
  document.querySelectorAll('.site-header .brand, .inner-header .brand, .sound-header .brand').forEach((brand) => {
    brand.setAttribute('href', 'index.html');
    brand.setAttribute('aria-label', 'Shikhram Yoga home');
    brand.innerHTML = `
      <img class="brand-lockup" src="assets/brand/logo-lockup-cream.png" alt="Shikhram Yoga — The Path to the Highest Self">
      <img class="brand-mark" src="assets/brand/logo-mark-cream.png" alt="" aria-hidden="true">
    `;
    if (isHome) {
      brand.addEventListener('click', (e) => {
        if (window.scrollY > 0) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  });

  // Ensure persistent Bag button exists across all page headers
  document.querySelectorAll('.site-header .header-actions').forEach((actions) => {
    if (!actions.querySelector('.icon-button')) {
      const bagBtn = document.createElement('button');
      bagBtn.className = 'icon-button';
      bagBtn.setAttribute('aria-label', 'Open shopping bag');
      bagBtn.innerHTML = 'Bag <span>0</span>';
      actions.insertBefore(bagBtn, actions.firstChild);
    }
  });

  // Build synchronized direct navigation markup across all pages (no dropdowns)
  document.querySelectorAll('.site-header nav').forEach((nav) => {
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = `
      <a href="story.html" class="nav-link ${isStory ? 'active' : ''}" ${isStory ? 'aria-current="page"' : ''}>Our Story</a>
      <a href="for-you.html" class="nav-link ${isForYou ? 'active' : ''}" ${isForYou ? 'aria-current="page"' : ''}>For You</a>
      <a href="teachers.html" class="nav-link ${isTeachers ? 'active' : ''}" ${isTeachers ? 'aria-current="page"' : ''}>Teachers</a>
      <a href="nutrition.html" class="nav-link ${isNutrition ? 'active' : ''}" ${isNutrition ? 'aria-current="page"' : ''}>Nutrition</a>
      <a href="retreats.html" class="nav-link ${isRetreats ? 'active' : ''}" ${isRetreats ? 'aria-current="page"' : ''}>Retreats</a>
      <a href="corporate.html" class="nav-link ${isCorporate ? 'active' : ''}" ${isCorporate ? 'aria-current="page"' : ''}>For Teams</a>
      <a href="partnerships.html" class="nav-link ${isPartnerships ? 'active' : ''}" ${isPartnerships ? 'aria-current="page"' : ''}>Partnerships</a>
      <a href="shop.html" class="nav-link ${isShop ? 'active' : ''}" ${isShop ? 'aria-current="page"' : ''}>Shop</a>
      <a href="blog.html" class="nav-link ${isBlog ? 'active' : ''}" ${isBlog ? 'aria-current="page"' : ''}>Blog</a>
    `;
  });

  // Close mobile navigation drawer when clicking outside
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) {
      document.querySelectorAll('.site-header.is-menu-open').forEach((h) => {
        h.classList.remove('is-menu-open');
        h.querySelector('.menu-button')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // Dismiss mobile drawer on Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.site-header.is-menu-open').forEach((h) => {
        h.classList.remove('is-menu-open');
        h.querySelector('.menu-button')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // Close mobile navigation drawer when selecting any link
  document.querySelectorAll('.site-header nav a').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.site-header.is-menu-open').forEach((h) => {
        h.classList.remove('is-menu-open');
        h.querySelector('.menu-button')?.setAttribute('aria-expanded', 'false');
      });
    });
  });

  // Mobile menu button toggle
  document.querySelectorAll('.menu-button').forEach((btn) => {
    btn.setAttribute('aria-label', 'Open navigation menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const header = btn.closest('.site-header');
      if (!header) return;
      const isOpen = header.classList.toggle('is-menu-open');
      btn.setAttribute('aria-expanded', String(isOpen));
      btn.textContent = isOpen ? 'Close' : 'Menu';
    });
  });

  // Close mobile menu when clicking outside header
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) {
      document.querySelectorAll('.site-header.is-menu-open').forEach(h => {
        h.classList.remove('is-menu-open');
        const btn = h.querySelector('.menu-button');
        if (btn) {
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = 'Menu';
        }
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavigation);
} else {
  initNavigation();
}


// Real-time search and multi-criteria category filtering for Retreats, Teachers, and The Edit (Shop)
function initSearchAndFilter() {
  const toolsBar = document.querySelector('.inner-tools');
  if (!toolsBar) return;

  const searchInput = toolsBar.querySelector('.tool-search-input');
  const clearBtn = toolsBar.querySelector('.tool-search-clear');
  const filterButtons = toolsBar.querySelectorAll('.filter-button');
  const counterEl = toolsBar.querySelector('.tool-counter');
  const gridContainer = document.querySelector('#retreat-list, #teachers-list, .product-grid, .page-grid');

  function getItemType() {
    const path = window.location.pathname;
    if (path.includes('retreats.html')) return 'journey';
    if (path.includes('teachers.html')) return 'guide';
    if (path.includes('shop.html')) return 'product';
    if (path.includes('blog.html')) return 'article';
    return 'item';
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  function applyFilters() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const activeBtn = toolsBar.querySelector('.filter-button.active');
    const activeFilter = activeBtn ? (activeBtn.dataset.filter || 'all').toLowerCase() : 'all';

    if (clearBtn) {
      clearBtn.hidden = !query;
    }

    const filterItems = document.querySelectorAll('.filter-item');
    let visibleCount = 0;
    const totalCount = filterItems.length;

    filterItems.forEach((item) => {
      const tags = (item.dataset.tags || '').toLowerCase().split(/\s+/);
      const content = (item.textContent || '').toLowerCase();
      const retreatGroup = (item.dataset.retreat || '').toLowerCase();
      const serviceName = (item.dataset.service || '').toLowerCase();

      // 1. Category Filter Matching
      let matchesCategory = false;
      if (activeFilter === 'all') {
        matchesCategory = true;
      } else if (activeFilter === 'available') {
        const isWaitlist = tags.includes('waitlist') || item.classList.contains('waitlist-trigger') || content.includes('waitlist');
        matchesCategory = !isWaitlist;
      } else {
        matchesCategory = tags.includes(activeFilter) || content.includes(activeFilter);
      }

      // 2. Search Query Matching (multi-token search)
      let matchesQuery = true;
      if (query) {
        const queryTerms = query.split(/\s+/).filter(Boolean);
        matchesQuery = queryTerms.every(term =>
          content.includes(term) ||
          tags.some(t => t.includes(term)) ||
          retreatGroup.includes(term) ||
          serviceName.includes(term)
        );
      }

      const isVisible = matchesCategory && matchesQuery;
      item.hidden = !isVisible;
      if (!isVisible) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
        visibleCount++;
      }
    });

    // Filter weekly schedule rows on teachers page if present
    const scheduleArticles = document.querySelectorAll('.schedule-list article');
    if (scheduleArticles.length) {
      scheduleArticles.forEach((row) => {
        const rowTags = (row.dataset.scheduleTags || '').toLowerCase();
        const rowContent = (row.textContent || '').toLowerCase();
        let rowMatch = true;
        if (query) {
          const queryTerms = query.split(/\s+/).filter(Boolean);
          rowMatch = queryTerms.every(term => rowContent.includes(term) || rowTags.includes(term));
        }
        row.hidden = !rowMatch;
      });
    }

    // Update Result Counter
    if (counterEl) {
      const type = getItemType();
      const plural = visibleCount === 1 ? type : (type === 'journey' ? 'journeys' : type + 's');
      if (query || activeFilter !== 'all') {
        counterEl.textContent = `Showing ${visibleCount} of ${totalCount} ${plural}`;
      } else {
        counterEl.textContent = `${totalCount} ${plural}`;
      }
    }

    // Empty State Handling
    const existingEmpty = gridContainer ? gridContainer.querySelector('.tool-empty-state') : document.querySelector('.tool-empty-state');
    if (visibleCount === 0) {
      if (!existingEmpty && gridContainer) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'tool-empty-state';
        const type = getItemType();
        const pluralType = type === 'journey' ? 'journeys' : type + 's';
        emptyCard.innerHTML = `
          <p class="sanskrit">अन्वेषणम्</p>
          <h3>No matching ${pluralType} found</h3>
          <p>We couldn't find any results matching "<strong>${escapeHtml(query || activeFilter)}</strong>". Try searching with different keywords or reset your filters.</p>
          <button type="button" class="button button-small tool-reset-btn">Reset search &amp; filters</button>
        `;
        gridContainer.appendChild(emptyCard);
        emptyCard.querySelector('.tool-reset-btn')?.addEventListener('click', resetFilters);
      } else if (existingEmpty) {
        existingEmpty.hidden = false;
        existingEmpty.style.display = '';
        const msg = existingEmpty.querySelector('p:not(.sanskrit)');
        if (msg) {
          msg.innerHTML = `We couldn't find any results matching "<strong>${escapeHtml(query || activeFilter)}</strong>". Try searching with different keywords or reset your filters.`;
        }
      }
    } else if (existingEmpty) {
      existingEmpty.hidden = true;
      existingEmpty.style.display = 'none';
    }
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    filterButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    applyFilters();
    if (searchInput) searchInput.focus();
  }

  // Bind search input events
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') resetFilters();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      applyFilters();
    });
  }

  // Bind filter button events
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      
      // Keep URL updated with active filter
      const fVal = (button.dataset.filter || 'all').toLowerCase();
      if (window.history.replaceState) {
        const url = new URL(window.location);
        if (fVal === 'all') {
          url.searchParams.delete('filter');
        } else {
          url.searchParams.set('filter', fVal);
        }
        window.history.replaceState({}, '', url);
      }
      
      applyFilters();
    });
  });

  // Read initial query params from URL on load
  const currentParams = new URLSearchParams(window.location.search);
  const initialQuery = currentParams.get('q');
  const initialFilter = (currentParams.get('filter') || '').toLowerCase();

  if (initialQuery && searchInput) {
    searchInput.value = initialQuery;
  }

  if (initialFilter && filterButtons.length) {
    let matched = false;
    filterButtons.forEach((btn) => {
      const bFilter = (btn.dataset.filter || '').toLowerCase();
      if (bFilter === initialFilter) {
        btn.classList.add('active');
        matched = true;
      } else {
        btn.classList.remove('active');
      }
    });
    if (!matched && searchInput && !searchInput.value) {
      searchInput.value = initialFilter;
    }
  }



  window.refreshSearchAndFilter = applyFilters;
  applyFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearchAndFilter);
} else {
  initSearchAndFilter();
}


// Floating WhatsApp Concierge & Help Notification Widget
function initWhatsAppConcierge() {
  if (document.getElementById('wa-concierge')) return;

  const phoneDisplay = '+91 79773 81156';
  const phoneDigits = '917977381156';
  const path = window.location.pathname;
  let defaultText = 'Hi, I have a question about Shikhram Yoga.';
  if (path.includes('teachers.html')) {
    defaultText = 'Hi, I would like to inquire about booking a yoga session with Shikhram Yoga.';
  } else if (path.includes('retreats.html')) {
    defaultText = 'Hi, I need help choosing a Shikhram Yoga retreat.';
  } else if (path.includes('corporate.html')) {
    defaultText = 'Hi, I would like a corporate wellness proposal for our team.';
  } else if (path.includes('partnerships.html')) {
    defaultText = 'Hi, I would like to explore a wellness retreat partnership with Shikhram Yoga.';
  } else if (path.includes('nutrition.html')) {
    defaultText = 'Hi, I would like to book a holistic nutrition consultation with Shikhram.';
  } else if (path.includes('sound-healing.html')) {
    defaultText = 'Hi, I would like to inquire about a sound healing session.';
  } else if (path.includes('shop.html')) {
    defaultText = 'Hi, I have a question about Shikhram Edit products.';
  }

  const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(defaultText)}`;

  const root = document.createElement('div');
  root.className = 'wa-concierge-root';
  root.id = 'wa-concierge';
  root.setAttribute('aria-live', 'polite');

  root.innerHTML = `
    <div class="wa-popover" id="wa-popover" role="dialog" aria-label="WhatsApp Concierge Notification" style="display: none;">
      <button class="wa-popover-close" id="wa-popover-close" aria-label="Close notification">×</button>
      <div class="wa-popover-header">
        <span class="wa-online-dot" aria-hidden="true"></span>
        <span class="wa-popover-badge">Concierge · WhatsApp</span>
      </div>
      <h3 class="wa-popover-title">Need help with your practice?</h3>
      <p class="wa-popover-body">Chat directly with our Shikhram wellness team on WhatsApp at <strong style="color:#f7f1e6; font-weight:600; white-space:nowrap;">${phoneDisplay}</strong>. Tap below to start a chat with our guides.</p>
      <a class="wa-popover-btn" href="${waUrl}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31"/></svg>
        <span>Start WhatsApp Chat ↗</span>
      </a>
    </div>
    <button class="wa-pill" id="wa-pill" type="button" aria-expanded="false" aria-controls="wa-popover" aria-label="Need help? Chat with us on WhatsApp">
      <div class="wa-icon-wrap">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31"/></svg>
        <span class="wa-status-beacon" aria-hidden="true"></span>
      </div>
      <span class="wa-pill-label">Need help? <b>Chat with us</b></span>
    </button>
  `;

  document.body.appendChild(root);

  const popover = root.querySelector('#wa-popover');
  const pill = root.querySelector('#wa-pill');
  const closeBtn = root.querySelector('#wa-popover-close');

  function openPopover() {
    popover.style.display = 'block';
    pill.setAttribute('aria-expanded', 'true');
  }

  function closePopover() {
    popover.style.display = 'none';
    pill.setAttribute('aria-expanded', 'false');
    sessionStorage.setItem('shikhram-wa-seen', 'closed');
  }

  function togglePopover(e) {
    if (e) e.stopPropagation();
    if (popover.style.display === 'none' || !popover.style.display) {
      openPopover();
    } else {
      closePopover();
    }
  }

  pill.addEventListener('click', togglePopover);
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popover.style.display !== 'none') {
      closePopover();
    }
  });

  // WhatsApp widget opens exclusively on user click — no intrusive auto-popups
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWhatsAppConcierge);
} else {
  initWhatsAppConcierge();
}


if (!reduceMotion && window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.timeline({defaults:{ease:'power3.out'}})
    .from('.site-header', {y:-80, opacity:0, duration:1})
    .from('.hero .reveal', {y:38, opacity:0, stagger:.12, duration:1.05}, '-=.55')
    .from('.hero-note, .scroll-cue', {opacity:0, duration:.8}, '-=.25');

  gsap.to('.hero-image', {scale:1.12, yPercent:8, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  gsap.to('.retreat-backdrop', {yPercent:12, ease:'none', scrollTrigger:{trigger:'.retreat-section', start:'top bottom', end:'bottom top', scrub:true}});

  gsap.utils.toArray('section:not(.hero)').forEach((section) => {
    const targets = section.querySelectorAll('.eyebrow, h2, .section-heading > p');
    if (targets.length) gsap.from(targets, {y:42, opacity:0, stagger:.09, duration:.9, ease:'power2.out', scrollTrigger:{trigger:section, start:'top 78%', once:true}});
  });

  gsap.from('.practice-card', {x:60, opacity:0, stagger:.08, duration:.9, scrollTrigger:{trigger:'.practice-track', start:'top 78%', once:true}});
  gsap.from('.teacher-card', {y:70, opacity:0, stagger:.12, duration:.9, scrollTrigger:{trigger:'.teacher-grid', start:'top 80%', once:true}});
  gsap.from('.product', {y:60, opacity:0, stagger:.14, duration:.9, scrollTrigger:{trigger:'.products', start:'top 80%', once:true}});
}
