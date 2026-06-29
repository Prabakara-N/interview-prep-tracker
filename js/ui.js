/* UI rendering: stats, lists, heatmap, tabs, theme, toasts.
 * Pure-ish render functions driven by AppState. */
window.UI = (function () {

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function byId(id) { return document.getElementById(id); }

  /* Re-render Lucide icons after injecting markup with data-lucide attributes. */
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ---- Toast ---- */
  var toastTimer = null;
  function toast(msg, kind) {
    var t = byId('toast');
    t.textContent = msg;
    t.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ' +
      (kind === 'error' ? 'bg-red-600' : kind === 'success' ? 'bg-emerald-600' : 'bg-slate-800');
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2600);
  }

  /* ---- Stats ---- */
  function renderStats(state) {
    byId('stat-current-streak').textContent = window.Streak.current(state);
    byId('stat-longest-streak').textContent = window.Streak.longest(state);
    byId('stat-total-dsa').textContent = state.dsa.length;
    byId('stat-total-jobs').textContent = state.jobs.length;
  }

  /* ---- Today's checklist ---- */
  function renderChecklist(state) {
    var today = window.Streak.todayStr();
    var tasks = state.checklist.tasks;
    var doneToday = state.checklist.log[today] || [];

    byId('checklist-date').textContent = '· ' + today;
    byId('checklist-progress').textContent = doneToday.length + '/' + tasks.length;

    var el = byId('checklist-today');
    if (!tasks.length) {
      el.innerHTML = '<p class="empty">No daily tasks yet. Add one below.</p>';
      return;
    }
    el.innerHTML = tasks.map(function (t) {
      var checked = doneToday.indexOf(t.id) !== -1;
      return '<div class="checklist-item ' + (checked ? 'checked' : '') + '">' +
        '<label class="check-hit">' +
        '<input type="checkbox" data-toggle="' + t.id + '" ' + (checked ? 'checked' : '') + ' />' +
        '<span class="check-box"><i data-lucide="check" class="w-3.5 h-3.5"></i></span>' +
        '<span class="check-label">' + esc(t.label) + '</span>' +
        '</label>' +
        '<button type="button" class="delete-btn" data-deltask="' + t.id + '" title="Remove task">' +
        '<i data-lucide="x" class="w-4 h-4"></i></button>' +
        '</div>';
    }).join('');
    refreshIcons();
  }

  /* ---- Heatmap (range-filtered) ---- */
  var HEATMAP_LABELS = {
    7: 'last 7 days', 15: 'last 15 days', 30: 'last 30 days',
    91: 'last 3 months', 182: 'last 6 months'
  };
  var RANGE_KEY = 'ipt-heatmap-range';

  function getHeatmapDays() {
    var v = 182;
    try { var s = localStorage.getItem(RANGE_KEY); if (s) v = parseInt(s, 10); } catch (e) {}
    return v > 0 ? v : 182;
  }

  function setHeatmapRange(days) {
    try { localStorage.setItem(RANGE_KEY, String(days)); } catch (e) {}
    var state = window.AppState.get();
    renderHeatmap(state);
    // The same range drives the per-track daily charts.
    if (!document.querySelector('[data-panel="dashboard"]').classList.contains('hidden')) {
      window.Charts.renderAll(state);
    }
  }

  function rangeLabel(days) {
    return HEATMAP_LABELS[days] || ('last ' + days + ' days');
  }

  function renderHeatmap(state) {
    var counts = window.Streak.activityCounts(state);
    var totalDays = getHeatmapDays();
    var today = new Date();
    var start = window.Streak.addDays(today, -(totalDays - 1));
    // Align start to the Sunday of its week so columns are clean weeks (GitHub-style).
    start = window.Streak.addDays(start, -start.getDay());
    var windowStartKey = window.Streak.toKey(window.Streak.addDays(today, -(totalDays - 1)));

    var cells = [];
    var cursor = new Date(start.getTime());
    var end = window.Streak.addDays(today, 1);
    while (cursor < end) {
      var key = window.Streak.toKey(cursor);
      var inRange = key >= windowStartKey;
      var c = inRange ? (counts[key] || 0) : 0;
      var level = c === 0 ? '' : c === 1 ? 'l1' : c === 2 ? 'l2' : c === 3 ? 'l3' : 'l4';
      // Cells before the selected window (week-alignment padding) are dimmed out.
      var pad = inRange ? '' : ' pad';
      var title = inRange ? key + ': ' + c + ' activit' + (c === 1 ? 'y' : 'ies') : '';
      cells.push('<div class="heatmap-cell ' + level + pad + '" title="' + title + '"></div>');
      cursor = window.Streak.addDays(cursor, 1);
    }

    var label = byId('heatmap-label');
    if (label) label.textContent = '(' + rangeLabel(totalDays) + ')';
    var dailyLabel = byId('daily-range-label');
    if (dailyLabel) dailyLabel.textContent = '· ' + rangeLabel(totalDays);
    byId('heatmap').innerHTML = '<div class="heatmap-grid">' + cells.join('') + '</div>';
  }

  /* ---- Lists ---- */
  function diffBadge(d) {
    var cls = d === 'Easy' ? 'badge-easy' : d === 'Hard' ? 'badge-hard' : 'badge-medium';
    return '<span class="badge ' + cls + '">' + esc(d) + '</span>';
  }

  function statusBadge(s) {
    var map = {
      'Applied': 'bg-brand-100 text-brand-700',
      'Online Assessment': 'bg-sky-100 text-sky-700',
      'Interview': 'bg-amber-100 text-amber-700',
      'Offer': 'bg-emerald-100 text-emerald-700',
      'Rejected': 'bg-red-100 text-red-700'
    };
    return '<span class="badge ' + (map[s] || 'bg-slate-100 text-slate-700') + '">' + esc(s) + '</span>';
  }

  function delBtn(coll, id) {
    return '<button class="delete-btn" data-del="' + coll + '" data-id="' + id + '" title="Delete">' +
      '<i data-lucide="trash-2" class="w-4 h-4"></i></button>';
  }

  function sortByDateDesc(arr) {
    return arr.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  function renderSqlList(state) {
    var el = byId('list-sql');
    if (!state.sql.length) { el.innerHTML = '<p class="empty">No SQL entries yet. Log your first study session above.</p>'; return; }
    el.innerHTML = sortByDateDesc(state.sql).map(function (e) {
      return '<div class="row"><div>' +
        '<div class="font-medium">' + esc(e.topic) + '</div>' +
        '<div class="text-xs text-slate-500 dark:text-slate-400">' + esc(e.date) +
        (e.minutes ? ' · ' + esc(e.minutes) + ' min' : '') + '</div>' +
        (e.notes ? '<div class="text-sm mt-1">' + esc(e.notes) + '</div>' : '') +
        '</div>' + delBtn('sql', e.id) + '</div>';
    }).join('');
  }

  function renderDsaList(state) {
    var el = byId('list-dsa');
    if (!state.dsa.length) { el.innerHTML = '<p class="empty">No DSA entries yet. Log a problem above.</p>'; return; }
    el.innerHTML = sortByDateDesc(state.dsa).map(function (e) {
      return '<div class="row"><div>' +
        '<div class="font-medium">' + esc(e.problem) + ' ' + diffBadge(e.difficulty || 'Medium') + '</div>' +
        '<div class="text-xs text-slate-500 dark:text-slate-400">' + esc(e.date) +
        (e.topic ? ' · ' + esc(e.topic) : '') + (e.minutes ? ' · ' + esc(e.minutes) + ' min' : '') + '</div>' +
        (e.notes ? '<div class="text-sm mt-1">' + esc(e.notes) + '</div>' : '') +
        '</div>' + delBtn('dsa', e.id) + '</div>';
    }).join('');
  }

  function renderJobsList(state) {
    var el = byId('list-jobs');
    if (!state.jobs.length) { el.innerHTML = '<p class="empty">No applications yet. Add one above.</p>'; return; }
    el.innerHTML = sortByDateDesc(state.jobs).map(function (e) {
      return '<div class="row"><div>' +
        '<div class="font-medium">' + esc(e.role) + ' · ' + esc(e.company) + ' ' + statusBadge(e.status) + '</div>' +
        '<div class="text-xs text-slate-500 dark:text-slate-400">' + esc(e.date) +
        (e.location ? ' · ' + esc(e.location) : '') + '</div>' +
        (e.notes ? '<div class="text-sm mt-1">' + esc(e.notes) + '</div>' : '') +
        '</div>' + delBtn('jobs', e.id) + '</div>';
    }).join('');
  }

  /* ---- Full render ---- */
  function renderAll(state) {
    renderStats(state);
    renderChecklist(state);
    renderHeatmap(state);
    renderSqlList(state);
    renderDsaList(state);
    renderJobsList(state);
    refreshIcons();
    // Only render charts if the dashboard is visible (canvas needs layout).
    if (!document.querySelector('[data-panel="dashboard"]').classList.contains('hidden')) {
      window.Charts.renderAll(state);
    }
  }

  /* ---- Tabs ---- */
  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('[data-panel]').forEach(function (p) {
      p.classList.toggle('hidden', p.dataset.panel !== name);
    });
    if (name === 'dashboard') window.Charts.renderAll(window.AppState.get());
  }

  /* ---- Theme ---- */
  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('ipt-theme', theme); } catch (e) {}
    // re-render charts so axis/legend colors match the theme
    if (!document.querySelector('[data-panel="dashboard"]').classList.contains('hidden')) {
      window.Charts.renderAll(window.AppState.get());
    }
  }

  function toggleTheme() {
    var dark = document.documentElement.classList.contains('dark');
    applyTheme(dark ? 'light' : 'dark');
  }

  function setSyncStatus(text, ok) {
    var el = byId('sync-status');
    el.textContent = text;
    el.className = 'text-xs px-2 py-1 rounded-full ' +
      (ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400');
  }

  return {
    esc: esc,
    toast: toast,
    renderAll: renderAll,
    activateTab: activateTab,
    toggleTheme: toggleTheme,
    setSyncStatus: setSyncStatus,
    setHeatmapRange: setHeatmapRange,
    getHeatmapDays: getHeatmapDays
  };
})();
