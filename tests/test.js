// Run: node tests/test.js
const BL3 = require('./load');
const fs = require('fs');
const assert = require('assert');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

const pcBytes = new Uint8Array(fs.readFileSync(__dirname + '/sample_pc.sav'));
const sample = BL3.file.load(pcBytes);

// Build a fake PS4 file by re-encrypting the sample's payload with the PS4 keys
function makePS4(file) {
  const g = BL3.file.readGvas(pcBytes);
  const enc = BL3.file.encryptPayload(file.plain, BL3.file.KEYS.save.PS4);
  return BL3.file.writeGvas(g.header, enc, g.trailing);
}

const CODES = {
  crader: 'BL3(A/keqg/yMeLAidiwT5/bWQwqG3OuxeEhDH4LZAPWg1a2HG2imaCQ)',
  transformer: 'BL3(AzYihiL46NplGmPm8iw3O1fqwmf9kw==)',
};

console.log('File formats');
t('PC save loads & round-trips byte-identical', () => {
  assert.strictEqual(sample.platform, 'PC');
  assert.strictEqual(sample.kind, 'save');
  assert.ok(BL3.util.bytesEqual(BL3.file.save(sample), pcBytes));
});
t('PS4 save auto-detected & round-trips byte-identical', () => {
  const ps4 = makePS4(sample);
  const f = BL3.file.load(ps4);
  assert.strictEqual(f.platform, 'PS4');
  assert.strictEqual(f.data.preferred_character_name, 'Zane');
  assert.ok(BL3.util.bytesEqual(BL3.file.save(f), ps4));
});
t('Garbage file is rejected with a helpful error', () => {
  assert.throws(() => BL3.file.load(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /GVAS|decrypt/i);
});
t('Platform conversion PS4 -> PC', () => {
  const f = BL3.file.load(makePS4(sample));
  const pc = BL3.file.save(f, 'PC');
  assert.ok(BL3.util.bytesEqual(pc, pcBytes));
});

console.log('Item serials');
t('Known codes decode', () => {
  const a = BL3.Item.fromCode(CODES.crader);
  assert.strictEqual(a.name, "Crader's EM-P5");
  assert.strictEqual(a.parts.length, 15);
  const b = BL3.Item.fromCode(CODES.transformer);
  assert.strictEqual(b.name, 'The Transformer');
  assert.strictEqual(b.kind, 'shield');
});
t('Unchanged item keeps exact code', () => {
  assert.strictEqual(BL3.Item.fromCode(CODES.crader).code(), CODES.crader);
});
t('Edited item re-encodes and re-parses', () => {
  const a = BL3.Item.fromCode(CODES.crader);
  a.level = 72; a.touch();
  const b = BL3.Item.fromCode(a.code());
  assert.strictEqual(b.level, 72);
  assert.deepStrictEqual(b.parts, a.parts);
  assert.deepStrictEqual(b.generics, a.generics);
});
t('Bad code checksum rejected', () => {
  assert.throws(() => BL3.Item.fromCode('BL3(A/keqg/yMeLAidiwT5/bWQwqG3OuxeEhDH4LZAPWg1a2HG2imaCA)'));
});

console.log('Forge');
t('Every catalog item builds, OPs, mods and re-parses', () => {
  const bad = [];
  for (const c of BL3_DATA.catalog) {
    try {
      for (const mode of ['normal', 'op', 'modded']) {
        const it = BL3.forge.buildItem(c, {});
        if (mode === 'op') BL3.forge.makeOP(it, { classToken: 'Operative' });
        if (mode === 'modded') BL3.forge.makeModded(it, { classToken: 'Gunner', power: 5 });
        const back = BL3.Item.fromCode(it.code());
        if (!back.canParseParts) throw new Error('unparseable');
        if (back.parts.length < 2) throw new Error('too few parts');
        if (back.parts.length > 63 || back.generics.length > 15) throw new Error('limits');
        if (back.balance !== c.b) throw new Error('balance mismatch');
        if (mode !== 'normal' && back.level !== 72) throw new Error('level');
      }
    } catch (e) { bad.push(c.n + ': ' + e.message); }
  }
  assert.deepStrictEqual(bad, []);
});
t('OP weapon = lvl72 + Mayhem 10 + 1 anointment', () => {
  const it = BL3.Item.fromCode(CODES.crader);
  BL3.forge.makeOP(it, { classToken: 'Operative' });
  assert.strictEqual(it.level, 72);
  assert.strictEqual(it.mayhem, 10);
  assert.strictEqual(it.anoints.length, 1);
});
t('Modded weapon stacks parts and anointments', () => {
  const it = BL3.Item.fromCode(CODES.crader);
  BL3.forge.makeModded(it, { classToken: 'Operative', power: 3 });
  assert.ok(it.parts.length > 15);
  assert.ok(it.generics.length >= 10);
  assert.strictEqual(BL3.Item.fromCode(it.code()).mayhem, 10);
});
t('Modded shield stacks augments', () => {
  const it = BL3.Item.fromCode(CODES.transformer);
  BL3.forge.makeModded(it, {});
  assert.ok(it.parts.length > 10);
});

console.log('Character editing');
t('God mode, save, reload', () => {
  const ed = BL3.open(pcBytes);
  BL3.forge.godMode(ed, {});
  const ed2 = BL3.open(ed.toBytes());
  assert.strictEqual(ed2.level, 72);
  assert.strictEqual(ed2.money, 2000000000);
  assert.strictEqual(ed2.eridium, 2000000000);
  assert.ok(ed2.sdus.every(s => s.level === s.max));
  assert.ok(ed2.ammo.every(a => a.amount === a.max));
  assert.ok(ed2.slots.every(s => s.enabled));
  assert.ok(ed2.mayhemLevels.every(m => m === 10));
  assert.ok(ed2.guardianRank >= 200 * 18);
  assert.ok(ed2.skillPoints >= 100);
});
t('Text commands create items and change stats', () => {
  const ed = BL3.open(pcBytes);
  const log = BL3.forge.runCommands(ed, 'modded fingerbiter\n2x op legendary shock jakobs shotgun\nmodded relic, op shield; modded grenade\nmodded com\nlevel 50\nmoney 12345\n' + CODES.transformer + '\ninfinite ammo');
  assert.ok(!log.some(l => l.startsWith('✖') || l.startsWith('❓')), log.join('\n'));
  assert.strictEqual(ed.items.length, 8);
  const ed2 = BL3.open(ed.toBytes());
  assert.strictEqual(ed2.items.length, 8);
  assert.strictEqual(ed2.level, 50);
  assert.strictEqual(ed2.money, 12345);
  assert.ok(ed2.items.every(e => e.item && e.item.canParseParts));
  assert.ok(ed2.items.some(e => e.item.name === 'Fingerbiter'));
});
t('Equip, duplicate and delete items keep slots consistent', () => {
  const ed = BL3.open(pcBytes);
  ed.addItem(BL3.Item.fromCode(CODES.crader));
  ed.addItem(BL3.Item.fromCode(CODES.transformer));
  ed.equip(1, 4);
  ed.duplicateItem(0);
  ed.removeItem(0);
  assert.strictEqual(ed.items.length, 2);
  const shield = ed.slots.find(s => s.key === 4);
  assert.strictEqual(shield.index, 0);
  assert.strictEqual(ed.items[0].item.name, 'The Transformer');
});

console.log('Stats & part descriptions');
t('Every part in the game gets a non-empty description', () => {
  const bad = [];
  for (const cat in BL3_DATA.serialdb) {
    if (!/^BPInvPart_/.test(cat)) continue;
    const kind = /Shield/.test(cat) ? 'shield' : /Grenade/.test(cat) ? 'grenade' : /Artifact/.test(cat) ? 'relic' : /ClassMod/.test(cat) ? 'com' : 'weapon';
    for (const p of BL3_DATA.serialdb[cat].assets) { const d = BL3.stats.describePart(p, kind); if (!d || d.length < 5) bad.push(p); }
  }
  assert.deepStrictEqual(bad, []);
});
t('Every catalog item gets stats; modded beats normal', () => {
  for (const c of BL3_DATA.catalog) {
    const it = BL3.forge.buildItem(c, {});
    const e = BL3.stats.estimate(it);
    assert.ok(e && (e.bars.length || e.traits.length), c.n);
  }
  const n = BL3.Item.fromCode(CODES.crader), m = BL3.Item.fromCode(CODES.crader);
  BL3.forge.makeModded(m, { power: 5 });
  const dmg = (it) => BL3.stats.estimate(it).bars.find(b => b.key === 'dmg').value;
  assert.ok(dmg(m) > dmg(n) + 5);
  assert.strictEqual(BL3.stats.estimate(n).bars.find(b => b.key === 'stab').text, 'no recoil');
});

console.log('Presets');
t('Every preset builds a full equipped kit that saves & reloads', () => {
  for (const p of BL3.presets.list) {
    for (const mode of ['op', 'modded']) {
      const ed = BL3.open(pcBytes);
      const r = BL3.presets.run(ed, p.id, { mode });
      assert.strictEqual(r.added.length, 8, p.id + ' ' + r.log.join(','));
      assert.ok(!r.log.some(l => l.startsWith('❓')), p.id + ': ' + r.log.join(','));
      const ed2 = BL3.open(ed.toBytes());
      const eq = ed2.slots.filter(s => s.index >= 0);
      assert.strictEqual(eq.length, 8, p.id);
      assert.ok(ed2.items.every(e => e.item && e.item.canParseParts && e.item.level === 72));
    }
  }
});
t('Lazy box understands kits', () => {
  const ed = BL3.open(pcBytes);
  const log = BL3.forge.runCommands(ed, 'kit fire\nboss deleter\nop never reload');
  assert.strictEqual(ed.items.length, 24, log.join('\n'));
});

t('Loot piñata: random OP/MODDED legendaries of every kind, saves & reloads', () => {
  const ed = BL3.open(pcBytes);
  const kinds = new Set();
  for (const kind of ['any', 'weapon', 'shield', 'grenade', 'relic', 'com']) {
    const got = BL3.presets.randomLoot({ kind, mode: 'mix', count: 8, classToken: 'Operative' });
    assert.strictEqual(got.length, 8, kind);
    got.forEach(g => { kinds.add(g.item.kind); ed.addItem(g.item); if (kind !== 'any') assert.strictEqual(g.entry.k, kind); });
  }
  assert.ok(kinds.size >= 5);
  const ed2 = BL3.open(ed.toBytes());
  assert.strictEqual(ed2.items.length, 48);
  assert.ok(ed2.items.every(e => e.item && e.item.canParseParts && e.item.level === 72));
  const log = BL3.forge.runCommands(BL3.open(pcBytes), 'loot 7 modded');
  assert.ok(/7 random MODDED/.test(log[0]), log[0]);
});

console.log('Profile');
t('Synthetic PS4 profile: bank, keys, god mode, round-trip', () => {
  const g = BL3.file.readGvas(pcBytes);
  const header = Object.assign({}, g.header, { sgType: 'OakProfile' });
  const prof = BL3.pb.create('Profile', { bank_inventory_list: [BL3.Item.fromCode(CODES.crader).serialize()] });
  const plain = BL3.pb.encode(prof, 'Profile');
  const bytes = BL3.file.writeGvas(header, BL3.file.encryptPayload(plain, BL3.file.KEYS.profile.PS4), null);
  const ed = BL3.open(bytes);
  assert.ok(ed instanceof BL3.ProfileEditor);
  assert.strictEqual(ed.file.platform, 'PS4');
  assert.strictEqual(ed.bank.length, 1);
  BL3.forge.godMode(ed, { opGear: true });
  BL3.forge.runCommands(ed, 'modded fingerbiter');
  const ed2 = BL3.open(ed.toBytes());
  assert.strictEqual(ed2.file.platform, 'PS4');
  assert.strictEqual(ed2.getKeys(BL3_DATA.consts.goldenkey_category), 999);
  assert.strictEqual(ed2.bank.length, 2);
  assert.strictEqual(ed2.bank[0].item.level, 72);
  assert.ok(ed2.cosmeticsCount > 500);
  assert.ok(ed2.guardianRank >= 3600);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', SOME FAILED' : ''));
