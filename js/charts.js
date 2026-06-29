/* Chart.js rendering. Charts are destroyed/recreated on each render so they
 * stay in sync with state and adapt to theme changes. Daily-progress charts
 * use the range selected in the Activity filter (UI.getHeatmapDays()). */
window.Charts = (function () {
  var instances = {};

  function isDark() { return document.documentElement.classList.contains('dark'); }
  function gridColor() { return isDark() ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)'; }
  function tickColor() { return isDark() ? '#94a3b8' : '#64748b'; }

  function destroy(key) {
    if (instances[key]) { instances[key].destroy(); delete instances[key]; }
  }

  /* Window size (days) for the daily charts, from the Activity range filter. */
  function rangeDays() {
    if (window.UI && typeof window.UI.getHeatmapDays === 'function') return window.UI.getHeatmapDays();
    return 30;
  }

  /* Ordered last-N day-keys. */
  function lastNDays(n) {
    var out = [];
    var d = new Date();
    for (var i = n - 1; i >= 0; i--) out.push(window.Streak.toKey(window.Streak.addDays(d, -i)));
    return out;
  }

  function shortLabel(key) { return key.slice(5); } // MM-DD

  function countByDay(arr, keys) {
    return keys.map(function (k) { return arr.filter(function (e) { return e.date === k; }).length; });
  }
  function minutesByDay(arr, keys) {
    return keys.map(function (k) {
      return arr.filter(function (e) { return e.date === k; })
        .reduce(function (s, e) { return s + (Number(e.minutes) || 0); }, 0);
    });
  }
  function tasksByDay(state, keys) {
    var log = (state.checklist && state.checklist.log) || {};
    return keys.map(function (k) { return (log[k] || []).length; });
  }

  function baseOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: tickColor(), precision: 0 } }
      }
    };
  }

  function lineChart(canvasId, key, days, labels, data, color) {
    destroy(key);
    instances[key] = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data, borderColor: color, backgroundColor: color + '22',
          tension: 0.3, fill: true, pointRadius: days > 60 ? 0 : 2, borderWidth: 2
        }]
      },
      options: baseOpts()
    });
  }

  function barChart(canvasId, key, labels, data, color) {
    destroy(key);
    instances[key] = new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: color, borderRadius: 4 }] },
      options: baseOpts()
    });
  }

  /* ---- Per-track daily progress ---- */
  function renderDailyProgress(state) {
    var days = rangeDays();
    var keys = lastNDays(days);
    var labels = keys.map(shortLabel);

    lineChart('chart-sql-daily', 'sqlDaily', days, labels, minutesByDay(state.sql, keys), '#4f46e5');   // SQL minutes/day
    barChart('chart-dsa-daily', 'dsaDaily', labels, countByDay(state.dsa, keys), '#10b981');             // DSA problems/day
    barChart('chart-jobs-daily', 'jobsDaily', labels, countByDay(state.jobs, keys), '#f59e0b');          // Jobs applied/day
    lineChart('chart-tasks-daily', 'tasksDaily', days, labels, tasksByDay(state, keys), '#ec4899');      // Tasks completed/day
  }

  /* ---- Breakdowns ---- */
  function renderJobsByStatus(state) {
    var order = ['Applied', 'Online Assessment', 'Interview', 'Offer', 'Rejected'];
    var colors = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'];
    var counts = order.map(function (s) { return state.jobs.filter(function (e) { return e.status === s; }).length; });
    destroy('jobsStatus');
    instances['jobsStatus'] = new Chart(document.getElementById('chart-jobs-status'), {
      type: 'doughnut',
      data: { labels: order, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: tickColor(), boxWidth: 12 } } }
      }
    });
  }

  function renderDifficulty(state) {
    var levels = ['Easy', 'Medium', 'Hard'];
    var colors = ['#10b981', '#f59e0b', '#ef4444'];
    var counts = levels.map(function (l) { return state.dsa.filter(function (e) { return e.difficulty === l; }).length; });
    barChart('chart-difficulty', 'difficulty', levels, counts, colors);
  }

  function renderAll(state) {
    if (typeof Chart === 'undefined') return;
    renderDailyProgress(state);
    renderJobsByStatus(state);
    renderDifficulty(state);
  }

  return { renderAll: renderAll };
})();
