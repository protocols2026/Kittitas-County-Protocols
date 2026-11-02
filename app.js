(function () {
  const contentEl = document.getElementById('content');
  const tocEl = document.getElementById('toc');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuBtn = document.getElementById('menu-btn');
  const backBtn = document.getElementById('back-btn');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const offlineBadge = document.getElementById('offline-badge');

  let contentDoc = null;
  let headings = [];
  let searchIndex = [];

  // ---------- Load content ----------
  async function loadContent() {
    try {
      const res = await fetch('./content.html');
      const html = await res.text();
      const parser = new DOMParser();
      contentDoc = parser.parseFromString(html, 'text/html');

      // Build TOC and search index from headings
      const allHeadings = contentDoc.querySelectorAll('h1, h2, h3, h4');
      headings = [];
      allHeadings.forEach((h, i) => {
        let id = h.id || h.getAttribute('id');
        if (!id) {
          id = 'h-' + i;
          h.id = id;
        }
        const level = parseInt(h.tagName.substring(1), 10);
        const text = h.textContent.replace(/\s+/g, ' ').trim();
        if (!text || text.length < 2) return;
        headings.push({ id, text, level, el: h });
      });

      buildTOC();
      buildSearchIndex();
      showWelcome();
    } catch (err) {
      contentEl.innerHTML = '<div class="loading">Failed to load protocols. Check connection and reload.</div>';
      console.error(err);
    }
  }

  function buildTOC() {
    tocEl.innerHTML = '';
    headings.forEach((h) => {
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.text;
      a.dataset.id = h.id;
      if (h.level === 1 || /SECTION\s+[IVX]+/i.test(h.text)) {
        a.className = 'section';
      } else {
        a.className = 'level-' + Math.min(h.level, 3);
      }
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(h.id);
        closeSidebar();
      });
      tocEl.appendChild(a);
    });
  }

  function buildSearchIndex() {
    searchIndex = [];
    const body = contentDoc.body;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (/^H[1-4]$/.test(node.tagName)) {
        const id = node.id;
        const title = node.textContent.replace(/\s+/g, ' ').trim();
        let snippet = '';
        let sib = node.nextElementSibling;
        let count = 0;
        while (sib && count < 3) {
          if (/^H[1-4]$/.test(sib.tagName)) break;
          snippet += ' ' + (sib.textContent || '');
          sib = sib.nextElementSibling;
          count++;
        }
        snippet = snippet.replace(/\s+/g, ' ').trim().slice(0, 180);
        searchIndex.push({ id, title, snippet, text: (title + ' ' + snippet).toLowerCase() });
      }
    }
  }

  // ---------- Navigation ----------
  function navigateTo(id) {
    const target = contentDoc.getElementById(id);
    if (!target) return;

    const level = parseInt(target.tagName.substring(1), 10);
    const frag = document.createDocumentFragment();
    const clone = target.cloneNode(true);
    frag.appendChild(clone);

    let el = target.nextElementSibling;
    while (el) {
      if (/^H[1-4]$/.test(el.tagName)) {
        const nextLevel = parseInt(el.tagName.substring(1), 10);
        if (nextLevel <= level) break;
      }
      frag.appendChild(el.cloneNode(true));
      el = el.nextElementSibling;
    }

    contentEl.innerHTML = '';
    contentEl.appendChild(frag);
    contentEl.scrollTop = 0;

    tocEl.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));

    backBtn.style.display = 'flex';
    menuBtn.style.display = 'flex';
    history.replaceState({ id }, '', '#' + id);
  }

  function showWelcome() {
    contentEl.innerHTML = `
      <div class="welcome">
        <h2>Kittitas County ALS Protocols</h2>
        <p>Updated 10-2026 · Offline capable<br>Tap the menu or search to find a protocol.</p>
        <div class="quick-links">
          <button data-q="Airway">Airway</button>
          <button data-q="Cardiac Arrest">Cardiac Arrest</button>
          <button data-q="STEMI">STEMI / Chest Pain</button>
          <button data-q="Anaphylaxis">Anaphylaxis</button>
          <button data-q="Seizure">Seizures</button>
          <button data-q="Trauma">Trauma</button>
          <button data-q="Pediatric">Pediatrics</button>
          <button data-q="Medication">Medications</button>
        </div>
      </div>
    `;
    contentEl.querySelectorAll('.quick-links button').forEach((btn) => {
      btn.addEventListener('click', () => {
        searchInput.value = btn.dataset.q;
        doSearch(btn.dataset.q);
      });
    });
    backBtn.style.display = 'none';
    history.replaceState({}, '', location.pathname);
  }

  // ---------- Search ----------
  function doSearch(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) {
      searchResults.classList.remove('show');
      return;
    }
    const hits = searchIndex.filter((item) => item.text.includes(q)).slice(0, 40);
    if (hits.length === 0) {
      searchResults.innerHTML = '<p style="color:var(--text-muted);padding:20px;">No matches found.</p>';
    } else {
      searchResults.innerHTML = hits.map((h) => {
        const title = highlight(h.title, q);
        const snip = highlight(h.snippet, q);
        return `<div class="search-hit" data-id="${h.id}">
          <div class="title">${title}</div>
          <div class="snippet">${snip}</div>
        </div>`;
      }).join('');
      searchResults.querySelectorAll('.search-hit').forEach((el) => {
        el.addEventListener('click', () => {
          searchResults.classList.remove('show');
          searchInput.value = '';
          navigateTo(el.dataset.id);
          closeSidebar();
        });
      });
    }
    searchResults.classList.add('show');
  }

  function highlight(text, q) {
    if (!q) return text;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  // ---------- Sidebar ----------
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

  menuBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  });
  overlay.addEventListener('click', closeSidebar);
  backBtn.addEventListener('click', showWelcome);

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(searchInput.value), 180);
  });
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) doSearch(searchInput.value);
  });

  // ---------- Offline indicator ----------
  function updateOnlineStatus() {
    offlineBadge.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // ---------- Hash routing ----------
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id) navigateTo(id);
    else showWelcome();
  });

  // ---------- Service Worker ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
  }

  // Start
  loadContent();
})();
