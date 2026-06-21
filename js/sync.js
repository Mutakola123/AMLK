const Sync = {
  db: null,
  orgId: null,
  connected: false,
  listeners: [],
  _unsavedChanges: {},

  init(callback) {
    const config = this.getConfig();
    if (!config || !config.apiKey) {
      if (callback) callback(false);
      return;
    }
    this.orgId = config.orgId || 'default';

    if (!window.firebase || !firebase.apps.length) {
      try {
        firebase.initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          databaseURL: config.databaseURL,
          projectId: config.projectId
        });
        this.db = firebase.database();
        this.connected = true;
        if (callback) callback(true);
      } catch (e) {
        console.warn('Firebase init failed:', e);
        this.connected = false;
        if (callback) callback(false);
      }
    } else {
      this.db = firebase.database();
      this.connected = true;
      if (callback) callback(true);
    }
  },

  getConfig() {
    try { return JSON.parse(localStorage.getItem('_syncConfig') || 'null'); } catch { return null; }
  },

  saveConfig(cfg) {
    localStorage.setItem('_syncConfig', JSON.stringify(cfg));
  },

  isConfigured() {
    const c = this.getConfig();
    return c && c.apiKey && c.databaseURL;
  },

  _path(key) {
    return this.orgId + '/' + key;
  },

  pushAll(callback) {
    if (!this.connected || !this.db) { if (callback) callback(false); return; }
    const keys = ['properties','tenants','units','contracts','installments','maintenance','vouchers','finEntries','company','users'];
    let done = 0;
    let hasError = false;
    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        this.db.ref(this._path(key)).set(JSON.parse(data), (err) => {
          if (err) { hasError = true; console.warn('Push error:', key, err); }
          done++;
          if (done === keys.length && callback) callback(!hasError);
        });
      } else {
        done++;
        if (done === keys.length && callback) callback(!hasError);
      }
    });
  },

  push(key, data, callback) {
    if (!this.connected || !this.db) { if (callback) callback(false); return; }
    this.db.ref(this._path(key)).set(data, (err) => {
      if (err) console.warn('Push error:', key, err);
      if (callback) callback(!err);
    });
  },

  pullAll(callback) {
    if (!this.connected || !this.db) { if (callback) callback(false, {}); return; }
    this.db.ref(this.orgId).once('value', (snap) => {
      const remote = snap.val() || {};
      const keys = ['properties','tenants','units','contracts','installments','maintenance','vouchers','finEntries','company','users'];
      let updated = 0;
      keys.forEach(key => {
        if (remote[key]) {
          const localData = localStorage.getItem(key);
          let local = null;
          try { local = localData ? JSON.parse(localData) : null; } catch { local = null; }
          const remoteData = remote[key];
          if (!local || (JSON.stringify(remoteData) !== JSON.stringify(local))) {
            localStorage.setItem(key, JSON.stringify(remoteData));
            updated++;
          }
        }
      });
      if (callback) callback(true, { updated, remote });
    }, (err) => {
      console.warn('Pull error:', err);
      if (callback) callback(false, {});
    });
  },

  pull(key, callback) {
    if (!this.connected || !this.db) { if (callback) callback(null); return; }
    this.db.ref(this._path(key)).once('value', (snap) => {
      if (callback) callback(snap.val());
    }, (err) => {
      console.warn('Pull error:', key, err);
      if (callback) callback(null);
    });
  },

  remove(key, callback) {
    if (!this.connected || !this.db) { if (callback) callback(false); return; }
    this.db.ref(this._path(key)).remove((err) => {
      if (callback) callback(!err);
    });
  },

  startRealtime() {
    if (!this.connected || !this.db) return;
    const keys = ['properties','tenants','units','contracts','installments','maintenance','vouchers','finEntries'];
    keys.forEach(key => {
      this.db.ref(this._path(key)).on('value', (snap) => {
        const remote = snap.val();
        if (remote) {
          const local = localStorage.getItem(key);
          if (JSON.stringify(remote) !== local) {
            localStorage.setItem(key, JSON.stringify(remote));
            if (typeof refreshCurrentPage === 'function') {
              try { refreshCurrentPage(); } catch(e) {}
            }
          }
        }
      });
    });
  },

  stopRealtime() {
    if (!this.db) return;
    this.db.ref(this.orgId).off();
  }
};
