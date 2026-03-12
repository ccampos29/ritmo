    const timeline = document.getElementById('timeline');
    const timelineWrapper = document.getElementById('timelineWrapper');
    const todayLabel = document.getElementById('todayLabel');
    const modal = document.getElementById('taskModal');
    const openFormBtn = document.getElementById('openForm');
    const closeFormBtn = document.getElementById('closeForm');
    const form = document.getElementById('taskForm');
    const dynamicBlocks = document.querySelectorAll('.freq-block');
    const typeSelect = form.elements['type'];
    const groupSelect = form.elements['groupId'];
    const groupColorHint = document.getElementById('groupColorHint');
    const timesList = document.getElementById('timesList');
    const addTimeBtn = document.getElementById('addTime');
    const newTimeInput = document.getElementById('newTime');
    const progressLabel = document.getElementById('progressLabel');
    const progressCount = document.getElementById('progressCount');
    const progressBar = document.getElementById('progressBar');
    const groupFilters = document.getElementById('groupFilters');
    const viewModeSwitch = document.getElementById('viewModeSwitch');
    const fabAdd = document.getElementById('fabAdd');
    const nextTaskEmoji = document.getElementById('nextTaskEmoji');
    const nextTaskTitle = document.getElementById('nextTaskTitle');
    const nextTaskMeta = document.getElementById('nextTaskMeta');
    const nextTaskCountdown = document.getElementById('nextTaskCountdown');
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmOk = document.getElementById('confirmOk');
    const restoreDailyBtn = document.getElementById('restoreDailyBtn');

    let groups = loadGroups();
    let tasks = loadTasks();
    let completions = loadCompletions();
    let multiTimesBuffer = ['08:00', '12:00', '18:00'];
    let editingTaskId = null;
    let activeGroupFilter = loadStoredGroupFilter();
    let viewMode = loadStoredViewMode();
    const VIRTUAL_ROW_HEIGHT = 96;
    const VIRTUAL_OVERSCAN = 8;
    let virtualModel = null;
    let virtualRaf = null;
    let virtualListenersBound = false;
    let confirmResolver = null;

    function formatDateLabel(date = new Date()) {
      return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function loadStoredViewMode() {
      try {
        const value = localStorage.getItem('ritmo_view_mode');
        return value === 'group' ? 'group' : 'time';
      } catch (e) {
        return 'time';
      }
    }

    function saveStoredViewMode() {
      try {
        localStorage.setItem('ritmo_view_mode', viewMode);
      } catch (e) {
        // no-op
      }
    }

    function loadStoredGroupFilter() {
      try {
        return localStorage.getItem('ritmo_active_group_filter') || 'all';
      } catch (e) {
        return 'all';
      }
    }

    function saveStoredGroupFilter() {
      try {
        localStorage.setItem('ritmo_active_group_filter', activeGroupFilter);
      } catch (e) {
        // no-op
      }
    }

    function loadTasks() {
      try {
        const raw = localStorage.getItem('ritmo_tasks');
        if (raw) return JSON.parse(raw);
        const seeded = sampleTasks();
        localStorage.setItem('ritmo_tasks', JSON.stringify(seeded));
        return seeded;
      } catch (e) {
        console.error(e);
        return sampleTasks();
      }
    }

    function loadCompletions() {
      try {
        const raw = localStorage.getItem('ritmo_completions');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        console.error(e);
        return {};
      }
    }

    function saveTasks() {
      localStorage.setItem('ritmo_tasks', JSON.stringify(tasks));
    }

    function defaultGroups() {
      return [
        { id: 'wellness', name: 'Bienestar', color: '#7cf8d3' },
        { id: 'work', name: 'Trabajo', color: '#a8c5ff' },
        { id: 'morning', name: 'Mananas', color: '#ffa8c5' }
      ];
    }

    function loadGroups() {
      try {
        const raw = localStorage.getItem('ritmo_groups');
        if (raw) return JSON.parse(raw);
        const seeded = defaultGroups();
        localStorage.setItem('ritmo_groups', JSON.stringify(seeded));
        return seeded;
      } catch (e) {
        console.error(e);
        return defaultGroups();
      }
    }

    function saveCompletions() {
      localStorage.setItem('ritmo_completions', JSON.stringify(completions));
    }

    function sampleTasks() {
      return [
        {
          id: crypto.randomUUID(),
          title: 'Beber agua',
          emoji: '💧',
          groupId: 'wellness',
          color: '#7cf8d3',
          group: 'Bienestar',
          type: 'every-x-hours',
          startTime: '07:00',
          interval: 3
        },
        {
          id: crypto.randomUUID(),
          title: 'Revisión inbox',
          emoji: '📬',
          groupId: 'work',
          color: '#a8c5ff',
          group: 'Trabajo',
          type: 'multi-times',
          times: ['09:30', '13:00', '17:30']
        },
        {
          id: crypto.randomUUID(),
          title: 'Correr 20min',
          emoji: '🏃',
          groupId: 'morning',
          color: '#ffa8c5',
          group: 'Mañanas',
          type: 'weekdays',
          days: [1,2,3,4,5],
          weekdayTime: '06:40'
        }
      ];
    }

    function getOccurrencesForToday(task, date = new Date()) {
      const day = date.getDay();
      const todayStr = date.toISOString().slice(0,10);
      switch (task.type) {
        case 'daily':
          return [task.time || '09:00'];
        case 'every-x-hours': {
          const times = [];
          if (!task.startTime || !task.interval) return times;
          const [h, m] = task.startTime.split(':').map(Number);
          let current = new Date(date);
          current.setHours(h, m, 0, 0);
          while (current.getDate() === date.getDate()) {
            times.push(current.toTimeString().slice(0,5));
            current = new Date(current.getTime() + task.interval * 60 * 60 * 1000);
          }
          return times;
        }
        case 'weekdays': {
          if (!task.days || !task.days.includes(day)) return [];
          return [task.weekdayTime || '09:00'];
        }
        case 'specific-dates': {
          const list = (task.dates || []).map(d => d.slice(0,10));
          return list.includes(todayStr) ? [task.specificTime || '10:00'] : [];
        }
        case 'multi-times':
          return task.times || [];
        default:
          return [];
      }
    }

    function resolveGroupByTask(task) {
      if (task.groupId) {
        const byId = groups.find(g => g.id === task.groupId);
        if (byId) return byId;
      }
      if (task.group) {
        const byName = groups.find(g => g.name.toLowerCase() === task.group.toLowerCase());
        if (byName) return byName;
      }
      return null;
    }

    function resolveTaskGroup(task) {
      const group = resolveGroupByTask(task);
      return group ? group.name : (task.group || 'General');
    }

    function resolveTaskColor(task) {
      const group = resolveGroupByTask(task);
      return group ? group.color : (task.color || '#7cf8d3');
    }

    function resolveTaskGroupMeta(task) {
      const matched = resolveGroupByTask(task);
      if (matched) return matched;
      return { id: 'general', name: task.group || 'General', color: task.color || '#7cf8d3' };
    }

    function filterOccurrencesByGroup(entries) {
      if (activeGroupFilter === 'all') return entries;
      return entries.filter(entry => resolveTaskGroupMeta(entry.task).id === activeGroupFilter);
    }

    function renderGroupFilters() {
      if (!groupFilters) return;
      const allGroups = [{ id: 'all', name: 'Todos', color: '#8ff4d8' }, ...groups];
      if (!allGroups.some(group => group.id === activeGroupFilter)) {
        activeGroupFilter = 'all';
        saveStoredGroupFilter();
      }
      groupFilters.innerHTML = '';
      const frag = document.createDocumentFragment();
      allGroups.forEach(group => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `group-chip inline-flex items-center gap-2 ${group.id === activeGroupFilter ? 'active' : ''}`;
        btn.dataset.groupFilter = group.id;
        btn.innerHTML = `<span class="group-chip-dot" style="background:${group.color}"></span><span>${group.name}</span>`;
        frag.appendChild(btn);
      });
      groupFilters.appendChild(frag);
    }

    function renderViewModeSwitch() {
      if (!viewModeSwitch) return;
      viewModeSwitch.querySelectorAll('button[data-view-mode]').forEach(btn => {
        const isActive = btn.dataset.viewMode === viewMode;
        btn.classList.toggle('active', isActive);
      });
    }

    function renderGroupOptions(selectedId = '') {
      const nextSelected = selectedId || groupSelect.value;
      groupSelect.innerHTML = '';
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
      });
      if (groups.length > 0) {
        const hasSelected = groups.some(group => group.id === nextSelected);
        groupSelect.value = hasSelected ? nextSelected : groups[0].id;
      }
      updateGroupHint();
    }

    function updateGroupHint() {
      const selected = groups.find(group => group.id === groupSelect.value);
      if (!selected) {
        groupColorHint.textContent = 'Color del grupo se aplica automaticamente.';
        groupColorHint.style.color = '';
        return;
      }
      groupColorHint.textContent = `Color aplicado: ${selected.color}`;
      groupColorHint.style.color = selected.color;
    }

    function collectTodayOccurrences() {
      const list = [];
      tasks.forEach(task => {
        const times = getOccurrencesForToday(task).map(time => ({ time, task }));
        list.push(...times);
      });
      return list.sort((a, b) => a.time.localeCompare(b.time));
    }

    function timeToDate(time, date = new Date()) {
      const [h, m] = time.split(':').map(Number);
      const target = new Date(date);
      target.setHours(h, m, 0, 0);
      return target;
    }

    function formatDuration(ms) {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    }

    function renderNextTaskCard(entries = null, doneMapInput = null) {
      const now = new Date();
      const todayKey = todayISO();
      const source = entries || filterOccurrencesByGroup(collectTodayOccurrences());
      const occurrences = [...source].sort((a, b) => a.time.localeCompare(b.time));
      const doneMap = doneMapInput || completions[todayKey] || {};

      if (occurrences.length === 0) {
        nextTaskEmoji.textContent = '⏭';
        nextTaskTitle.textContent = 'Sin tareas para hoy';
        nextTaskMeta.textContent = 'Crea una tarea y aparece aqui.';
        nextTaskCountdown.textContent = '--';
        return;
      }

      const pending = occurrences.filter(entry => !doneMap[occurrenceKey(entry.task.id, entry.time)]);
      if (pending.length === 0) {
        nextTaskEmoji.textContent = '✅';
        nextTaskTitle.textContent = 'Todo completado por hoy';
        nextTaskMeta.textContent = 'Buen ritmo. No hay pendientes.';
        nextTaskCountdown.textContent = '0 pendientes';
        return;
      }

      let target = pending.find(entry => timeToDate(entry.time, now) >= now);
      let overdue = false;
      if (!target) {
        target = pending[0];
        overdue = true;
      }

      const targetDate = timeToDate(target.time, now);
      const diff = targetDate.getTime() - now.getTime();
      const emoji = target.task.emoji?.trim() || '•';
      const group = resolveTaskGroup(target.task);

      nextTaskEmoji.textContent = emoji;
      nextTaskTitle.textContent = target.task.title;
      if (overdue) {
        nextTaskMeta.textContent = `${group} · pendiente desde ${target.time}`;
        nextTaskCountdown.textContent = `atrasada ${formatDuration(Math.abs(diff))}`;
      } else {
        nextTaskMeta.textContent = `${group} · ${target.time}`;
        nextTaskCountdown.textContent = `en ${formatDuration(diff)}`;
      }
    }

    function closeConfirmModal(result) {
      if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
      }
      confirmModal.classList.add('hidden');
    }

    function askConfirm(options = {}) {
      const {
        title = 'Confirmar accion',
        message = 'Esta accion no se puede deshacer.',
        okText = 'Aceptar',
        cancelText = 'Cancelar'
      } = options;

      confirmTitle.textContent = title;
      confirmMessage.textContent = message;
      confirmOk.textContent = okText;
      confirmCancel.textContent = cancelText;
      confirmModal.classList.remove('hidden');

      return new Promise(resolve => {
        confirmResolver = resolve;
      });
    }

    function buildTimelineRow(entry, done, options = {}) {
      const { virtual = false, index = 0 } = options;
      const row = document.createElement('div');
      row.className = virtual ? 'absolute left-0 right-0 swipe-wrap' : 'relative swipe-wrap';
      if (virtual) {
        row.style.top = `${index * VIRTUAL_ROW_HEIGHT}px`;
        row.style.height = `${VIRTUAL_ROW_HEIGHT}px`;
      }
      row.dataset.id = entry.task.id;
      row.dataset.time = entry.time;

      const actions = document.createElement('div');
      actions.className = 'pl-2 swipe-actions';
      actions.innerHTML = `
        <button class="swipe-edit" data-action="edit" data-id="${entry.task.id}">
          <span class="swipe-label">Editar</span>
        </button>
        <button class="swipe-delete" data-action="delete" data-id="${entry.task.id}">
          <span class="swipe-label">Eliminar</span>
        </button>
      `;
      row.appendChild(actions);

      const card = document.createElement('article');
      const taskColor = resolveTaskColor(entry.task);
      const taskGroup = resolveTaskGroup(entry.task);
      const sizeClass = virtual ? 'h-full' : 'min-h-[86px]';
      card.className = `glass-strong card-bg rounded-none px-4 py-3 border border-white/10 flex items-center gap-3 hover:border-white/30 transition card-inner ${sizeClass} ${done ? 'done-card collapsed-card' : ''}`;
      card.style.borderLeft = `6px solid ${taskColor}`;
      card.innerHTML = `
        <button class="check-btn ${done ? 'checked' : ''}" data-action="done" data-id="${entry.task.id}" data-time="${entry.time}">${done ? '✔' : ''}</button>
        <div class="avatar w-10 h-10 rounded-xl flex items-center justify-center text-xl" style="background:${taskColor}22; color:${taskColor}">${entry.task.emoji || '•'}</div>
        <div class="flex-1 card-main">
          <p class="text-xs uppercase tracking-[0.2em] time-label">${entry.time}</p>
          <p class="font-semibold text-base card-title">${entry.task.title}</p>
          <p class="card-sub text-xs">${taskGroup}</p>
        </div>
      `;
      row.appendChild(card);
      return row;
    }

    function renderGroupedTimeline(entries, doneMap) {
      clearVirtualTimeline();
      if (entries.length === 0) return;

      const grouped = new Map();
      entries.forEach(entry => {
        const meta = resolveTaskGroupMeta(entry.task);
        const key = meta.id || meta.name;
        if (!grouped.has(key)) grouped.set(key, { meta, items: [] });
        grouped.get(key).items.push(entry);
      });

      const sections = [...grouped.values()].sort((a, b) => a.meta.name.localeCompare(b.meta.name));
      const frag = document.createDocumentFragment();

      sections.forEach(section => {
        section.items.sort((a, b) => a.time.localeCompare(b.time));

        const container = document.createElement('section');
        container.className = 'mb-3';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between border border-white/10 border-b-0 px-3 py-2 bg-white/5';
        header.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2.5 h-2.5 shrink-0" style="background:${section.meta.color}"></span>
            <p class="text-sm font-semibold card-title truncate">${section.meta.name}</p>
          </div>
          <p class="text-xs text-slate-400">${section.items.length}</p>
        `;
        container.appendChild(header);

        const listEl = document.createElement('div');
        listEl.className = 'space-y-0';
        section.items.forEach(entry => {
          const done = !!doneMap[occurrenceKey(entry.task.id, entry.time)];
          listEl.appendChild(buildTimelineRow(entry, done));
        });
        container.appendChild(listEl);
        frag.appendChild(container);
      });

      timeline.appendChild(frag);
    }

    function renderVirtualWindow() {
      if (!virtualModel) return;
      const { entries, doneMap } = virtualModel;
      const totalHeight = entries.length * VIRTUAL_ROW_HEIGHT;
      timeline.style.height = `${totalHeight}px`;

      const wrapperRect = timelineWrapper.getBoundingClientRect();
      const listTop = window.scrollY + wrapperRect.top;
      const viewTop = window.scrollY;
      const viewBottom = viewTop + window.innerHeight;

      let start = Math.floor((viewTop - listTop) / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN;
      let end = Math.ceil((viewBottom - listTop) / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN;
      start = Math.max(0, start);
      end = Math.min(entries.length - 1, end);

      if (entries.length === 0 || end < start) {
        timeline.innerHTML = '';
        return;
      }

      const frag = document.createDocumentFragment();
      for (let i = start; i <= end; i++) {
        const entry = entries[i];
        const done = !!doneMap[occurrenceKey(entry.task.id, entry.time)];
        frag.appendChild(buildTimelineRow(entry, done, { virtual: true, index: i }));
      }

      timeline.innerHTML = '';
      timeline.appendChild(frag);
    }

    function scheduleVirtualRender() {
      if (!virtualModel) return;
      if (virtualRaf) return;
      virtualRaf = requestAnimationFrame(() => {
        virtualRaf = null;
        renderVirtualWindow();
      });
    }

    function bindVirtualListeners() {
      if (virtualListenersBound) return;
      virtualListenersBound = true;
      window.addEventListener('scroll', scheduleVirtualRender, { passive: true });
      window.addEventListener('resize', scheduleVirtualRender);
    }

    function mountVirtualTimeline(entries, doneMap) {
      virtualModel = { entries, doneMap };
      bindVirtualListeners();
      renderVirtualWindow();
    }

    function clearVirtualTimeline() {
      virtualModel = null;
      timeline.style.height = '';
      timeline.innerHTML = '';
    }

    function renderTimeline() {
      groups = loadGroups();
      todayLabel.textContent = formatDateLabel();
      renderGroupFilters();
      renderViewModeSwitch();
      const todayKey = todayISO();
      const sorted = filterOccurrencesByGroup(collectTodayOccurrences()).sort((a, b) => a.time.localeCompare(b.time));
      const total = sorted.length;
      const doneMap = completions[todayKey] || {};
      const completed = sorted.reduce((count, entry) => {
        return count + (doneMap[occurrenceKey(entry.task.id, entry.time)] ? 1 : 0);
      }, 0);

      // timeline vertical rail
      if (tasks.length === 0) {
        clearVirtualTimeline();
        const empty = document.createElement('div');
        empty.className = 'glass-card rounded-2xl p-5 text-slate-200';
        empty.innerHTML = `<p class="text-lg font-semibold mb-1">No hay tareas aún</p>
        <p class="text-slate-400">Pulsa el botón + para crear tu primera rutina. Elige tipo de frecuencia y añade horarios.</p>`;
        timeline.appendChild(empty);
        updateProgress(0, 0);
        renderNextTaskCard();
        return;
      }

      if (sorted.length === 0) {
        clearVirtualTimeline();
        const noToday = document.createElement('div');
        noToday.className = 'glass-card rounded-2xl p-5 text-slate-200';
        if (activeGroupFilter === 'all') {
          noToday.innerHTML = `<p class="text-lg font-semibold mb-1">Sin ocurrencias para hoy</p>
          <p class="text-slate-400">Tus tareas existen, pero ninguna aplica para este dia segun su frecuencia.</p>`;
        } else {
          const group = groups.find(item => item.id === activeGroupFilter);
          noToday.innerHTML = `<p class="text-lg font-semibold mb-1">Sin tareas en este grupo</p>
          <p class="text-slate-400">${group ? group.name : 'El grupo seleccionado'} no tiene ocurrencias para hoy.</p>`;
        }
        timeline.appendChild(noToday);
        updateProgress(0, 0);
        renderNextTaskCard(sorted, doneMap);
        return;
      }

      if (viewMode === 'group') {
        renderGroupedTimeline(sorted, doneMap);
      } else {
        mountVirtualTimeline(sorted, doneMap);
      }
      updateProgress(completed, total);
      renderNextTaskCard(sorted, doneMap);
    }

    function openTaskModal() {
      editingTaskId = null;
      form.reset();
      groups = loadGroups();
      renderGroupOptions('');
      multiTimesBuffer = ['08:00', '12:00', '18:00'];
      renderTimesChips();
      updateBlocks('daily');
      modal.classList.remove('hidden');
    }

    // Modal handling
    if (openFormBtn) openFormBtn.addEventListener('click', openTaskModal);
    fabAdd.addEventListener('click', openTaskModal);
    closeFormBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirmModal(false);
    });
    confirmCancel.addEventListener('click', () => closeConfirmModal(false));
    confirmOk.addEventListener('click', () => closeConfirmModal(true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !confirmModal.classList.contains('hidden')) {
        closeConfirmModal(false);
      }
    });

    typeSelect.addEventListener('change', () => updateBlocks(typeSelect.value));
    groupSelect.addEventListener('change', updateGroupHint);
    groupFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-group-filter]');
      if (!btn) return;
      activeGroupFilter = btn.dataset.groupFilter || 'all';
      saveStoredGroupFilter();
      renderTimeline();
    });
    viewModeSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view-mode]');
      if (!btn) return;
      viewMode = btn.dataset.viewMode === 'group' ? 'group' : 'time';
      saveStoredViewMode();
      renderTimeline();
    });
    restoreDailyBtn.addEventListener('click', async () => {
      const ok = await askConfirm({
        title: 'Restaurar tareas',
        message: 'Se marcarán como pendientes todas las tareas completadas de hoy.',
        okText: 'Restaurar',
        cancelText: 'Cancelar'
      });
      if (!ok) return;
      const day = todayISO();
      if (completions[day]) {
        delete completions[day];
        saveCompletions();
      }
      renderTimeline();
    });

    function updateBlocks(type) {
      dynamicBlocks.forEach(block => {
        block.classList.toggle('hidden', block.dataset.type !== type);
      });
    }

    // Add times chip for multi-times
    function renderTimesChips() {
      timesList.innerHTML = '';
      multiTimesBuffer.forEach((time, idx) => {
        const chip = document.createElement('span');
        chip.className = 'pill px-3 py-1 flex items-center gap-2 text-xs';
        chip.innerHTML = `${time} <button class="text-slate-400 hover:text-white" data-idx="${idx}">✕</button>`;
        timesList.appendChild(chip);
      });
    }

    addTimeBtn.addEventListener('click', () => {
      const val = newTimeInput.value;
      if (!val) return;
      if (!multiTimesBuffer.includes(val)) {
        multiTimesBuffer.push(val);
        multiTimesBuffer.sort();
        renderTimesChips();
      }
    });

    timesList.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const idx = Number(e.target.dataset.idx);
        multiTimesBuffer.splice(idx,1);
        renderTimesChips();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const type = data.type;
      const selectedGroup = groups.find(group => group.id === data.groupId);
      const base = {
        id: editingTaskId || crypto.randomUUID(),
        title: data.title,
        emoji: data.emoji,
        groupId: selectedGroup ? selectedGroup.id : '',
        color: selectedGroup ? selectedGroup.color : '#7cf8d3',
        group: selectedGroup ? selectedGroup.name : '',
        type
      };

      let task = {};
      if (type === 'daily') {
        task = { ...base, time: data.time || '09:00' };
      } else if (type === 'every-x-hours') {
        task = { ...base, startTime: data.startTime || '07:00', interval: Number(data.interval) || 3 };
      } else if (type === 'weekdays') {
        const days = [...form.querySelectorAll('input[name="days"]:checked')].map(i => Number(i.value));
        task = { ...base, days, weekdayTime: data.weekdayTime || '09:00' };
      } else if (type === 'specific-dates') {
        const dates = (data.dates || '').split(',').map(d => d.trim()).filter(Boolean);
        task = { ...base, dates, specificTime: data.specificTime || '10:00' };
      } else if (type === 'multi-times') {
        task = { ...base, times: [...multiTimesBuffer] };
      }

      const existingIndex = tasks.findIndex(t => t.id === editingTaskId);
      if (existingIndex >= 0) {
        tasks.splice(existingIndex, 1, task);
      } else {
        tasks.push(task);
      }
      saveTasks();
      renderTimeline();
      form.reset();
      multiTimesBuffer = ['08:00', '12:00', '18:00'];
      renderTimesChips();
      updateBlocks('daily');
      editingTaskId = null;
      modal.classList.add('hidden');
    });

    // timeline card actions
    timeline.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const time = btn.dataset.time;
      if (action === 'done') {
        toggleDone(id, time);
      } else if (action === 'edit') {
        openEdit(id);
      } else if (action === 'delete') {
        deleteTask(id);
      }
    });

    // Swipe to reveal actions (touch)
    let swipeStartX = null;
    let swipeTarget = null;
    timeline.addEventListener('touchstart', (e) => {
      const wrap = e.target.closest('.swipe-wrap');
      if (!wrap) return;
      swipeStartX = e.touches[0].clientX;
      swipeTarget = wrap;
    }, { passive: true });

    timeline.addEventListener('touchmove', (e) => {
      if (!swipeTarget || swipeStartX === null) return;
      const delta = e.touches[0].clientX - swipeStartX;
      if (delta < -30) {
        document.querySelectorAll('.swipe-wrap.swiped').forEach(el => {
          if (el !== swipeTarget) el.classList.remove('swiped');
        });
        swipeTarget.classList.add('swiped');
      }
      if (delta > 30) {
        swipeTarget.classList.remove('swiped');
      }
    }, { passive: true });

    timeline.addEventListener('touchend', () => {
      swipeStartX = null;
      swipeTarget = null;
    });

    // Click outside to reset swipes
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.swipe-wrap')) {
        document.querySelectorAll('.swipe-wrap.swiped').forEach(el => el.classList.remove('swiped'));
      }
    });

    function toggleDone(id, time) {
      const day = todayISO();
      completions[day] = completions[day] || {};
      const key = occurrenceKey(id, time);
      completions[day][key] = !completions[day][key];
      saveCompletions();
      renderTimeline();
    }

    function openEdit(id) {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      editingTaskId = id;
      groups = loadGroups();
      const matchedGroup = resolveGroupByTask(task);
      renderGroupOptions(matchedGroup ? matchedGroup.id : '');
      form.elements['title'].value = task.title || '';
      form.elements['emoji'].value = task.emoji || '';
      form.elements['type'].value = task.type;
      updateBlocks(task.type);

      if (task.type === 'daily') {
        form.elements['time'].value = task.time || '09:00';
      } else if (task.type === 'every-x-hours') {
        form.elements['startTime'].value = task.startTime || '07:00';
        form.elements['interval'].value = task.interval || 3;
      } else if (task.type === 'weekdays') {
        form.elements['weekdayTime'].value = task.weekdayTime || '09:00';
        const checks = form.querySelectorAll('input[name=\"days\"]');
        checks.forEach(c => c.checked = task.days?.includes(Number(c.value)) || false);
      } else if (task.type === 'specific-dates') {
        form.elements['dates'].value = (task.dates || []).join(',');
        form.elements['specificTime'].value = task.specificTime || '10:00';
      } else if (task.type === 'multi-times') {
        multiTimesBuffer = [...(task.times || ['08:00'])];
        renderTimesChips();
      }

      modal.classList.remove('hidden');
    }

    async function deleteTask(id) {
      const ok = await askConfirm({
        title: 'Eliminar tarea',
        message: 'Se eliminara la tarea y sus ocurrencias de hoy.',
        okText: 'Eliminar',
        cancelText: 'Cancelar'
      });
      if (!ok) return;
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderTimeline();
    }

    function todayISO(offsetMinutes = -300) { // default UTC-5
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const target = new Date(utc + offsetMinutes * 60000);
      return target.toISOString().slice(0,10);
    }

    function occurrenceKey(id, time) {
      return `${id}|${time}`;
    }

    function updateProgress(done, total) {
      const pct = total ? Math.round((done / total) * 100) : 0;
      progressLabel.textContent = `Progreso ${pct}%`;
      progressCount.textContent = `${done} / ${total}`;
      progressBar.style.width = `${pct}%`;
    }


    // init
    renderGroupOptions('');

    renderTimesChips();
    updateBlocks(typeSelect.value);
    renderTimeline();

    // iOS Safari: hard-disable pinch and gesture zoom for app-like behavior.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
      if (typeof e.scale === 'number' && e.scale !== 1) e.preventDefault();
    }, { passive: false });

    // Keep countdown live and handle day rollover.
    let liveDayKey = todayISO();
    setInterval(() => {
      const currentKey = todayISO();
      if (currentKey !== liveDayKey) {
        liveDayKey = currentKey;
        renderTimeline();
        return;
      }
      renderNextTaskCard();
    }, 1000);
