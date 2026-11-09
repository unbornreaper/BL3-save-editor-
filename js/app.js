/* VAULT FORGE — UI */
(function () {
  'use strict';
  const BL3 = window.BL3;
  const F = BL3.forge;
  const DATA = window.BL3_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const short = (p) => (p || '').split('.').pop();

  const S = {
    ed: null, fileName: 'save.sav', undo: [], tab: 'dash',
    invKind: 'all', invSearch: '', power: 3, lazyLog: [],
    forge: { sel: null, q: '', kind: '', type: '', manu: '', rarity: '', mode: 'op', element: '', level: 72, count: 1 },
    savePlatform: null,
  };

  // ------------------------------------------------------------------ dom helper
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function toast(msg, kind = '') {
    const t = h('div', { class: 'toast ' + kind }, msg);
    $('#toasts').append(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, kind === 'err' ? 7000 : 3200);
  }
  const fmt = (n) => Number(n || 0).toLocaleString();
  const isProfile = () => S.ed instanceof BL3.ProfileEditor;
  const ctx = () => ({ classToken: isProfile() ? '' : S.ed.classToken, power: S.power });

  // ------------------------------------------------------------------ file io
  function openBytes(bytes, name) {
    try {
      S.ed = BL3.open(bytes);
      S.fileName = name || 'save.sav';
      S.original = bytes;
      S.undo = [];
      S.savePlatform = S.ed.file.platform;
      S.tab = 'dash';
      $('#landing').hidden = true;
      $('#editor').hidden = false;
      $('#btnSave').disabled = false;
      render();
      const what = isProfile() ? 'Profile' : (S.ed.name || 'Character') + ' — ' + S.ed.className;
      toast('Loaded ' + what + ' (' + S.ed.file.platform + ' save)', 'ok');
    } catch (e) {
      console.error(e);
      toast('Could not open file: ' + e.message, 'err');
    }
  }
  function pickFile() { $('#fileInput').value = ''; $('#fileInput').click(); }
  function download(bytes, name) {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function saveFile() {
    try {
      S.ed.commitItems();
      const bytes = BL3.file.save(S.ed.file, S.savePlatform);
      // sanity check: make sure what we wrote loads back
      BL3.file.load(bytes, S.savePlatform);
      download(bytes, S.fileName);
      toast('Saved ' + S.fileName + ' (' + S.savePlatform + '). Now put it back with Save Wizard!', 'ok');
    } catch (e) {
      console.error(e);
      toast('Save failed: ' + e.message, 'err');
    }
  }
  function snapshot() {
    try {
      S.ed.commitItems();
      S.undo.push(BL3.pb.encode(S.ed.file.data, isProfile() ? 'Profile' : 'Character'));
      if (S.undo.length > 25) S.undo.shift();
    } catch (e) { console.warn(e); }
    $('#btnUndo').disabled = !S.undo.length;
  }
  function undo() {
    const plain = S.undo.pop();
    if (!plain) return;
    const f = S.ed.file;
    f.data = BL3.pb.decode(plain, isProfile() ? 'Profile' : 'Character');
    S.ed = isProfile() ? new BL3.ProfileEditor(f) : new BL3.SaveEditor(f);
    $('#btnUndo').disabled = !S.undo.length;
    render();
    toast('Undone');
  }
  /** run an editing action with undo + re-render */
  function act(fn, msg) {
    snapshot();
    try {
      const r = fn();
      render();
      if (msg) toast(typeof msg === 'function' ? msg(r) : msg, 'ok');
      return r;
    } catch (e) {
      console.error(e);
      toast(e.message, 'err');
    }
  }

  // ------------------------------------------------------------------ render root
  const TABS_SAVE = [['dash', '⚡ Command Center'], ['inv', '🎒 Backpack'], ['forge', '🔨 Forge'], ['char', '👤 Character']];
  const TABS_PROF = [['dash', '⚡ Command Center'], ['inv', '🏦 Bank'], ['forge', '🔨 Forge'], ['char', '🗝 Profile']];

  function render() {
    if (!S.ed) return;
    renderPill();
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    for (const [id, label] of (isProfile() ? TABS_PROF : TABS_SAVE)) {
      const t = h('div', { class: 'tab' + (S.tab === id ? ' active' : ''), onclick: () => { S.tab = id; render(); } }, label,
        id === 'inv' ? h('span', { class: 'count' }, S.ed.items.length) : null);
      tabs.append(t);
    }
    document.querySelectorAll('.view').forEach(v => {
      const on = v.dataset.view === S.tab;
      v.classList.toggle('active', on);
      if (on) { v.innerHTML = ''; ({ dash: viewDash, inv: viewInv, forge: viewForge, char: viewChar })[S.tab](v); }
    });
  }

  function renderPill() {
    const p = $('#filePill');
    p.hidden = false;
    p.innerHTML = '';
    const ed = S.ed;
    p.append(
      h('span', { class: 'tag ' + (ed.file.platform === 'PS4' ? 'ps4' : '') }, ed.file.platform),
      isProfile() ? h('b', null, 'PROFILE') : h('span', null, h('b', null, ed.name || 'Unnamed'), ' · ', ed.className, ' · Lvl ', ed.level),
      h('span', { class: 'muted' }, S.fileName),
      h('select', { title: 'Save format', onchange: (e) => { S.savePlatform = e.target.value; toast('Will save as ' + S.savePlatform + ' format'); } },
        ['PS4', 'PC'].map(x => h('option', { value: x, selected: S.savePlatform === x }, 'Save as ' + x)))
    );
  }

  // ------------------------------------------------------------------ dashboard
  function heroBtn(cls, title, desc, ico, onclick) {
    return h('button', { class: 'hero-btn ' + cls, onclick }, h('div', { class: 't' }, title), h('div', { class: 'd' }, desc), h('div', { class: 'ico' }, ico));
  }

  function viewDash(v) {
    const ed = S.ed;
    if (!isProfile()) {
      v.append(h('div', { class: 'grid g4', style: 'margin-bottom:16px' },
        statCard('Character', ed.name || '—', ed.className),
        statCard('Level', ed.level, fmt(ed.xp) + ' XP · ' + ed.skillPoints + ' skill pts'),
        statCard('Money', '$' + fmt(ed.money), fmt(ed.eridium) + ' Eridium'),
        statCard('Backpack', ed.items.length + ' items', 'Mayhem ' + (ed.mayhemLevels[0] || 0) + ' · GR ' + fmt(ed.guardianRank)),
      ));
      v.append(h('div', { class: 'grid g3', style: 'margin-bottom:16px' },
        heroBtn('god', 'GOD MODE', 'Lvl 72, max cash & eridium, all SDUs, full ammo, every slot, Mayhem 10, TVHM, huge Guardian Rank, skill points, all vehicles.', '⚡', openGodModal),
        heroBtn('op', 'OP EVERYTHING', 'Every item in your backpack → level 72, Mayhem 10 and the best anointment for your class.', '🔥', () => act(() => F.allItems(ed, it => F.makeOP(it, ctx())), n => '🔥 ' + n + ' items are now OP')),
        heroBtn('mod', 'MODDED EVERYTHING', 'Stupid overpowered. Stacks parts, elements & up to 15 anointments on every item. Offline fun only.', '☢', () => confirmModded(() => act(() => F.allItems(ed, it => F.makeModded(it, ctx())), n => '☢ ' + n + ' items are now MODDED'))),
        heroBtn('inf', '∞ INFINITE AMMO', 'Max ammo + SDUs, plus no-ammo / ammo-regen anointments, stacked mags & Infiniti parts on every gun.', '∞', () => act(() => F.infiniteAmmo(ed), l => '∞ ' + l.join(' · '))),
        heroBtn('nade', '∞ INFINITE GRENADES', 'Max grenade SDU + full grenades, grenade-regen anointment on nades, stacked grenade capacity on class mods.', '💣', () => act(() => F.runCommands(ed, 'infinite grenades'), l => l.join(' · '))),
        heroBtn('', 'NEW GEAR', 'Build any legendary in the game from scratch — weapons, shields, grenades, relics, class mods.', '🔨', () => { S.tab = 'forge'; render(); }),
      ));
      v.lastChild.lastChild.style.cssText = 'background:linear-gradient(135deg,#3a3a46,#1f1f27);color:#fff';
    } else {
      const keys = ed.keyTypes;
      v.append(h('div', { class: 'grid g4', style: 'margin-bottom:16px' },
        statCard('Golden Keys', fmt(keys[0].value), 'Diamond: ' + fmt(keys[1].value)),
        statCard('Bank', ed.bank.length + ' items', 'Lost loot: ' + ed.lostLoot.length),
        statCard('Guardian Rank', fmt(ed.guardianRank), ed.guardianTokens + ' unspent tokens'),
        statCard('Cosmetics', fmt(ed.cosmeticsCount), 'unlocked'),
      ));
      v.append(h('div', { class: 'grid g3', style: 'margin-bottom:16px' },
        heroBtn('god', 'GOD PROFILE', '999 of every key, max bank SDUs, Guardian Rank 200 in every reward, every skin / head / emote / trinket / weapon skin.', '⚡', () => act(() => F.godMode(ed, {}), l => '⚡ ' + l.join(' · '))),
        heroBtn('op', 'OP BANK', 'Every bank item → level 72, Mayhem 10 + best anointment.', '🔥', () => act(() => F.allItems(ed, it => F.makeOP(it, ctx())), n => '🔥 ' + n + ' bank items OP')),
        heroBtn('mod', 'MODDED BANK', 'Every bank item becomes stupid overpowered.', '☢', () => confirmModded(() => act(() => F.allItems(ed, it => F.makeModded(it, ctx())), n => '☢ ' + n + ' bank items MODDED'))),
      ));
    }
    v.append(lazyBox());
  }
  function statCard(label, big, sub) {
    return h('div', { class: 'panel' }, h('div', { class: 'muted', style: 'font-size:12px;text-transform:uppercase;letter-spacing:.6px' }, label), h('div', { class: 'stat-big' }, big), h('div', { class: 'muted', style: 'font-size:13px' }, sub));
  }
  function confirmModded(go) {
    if (localStorage.getItem('vf_mod_ok')) return go();
    modal(h('div', null,
      h('h2', null, '☢ Heads up'),
      h('p', null, 'Modded gear stacks way more parts than the game ever drops. It\'s hilarious, but in rare cases a modded item can look glitchy or crash the game. Keep a backup of your original save and play offline / solo.'),
      h('div', { class: 'row' }, h('button', { class: 'btn mod big', onclick: () => { localStorage.setItem('vf_mod_ok', '1'); closeModal(); go(); } }, 'Let\'s get stupid'), h('button', { class: 'btn ghost big', onclick: closeModal }, 'Cancel'))));
  }

  function openGodModal() {
    const o = Object.assign({}, F.GOD_DEFAULTS);
    const opt = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o[k], onchange: e => { o[k] = e.target.checked; } }), label);
    modal(h('div', null,
      h('div', { class: 'modal-head' }, h('div', null, h('h2', null, '⚡ GOD MODE'), h('div', { class: 'muted' }, 'Walk among them. Untick anything you don\'t want.')), h('button', { class: 'btn ghost x', onclick: closeModal }, '✕')),
      h('div', { class: 'grid g2' },
        opt('level', 'Level 72 (max)'), opt('skillPoints', 'Skill points to max every tree'), opt('money', 'Max money & eridium (2 billion)'),
        opt('sdus', 'Max all SDUs (backpack + ammo)'), opt('ammo', 'Full ammo & grenades'), opt('slots', 'Unlock all gear slots + Eridian tools'),
        opt('mayhem', 'Mayhem 10 on every playthrough'), opt('tvhm', 'Unlock True Vault Hunter Mode'), opt('guardian', 'Guardian Rank boost'),
        opt('vehicles', 'Unlock all vehicles, parts & skins'), opt('opGear', 'Also make every item OP')),
      h('label', { class: 'field', style: 'margin:12px 0;max-width:320px' }, 'Guardian tokens per reward (18 rewards)',
        h('input', { type: 'number', min: 1, max: 5000, value: o.guardianTokens, oninput: e => { o.guardianTokens = Math.max(1, +e.target.value || 1); } })),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn god big', onclick: () => { closeModal(); act(() => F.godMode(S.ed, o), l => '⚡ GOD MODE: ' + l.join(' · ')); } }, '⚡ BECOME A GOD'))));
  }

  // ------------------------------------------------------------------ lazy box
  const LAZY_EXAMPLES = ['god mode', 'infinite ammo', 'modded fingerbiter', '3x op legendary shock shotgun', 'modded relic', 'op shield', 'modded grenade', 'modded com', '5x random modded weapon', 'op all', 'level 72', 'money max', 'mayhem 10', 'max sdu'];
  const LAZY_EXAMPLES_PROF = ['god mode', 'keys 999', 'unlock cosmetics', 'modded fingerbiter', 'op all', 'max sdu', '3x modded relic'];
  function lazyBox() {
    const ta = h('textarea', { placeholder: 'Feeling lazy? Just type what you want…\n  modded fingerbiter\n  3x op legendary shock jakobs shotgun\n  god mode\n  …or paste BL3(...) item codes', spellcheck: 'false' });
    const log = h('div', { class: 'log' }, S.lazyLog.map(l => h('div', null, l)));
    const run = () => {
      const text = ta.value.trim();
      if (!text) return;
      const before = S.ed.items.length;
      snapshot();
      const lines = F.runCommands(S.ed, text, { power: S.power });
      S.lazyLog = lines.concat(S.lazyLog).slice(0, 80);
      const added = S.ed.items.length - before;
      render();
      toast(lines.slice(0, 3).join(' · ') + (lines.length > 3 ? ' …' : '') + (added > 0 ? ' → check your ' + (isProfile() ? 'Bank' : 'Backpack') : ''), lines.some(l => /^[✖❓]/.test(l)) ? 'err' : 'ok');
    };
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
    return h('div', { class: 'panel lazy' },
      h('h3', null, '⌨ The Lazy Box', h('small', null, 'type it, we forge it · Ctrl+Enter to run')),
      ta,
      h('div', { class: 'chips' }, (isProfile() ? LAZY_EXAMPLES_PROF : LAZY_EXAMPLES).map(ex => h('span', { class: 'chip', onclick: () => { ta.value = (ta.value ? ta.value + '\n' : '') + ex; ta.focus(); } }, ex))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: run }, '⚡ DO IT'), powerSlider(), h('span', { class: 'spacer' }), h('button', { class: 'btn ghost sm', onclick: () => { S.lazyLog = []; render(); } }, 'Clear log')),
      log);
  }
  function powerSlider() {
    const lbl = h('b', { style: 'color:var(--purple);min-width:70px' }, powerLabel());
    return h('label', { class: 'row', title: 'How hard MODDED goes (part stacking multiplier)' }, h('span', { class: 'muted', style: 'font-size:13px' }, 'Modded power'),
      h('input', { type: 'range', min: 1, max: 5, value: S.power, oninput: e => { S.power = +e.target.value; lbl.textContent = powerLabel(); } }), lbl);
  }
  function powerLabel() { return ['', 'Spicy', 'Silly', 'Stupid', 'Insane', 'BROKEN'][S.power]; }

  // ------------------------------------------------------------------ inventory
  const KIND_ICON = { weapon: '🔫', shield: '🛡', grenade: '💣', relic: '🔮', com: '🎓', other: '📦' };
  const KIND_LABEL = { all: 'All', weapon: 'Guns', shield: 'Shields', grenade: 'Grenades', relic: 'Relics', com: 'Class Mods', other: 'Other' };

  function filteredItems() {
    const q = S.invSearch.toLowerCase();
    return S.ed.items.map((e, i) => ({ e, i })).filter(({ e }) => {
      if (!e.item) return S.invKind === 'all';
      if (S.invKind !== 'all' && e.item.kind !== S.invKind) return false;
      if (q && !e.item.name.toLowerCase().includes(q) && !short(e.item.balance).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function viewInv(v) {
    const ed = S.ed;
    const list = filteredItems();
    const forAll = (fn, label) => act(() => { let n = 0; for (const { e } of list) if (e.item && fn(e.item)) n++; return n; }, n => label + ' ' + n + ' items');
    const scope = S.invKind === 'all' && !S.invSearch ? 'ALL' : 'SHOWN';
    v.append(h('div', { class: 'toolbar' },
      Object.keys(KIND_LABEL).filter(k => k !== 'other').map(k => h('button', { class: 'filter-btn' + (S.invKind === k ? ' on' : ''), onclick: () => { S.invKind = k; render(); } }, (KIND_ICON[k] || '') + ' ' + KIND_LABEL[k])),
      h('input', { type: 'text', placeholder: '🔍 search', value: S.invSearch, style: 'width:150px', oninput: e => { S.invSearch = e.target.value; clearTimeout(S._t); S._t = setTimeout(() => { render(); const i = $('.toolbar input[type=text]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } }),
      h('div', { class: 'sep' }),
      h('button', { class: 'btn op sm', onclick: () => forAll(it => F.makeOP(it, ctx()), '🔥 OP\'d') }, '🔥 OP ' + scope),
      h('button', { class: 'btn mod sm', onclick: () => confirmModded(() => forAll(it => F.makeModded(it, ctx()), '☢ MODDED')) }, '☢ MODDED ' + scope),
      h('button', { class: 'btn inf sm', onclick: () => forAll(it => F.makeAmmoKit(it, ctx()), '∞ Ammo kit on') }, '∞ AMMO ' + scope),
      h('button', { class: 'btn sm', onclick: () => forAll(it => { if (!it.canParse) return false; it.level = 72; it.touch(); return true; }, 'Level 72:') }, 'Lvl 72 ' + scope),
      h('div', { class: 'sep' }),
      powerSlider(),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn sm', onclick: importCodesModal }, '📥 Import codes'),
      h('button', { class: 'btn sm', onclick: exportCodesModal }, '📤 Export codes'),
    ));
    if (!ed.items.length) {
      v.append(h('div', { class: 'empty' }, h('div', { style: 'font-size:44px' }, '🎒'), h('p', null, 'Empty. Go to the ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); S.tab = 'forge'; render(); } }, 'Forge'), ', paste some codes, or use the Lazy Box.')));
      return;
    }
    const grid = h('div', { class: 'items' });
    for (const { e, i } of list) grid.append(itemCard(e, i));
    v.append(grid);
  }

  function itemCard(e, i) {
    const ed = S.ed;
    if (!e.item) return h('div', { class: 'item' }, h('div', { class: 'name' }, 'Unreadable item'), h('div', { class: 'muted' }, e.error), h('div', { class: 'actions' }, h('button', { class: 'btn danger sm', onclick: () => act(() => ed.removeItem(i), 'Deleted') }, '🗑 Delete')));
    const it = e.item;
    const eq = !isProfile() && ed.equippedSlotOf(i);
    const flags = (e.pb && e.pb.flags) || 0;
    const modded = it.parts.length > 22 || it.generics.length > 2;
    const anoints = it.anoints;
    return h('div', { class: 'item r' + it.rarity },
      h('div', { class: 'name', onclick: () => openItem(i) }, KIND_ICON[it.kind] + ' ' + it.name),
      h('div', { class: 'meta' },
        h('span', { class: 'badge lvl' }, 'LVL ' + it.level),
        it.mayhem ? h('span', { class: 'badge mh' }, 'M' + it.mayhem) : null,
        eq ? h('span', { class: 'badge eq' }, 'EQUIPPED · ' + eq) : null,
        flags & 2 ? h('span', { class: 'badge fav' }, '★') : null,
        modded ? h('span', { class: 'badge mod' }, '☢ MODDED') : null,
        h('span', null, it.parts.length + ' parts'),
        it.canParseParts ? null : h('span', { class: 'badge' }, 'level-only edit')),
      anoints.length ? h('div', { class: 'anoint' }, '✦ ' + F.anointName(anoints[0]) + (anoints.length > 1 ? '  (+' + (anoints.length - 1) + ' more)' : '')) : null,
      (() => { const est = BL3.stats.estimate(it); return est && est.vibe.length ? h('div', { class: 'vibe', onclick: () => openStats(it), title: 'Tap for full stats' }, est.vibe.join('  ·  ')) : null; })(),
      h('div', { class: 'actions' },
        h('button', { class: 'btn op sm', title: 'Level 72 + Mayhem 10 + best anointment', onclick: () => act(() => F.makeOP(it, ctx()), '🔥 ' + it.name + ' is OP') }, '🔥 OP'),
        h('button', { class: 'btn mod sm', title: 'Stupid overpowered', onclick: () => confirmModded(() => act(() => F.makeModded(it, ctx()), '☢ ' + it.name + ' is MODDED')) }, '☢ MODDED'),
        it.kind === 'weapon' || it.kind === 'grenade' ? h('button', { class: 'btn inf sm', title: 'Ammo regen kit', onclick: () => act(() => F.makeAmmoKit(it, ctx()), '∞ ammo kit on ' + it.name) }, '∞') : null,
        h('button', { class: 'btn sm', onclick: () => openItem(i) }, '✎ Edit'),
        h('button', { class: 'btn sm', title: 'Stats & part info', onclick: () => openStats(it) }, '📊'),
        h('button', { class: 'btn sm', title: 'Duplicate', onclick: () => act(() => ed.duplicateItem(i), 'Duplicated ' + it.name) }, '⧉'),
        h('button', { class: 'btn sm', title: 'Copy BL3 code', onclick: () => copy(it.code(), 'Code copied') }, '📋'),
        h('button', { class: 'btn danger sm', title: 'Delete', onclick: () => act(() => ed.removeItem(i), 'Deleted ' + it.name) }, '🗑')));
  }

  function copy(text, msg) {
    const done = () => toast(msg || 'Copied', 'ok');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed — select the text manually', 'err'); }
    ta.remove();
  }

  function importCodesModal() {
    const ta = h('textarea', { class: 'code-box', style: 'min-height:200px', placeholder: 'Paste one or many BL3(...) codes here' });
    modal(h('div', null,
      h('div', { class: 'modal-head' }, h('h2', null, '📥 Import item codes'), h('button', { class: 'btn ghost x', onclick: closeModal }, '✕')),
      h('p', { class: 'muted' }, 'Paste codes from anywhere (Reddit, Discord, Lootlemon…). Works with any amount at once.'),
      ta,
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'impOp' }), 'Make them OP'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'impMod' }), 'Make them MODDED'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary big', onclick: () => {
          const codes = ta.value.match(/bl3\([A-Za-z0-9+/=\s]+\)/gi) || [];
          if (!codes.length) { toast('No BL3(...) codes found', 'err'); return; }
          const op = $('#impOp').checked, md = $('#impMod').checked;
          closeModal();
          act(() => {
            let n = 0, bad = 0;
            for (const c of codes) {
              try { const it = BL3.Item.fromCode(c.replace(/\s+/g, '')); if (md) F.makeModded(it, ctx()); else if (op) F.makeOP(it, ctx()); S.ed.addItem(it); n++; } catch (e) { bad++; }
            }
            return [n, bad];
          }, ([n, bad]) => 'Imported ' + n + ' items' + (bad ? ' (' + bad + ' bad codes skipped)' : ''));
        } }, 'Import'))));
  }
  function exportCodesModal() {
    S.ed.commitItems();
    const text = filteredItems().filter(x => x.e.item).map(({ e }) => '# ' + e.item.name + ' (lvl ' + e.item.level + ')\n' + e.item.code()).join('\n\n');
    modal(h('div', null,
      h('div', { class: 'modal-head' }, h('h2', null, '📤 Item codes'), h('button', { class: 'btn ghost x', onclick: closeModal }, '✕')),
      h('textarea', { class: 'code-box', style: 'min-height:320px', readonly: true }, text),
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn primary', onclick: () => copy(text, 'All codes copied') }, '📋 Copy all'),
        h('button', { class: 'btn', onclick: () => download(new TextEncoder().encode(text), 'bl3-codes.txt') }, '💾 Download .txt'))));
  }

  // ------------------------------------------------------------------ stats
  function statsPanel(it, opts = {}) {
    const est = BL3.stats.estimate(it);
    if (!est) return h('p', { class: 'muted' }, 'No stats for this item.');
    return h('div', { class: 'stats' },
      est.bars.length ? h('div', { class: 'stat-bars' }, est.bars.map(b => h('div', { class: 'stat-row' + (b.value > 10.5 ? ' over' : '') },
        h('span', { class: 'sl' }, b.icon + ' ' + b.label),
        h('div', { class: 'sbar' }, h('i', { style: 'width:' + Math.min(100, b.value * 10) + '%' })),
        h('span', { class: 'st' }, b.text)))) : null,
      est.traits.length ? h('ul', { class: 'traits' }, est.traits.slice(0, opts.maxTraits || 40).map(t => h('li', null, t))) : null,
      h('div', { class: 'muted', style: 'font-size:11px;margin-top:6px' }, 'Estimated from the item\'s parts, rarity, level, Mayhem and anointments. These are ratings, not exact in-game numbers.'));
  }
  function openStats(it) {
    modal(h('div', null,
      h('div', { class: 'modal-head' }, h('div', null, h('h2', { style: 'color:var(--r' + it.rarity + ')' }, KIND_ICON[it.kind] + ' ' + it.name), h('div', { class: 'muted' }, 'Level ' + it.level + (it.mayhem ? ' · Mayhem ' + it.mayhem : '') + ' · ' + it.parts.length + ' parts')),
        h('button', { class: 'btn ghost x', onclick: closeModal }, '✕')),
      statsPanel(it),
      h('h3', { style: 'font:900 18px var(--display);margin:16px 0 6px' }, 'What each part does'),
      h('div', { class: 'parts' }, uniq(it.parts).map(p => {
        const [n, s_] = partLabel(p);
        const c = it.parts.filter(x => x === p).length;
        return h('div', { class: 'part col' }, h('div', { class: 'row' }, h('span', { class: 'slot' }, F.partInfo(p).slot), h('b', null, n), c > 1 ? h('span', { class: 'x2' }, '×' + c) : null),
          h('div', { class: 'pd' }, BL3.stats.describePart(p, it.kind)));
      }))));
  }

  // ------------------------------------------------------------------ item editor
  function partLabel(full) {
    const s = short(full);
    const n = DATA.partNames[s] || DATA.prefixNames[s];
    return n ? [n, s] : [s.replace(/_/g, ' '), ''];
  }

  function openItem(i) {
    const ed = S.ed;
    const e = ed.items[i];
    if (!e || !e.item) return;
    snapshot();
    const it = e.item;
    const rerender = () => { renderItemModal(i); render(); };
    renderItemModal(i);
    function renderItemModal() {
      const card = h('div');
      const pool = F.anointPoolFor(it);
      const cat = it.invKey ? BL3.serialDB.assets(it.invKey) : [];
      const counts = {};
      it.parts.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
      const code = h('textarea', { class: 'code-box', readonly: true }, it.code());
      const partsList = h('div', { class: 'parts' }, uniq(it.parts).map(p => {
        const [n, s] = partLabel(p);
        const slot = F.partInfo(p).slot;
        return h('div', { class: 'part' },
          h('span', { class: 'slot' }, slot),
          h('span', { class: 'pn', title: s || n }, n, s ? h('small', null, s) : null, h('span', { class: 'pd' }, BL3.stats.describePart(p, it.kind))),
          counts[p] > 1 ? h('span', { class: 'x2' }, '×' + counts[p]) : null,
          h('button', { class: 'btn sm', title: 'Add another copy', onclick: () => { if (it.parts.length >= 63) return toast('Max 63 parts', 'err'); it.parts.push(p); it.touch(); rerender(); } }, '+'),
          h('button', { class: 'btn sm danger', title: 'Remove one', onclick: () => { it.parts.splice(it.parts.lastIndexOf(p), 1); it.touch(); rerender(); } }, '−'));
      }));
      const addPart = h('select', { style: 'flex:1;min-width:200px' }, h('option', { value: '' }, '+ Add a part (' + cat.length + ' available)…'),
        cat.map(p => { const [n, s] = partLabel(p); const d = BL3.stats.describePart(p, it.kind); return h('option', { value: p, title: d }, n + (s ? ' — ' + s : '') + '  ·  ' + d.slice(0, 70)); }));
      addPart.onchange = () => { if (!addPart.value) return; if (it.parts.length >= 63) return toast('Max 63 parts', 'err'); it.parts.push(addPart.value); it.touch(); rerender(); };
      const gens = h('div', { class: 'parts' }, it.generics.map((g, gi) => h('div', { class: 'part' },
        h('span', { class: 'slot', style: 'background:var(--cyan)' }, /Mayhem/i.test(g) ? 'mayhem' : 'anoint'),
        h('span', { class: 'pn' }, F.anointName(g), h('small', null, short(g))),
        h('button', { class: 'btn sm danger', onclick: () => { it.generics.splice(gi, 1); it.touch(); rerender(); } }, '−'))));
      const allGen = BL3.serialDB.assets('InventoryGenericPartData').filter(g => !/Dummy|Testing|Mayhem/i.test(g));
      const addGen = h('select', { style: 'flex:1;min-width:200px' }, h('option', { value: '' }, '+ Add anointment…'),
        h('optgroup', { label: 'Recommended for this item' }, pool.map(g => h('option', { value: g }, F.anointName(g)))),
        h('optgroup', { label: 'Everything (modded)' }, allGen.map(g => h('option', { value: short(g) }, F.anointName(g)))));
      addGen.onchange = () => {
        if (!addGen.value) return;
        if (it.generics.length >= 15) return toast('Max 15 anointments', 'err');
        const idx = BL3.serialDB.index('InventoryGenericPartData', addGen.value);
        it.generics.push(BL3.serialDB.part('InventoryGenericPartData', idx)); it.touch(); rerender();
      };
      const flags = (e.pb && e.pb.flags) || 0;
      card.append(
        h('div', { class: 'modal-head' },
          h('div', null, h('h2', { style: 'color:var(--r' + it.rarity + ')' }, KIND_ICON[it.kind] + ' ' + it.name), h('div', { class: 'muted', style: 'font-size:12px;word-break:break-all' }, short(it.balance) + ' · ' + short(it.manufacturer) + ' · ' + short(it.invdata))),
          h('button', { class: 'btn primary x', onclick: () => { closeModal(); render(); } }, '✓ Done')),
        h('div', { class: 'row', style: 'margin-bottom:14px' },
          h('button', { class: 'btn op', onclick: () => { F.makeOP(it, ctx()); rerender(); toast('🔥 OP', 'ok'); } }, '🔥 OP'),
          h('button', { class: 'btn mod', onclick: () => confirmModded(() => { F.makeModded(it, ctx()); rerender(); toast('☢ MODDED', 'ok'); }) }, '☢ MODDED'),
          h('button', { class: 'btn inf', onclick: () => { F.makeAmmoKit(it, ctx()); rerender(); toast('∞ ammo kit', 'ok'); } }, '∞ Ammo kit'),
          powerSlider()),
        h('details', { class: 'stat-details', open: true }, h('summary', null, '📊 Stats (live)'), statsPanel(it, { maxTraits: 8 })),
        h('div', { class: 'grid g4', style: 'margin-bottom:14px' },
          h('label', { class: 'field' }, 'Level', h('input', { type: 'number', min: 1, max: 127, value: it.level, onchange: ev => { it.level = Math.max(1, Math.min(127, +ev.target.value || 1)); it.touch(); rerender(); } })),
          h('label', { class: 'field' }, 'Mayhem', h('select', { disabled: !F.canMayhem(it) || !it.canParseParts, onchange: ev => { F.setMayhem(it, +ev.target.value); rerender(); } },
            Array.from({ length: 11 }, (_, m) => h('option', { value: m, selected: it.mayhem === m }, m ? 'Mayhem ' + m : 'None')))),
          h('label', { class: 'field' }, 'Main anointment', h('select', { disabled: !it.canParseParts || !pool.length, onchange: ev => { F.setAnoint(it, ev.target.value); rerender(); } },
            h('option', { value: '' }, '— none —'), pool.map(g => h('option', { value: g, selected: it.anoints[0] && short(it.anoints[0]) === g }, F.anointName(g))))),
          !isProfile() ? h('label', { class: 'field' }, 'Equip in slot', h('select', { onchange: ev => { if (ev.target.value !== '') { ed.equip(i, +ev.target.value); toast('Equipped', 'ok'); render(); } } },
            h('option', { value: '' }, ed.equippedSlotOf(i) || '— not equipped —'), BL3.SLOT_NAMES.map((n, k) => h('option', { value: k }, n)))) : h('div')),
        !isProfile() ? h('div', { class: 'row', style: 'margin-bottom:12px' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: flags & 2, onchange: ev => { ed.setFlag(i, 'favorite', ev.target.checked); rerender(); } }), '★ Favorite'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: flags & 4, onchange: ev => { ed.setFlag(i, 'junk', ev.target.checked); rerender(); } }), '🗑 Junk')) : null,
        !it.canParseParts ? h('p', { class: 'warn' }, 'This item\'s parts can\'t be decoded, so only the level can be edited.') : h('div', { class: 'grid g2' },
          h('div', null, h('h3', { style: 'font:900 18px var(--display);margin:6px 0' }, 'Parts ', h('small', { class: 'muted' }, it.parts.length + ' / 63')), partsList, h('div', { class: 'row', style: 'margin-top:8px' }, addPart)),
          h('div', null, h('h3', { style: 'font:900 18px var(--display);margin:6px 0' }, 'Anointments & Mayhem ', h('small', { class: 'muted' }, it.generics.length + ' / 15')), gens, h('div', { class: 'row', style: 'margin-top:8px' }, addGen))),
        h('h3', { style: 'font:900 18px var(--display);margin:14px 0 6px' }, 'Item code'),
        code,
        h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', { class: 'btn', onclick: () => copy(it.code(), 'Code copied') }, '📋 Copy code'),
          h('button', { class: 'btn', onclick: () => { ed.duplicateItem(i); toast('Duplicated', 'ok'); render(); } }, '⧉ Duplicate'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn danger', onclick: () => { ed.removeItem(i); closeModal(); render(); toast('Deleted'); } }, '🗑 Delete')));
      modal(card);
    }
  }
  function uniq(a) { return Array.from(new Set(a)); }

  // ------------------------------------------------------------------ forge
  function viewForge(v) {
    const fs = S.forge;
    const filters = {};
    if (fs.kind) filters.kind = fs.kind;
    if (fs.type) filters.type = fs.type;
    if (fs.manu) filters.manu = fs.manu;
    if (fs.rarity) filters.rarity = +fs.rarity;
    const results = F.searchCatalog(fs.q, filters);
    const manus = uniq(DATA.catalog.map(c => c.m).filter(Boolean)).sort();
    const catGrid = h('div', { class: 'catalog' }, results.slice(0, 400).map(c => h('div', {
      class: 'cat-item r' + c.r + (fs.sel === c.b ? ' sel' : ''),
      onclick: () => { fs.sel = c.b; render(); },
      ondblclick: () => { fs.sel = c.b; forgeCreate(); },
    }, h('b', null, KIND_ICON[c.k] + ' ' + c.n), h('span', null, [c.m, c.t || KIND_LABEL[c.k]].filter(Boolean).join(' · ')))));
    const sel = DATA.catalog.find(c => c.b === fs.sel);
    const searchInput = h('input', { type: 'text', placeholder: '🔍 Search 780+ items: fingerbiter, hex, moxxi, monarch…', value: fs.q, style: 'flex:1;min-width:220px',
      oninput: e => { fs.q = e.target.value; clearTimeout(S._ft); S._ft = setTimeout(() => { render(); const i = $('[data-view=forge] input[type=text]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200); } });
    const sel_ = (val, onch, opts) => h('select', { onchange: e => { onch(e.target.value); render(); } }, opts.map(([v_, l]) => h('option', { value: v_, selected: String(val) === String(v_) }, l)));
    v.append(h('div', { class: 'forge-layout' },
      h('div', { class: 'panel' },
        h('h3', null, '🔨 The Forge', h('small', null, results.length + ' items · double-click to create instantly')),
        h('div', { class: 'row', style: 'margin-bottom:12px' }, searchInput,
          sel_(fs.kind, x => { fs.kind = x; if (x !== 'weapon') fs.type = ''; }, [['', 'All gear'], ['weapon', '🔫 Guns'], ['shield', '🛡 Shields'], ['grenade', '💣 Grenades'], ['relic', '🔮 Relics'], ['com', '🎓 Class Mods']]),
          fs.kind === 'weapon' || !fs.kind ? sel_(fs.type, x => { fs.type = x; if (x) fs.kind = 'weapon'; }, [['', 'Any type'], ['Pistol', 'Pistol'], ['SMG', 'SMG'], ['Assault Rifle', 'Assault Rifle'], ['Shotgun', 'Shotgun'], ['Sniper', 'Sniper'], ['Heavy', 'Launcher']]) : null,
          sel_(fs.manu, x => { fs.manu = x; }, [['', 'Any brand']].concat(manus.map(m => [m, m]))),
          sel_(fs.rarity, x => { fs.rarity = x; }, [['', 'Any rarity'], ['5', '🟧 Legendary'], ['4', '🟪 Purple'], ['3', '🟦 Blue'], ['2', '🟩 Green'], ['1', '⬜ White']])),
        catGrid),
      h('div', { class: 'panel' },
        h('h3', null, 'Build it'),
        sel ? h('div', { style: 'margin-bottom:12px' }, h('div', { style: 'font:900 28px/1.05 var(--display);color:var(--r' + sel.r + ')' }, KIND_ICON[sel.k] + ' ' + sel.n), h('div', { class: 'muted', style: 'font-size:12px' }, [sel.m, sel.t || KIND_LABEL[sel.k]].filter(Boolean).join(' · ')))
          : h('p', { class: 'muted' }, '← Pick something from the list.'),
        h('div', { class: 'muted', style: 'font-size:12px;margin:8px 0 4px' }, 'POWER'),
        h('div', { class: 'mode-pick' }, [['normal', 'NORMAL'], ['op', '🔥 OP'], ['modded', '☢ MODDED']].map(([m, l]) => h('button', { 'data-m': m, class: fs.mode === m ? 'on' : '', onclick: () => { fs.mode = m; render(); } }, l))),
        h('div', { class: 'muted', style: 'font-size:12px;margin:12px 0 4px' }, 'ELEMENT (guns)'),
        h('div', { class: 'el-pick' }, [['', 'Default'], ['fire', '🔥 Fire'], ['shock', '⚡ Shock'], ['corrosive', '☣ Corrosive'], ['cryo', '❄ Cryo'], ['radiation', '☢ Rad']].map(([e, l]) => h('button', { 'data-e': e, class: fs.element === e ? 'on' : '', onclick: () => { fs.element = e; render(); } }, l))),
        h('div', { class: 'grid g2', style: 'margin:14px 0' },
          h('label', { class: 'field' }, 'Level', h('input', { type: 'number', min: 1, max: 72, value: fs.level, onchange: e => { fs.level = Math.max(1, Math.min(72, +e.target.value || 72)); } })),
          h('label', { class: 'field' }, 'How many', h('input', { type: 'number', min: 1, max: 50, value: fs.count, onchange: e => { fs.count = Math.max(1, Math.min(50, +e.target.value || 1)); } }))),
        fs.mode === 'modded' ? h('div', { style: 'margin-bottom:12px' }, powerSlider()) : null,
        h('button', { class: 'btn primary big', style: 'width:100%', disabled: !sel, onclick: forgeCreate }, '🔨 FORGE IT'),
        sel ? (() => {
          try {
            const pv = F.buildItem(sel, { element: fs.element || null, level: fs.level });
            if (fs.mode === 'op') F.makeOP(pv, Object.assign(ctx(), { level: fs.level }));
            if (fs.mode === 'modded') F.makeModded(pv, ctx());
            return h('div', { style: 'margin-top:14px' }, h('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, 'PREVIEW STATS'), statsPanel(pv, { maxTraits: 6 }),
              h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: () => openStats(pv) }, '📊 What each part does'));
          } catch (e) { return null; }
        })() : null,
        h('p', { class: 'muted', style: 'font-size:12px' }, 'Built items get sensible parts automatically (the item\'s own legendary parts + a clean base). Tweak anything afterwards in ✎ Edit. If a forged item ever looks off in-game, importing a real code for it (📥) is the most reliable option.'),
        h('button', { class: 'btn', style: 'width:100%;margin-top:6px', onclick: () => { const r = F.searchCatalog('', { rarity: 5, kind: fs.kind || undefined }); const c = r[Math.floor(Math.random() * r.length)]; fs.sel = c.b; render(); } }, '🎲 Random legendary'))));
  }
  function forgeCreate() {
    const fs = S.forge;
    const sel = DATA.catalog.find(c => c.b === fs.sel);
    if (!sel) return;
    const go = () => act(() => {
      for (let n = 0; n < fs.count; n++) {
        const it = F.buildItem(sel, { element: fs.element || null, level: fs.level });
        if (fs.mode === 'op') F.makeOP(it, Object.assign(ctx(), { level: fs.level }));
        if (fs.mode === 'modded') F.makeModded(it, ctx());
        S.ed.addItem(it, { favorite: true });
      }
    }, () => '🔨 Forged ' + fs.count + '× ' + (fs.mode === 'normal' ? '' : fs.mode.toUpperCase() + ' ') + sel.n + ' → ' + (isProfile() ? 'Bank' : 'Backpack'));
    if (fs.mode === 'modded') confirmModded(go); else go();
  }

  // ------------------------------------------------------------------ character / profile
  function numField(label, val, onset, opts = {}) {
    return h('label', { class: 'field' }, label, h('input', { type: 'number', value: val, min: opts.min ?? 0, max: opts.max, onchange: e => act(() => onset(+e.target.value), opts.msg || (label + ' updated')) }));
  }
  function viewChar(v) {
    const ed = S.ed;
    if (isProfile()) return viewProfile(v);
    v.append(h('div', { class: 'grid g2' },
      h('div', { class: 'panel' }, h('h3', null, '👤 Vault Hunter'),
        h('div', { class: 'grid g2' },
          h('label', { class: 'field' }, 'Name', h('input', { type: 'text', value: ed.name, onchange: e => act(() => { ed.name = e.target.value; }, 'Name updated') })),
          h('label', { class: 'field' }, 'Class', h('input', { type: 'text', value: ed.className, disabled: true })),
          numField('Level (1-72)', ed.level, x => { ed.level = x; }, { min: 1, max: 72 }),
          numField('Unspent skill points', ed.skillPoints, x => { ed.skillPoints = x; }),
          numField('Money', ed.money, x => { ed.money = x; }, { max: 2147483647 }),
          numField('Eridium', ed.eridium, x => { ed.eridium = x; }, { max: 2147483647 }),
          h('label', { class: 'field' }, 'Mayhem (all playthroughs)', h('select', { onchange: e => act(() => ed.setMayhemAll(+e.target.value), 'Mayhem set') }, Array.from({ length: 11 }, (_, m) => h('option', { value: m, selected: (ed.mayhemLevels[0] || 0) === m }, m ? 'Mayhem ' + m : 'Off')))),
          h('label', { class: 'field' }, 'Playthroughs', h('select', { onchange: e => act(() => { ed.playthroughs = +e.target.value; }, 'Playthroughs updated') },
            [[0, 'Normal only'], [1, 'TVHM unlocked'], [2, 'Both completed']].map(([k, l]) => h('option', { value: k, selected: ed.playthroughs === k }, l))))),
        h('div', { class: 'row', style: 'margin-top:12px' },
          h('button', { class: 'btn primary', onclick: () => act(() => { ed.level = 72; }, 'Level 72!') }, 'Max level'),
          h('button', { class: 'btn', onclick: () => act(() => { ed.money = BL3.LIMITS.MAX_MONEY; ed.eridium = BL3.LIMITS.MAX_ERIDIUM; }, 'Rich.') }, '💰 Max money'),
          h('button', { class: 'btn', onclick: () => act(() => ed.unlockVehicles(), 'All vehicles unlocked') }, '🚗 All vehicles'))),
      h('div', { class: 'panel' }, h('h3', null, '🏅 Guardian Rank', h('small', null, 'current: ' + fmt(ed.guardianRank))),
        h('p', { class: 'muted' }, 'Puts the same number of tokens in all 18 Guardian rewards (gun damage, crit, fire rate, health, shields…). The profile also stores Guardian Rank — edit profile.sav too for the full effect.'),
        h('div', { class: 'row' }, ...[25, 100, 200, 500].map(n => h('button', { class: 'btn', onclick: () => act(() => ed.setGuardianRewards(n), n + ' tokens in every reward') }, n + ' each')))),
      h('div', { class: 'panel' }, h('h3', null, '🎒 SDUs', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => act(() => ed.maxSdus(), 'SDUs maxed') }, 'MAX ALL')),
        h('table', { class: 't' }, h('tr', null, h('th', null, 'Upgrade'), h('th', null, 'Level'), h('th', null, '')),
          ed.sdus.map(s => h('tr', null, h('td', null, s.name), h('td', null, h('input', { type: 'number', min: 0, max: s.max, value: s.level, onchange: e => act(() => ed.setSdu(s.path, Math.min(s.max, +e.target.value)), s.name + ' SDU updated') }), ' / ' + s.max),
            h('td', null, h('div', { class: 'bar' }, h('i', { style: 'width:' + (100 * s.level / s.max) + '%' }))))))),
      h('div', { class: 'panel' }, h('h3', null, '🔫 Ammo', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => act(() => ed.maxAmmo(), 'Ammo full') }, 'FILL ALL')),
        h('table', { class: 't' }, h('tr', null, h('th', null, 'Type'), h('th', null, 'Amount'), h('th', null, '')),
          ed.ammo.map(a => h('tr', null, h('td', null, a.name), h('td', null, h('input', { type: 'number', min: 0, value: a.amount, onchange: e => act(() => { a.pool.amount = Math.max(0, +e.target.value); }, a.name + ' ammo updated') }), ' / ' + a.max),
            h('td', null, h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, 100 * a.amount / a.max) + '%' }))))))),
      h('div', { class: 'panel' }, h('h3', null, '🔓 Gear slots', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => act(() => ed.unlockAllSlots(), 'All slots unlocked') }, 'UNLOCK ALL')),
        h('div', { class: 'grid g2' }, ed.slots.map(s => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.enabled, onchange: e => act(() => { s.pb.enabled = e.target.checked; }) }), s.name, s.index >= 0 && ed.items[s.index] && ed.items[s.index].item ? h('span', { class: 'muted', style: 'font-size:12px' }, ' — ' + ed.items[s.index].item.name) : null)))),
      h('div', { class: 'panel' }, h('h3', null, '🏆 Unlocks', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => act(() => ed.unlockSpecialChallenges(), 'Unlocked') }, 'UNLOCK ALL')),
        ed.specialChallenges.map(c => h('div', { class: 'check' }, c.done ? '✅' : '⬜', ' ', c.name)))));
  }
  function viewProfile(v) {
    const ed = S.ed;
    v.append(h('div', { class: 'grid g2' },
      h('div', { class: 'panel' }, h('h3', null, '🗝 Keys', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => act(() => ed.keyTypes.forEach(k => ed.setKeys(k.cat, 999)), '999 of every key') }, '999 ALL')),
        h('div', { class: 'grid g2' }, ed.keyTypes.map(k => numField(k.name, k.value, x => ed.setKeys(k.cat, x))))),
      h('div', { class: 'panel' }, h('h3', null, '🏅 Guardian Rank', h('small', null, fmt(ed.guardianRank))),
        h('p', { class: 'muted' }, 'Tokens in each of the 18 Guardian rewards. Applies to all your characters.'),
        h('div', { class: 'row' }, ...[25, 100, 200, 500].map(n => h('button', { class: 'btn', onclick: () => act(() => ed.setGuardianRewards(n), n + ' tokens in every reward') }, n + ' each')))),
      h('div', { class: 'panel' }, h('h3', null, '🏦 Bank SDUs', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => act(() => ed.maxSdus(), 'Maxed') }, 'MAX ALL')),
        h('table', { class: 't' }, ed.sdus.map(s => h('tr', null, h('td', null, s.name), h('td', null, h('input', { type: 'number', min: 0, max: s.max, value: s.level, onchange: e => act(() => ed.setSdu(s.path, Math.min(s.max, +e.target.value)), 'Updated') }), ' / ' + s.max))))),
      h('div', { class: 'panel' }, h('h3', null, '🎨 Cosmetics', h('small', null, fmt(ed.cosmeticsCount) + ' unlocked')),
        h('p', { class: 'muted' }, 'Every character skin, head, ECHO theme, emote, room decoration, weapon skin and trinket.'),
        h('button', { class: 'btn primary', onclick: () => act(() => ed.unlockCosmetics(), 'All cosmetics unlocked') }, 'Unlock everything'))));
  }

  // ------------------------------------------------------------------ modal
  function modal(content) {
    const card = $('#modalCard');
    card.innerHTML = '';
    card.append(content);
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; }
  $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') { closeModal(); render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) { closeModal(); render(); } });

  // ------------------------------------------------------------------ wiring
  $('#btnOpen').onclick = pickFile;
  $('#btnOpen2').onclick = pickFile;
  $('#btnSave').onclick = saveFile;
  $('#btnUndo').onclick = undo;
  $('#btnDemo').onclick = () => {
    if (!window.BL3_DEMO) return toast('Demo save not bundled', 'err');
    openBytes(BL3.util.b64decode(window.BL3_DEMO), 'demo-zane.sav');
  };
  $('#fileInput').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    openBytes(new Uint8Array(await f.arrayBuffer()), f.name);
  };
  const dz = $('#dropZone');
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'dragleave' && e.target !== dz) return; dz.classList.remove('over'); }));
  document.addEventListener('drop', async e => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) openBytes(new Uint8Array(await f.arrayBuffer()), f.name);
  });
  window.addEventListener('beforeunload', e => { if (S.undo.length) { e.preventDefault(); e.returnValue = ''; } });
  window.VF = S; // debugging handle
})();
