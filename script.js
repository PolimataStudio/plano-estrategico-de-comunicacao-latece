/* ==========================================================================
   LATECE — Publicação Digital Institucional
   script.js — interações e acessibilidade
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const STORAGE_THEME = 'latece-theme';
  const STORAGE_SIDEBAR = 'latece-sidebar-open';

  /* ============================================================
     1. TEMA CLARO / ESCURO
     ============================================================ */
  function initTheme() {
    const root = document.documentElement;
    const btn = $('#themeToggle');
    if (!btn) return;
    const icon = $('.theme-toggle__icon', btn);

    const saved = localStorage.getItem(STORAGE_THEME);
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(initial);

    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(STORAGE_THEME, next);
    });

    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      const isDark = theme === 'dark';
      if (icon) icon.textContent = isDark ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label',
        isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
  }

  /* ============================================================
     2. SIDEBAR (desktop e mobile)
     ============================================================ */
  function initSidebar() {
    const sidebar = $('#sidebar');
    const toggle = $('#sidebarToggle');
    if (!sidebar || !toggle) return;

    // Em telas pequenas, começa fechado
    const isMobile = () => window.matchMedia('(max-width: 960px)').matches;

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar sumário' : 'Abrir sumário');
    }

    toggle.addEventListener('click', () => {
      const open = !sidebar.classList.contains('is-open');
      setOpen(open);
      if (open) {
        const first = sidebar.querySelector('a, button');
        if (first) first.focus();
      }
    });

    // Fecha ao clicar em um link (mobile)
    sidebar.addEventListener('click', (e) => {
      if (isMobile() && e.target.closest('.toc-link')) {
        setOpen(false);
      }
    });

    // Fecha com Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMobile() && sidebar.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Fecha ao clicar fora
    document.addEventListener('click', (e) => {
      if (!isMobile()) return;
      if (!sidebar.classList.contains('is-open')) return;
      if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });
  }

  /* ============================================================
     3. SCROLL SUAVE + FECHAR SIDEBAR EM LINKS INTERNOS
     ============================================================ */
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Atualiza hash sem “pular” (para deep linking)
        if (history.pushState) {
          history.pushState(null, '', id);
        } else {
          window.location.hash = id;
        }
        // Foco acessível no destino
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
      });
    });
  }

  /* ============================================================
     4. SCROLL SPY (destaque da seção atual no sumário)
     ============================================================ */
  function initScrollSpy() {
    const headings = $$('h1[id], h2[id], h3[id]');
    const tocLinks = $$('.toc-link');
    if (!headings.length || !tocLinks.length) return;

    const linkById = new Map();
    tocLinks.forEach((a) => {
      const id = a.getAttribute('href').replace('#', '');
      linkById.set(id, a);
    });

    function setActive(id) {
      tocLinks.forEach((a) => a.classList.remove('is-active'));
      const active = linkById.get(id);
      if (active) {
        active.classList.add('is-active');
      }
    }

    // Usa IntersectionObserver para performance
    if ('IntersectionObserver' in window) {
      const visible = new Map();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visible.set(entry.target.id, entry.target);
            } else {
              visible.delete(entry.target.id);
            }
          });
          // Escolhe o primeiro heading visível na ordem do documento
          const ordered = headings.filter((h) => visible.has(h.id));
          if (ordered.length) {
            setActive(ordered[0].id);
          }
        },
        {
          rootMargin: `-${getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim() || '76px'} 0px -60% 0px`,
          threshold: [0, 1]
        }
      );
      headings.forEach((h) => observer.observe(h));
    } else {
      // Fallback: scroll
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          const fromTop = window.scrollY + 120;
          let current = headings[0];
          for (const h of headings) {
            if (h.offsetTop <= fromTop) current = h;
            else break;
          }
          setActive(current.id);
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ============================================================
     5. BARRA DE PROGRESSO
     ============================================================ */
  function initProgressBar() {
    const bar = $('.progress-bar');
    const fill = $('#progressFill');
    if (!bar || !fill) return;

    function update() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      fill.style.width = pct.toFixed(2) + '%';
      bar.setAttribute('aria-valuenow', pct.toFixed(0));
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ============================================================
     6. BACK TO TOP
     ============================================================ */
  function initBackToTop() {
    const btn = $('#backToTop');
    if (!btn) return;

    function toggle() {
      btn.hidden = window.scrollY < 400;
    }
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const skip = $('.skip-link');
      if (skip) skip.focus({ preventScroll: true });
    });
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ============================================================
     7. IMPRESSÃO
     ============================================================ */
  function initPrint() {
    const btn = $('#printBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.print();
    });
  }

  /* ============================================================
     8. BUSCA INTERNA
     ============================================================ */
  function initSearch() {
    const openBtn = $('#searchBtn');
    const overlay = $('#searchOverlay');
    const closeBtn = $('#searchClose');
    const input = $('#searchInput');
    const status = $('#searchResults');
    const prevBtn = $('#searchPrev');
    const nextBtn = $('#searchNext');
    const main = $('#main-content');
    if (!openBtn || !overlay || !input || !main) return;

    let hits = [];       // elementos <mark>
    let current = -1;    // índice do hit atual
    let lastQuery = '';

    // Salva o HTML original do conteúdo para poder limpar a busca
    const originalHTML = main.innerHTML;

    function open() {
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      input.focus();
      input.select();
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = '';
      openBtn.focus();
    }

    openBtn.addEventListener('click', open);
    closeBtn && closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });

    // Fecha e reabre: se usuário fizer nova busca, limpamos e refazemos
    function resetHighlights() {
      // Restaura o HTML original (remove <mark> e classes)
      if (lastQuery) {
        main.innerHTML = originalHTML;
      }
    }

    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalize(str) {
      // Remove acentos para busca tolerante
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function highlight(query) {
      resetHighlights();
      lastQuery = query;
      hits = [];
      current = -1;

      const q = query.trim();
      if (q.length < 2) {
        status.textContent = q.length === 0
          ? 'Digite ao menos 2 caracteres.'
          : 'Digite ao menos 2 caracteres.';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }

      // Coleta nós de texto do conteúdo principal
      const walker = document.createTreeWalker(
        main,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      let n;
      while ((n = walker.nextNode())) textNodes.push(n);

      const needle = normalize(q);
      const re = new RegExp(escapeRegExp(needle), 'gi');
      // Normaliza o texto do nó e encontra índices no texto original
      // (implementação tolerante: trabalha com correspondência bruta também)
      const rawRe = new RegExp(escapeRegExp(q), 'gi');

      textNodes.forEach((node) => {
        const text = node.nodeValue;
        // Testa versão normalizada e versão bruta
        const hasNorm = normalize(text).includes(needle);
        const hasRaw = rawRe.test(text);
        rawRe.lastIndex = 0;
        if (!hasNorm && !hasRaw) return;

        // Substitui no texto bruto
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = rawRe.exec(text)) !== null) {
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }
          const mark = document.createElement('mark');
          mark.className = 'search-hit';
          mark.textContent = match[0];
          frag.appendChild(mark);
          hits.push(mark);
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode.replaceChild(frag, node);
      });

      if (hits.length === 0) {
        status.textContent = `Nenhum resultado para “${q}”.`;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }

      status.textContent = `${hits.length} ocorrência(s) encontrada(s) para “${q}”.`;
      prevBtn.disabled = false;
      nextBtn.disabled = false;
      goTo(0);
    }

    function goTo(index) {
      if (!hits.length) return;
      if (index < 0) index = hits.length - 1;
      if (index >= hits.length) index = 0;

      if (current >= 0 && hits[current]) {
        hits[current].classList.remove('is-current');
      }
      current = index;
      const el = hits[current];
      el.classList.add('is-current');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      status.textContent = `Ocorrência ${current + 1} de ${hits.length}.`;

      // Foco acessível
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }

    // Debounce simples
    let t;
    input.addEventListener('input', (e) => {
      clearTimeout(t);
      const val = e.target.value;
      t = setTimeout(() => highlight(val), 220);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (hits.length === 0) return;
        goTo(e.shiftKey ? current - 1 : current + 1);
      }
    });

    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
  }

  /* ============================================================
     9. DEEP LINKING NA CARGA
     ============================================================ */
  function initDeepLink() {
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        // Delay para garantir que o layout esteja pronto
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 60);
      }
    }
  }

  /* ============================================================
     10. FOCO VISÍVEL EM NAVEGAÇÃO POR TECLADO
     ============================================================ */
  function initKeyboardA11y() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.documentElement.classList.add('using-keyboard');
      }
    });
    document.addEventListener('mousedown', () => {
      document.documentElement.classList.remove('using-keyboard');
    });
  }

  /* ============================================================
     INICIALIZAÇÃO
     ============================================================ */
  function init() {
    try {
      initTheme();
      initSidebar();
      initSmoothScroll();
      initScrollSpy();
      initProgressBar();
      initBackToTop();
      initPrint();
      initSearch();
      initDeepLink();
      initKeyboardA11y();
    } catch (err) {
      // Não bloqueia o conteúdo em caso de erro
      console.error('[LATECE] Erro ao inicializar:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();