/* EnSelle — logique partagée entre l'application et le service worker.
   Aucune dépendance. Les dates sont des chaînes locales "AAAA-MM-JJ". */
(function (g) {
  'use strict';
  var DAY = 86400000;

  function parseDate(s) {
    var p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function toISO(d) {
    var m = d.getMonth() + 1, j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
  }
  function todayISO() { return toISO(new Date()); }
  function daysBetween(a, b) { // b - a, en jours entiers (a, b : Date)
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / DAY);
  }
  function addMonths(iso, n) {
    var d = parseDate(iso), day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d;
  }
  function addDays(d, n) { var r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; }

  /* Tous les relevés connus (compteur + interventions), triés par date. */
  function readings(bike) {
    var pts = [];
    (bike.kmLog || []).forEach(function (e) { pts.push({ date: e.date, km: Number(e.km) }); });
    (bike.history || []).forEach(function (e) { if (e.km != null && e.km !== '') pts.push({ date: e.date, km: Number(e.km) }); });
    pts.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.km - b.km; });
    return pts;
  }

  function currentKm(bike) {
    var best = { km: 0, date: null };
    readings(bike).forEach(function (p) { if (p.km >= best.km) best = p; });
    return best;
  }

  /* Kilomètres par jour, estimés sur les 12 derniers mois de relevés.
     Retourne null tant qu'il n'y a pas au moins 14 jours d'écart entre deux relevés. */
  function kmPerDay(bike) {
    var pts = readings(bike);
    if (pts.length < 2) return null;
    var last = pts[pts.length - 1];
    pts.forEach(function (p) { if (p.km > last.km) last = p; });
    var limit = toISO(addDays(parseDate(last.date), -365));
    var first = null;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].date >= limit) { first = pts[i]; break; }
    }
    if (!first) return null;
    var span = daysBetween(parseDate(first.date), parseDate(last.date));
    var dkm = last.km - first.km;
    if (span < 14 || dkm <= 0) return null;
    return dkm / span;
  }

  function lastDone(bike, taskId) {
    var best = null;
    (bike.history || []).forEach(function (e) {
      if ((e.taskIds || []).indexOf(taskId) === -1) return;
      if (!best || e.date > best.date || (e.date === best.date && Number(e.km) > Number(best.km))) best = e;
    });
    return best;
  }

  /* État d'une opération d'entretien.
     state : 'late' (en retard) | 'soon' (bientôt) | 'ok' | 'unknown' (jamais renseignée) */
  function taskStatus(bike, task, settings, todayStr) {
    settings = settings || {};
    var warnKm = Number(settings.warnKm != null ? settings.warnKm : 500);
    var warnDays = Number(settings.warnDays != null ? settings.warnDays : 30);
    var today = parseDate(todayStr || todayISO());
    var cur = currentKm(bike).km;
    var rate = kmPerDay(bike);
    var last = lastDone(bike, task.id);
    var intKm = Number(task.intKm) || 0;
    var intMonths = Number(task.intMonths) || 0;

    var r = { task: task, state: 'unknown', last: last, currentKm: cur, rate: rate,
      dueKm: null, dueDate: null, remKm: null, remDays: null, estDays: null,
      effDays: null, progress: 0 };
    if (!last) return r;

    var lastKm = Number(last.km) || 0;
    if (intKm) {
      r.dueKm = lastKm + intKm;
      r.remKm = r.dueKm - cur;
      if (rate) r.estDays = Math.max(0, Math.round(r.remKm / rate));
      r.progress = Math.max(r.progress, (cur - lastKm) / intKm);
    }
    if (intMonths) {
      var due = addMonths(last.date, intMonths);
      r.dueDate = toISO(due);
      r.remDays = daysBetween(today, due);
      var total = daysBetween(parseDate(last.date), due) || 1;
      r.progress = Math.max(r.progress, daysBetween(parseDate(last.date), today) / total);
    }
    var cands = [];
    if (r.remDays != null) cands.push(r.remDays);
    if (r.estDays != null) cands.push(r.remKm <= 0 ? Math.min(0, r.remKm) : r.estDays);
    r.effDays = cands.length ? Math.min.apply(null, cands) : null;

    var late = (r.remKm != null && r.remKm <= 0) || (r.remDays != null && r.remDays < 0);
    var soon = (r.remKm != null && r.remKm <= warnKm) || (r.remDays != null && r.remDays <= warnDays) ||
      (r.estDays != null && r.estDays <= warnDays);
    r.state = late ? 'late' : soon ? 'soon' : 'ok';
    r.progress = Math.max(0, Math.min(1, r.progress));
    return r;
  }

  var RANK = { late: 0, unknown: 1, soon: 2, ok: 3 };
  function sortKey(s) {
    var v = s.effDays;
    if (v == null && s.remKm != null) v = s.remKm / 30; // pas encore de rythme connu : ~30 km/j
    if (v == null) v = 1e9;
    return v;
  }
  function bikeStatuses(bike, settings, todayStr) {
    return (bike.tasks || []).map(function (t) { return taskStatus(bike, t, settings, todayStr); })
      .sort(function (a, b) {
        return (RANK[a.state] - RANK[b.state]) || (sortKey(a) - sortKey(b)) || a.task.name.localeCompare(b.task.name);
      });
  }

  function fmtKm(n) { return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' km'; }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = parseDate(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDelay(days) {
    var a = Math.abs(days);
    if (a === 0) return "aujourd'hui";
    if (a < 45) return a + (a > 1 ? ' jours' : ' jour');
    var m = Math.round(a / 30.44);
    if (m < 18) return m + ' mois';
    var y = Math.round(a / 36.5) / 10;
    return String(y).replace('.', ',') + ' ans';
  }

  /* Phrase courte pour une notification ou un résumé. */
  function describe(s) {
    if (s.state === 'unknown') return 'Date de la dernière fois à renseigner';
    var parts = [];
    if (s.state === 'late') {
      if (s.remKm != null && s.remKm <= 0) parts.push('dépassé de ' + fmtKm(-s.remKm));
      if (s.remDays != null && s.remDays < 0) parts.push('échéance passée depuis ' + fmtDelay(s.remDays));
      return 'En retard : ' + parts.join(', ');
    }
    if (s.remKm != null) parts.push('dans ' + fmtKm(s.remKm));
    if (s.remDays != null) parts.push((s.remKm != null ? 'ou ' : '') + 'dans ' + fmtDelay(s.remDays));
    else if (s.estDays != null) parts.push('(~ ' + fmtDelay(s.estDays) + ')');
    return 'À faire ' + parts.join(' ');
  }

  /* Date d'échéance la plus probable (pour l'agenda) : la plus proche entre date et estimation km. */
  function expectedDate(s, todayStr) {
    var today = parseDate(todayStr || todayISO());
    if (s.effDays == null) return null;
    return toISO(addDays(today, Math.max(0, s.effDays)));
  }

  /* Mini-stockage IndexedDB (utilisable par la page et par le service worker). */
  function idb() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open('carnet-moto', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var r = db.transaction('kv').objectStore('kv').get(key);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbSet(key, val) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  /* Liste des rappels à envoyer, en évitant de répéter la même alerte.
     notified : { [bikeId:taskId]: { state, date } } — modifié sur place. */
  function pendingReminders(data, notified, todayStr) {
    todayStr = todayStr || todayISO();
    var out = [];
    (data.bikes || []).forEach(function (bike) {
      bikeStatuses(bike, data.settings, todayStr).forEach(function (s) {
        var key = bike.id + ':' + s.task.id;
        if (s.state !== 'late' && s.state !== 'soon') { delete notified[key]; return; }
        var prev = notified[key];
        var again = !prev || prev.state !== s.state ||
          (s.state === 'late' && daysBetween(parseDate(prev.date), parseDate(todayStr)) >= 7);
        if (!again) return;
        notified[key] = { state: s.state, date: todayStr };
        out.push({ key: key, bike: bike.name, title: s.task.name + ' — ' + bike.name, body: describe(s), state: s.state });
      });
    });
    return out;
  }

  /* Nombre d'opérations « en retard » ou « bientôt », toutes motos confondues (pastille de l'icône). */
  function attentionCount(data, todayStr) {
    var n = 0;
    (data.bikes || []).forEach(function (bike) {
      bikeStatuses(bike, data.settings, todayStr).forEach(function (s) { if (s.state === 'late' || s.state === 'soon') n++; });
    });
    return n;
  }
  function updateBadge(nav, data) {
    try {
      if (!nav || !('setAppBadge' in nav)) return;
      var n = data ? attentionCount(data) : 0;
      (n ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(function () {});
    } catch (e) { /* non pris en charge */ }
  }

  g.MotoLogic = {
    attentionCount: attentionCount, updateBadge: updateBadge,
    parseDate: parseDate, toISO: toISO, todayISO: todayISO, daysBetween: daysBetween,
    addMonths: addMonths, addDays: addDays, readings: readings, currentKm: currentKm,
    kmPerDay: kmPerDay, lastDone: lastDone, taskStatus: taskStatus, bikeStatuses: bikeStatuses,
    fmtKm: fmtKm, fmtDate: fmtDate, fmtDelay: fmtDelay, describe: describe, expectedDate: expectedDate,
    idbGet: idbGet, idbSet: idbSet, pendingReminders: pendingReminders
  };
})(typeof self !== 'undefined' ? self : this);
