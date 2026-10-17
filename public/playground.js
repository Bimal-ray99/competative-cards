(() => {
  const $ = (id) => document.getElementById(id);

  const HIDE_OPTIONS = {
    overview: ['solved', 'easy', 'medium', 'hard', 'acceptance', 'ranking', 'streak'],
    problems: ['easy', 'medium', 'hard'],
    streak: ['streak', 'total', 'active'],
    rating: ['rating', 'maxRating', 'rank', 'maxRank', 'contests', 'solved', 'graph'],
    heatmap: [],
    combined: ['leetcode', 'codeforces', 'ranking', 'streak', 'rank', 'solved'],
    skills: [],
    languages: [],
  };

  // Overview card supports composite sections (skills/languages/heatmap
  // appended below the hero via the `sections=` param).
  const SECTION_OPTIONS = {
    overview: ['skills', 'languages', 'heatmap'],
  };

  const COLOR_KEYS = ['bg', 'border', 'text', 'muted', 'accent', 'streak', 'ring', 'fire', 'chip'];
  // title_color is handled separately because the DOM id collides with the
  // optional "custom title" text field.
  const SPECIAL = { title: 'title_color' };

  const state = { hide: new Set(), sections: new Set() };
  let updateSeq = 0;

  // Maps card type → required provider. Playground uses this to auto-pick a
  // sensible card when the user has only filled one provider, and to warn
  // when the current card can't render with the fields present.
  const CARD_REQUIRES = {
    overview: 'leetcode',
    problems: 'leetcode',
    streak: 'leetcode',
    skills: 'leetcode',
    languages: 'leetcode',
    rating: 'codeforces',
    heatmap: 'any',
    combined: 'any',
  };
  const DEFAULT_CARD_FOR = {
    leetcode: 'overview',
    codeforces: 'rating',
  };

  async function loadThemes() {
    try {
      const res = await fetch('/api/themes');
      const data = await res.json();
      const sel = $('theme');
      sel.innerHTML = '';
      for (const name of data.themes) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      }
      $('themeCount').textContent = `${data.themes.length} themes available`;
    } catch {
      const sel = $('theme');
      sel.innerHTML = '<option value="default">default</option>';
      $('themeCount').textContent = 'theme list unavailable';
    }
  }

  function buildChip(label, isActive, onToggle) {
    const chip = document.createElement('label');
    chip.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = isActive;
    input.addEventListener('change', () => {
      chip.classList.toggle('active', input.checked);
      onToggle(input.checked);
      schedule();
    });
    chip.appendChild(input);
    chip.appendChild(document.createTextNode(label));
    chip.classList.toggle('active', isActive);
    return chip;
  }

  function renderHideChips() {
    const type = $('type').value;
    const hideFields = HIDE_OPTIONS[type] || [];
    const sectionFields = SECTION_OPTIONS[type] || [];
    const wrap = $('hideChips');
    wrap.innerHTML = '';

    if (sectionFields.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'hint';
      heading.style.width = '100%';
      heading.style.margin = '0 0 6px';
      heading.textContent = 'Composite sections (append to card):';
      wrap.appendChild(heading);
      for (const field of sectionFields) {
        wrap.appendChild(
          buildChip(`+ ${field}`, state.sections.has(field), (on) => {
            if (on) state.sections.add(field);
            else state.sections.delete(field);
          }),
        );
      }
    }

    if (hideFields.length > 0) {
      if (sectionFields.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'hint';
        sep.style.width = '100%';
        sep.style.margin = '12px 0 6px';
        sep.textContent = 'Hide fields:';
        wrap.appendChild(sep);
      }
      for (const field of hideFields) {
        wrap.appendChild(
          buildChip(field, state.hide.has(field), (on) => {
            if (on) state.hide.add(field);
            else state.hide.delete(field);
          }),
        );
      }
    }

    if (hideFields.length === 0 && sectionFields.length === 0) {
      wrap.innerHTML =
        '<span class="hint">No hideable / composable fields for this card type.</span>';
    }
  }

  function buildUrl(themeOverride) {
    const params = new URLSearchParams();
    const lc = $('leetcode').value.trim();
    const cf = $('codeforces').value.trim();
    if (lc) params.set('leetcode', lc);
    if (cf) params.set('codeforces', cf);
    params.set('type', $('type').value);
    params.set('theme', themeOverride || $('theme').value);
    const title = $('title').value.trim();
    if (title) params.set('title', title);
    if (state.hide.size > 0) params.set('hide', [...state.hide].join(','));
    if (state.sections.size > 0) params.set('sections', [...state.sections].join(','));

    const radius = Number($('radius').value);
    if (radius !== 8) params.set('radius', String(radius));
    if ($('hide_border').checked) params.set('hide_border', 'true');
    if ($('transparent').checked) params.set('transparent', 'true');
    if ($('disable_animations').checked) params.set('disable_animations', 'true');
    if ($('short_numbers').checked) params.set('short_numbers', 'true');

    const ts = Number($('top_skills').value);
    const tl = Number($('top_langs').value);
    if (ts !== 12) params.set('top_skills', String(ts));
    if (tl !== 12) params.set('top_langs', String(tl));

    for (const key of COLOR_KEYS) {
      const el = $(key);
      if (!el) continue;
      const defaultVal = el.getAttribute('value');
      if (el.value && el.value.toLowerCase() !== (defaultVal || '').toLowerCase()) {
        params.set(key, el.value.replace(/^#/, ''));
      }
    }
    for (const [param, id] of Object.entries(SPECIAL)) {
      const el = $(id);
      if (!el) continue;
      const defaultVal = el.getAttribute('value');
      if (el.value && el.value.toLowerCase() !== (defaultVal || '').toLowerCase()) {
        params.set(param, el.value.replace(/^#/, ''));
      }
    }

    return `/api/card?${params.toString()}`;
  }

  function absolutize(path) {
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return path;
    }
  }

  function buildDualEmbed(baseAbsUrl, altName) {
    const u = new URL(baseAbsUrl);
    u.searchParams.set('theme', altName);
    const altUrl = u.toString();
    const label = altName;
    return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${baseAbsUrl}" />
  <source media="(prefers-color-scheme: light)" srcset="${altUrl}" />
  <img alt="${label} stats card" src="${baseAbsUrl}" />
</picture>`;
  }

  let timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(update, 200);
  }

  function setStatus(msg, kind = '') {
    const s = $('status');
    s.textContent = msg;
    s.className = kind;
  }

  function autoFixCardType() {
    const type = $('type').value;
    const need = CARD_REQUIRES[type];
    const have = {
      leetcode: !!$('leetcode').value.trim(),
      codeforces: !!$('codeforces').value.trim(),
    };
    if (need === 'any') return;
    if (!have[need]) {
      // Pick the first provider the user has filled.
      const filled = Object.keys(have).find((k) => have[k]);
      if (filled && DEFAULT_CARD_FOR[filled]) {
        $('type').value = DEFAULT_CARD_FOR[filled];
        state.hide.clear();
        renderHideChips();
      }
    }
  }

  function update() {
    const lc = $('leetcode').value.trim();
    const cf = $('codeforces').value.trim();
    if (!lc && !cf) {
      setStatus('Enter a LeetCode or Codeforces username to begin.');
      $('cardImg').removeAttribute('src');
      $('embedMd').value = '';
      $('dualEmbed').value = '';
      $('rawUrl').value = '';
      return;
    }
    autoFixCardType();

    const url = buildUrl();
    const abs = absolutize(url);
    $('rawUrl').value = abs;
    const names = [lc && 'LeetCode', cf && 'Codeforces'].filter(Boolean).join(' + ');
    $('embedMd').value = `![${names} stats](${abs})`;
    const altTheme = $('theme').value === 'github-light' ? 'github-dark' : 'github-light';
    $('dualEmbed').value = buildDualEmbed(abs, altTheme);

    const displayName = lc || cf;
    setStatus(`Loading live data for ${displayName}…`);
    const img = $('cardImg');
    const reqId = ++updateSeq;
    img.onload = () => {
      if (reqId !== updateSeq) return;
      setStatus(`Showing live data for ${displayName}.`);
    };
    img.onerror = async () => {
      if (reqId !== updateSeq) return;
      // img.onerror has no body — refetch to extract the real server message.
      try {
        const res = await fetch(url);
        if (res.ok) {
          setStatus(`Showing live data for ${displayName}.`);
          return;
        }
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j && j.error) msg = j.error;
        } catch {
          /* non-json body */
        }
        setStatus(`${msg}`, 'error');
      } catch {
        setStatus('Upstream error. Check the username / try again shortly.', 'error');
      }
    };
    img.src = url;

    $('radiusVal').textContent = $('radius').value;
    $('topSkillsVal').textContent = $('top_skills').value;
    $('topLangsVal').textContent = $('top_langs').value;
  }

  function copy(targetId) {
    const el = $(targetId);
    el.select();
    el.setSelectionRange(0, el.value.length);
    try {
      navigator.clipboard.writeText(el.value);
    } catch {
      document.execCommand('copy');
    }
  }

  function initListeners() {
    const inputs = [
      'leetcode',
      'codeforces',
      'type',
      'theme',
      'title',
      'radius',
      'top_skills',
      'top_langs',
      'hide_border',
      'transparent',
      'disable_animations',
      'short_numbers',
      ...COLOR_KEYS,
      'title_color',
    ];
    for (const id of inputs) {
      const el = $(id);
      if (!el) continue;
      el.addEventListener('input', schedule);
      el.addEventListener('change', schedule);
    }
    $('type').addEventListener('change', () => {
      state.hide.clear();
      state.sections.clear();
      renderHideChips();
      schedule();
    });
    document.querySelectorAll('button[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => copy(btn.getAttribute('data-copy')));
    });
    $('toggleTheme').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('page-theme', next);
      } catch {
        /* ignore */
      }
    });
  }

  function restorePageTheme() {
    try {
      const saved = localStorage.getItem('page-theme');
      if (saved) document.documentElement.dataset.theme = saved;
    } catch {
      /* ignore */
    }
  }

  async function boot() {
    restorePageTheme();
    await loadThemes();
    renderHideChips();
    initListeners();
    update();
  }
  boot();
})();
