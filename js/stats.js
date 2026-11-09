/*
 * VAULT FORGE - stat "vibe check" + plain-English part descriptions.
 *
 * BL3 doesn't store weapon stats in the save: the game works them out from
 * the parts. This estimates them from part types, manufacturer, rarity,
 * level, Mayhem and anointments, using well-known BL3 traits. They are
 * relative ratings (0-10), not exact in-game numbers.
 */
(function (root) {
  'use strict';
  const BL3 = root.BL3;
  const DATA = () => root.BL3_DATA;
  const short = (p) => (p || '').split('.').pop();
  const lc = (s) => (s || '').toLowerCase();
  const words = (s) => s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();

  // ------------------------------------------------------------------ manufacturers & types
  const MANU = {
    jakobs: { name: 'Jakobs', trait: 'Shoots as fast as you can pull the trigger. Big damage, crits ricochet to nearby enemies.', mod: { dmg: 2, rate: -1, acc: 1, mag: -1 } },
    vladof: { name: 'Vladof', trait: 'Insane fire rate and big mags. Often has an underbarrel attachment.', mod: { rate: 3, mag: 2, dmg: -1, stab: -1 } },
    maliwan: { name: 'Maliwan', trait: 'Always elemental. Some need a short charge-up. Can switch element modes.', mod: { dmg: 1, rate: -1 } },
    torgue: { name: 'Torgue', trait: 'Everything explodes. Gyrojet or sticky rounds. Slow, but heavy hitting.', mod: { dmg: 3, rate: -2, acc: -2 } },
    dahl: { name: 'Dahl', trait: 'Low recoil. Switches to burst fire when you aim.', mod: { stab: 2, acc: 1 } },
    hyperion: { name: 'Hyperion', trait: 'Gets MORE accurate the longer you shoot. Pops a shield when you aim.', mod: { acc: 2, stab: 1 } },
    tediore: { name: 'Tediore', trait: 'Throw it to reload: the gun blows up like a grenade and you get a fresh one.', mod: { reload: 3, mag: -1 } },
    atlas: { name: 'Atlas', trait: 'Smart gun. Tag enemies with a tracker and the bullets curve into them.', mod: { acc: 2 } },
    cov: { name: 'Children of the Vault', trait: 'No reloading at all. It overheats instead. Fire rate ramps up as you shoot.', mod: { mag: 4, rate: 2, stab: -2, acc: -1 } },
  };
  const MANU_ALIASES = { jak: 'jakobs', vla: 'vladof', mal: 'maliwan', tor: 'torgue', dal: 'dahl', dahl: 'dahl', hyp: 'hyperion', ted: 'tediore', atl: 'atlas', cov: 'cov', childrenofthevault: 'cov' };

  const TYPES = {
    'Pistol': { dmg: 5, rate: 6, acc: 6, stab: 6, mag: 4, reload: 7, hand: 8, trait: 'Pistol: quick to swap and aim.' },
    'SMG': { dmg: 4, rate: 8, acc: 5, stab: 6, mag: 6, reload: 6, hand: 8, trait: 'SMG: fast and great up close.' },
    'Assault Rifle': { dmg: 5, rate: 7, acc: 6, stab: 5, mag: 6, reload: 5, hand: 6, trait: 'Assault rifle: good at any range.' },
    'Shotgun': { dmg: 7, rate: 4, acc: 3, stab: 4, mag: 3, reload: 5, hand: 5, trait: 'Shotgun: fires a spread of pellets, brutal up close.' },
    'Sniper': { dmg: 9, rate: 2, acc: 9, stab: 4, mag: 2, reload: 4, hand: 3, trait: 'Sniper: huge damage per shot, made for crits at long range.' },
    'Heavy': { dmg: 9, rate: 2, acc: 5, stab: 3, mag: 1, reload: 3, hand: 2, trait: 'Launcher: big explosions, small ammo pool.' },
  };
  const TYPE_CODES = { ps: 'Pistol', pistol: 'Pistol', sm: 'SMG', smg: 'SMG', ar: 'Assault Rifle', sg: 'Shotgun', shotgun: 'Shotgun', sr: 'Sniper', hw: 'Heavy' };

  function manuOf(item) {
    const m = lc(short(item.manufacturer));
    if (MANU[m]) return m;
    for (const t of lc(item.invKey || '').split('_')) if (MANU_ALIASES[t]) return MANU_ALIASES[t];
    for (const t of lc(short(item.balance)).split('_')) if (MANU_ALIASES[t]) return MANU_ALIASES[t];
    return null;
  }
  function typeOf(item) {
    for (const t of lc(item.invKey || '').replace('bpinvpart_', '').split('_')) if (TYPE_CODES[t]) return TYPE_CODES[t];
    for (const t of lc(short(item.invdata)).split('_')) if (TYPE_CODES[t]) return TYPE_CODES[t];
    return 'Assault Rifle';
  }

  // ------------------------------------------------------------------ elements
  const ELEMENTS = {
    fire: '🔥 Fire: burns over time. Wrecks flesh (red health bars).',
    incendiary: '🔥 Fire: burns over time. Wrecks flesh (red health bars).',
    shock: '⚡ Shock: zaps shields (blue bars) super fast.',
    corrosive: '☣ Corrosive: melts armor (yellow bars).',
    corr: '☣ Corrosive: melts armor (yellow bars).',
    cryo: '❄ Cryo: slows enemies down until they freeze solid.',
    radiation: '☢ Radiation: irradiated enemies explode on death and spread it.',
    rad: '☢ Radiation: irradiated enemies explode on death and spread it.',
    normal: 'No element (plain kinetic damage).',
    none: 'No element (plain kinetic damage).',
  };
  function elementOf(s) {
    for (const t of lc(s).split('_')) if (ELEMENTS[t] && t !== 'normal' && t !== 'none') return t === 'incendiary' ? 'fire' : t === 'corr' ? 'corrosive' : t === 'rad' ? 'radiation' : t;
    return null;
  }

  // ------------------------------------------------------------------ part descriptions
  const SLOT_DESC = {
    barrel: 'Barrel: has the biggest effect on damage, fire rate and bullet spread.',
    body: 'Body: the gun\'s main frame and base stats.',
    grip: 'Grip: affects handling, reload speed and how fast you aim / swap.',
    foregrip: 'Foregrip: less recoil and better accuracy.',
    mag: 'Magazine: sets mag size and reload speed.',
    scope: 'Sight / scope: changes zoom and accuracy when you aim.',
    stock: 'Stock: less recoil and weapon sway, steadier aim.',
    rail: 'Rail: what the sight sits on. Small accuracy / handling tweak.',
    bolt: 'Bolt / action: affects fire rate and how snappy it feels.',
    trigger: 'Trigger: changes how it fires (often a legendary trait).',
    underbarrel: 'Underbarrel: alt-fire attachment (grenade launcher, shotgun, rockets, taser…). Press the alt-fire button.',
    material: 'Material / paint: shows the rarity. Higher rarity = better base stats.',
    element: 'Element part.',
    element2: 'Second element.',
    mode: 'Firing mode part.',
  };
  const OTHER_DESC = [
    [/Tracker/i, 'Atlas tracker: tag an enemy and your bullets home in on it.'],
    [/Launcher/i, 'Launcher module: alt-fire launcher (tracker / grenade).'],
    [/UnderbarrelShield|ShieldMod|_Shield/i, 'Shield module: pops a protective shield when you aim (Hyperion).'],
    [/Auto/i, 'Full-auto conversion: hold the trigger to spray.'],
    [/FiringMode|Burst/i, 'Firing mode: unlocks burst / auto modes.'],
    [/Hammer/i, 'Hammer: the action. Affects fire rate and feel.'],
    [/SlideCap|Slide/i, 'Slide: pistol action. Affects fire rate and reload.'],
    [/Speedloader|MagType/i, 'Mag type: changes mag size and reload speed.'],
    [/IronSight|NoScope/i, 'Iron sights: no zoom, faster aiming.'],
    [/ScopeMount/i, 'Scope mount: where the sight sits.'],
    [/Accessory|_Acc_|Bayonet/i, 'Accessory: bayonet or attachment for bonus melee damage / stats.'],
    [/StockMod|BarrelMod|TypeMod/i, 'Mod: small extra stat bonus for this part.'],
    [/Tail|Engine|Exhaust|Radar|Shoulder/i, 'Launcher module: changes how the rockets fly.'],
    [/Starter/i, 'Starter-gun part (the basic gun you start with).'],
    [/EndGame/i, 'End-game bonus part.'],
  ];
  const SHIELD_AUG = {
    absorb: 'Absorb: chance to soak up bullets and turn them into ammo.',
    adaptive: 'Adaptive: resists whatever element just hit you.',
    amp: 'Amp: your next shot after a full shield hits way harder.',
    brimming: 'Brimming: health regen while your shield is full.',
    capacity: 'Capacity: more shield.',
    fleet: 'Fleet: move faster while your shield is down.',
    fortifycharge: 'Fortify: tougher while recharging.',
    healthy: 'Healthy: more max health.',
    healthcharge: 'Health charge: shield recharge also heals you.',
    knockback: 'Knockback: knocks enemies away when your shield breaks.',
    nova: 'Nova: explodes in an elemental blast when your shield breaks.',
    projected: 'Projected: projects a bubble shield.',
    rechargerate: 'Recharge rate: shield comes back faster.',
    rechargedelay: 'Recharge delay: shield starts recharging sooner.',
    resistance: 'Resistance: take less damage from one element.',
    roid: 'Roid: big melee damage while your shield is down.',
    spike: 'Spike: melee attackers take damage.',
    triggerhappy: 'Trigger Happy: bonus fire rate while your shield is down.',
    vagabond: 'Vagabond: bonus while moving.',
    adrenaline: 'Adrenaline: faster recharge at low shield.',
  };
  const GRENADE_BEHAVIOR = {
    large: 'Large: bigger explosion radius.', sticky: 'Sticky: sticks to enemies.', singularity: 'Singularity: sucks enemies in before exploding.',
    mirv: 'MIRV: splits into a bunch of child grenades.', mini: 'Mini MIRV: drops mini bomblets.', spring: 'Spring: bounces around.',
    link: 'Link: links enemies so damage spreads between them.', elementaldamage: 'Elemental damage: extra elemental damage.',
    generator: 'Generator: drops elemental orbs.', homing: 'Homing: flies at enemies.', rubberized: 'Rubberized: bounces off walls.',
    divider: 'Divider: splits up.', radiusincrease: 'Bigger blast radius.', healthpotion: 'Heals you on impact.',
  };

  function describePart(full, itemKind) {
    const s = short(full);
    const d = DATA();
    const name = d.partNames[s];
    const prefix = d.prefixNames[s];
    const info = BL3.forge.partInfo(full);
    const el = elementOf(s);
    const out = [];

    // gear-specific families first
    if (/^ClassMod_Part_Skill_|^CM_Part_Skill_/i.test(s)) {
      const skill = s.replace(/^(ClassMod|CM)_Part_Skill_(Hib_|BSM_|GUN_|OPE_|SRN_)?(Beastmaster|BeastMaster|Gunner|Operative|Siren)?_?/i, '').replace(/_Raid1$/, '');
      return '+ points to the skill "' + words(skill) + '". Stack copies for more points.';
    }
    if (/Stat_(Primary|Secondary)_|ExtraStat_/i.test(s)) return 'Bonus stat: +' + words(s.split(/Stat_(?:Primary|Secondary)_|ExtraStat_/i).pop()) + '. Stack copies for more.';
    if (/^ClassMod_Part_Mod_|_Unique_/i.test(s) && /ClassMod/i.test(s)) return 'Legendary class mod effect (' + words(s.split('_').slice(-1)[0]) + '). This is what makes the COM special.';
    if (/^ClassMod_Part_.*Rarity/i.test(s)) return 'Rarity of the class mod.';
    if (/^ClassMod_Part_Character_/i.test(s)) return 'Which character can use this class mod.';
    if (/^Artifact_Part_Ability_/i.test(s)) return 'Relic ability: ' + words(s.replace('Artifact_Part_Ability_', '')) + (name ? ' (' + name + ')' : '') + '. This is the relic\'s main effect.';
    if (/^Artifact_Part_Stats?_/i.test(s)) return 'Relic bonus: ' + words(s.replace(/Artifact_Part_Stats?_/, '').replace(/_\d$/, '')) + (prefix ? ' ("' + prefix + '")' : '') + '. Stack copies for more.';
    if (/^Artifact_Part_Rarity_/i.test(s)) return 'Rarity of the relic.';
    if (/Shield/i.test(s) && itemKind === 'shield') {
      if (/LGD/i.test(s)) return 'Legendary shield effect (' + words(s.split('LGD_').pop()) + ').';
      const aug = /Aug_(?:[A-Z]{3}_)?(\w+)$/.exec(s);
      if (aug && SHIELD_AUG[lc(aug[1])]) return 'Shield perk. ' + SHIELD_AUG[lc(aug[1])];
      if (/LeftSide|RightSide/i.test(s)) {
        if (/Capacity/i.test(s)) return 'Shield frame: more capacity.';
        if (/Rate/i.test(s)) return 'Shield frame: faster recharge.';
        if (/Power/i.test(s)) return 'Shield frame: capacity AND recharge boost.';
        return 'Shield frame: no change.';
      }
      if (/Element/i.test(s)) return el ? 'Shield element. ' + ELEMENTS[el] : 'No shield element.';
      if (/Body/i.test(s)) return 'Shield body (manufacturer).';
      if (/Rarity|Material|Mat_/i.test(s)) return 'Shield rarity / look.';
      if (aug) return 'Shield perk: ' + words(aug[1]) + '.';
    }
    if (itemKind === 'grenade' || /^GM_Part|^Part_GM/i.test(s)) {
      const b = /Behavior_\d+_?(\w*)$|Body_\d+_?(\w*)$/.exec(s);
      if (b) { const k = lc((b[1] || b[2] || '').replace(/_/g, '')); for (const key in GRENADE_BEHAVIOR) if (k.startsWith(key)) return 'Grenade behavior. ' + GRENADE_BEHAVIOR[key]; return (b[1] || b[2]) ? 'Grenade behavior: ' + words(b[1] || b[2]) + '.' : 'Grenade behavior: sets how it flies and detonates.'; }
      if (/Element/i.test(s) && !/^Part_GM/i.test(s)) return el ? 'Grenade element. ' + ELEMENTS[el] : 'No element.';
      if (/^Part_GM_/i.test(s)) return 'Legendary grenade effect (' + (name || words(s.split('_').pop())) + ').';
      if (/Manufacturer/i.test(s)) return 'Grenade manufacturer: sets the delivery style.';
      if (/Rarity|Material/i.test(s)) return 'Grenade rarity / look. Higher rarity = more damage.';
    }

    // weapons
    if (el && (info.slot === 'element' || info.slot === 'element2' || /Ele/i.test(s))) out.push(ELEMENTS[el]);
    else if (/Ele|Element/i.test(s) && /normal|none/i.test(s)) out.push(ELEMENTS.normal);
    else if (!info.generic && !info.accessory && ['barrel', 'material', 'trigger', 'underbarrel', 'mag', 'grip', 'stock', 'scope', 'body'].includes(info.slot)) {
      out.push('★ Unique part' + (name ? ' (' + name + ')' : ' (' + words(info.rest.join('_')) + ')') + ': gives this gun its special effect.');
      if (SLOT_DESC[info.slot]) out.push(SLOT_DESC[info.slot]);
    } else if (info.accessory) {
      out.push('Attachment for the ' + info.slot + ': small bonus (damage, accuracy, recoil or handling).');
    } else if (SLOT_DESC[info.slot] && info.slot !== 'other') {
      out.push(SLOT_DESC[info.slot]);
    } else {
      const o = OTHER_DESC.find(([re]) => re.test(s));
      out.push(o ? o[1] : 'Part: ' + words(s.replace(/^Part_[A-Z]{2,3}_[A-Za-z]+_/, '')) + '.');
    }
    if (name && info.generic) out.push('Gives the "' + name + '" name.');
    if (prefix && !el) out.push('Adds the "' + prefix + '" prefix.');
    return out.join(' ');
  }

  // ------------------------------------------------------------------ labels
  const TIERS = {
    dmg: ['tickles', 'does the job', 'hits hard', 'hits hard asf', 'deletes bosses', '☢ one-taps the universe'],
    rate: ['shoots slow as hell', 'takes its sweet time', 'shoots decent', 'shoots fast', 'shoots fast asf', '☢ bullet hose from hell'],
    acc: ['sprays everywhere', 'kinda sprays', 'pretty accurate', 'dead accurate', 'laser beam', '☢ aimbot energy'],
    stab: ['kicks like a mule', 'lots of recoil', 'some recoil', 'barely kicks', 'no recoil', '☢ glued to the crosshair'],
    mag: ['tiny mag', 'small mag', 'normal mag', 'big mag', 'huge mag', '☢ basically bottomless'],
    reload: ['slow reload', 'meh reload', 'reloads fine', 'reloads fast', 'reloads fast asf', '☢ reloads before you blink'],
    hand: ['heavy & clunky', 'a bit sluggish', 'handles fine', 'snappy', 'feels like nothing', '☢ weightless'],
    cap: ['paper thin', 'kinda weak', 'solid', 'tanky', 'tanky asf', '☢ unkillable'],
    rech: ['slow recharge', 'meh recharge', 'recharges fine', 'recharges fast', 'recharges fast asf', '☢ never stays down'],
    gdmg: ['firecracker', 'decent boom', 'big boom', 'huge boom', 'nuke', '☢ ends the map'],
    rad: ['tiny blast', 'small blast', 'normal blast', 'big blast', 'huge blast', '☢ whole-screen blast'],
  };
  function tier(key, v) {
    const t = TIERS[key];
    if (v > 10.5) return t[5];
    if (v >= 8.5) return t[4];
    if (v >= 6.5) return t[3];
    if (v >= 4.5) return t[2];
    if (v >= 2.5) return t[1];
    return t[0];
  }
  const LABELS = { dmg: 'Damage', rate: 'Fire rate', acc: 'Accuracy', stab: 'Recoil control', mag: 'Mag size', reload: 'Reload', hand: 'Handling', cap: 'Shield capacity', rech: 'Recharge', gdmg: 'Damage', rad: 'Blast radius' };
  const ICONS = { dmg: '💥', rate: '⚡', acc: '🎯', stab: '🧱', mag: '📦', reload: '🔄', hand: '🤚', cap: '🛡', rech: '🔋', gdmg: '💥', rad: '💫' };

  // ------------------------------------------------------------------ estimate
  function countBy(arr) { const m = {}; for (const a of arr) m[a] = (m[a] || 0) + 1; return m; }

  function estimate(item) {
    if (!item || !item.canParse) return null;
    const kind = item.kind;
    const level = item.level || 1;
    const mayhem = item.mayhem || 0;
    const rarity = item.rarity || 3;
    const parts = item.parts || [];
    const counts = countBy(parts);
    const extraCopies = (re) => Object.keys(counts).filter(p => re.test(short(p))).reduce((a, p) => a + counts[p] - 1, 0);
    const anoints = (item.anoints || []).map(short);
    const traits = [];
    const lvlAdj = Math.max(-6, (level - 72) * 0.12);
    const s = {};

    if (kind === 'weapon') {
      const type = typeOf(item);
      const base = TYPES[type];
      const m = manuOf(item);
      Object.assign(s, { dmg: base.dmg, rate: base.rate, acc: base.acc, stab: base.stab, mag: base.mag, reload: base.reload, hand: base.hand });
      if (m) { for (const k in MANU[m].mod) s[k] += MANU[m].mod[k]; traits.push('🏭 ' + MANU[m].name + ': ' + MANU[m].trait); }
      traits.push('🔫 ' + base.trait);
      s.dmg += (rarity - 3) * 0.6 + lvlAdj + mayhem * 0.15;
      // parts
      const infos = Object.keys(counts).map(p => BL3.forge.partInfo(p));
      for (const i of infos) {
        if (i.slot === 'stock') s.stab += 1;
        if (i.slot === 'foregrip') { s.stab += 0.5; s.acc += 0.5; }
        if (i.slot === 'scope') s.acc += 0.5;
        if (i.slot === 'bolt') s.rate += 0.5;
        if (i.accessory) { s.acc += 0.2; s.stab += 0.2; }
      }
      const dmgStack = extraCopies(/_Barrel|_Material|_Mat_|Unique|Trigger/i);
      s.dmg += dmgStack * 0.8; s.rate += dmgStack * 0.3;
      s.mag += extraCopies(/_Mag|Magazine/i) * 1;
      s.acc += extraCopies(/Scope|Foregrip/i) * 0.5;
      s.stab += extraCopies(/Stock|Foregrip/i) * 0.6;
      s.reload += extraCopies(/Grip/i) * 0.5;
      const els = Array.from(new Set(parts.map(p => elementOf(short(p))).filter(Boolean)));
      if (els.length) traits.push(els.length > 1 ? '🌈 Multi-element: ' + els.join(' + ') + ' at once' : ELEMENTS[els[0]]);
      s.dmg += Math.max(0, els.length - 1) * 0.4;
      const uniques = infos.filter(i => !i.generic && !i.accessory && ['barrel', 'material', 'trigger', 'underbarrel', 'mag'].includes(i.slot));
      if (uniques.length) traits.push('★ Has legendary/unique parts: special effect active');
      if (infos.some(i => i.slot === 'underbarrel')) traits.push('🔧 Underbarrel alt-fire attachment');
      for (const a of anoints) {
        if (/Damage|Dmg|Executor|Breaker/i.test(a)) s.dmg += 0.5;
        if (/FireRate|Firerate/i.test(a)) s.rate += 0.5;
        if (/Accuracy/i.test(a)) s.acc += 0.5;
        if (/Reload/i.test(a)) s.reload += 0.5;
        if (/AmmoRegen|NoAmmoConsumption/i.test(a)) traits.push('∞ Ammo regen / no-ammo anointment');
      }
      if (parts.length > 22 || anoints.length > 1) traits.unshift('☢ MODDED: stats go way past normal limits');
    } else if (kind === 'shield') {
      s.cap = 4 + (rarity - 3) * 0.8 + lvlAdj; s.rech = 5 + (rarity - 3) * 0.4;
      for (const p in counts) {
        const n = counts[p], sp = short(p);
        if (/Capacity/i.test(sp)) s.cap += 1.2 * n;
        if (/Power/i.test(sp)) { s.cap += 0.8 * n; s.rech += 0.8 * n; }
        if (/Rate|RechargeRate|RechargeDelay/i.test(sp)) s.rech += 1.2 * n;
        if (/LGD/i.test(sp)) s.cap += 0.5 * n;
      }
      const augs = Object.keys(counts).filter(p => /Aug/i.test(short(p)));
      if (augs.length) traits.push('🛡 ' + augs.length + ' shield perk' + (augs.length > 1 ? 's' : ''));
      if (parts.length > 10 || anoints.length > 1) traits.unshift('☢ MODDED: stacked perks');
    } else if (kind === 'grenade') {
      s.gdmg = 5 + (rarity - 3) * 0.7 + lvlAdj + mayhem * 0.15; s.rad = 5;
      for (const p in counts) {
        const n = counts[p], sp = short(p);
        if (/Large|Radius/i.test(sp)) s.rad += 1.5 * n;
        if (/MIRV|Singularity|Link|ElementalDamage|Generator/i.test(sp)) { s.gdmg += 0.7 * n; s.rad += 0.3 * n; }
        if (/^Part_GM_/i.test(sp)) s.gdmg += 0.3 * n;
      }
      for (const a of anoints) if (/Grenade/i.test(a)) s.gdmg += 0.6;
      const els = Array.from(new Set(parts.map(p => elementOf(short(p))).filter(Boolean)));
      if (els.length) traits.push(els.length > 1 ? '🌈 Multi-element: ' + els.join(' + ') : ELEMENTS[els[0]]);
      if (parts.length > 12 || anoints.length > 1) traits.unshift('☢ MODDED: stacked behaviors');
    } else {
      // relics & class mods: list what it gives
      const bonuses = {};
      for (const p in counts) {
        const sp = short(p);
        let label = null;
        if (/Skill_/i.test(sp)) label = '+ ' + words(sp.replace(/^(ClassMod|CM)_Part_Skill_(Hib_|BSM_|GUN_|OPE_|SRN_)?(Beastmaster|BeastMaster|Gunner|Operative|Siren)?_?/i, '').replace(/_Raid1$/, '')) + ' (skill)';
        else if (/Stat_(Primary|Secondary)_|ExtraStat_/i.test(sp)) label = '+ ' + words(sp.split(/Stat_(?:Primary|Secondary)_|ExtraStat_/i).pop());
        else if (/Artifact_Part_Stats?_/i.test(sp)) label = '+ ' + words(sp.replace(/Artifact_Part_Stats?_/, '').replace(/_\d$/, ''));
        else if (/Artifact_Part_Ability_/i.test(sp)) label = '✦ ' + words(sp.replace('Artifact_Part_Ability_', '')) + ' ability';
        else if (/ClassMod_Part_Mod_|ClassMod_Part_\w+_Unique_/i.test(sp)) label = '✦ ' + words(sp.split('_').pop()) + ' legendary effect';
        if (label) bonuses[label] = (bonuses[label] || 0) + counts[p];
      }
      for (const b in bonuses) traits.push(b + (bonuses[b] > 1 ? '  ×' + bonuses[b] + (bonuses[b] >= 3 ? ' (stacked asf)' : '') : ''));
      if (parts.length > 20) traits.unshift('☢ MODDED: stacked bonuses');
    }

    // only modded gear can go past the top of the scale
    const modded = traits.some(t => t.startsWith('☢ MODDED'));
    const bars = Object.keys(s).map(k => {
      const v = Math.max(0, Math.round((modded ? s[k] : Math.min(10, s[k])) * 10) / 10);
      return { key: k, label: LABELS[k], icon: ICONS[k], value: v, text: tier(k, v) };
    });
    const vibe = bars.filter(b => ['rate', 'stab', 'dmg', 'acc', 'cap', 'rech', 'gdmg', 'rad'].includes(b.key)).map(b => b.icon + ' ' + b.text);
    for (const a of anoints) traits.push('✦ ' + BL3.forge.anointName(a));
    return { kind, bars, traits, vibe };
  }

  BL3.stats = { estimate, describePart, tier, MANU };
})(typeof window !== 'undefined' ? window : globalThis);
