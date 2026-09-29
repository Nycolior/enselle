/* EnSelle — interface. Les données restent sur l'appareil (localStorage + copie IndexedDB pour les rappels). */
(function () {
  'use strict';
  var L = window.MotoLogic;
  var KEY = 'carnetMoto.v1';
  var $ = function (id) { return document.getElementById(id); };

  /* Plan type, volontairement prudent. À ajuster avec le manuel constructeur. */
  var DEFAULT_PLAN = [
    ['Vidange huile moteur', 6000, 12, 'Huile et quantité : voir le manuel'],
    ['Filtre à huile', 6000, 12, ''],
    ['Graissage de la chaîne', 800, 0, 'Plus souvent après la pluie'],
    ['Tension et usure de la chaîne', 1000, 0, ''],
    ['Pression des pneus', 0, 1, 'À froid'],
    ['Plaquettes de frein (contrôle)', 6000, 12, ''],
    ['Liquide de frein', 0, 24, ''],
    ['Filtre à air', 12000, 24, ''],
    ['Bougies', 12000, 24, ''],
    ['Liquide de refroidissement', 0, 36, 'Si refroidissement liquide'],
    ['Batterie (contrôle, charge)', 0, 12, ''],
    ['Jeu aux soupapes', 24000, 0, '']
  ];

  var state = null;
  var tab = 'home';
  var editing = { entry: null, task: null, bike: null };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return L.todayISO(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Plan constructeur Yamaha MT-07 (2014–2020, intervalles Europe). */
  var MT07_PLAN = [
    ['Vidange huile moteur', 10000, 12, 'Huile 10W-40 JASO MA'],
    ['Filtre à huile', 20000, 24, 'Une vidange sur deux'],
    ['Graissage de la chaîne', 1000, 0, 'Et après chaque sortie sous la pluie'],
    ['Tension et usure de la chaîne', 1000, 0, ''],
    ['Pression des pneus', 0, 1, 'À froid, valeurs sur le manuel'],
    ['Plaquettes de frein (contrôle)', 10000, 12, 'À chaque révision'],
    ['Liquide de frein', 0, 24, 'DOT 4'],
    ['Durites de frein', 0, 48, ''],
    ['Bougies', 20000, 0, 'Contrôle à 10 000 km, remplacement à 20 000 km'],
    ['Filtre à air', 40000, 0, 'Plus souvent en conditions poussiéreuses'],
    ['Jeu aux soupapes', 40000, 0, 'Grosse révision'],
    ['Liquide de refroidissement', 0, 36, ''],
    ['Roulements de direction (graissage)', 20000, 0, ''],
    ['Batterie (contrôle, charge)', 0, 12, 'Surtout avant et après l\'hiver']
  ];
  var PLANS = { mt07: MT07_PLAN, generic: DEFAULT_PLAN, none: [] };

  function makePlan(kind) {
    var src = PLANS[kind] || (kind === true ? DEFAULT_PLAN : []);
    return src.map(function (p) { return { id: uid(), name: p[0], intKm: p[1] || null, intMonths: p[2] || null, notes: p[3] }; });
  }
  function emptyState() {
    return { version: 1, bikes: [], currentBikeId: null, settings: { warnKm: 500, warnDays: 30, notif: true }, lastBackup: null };
  }
  function newBike(name, km, plan) {
    return { id: uid(), name: name, created: today(), kmLog: [{ date: today(), km: Number(km) || 0 }], tasks: makePlan(plan), history: [] };
  }
  /* Remplace le plan d'une moto en gardant le lien avec l'historique (même nom = même opération). */
  function applyPlan(b, kind) {
    var byName = {};
    b.tasks.forEach(function (t) { byName[t.name.toLowerCase()] = t.id; });
    var used = {};
    b.tasks = makePlan(kind).map(function (t) {
      var id = byName[t.name.toLowerCase()];
      if (id) { t.id = id; used[id] = true; }
      return t;
    });
    /* Les opérations déjà notées dans le carnet mais absentes du nouveau plan sont conservées. */
    Object.keys(byName).forEach(function (n) {
      var id = byName[n];
      if (used[id]) return;
      var inHistory = b.history.some(function (e) { return (e.taskIds || []).indexOf(id) > -1; });
      if (inHistory) b.tasks.push(b.__old.filter(function (t) { return t.id === id; })[0]);
    });
  }
  function bike() {
    if (!state || !state.bikes.length) return null;
    return state.bikes.filter(function (b) { return b.id === state.currentBikeId; })[0] || state.bikes[0];
  }
  function taskName(b, id) {
    var t = b.tasks.filter(function (x) { return x.id === id; })[0];
    return t ? t.name : null;
  }

  /* ---------- Données d'exemple (relatives à aujourd'hui) ---------- */
  function demoState() {
    var s = emptyState();
    var b = newBike('Yamaha MT-07 (exemple)', 0, 'generic');
    var d = function (n) { return L.toISO(L.addDays(new Date(), -n)); };
    var t = function (name) { return b.tasks.filter(function (x) { return x.name.indexOf(name) === 0; })[0].id; };
    b.kmLog = [[420, 12100], [300, 14000], [180, 16200], [90, 17600], [20, 18300], [2, 18450]]
      .map(function (p) { return { date: d(p[0]), km: p[1] }; });
    b.history = [
      { date: d(760), km: 7200, taskIds: [t('Liquide de frein')], cost: 45, who: 'garage', notes: 'DOT 4' },
      { date: d(340), km: 13000, taskIds: [t('Vidange'), t('Filtre à huile'), t('Filtre à air'), t('Bougies'), t('Liquide de refroidissement')], cost: 285, who: 'garage', notes: 'Révision des 12 000 km' },
      { date: d(200), km: 16000, taskIds: [t('Plaquettes')], cost: 0, who: 'moi', notes: 'Avant 60 %, arrière 70 %' },
      { date: d(120), km: 17000, taskIds: [], other: 'Pneu arrière Michelin Road 6', cost: 210, who: 'garage', notes: '' },
      { date: d(20), km: 18300, taskIds: [t('Pression')], cost: 0, who: 'moi', notes: '2,5 / 2,9 bar' },
      { date: d(15), km: 18350, taskIds: [t('Graissage'), t('Tension')], cost: 0, who: 'moi', notes: 'Flèche 30 mm' }
    ].map(function (e) { e.id = uid(); e.names = e.taskIds.map(function (id) { return taskName(b, id); }); return e; });
    s.bikes = [b]; s.currentBikeId = b.id; s.demo = true;
    return s;
  }

  /* ---------- Stockage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && Array.isArray(s.bikes)) return s; }
    } catch (e) { /* stockage indisponible */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
    try { return L.idbSet('state', JSON.parse(JSON.stringify(state))).catch(function () {}); } catch (e) { return Promise.resolve(); }
  }

  /* ---------- Utilitaires d'interface ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function openDlg(id) { var d = $(id); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(id) { var d = $(id); if (d.close) d.close(); else d.removeAttribute('open'); }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { var d = b.closest('dialog'); d.close ? d.close() : d.removeAttribute('open'); });
  });
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });
  function confirmBox(title, text, okLabel) {
    return new Promise(function (resolve) {
      $('c-title').textContent = title; $('c-text').textContent = text; $('c-ok').textContent = okLabel || 'Confirmer';
      var done = false;
      var dlg = $('dlg-confirm');
      function finish(v) { if (done) return; done = true; $('c-ok').onclick = null; dlg.onclose = null; closeDlg('dlg-confirm'); resolve(v); }
      $('c-ok').onclick = function () { finish(true); };
      dlg.onclose = function () { finish(false); };
      openDlg('dlg-confirm');
    });
  }
  function showErr(id, msg) { var e = $(id); e.textContent = msg || ''; e.hidden = !msg; }
  function interval(t) {
    var p = [];
    if (t.intKm) p.push('les ' + L.fmtKm(t.intKm));
    if (t.intMonths) {
      var m = Number(t.intMonths);
      p.push(m === 12 ? 'les ans' : m === 1 ? 'les mois' : 'les ' + (m % 12 === 0 ? (m / 12) + ' ans' : m + ' mois'));
    }
    if (!p.length) return 'Sans intervalle';
    return 'Tous ' + p.join(' ou ').replace(' ou les ans', ' ou tous les ans').replace(' ou les mois', ' ou tous les mois');
  }
  function spec(t) {
    var p = [];
    if (t.intKm) p.push(L.fmtKm(t.intKm));
    if (t.intMonths) { var m = Number(t.intMonths); p.push(m % 12 === 0 ? (m / 12) + (m === 12 ? ' an' : ' ans') : m + ' mois'); }
    return p.length ? p.join(' · ') : '—';
  }
  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  var LABEL = { late: 'En retard', soon: 'Bientôt', ok: 'OK', unknown: 'À renseigner' };
  var ICON_WRENCH = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.3-.6-.6-2.3z"/></svg>';

  /* ---------- Rappels ---------- */
  function swReady() {
    if (!('serviceWorker' in navigator)) return Promise.reject();
    return navigator.serviceWorker.getRegistration().then(function (r) { if (!r) throw new Error('no sw'); return navigator.serviceWorker.ready; });
  }
  function notifPermission() { return ('Notification' in window) ? Notification.permission : 'unsupported'; }
  function checkReminders(force) {
    if (notifPermission() !== 'granted' || !state || state.settings.notif === false) return;
    save().then(function () { return swReady(); }).then(function (reg) {
      if (reg.active) reg.active.postMessage({ type: 'check', force: !!force });
    }).catch(function () {});
  }
  function registerPeriodic() {
    swReady().then(function (reg) {
      if (!('periodicSync' in reg)) return;
      return navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (st) {
        if (st.state === 'granted') return reg.periodicSync.register('entretien-check', { minInterval: 24 * 3600 * 1000 });
      });
    }).catch(function () {});
  }
  function enableNotifs() {
    if (!('Notification' in window)) {
      toast(/iPhone|iPad/.test(navigator.userAgent) ? "Sur iPhone, installe d'abord l'appli sur l'écran d'accueil." : 'Notifications non disponibles ici : utilise l’export agenda.');
      return;
    }
    Notification.requestPermission().then(function (p) {
      if (p === 'granted') {
        state.settings.notif = true; save(); registerPeriodic(); checkReminders(true);
        toast('Rappels activés');
      } else toast('Notifications refusées : tu peux les réautoriser dans les réglages du téléphone.');
      render();
    });
  }
  function testNotif() {
    swReady().then(function (reg) {
      return reg.showNotification('EnSelle', { body: 'Les rappels fonctionnent.', icon: 'icons/icon-192.png', tag: 'test' });
    }).then(function () { toast('Notification envoyée'); })
      .catch(function () { toast("Notification impossible ici : ouvre l'appli installée."); });
  }

  /* ---------- Agenda ---------- */
  function gcalLink(b, s) {
    var dt = L.expectedDate(s, today());
    if (!dt) return null;
    var d0 = dt.replace(/-/g, ''), d1 = L.toISO(L.addDays(L.parseDate(dt), 1)).replace(/-/g, '');
    var details = L.describe(s) + '\n' + nextLine(s) + '\nAjouté depuis EnSelle.';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
      encodeURIComponent('Entretien moto : ' + s.task.name + ' (' + b.name + ')') +
      '&dates=' + d0 + '/' + d1 + '&details=' + encodeURIComponent(details);
  }
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function icsFold(line) {
    var out = [], cur = '';
    Array.from(line).forEach(function (ch) {
      if (new TextEncoder().encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
    });
    out.push(cur); return out.join('\r\n');
  }
  function exportIcs() {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EnSelle//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Entretien moto'];
    var n = 0;
    state.bikes.forEach(function (b) {
      L.bikeStatuses(b, state.settings, today()).forEach(function (s) {
        var dt = L.expectedDate(s, today());
        if (!dt) return;
        n++;
        var d0 = dt.replace(/-/g, ''), d1 = L.toISO(L.addDays(L.parseDate(dt), 1)).replace(/-/g, '');
        lines.push('BEGIN:VEVENT', 'UID:' + b.id + '-' + s.task.id + '@enselle', 'DTSTAMP:' + stamp,
          'DTSTART;VALUE=DATE:' + d0, 'DTEND;VALUE=DATE:' + d1,
          'SUMMARY:' + icsEscape('Entretien moto : ' + s.task.name + ' (' + b.name + ')'),
          'DESCRIPTION:' + icsEscape(L.describe(s) + '\n' + nextLine(s)),
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(s.task.name), 'TRIGGER:-P7D', 'END:VALARM',
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(s.task.name), 'TRIGGER:PT9H', 'END:VALARM',
          'END:VEVENT');
      });
    });
    lines.push('END:VCALENDAR');
    if (!n) { toast('Aucune échéance à exporter pour le moment.'); return; }
    download('enselle-echeances.ics', lines.map(icsFold).join('\r\n'), 'text/calendar');
    toast(n + ' échéances exportées');
  }

  /* ---------- Sauvegarde ---------- */
  function exportJson() {
    state.lastBackup = today(); save();
    download('enselle-sauvegarde-' + today() + '.json', JSON.stringify({ app: 'carnet-moto', exported: new Date().toISOString(), data: state }, null, 1), 'application/json');
    render();
  }
  function exportCsv() {
    var b = bike();
    var rows = [['Date', 'Kilométrage', 'Opérations', 'Fait par', 'Coût (€)', 'Notes']];
    b.history.slice().sort(function (x, y) { return x.date < y.date ? -1 : 1; }).forEach(function (e) {
      rows.push([e.date, e.km, entryOps(b, e).join(' + '), e.who === 'garage' ? 'Garage' : 'Moi',
        e.cost ? String(e.cost).replace('.', ',') : '', e.notes || '']);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    download('carnet-' + b.name.replace(/[^\w-]+/g, '-') + '.csv', '\ufeff' + csv, 'text/csv');
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var data;
      try { data = JSON.parse(r.result); data = data.data || data; } catch (e) { data = null; }
      if (!data || !Array.isArray(data.bikes)) { toast("Ce fichier n'est pas une sauvegarde EnSelle."); return; }
      var go = state && state.bikes.length && !state.demo
        ? confirmBox('Restaurer la sauvegarde ?', 'Les données actuelles seront remplacées par celles du fichier (' + data.bikes.length + ' moto(s)).', 'Restaurer')
        : Promise.resolve(true);
      go.then(function (ok) {
        if (!ok) return;
        data.settings = Object.assign(emptyState().settings, data.settings || {});
        delete data.demo;
        state = data; save(); tab = 'home'; render(); toast('Sauvegarde restaurée');
      });
    };
    r.readAsText(file);
  }
  ['import-file', 'import-file-w'].forEach(function (id) {
    $(id).addEventListener('change', function (e) { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
  });

  /* ---------- Rendu ---------- */
  function nextLine(s) {
    var p = [];
    if (s.dueKm != null) p.push(L.fmtKm(s.dueKm));
    if (s.dueDate) p.push(L.fmtDate(s.dueDate));
    return p.length ? 'Prochaine : ' + p.join(' ou ') : '';
  }
  function entryOps(b, e) {
    var names = (e.taskIds || []).map(function (id, i) { return taskName(b, id) || (e.names && e.names[i]) || 'Opération supprimée'; });
    if (e.other) names.push(e.other);
    return names;
  }

  function odometer(km) {
    var s = String(Math.max(0, Math.round(km)));
    while (s.length < 6) s = '0' + s;
    var lead = true;
    return s.split('').map(function (c, i) {
      if (c !== '0' || i === s.length - 1) lead = false;
      return '<b class="' + (lead ? 'dim' : '') + '">' + c + '</b>';
    }).join('');
  }

  function renderHome() {
    var b = bike(), cur = L.currentKm(b), rate = L.kmPerDay(b);
    var st = L.bikeStatuses(b, state.settings, today());
    var count = { late: 0, soon: 0, ok: 0, unknown: 0 };
    st.forEach(function (s) { count[s.state]++; });
    var lamp = count.late ? 'var(--gauge-tenth)' : count.soon ? 'var(--soon)' : 'rgba(255,255,255,.18)';
    var h = '';

    h += '<div class="dash"><div class="dash-row"><span class="dash-label">Compteur</span>' +
      '<span class="lamp" title="Voyant entretien" style="color:' + lamp + '">' + ICON_WRENCH + (count.late || count.soon ? 'Service' : '') + '</span></div>' +
      '<div class="odo num" aria-label="' + esc(L.fmtKm(cur.km)) + '">' + odometer(cur.km) + '<span class="unit">km</span></div>' +
      '<div class="dash-row"><small>' + (cur.date ? 'Relevé le ' + L.fmtDate(cur.date) : '') +
      (rate ? ' · ~' + Math.round(rate) + ' km/jour' : '') + '</small>' +
      '<button class="btn-gauge" type="button" id="btn-km">Relever</button></div></div>';

    h += '<div class="chips">';
    [['late', 'en retard'], ['soon', 'bientôt'], ['unknown', 'à renseigner'], ['ok', 'à jour']].forEach(function (k) {
      if (count[k[0]]) h += '<span class="chip s-' + k[0] + '"><i></i>' + count[k[0]] + ' ' + k[1] + '</span>';
    });
    h += '</div>';

    var perm = notifPermission();
    if (perm === 'default' && state.settings.notif !== false && !state.demo) {
      h += '<div class="banner"><p><b>Active les rappels</b> pour recevoir une notification quand une opération arrive à échéance.</p>' +
        '<div class="actions"><button class="btn primary small" type="button" id="btn-notif">Activer</button>' +
        '<button class="btn small ghost" type="button" id="btn-notif-no">Plus tard</button></div></div>';
    }
    var needBackup = b.history.length >= 3 && !state.demo &&
      (!state.lastBackup || L.daysBetween(L.parseDate(state.lastBackup), new Date()) > 60);
    if (needBackup) {
      h += '<div class="banner"><p><b>Pense à sauvegarder ton carnet.</b> Tes données sont seulement sur ce téléphone ; une copie te protège en cas de perte ou de changement d\'appareil.</p>' +
        '<div class="actions"><button class="btn primary small" type="button" id="btn-backup">Sauvegarder maintenant</button></div></div>';
    }

    h += '<div class="section-head"><h2>Entretiens</h2><span class="hint">' + (count.unknown ? 'Renseigne la dernière fois pour activer le suivi' : 'Triés par urgence') + '</span></div>';
    if (!st.length) {
      h += '<div class="empty"><p>Aucune opération dans le plan d\'entretien de cette moto.</p><button class="btn primary" type="button" id="btn-add-task">Ajouter une opération</button></div>';
    }
    h += '<div class="tasks">';
    st.forEach(function (s) {
      var t = s.task, meta = [];
      if (s.last) meta.push('Dernière fois : ' + L.fmtDate(s.last.date) + ' à ' + L.fmtKm(s.last.km));
      var nl = nextLine(s);
      if (nl) meta.push(nl + (s.remKm != null && s.remKm > 0 && s.estDays != null && (s.remDays == null || s.estDays < s.remDays)
        ? ' · vers le ' + L.fmtDate(L.expectedDate(s, today())) : ''));
      if (t.notes) meta.push(t.notes);
      var gl = s.state !== 'unknown' ? gcalLink(b, s) : null;
      h += '<article class="task ' + s.state + '">' +
        '<div class="task-spec">' + esc(spec(t)) + '</div>' +
        '<div class="task-top"><h3>' + esc(t.name) + '</h3><span class="pill s-' + s.state + '">' + LABEL[s.state] + '</span></div>' +
        '<div class="what num">' + (s.state === 'unknown' ? 'Quand l\'as-tu fait pour la dernière fois ?' : esc(L.describe(s))) + '</div>' +
        '<div class="meta num">' + meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' +
        (s.state !== 'unknown' ? '<div class="bar"><span style="width:' + Math.round(s.progress * 100) + '%"></span></div>' : '') +
        '<div class="task-actions">' +
        '<button class="btn small ' + (s.state === 'unknown' ? '' : 'primary') + '" type="button" data-done="' + t.id + '">' + (s.state === 'unknown' ? 'Renseigner' : 'C\'est fait') + '</button>' +
        (gl ? '<a class="btn small" href="' + esc(gl) + '" target="_blank" rel="noopener">Agenda</a>' : '') +
        '<button class="btn small ghost" type="button" data-edit-task="' + t.id + '">Modifier</button>' +
        '</div></article>';
    });
    h += '</div>';
    var v = $('view-home'); v.innerHTML = h; v.style.display = 'grid'; v.style.gap = '18px';

    $('btn-km').onclick = openKm;
    if ($('btn-notif')) $('btn-notif').onclick = enableNotifs;
    if ($('btn-notif-no')) $('btn-notif-no').onclick = function () { state.settings.notif = false; save(); render(); };
    if ($('btn-backup')) $('btn-backup').onclick = exportJson;
    if ($('btn-add-task')) $('btn-add-task').onclick = function () { openTask(null); };
    v.querySelectorAll('[data-done]').forEach(function (el) {
      el.onclick = function () {
        var s = st.filter(function (x) { return x.task.id === el.dataset.done; })[0];
        openEntry(null, [el.dataset.done], s && s.state === 'unknown');
      };
    });
    v.querySelectorAll('[data-edit-task]').forEach(function (el) { el.onclick = function () { openTask(el.dataset.editTask); }; });
  }

  function renderLog() {
    var b = bike();
    var list = b.history.slice().sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : Number(y.km) - Number(x.km); });
    var total = list.reduce(function (a, e) { return a + (Number(e.cost) || 0); }, 0);
    var h = '<div class="section-head"><h2>Carnet d\'entretien</h2><span class="hint num">' + list.length + ' intervention' + (list.length > 1 ? 's' : '') +
      (total ? ' · ' + total.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €' : '') + '</span></div>';
    if (!list.length) {
      h += '<div class="empty"><p>Rien de noté pour l\'instant. Chaque intervention que tu enregistres apparaîtra ici, avec la date, le kilométrage et le coût.</p>' +
        '<button class="btn primary" type="button" id="log-add">Noter une intervention</button></div>';
    }
    var years = {};
    list.forEach(function (e) { var y = e.date.slice(0, 4); (years[y] = years[y] || []).push(e); });
    Object.keys(years).sort().reverse().forEach(function (y) {
      var sum = years[y].reduce(function (a, e) { return a + (Number(e.cost) || 0); }, 0);
      h += '<div class="year"><div class="year-head"><h3>' + y + '</h3><span class="num">' +
        (sum ? sum.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €' : '') + '</span></div>';
      years[y].forEach(function (e) {
        var d = L.parseDate(e.date);
        h += '<button class="entry" type="button" data-entry="' + e.id + '">' +
          '<div class="entry-date num"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') + '</span></div>' +
          '<div class="entry-body"><div class="ops">' + esc(entryOps(b, e).join(' · ')) + '</div>' +
          '<div class="meta num">' + L.fmtKm(e.km) + ' · <span class="tag">' + (e.who === 'garage' ? 'Garage' : 'Moi') + '</span>' +
          (Number(e.cost) ? ' · ' + Number(e.cost).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €' : '') + '</div>' +
          (e.notes ? '<div class="note">' + esc(e.notes) + '</div>' : '') + '</div></button>';
      });
      h += '</div>';
    });
    if (list.length) h += '<div class="btns"><button class="btn" type="button" id="log-csv">Exporter en tableur (CSV)</button></div>';
    var v = $('view-log'); v.innerHTML = h; v.style.display = 'grid'; v.style.gap = '18px';
    if ($('log-add')) $('log-add').onclick = function () { openEntry(null, []); };
    if ($('log-csv')) $('log-csv').onclick = exportCsv;
    v.querySelectorAll('[data-entry]').forEach(function (el) { el.onclick = function () { openEntry(el.dataset.entry); }; });
  }

  function renderSettings() {
    var b = bike(), perm = notifPermission(), h = '';
    h += '<div class="panel"><h2>Motos</h2><div class="rows">';
    state.bikes.forEach(function (x) {
      h += '<button class="row" type="button" data-bike="' + x.id + '"><span class="l"><b>' + esc(x.name) + '</b><span class="num">' +
        L.fmtKm(L.currentKm(x).km) + ' · ' + x.history.length + ' intervention(s)</span></span><span class="r">Modifier</span></button>';
    });
    h += '</div><div class="btns"><button class="btn" type="button" id="s-add-bike">Ajouter une moto</button></div></div>';

    h += '<div class="panel"><h2>Plan d\'entretien · ' + esc(b.name) + '</h2>' +
      '<p>Ajuste chaque intervalle avec le manuel ou le carnet constructeur de ta moto. La première échéance atteinte (km ou temps) déclenche le rappel.</p><div class="rows">';
    b.tasks.forEach(function (t) {
      h += '<button class="row" type="button" data-task="' + t.id + '"><span class="l"><b>' + esc(t.name) + '</b><span class="num">' + esc(interval(t)) + '</span></span><span class="r">Modifier</span></button>';
    });
    h += '</div><div class="btns"><button class="btn" type="button" id="s-add-task">Ajouter une opération</button>' +
      '<button class="btn ghost" type="button" id="s-plan-mt07">Charger le plan Yamaha MT-07</button></div></div>';

    var permText = { granted: 'Activées sur cet appareil', denied: 'Bloquées : autorise-les dans les réglages du téléphone', 'default': 'Pas encore activées', unsupported: 'Indisponibles dans ce navigateur' }[perm];
    h += '<div class="panel"><h2>Rappels</h2>' +
      '<div class="rows"><div class="row"><span class="l"><b>Notifications</b><span>' + permText + '</span></span><span class="r">' +
      (perm === 'granted' ? '<button class="btn small" type="button" id="s-test">Tester</button>' : perm === 'default' || perm === 'unsupported' ? '<button class="btn small primary" type="button" id="s-notif">Activer</button>' : '') + '</span></div>' +
      '<div class="row"><span class="l"><b>Prévenir à l\'avance</b><span>Alerte « bientôt » avant l\'échéance</span></span><span class="r" style="display:flex;gap:6px;align-items:center">' +
      '<input id="s-warnkm" type="number" inputmode="numeric" min="0" value="' + esc(state.settings.warnKm) + '" style="width:74px" class="num" aria-label="Kilomètres d\'avance"> km' +
      '<input id="s-warndays" type="number" inputmode="numeric" min="0" value="' + esc(state.settings.warnDays) + '" style="width:58px;margin-left:6px" class="num" aria-label="Jours d\'avance"> j</span></div>' +
      '<div class="row"><span class="l"><b>Agenda du téléphone</b><span>Ajoute toutes les échéances prévues avec un rappel 7 jours avant et le jour J.</span></span><span class="r"><button class="btn small" type="button" id="s-ics">Exporter</button></span></div>' +
      '</div><p>L\'appli vérifie les échéances à chaque ouverture. Sur Android (Chrome), une fois installée, elle peut aussi vérifier en arrière-plan une fois par jour. Pour un rappel garanti même si tu n\'ouvres pas l\'appli, utilise l\'export agenda ou le bouton « Agenda » d\'une opération.</p></div>';

    h += '<div class="panel"><h2>Sauvegarde</h2><p>Tes données sont stockées uniquement sur ce téléphone, sans compte ni serveur. Garde une copie dans ton Drive, iCloud ou tes mails.' +
      (state.lastBackup ? ' Dernière sauvegarde : ' + L.fmtDate(state.lastBackup) + '.' : '') + '</p>' +
      '<div class="btns"><button class="btn primary" type="button" id="s-export">Sauvegarder (fichier)</button>' +
      '<label class="btn" for="import-file">Restaurer</label>' +
      '<button class="btn" type="button" id="s-csv">Exporter le carnet (CSV)</button></div></div>';
    h += '<p class="help" style="text-align:center">EnSelle · version 1.1</p>';

    var v = $('view-settings'); v.innerHTML = h; v.style.display = 'grid'; v.style.gap = '16px';
    v.querySelectorAll('[data-bike]').forEach(function (el) { el.onclick = function () { openBike(el.dataset.bike); }; });
    v.querySelectorAll('[data-task]').forEach(function (el) { el.onclick = function () { openTask(el.dataset.task); }; });
    $('s-add-bike').onclick = function () { openBike(null); };
    $('s-add-task').onclick = function () { openTask(null); };
    $('s-plan-mt07').onclick = function () {
      confirmBox('Charger le plan Yamaha MT-07 ?', 'Le plan de ' + b.name + ' sera remplacé par les intervalles Yamaha (MT-07 2014–2020). Ton carnet est conservé et reste relié aux opérations de même nom.', 'Charger').then(function (ok) {
        if (!ok) return;
        b.__old = b.tasks.slice(); applyPlan(b, 'mt07'); delete b.__old;
        save(); render(); toast('Plan MT-07 chargé'); checkReminders(false);
      });
    };
    if ($('s-notif')) $('s-notif').onclick = enableNotifs;
    if ($('s-test')) $('s-test').onclick = testNotif;
    $('s-ics').onclick = exportIcs;
    $('s-export').onclick = exportJson;
    $('s-csv').onclick = exportCsv;
    ['s-warnkm', 's-warndays'].forEach(function (id) {
      $(id).onchange = function () {
        var n = Math.max(0, parseInt($(id).value, 10) || 0);
        state.settings[id === 's-warnkm' ? 'warnKm' : 'warnDays'] = n; save(); toast('Enregistré');
      };
    });
  }

  function render() {
    var has = state && state.bikes.length;
    $('view-welcome').hidden = !!has;
    $('tabs').hidden = !has; $('fab').hidden = !has || tab === 'settings';
    $('bike-pick').hidden = !has;
    $('demo-note').hidden = !(state && state.demo);
    ['home', 'log', 'settings'].forEach(function (t) { $('view-' + t).hidden = !has || tab !== t; });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    L.updateBadge(navigator, has && !state.demo ? state : null);
    if (!has) return;
    $('bike-name').textContent = bike().name;
    if (tab === 'home') renderHome(); else if (tab === 'log') renderLog(); else renderSettings();
  }

  /* ---------- Intervention ---------- */
  function openEntry(entryId, preset, lastTime) {
    var b = bike(), e = entryId ? b.history.filter(function (x) { return x.id === entryId; })[0] : null;
    editing.entry = e ? e.id : null;
    $('entry-title').textContent = e ? 'Modifier l\'intervention' : lastTime ? 'La dernière fois' : 'Nouvelle intervention';
    $('e-date').value = e ? e.date : today(); $('e-date').max = today();
    $('e-km').value = e ? e.km : L.currentKm(b).km;
    var sel = e ? e.taskIds : (preset || []);
    $('e-tasks').innerHTML = b.tasks.map(function (t) {
      return '<label><input type="checkbox" value="' + t.id + '"' + (sel.indexOf(t.id) > -1 ? ' checked' : '') + '> ' + esc(t.name) + '</label>';
    }).join('') || '<span class="help">Aucune opération dans le plan.</span>';
    $('e-other').value = e ? (e.other || '') : '';
    $('e-cost').value = e && e.cost ? e.cost : '';
    document.querySelector('input[name="e-who"][value="' + (e && e.who === 'garage' ? 'garage' : 'moi') + '"]').checked = true;
    $('e-notes').value = e ? (e.notes || '') : '';
    $('e-delete').hidden = !e;
        if (lastTime) { $('e-err').hidden = false; $('e-err').className = 'help'; $('e-err').textContent = 'Indique la date et le kilométrage de la dernière fois, même approximatifs.'; }
    else $('e-err').className = 'err';
    openDlg('dlg-entry');
  }
  $('entry-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    $('e-err').className = 'err';
    var b = bike();
    var ids = Array.prototype.map.call($('e-tasks').querySelectorAll('input:checked'), function (i) { return i.value; });
    var other = $('e-other').value.trim();
    var km = parseInt($('e-km').value, 10);
    var date = $('e-date').value;
    if (!date) return showErr('e-err', 'Indique la date.');
    if (date > today()) return showErr('e-err', 'La date ne peut pas être dans le futur.');
    if (isNaN(km) || km < 0) return showErr('e-err', 'Indique le kilométrage au compteur.');
    if (!ids.length && !other) return showErr('e-err', 'Coche au moins une opération ou décris ce que tu as fait.');
    var data = { date: date, km: km, taskIds: ids, names: ids.map(function (id) { return taskName(b, id); }),
      other: other, cost: parseFloat(String($('e-cost').value).replace(',', '.')) || 0,
      who: document.querySelector('input[name="e-who"]:checked').value, notes: $('e-notes').value.trim() };
    if (editing.entry) {
      var e = b.history.filter(function (x) { return x.id === editing.entry; })[0];
      Object.assign(e, data);
    } else { data.id = uid(); b.history.push(data); }
    save(); closeDlg('dlg-entry'); render(); toast('Intervention enregistrée'); checkReminders(false);
  });
  $('e-delete').onclick = function () {
    confirmBox('Supprimer cette intervention ?', 'Elle sera retirée du carnet et les échéances seront recalculées.', 'Supprimer').then(function (ok) {
      if (!ok) return;
      var b = bike();
      b.history = b.history.filter(function (x) { return x.id !== editing.entry; });
      save(); closeDlg('dlg-entry'); render(); toast('Intervention supprimée');
    });
  };

  /* ---------- Relevé compteur ---------- */
  function openKm() {
    var cur = L.currentKm(bike());
    $('k-km').value = ''; $('k-km').placeholder = String(cur.km);
    $('k-date').value = today(); $('k-date').max = today();
    showErr('k-err', ''); openDlg('dlg-km');
    setTimeout(function () { $('k-km').focus(); }, 50);
  }
  $('km-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = bike(), cur = L.currentKm(b);
    var km = parseInt($('k-km').value, 10), date = $('k-date').value;
    if (isNaN(km) || km < 0) return showErr('k-err', 'Indique le kilométrage affiché au compteur.');
    if (date > today()) return showErr('k-err', 'La date ne peut pas être dans le futur.');
    if (km < cur.km && date >= cur.date) return showErr('k-err', 'Le dernier relevé est de ' + L.fmtKm(cur.km) + ' : le compteur ne peut pas reculer.');
    b.kmLog.push({ date: date, km: km });
    save(); closeDlg('dlg-km'); render(); toast('Compteur mis à jour'); checkReminders(false);
  });

  /* ---------- Opération du plan ---------- */
  function openTask(id) {
    var b = bike(), t = id ? b.tasks.filter(function (x) { return x.id === id; })[0] : null;
    editing.task = t ? t.id : null;
    $('task-title').textContent = t ? 'Modifier l\'opération' : 'Nouvelle opération';
    $('t-name').value = t ? t.name : ''; $('t-km').value = t && t.intKm ? t.intKm : '';
    $('t-months').value = t && t.intMonths ? t.intMonths : ''; $('t-notes').value = t ? (t.notes || '') : '';
    $('t-delete').hidden = !t; showErr('t-err', '');
    openDlg('dlg-task');
  }
  $('task-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = bike();
    var name = $('t-name').value.trim(), km = parseInt($('t-km').value, 10) || null, mo = parseInt($('t-months').value, 10) || null;
    if (!name) return showErr('t-err', 'Donne un nom à l\'opération.');
    if (!km && !mo) return showErr('t-err', 'Indique un intervalle en kilomètres, en mois, ou les deux.');
    var data = { name: name, intKm: km, intMonths: mo, notes: $('t-notes').value.trim() };
    if (editing.task) Object.assign(b.tasks.filter(function (x) { return x.id === editing.task; })[0], data);
    else { data.id = uid(); b.tasks.push(data); }
    save(); closeDlg('dlg-task'); render(); toast('Plan d\'entretien mis à jour'); checkReminders(false);
  });
  $('t-delete').onclick = function () {
    confirmBox('Supprimer cette opération ?', 'Elle ne sera plus suivie. Les interventions déjà notées restent dans le carnet.', 'Supprimer').then(function (ok) {
      if (!ok) return;
      var b = bike();
      b.tasks = b.tasks.filter(function (x) { return x.id !== editing.task; });
      save(); closeDlg('dlg-task'); render();
    });
  };

  /* ---------- Motos ---------- */
  function openBike(id) {
    var x = id ? state.bikes.filter(function (b) { return b.id === id; })[0] : null;
    editing.bike = x ? x.id : null;
    $('bike-title').textContent = x ? 'Modifier la moto' : 'Nouvelle moto';
    $('b-name').value = x ? x.name : ''; $('b-km').value = ''; $('b-km').required = !x;
    $('b-km-field').hidden = !!x; $('b-plan-field').hidden = !!x; $('b-delete').hidden = !x;
    closeDlg('dlg-bikes'); openDlg('dlg-bike');
  }
  $('bike-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = $('b-name').value.trim();
    if (!name) return;
    if (editing.bike) state.bikes.filter(function (b) { return b.id === editing.bike; })[0].name = name;
    else {
      var nb = newBike(name, $('b-km').value, $('b-plan').value);
      state.bikes.push(nb); state.currentBikeId = nb.id; tab = 'home';
    }
    save(); closeDlg('dlg-bike'); render();
  });
  $('b-delete').onclick = function () {
    var x = state.bikes.filter(function (b) { return b.id === editing.bike; })[0];
    confirmBox('Supprimer ' + x.name + ' ?', 'Son plan d\'entretien et tout son carnet (' + x.history.length + ' intervention(s)) seront effacés. Pense à sauvegarder avant.', 'Supprimer').then(function (ok) {
      if (!ok) return;
      state.bikes = state.bikes.filter(function (b) { return b.id !== x.id; });
      state.currentBikeId = state.bikes[0] ? state.bikes[0].id : null;
      save(); closeDlg('dlg-bike'); render();
    });
  };
  $('bike-pick').onclick = function () {
    $('bikes-list').innerHTML = state.bikes.map(function (x) {
      return '<button class="row" type="button" data-pick="' + x.id + '"><span class="l"><b>' + esc(x.name) + '</b><span class="num">' + L.fmtKm(L.currentKm(x).km) + '</span></span><span class="r">' + (x.id === bike().id ? 'Actuelle' : '') + '</span></button>';
    }).join('');
    $('bikes-list').querySelectorAll('[data-pick]').forEach(function (el) {
      el.onclick = function () { state.currentBikeId = el.dataset.pick; save(); closeDlg('dlg-bikes'); render(); };
    });
    openDlg('dlg-bikes');
  };
  $('bikes-add').onclick = function () { openBike(null); };

  /* ---------- Accueil ---------- */
  $('welcome-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    state = emptyState();
    var b = newBike($('w-name').value.trim(), $('w-km').value, $('w-plan').value);
    state.bikes.push(b); state.currentBikeId = b.id; tab = 'home';
    save(); render();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  });
  $('w-demo').onclick = function () { state = demoState(); tab = 'home'; save(); render(); };
  $('demo-clear').onclick = function () {
    confirmBox('Repartir de zéro ?', 'Les données d\'exemple seront effacées et tu pourras créer ta propre moto.', 'Effacer').then(function (ok) {
      if (!ok) return;
      state = emptyState(); save(); tab = 'home'; render();
    });
  };

  /* ---------- Navigation ---------- */
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.onclick = function () { tab = b.dataset.tab; render(); window.scrollTo(0, 0); };
  });
  $('fab').onclick = function () { openEntry(null, []); };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state && state.bikes.length) { render(); checkReminders(false); }
  });

  /* ---------- Démarrage ---------- */
  state = load();
  if (!state && window.CARNET_DEMO) state = demoState();
  if (!state) state = emptyState();
  state.settings = Object.assign(emptyState().settings, state.settings || {});
  render();

  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local) && !window.CARNET_DEMO) {
    navigator.serviceWorker.register('sw.js').then(function () {
      save(); registerPeriodic(); checkReminders(false);
    }).catch(function () {});
  }
})();
