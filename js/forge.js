/*
 * BL3 Save Editor - "The Forge"
 *   - build new items from the catalog
 *   - OP / MODDED / Infinite Ammo upgrades
 *   - GOD MODE for characters
 *   - lazy text commands ("modded shock jakobs shotgun x3")
 */
(function (root) {
  'use strict';
  const BL3 = root.BL3;
  const DATA = () => root.BL3_DATA;
  const DB = () => BL3.serialDB;
  const C = () => root.BL3_DATA.consts;

  const short = (p) => (p || '').split('.').pop();
  const lc = (s) => (s || '').toLowerCase();

  // --------------------------------------------------------------------
  // Vocabulary
  // --------------------------------------------------------------------
  const MANU_WORDS = {
    atlas: 'Atlas', atl: 'Atlas', cov: 'COV', childrenofthevault: 'COV', dahl: 'Dahl', dal: 'Dahl',
    hyperion: 'Hyperion', hyp: 'Hyperion', jakobs: 'Jakobs', jak: 'Jakobs', maliwan: 'Maliwan', mal: 'Maliwan',
    tediore: 'Tediore', ted: 'Tediore', torgue: 'Torgue', tor: 'Torgue', vladof: 'Vladof', vla: 'Vladof',
    anshin: 'Anshin', ans: 'Anshin', pangolin: 'Pangolin', pan: 'Pangolin', eridian: 'Eridian',
  };
  const ELEMENTS = ['fire', 'shock', 'corrosive', 'cryo', 'radiation'];
  const ELEMENT_ALIASES = { incendiary: 'fire', burn: 'fire', electric: 'shock', acid: 'corrosive', poison: 'corrosive', ice: 'cryo', frost: 'cryo', rad: 'radiation', radioactive: 'radiation' };
  const RARITY_WORDS = { common: 1, uncommon: 2, rare: 3, veryrare: 4, legendary: 5 };

  const SLOT_ALIASES = {
    ele: 'element', elem: 'element', element: 'element', elemprimary: 'element', elemsecondary: 'element2', elemental: 'element',
    mat: 'material', material: 'material', magazine: 'mag', mag: 'mag', body: 'body', barrel: 'barrel', grip: 'grip',
    foregrip: 'foregrip', scope: 'scope', stock: 'stock', rail: 'rail', bolt: 'bolt', trigger: 'trigger',
    underbarrel: 'underbarrel', ub: 'underbarrel', rarity: 'rarity', manufacturer: 'manufacturer', aug: 'aug', augment: 'aug',
    leftside: 'leftside', rightside: 'rightside', behavior: 'behavior', payload: 'payload', ability: 'ability',
    stats: 'stats', stat: 'stats', extrastat: 'stats', mod: 'mod', skill: 'skill', character: 'character',
    unique: 'unique', mode: 'mode', sight: 'scope', tether: 'tether',
  };
  const GENERIC_WORDS = new Set(Object.keys(MANU_WORDS).concat(ELEMENTS, Object.keys(RARITY_WORDS), ['normal', 'none', 'nochange', 'veryrare', 'very']));

  function partInfo(full) {
    const s = short(full);
    const toks = s.split('_').filter(Boolean);
    let slot = 'other', at = -1;
    for (let i = 0; i < toks.length; i++) {
      const t = lc(toks[i]);
      if (i === 0 && (t === 'part' || t === 'gm' || t === 'shield' || t === 'artifact' || t === 'classmod' || t === 'cm')) continue;
      if (SLOT_ALIASES[t]) { slot = SLOT_ALIASES[t]; at = i; break; }
    }
    const rest = at >= 0 ? toks.slice(at + 1) : toks;
    const r0 = lc(rest[0] || '');
    const generic = at >= 0 && (rest.length === 0 || /^\d+$/.test(r0) || GENERIC_WORDS.has(r0));
    const accessory = generic && rest.some((t, i) => i > 0 && /^[A-F]$/.test(t)) || (rest.length === 1 && /^[A-F]$/.test(rest[0]));
    const statOnly = rest.some(t => /^stats?$/i.test(t));
    const num = (rest.find(t => /^\d+$/.test(t)) || '');
    return { full, s, low: lc(s), slot, rest, generic: generic && !accessory && !statOnly, accessory, num };
  }

  const STRIP_TOKENS = new Set(['balance', 'invbald', 'invbal', 'sm', 'sg', 'ar', 'ps', 'sr', 'hw', 'smg', 'shield', 'grenademod', 'gm',
    'artifact', 'classmod', 'cm', 'legendary', 'veryrare', 'rare', 'uncommon', 'common', 'unique', 'lgd', 'etech', 'pistol',
    'shotgun', 'beastmaster', 'gunner', 'operative', 'siren', 'bsm', 'gun', 'ope', 'sir', 'dahl', 'tediore', 'torgue', 'gearup', 'salvage']
    .concat(Object.keys(MANU_WORDS)));
  function uniqueTokens(balance) {
    return short(balance).split('_').filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STRIP_TOKENS.has(lc(t)));
  }

  // --------------------------------------------------------------------
  // Anointments
  // --------------------------------------------------------------------
  const CLASS_PREFIX = { Siren: 'Amara', Gunner: 'Moze', Operative: 'Zane', Beast: 'FL4K', CloneSwap: 'Zane' };
  const ANOINT_NAMES = {
    GPart_All_SkillEnd_WeaponDamage: 'After Action Skill ends: +Weapon Damage',
    GPart_EG_Generic_ConsecutiveHitsDmgStack: 'Consecutive hits stack bonus damage (up to +100%)',
    GPart_CloneSwap_WeaponDamage: 'Zane: after swapping with Clone, +100% weapon damage',
    GPart_Siren_Cast_WeaponDamage: 'Amara: after Phasecast, +Weapon Damage',
    GPart_Siren_Slam_WeaponDamage: 'Amara: after Phaseslam, +Weapon Damage',
    GPart_Gunner_NoAmmoConsumption: 'Moze: Iron Bear active → guns use NO ammo',
    GPart_Gunner_AutoBear_AmmoRegen: 'Moze: Auto Bear active → ammo regen',
    GPart_Operative_CloneActive_AmmoRegen: 'Zane: Clone active → ammo regen',
    GPart_All_GrenadeDamage: '+Grenade Damage',
    GPart_All_SkillEnd_AddGrenade: 'After Action Skill ends: gain a grenade',
    GPart_All_WeaponDamage: '+Weapon Damage',
    GPart_All_UniqueEnemyDamage: '+Damage to badasses & bosses',
    GPart_EG_Generic_LowHealthExecutor: 'Execute low-health enemies',
  };
  function anointName(g) {
    const s = short(g);
    if (ANOINT_NAMES[s]) return ANOINT_NAMES[s];
    const m = /WeaponMayhemLevel_(\d+)/.exec(s);
    if (m) return 'Mayhem ' + Number(m[1]);
    let t = s.replace(/^GPart_(G_)?/, '');
    let who = '';
    const k = t.split('_')[0];
    if (CLASS_PREFIX[k]) { who = CLASS_PREFIX[k] + ': '; t = t.slice(k.length + 1); }
    t = t.replace(/^All_/, '').replace(/^EG_(Gen(eric)?_)?/, '').replace(/^Passive_(All_)?/, '');
    t = t.replace(/SkillEnd_?/, 'After Action Skill: ').replace(/SkillStart_?/, 'Action Skill start: ').replace(/SkillActive_?/, 'Action Skill active: ')
      .replace(/^Terror/, 'Terror: ').replace(/WhileAirborn_?/, 'While airborne: ').replace(/WhileSliding_?/, 'While sliding: ')
      .replace(/GrenadeThrow_?/, 'Grenade throw: ').replace(/NextMag/, 'Next mag: ');
    t = t.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    return who + t;
  }
  function anointPoolFor(item) {
    const pools = DATA().anointPools;
    const k = item.kind === 'weapon' ? 'weapon' : item.kind === 'shield' ? 'shield' : item.kind === 'grenade' ? 'grenade' : null;
    return k ? pools[k] : [];
  }
  function canMayhem(item) {
    const low = lc(item.invdata);
    return C().mayhem_invdata_types.some(t => lc(t) === low);
  }
  function genericFull(s) {
    const i = DB().index('InventoryGenericPartData', s);
    return i ? DB().part('InventoryGenericPartData', i) : null;
  }

  function setMayhem(item, level) {
    if (!item.canParseParts || !canMayhem(item)) return false;
    const keep = item.generics.filter(g => !/WeaponMayhemLevel/i.test(g));
    if (level > 0) {
      const p = genericFull('Part_WeaponMayhemLevel_' + String(level).padStart(2, '0'));
      if (p) keep.push(p);
    }
    item.generics = keep;
    item.touch();
    return true;
  }
  function setAnoint(item, anoint) {
    if (!item.canParseParts) return false;
    const mayhem = item.generics.filter(g => /WeaponMayhemLevel/i.test(g));
    const full = anoint ? genericFull(short(anoint)) : null;
    item.generics = (full ? [full] : []).concat(mayhem);
    item.touch();
    return true;
  }
  function addGenerics(item, list, max = 15) {
    const have = new Set(item.generics.map(lc));
    for (const g of list) {
      if (item.generics.length >= max) break;
      const f = genericFull(short(g));
      if (f && !have.has(lc(f))) { item.generics.push(f); have.add(lc(f)); }
    }
    item.touch();
  }

  // --------------------------------------------------------------------
  // Part helpers
  // --------------------------------------------------------------------
  function categoryParts(item) { return item.invKey ? DB().assets(item.invKey) : []; }
  function findParts(item, re) { return categoryParts(item).filter(p => re.test(short(p))); }
  function addParts(item, parts, copies = 1, max = 63) {
    for (let c = 0; c < copies; c++) for (const p of parts) {
      if (item.parts.length >= max) return;
      item.parts.push(p);
    }
    item.touch();
  }
  function uniqueList(arr) { return Array.from(new Set(arr)); }

  // --------------------------------------------------------------------
  // Item builder
  // --------------------------------------------------------------------
  function manufacturerFull(name, kind) {
    const assets = DB().assets('ManufacturerData');
    const want = name ? lc(name) : (kind === 'relic' ? 'artifact' : kind === 'com' ? 'classmod' : '');
    if (!want) return null;
    return assets.find(a => lc(short(a)) === want) || null;
  }

  function buildItem(entry, opts = {}) {
    const d = DATA();
    const invKey = BL3.items.invKeyFor(entry.b);
    const invIdx = d.balInvData[lc(entry.b)];
    if (!invKey || invIdx === undefined) throw new Error('Cannot build ' + entry.n + ' (missing data)');
    const invdata = DB().assets('InventoryData')[invIdx];
    const all = DB().assets(invKey).map(partInfo);
    const toks = uniqueTokens(entry.b).map(lc);
    const rarity = entry.r || 5;
    let manuName = entry.m || '';
    const element = opts.element || null;
    const kind = entry.k;

    const chosen = [];
    const add = (p) => { if (p && !chosen.includes(p)) chosen.push(p); };

    // 1) parts named after the item itself (legendary barrels, materials, abilities...)
    const uniq = toks.length ? all.filter(p => toks.some(t => t.length >= 4 && p.low.includes(t))) : [];
    uniq.forEach(p => add(p));
    if (kind !== 'relic' && kind !== 'com') {
      // the item's own named parts know best (e.g. Shield_Part_Aug_HYP_LGD_Transformer)
      outer: for (const p of uniq) for (const t of p.s.split('_')) if (MANU_WORDS[lc(t)]) { manuName = MANU_WORDS[lc(t)]; break outer; }
    }
    const manu = lc(manuName);
    const manuAbbr = Object.keys(MANU_WORDS).filter(k => lc(MANU_WORDS[k]) === manu);
    const covered = new Set(uniq.map(p => p.slot));

    const matchesManu = (p) => manuAbbr.some(a => p.rest.some(t => lc(t) === a));
    const hasManuWord = (p) => p.rest.some(t => MANU_WORDS[lc(t)]);
    const rarityScore = (p) => {
      // only material / rarity parts encode rarity in their number
      if (p.slot !== 'material' && p.slot !== 'rarity') return 0;
      const n = Number(p.num || 0);
      const words = p.rest.map(lc);
      if (words.includes(Object.keys(RARITY_WORDS)[rarity - 1])) return 3;
      if (n === rarity) return 2;
      return 0;
    };

    // 2) best generic part for each remaining slot
    const bySlot = {};
    for (const p of all) if (p.generic) (bySlot[p.slot] = bySlot[p.slot] || []).push(p);
    if (kind === 'com' || kind === 'relic') covered.add('rarity');
    const skipSlots = new Set(['other', 'element2', 'unique', 'mod', 'skill', 'stats', 'ability', 'character', 'aug', 'tether']);
    for (const slot in bySlot) {
      if (covered.has(slot) || skipSlots.has(slot)) continue;
      let cands = bySlot[slot];
      if (cands.some(hasManuWord)) {
        const m = cands.filter(matchesManu);
        if (!m.length) continue; // slot belongs to other manufacturers only
        cands = m;
      }
      if (slot === 'element') {
        let pick = null;
        if (element) pick = cands.find(p => p.low.includes(element));
        if (!pick) pick = cands.find(p => /normal|none/.test(p.low));
        if (!pick && manu === 'maliwan') pick = cands[0];
        if (pick) add(pick);
        continue;
      }
      cands = cands.slice().sort((a, b) => rarityScore(b) - rarityScore(a) || a.s.length - b.s.length || a.s.localeCompare(b.s));
      add(cands[0]);
    }
    // requested element on weapons w/o generic element slot (secondary element etc.)
    if (element && !chosen.some(p => p.slot === 'element' && p.low.includes(element))) {
      const e = all.find(p => (p.slot === 'element' || p.slot === 'element2') && p.low.includes(element));
      if (e) add(e);
    }

    // 3) class mods & relics need some extra love
    if (kind === 'com') {
      const cls = ['beastmaster', 'gunner', 'operative', 'siren'].find(c => lc(entry.b).includes(c) || lc(entry.n).includes(c === 'beastmaster' ? 'beastmaster' : c));
      if (cls) {
        all.filter(p => p.low === 'classmod_part_character_' + cls).forEach(add);
        const rar = all.filter(p => p.low.startsWith('classmod_part_' + cls + '_rarity_0' + rarity));
        rar.forEach(add);
        all.filter(p => p.low.startsWith('classmod_part_skill_' + cls)).slice(0, 3).forEach(add);
      }
      all.filter(p => /stat_primary_.*damage$/i.test(p.s)).slice(0, 1).forEach(add);
      all.filter(p => /stat_secondary_.*damage$/i.test(p.s)).slice(0, 1).forEach(add);
    }
    if (kind === 'relic') {
      all.filter(p => p.low === 'artifact_part_rarity_' + Object.keys(RARITY_WORDS)[rarity - 1]).forEach(add);
      if (!chosen.some(p => p.slot === 'stats')) all.filter(p => /^Artifact_Part_Stats_(FireRate|MaxHealth)$/.test(p.s)).forEach(add);
    }

    // 4) part rules: add dependencies, drop generic parts excluded by others
    const rules = d.partRules;
    const shortSet = () => new Set(chosen.map(p => p.s));
    // dependencies are "needs any one of" lists
    for (const p of chosen.slice()) {
      const r = rules[p.s];
      if (!r || !r[0].length) continue;
      const have = shortSet();
      if (r[0].some(dep => have.has(dep))) continue;
      const dp = all.find(x => x.s === r[0][0]);
      if (dp) add(dp);
    }
    const uniqSet = new Set(uniq.map(p => p.s));
    const excluded = new Set();
    for (const p of chosen) { const r = rules[p.s]; if (r) r[1].forEach(x => excluded.add(x)); }
    const finalParts = chosen.filter(p => uniqSet.has(p.s) || !excluded.has(p.s)).slice(0, 63);

    // 5) assemble serial
    let manuFull = manufacturerFull(manuName, kind);
    if (!manuFull) {
      // guess from part names (e.g. shields: Shield_Part_Body_03_Hyperion)
      for (const p of finalParts) for (const t of p.rest) if (MANU_WORDS[lc(t)]) { manuFull = manufacturerFull(MANU_WORDS[lc(t)]); if (manuFull) break; }
    }
    if (!manuFull) manuFull = manufacturerFull(kind === 'relic' ? 'Artifact' : kind === 'com' ? 'ClassMod' : 'Hyperion');

    const it = Object.create(BL3.Item.prototype);
    Object.assign(it, {
      serialVersion: 4, seed: 0, version: DB().maxVersion, canParse: true, canParseParts: true,
      balance: entry.b, invdata, manufacturer: manuFull, level: opts.level || C().max_level,
      invKey, parts: finalParts.map(p => p.full), generics: [], additional: [], numCustoms: 0, rerolled: 0, dirty: true,
    });
    const real = new BL3.Item(it.serialize());
    real.touch();
    return real;
  }

  // --------------------------------------------------------------------
  // OP / MODDED / INFINITE AMMO
  // --------------------------------------------------------------------
  function bestAnointFor(item, classToken) {
    if (item.kind === 'weapon') {
      const byClass = { Operative: 'GPart_CloneSwap_WeaponDamage', Siren: 'GPart_Siren_Cast_WeaponDamage', Gunner: 'GPart_All_SkillEnd_WeaponDamage', Beastmaster: 'GPart_All_SkillEnd_WeaponDamage' };
      return byClass[classToken] || 'GPart_EG_Generic_ConsecutiveHitsDmgStack';
    }
    if (item.kind === 'shield') return 'GPart_All_SkillEnd_DamageReduction';
    if (item.kind === 'grenade') return 'GPart_All_GrenadeDamage';
    return null;
  }

  const WEAPON_MODDED_ANOINTS = {
    common: ['GPart_All_SkillEnd_WeaponDamage', 'GPart_EG_Generic_ConsecutiveHitsDmgStack', 'GPart_All_WeaponDamage',
      'GPart_All_UniqueEnemyDamage', 'GPart_All_SkillEnd_CritDamage', 'GPart_All_SkillEnd_FireRateReload',
      'GPart_All_SkillEnd_LifeSteal', 'GPart_EG_Generic_KillStackReloadDamage', 'GPart_All_SkillEnd_SplashDamage',
      'GPart_All_SkillEnd_EleChanceDamage', 'GPart_EG_WhileSliding_Damage', 'GPart_EG_WhileAirborn_Damage',
      'GPart_All_HighHealthBreaker', 'GPart_EG_Generic_LowHealthExecutor'],
    Operative: ['GPart_CloneSwap_WeaponDamage', 'GPart_Operative_DroneActiveBonusDamage', 'GPart_Operative_CloneActive_AmmoRegen'],
    Siren: ['GPart_Siren_Cast_WeaponDamage', 'GPart_Siren_Slam_WeaponDamage', 'GPart_Siren_SkillEnd_AttunedSkillDamage'],
    Gunner: ['GPart_Gunner_NoAmmoConsumption', 'GPart_Gunner_SplashDamageIncrease', 'GPart_Gunner_NextMagFirerateCrit'],
    Beastmaster: ['GPart_Beast_RakkCrit', 'GPart_Beast_AttackCmd_Lifesteal', 'GPart_Beast_RakkCharge'],
  };
  const SHIELD_MODDED_ANOINTS = ['GPart_All_SkillEnd_DamageReduction', 'GPart_All_SkillStart_OverchargeShield', 'GPart_All_SkillEnd_HealthRegen',
    'GPart_All_SlideRegenShields', 'GPart_All_ShieldBreakAmp', 'GPart_All_SkillEnd_MoveSpeed', 'GPart_All_SkillEnd_CooldownRate',
    'GPart_Gunner_ShieldHealthMax', 'GPart_Operative_BarrierDeploy_ShieldRecharge', 'GPart_All_SkillEnd_MeleeDamage', 'GPart_All_ShockFeedback'];
  const GRENADE_MODDED_ANOINTS = ['GPart_All_GrenadeDamage', 'GPart_EG_GrenadeThrow_GlobalDamage', 'GPart_All_SkillEnd_AddGrenade', 'GPart_Gunner_IBGrenadeChance'];

  function upgradeRarityPart(item) {
    // relics / COMs: swap rarity part for legendary
    let changed = false;
    item.parts = item.parts.map(p => {
      const s = short(p);
      let m = /^(Artifact_Part_Rarity_)(\w+)$/.exec(s);
      if (m && m[2] !== 'Legendary') { const f = DB().assets(item.invKey).find(a => short(a) === m[1] + 'Legendary'); if (f) { changed = true; return f; } }
      m = /^(ClassMod_Part_\w+_Rarity_)0\d_\w+$/.exec(s);
      if (m) { const f = DB().assets(item.invKey).find(a => short(a).startsWith(m[1] + '05')); if (f && f !== p) { changed = true; return f; } }
      return p;
    });
    if (changed) item.touch();
  }

  /** OP = max level, Mayhem 10, best anointment for your class. Still looks legit. */
  function makeOP(item, ctx = {}) {
    if (!item || !item.canParse) return false;
    item.level = ctx.level || C().max_level;
    item.touch();
    if (!item.canParseParts) return true;
    if (canMayhem(item)) setMayhem(item, 10);
    const a = bestAnointFor(item, ctx.classToken);
    if (a && anointPoolFor(item).includes(a)) setAnoint(item, a);
    if (item.kind === 'relic' || item.kind === 'com') {
      upgradeRarityPart(item);
      const stats = item.parts.filter(p => /_Stat(s)?_|ExtraStat|Stat_Primary|Stat_Secondary/i.test(short(p)));
      addParts(item, uniqueList(stats), 1);
    }
    return true;
  }

  /** MODDED = stupid overpowered. Stacks parts and anointments way past what the game drops. */
  function makeModded(item, ctx = {}) {
    if (!item || !item.canParseParts) { if (item && item.canParse) { item.level = C().max_level; item.touch(); } return false; }
    const power = Math.max(1, Math.min(5, ctx.power || 3));
    makeOP(item, ctx);
    const kind = item.kind;
    if (kind === 'weapon') {
      // anointments: mayhem 10 + up to 14 damage anointments
      const pool = new Set(anointPoolFor(item));
      const list = (WEAPON_MODDED_ANOINTS[ctx.classToken] || []).concat(WEAPON_MODDED_ANOINTS.common).filter(g => pool.has(g));
      addGenerics(item, list, 15);
      // damage parts: stack the barrel + named (legendary) parts
      const core = item.parts.filter(p => /_Barrel|_Material|_Mat_|Unique|_Mag_/i.test(short(p)));
      addParts(item, uniqueList(core), power);
      // every element at once
      const eles = ELEMENTS.map(e => findParts(item, new RegExp('(Ele|Elem|Element)\\w*' + e, 'i'))[0]).filter(Boolean);
      addParts(item, eles.filter(e => !item.parts.includes(e)), 1);
    } else if (kind === 'shield') {
      addGenerics(item, SHIELD_MODDED_ANOINTS.filter(g => anointPoolFor(item).includes(g)), 15);
      const lgd = findParts(item, /Aug_.*LGD|LGD_.*Aug|_Aug_(Adaptive|Brimming|FortifyCharge|Healthy|Resistance|Spike|Vagabond|Absorb|Amp|Roid|Capacity|RechargeRate|Nova)/i);
      addParts(item, uniqueList(lgd).filter(p => !item.parts.includes(p)).slice(0, 8 + power * 4), 1);
      const sides = findParts(item, /(LeftSide|RightSide)_\d+_(Capacity|Rate|Power)/i);
      addParts(item, sides, power);
    } else if (kind === 'grenade') {
      addGenerics(item, GRENADE_MODDED_ANOINTS.filter(g => anointPoolFor(item).includes(g)), 15);
      const behave = findParts(item, /GM_Part_Behavior_\d+_(Mini_MIRV|MIRV|Singularity|Link|Sticky|Large|ElementalDamage|Generator|Spring)/i);
      addParts(item, behave.filter(p => !item.parts.includes(p)), 1);
      const augs = findParts(item, /Part_GM_(Aug|Material)_/i);
      addParts(item, augs.filter(p => !item.parts.includes(p)).slice(0, 6 + power * 4), 1);
      const eles = findParts(item, /GM_Part_Element_\d+_(Fire|Shock|Corrosive|Cryo|Radiation)/i);
      addParts(item, eles.filter(p => !item.parts.includes(p)), 1);
    } else if (kind === 'relic') {
      const stats = findParts(item, /^Artifact_Part_Stats_(FireDamage|ShockDamage|CorrosiveDamage|CryoDamage|RadiationDamage|FireRate|MagazineSize|ReloadSpeed|Accuracy|MaxHealth|MaxShieldCapacity|HealthRegen|Movespeed|ShieldRechargeRate|AreaDamage|ActionSkillCooldown|MeleeDamage|Hasty|DeadEye|HollowPoint|Breaching)$/);
      addParts(item, stats, power);
      const abil = findParts(item, /^Artifact_Part_Ability_(VictoryRush|Deathless|MoxxisEndowment|WhiteElephant|Lunacy|Vengeance|Salvo|LoadedDice|HolyGrail2|ElementalOrigin|BloodFrenzy)$/);
      addParts(item, abil.filter(p => !item.parts.includes(p)), 1);
    } else if (kind === 'com') {
      const cls = ['Beastmaster', 'Gunner', 'Operative', 'Siren'].find(c => item.parts.some(p => lc(short(p)).includes(lc(c))));
      const skills = cls ? findParts(item, new RegExp('^ClassMod_Part_Skill_' + cls + '_', 'i')) : [];
      addParts(item, skills.filter(p => !item.parts.includes(p)).slice(0, 20), 1);
      addParts(item, item.parts.filter(p => /ClassMod_Part_Skill_/i.test(short(p))).slice(0, 8), power - 1);
      const dmg = findParts(item, /^ClassMod_Part_Stat_(Primary|Secondary)_(WeaponDamage|CritDamage|GunDamage|FireRate|ReloadSpeed|MagazineSize|ActionSkillCooldownRate|HealthMax|ShieldCapacity)$/i);
      addParts(item, dmg, power);
    }
    if (item.parts.length > 63) item.parts.length = 63;
    item.touch();
    return true;
  }

  /** Item part of the infinite-ammo kit: ammo regen anointments + huge mags. */
  function makeAmmoKit(item, ctx = {}) {
    if (!item || !item.canParseParts) return false;
    if (item.kind === 'weapon') {
      const pool = new Set(anointPoolFor(item));
      const list = ['GPart_Gunner_NoAmmoConsumption', 'GPart_Gunner_AutoBear_AmmoRegen', 'GPart_Operative_CloneActive_AmmoRegen', 'GPart_Operative_CloneSwapInstaReload', 'GPart_EG_Generic_KillStackReloadDamage']
        .filter(g => pool.has(g));
      // put the class-specific one first
      list.sort((a, b) => (b.includes(ctx.classToken === 'Operative' ? 'Operative' : ctx.classToken || '#') ? 1 : 0) - (a.includes(ctx.classToken === 'Operative' ? 'Operative' : ctx.classToken || '#') ? 1 : 0));
      addGenerics(item, list, 15);
      const mags = item.parts.filter(p => /_Mag_?/i.test(short(p)));
      addParts(item, uniqueList(mags), 4);
      const inf = findParts(item, /Infiniti/i);
      addParts(item, inf.filter(p => !item.parts.includes(p)), 1);
      return true;
    }
    if (item.kind === 'grenade') { addGenerics(item, ['GPart_All_SkillEnd_AddGrenade', 'GPart_Gunner_IBGrenadeChance'], 15); return true; }
    if (item.kind === 'com') {
      const g = findParts(item, /Stat_(Primary|Secondary)_GrenadeAmmo/i);
      addParts(item, g, 4);
      const m = findParts(item, /Stat_(Primary|Secondary)_MagazineSize/i);
      addParts(item, m, 2);
      return true;
    }
    if (item.kind === 'relic') {
      addParts(item, findParts(item, /^Artifact_Part_Stats_(MagazineSize|Bandoleer|Loaded)$/), 3);
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------
  // GOD MODE (character)
  // --------------------------------------------------------------------
  const GOD_DEFAULTS = { level: true, money: true, sdus: true, ammo: true, slots: true, mayhem: true, tvhm: true, guardian: true, guardianTokens: 200, skillPoints: true, vehicles: true, opGear: false };
  function godMode(ed, opts = {}) {
    const o = Object.assign({}, GOD_DEFAULTS, opts);
    const log = [];
    if (ed instanceof BL3.ProfileEditor) {
      ed.keyTypes.forEach(k => ed.setKeys(k.cat, 999));
      ed.maxSdus();
      if (o.guardian) ed.setGuardianRewards(o.guardianTokens);
      ed.unlockCosmetics();
      log.push('999 of every key', 'Max bank & lost loot SDUs', 'Guardian Rank rewards x' + o.guardianTokens, 'Unlocked all cosmetics');
      if (o.opGear) { const n = allItems(ed, it => makeOP(it, {})); log.push('OP\'d ' + n + ' bank items'); }
      return log;
    }
    if (o.level) { ed.level = C().max_level; log.push('Level ' + C().max_level); }
    if (o.skillPoints) { const want = Math.max(ed.skillPoints, 150 - ed.spentPoints); ed.skillPoints = want; log.push(want + ' skill points'); }
    if (o.money) { ed.money = BL3.LIMITS.MAX_MONEY; ed.eridium = BL3.LIMITS.MAX_ERIDIUM; log.push('Max money & eridium'); }
    if (o.sdus) { ed.maxSdus(); log.push('All SDUs maxed'); }
    if (o.ammo) { ed.maxAmmo(); log.push('All ammo full'); }
    if (o.slots) { ed.unlockAllSlots(); log.push('All gear slots + Eridian tools unlocked'); }
    if (o.tvhm && ed.playthroughs < 1) { ed.playthroughs = 1; log.push('True Vault Hunter Mode unlocked'); }
    if (o.mayhem) { ed.setMayhemAll(10); log.push('Mayhem 10 on every playthrough'); }
    if (o.guardian) { ed.setGuardianRewards(o.guardianTokens); log.push('Guardian Rank: ' + o.guardianTokens + ' tokens in every reward'); }
    if (o.vehicles) { ed.unlockVehicles(); log.push('All vehicles, parts & skins'); }
    if (o.opGear) { const n = allItems(ed, it => makeOP(it, { classToken: ed.classToken })); log.push('OP\'d ' + n + ' items'); }
    return log;
  }

  function infiniteAmmo(ed, opts = {}) {
    const log = [];
    const ctx = { classToken: ed.classToken };
    if (ed.maxAmmo) { ed.maxSdus(); ed.maxAmmo(); log.push('Max ammo SDUs + full ammo'); }
    if (opts.grenades !== false && ed.maxAmmo) log.push('Max grenade SDU');
    const n = allItems(ed, it => (opts.grenadesOnly ? (it.kind === 'grenade' || it.kind === 'com') : true) && makeAmmoKit(it, ctx));
    log.push('Ammo-regen kit applied to ' + n + ' items (no-ammo / ammo-regen anointments, stacked mags, Infiniti parts)');
    return log;
  }

  function allItems(ed, fn) {
    let n = 0;
    for (const e of ed.items) if (e.item && fn(e.item)) n++;
    return n;
  }

  // --------------------------------------------------------------------
  // Catalog search
  // --------------------------------------------------------------------
  const TYPE_WORDS = {
    pistol: 'Pistol', pistols: 'Pistol', handgun: 'Pistol', smg: 'SMG', smgs: 'SMG', ar: 'Assault Rifle', rifle: 'Assault Rifle', 'assault': 'Assault Rifle',
    shotgun: 'Shotgun', shotguns: 'Shotgun', sniper: 'Sniper', snipers: 'Sniper', launcher: 'Heavy', heavy: 'Heavy', rocket: 'Heavy', rpg: 'Heavy',
  };
  const KIND_WORDS = {
    gun: 'weapon', guns: 'weapon', weapon: 'weapon', weapons: 'weapon', shield: 'shield', shields: 'shield',
    grenade: 'grenade', grenades: 'grenade', nade: 'grenade', nades: 'grenade', relic: 'relic', relics: 'relic', artifact: 'relic', artifacts: 'relic',
    com: 'com', coms: 'com', classmod: 'com', classmods: 'com', 'class mod': 'com',
  };

  function norm(s) { return lc(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  function searchCatalog(query, filters = {}) {
    const cat = DATA().catalog;
    const q = norm(query);
    const words = q.split(' ').filter(Boolean);
    const scored = [];
    for (const c of cat) {
      if (filters.kind && c.k !== filters.kind) continue;
      if (filters.type && c.t !== filters.type) continue;
      if (filters.manu && lc(c.m) !== lc(filters.manu)) continue;
      if (filters.rarity && c.r !== filters.rarity) continue;
      const n = norm(c.n);
      let score = 0;
      if (q && n === q) score += 100;
      else if (q && n.startsWith(q)) score += 60;
      else if (q && n.includes(q)) score += 40;
      else if (q && n.replace(/ /g, '').includes(q.replace(/ /g, ''))) score += 35;
      for (const w of words) if (w.length > 1 && n.split(' ').includes(w)) score += 10; else if (w.length > 2 && n.includes(w)) score += 4;
      if (!q) score = 1;
      if (score > 0) scored.push({ c, score: score + c.r });
    }
    scored.sort((a, b) => b.score - a.score || a.c.n.localeCompare(b.c.n));
    return scored.map(s => s.c);
  }

  // --------------------------------------------------------------------
  // Lazy text commands
  // --------------------------------------------------------------------
  const HELP = [
    'god mode  /  god',
    'infinite ammo  /  infinite grenades',
    'op all  /  modded all',
    'level 72  /  money 1000000  /  eridium 50000  /  mayhem 10  /  skill points 100',
    'max sdu  /  max ammo  /  unlock slots  /  unlock vehicles  /  tvhm',
    'modded fingerbiter',
    '3x op legendary shock jakobs shotgun',
    'modded relic  /  op shield  /  modded grenade  /  modded com',
    'random legendary  /  5x random modded weapon',
    'BL3(....)   ← paste item codes (any amount)',
  ];

  function parseCommands(text) {
    const out = [];
    const codes = String(text).match(/bl3\([A-Za-z0-9+/=\s]+\)/gi) || [];
    for (const c of codes) out.push({ type: 'code', code: c.replace(/\s+/g, '') });
    const rest = String(text).replace(/bl3\([A-Za-z0-9+/=\s]+\)/gi, ' ');
    for (let line of rest.split(/[\n;]+| and |,/i)) {
      line = norm(line);
      if (!line) continue;
      let m;
      if (/^(god|god mode|godmode|make me (a )?god|walk among)/.test(line)) { out.push({ type: 'god' }); continue; }
      if (/infinite (ammo|bullets)|inf ammo|unlimited ammo/.test(line)) { out.push({ type: 'infammo' }); continue; }
      if (/infinite (grenade|nade)s?|unlimited (grenade|nade)s?/.test(line)) { out.push({ type: 'infnades' }); continue; }
      if ((m = /^(op|modded|god) (all|everything|inventory|bank)/.exec(line))) { out.push({ type: 'all', mode: m[1] === 'god' ? 'modded' : m[1] }); continue; }
      if ((m = /^(?:set )?level (\d+)/.exec(line))) { out.push({ type: 'level', value: +m[1] }); continue; }
      if ((m = /^(?:set )?(money|cash|eridium)(?: to)? (\d+|max)/.exec(line))) { out.push({ type: m[1] === 'eridium' ? 'eridium' : 'money', value: m[2] === 'max' ? 2000000000 : +m[2] }); continue; }
      if ((m = /^(?:set )?mayhem(?: level)? (\d+)/.exec(line))) { out.push({ type: 'mayhem', value: +m[1] }); continue; }
      if ((m = /^(?:set )?(?:skill )?points? (\d+)|^(\d+) skill points/.exec(line))) { out.push({ type: 'skillpoints', value: +(m[1] || m[2]) }); continue; }
      if ((m = /^(?:golden )?keys? (\d+)|^(\d+) (golden )?keys/.exec(line))) { out.push({ type: 'keys', value: +(m[1] || m[2]) }); continue; }
      if (/^max sdus?|^sdus?/.test(line)) { out.push({ type: 'sdu' }); continue; }
      if (/^max ammo|^full ammo/.test(line)) { out.push({ type: 'ammo' }); continue; }
      if (/unlock (all )?slots?/.test(line)) { out.push({ type: 'slots' }); continue; }
      if (/unlock (all )?vehicles?|vehicles/.test(line)) { out.push({ type: 'vehicles' }); continue; }
      if (/^tvhm|true vault hunter/.test(line)) { out.push({ type: 'tvhm' }); continue; }
      if (/^unlock (all )?cosmetics|^cosmetics/.test(line)) { out.push({ type: 'cosmetics' }); continue; }
      if (/^help$|^\?$/.test(line)) { out.push({ type: 'help' }); continue; }
      out.push(parseItemRequest(line));
    }
    return out;
  }

  function parseItemRequest(line) {
    const req = { type: 'item', count: 1, mode: 'op', filters: {}, query: '', random: false, raw: line };
    let words = line.split(' ');
    const keep = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      let m;
      if ((m = /^(\d+)x$|^x(\d+)$/.exec(w))) { req.count = Math.min(50, +(m[1] || m[2])); continue; }
      if (/^\d+$/.test(w) && i === 0) { req.count = Math.min(50, +w); continue; }
      if (w === 'modded' || w === 'mod' || w === 'insane' || w === 'stupid') { req.mode = 'modded'; continue; }
      if (w === 'op' || w === 'overpowered' || w === 'godroll' || w === 'god') { if (req.mode !== 'modded') req.mode = 'op'; continue; }
      if (w === 'normal' || w === 'plain' || w === 'legit') { req.mode = 'normal'; continue; }
      if (w === 'random' || w === 'any') { req.random = true; continue; }
      if (['give', 'me', 'a', 'an', 'some', 'make', 'create', 'add', 'spawn', 'the', 'please', 'of', 'with'].includes(w)) continue;
      if ((m = /^(?:lvl|level)(\d+)$/.exec(w))) { req.level = +m[1]; continue; }
      if ((w === 'lvl' || w === 'level') && /^\d+$/.test(words[i + 1] || '')) { req.level = +words[++i]; continue; }
      if (w === 'class' && words[i + 1] === 'mod') { req.filters.kind = 'com'; i++; continue; }
      if (w === 'assault' && words[i + 1] === 'rifle') { req.filters.kind = 'weapon'; req.filters.type = 'Assault Rifle'; i++; continue; }
      if (w === 'very' && words[i + 1] === 'rare') { req.filters.rarity = 4; i++; continue; }
      if (KIND_WORDS[w]) { req.filters.kind = KIND_WORDS[w]; continue; }
      if (TYPE_WORDS[w]) { req.filters.kind = 'weapon'; req.filters.type = TYPE_WORDS[w]; continue; }
      if (MANU_WORDS[w] && w.length > 3) { req.filters.manu = MANU_WORDS[w]; continue; }
      const el = ELEMENT_ALIASES[w] || (ELEMENTS.includes(w) ? w : null);
      if (el) { req.element = el; continue; }
      if (RARITY_WORDS[w]) { req.filters.rarity = RARITY_WORDS[w]; continue; }
      if (w === 'purple') { req.filters.rarity = 4; continue; }
      if (w === 'blue') { req.filters.rarity = 3; continue; }
      if (w === 'green') { req.filters.rarity = 2; continue; }
      if (w === 'white') { req.filters.rarity = 1; continue; }
      if (w === 'orange') { req.filters.rarity = 5; continue; }
      keep.push(w);
    }
    req.query = keep.join(' ');
    if (!req.query && !req.filters.rarity) req.filters.rarity = 5; // lazy default: legendary
    return req;
  }

  /** Execute parsed commands against an editor. Returns a log of strings. */
  function runCommands(ed, text, ctxOpts = {}) {
    const cmds = parseCommands(text);
    const log = [];
    const isProfile = ed instanceof BL3.ProfileEditor;
    const ctx = { classToken: isProfile ? '' : ed.classToken, power: ctxOpts.power || 3 };
    const needSave = (what) => { if (isProfile) { log.push('⚠ "' + what + '" only works on a character save, not the profile.'); return false; } return true; };
    for (const c of cmds) {
      try {
        switch (c.type) {
          case 'help': log.push('Try: ' + HELP.join('  •  ')); break;
          case 'god': godMode(ed).forEach(l => log.push('⚡ ' + l)); break;
          case 'infammo': if (needSave('infinite ammo')) infiniteAmmo(ed).forEach(l => log.push('∞ ' + l)); break;
          case 'infnades': if (needSave('infinite grenades')) { ed.maxSdus(); ed.maxAmmo(); const n = allItems(ed, it => (it.kind === 'grenade' || it.kind === 'com') && makeAmmoKit(it, ctx)); log.push('∞ Max grenade capacity, grenade-regen kit on ' + n + ' items'); } break;
          case 'all': { const fn = c.mode === 'modded' ? makeModded : makeOP; const n = allItems(ed, it => fn(it, ctx)); log.push((c.mode === 'modded' ? '☢ MODDED ' : '🔥 OP ') + n + ' items'); break; }
          case 'level': if (needSave('level')) { ed.level = c.value; log.push('Level → ' + ed.level); } break;
          case 'money': if (needSave('money')) { ed.money = c.value; log.push('Money → $' + ed.money.toLocaleString()); } break;
          case 'eridium': if (needSave('eridium')) { ed.eridium = c.value; log.push('Eridium → ' + ed.eridium.toLocaleString()); } break;
          case 'mayhem': if (needSave('mayhem')) { ed.setMayhemAll(c.value); log.push('Mayhem → ' + Math.min(10, c.value)); } break;
          case 'skillpoints': if (needSave('skill points')) { ed.skillPoints = c.value; log.push('Skill points → ' + c.value); } break;
          case 'keys': if (isProfile) { ed.setKeys(C().goldenkey_category, c.value); log.push('Golden keys → ' + c.value); } else log.push('⚠ Golden keys live in the profile (profile.sav)'); break;
          case 'sdu': ed.maxSdus(); log.push('SDUs maxed'); break;
          case 'ammo': if (needSave('ammo')) { ed.maxAmmo(); log.push('Ammo full'); } break;
          case 'slots': if (needSave('slots')) { ed.unlockAllSlots(); log.push('All slots unlocked'); } break;
          case 'vehicles': if (needSave('vehicles')) { ed.unlockVehicles(); log.push('All vehicles unlocked'); } break;
          case 'tvhm': if (needSave('TVHM')) { ed.playthroughs = Math.max(1, ed.playthroughs); log.push('TVHM unlocked'); } break;
          case 'cosmetics': if (isProfile) { ed.unlockCosmetics(); log.push('All cosmetics unlocked'); } else log.push('⚠ Cosmetics live in the profile (profile.sav)'); break;
          case 'code': {
            const it = BL3.Item.fromCode(c.code);
            ed.addItem(it);
            log.push('➕ Added ' + it.name + ' (lvl ' + it.level + ')');
            break;
          }
          case 'item': {
            let results = searchCatalog(c.query, c.filters);
            if (c.filters.kind === 'com' && ctx.classToken && !c.query) {
              const mine = results.filter(r => r.n.toLowerCase().includes(ctx.classToken.toLowerCase()));
              if (mine.length) results = mine;
            }
            if (!results.length && c.query) results = searchCatalog('', c.filters).length ? searchCatalog(c.query, {}) : [];
            if (!results.length) { log.push('❓ Couldn\'t find an item for "' + c.raw + '"'); break; }
            for (let i = 0; i < c.count; i++) {
              const pick = (c.random || !c.query) ? results[Math.floor(Math.random() * results.length)] : results[0];
              const it = buildItem(pick, { element: c.element, level: c.level });
              if (c.mode === 'op') makeOP(it, Object.assign({}, ctx, { level: c.level }));
              else if (c.mode === 'modded') makeModded(it, ctx);
              ed.addItem(it, { favorite: true });
              log.push((c.mode === 'modded' ? '☢ ' : c.mode === 'op' ? '🔥 ' : '➕ ') + 'Created ' + (c.mode === 'normal' ? '' : c.mode.toUpperCase() + ' ') + pick.n + (c.element ? ' (' + c.element + ')' : ''));
            }
            break;
          }
        }
      } catch (e) {
        log.push('✖ ' + (c.raw || c.type) + ': ' + e.message);
      }
    }
    return log;
  }

  BL3.forge = {
    buildItem, makeOP, makeModded, makeAmmoKit, godMode, infiniteAmmo, allItems, searchCatalog,
    parseCommands, runCommands, anointName, anointPoolFor, setMayhem, setAnoint, canMayhem, partInfo,
    HELP, ELEMENTS, GOD_DEFAULTS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
