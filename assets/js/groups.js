    const storageKey = 'ritmo_groups';
    const tasksKey = 'ritmo_tasks';
    const list = document.getElementById('groupsList');
    const form = document.getElementById('groupForm');
    const nameInput = document.getElementById('groupName');
    const colorInput = document.getElementById('groupColor');
    const saveBtn = document.getElementById('groupSave');
    const cancelBtn = document.getElementById('groupCancel');
    const msg = document.getElementById('groupMsg');
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmOk = document.getElementById('confirmOk');
    const themeToggle = document.getElementById('themeToggle');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const THEME_STORAGE_KEY = 'ritmo_theme';
    const DARK_THEME_COLOR = '#0a0f1d';
    const LIGHT_THEME_COLOR = '#eef4ff';
    let editingId = null;
    let confirmResolver = null;
    let activeTheme = loadStoredTheme();
    const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    let groups = loadGroups();

    function defaultGroups() {
      return [
        { id: 'wellness', name: 'Bienestar', color: '#7cf8d3' },
        { id: 'work', name: 'Trabajo', color: '#a8c5ff' },
        { id: 'morning', name: 'Mananas', color: '#ffa8c5' }
      ];
    }

    function loadGroups() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw);
        const seeded = defaultGroups();
        localStorage.setItem(storageKey, JSON.stringify(seeded));
        return seeded;
      } catch (e) {
        return defaultGroups();
      }
    }

    function loadStoredTheme() {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
      } catch (e) {
        // no-op
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      return 'dark';
    }

    function hasPersistedTheme() {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return stored === 'light' || stored === 'dark';
      } catch (e) {
        return false;
      }
    }

    function saveStoredTheme() {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
      } catch (e) {
        // no-op
      }
    }

    function renderThemeToggle() {
      if (!themeToggle) return;
      const isLight = activeTheme === 'light';
      const nextLabel = isLight ? 'Oscuro' : 'Claro';
      const icon = isLight ? '🌙' : '☀️';
      const title = isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
      themeToggle.dataset.theme = activeTheme;
      themeToggle.setAttribute('aria-label', title);
      themeToggle.setAttribute('title', title);
      themeToggle.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${icon}</span><span class="theme-toggle-label">${nextLabel}</span>`;
    }

    function applyTheme(theme, options = {}) {
      const { persist = false } = options;
      activeTheme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', activeTheme);
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', activeTheme === 'light' ? LIGHT_THEME_COLOR : DARK_THEME_COLOR);
      }
      if (persist) saveStoredTheme();
      renderThemeToggle();
    }

    function initTheme() {
      applyTheme(activeTheme);

      if (themeToggle) {
        themeToggle.addEventListener('click', () => {
          applyTheme(activeTheme === 'dark' ? 'light' : 'dark', { persist: true });
        });
      }

      if (!systemThemeQuery) return;

      const onSystemThemeChange = (event) => {
        if (hasPersistedTheme()) return;
        applyTheme(event.matches ? 'light' : 'dark');
      };

      if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', onSystemThemeChange);
      } else if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(onSystemThemeChange);
      }
    }

    function saveGroups() {
      localStorage.setItem(storageKey, JSON.stringify(groups));
    }

    function loadTasks() {
      try {
        const raw = localStorage.getItem(tasksKey);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    function countTasks(group) {
      const tasks = loadTasks();
      return tasks.filter(task => {
        if (task.groupId) return task.groupId === group.id;
        return (task.group || '').toLowerCase() === group.name.toLowerCase();
      }).length;
    }

    function setMessage(text) {
      msg.textContent = text || '';
    }

    function openConfirm({ title, message, okText = 'Eliminar' }) {
      confirmTitle.textContent = title;
      confirmMessage.textContent = message;
      confirmOk.textContent = okText;
      confirmModal.classList.remove('hidden');
      return new Promise(resolve => {
        confirmResolver = resolve;
      });
    }

    function closeConfirm(result) {
      confirmModal.classList.add('hidden');
      if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
      }
    }

    function startCreateMode() {
      editingId = null;
      saveBtn.textContent = 'Guardar';
      cancelBtn.classList.add('hidden');
      nameInput.value = '';
      colorInput.value = '#7cf8d3';
      setMessage('');
    }

    function render() {
      list.innerHTML = '';
      if (groups.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-400">No hay grupos creados.</p>';
        return;
      }

      const frag = document.createDocumentFragment();
      groups.forEach(group => {
        const row = document.createElement('article');
        row.className = 'glass-card rounded-xl p-3 flex items-center justify-between gap-3';
        row.innerHTML = `
          <div class="min-w-0 flex items-center gap-3">
            <span class="w-5 h-5 rounded-sm border border-white/20 shrink-0" style="background:${group.color}"></span>
            <div class="min-w-0">
              <p class="font-semibold truncate">${group.name}</p>
              <p class="text-xs text-slate-400">${countTasks(group)} tareas asociadas</p>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button class="pill px-3 py-1 text-sm" data-action="edit" data-id="${group.id}">Editar</button>
            <button class="px-3 py-1 text-sm rounded-md bg-red-700/85 text-white" data-action="delete" data-id="${group.id}">Eliminar</button>
          </div>
        `;
        frag.appendChild(row);
      });
      list.appendChild(frag);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const color = colorInput.value;
      if (!name) return;

      const exists = groups.some(group =>
        group.name.toLowerCase() === name.toLowerCase() && group.id !== editingId
      );
      if (exists) {
        setMessage('Ya existe un grupo con ese nombre.');
        return;
      }

      if (editingId) {
        const idx = groups.findIndex(group => group.id === editingId);
        if (idx >= 0) groups[idx] = { ...groups[idx], name, color };
        setMessage('Grupo actualizado.');
      } else {
        groups.push({ id: crypto.randomUUID(), name, color });
        setMessage('Grupo creado.');
      }

      saveGroups();
      render();
      startCreateMode();
    });

    cancelBtn.addEventListener('click', startCreateMode);

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const group = groups.find(item => item.id === id);
      if (!group) return;

      if (action === 'edit') {
        editingId = id;
        nameInput.value = group.name;
        colorInput.value = group.color;
        saveBtn.textContent = 'Actualizar';
        cancelBtn.classList.remove('hidden');
        setMessage('');
        return;
      }

      if (groups.length <= 1) {
        setMessage('Debes conservar al menos un grupo.');
        return;
      }

      const ok = await openConfirm({
        title: 'Eliminar grupo',
        message: `Se eliminara "${group.name}". Esta accion no se puede deshacer.`,
        okText: 'Eliminar'
      });
      if (!ok) return;
      groups = groups.filter(item => item.id !== id);
      saveGroups();
      render();
      startCreateMode();
      setMessage('Grupo eliminado.');
    });

    confirmCancel.addEventListener('click', () => closeConfirm(false));
    confirmOk.addEventListener('click', () => closeConfirm(true));
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirm(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !confirmModal.classList.contains('hidden')) {
        closeConfirm(false);
      }
    });

    initTheme();
    startCreateMode();
    render();
