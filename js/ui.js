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

  /* ---- Stats (totals include checklist quantities, same as the graphs) ---- */
  function renderStats(state) {
    byId('stat-current-streak').textContent = window.Streak.current(state);
    byId('stat-longest-streak').textContent = window.Streak.longest(state);
    byId('stat-total-dsa').textContent = window.Metrics.totalDsa(state);
    byId('stat-total-jobs').textContent = window.Metrics.totalJobs(state);
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

  /* ---- Per-task activity grids ----
   * One cell per day: ✓ done, ✗ missed, – on Sundays (rest days).
   * Rebuilt on every render so adding/removing a task adds/removes its grid. */
  function taskDayCell(state, task, d, showDate) {
    var key = window.Streak.toKey(d);
    var done = window.Metrics.taskDone(state, task.id, key);
    var sunday = window.Streak.isSunday(d);

    var status, icon, title;
    if (done) {
      status = 'done'; icon = 'check'; title = key + ' — done';
    } else if (sunday) {
      status = 'rest'; icon = 'minus'; title = key + ' — rest day';
    } else {
      status = 'miss'; icon = 'x'; title = key + ' — missed';
    }

    return '<div class="strip-col">' +
      '<span class="strip-dow">' + DOW[d.getDay()] + '</span>' +
      '<div class="task-cell ' + status + '" title="' + esc(title) + '">' +
      '<i data-lucide="' + icon + '"></i></div>' +
      (showDate ? '<span class="strip-date">' + key.slice(5) + '</span>' : '') +
      '</div>';
  }

  /* Short range: one row of day cells with ✓/✗ icons. */
  function taskStripHtml(state, task, totalDays) {
    var showDate = totalDays <= 15;
    var today = new Date();
    var cells = [];
    for (var n = totalDays - 1; n >= 0; n--) {
      cells.push(taskDayCell(state, task, window.Streak.addDays(today, -n), showDate));
    }
    return '<div class="task-grid">' + cells.join('') + '</div>';
  }

  /* Long range: 7-row week grid of small colour-coded cells (icons don't fit). */
  function taskWeekGridHtml(state, task, totalDays) {
    var today = new Date();
    var start = window.Streak.addDays(today, -(totalDays - 1));
    start = window.Streak.addDays(start, -start.getDay());
    var windowStartKey = window.Streak.toKey(window.Streak.addDays(today, -(totalDays - 1)));

    var cells = [];
    var cursor = new Date(start.getTime());
    var end = window.Streak.addDays(today, 1);
    while (cursor < end) {
      var key = window.Streak.toKey(cursor);
      if (key < windowStartKey) {
        cells.push('<div class="task-cell mini pad"></div>'); // week-alignment padding
      } else {
        var done = window.Metrics.taskDone(state, task.id, key);
        var status = done ? 'done' : (window.Streak.isSunday(cursor) ? 'rest' : 'miss');
        var title = key + ' — ' + (done ? 'done' : status === 'rest' ? 'rest day' : 'missed');
        cells.push('<div class="task-cell mini ' + status + '" title="' + esc(title) + '"></div>');
      }
      cursor = window.Streak.addDays(cursor, 1);
    }
    return '<div class="task-weekgrid">' + cells.join('') + '</div>';
  }

  function renderTaskGrids(state) {
    var el = byId('per-task-charts');
    if (!el) return;
    var tasks = state.checklist.tasks;
    if (!tasks.length) {
      el.innerHTML = '<p class="empty">Add a checklist task above to track it here.</p>';
      return;
    }

    var totalDays = getHeatmapDays();
    var today = new Date();

    // Day ranges show one card per row so each day cell has room to breathe;
    // month ranges use compact week grids, so 2-up is fine.
    var stacked = totalDays <= STRIP_MAX_DAYS;
    el.className = 'grid gap-4 sm:gap-6' + (stacked ? '' : ' sm:grid-cols-2');

    el.innerHTML = tasks.map(function (t, i) {
      var style = window.Charts.taskStyle(t, i);
      var doneCount = 0;
      for (var n = totalDays - 1; n >= 0; n--) {
        var key = window.Streak.toKey(window.Streak.addDays(today, -n));
        if (window.Metrics.taskDone(state, t.id, key)) doneCount++;
      }
      var body = totalDays <= STRIP_MAX_DAYS
        ? taskStripHtml(state, t, totalDays)
        : taskWeekGridHtml(state, t, totalDays);

      return '<div class="card-lg">' +
        '<h3 class="text-sm font-medium mb-3 flex items-center gap-2">' +
        '<i data-lucide="' + esc(style.icon) + '" class="w-4 h-4 shrink-0" style="color:' + esc(style.color) + '"></i>' +
        '<span class="truncate">' + esc(t.label) + '</span>' +
        '<span class="ml-auto text-xs font-normal text-slate-400 shrink-0">' +
        doneCount + '/' + totalDays + ' days</span>' +
        '</h3>' + body +
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

  var DEFAULT_RANGE_DAYS = 7;

  function getHeatmapDays() {
    var v = DEFAULT_RANGE_DAYS;
    try { var s = localStorage.getItem(RANGE_KEY); if (s) v = parseInt(s, 10); } catch (e) {}
    return v > 0 ? v : DEFAULT_RANGE_DAYS;
  }

  function setHeatmapRange(days) {
    try { localStorage.setItem(RANGE_KEY, String(days)); } catch (e) {}
    var state = window.AppState.get();
    renderHeatmap(state);
    renderTaskGrids(state); // per-task grids span the same range
    if (!document.querySelector('[data-panel="dashboard"]').classList.contains('hidden')) {
      window.Charts.renderAll(state);
    }
  }

  function rangeLabel(days) {
    return HEATMAP_LABELS[days] || ('last ' + days + ' days');
  }

  var STRIP_MAX_DAYS = 31; // short ranges read better as one row of days than a week grid
  var DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  function level(count) {
    return count === 0 ? '' : count === 1 ? 'l1' : count === 2 ? 'l2' : count === 3 ? 'l3' : 'l4';
  }

  function cellTitle(key, count) {
    return key + ': ' + count + ' activit' + (count === 1 ? 'y' : 'ies');
  }

  /* Short range: one row, one column per day, with the date under each. */
  function stripHtml(counts, totalDays) {
    var today = new Date();
    var cols = [];
    for (var i = totalDays - 1; i >= 0; i--) {
      var d = window.Streak.addDays(today, -i);
      var key = window.Streak.toKey(d);
      var c = counts[key] || 0;
      var sun = window.Streak.isSunday(d) ? ' sun' : '';
      cols.push(
        '<div class="strip-col">' +
        '<span class="strip-dow">' + DOW[d.getDay()] + '</span>' +
        '<div class="heatmap-cell strip-cell ' + level(c) + sun + '" title="' + cellTitle(key, c) + '"></div>' +
        '<span class="strip-date">' + key.slice(5) + '</span>' +
        '</div>'
      );
    }
    // Beyond ~15 days the per-day date labels get too cramped to read.
    var dense = totalDays > 15 ? ' dense' : '';
    return '<div class="heatmap-strip' + dense + '">' + cols.join('') + '</div>';
  }

  /* Long range: GitHub-style 7-row week grid. */
  function gridHtml(counts, totalDays) {
    var today = new Date();
    var start = window.Streak.addDays(today, -(totalDays - 1));
    start = window.Streak.addDays(start, -start.getDay()); // back to that week's Sunday
    var windowStartKey = window.Streak.toKey(window.Streak.addDays(today, -(totalDays - 1)));

    var cells = [];
    var cursor = new Date(start.getTime());
    var end = window.Streak.addDays(today, 1);
    while (cursor < end) {
      var key = window.Streak.toKey(cursor);
      var inRange = key >= windowStartKey;
      var c = inRange ? (counts[key] || 0) : 0;
      // Cells before the window (week-alignment padding) are dimmed.
      var pad = inRange ? '' : ' pad';
      var title = inRange ? cellTitle(key, c) : '';
      cells.push('<div class="heatmap-cell ' + level(c) + pad + '" title="' + title + '"></div>');
      cursor = window.Streak.addDays(cursor, 1);
    }
    return '<div class="heatmap-grid">' + cells.join('') + '</div>';
  }

  function renderHeatmap(state) {
    var counts = window.Streak.activityCounts(state);
    var totalDays = getHeatmapDays();

    var label = byId('heatmap-label');
    if (label) label.textContent = '(' + rangeLabel(totalDays) + ')';
    var dailyLabel = byId('daily-range-label');
    if (dailyLabel) dailyLabel.textContent = '· ' + rangeLabel(totalDays);

    byId('heatmap').innerHTML = totalDays <= STRIP_MAX_DAYS
      ? stripHtml(counts, totalDays)
      : gridHtml(counts, totalDays);
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
    renderTaskGrids(state);
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
