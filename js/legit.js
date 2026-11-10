/*
 * VAULT FORGE - "legit" rules (BL3's sanity check).
 *
 * When BL3 loads a character it deletes items whose parts could never drop
 * in the real game. This module checks items against per-item part lists
 * (data from sandsmark/borderlands3-save-editor, originally a community
 * spreadsheet), repairs them, and builds new items that pass.
 *
 * Rules we enforce (all verified against real game-made items):
 *   - every part must be in the item's own part list
 *   - no more parts per category than that category's max
 *   - "needs" (dependencies) and "can't go with" (excluders) respected
 *   - duplicates only within the category max (real COMs repeat a skill for +2)
 *   - at most 1 anointment (from the right pool) + 1 Mayhem part, level <= 72
 * Category minimums in the source data are NOT enforced: real items break them.
 */
(function (root) {
  'use strict';
  const BL3 = root.BL3;
  const DATA = () => root.BL3_DATA;
  const short = (p) => (p || '').split('.').pop();
  const lc = (s) => (s || '').toLowerCase();

  const legit = { safe: true };

  /** Part list for a balance: [{ cat, max, parts: [shortName] }] or null if unknown. */
  function setFor(balance) {
    const L = DATA().legit;
    if (!L || !balance) return null;
    const i = L.bal[lc(short(balance))];
    if (i === undefined) return null;
    return L.sets[i].map(([cat, max, idxs]) => ({ cat, max, parts: idxs.map(n => L.names[n]) }));
  }
  function rulesFor(partShort) {
    const L = DATA().legit;
    if (!L._idx) { L._idx = {}; L.names.forEach((n, i) => { L._idx[n] = i; }); }
    const r = L.rules[L._idx[partShort]];
    if (!r) return { deps: [], excl: [] };
    return { deps: r[0].map(n => L.names[n]), excl: r[1].map(n => L.names[n]) };
  }
  function anointAllowed(item, g) {
    const pool = BL3.forge.anointPoolFor(item);
    return pool.includes(short(g));
  }
  function mayhemAllowed(item) {
    return item.kind === 'weapon' || item.kind === 'grenade' || BL3.forge.canMayhem(item);
  }
  const isMayhem = (g) => /WeaponMayhemLevel/i.test(g);

  /** { status: 'legit' | 'modded' | 'unknown', problems: [...] } */
  function check(item) {
    const problems = [];
    if (!item || !item.canParse) return { status: 'unknown', problems: ['item can\'t be fully read'] };
    if (item.level > 72) problems.push('level ' + item.level + ' (max is 72)');
    if (!item.canParseParts) return { status: problems.length ? 'modded' : 'unknown', problems };
    const may = item.generics.filter(isMayhem);
    const ano = item.generics.filter(g => !isMayhem(g));
    if (may.length > 1) problems.push(may.length + ' Mayhem parts (max 1)');
    if (may.length && !mayhemAllowed(item)) problems.push('Mayhem part on gear that can\'t have it');
    if (ano.length > 1) problems.push(ano.length + ' anointments (the game allows 1)');
    if (ano.length && (item.kind === 'relic' || item.kind === 'com')) problems.push('anointment on a ' + (item.kind === 'com' ? 'class mod' : 'relic'));
    else if (ano.length === 1 && !anointAllowed(item, ano[0])) problems.push('anointment not allowed on this gear');
    const shorts = item.parts.map(short);
    const set = setFor(item.balance);
    if (!set) {
      const cnt = {};
      shorts.forEach(p => { cnt[p] = (cnt[p] || 0) + 1; });
      const stacked = Object.values(cnt).filter(n => n > 3).length;
      if (stacked) problems.push(stacked + ' part' + (stacked > 1 ? 's' : '') + ' stacked more than 3 times');
    }
    if (set) {
      const where = {};
      set.forEach((c, ci) => c.parts.forEach(p => { where[p] = ci; }));
      const counts = new Array(set.length).fill(0);
      const bad = [];
      for (const p of shorts) if (where[p] !== undefined) counts[where[p]]++;
      for (const p of new Set(shorts)) {
        if (where[p] === undefined) { bad.push(p); continue; }
        const r = rulesFor(p);
        if (r.deps.length && !r.deps.some(d => shorts.includes(d))) problems.push(p + ' needs ' + r.deps.join(' or '));
        const ex = r.excl.filter(e => shorts.includes(e));
        if (ex.length) problems.push(p + ' can\'t be with ' + ex.join(', '));
      }
      if (bad.length) problems.push(bad.length + ' part' + (bad.length > 1 ? 's' : '') + ' this item can never roll' + (bad.length <= 3 ? ' (' + bad.join(', ') + ')' : ''));
      set.forEach((c, ci) => { if (counts[ci] > c.max) problems.push('too many ' + lc(c.cat) + ' parts (' + counts[ci] + ', max ' + c.max + ')'); });
    } else if (shorts.length > 25) {
      problems.push(shorts.length + ' parts (real items have about 5-20)');
    }
    return { status: problems.length ? 'modded' : (set ? 'legit' : 'unknown'), problems };
  }

  // ---------------------------------------------------------------- scoring ("best roll")
  function partScore(p) {
    const d = (DATA().partDesc || {})[p] || '';
    let s = 0;
    const pos = (/Positives:\s*([^·]*)/.exec(d) || [])[1] || '';
    const neg = (/Negatives:\s*([^·]*)/.exec(d) || [])[1] || '';
    for (const t of pos.split(/,|\band\b/)) if (t.trim()) s += /dmg|damage|crit/i.test(t) ? 3 : /fire rate|reload|mag|accuracy/i.test(t) ? 2 : 1;
    for (const t of neg.split(/,|\band\b/)) if (t.trim()) s -= /dmg|damage/i.test(t) ? 3 : 1;
    return s;
  }

  /**
   * Pick a legit part list for a balance. opts: { element, keep: [shorts to prefer], random }
   * Returns array of short part names, or null when we have no data.
   */
  function generate(balance, opts = {}) {
    const set = setFor(balance);
    if (!set) return null;
    const chosen = [];
    const ok = (p) => {
      const r = rulesFor(p);
      if (r.excl.some(e => chosen.includes(e))) return false;
      if (chosen.some(c => rulesFor(c).excl.includes(p))) return false;
      if (r.deps.length && !r.deps.some(d => chosen.includes(d))) return false;
      return true;
    };
    const keep = new Set(opts.keep || []);
    const el = opts.element ? lc(opts.element).slice(0, 4) : null;
    // two passes so accessories that depend on a later category still get a chance
    for (let pass = 0; pass < 2; pass++) {
      for (const c of set) {
        const have = c.parts.filter(p => chosen.includes(p)).length;
        let want = Math.max(0, c.max - have);
        if (!want) continue;
        const isElement = /ELEMENT/i.test(c.cat);
        if (pass === 1 && !/ACCESSORY/i.test(c.cat)) continue;
        while (want-- > 0) {
          let cands = c.parts.filter(p => !chosen.includes(p) && ok(p));
          if (!cands.length) break;
          if (isElement && el) {
            const m = cands.filter(p => lc(p).includes(el));
            if (m.length) cands = m;
          }
          const kept = cands.filter(p => keep.has(p));
          if (kept.length) cands = kept;
          let pick;
          if (opts.random) pick = cands[Math.floor(Math.random() * cands.length)];
          else {
            const scored = cands.map(p => [partScore(p) + Math.random() * 0.5, p]).sort((a, b) => b[0] - a[0]);
            pick = scored[0][1];
          }
          chosen.push(pick);
          if (isElement) break; // one element per category
        }
      }
    }
    return chosen;
  }

  /** Satisfy "needs X" rules: add a needed part when allowed, otherwise drop the needy part. */
  function fixDeps(parts, set, where) {
    parts = parts.slice();
    const countIn = (ci) => parts.filter(p => where[p] === ci).length;
    for (let guard = 0; guard < 20; guard++) {
      const needy = parts.find(p => { const r = rulesFor(p); return r.deps.length && !r.deps.some(d => parts.includes(d)); });
      if (!needy) break;
      const r = rulesFor(needy);
      const add = r.deps.find(d => {
        const ci = where[d];
        if (ci === undefined) return false;
        const rd = rulesFor(d);
        if (rd.excl.some(e => parts.includes(e)) || parts.some(c => rulesFor(c).excl.includes(d))) return false;
        if (countIn(ci) < set[ci].max) return true;
        // swap out the category's current part if there's no room
        return set[ci].max === 1;
      });
      if (add) {
        const ci = where[add];
        if (countIn(ci) >= set[ci].max) parts = parts.filter(p => where[p] !== ci);
        parts.push(add);
      } else {
        parts = parts.filter(p => p !== needy);
      }
    }
    return parts;
  }

  function toFull(item, shorts) {
    const out = [];
    for (const p of shorts) {
      const i = BL3.serialDB.index(item.invKey, p);
      if (i) out.push(BL3.serialDB.part(item.invKey, i));
    }
    return out;
  }

  /** Make an item pass the sanity check. Returns true if anything changed. */
  function repair(item) {
    if (!item || !item.canParse) return false;
    const before = item.parts.join('|') + '#' + item.generics.join('|') + '#' + item.level;
    if (item.level > 72) item.level = 72;
    if (!item.canParseParts) { item.touch(); return before !== item.parts.join('|') + '#' + item.generics.join('|') + '#' + item.level; }
    // anointments: first allowed anointment + first Mayhem part (if allowed)
    const may = item.generics.filter(isMayhem);
    const ano = (item.kind === 'relic' || item.kind === 'com') ? [] : item.generics.filter(g => !isMayhem(g) && anointAllowed(item, g));
    item.generics = ano.slice(0, 1).concat(mayhemAllowed(item) ? may.slice(0, 1) : []);
    const set = setFor(item.balance);
    const all = item.parts.map(short);
    const shorts = Array.from(new Set(all));
    if (set) {
      // keep the item's own parts where they fit, fill the rest legitimately
      const keepList = [];
      const where = {};
      set.forEach((c, ci) => c.parts.forEach(p => { where[p] = ci; }));
      const counts = new Array(set.length).fill(0);
      for (const p of all) {
        const ci = where[p];
        if (ci === undefined || counts[ci] >= set[ci].max) continue;
        counts[ci]++;
        keepList.push(p);
      }
      // drop conflicts (later parts lose), then unmet dependencies
      let parts = [];
      for (const p of keepList) {
        const r = rulesFor(p);
        if (r.excl.some(e => parts.includes(e) && e !== p) || parts.some(c => c !== p && rulesFor(c).excl.includes(p))) continue;
        parts.push(p);
      }
      let changed = true;
      while (changed) {
        changed = false;
        parts = parts.filter(p => { const r = rulesFor(p); const ok = !r.deps.length || r.deps.some(d => parts.includes(d)); if (!ok) changed = true; return ok; });
      }
      // a fixed item keeps exactly its own parts; we only fill categories it lost entirely
      const lost = set.filter(c => !/ACCESSORY|ELEMENT/i.test(c.cat) && c.parts.some(p => shorts.includes(p)) && !c.parts.some(p => parts.includes(p)));
      if (lost.length) {
        const extra = generate(item.balance, { keep: parts }) || [];
        for (const c of lost) { const p = extra.find(x => c.parts.includes(x)); if (p) parts.push(p); }
      }
      item.parts = toFull(item, fixDeps(parts, set, where));
    } else if (check(item).status !== 'modded') {
      // no part list, but nothing looks stacked: leave the real parts alone
      item.parts = toFull(item, all);
    } else {
      // no part list for this item: undo stacking, keep one part per slot
      const seen = {};
      const out = [];
      for (const p of shorts) {
        const info = BL3.forge.partInfo(p);
        const key = info.accessory ? info.slot + '_acc' : info.slot;
        seen[key] = (seen[key] || 0) + 1;
        const limit = info.accessory ? 2 : info.slot === 'other' || info.slot === 'unique' || info.slot === 'aug' || info.slot === 'skill' || info.slot === 'stats' || info.slot === 'ability' ? 3 : 1;
        if (seen[key] <= limit) out.push(p);
      }
      item.parts = toFull(item, out);
    }
    item.touch();
    return before !== item.parts.join('|') + '#' + item.generics.join('|') + '#' + item.level;
  }

  legit.setFor = setFor;
  legit.check = check;
  legit.repair = repair;
  legit.generate = generate;
  legit.toFull = toFull;
  legit.partScore = partScore;
  BL3.legit = legit;
})(typeof window !== 'undefined' ? window : globalThis);
