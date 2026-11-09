/*
 * BL3 Save Editor - character (save) & profile editing logic.
 * Logic mirrors apocalyptech's bl3-cli-saveedit where applicable.
 */
(function (root) {
  'use strict';
  const BL3 = root.BL3;
  const C = () => root.BL3_DATA.consts;
  const pb = () => BL3.pb;

  const MAX_MONEY = 2000000000;
  const MAX_ERIDIUM = 2000000000;

  function invPathHash(path) {
    const table = C()._weapon_cust_crc32_table;
    if (!path.includes('.')) path = path + '.' + path.split('/').pop();
    const s = path.toUpperCase();
    let crc = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i) & 0xFF;
      crc = (table[(crc ^ ch) & 0xFF] ^ (crc >>> 8)) >>> 0;
      crc = (table[(crc ^ (ch >> 8)) & 0xFF] ^ (crc >>> 8)) >>> 0;
    }
    return crc >>> 0;
  }

  function invert(obj) { const o = {}; for (const k in obj) o[obj[k]] = k; return o; }

  const SLOT_NAMES = ['Weapon 1', 'Weapon 2', 'Weapon 3', 'Weapon 4', 'Shield', 'Grenade', 'Class Mod', 'Relic'];

  // ======================================================================
  // Character save
  // ======================================================================
  class SaveEditor {
    constructor(file) {
      this.file = file;
      this.s = file.data;
      this.refreshItems();
    }

    refreshItems() {
      this.items = this.s.inventory_items.map(pbItem => {
        let item = null, error = null;
        try { item = new BL3.Item(pbItem.item_serial_number); } catch (e) { error = e.message; }
        return { pb: pbItem, item, error };
      });
    }

    /** Write all dirty item serials back into the protobuf. */
    commitItems() {
      for (const e of this.items) if (e.item && e.item.dirty) e.pb.item_serial_number = e.item.serialize();
    }

    toBytes() { this.commitItems(); return BL3.file.save(this.file); }

    // -- basic info -------------------------------------------------------
    get name() { return this.s.preferred_character_name || ''; }
    set name(v) { this.s.preferred_character_name = String(v); }

    get classKey() {
      const p = this.s.player_class_data ? this.s.player_class_data.player_class_path : '';
      const c = C().classobj_to_class[p];
      return c === undefined ? null : Number(c);
    }
    get className() {
      const k = this.classKey;
      const vh = { 0: 'FL4K (Beastmaster)', 1: 'Moze (Gunner)', 2: 'Zane (Operative)', 3: 'Amara (Siren)' };
      return k === null ? 'Unknown' : vh[k];
    }
    get classToken() { return ['Beastmaster', 'Gunner', 'Operative', 'Siren'][this.classKey] || ''; }

    get xp() { return this.s.experience_points || 0; }
    get level() {
      const xp = this.xp; let lvl = 0;
      for (const req of C().required_xp_list) { if (xp >= req) lvl++; else break; }
      return Math.max(1, lvl);
    }
    set level(level) {
      const list = C().required_xp_list;
      level = Math.max(1, Math.min(C().max_level, level | 0));
      this.s.experience_points = list[level - 1];
      this.setStat(C().level_stat, level);
      if (level > 1) {
        if (!this.s.ability_data) this.s.ability_data = pb().create('OakPlayerAbilitySaveGameData');
        if (!this.s.ability_data.tree_grade) this.s.ability_data.tree_grade = 2;
      }
      for (const [lvl, chal] of C().level_challenges) if (level >= lvl) this.unlockChallengeObj(chal);
    }
    get maxLevel() { return C().max_level; }

    get skillPoints() { return (this.s.ability_data && this.s.ability_data.ability_points) || 0; }
    set skillPoints(v) {
      if (!this.s.ability_data) this.s.ability_data = pb().create('OakPlayerAbilitySaveGameData');
      this.s.ability_data.ability_points = Math.max(0, v | 0);
    }
    /** Skill points spent in trees */
    get spentPoints() {
      if (!this.s.ability_data) return 0;
      return this.s.ability_data.tree_item_list.reduce((a, t) => a + (t.points || 0), 0);
    }

    // -- currency ---------------------------------------------------------
    getCurrency(which) {
      const h = C().currency_to_curhash[which === 'money' ? 0 : 1];
      const e = this.s.inventory_category_list.find(c => c.base_category_definition_hash === h);
      return e ? e.quantity : 0;
    }
    setCurrency(which, v) {
      const h = C().currency_to_curhash[which === 'money' ? 0 : 1];
      v = Math.max(0, Math.min(2147483647, Math.floor(Number(v) || 0)));
      let e = this.s.inventory_category_list.find(c => c.base_category_definition_hash === h);
      if (!e) { e = pb().create('InventoryCategorySaveData', { base_category_definition_hash: h, quantity: 0 }); this.s.inventory_category_list.push(e); }
      e.quantity = v;
    }
    get money() { return this.getCurrency('money'); }
    set money(v) { this.setCurrency('money', v); }
    get eridium() { return this.getCurrency('eridium'); }
    set eridium(v) { this.setCurrency('eridium', v); }

    // -- SDUs / ammo ------------------------------------------------------
    get sdus() {
      const c = C(); const out = [];
      const have = {};
      for (const s of this.s.sdu_list) have[s.sdu_data_path] = s.sdu_level;
      for (const path in c.sduobj_to_sdu) {
        const k = c.sduobj_to_sdu[path];
        out.push({ path, key: k, name: c.sdu_to_eng[k], level: have[path] || 0, max: c.sdu_to_max[k] });
      }
      return out;
    }
    setSdu(path, level) {
      let e = this.s.sdu_list.find(s => s.sdu_data_path === path);
      if (!e) { e = pb().create('OakSDUSaveGameData', { sdu_data_path: path, sdu_level: 0 }); this.s.sdu_list.push(e); }
      e.sdu_level = Math.max(0, level | 0);
    }
    maxSdus() { for (const s of this.sdus) this.setSdu(s.path, s.max); }

    get ammo() {
      const c = C(); const out = [];
      for (const pool of this.s.resource_pools) {
        const k = c.ammoobj_to_ammo[pool.resource_path];
        if (k === undefined) continue;
        out.push({ pool, name: c.ammo_to_eng[k], amount: Math.round(pool.amount), max: c.ammo_to_max[k] });
      }
      return out;
    }
    maxAmmo() {
      const c = C();
      const present = new Set(this.s.resource_pools.map(p => p.resource_path));
      for (const path in c.ammoobj_to_ammo) {
        if (!present.has(path)) this.s.resource_pools.push(pb().create('ResourcePoolSavegameData', { resource_path: path, amount: 0 }));
      }
      for (const pool of this.s.resource_pools) {
        const k = c.ammoobj_to_ammo[pool.resource_path];
        if (k !== undefined) pool.amount = c.ammo_to_max[k];
      }
    }

    // -- stats & challenges ----------------------------------------------
    setStat(path, value) {
      let e = this.s.game_stats_data.find(s => s.stat_path === path);
      if (!e) { e = pb().create('GameStatSaveGameData', { stat_path: path, stat_value: 0 }); this.s.game_stats_data.push(e); }
      e.stat_value = value;
    }
    unlockChallengeObj(path, count = 1) {
      const ch = this.s.challenge_data.find(c => c.challenge_class_path === path);
      if (!ch) return false;
      ch.currently_completed = true;
      ch.is_active = false;
      ch.completed_count = count;
      ch.progress_counter = 0;
      ch.completed_progress_level = 0;
      return true;
    }
    challengeDone(path) {
      const ch = this.s.challenge_data.find(c => c.challenge_class_path === path);
      return !!(ch && ch.currently_completed);
    }
    get specialChallenges() {
      const c = C(); const out = [];
      const myCls = this.classKey;
      for (const path in c.challengeobj_to_challenge) {
        const k = c.challengeobj_to_challenge[path];
        const lock = c.challenge_char_lock[k];
        if (lock !== undefined && Number(lock) !== myCls) continue;
        out.push({ path, key: k, name: c.challenge_to_eng[k], done: this.challengeDone(path) });
      }
      return out;
    }
    unlockSpecialChallenges() { for (const ch of this.specialChallenges) this.unlockChallengeObj(ch.path); }

    // -- equipment slots ---------------------------------------------------
    get slots() {
      const c = C();
      return this.s.equipped_inventory_list.map(e => {
        const k = c.slotobj_to_slot[e.slot_data_path];
        return { pb: e, key: k === undefined ? -1 : Number(k), name: k === undefined ? e.slot_data_path.split('.').pop() : SLOT_NAMES[k], enabled: !!e.enabled, index: e.inventory_list_index };
      });
    }
    unlockAllSlots() {
      const c = C();
      const have = new Set(this.s.equipped_inventory_list.map(e => e.slot_data_path));
      for (const path in c.slotobj_to_slot) {
        if (!have.has(path)) this.s.equipped_inventory_list.push(pb().create('EquippedInventorySaveGameData', { slot_data_path: path, inventory_list_index: -1, enabled: true, trinket_data_path: '' }));
      }
      for (const e of this.s.equipped_inventory_list) e.enabled = true;
      this.unlockSpecialChallenges();
    }
    equip(itemIndex, slotKey) {
      const path = invert(C().slotobj_to_slot)[slotKey];
      let e = this.s.equipped_inventory_list.find(x => x.slot_data_path === path);
      if (!e) { e = pb().create('EquippedInventorySaveGameData', { slot_data_path: path, inventory_list_index: -1, enabled: true }); this.s.equipped_inventory_list.push(e); }
      e.inventory_list_index = itemIndex;
      e.enabled = true;
    }
    equippedSlotOf(itemIndex) {
      const s = this.slots.find(x => x.index === itemIndex);
      return s ? s.name : null;
    }

    // -- mayhem / playthroughs -------------------------------------------
    get playthroughs() { return this.s.playthroughs_completed || 0; }
    set playthroughs(v) { this.s.playthroughs_completed = Math.max(0, Math.min(2, v | 0)); }
    get mayhemLevels() { return this.s.game_state_save_data_for_playthrough.map(g => g.mayhem_level || 0); }
    setMayhemAll(level) {
      level = Math.max(0, Math.min(10, level | 0));
      for (const g of this.s.game_state_save_data_for_playthrough) {
        g.mayhem_level = level;
        if (!g.mayhem_random_seed && level > 0) g.mayhem_random_seed = (Math.random() * 0x7FFFFFFF) | 0;
      }
      if (level > 0) {
        const chal = Object.keys(C().challengeobj_to_challenge).find(p => C().challengeobj_to_challenge[p] === 2);
        if (chal) this.unlockChallengeObj(chal);
      }
    }

    // -- guardian rank (per character copy) ---------------------------------
    get guardianRank() { return (this.s.guardian_rank_character_data && this.s.guardian_rank_character_data.guardian_rank) || 0; }
    setGuardianRewards(tokensEach) {
      if (!this.s.guardian_rank_character_data) this.s.guardian_rank_character_data = pb().create('GuardianRankCharacterSaveGameData');
      const g = this.s.guardian_rank_character_data;
      const todo = new Set(C().guardian_rank_rewards);
      for (const r of g.rank_rewards) {
        if (todo.has(r.reward_data_path)) { todo.delete(r.reward_data_path); r.num_tokens = tokensEach; r.is_enabled = true; }
      }
      for (const path of todo) g.rank_rewards.push(pb().create('GuardianRankRewardCharacterSaveGameData', { num_tokens: tokensEach, is_enabled: true, reward_data_path: path }));
      const sum = g.rank_rewards.reduce((a, r) => a + (r.num_tokens || 0), 0) + (g.guardian_available_tokens || 0);
      g.guardian_rank = Math.max(g.guardian_rank || 0, sum);
      g.is_rank_system_enabled = true;
    }

    // -- vehicles ----------------------------------------------------------
    unlockVehicles() {
      const c = C();
      const excl = new Set(c.chassis_excluders);
      const have = new Set(this.s.vehicles_unlocked_data.map(v => v.asset_path));
      for (const t in c.vehicle_chassis) for (const p of c.vehicle_chassis[t]) {
        if (!have.has(p) && !excl.has(p)) { this.s.vehicles_unlocked_data.push(pb().create('VehicleUnlockedSaveGameData', { asset_path: p, just_unlocked: true })); have.add(p); }
      }
      const parts = new Set(this.s.vehicle_parts_unlocked);
      for (const src of [c.vehicle_parts, c.vehicle_skins]) for (const t in src) for (const p of src[t]) {
        if (!parts.has(p)) { this.s.vehicle_parts_unlocked.push(p); parts.add(p); }
      }
    }

    // -- items ---------------------------------------------------------------
    addItem(item, opts = {}) {
      let maxPick = 0;
      for (const e of this.s.inventory_items) maxPick = Math.max(maxPick, e.pickup_order_index || 0);
      const pbItem = pb().create('OakInventoryItemSaveGameData', {
        item_serial_number: item.serialize(),
        pickup_order_index: maxPick + 1,
        flags: 1 | (opts.favorite ? 2 : 0),
        weapon_skin_path: '',
      });
      this.s.inventory_items.push(pbItem);
      const fresh = new BL3.Item(pbItem.item_serial_number);
      this.items.push({ pb: pbItem, item: fresh, error: null });
      return this.items.length - 1;
    }
    removeItem(index) {
      this.s.inventory_items.splice(index, 1);
      this.items.splice(index, 1);
      for (const e of this.s.equipped_inventory_list) {
        if (e.inventory_list_index === index) e.inventory_list_index = -1;
        else if (e.inventory_list_index > index) e.inventory_list_index--;
      }
    }
    duplicateItem(index) {
      const src = this.items[index];
      if (!src || !src.item) return -1;
      this.commitItems();
      return this.addItem(new BL3.Item(src.item.serialize()));
    }
    setFlag(index, flag, on) {
      const e = this.items[index].pb;
      let f = e.flags || 0;
      if (flag === 'favorite') { f &= ~4; f = on ? f | 2 : f & ~2; }
      if (flag === 'junk') { f &= ~2; f = on ? f | 4 : f & ~4; }
      e.flags = f | 1;
    }
  }

  // ======================================================================
  // Profile
  // ======================================================================
  class ProfileEditor {
    constructor(file) {
      this.file = file;
      this.p = file.data;
      this.refreshItems();
    }
    refreshItems() {
      const wrap = (list) => list.map((bytes, i) => {
        let item = null, error = null;
        try { item = new BL3.Item(bytes); } catch (e) { error = e.message; }
        return { list, idx: i, item, error };
      });
      this.bank = wrap(this.p.bank_inventory_list);
      this.lostLoot = wrap(this.p.lost_loot_inventory_list);
      this.items = this.bank;
    }
    commitItems() {
      for (const e of this.bank) if (e.item && e.item.dirty) this.p.bank_inventory_list[e.idx] = e.item.serialize();
      for (const e of this.lostLoot) if (e.item && e.item.dirty) this.p.lost_loot_inventory_list[e.idx] = e.item.serialize();
    }
    toBytes() { this.commitItems(); return BL3.file.save(this.file); }

    addItem(item) {
      this.commitItems();
      this.p.bank_inventory_list.push(item.serialize());
      this.refreshItems();
      return this.bank.length - 1;
    }
    removeItem(index) {
      this.commitItems();
      this.p.bank_inventory_list.splice(index, 1);
      this.refreshItems();
    }
    duplicateItem(index) {
      this.commitItems();
      const src = this.bank[index];
      if (!src || !src.item) return -1;
      return this.addItem(new BL3.Item(src.item.serialize()));
    }

    getKeys(category) {
      const h = invPathHash(category);
      const e = this.p.bank_inventory_category_list.find(c => c.base_category_definition_hash === h);
      return e ? e.quantity : 0;
    }
    setKeys(category, n) {
      const h = invPathHash(category);
      let e = this.p.bank_inventory_category_list.find(c => c.base_category_definition_hash === h);
      if (!e) { e = pb().create('InventoryCategorySaveData', { base_category_definition_hash: h, quantity: 0 }); this.p.bank_inventory_category_list.push(e); }
      e.quantity = Math.max(0, Math.min(2147483647, n | 0));
    }
    get keyTypes() {
      const c = C();
      return [
        { name: 'Golden Keys', cat: c.goldenkey_category },
        { name: 'Diamond Keys', cat: c.diamondkey_category },
        { name: 'Vault Card 1 Keys', cat: c.vaultcard1key_category },
        { name: 'Vault Card 2 Keys', cat: c.vaultcard2key_category },
        { name: 'Vault Card 3 Keys', cat: c.vaultcard3key_category },
      ].map(k => Object.assign(k, { value: this.getKeys(k.cat) }));
    }

    get sdus() {
      const c = C(); const out = [];
      const have = {};
      for (const s of this.p.profile_sdu_list) have[s.sdu_data_path] = s.sdu_level;
      for (const path in c.psduobj_to_psdu) {
        const k = c.psduobj_to_psdu[path];
        out.push({ path, name: c.psdu_to_eng[k], level: have[path] || 0, max: c.psdu_to_max[k] });
      }
      return out;
    }
    setSdu(path, level) {
      let e = this.p.profile_sdu_list.find(s => s.sdu_data_path === path);
      if (!e) { e = pb().create('OakSDUSaveGameData', { sdu_data_path: path, sdu_level: 0 }); this.p.profile_sdu_list.push(e); }
      e.sdu_level = level;
    }
    maxSdus() { for (const s of this.sdus) this.setSdu(s.path, s.max); }

    get guardianRank() { return (this.p.guardian_rank && this.p.guardian_rank.guardian_rank) || 0; }
    get guardianTokens() { return (this.p.guardian_rank && this.p.guardian_rank.available_tokens) || 0; }
    setGuardianRewards(tokensEach) {
      if (!this.p.guardian_rank) this.p.guardian_rank = pb().create('GuardianRankProfileData');
      const g = this.p.guardian_rank;
      const todo = new Set(C().guardian_rank_rewards);
      for (const r of g.rank_rewards) if (todo.has(r.reward_data_path)) { todo.delete(r.reward_data_path); r.num_tokens = tokensEach; }
      for (const path of todo) g.rank_rewards.push(pb().create('GuardianRankRewardSaveGameData', { num_tokens: tokensEach, reward_data_path: path }));
      g.guardian_rank = g.rank_rewards.reduce((a, r) => a + (r.num_tokens || 0), 0) + (g.available_tokens || 0);
    }

    unlockCosmetics() {
      const c = C();
      const have = new Set(this.p.unlocked_customizations.map(x => x.customization_asset_path));
      for (const set of [c.profile_skins, c.profile_heads, c.profile_echothemes, c.profile_emotes]) {
        for (const path of set) if (!have.has(path)) { this.p.unlocked_customizations.push(pb().create('OakCustomizationSaveGameData', { is_new: true, customization_asset_path: path })); have.add(path); }
      }
      const haveRoom = new Set(this.p.unlocked_crew_quarters_decorations.map(x => x.decoration_item_asset_path));
      for (const path in c.profile_roomdeco_obj_to_eng) if (!haveRoom.has(path)) this.p.unlocked_crew_quarters_decorations.push(pb().create('CrewQuartersDecorationItemSaveGameData', { is_new: true, decoration_item_asset_path: path }));
      const haveW = new Set(this.p.unlocked_inventory_customization_parts.map(x => x.customization_part_hash));
      for (const src of [c.profile_weaponskins_obj_to_eng, c.profile_weapontrinkets_obj_to_eng]) {
        for (const path in src) { const h = invPathHash(path); if (!haveW.has(h)) { this.p.unlocked_inventory_customization_parts.push(pb().create('OakInventoryCustomizationPartInfo', { customization_part_hash: h, is_new: true })); haveW.add(h); } }
      }
    }
    get cosmeticsCount() { return this.p.unlocked_customizations.length + this.p.unlocked_inventory_customization_parts.length; }
  }

  BL3.SaveEditor = SaveEditor;
  BL3.ProfileEditor = ProfileEditor;
  BL3.invPathHash = invPathHash;
  BL3.SLOT_NAMES = SLOT_NAMES;
  BL3.LIMITS = { MAX_MONEY, MAX_ERIDIUM };
  BL3.open = function (bytes) {
    const f = BL3.file.load(bytes);
    return f.kind === 'profile' ? new ProfileEditor(f) : new SaveEditor(f);
  };
})(typeof window !== 'undefined' ? window : globalThis);
