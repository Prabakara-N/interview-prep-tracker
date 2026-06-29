/* In-memory app state with immutable update helpers.
 * Every mutation returns a new state object (no in-place mutation), then persists. */
window.AppState = (function () {
  var _state = window.Storage.emptyState();
  var _listeners = [];

  function get() { return _state; }

  function subscribe(fn) { _listeners.push(fn); }

  function notify() {
    for (var i = 0; i < _listeners.length; i++) _listeners[i](_state);
  }

  /* Replace whole state (used after load/import). */
  function set(next) {
    _state = normalize(next);
    notify();
  }

  var DEFAULT_TASKS = [
    { id: 'task-dsa', label: 'Solve DSA problems' },
    { id: 'task-sql', label: 'SQL / Postgres practice' },
    { id: 'task-jobs', label: 'Apply to jobs' },
    { id: 'task-revise', label: 'Revise notes / patterns' }
  ];

  function normalize(s) {
    s = s || {};
    var checklist = s.checklist || {};
    return {
      sql: Array.isArray(s.sql) ? s.sql : [],
      dsa: Array.isArray(s.dsa) ? s.dsa : [],
      jobs: Array.isArray(s.jobs) ? s.jobs : [],
      checklist: {
        tasks: Array.isArray(checklist.tasks) ? checklist.tasks : DEFAULT_TASKS.slice(),
        log: checklist.log && typeof checklist.log === 'object' ? checklist.log : {}
      },
      meta: s.meta || { updatedAt: 0 }
    };
  }

  function uid() {
    return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + (_state.meta.seq = (_state.meta.seq || 0) + 1);
  }

  /* Add an entry to a collection; returns nothing, triggers save via caller. */
  function addEntry(collection, entry) {
    var withId = Object.assign({ id: uid() }, entry);
    var next = Object.assign({}, _state);
    next[collection] = _state[collection].concat([withId]);
    next.meta = Object.assign({}, _state.meta, { updatedAt: Date.now() });
    _state = next;
    notify();
    persist();
  }

  function removeEntry(collection, id) {
    var next = Object.assign({}, _state);
    next[collection] = _state[collection].filter(function (e) { return e.id !== id; });
    next.meta = Object.assign({}, _state.meta, { updatedAt: Date.now() });
    _state = next;
    notify();
    persist();
  }

  /* Toggle a checklist task's completion for a given day. */
  function toggleTask(dateKey, taskId) {
    var log = _state.checklist.log;
    var dayDone = (log[dateKey] || []).slice();
    var idx = dayDone.indexOf(taskId);
    if (idx === -1) dayDone.push(taskId);
    else dayDone.splice(idx, 1);

    var nextLog = Object.assign({}, log);
    if (dayDone.length) nextLog[dateKey] = dayDone;
    else delete nextLog[dateKey];

    commitChecklist({ tasks: _state.checklist.tasks, log: nextLog });
  }

  function addTask(label) {
    var task = { id: 'task-' + Math.random().toString(36).slice(2, 9), label: label };
    commitChecklist({
      tasks: _state.checklist.tasks.concat([task]),
      log: _state.checklist.log
    });
  }

  function removeTask(taskId) {
    // Drop the task and purge its completions from the log.
    var nextLog = {};
    Object.keys(_state.checklist.log).forEach(function (day) {
      var kept = _state.checklist.log[day].filter(function (id) { return id !== taskId; });
      if (kept.length) nextLog[day] = kept;
    });
    commitChecklist({
      tasks: _state.checklist.tasks.filter(function (t) { return t.id !== taskId; }),
      log: nextLog
    });
  }

  function commitChecklist(checklist) {
    var next = Object.assign({}, _state, { checklist: checklist });
    next.meta = Object.assign({}, _state.meta, { updatedAt: Date.now() });
    _state = next;
    notify();
    persist();
  }

  function persist() {
    return window.Storage.save(_state);
  }

  return {
    get: get,
    set: set,
    subscribe: subscribe,
    addEntry: addEntry,
    removeEntry: removeEntry,
    toggleTask: toggleTask,
    addTask: addTask,
    removeTask: removeTask,
    persist: persist,
    normalize: normalize
  };
})();
