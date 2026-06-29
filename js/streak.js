/* Streak + date utilities. A day is "active" if it has >=1 logged activity
 * across SQL, DSA, or Jobs. Dates are handled as local YYYY-MM-DD strings. */
window.Streak = (function () {

  function todayStr() { return toKey(new Date()); }

  function toKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function fromKey(key) {
    var p = key.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function addDays(d, n) {
    var c = new Date(d.getTime());
    c.setDate(c.getDate() + n);
    return c;
  }

  function isSunday(d) { return d.getDay() === 0; }

  /* Previous "working" day — steps back past Sundays (rest days). */
  function prevWorkingDay(d) {
    var c = addDays(d, -1);
    while (isSunday(c)) c = addDays(c, -1);
    return c;
  }

  /* Build a Set of active day-keys from all collections + checklist completions. */
  function activeDays(state) {
    var set = new Set();
    ['sql', 'dsa', 'jobs'].forEach(function (k) {
      (state[k] || []).forEach(function (e) {
        if (e && e.date) set.add(e.date);
      });
    });
    var log = state.checklist && state.checklist.log;
    if (log) Object.keys(log).forEach(function (day) {
      if (log[day] && log[day].length) set.add(day);
    });
    return set;
  }

  /* Map of day-key -> activity count (for the heatmap intensity). */
  function activityCounts(state) {
    var map = {};
    ['sql', 'dsa', 'jobs'].forEach(function (k) {
      (state[k] || []).forEach(function (e) {
        if (e && e.date) map[e.date] = (map[e.date] || 0) + 1;
      });
    });
    var log = state.checklist && state.checklist.log;
    if (log) Object.keys(log).forEach(function (day) {
      if (log[day]) map[day] = (map[day] || 0) + log[day].length;
    });
    return map;
  }

  /* Current streak — counts back over working days (Mon–Sat). Sundays are
   * ignored: a missing Sunday never breaks the streak, and Sunday activity
   * is not counted. Grace: today not yet logged doesn't break the streak. */
  function current(state) {
    var days = activeDays(state);
    if (days.size === 0) return 0;
    var cursor = new Date();
    while (isSunday(cursor)) cursor = addDays(cursor, -1); // ignore Sunday (today)
    // If the latest working day isn't active yet, the streak may end on the prior one.
    if (!days.has(toKey(cursor))) {
      cursor = prevWorkingDay(cursor);
      if (!days.has(toKey(cursor))) return 0;
    }
    var count = 0;
    while (days.has(toKey(cursor))) {
      count++;
      cursor = prevWorkingDay(cursor);
    }
    return count;
  }

  /* Longest run of consecutive active working days, ever (Sundays bridged/ignored). */
  function longest(state) {
    var working = Array.from(activeDays(state))
      .filter(function (k) { return !isSunday(fromKey(k)); })
      .sort();
    if (!working.length) return 0;
    var best = 1, run = 1;
    for (var i = 1; i < working.length; i++) {
      // Consecutive iff the prior working day (skipping Sundays) is also active.
      var expectedPrev = toKey(prevWorkingDay(fromKey(working[i])));
      if (expectedPrev === working[i - 1]) { run++; best = Math.max(best, run); }
      else { run = 1; }
    }
    return best;
  }

  return {
    todayStr: todayStr,
    toKey: toKey,
    fromKey: fromKey,
    addDays: addDays,
    isSunday: isSunday,
    prevWorkingDay: prevWorkingDay,
    activeDays: activeDays,
    activityCounts: activityCounts,
    current: current,
    longest: longest
  };
})();
