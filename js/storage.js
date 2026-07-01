/* Storage layer: localStorage cache + optional jsonbin.io cloud sync.
 *
 * Strategy:
 *  - localStorage is the always-available source of truth for instant load.
 *  - If jsonbin is configured, we GET on init (cloud wins if newer) and PUT on save.
 *  - All cloud calls degrade gracefully: failures fall back to localStorage only.
 */
window.Storage = (function () {
  var LS_KEY = 'ipt-data-v1';
  var cfg = window.IPT_CONFIG || {};

  function authKey() { return cfg.JSONBIN_ACCESS_KEY || cfg.JSONBIN_MASTER_KEY || ''; }

  function isCloudEnabled() {
    return !!(authKey() && cfg.JSONBIN_BIN_ID);
  }

  /* jsonbin accepts either an Access Key (X-Access-Key) or a Master Key
   * (X-Master-Key). Prefer the access key when both are present. */
  function authHeaders(extra) {
    var h = extra || {};
    if (cfg.JSONBIN_ACCESS_KEY) h['X-Access-Key'] = cfg.JSONBIN_ACCESS_KEY;
    else if (cfg.JSONBIN_MASTER_KEY) h['X-Master-Key'] = cfg.JSONBIN_MASTER_KEY;
    return h;
  }

  function emptyState() {
    return { sql: [], dsa: [], jobs: [], meta: { updatedAt: 0 } };
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Local read failed', e);
      return null;
    }
  }

  function writeLocal(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Local write failed', e);
      return false;
    }
  }

  function cloudGet() {
    if (!isCloudEnabled()) return Promise.resolve(null);
    return fetch(cfg.JSONBIN_BASE + '/' + cfg.JSONBIN_BIN_ID + '/latest', {
      headers: authHeaders()
    })
      .then(function (r) {
        if (!r.ok) throw new Error('jsonbin GET ' + r.status);
        return r.json();
      })
      .then(function (json) { return json.record || null; })
      .catch(function (e) { console.warn('Cloud GET failed', e); return null; });
  }

  function cloudPut(state) {
    if (!isCloudEnabled()) return Promise.resolve(false);
    return fetch(cfg.JSONBIN_BASE + '/' + cfg.JSONBIN_BIN_ID, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(state)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('jsonbin PUT ' + r.status);
        return true;
      })
      .catch(function (e) { console.warn('Cloud PUT failed', e); return false; });
  }

  // Tracks whether the last cloud GET actually reached jsonbin (for honest status).
  var _cloudActive = false;
  function cloudActive() { return _cloudActive; }

  /* Load: merge local + cloud, newest meta.updatedAt wins. Returns a Promise<state>. */
  function load() {
    var local = readLocal();
    return cloudGet().then(function (cloud) {
      _cloudActive = !!cloud;
      if (!cloud) return local || emptyState();
      if (!local) return cloud;
      var lu = (local.meta && local.meta.updatedAt) || 0;
      var cu = (cloud.meta && cloud.meta.updatedAt) || 0;
      return cu >= lu ? cloud : local;
    });
  }

  /* Save: write local immediately, then push to cloud. Returns Promise<{cloud:boolean}>. */
  function save(state) {
    writeLocal(state);
    return cloudPut(state).then(function (ok) { return { cloud: ok }; });
  }

  return {
    emptyState: emptyState,
    isCloudEnabled: isCloudEnabled,
    cloudActive: cloudActive,
    load: load,
    save: save,
    readLocal: readLocal,
    writeLocal: writeLocal
  };
})();
