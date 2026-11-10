/*
 * VAULT FORGE - loadout presets: one tap = a whole themed kit, auto-equipped.
 */
(function (root) {
  'use strict';
  const BL3 = root.BL3;

  // slot: 0-3 weapons, 4 shield, 5 grenade, 6 class mod, 7 relic
  const W = (q, el, slot) => ({ q, el, slot });
  const COM = { classCom: true, slot: 6 };
  const PRESETS = [
    {
      id: 'fire', icon: '🔥', name: 'Fire Demon', color: '#ff5e1a',
      desc: 'Everything burns. Including your enemies\' will to live.',
      items: [W('Hellwalker', 'fire', 0), W('Lucian\'s Call', 'fire', 1), W('Sand Hawk', 'fire', 2), W('Hellshock', 'fire', 3),
        { q: 'Front Loader', slot: 4 }, { q: 'Firestorm', slot: 5 }, COM, { q: 'Victory Rush', slot: 7 }],
    },
    {
      id: 'shock', icon: '⚡', name: 'Shock Therapy', color: '#3fb8ff',
      desc: 'Shields? Never heard of them. Zap zap motherf***er.',
      items: [W('The Monarch', 'shock', 0), W('Kaoson', 'shock', 1), W('Conference Call', 'shock', 2), W('Lyuda', 'shock', 3),
        { q: 'The Transformer', slot: 4 }, { q: 'Storm Front', slot: 5 }, COM, { q: 'Deathless', slot: 7 }],
    },
    {
      id: 'cryo', icon: '❄', name: 'Ice Ice Baby', color: '#b9f2ff',
      desc: 'Freeze \'em, shatter \'em, sweep \'em up.',
      items: [W('Frozen Devil', 'cryo', 0), W('Icebreaker', 'cryo', 1), W('Trevonator', 'cryo', 2), W('Wedding Invitation', 'cryo', 3),
        { q: 'Frozen Snowshoe', slot: 4 }, { q: 'Fish Slap', el: 'cryo', slot: 5 }, COM, { q: 'Victory Rush', slot: 7 }],
    },
    {
      id: 'rad', icon: '☢', name: 'Chernobyl', color: '#e4ff3a',
      desc: 'Everyone you kill explodes and takes their friends with them.',
      items: [W('Free Radical', 'radiation', 0), W('Bekah', 'radiation', 1), W('Unkempt Harold', 'radiation', 2), W('Plaguebearer', 'radiation', 3),
        { q: 'Re-Charger', slot: 4 }, { q: 'Quasar', el: 'radiation', slot: 5 }, COM, { q: 'Deathless', slot: 7 }],
    },
    {
      id: 'boss', icon: '💀', name: 'Boss Deleter', color: '#ff3b3b',
      desc: 'Raid bosses file a restraining order.',
      items: [W('Sand Hawk', null, 0), W('The Monarch', 'corrosive', 1), W('Hellwalker', null, 2), W('Unkempt Harold', null, 3),
        { q: 'Stop-Gap', slot: 4 }, { q: 'Hex', slot: 5 }, COM, { q: 'Victory Rush', slot: 7 }],
    },
    {
      id: 'ammo', icon: '∞', name: 'Never Reload', color: '#46f0ff',
      desc: 'Hold the trigger. Never let go. Infinite ammo kit on everything.',
      ammoKit: true,
      items: [W('Infinity', null, 0), W('Breath of the Dying', null, 1), W('Torrent', null, 2), W('The Dictator', null, 3),
        { q: 'Big Boom Blaster', slot: 4 }, { q: 'Moxxi\'s Bouncing Pair', slot: 5 }, COM, { q: 'Victory Rush', slot: 7 }],
    },
    {
      id: 'boom', icon: '🚀', name: 'Explosion Addict', color: '#ffb800',
      desc: 'Michael Bay would like a word. Every gun goes boom.',
      items: [W('Flakker', null, 0), W('Jericho', null, 1), W('ION CANNON', null, 2), W('Kickcharger', null, 3),
        { q: 'Big Boom Blaster', slot: 4 }, { q: 'Quasar', slot: 5 }, COM, { q: 'Deathless', slot: 7 }],
    },
    {
      id: 'chaos', icon: '🎲', name: 'Chaos Roulette', color: '#b05cff',
      desc: 'Random legendary in every slot, random elements. Pray.',
      items: [{ random: 'weapon', slot: 0 }, { random: 'weapon', slot: 1 }, { random: 'weapon', slot: 2 }, { random: 'weapon', slot: 3 },
        { random: 'shield', slot: 4 }, { random: 'grenade', slot: 5 }, COM, { random: 'relic', slot: 7 }],
    },
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function resolve(spec, classToken) {
    const F = BL3.forge;
    if (spec.classCom) {
      let r = F.searchCatalog('', { kind: 'com', rarity: 5 });
      if (classToken) { const mine = r.filter(c => c.n.toLowerCase().includes(classToken.toLowerCase())); if (mine.length) r = mine; }
      return pick(r);
    }
    if (spec.random) return pick(F.searchCatalog('', { kind: spec.random, rarity: 5 }));
    return F.searchCatalog(spec.q)[0];
  }

  /**
   * Build a preset into the editor. mode: 'op' | 'modded'.
   * Returns { log, added: [indices] }.
   */
  function run(ed, id, opts = {}) {
    const F = BL3.forge;
    const p = PRESETS.find(x => x.id === id);
    if (!p) throw new Error('Unknown preset ' + id);
    const isProfile = ed instanceof BL3.ProfileEditor;
    const ctx = { classToken: isProfile ? '' : ed.classToken, power: opts.power || 3 };
    const mode = BL3.forge.isSafe(opts) ? 'op' : (opts.mode || 'modded');
    const log = [], added = [];
    for (const spec of p.items) {
      const entry = resolve(spec, ctx.classToken);
      if (!entry) { log.push('❓ skipped ' + (spec.q || spec.random || 'class mod')); continue; }
      const el = spec.el || (spec.random === 'weapon' ? pick([null, 'fire', 'shock', 'corrosive', 'cryo', 'radiation']) : null);
      const it = F.buildItem(entry, { element: el });
      if (mode === 'modded') F.makeModded(it, ctx); else F.makeOP(it, ctx);
      if (p.ammoKit) F.makeAmmoKit(it, ctx);
      const idx = ed.addItem(it, { favorite: true });
      added.push(idx);
      if (!isProfile && opts.equip !== false && spec.slot !== undefined) ed.equip(idx, spec.slot);
      log.push((mode === 'modded' ? '☢ ' : '🔥 ') + entry.n + (el ? ' (' + el + ')' : ''));
    }
    if (!isProfile && opts.equip !== false) ed.unlockAllSlots();
    if (p.ammoKit && !isProfile) { ed.maxSdus(); ed.maxAmmo(); }
    return { log, added, preset: p };
  }

  // ------------------------------------------------------------------ mystery loot
  const LOOT_WEIGHTS = [['weapon', 60], ['shield', 10], ['grenade', 10], ['relic', 10], ['com', 10]];
  const FILL_TO = { backpack: 40, bank: 100, vault: 25 };
  function weightedKind() {
    let r = Math.random() * 100;
    for (const [k, w] of LOOT_WEIGHTS) { if ((r -= w) < 0) return k; }
    return 'weapon';
  }
  /**
   * Random legendary loot. opts: { kind: 'any'|'weapon'|..., mode: 'op'|'modded'|'mix', count, classToken, power }
   * Returns [{ item, entry, mode, element }]
   */
  function randomLoot(opts = {}) {
    const F = BL3.forge;
    const count = Math.max(0, Math.min(200, opts.count || 1));
    const out = [];
    const pools = {};
    const poolFor = (k) => {
      if (!pools[k]) {
        let r = F.searchCatalog('', { kind: k, rarity: 5 });
        // console-safe: only items we can build legitimately
        if (F.isSafe(opts) && BL3.legit) { const ok = r.filter(c => BL3.legit.setFor(c.b)); if (ok.length) r = ok; }
        if (k === 'com' && opts.classToken) { const mine = r.filter(c => c.n.toLowerCase().includes(opts.classToken.toLowerCase())); if (mine.length) r = mine; }
        pools[k] = r;
      }
      return pools[k];
    };
    for (let i = 0; i < count; i++) {
      const kind = !opts.kind || opts.kind === 'any' ? weightedKind() : opts.kind;
      const entry = pick(poolFor(kind));
      if (!entry) continue;
      const element = kind === 'weapon' ? pick([null, null, 'fire', 'shock', 'corrosive', 'cryo', 'radiation']) : null;
      const mode = F.isSafe(opts) ? 'op' : opts.mode === 'mix' ? (Math.random() < 0.5 ? 'op' : 'modded') : (opts.mode || 'op');
      try {
        const it = F.buildItem(entry, { element });
        const ctx = { classToken: opts.classToken || '', power: mode === 'modded' && opts.mode === 'mix' ? 1 + Math.floor(Math.random() * 5) : (opts.power || 3) };
        if (mode === 'modded') F.makeModded(it, ctx); else F.makeOP(it, ctx);
        out.push({ item: it, entry, mode, element });
      } catch (e) { i--; if (out.length + 50 < i) break; }
    }
    return out;
  }

  BL3.presets = { list: PRESETS, run, randomLoot, FILL_TO };
})(typeof window !== 'undefined' ? window : globalThis);
