/* App bootstrap: wires events, loads data, renders. */
(function () {
  'use strict';

  function todayStr() { return window.Streak.todayStr(); }

  /* Prefill all date inputs with today. */
  function prefillDates() {
    document.querySelectorAll('input[type="date"]').forEach(function (input) {
      if (!input.value) input.value = todayStr();
    });
  }

  function formToObject(form) {
    var obj = {};
    new FormData(form).forEach(function (v, k) { obj[k] = typeof v === 'string' ? v.trim() : v; });
    return obj;
  }

  function wireForm(formId, collection, requiredFields) {
    var form = document.getElementById(formId);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = formToObject(form);
      // Validation at the boundary.
      for (var i = 0; i < requiredFields.length; i++) {
        if (!data[requiredFields[i]]) {
          window.UI.toast('Please fill in: ' + requiredFields[i], 'error');
          return;
        }
      }
      if (data.minutes === '') delete data.minutes;
      window.AppState.addEntry(collection, data);
      window.UI.toast('Saved ✓', 'success');
      form.reset();
      prefillDates();
    });
  }

  function wireTabs() {
    document.getElementById('tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (btn) window.UI.activateTab(btn.dataset.tab);
    });
  }

  function wireDelete() {
    document.body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      if (!confirm('Delete this entry?')) return;
      window.AppState.removeEntry(btn.dataset.del, btn.dataset.id);
      window.UI.toast('Deleted', 'success');
    });
  }

  function wireChecklist() {
    // Toggle a task's completion for today. Tracked tasks contribute their
    // fixed amount (see TRACK_META) to the matching graph — no input needed.
    document.getElementById('checklist-today').addEventListener('change', function (e) {
      var cb = e.target.closest('[data-toggle]');
      if (!cb) return;
      window.AppState.toggleTask(todayStr(), cb.dataset.toggle);
    });

    // Remove a daily task entirely.
    document.getElementById('checklist-today').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-deltask]');
      if (!btn) return;
      e.preventDefault();
      if (!confirm('Remove this daily task? Its history will be cleared.')) return;
      window.AppState.removeTask(btn.dataset.deltask);
      window.UI.toast('Task removed', 'success');
    });

    // Add a new daily task. It gets its own graph; a tick counts as 1/day.
    document.getElementById('form-task').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = e.target.querySelector('[name=label]');
      var label = input.value.trim();
      if (!label) { window.UI.toast('Enter a task name', 'error'); return; }
      window.AppState.addTask(label, null);
      input.value = '';
      window.UI.toast('Task added ✓', 'success');
    });
  }

  function wireTheme() {
    document.getElementById('theme-toggle').addEventListener('click', window.UI.toggleTheme);
  }

  function wireHeatmapRange() {
    var sel = document.getElementById('heatmap-range');
    sel.value = String(window.UI.getHeatmapDays()); // restore saved range
    sel.addEventListener('change', function () {
      window.UI.setHeatmapRange(parseInt(sel.value, 10));
    });
  }

  function wireExportImport() {
    document.getElementById('export-btn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(window.AppState.get(), null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'interview-prep-' + todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    var fileInput = document.getElementById('import-file');
    document.getElementById('import-btn').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          window.AppState.set(parsed);
          window.AppState.persist();
          window.UI.toast('Imported ✓', 'success');
        } catch (err) {
          window.UI.toast('Invalid JSON file', 'error');
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  function wireSync() {
    document.getElementById('sync-btn').addEventListener('click', function () {
      if (!window.Storage.isCloudEnabled()) {
        window.UI.toast('Add jsonbin keys in js/config.js to enable sync', 'error');
        return;
      }
      window.UI.setSyncStatus('syncing…', false);
      window.AppState.persist().then(function (r) {
        if (r.cloud) { window.UI.setSyncStatus('synced ✓', true); window.UI.toast('Synced to jsonbin ✓', 'success'); }
        else { window.UI.setSyncStatus('sync failed', false); window.UI.toast('Cloud sync failed (saved locally)', 'error'); }
      });
    });
  }

  function init() {
    // Render on every state change.
    window.AppState.subscribe(function (state) { window.UI.renderAll(state); });

    // Show local data immediately (or a fresh normalized state) so the dashboard
    // — including the default checklist — always renders on load, then reconcile
    // with cloud. normalize() backfills checklist defaults for older saved data.
    var local = window.Storage.readLocal();
    window.AppState.set(local || window.Storage.emptyState());

    window.UI.activateTab('dashboard');
    prefillDates();

    // Render the static Lucide icons (header, tabs, stat cards, footer).
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    wireForm('form-sql', 'sql', ['date', 'topic']);
    wireForm('form-dsa', 'dsa', ['date', 'problem']);
    wireForm('form-jobs', 'jobs', ['date', 'company', 'role']);
    wireTabs();
    wireDelete();
    wireChecklist();
    wireTheme();
    wireHeatmapRange();
    wireExportImport();
    wireSync();

    if (window.Storage.isCloudEnabled()) {
      window.UI.setSyncStatus('loading…', false);
      window.Storage.load().then(function (state) {
        window.AppState.set(state);
        // Only claim "synced" if the cloud was actually reachable this load.
        if (window.Storage.cloudActive()) {
          window.AppState.persist();
          window.UI.setSyncStatus('synced ✓', true);
        } else {
          window.UI.setSyncStatus('offline — retry sync', false);
        }
      }).catch(function () {
        window.UI.setSyncStatus('offline — retry sync', false);
      });
    } else {
      window.UI.setSyncStatus('local only', false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
