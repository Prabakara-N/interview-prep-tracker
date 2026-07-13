/* Single source of truth for every number shown in the app.
 *
 * Each track's daily value = detailed entries logged in its tab
 *                          + quantities entered on checklist tasks bound to that track.
 * Both the graphs and the stat cards read from here, so they can never disagree. */
window.Metrics = (function () {

  function taskById(state, id) {
    var tasks = (state.checklist && state.checklist.tasks) || [];
    for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i];
    return null;
  }

  /* Quantity contributed by completed checklist tasks bound to `track` on a day. */
  function checklistAmount(state, dayKey, track) {
    var cl = state.checklist || {};
    var done = (cl.log && cl.log[dayKey]) || [];
    var amounts = (cl.amounts && cl.amounts[dayKey]) || {};
    var total = 0;
    for (var i = 0; i < done.length; i++) {
      var t = taskById(state, done[i]);
      if (t && t.track === track) {
        var n = Number(amounts[done[i]]);
        if (!isNaN(n)) total += n;
      }
    }
    return total;
  }

  /* ---- Per-day values ---- */
  function sqlMinutes(state, dayKey) {
    var fromEntries = (state.sql || [])
      .filter(function (e) { return e.date === dayKey; })
      .reduce(function (s, e) { return s + (Number(e.minutes) || 0); }, 0);
    return fromEntries + checklistAmount(state, dayKey, 'sql');
  }

  function dsaSolved(state, dayKey) {
    var fromEntries = (state.dsa || []).filter(function (e) { return e.date === dayKey; }).length;
    return fromEntries + checklistAmount(state, dayKey, 'dsa');
  }

  function jobsApplied(state, dayKey) {
    var fromEntries = (state.jobs || []).filter(function (e) { return e.date === dayKey; }).length;
    return fromEntries + checklistAmount(state, dayKey, 'jobs');
  }

  function tasksCompleted(state, dayKey) {
    var log = (state.checklist && state.checklist.log) || {};
    return (log[dayKey] || []).length;
  }

  /* Was this task ticked on this day? */
  function taskDone(state, taskId, dayKey) {
    var log = (state.checklist && state.checklist.log) || {};
    return (log[dayKey] || []).indexOf(taskId) !== -1;
  }

  /* Daily value for ONE checklist task: its tracked amount if it has one
   * (DSA 1 / SQL 30 / Jobs 1), otherwise 1 when ticked. 0 when not done. */
  function taskDaily(state, taskId, dayKey) {
    if (!taskDone(state, taskId, dayKey)) return 0;
    var amounts = (state.checklist.amounts && state.checklist.amounts[dayKey]) || {};
    var n = Number(amounts[taskId]);
    return isNaN(n) ? 1 : n;
  }

  /* ---- All-time totals ---- */
  function totalChecklistAmount(state, track) {
    var log = (state.checklist && state.checklist.log) || {};
    return Object.keys(log).reduce(function (sum, day) {
      return sum + checklistAmount(state, day, track);
    }, 0);
  }

  function totalDsa(state) {
    return (state.dsa || []).length + totalChecklistAmount(state, 'dsa');
  }

  function totalJobs(state) {
    return (state.jobs || []).length + totalChecklistAmount(state, 'jobs');
  }

  return {
    checklistAmount: checklistAmount,
    sqlMinutes: sqlMinutes,
    dsaSolved: dsaSolved,
    jobsApplied: jobsApplied,
    tasksCompleted: tasksCompleted,
    taskDone: taskDone,
    taskDaily: taskDaily,
    totalDsa: totalDsa,
    totalJobs: totalJobs
  };
})();
