/* EnSelle — bibliothèque de plans d'entretien constructeurs (intervalles Europe).
   Chaque entrée : [km, mois, note]. 0 = pas d'intervalle de ce type.
   Sources : manuels constructeurs, relevés via maintenanceschedule.com et Honda Europe.
   À vérifier avec le carnet de la moto : les intervalles peuvent varier selon l'année et le pays. */
(function (g) {
  'use strict';

  var LIB = [
    { id: 'yam-cp2', brand: 'Yamaha', label: 'MT-07 · XSR700 · Tracer 7 · Ténéré 700',
      match: /\b(mt|fz)[\s-]?07\b|xsr\s?700|tracer\s?7\b|t[ée]n[ée]r[ée]\s?700|\bt7\b/i,
      service: 10000, oil: [10000, 12, 'Huile 10W-40 JASO MA'], filter: [20000, 24, 'Une vidange sur deux'],
      air: [40000, 0], plugs: [20000, 0, 'Contrôle à 10 000 km'], valves: [40000, 0], coolant: [0, 36],
      hoses: 48, chain: 1000, extra: [['Roulements de direction (graissage)', 20000, 0, '']] },
    { id: 'yam-cp3', brand: 'Yamaha', label: 'MT-09 · Tracer 9 · XSR900 (2021+)',
      match: /\b(mt|fz)[\s-]?09\b|xsr\s?900|tracer\s?9\b/i,
      service: 10000, oil: [10000, 12, 'Huile 10W-40 JASO MA'], filter: [20000, 24, 'Une vidange sur deux'],
      air: [40000, 0], plugs: [20000, 0, 'Contrôle à 10 000 km'], valves: [40000, 0], coolant: [0, 36],
      hoses: 48, chain: 1000 },
    { id: 'kaw-650', brand: 'Kawasaki', label: 'Z650 · Ninja 650 · Z650RS (2017+)',
      match: /\bz\s?650|ninja\s?650/i,
      service: 12000, oil: [12000, 12, 'Huile 10W-40'], filter: [12000, 12, ''],
      air: [12000, 0, 'Plus souvent sous la pluie ou dans la poussière'], plugs: [12000, 0], valves: [24000, 0],
      coolant: [36000, 36], hoses: 48, chain: 600 },
    { id: 'kaw-900', brand: 'Kawasaki', label: 'Z900 (2020+)',
      match: /\bz\s?900/i,
      service: 12000, oil: [12000, 12, ''], filter: [12000, 12, ''],
      air: [12000, 0, 'Plus souvent sous la pluie ou dans la poussière'], plugs: [12000, 0], valves: [24000, 0],
      coolant: [0, 36], hoses: 48, chain: 600, chainNote: 'Tension : 25 à 35 mm' },
    { id: 'hon-650', brand: 'Honda', label: 'CB650R · CBR650R (2019+)',
      match: /\bcbr?\s?650\s?r/i,
      service: 12000, oil: [12000, 12, 'Huile 10W-30 JASO MA'], filter: [24000, 24, 'Une vidange sur deux'],
      air: [36000, 0], plugs: [48000, 0], valves: [36000, 0], coolant: [0, 36], chain: 1000 },
    { id: 'hon-nc750', brand: 'Honda', label: 'NC750X (y compris DCT)',
      match: /\bnc\s?750/i,
      service: 12000, oil: [12000, 12, ''], filter: [24000, 24, 'Une vidange sur deux'],
      air: [18000, 0], plugs: [48000, 0], valves: [24000, 0], coolant: [0, 36], chain: 1000,
      extra: [['Filtre d’huile d’embrayage (DCT)', 24000, 24, 'Versions DCT uniquement']] },
    { id: 'hon-at', brand: 'Honda', label: 'CRF1100L Africa Twin (2020+)',
      match: /africa\s?twin|crf\s?1100/i,
      service: 12000, oil: [12000, 12, ''], filter: [12000, 12, ''],
      air: [12000, 0, 'Contrôle ; plus souvent en tout-terrain'], plugs: [24000, 0], valves: [24000, 0],
      coolant: [0, 36], chain: 1000,
      extra: [['Filtre d’huile d’embrayage (DCT)', 24000, 24, 'Versions DCT uniquement, voir le manuel']] },
    { id: 'tri-660', brand: 'Triumph', label: 'Trident 660 (2021–2025)',
      match: /trident/i,
      service: 16000, oil: [16000, 12, ''], filter: [16000, 12, ''],
      air: [32000, 0], plugs: [32000, 0], valves: [32000, 0, 'Avec contrôle du calage de distribution'],
      coolant: [0, 36], chain: 300, chainNote: 'Préconisation Triumph : tous les 300 km' },
    { id: 'bmw-1250gs', brand: 'BMW', label: 'R 1250 GS · GS Adventure (2019+)',
      match: /r?\s?1250\s?gs/i, shaft: true,
      service: 10000, oil: [10000, 12, 'Huile 5W-40 JASO MA2'], filter: [10000, 12, ''],
      air: [20000, 24], plugs: [20000, 24], valves: [20000, 24], coolant: null,
      brakeNote: 'Premier changement au bout d’un an',
      extra: [['Huile de pont (cardan)', 20000, 24, ''], ['Arbre de transmission (graissage)', 20000, 0, '']] },
    { id: 'ktm-390', brand: 'KTM', label: '390 Duke (2024+)',
      match: /390\s?duke|duke\s?390/i,
      service: 10000, oil: [10000, 12, ''], filter: [10000, 12, ''], air: [10000, 12, ''],
      plugs: [20000, 0], valves: [20000, 0], coolant: [0, 48], chain: 500, chainNote: 'Nettoyage et graissage réguliers' },
    { id: 'ktm-890', brand: 'KTM', label: '890 Duke (2021+)',
      match: /890\s?duke|duke\s?890/i,
      service: 15000, oil: [15000, 12, ''], filter: [15000, 12, ''], air: [15000, 0, ''],
      plugs: [30000, 0], valves: [30000, 0], coolant: [0, 48], chain: 500, chainNote: 'Nettoyage et graissage réguliers' },
    { id: 'suz-sv650', brand: 'Suzuki', label: 'SV650 · SV650X (2016+)',
      match: /\bsv\s?650/i,
      service: 6000, oil: [6000, 12, ''], filter: [18000, 0, ''], air: [18000, 0, 'Contrôle tous les 6 000 km'],
      plugs: [12000, 0], valves: [24000, 0], coolant: [48000, 48], hoses: 48, chain: 1000, chainNote: 'Tension : 20 à 30 mm' }
  ];

  function build(p) {
    var t = [];
    t.push(['Vidange huile moteur'].concat(p.oil));
    t.push(['Filtre à huile'].concat(p.filter));
    if (!p.shaft) {
      t.push(['Graissage de la chaîne', p.chain || 1000, 0, p.chainNote || 'Et après chaque sortie sous la pluie']);
      t.push(['Tension et usure de la chaîne', Math.max(1000, p.chain || 1000), 0, '']);
    }
    t.push(['Pression des pneus', 0, 1, 'À froid, valeurs sur le manuel']);
    t.push(['Plaquettes de frein (contrôle)', p.service, 12, 'À chaque révision']);
    t.push(['Liquide de frein', 0, 24, p.brakeNote || 'DOT 4']);
    if (p.hoses) t.push(['Durites de frein', 0, p.hoses, '']);
    t.push(['Bougies'].concat(p.plugs));
    t.push(['Filtre à air'].concat(p.air));
    t.push(['Jeu aux soupapes'].concat(p.valves));
    if (p.coolant) t.push(['Liquide de refroidissement', p.coolant[0], p.coolant[1], '']);
    (p.extra || []).forEach(function (x) { t.push(x); });
    t.push(['Batterie (contrôle, charge)', 0, 12, 'Surtout avant et après l’hiver']);
    return t.map(function (x) { return [x[0], x[1] || 0, x[2] || 0, x[3] || '']; });
  }

  function get(id) { return LIB.filter(function (p) { return p.id === id; })[0] || null; }
  function detect(name) {
    name = String(name || '');
    return LIB.filter(function (p) { return p.match.test(name); })[0] || null;
  }
  function brands() {
    var out = [];
    LIB.forEach(function (p) { if (out.indexOf(p.brand) === -1) out.push(p.brand); });
    return out;
  }

  g.EnSellePlans = { list: LIB, get: get, detect: detect, build: build, brands: brands };
})(typeof self !== 'undefined' ? self : this);
