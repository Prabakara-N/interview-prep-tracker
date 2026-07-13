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

  /* A task may feed a track. Ticking it records `defaultAmount` (editable) for that day,
   * which the SQL / DSA / Jobs graphs add on top of any detailed tab entries. */
  var TRACK_META = {
    sql:  { unit: 'mins',     defaultAmount: 30 },
    dsa:  { unit: 'problems', defaultAmount: 1 },
    jobs: { unit: 'jobs',     defaultAmount: 1 }
  };

  var DEFAULT_TASKS = [
    { id: 'task-dsa',    label: 'Solve DSA problems',      track: 'dsa' },
    { id: 'task-sql',    label: 'SQL / Postgres practice', track: 'sql' },
    { id: 'task-jobs',   label: 'Apply to jobs',           track: 'jobs' },
    { id: 'task-revise', label: 'Revise notes / patterns', track: null }
  ];

  // Backfill tracks for tasks saved before tracks existed (e.g. already in the jsonbin).
  var LEGACY_TRACKS = { 'task-dsa': 'dsa', 'task-sql': 'sql', 'task-jobs': 'jobs', 'task-revise': null };

  function normalizeTasks(tasks) {
    return tasks.map(function (t) {
      if (t && t.track !== undefined) return t;
      var track = Object.prototype.hasOwnProperty.call(LEGACY_TRACKS, t.id) ? LEGACY_TRACKS[t.id] : null;
      return Object.assign({}, t, { track: track });
    });
  }

  function normalize(s) {
    s = s || {};
    var checklist = s.checklist || {};
    var tasks = Array.isArray(checklist.tasks) && checklist.tasks.length
      ? normalizeTasks(checklist.tasks)
      : DEFAULT_TASKS.slice();
    return {
      sql: Array.isArray(s.sql) ? s.sql : [],
      dsa: Array.isArray(s.dsa) ? s.dsa : [],
      jobs: Array.isArray(s.jobs) ? s.jobs : [],
      checklist: {
        tasks: tasks,
        log: checklist.log && typeof checklist.log === 'object' ? checklist.log : {},
        // amounts[dayKey][taskId] = quantity entered for that task that day
        amounts: checklist.amounts && typeof checklist.amounts === 'object' ? checklist.amounts : {}
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

  function findTask(taskId) {
    return _state.checklist.tasks.filter(function (t) { return t.id === taskId; })[0];
  }

  /* Toggle a checklist task's completion for a given day.
   * Checking a tracked task seeds its default quantity; unchecking clears it. */
  function toggleTask(dateKey, taskId) {
    var cl = _state.checklist;
    var dayDone = (cl.log[dateKey] || []).slice();
    var idx = dayDone.indexOf(taskId);
    var checking = idx === -1;

    if (checking) dayDone.push(taskId);
    else dayDone.splice(idx, 1);

    var nextLog = Object.assign({}, cl.log);
    if (dayDone.length) nextLog[dateKey] = dayDone;
    else delete nextLog[dateKey];

    // Maintain the day's amounts alongside completion.
    var dayAmounts = Object.assign({}, cl.amounts[dateKey] || {});
    var task = findTask(taskId);
    if (checking) {
      if (task && task.track && dayAmounts[taskId] === undefined) {
        dayAmounts[taskId] = TRACK_META[task.track].defaultAmount;
      }
    } else {
      delete dayAmounts[taskId];
    }

    var nextAmounts = Object.assign({}, cl.amounts);
    if (Object.keys(dayAmounts).length) nextAmounts[dateKey] = dayAmounts;
    else delete nextAmounts[dateKey];

    commitChecklist({ tasks: cl.tasks, log: nextLog, amounts: nextAmounts });
  }

  /* Set the quantity a tracked task contributed on a given day. */
  function setTaskAmount(dateKey, taskId, amount) {
    var cl = _state.checklist;
    var n = Number(amount);
    if (isNaN(n) || n < 0) n = 0;

    var dayAmounts = Object.assign({}, cl.amounts[dateKey] || {}, {});
    dayAmounts[taskId] = n;

    var nextAmounts = Object.assign({}, cl.amounts);
    nextAmounts[dateKey] = dayAmounts;

    commitChecklist({ tasks: cl.tasks, log: cl.log, amounts: nextAmounts });
  }

  function addTask(label, track) {
    var task = {
      id: 'task-' + Math.random().toString(36).slice(2, 9),
      label: label,
      track: TRACK_META[track] ? track : null
    };
    commitChecklist({
      tasks: _state.checklist.tasks.concat([task]),
      log: _state.checklist.log,
      amounts: _state.checklist.amounts
    });
  }

  function removeTask(taskId) {
    var cl = _state.checklist;
    // Drop the task and purge its completions + amounts from history.
    var nextLog = {};
    Object.keys(cl.log).forEach(function (day) {
      var kept = cl.log[day].filter(function (id) { return id !== taskId; });
      if (kept.length) nextLog[day] = kept;
    });
    var nextAmounts = {};
    Object.keys(cl.amounts).forEach(function (day) {
      var dayAmounts = Object.assign({}, cl.amounts[day]);
      delete dayAmounts[taskId];
      if (Object.keys(dayAmounts).length) nextAmounts[day] = dayAmounts;
    });
    commitChecklist({
      tasks: cl.tasks.filter(function (t) { return t.id !== taskId; }),
      log: nextLog,
      amounts: nextAmounts
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
    setTaskAmount: setTaskAmount,
    addTask: addTask,
    removeTask: removeTask,
    persist: persist,
    normalize: normalize,
    TRACK_META: TRACK_META
  };
})();
