/* Chart.js rendering.
 *
 * Layout: "Tasks completed / day" (all tasks) first, then ONE graph per checklist
 * task — created and removed automatically as you add/delete tasks.
 * Window = the range selected in the Activity filter (UI.getHeatmapDays()). */
window.Charts = (function () {
  var instances = {};

  /* Colour + icon per task, keyed by its track; custom/habit tasks cycle a palette. */
  var TRACK_STYLE = {
    dsa:  { color: '#10b981', icon: 'puzzle',    unit: 'problems' },
    sql:  { color: '#4f46e5', icon: 'database',  unit: 'mins' },
    jobs: { color: '#f59e0b', icon: 'briefcase', unit: 'jobs' }
  };
  var PALETTE = ['#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

  function taskStyle(task, index) {
    if (task.track && TRACK_STYLE[task.track]) return TRACK_STYLE[task.track];
    return { color: PALETTE[index % PALETTE.length], icon: 'circle-check', unit: 'done' };
  }

  function isDark() { return document.documentElement.classList.contains('dark'); }
  function gridColor() { return isDark() ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)'; }
  function tickColor() { return isDark() ? '#94a3b8' : '#64748b'; }

  function destroy(key) {
    if (instances[key]) { instances[key].destroy(); delete instances[key]; }
  }

  function rangeDays() {
    if (window.UI && typeof window.UI.getHeatmapDays === 'function') return window.UI.getHeatmapDays();
    return 30;
  }

  function lastNDays(n) {
    var out = [];
    var d = new Date();
    for (var i = n - 1; i >= 0; i--) out.push(window.Streak.toKey(window.Streak.addDays(d, -i)));
    return out;
  }

  function shortLabel(key) { return key.slice(5); } // MM-DD

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

  function barChart(canvasId, key, labels, data, color) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    destroy(key);
    instances[key] = new Chart(el, {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: color, borderRadius: 4 }] },
      options: baseOpts()
    });
  }

  function lineChart(canvasId, key, days, labels, data, color) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    destroy(key);
    instances[key] = new Chart(el, {
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

  /* Only one chart now: tasks completed per day. Each individual task is shown as an
   * activity grid (✓ done / ✗ missed) rendered by UI.renderTaskGrids, not a chart. */
  function renderAll(state) {
    if (typeof Chart === 'undefined') return;
    var days = rangeDays();
    var keys = lastNDays(days);
    lineChart('chart-tasks-daily', 'tasksDaily', days, keys.map(shortLabel),
      keys.map(function (k) { return window.Metrics.tasksCompleted(state, k); }), '#ec4899');
  }

  return { renderAll: renderAll, taskStyle: taskStyle };
})();
