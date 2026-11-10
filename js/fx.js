/*
 * VAULT FORGE - fun stuff: settings, themes, sounds, screen shake,
 * funny lines, family-friendly filter, favorites vault, share cards.
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ settings
  const DEFAULTS = { theme: 'vault', sound: true, shake: true, compare: true, clean: false, safe: true };
  let settings = Object.assign({}, DEFAULTS);
  try { Object.assign(settings, JSON.parse(localStorage.getItem('vf_settings') || '{}')); } catch (e) { /* ignore */ }
  function saveSettings() { try { localStorage.setItem('vf_settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  function set(k, v) { settings[k] = v; saveSettings(); if (k === 'theme') applyTheme(); if (k === 'safe' && root.BL3 && root.BL3.legit) root.BL3.legit.safe = !!v; }
  if (root.BL3 && root.BL3.legit) root.BL3.legit.safe = !!settings.safe;

  const THEMES = [
    { id: 'vault', name: 'Vault Yellow', a: '#ffd21f', b: '#ffb800' },
    { id: 'siren', name: 'Siren Purple', a: '#c77dff', b: '#8b3dff' },
    { id: 'moze', name: 'Moze Red', a: '#ff4d4d', b: '#d61f1f' },
    { id: 'zane', name: 'Zane Ice', a: '#5ee7ff', b: '#1aa6d6' },
    { id: 'fl4k', name: 'FL4K Toxic', a: '#7dff5e', b: '#2bb84a' },
    { id: 'stealth', name: 'Blacked Out', a: '#e6e6e6', b: '#9a9a9a' },
  ];
  function applyTheme() {
    const t = THEMES.find(x => x.id === settings.theme) || THEMES[0];
    const r = document.documentElement.style;
    r.setProperty('--yellow', t.a);
    r.setProperty('--yellow2', t.b);
    r.setProperty('--glow', hexA(t.a, 0.12));
    document.body.dataset.theme = t.id;
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ------------------------------------------------------------------ family-friendly filter
  const SWEARS = [
    [/motherf\*+er/gi, 'buddy'], [/\bf\*+k(ing)?\b/gi, 'freaking'], [/\bsh\*t\b/gi, 'shoot'], [/\bdamn\b/gi, 'dang'],
    [/\basf\b/gi, 'for real'], [/as hell/gi, 'as heck'], [/\bhell\b/gi, 'heck'], [/\bass\b/gi, 'butt'],
  ];
  function clean(text) {
    if (!settings.clean || typeof text !== 'string') return text;
    for (const [re, rep] of SWEARS) text = text.replace(re, rep);
    return text;
  }

  // ------------------------------------------------------------------ funny lines
  const LINES = {
    loaded: ['{name} loaded. Let\'s commit some crimes.', 'Oh {name}… you poor weak thing. Let\'s fix that.', 'Level {level}? Cute. Hold my beer.',
      '{platform} save detected. Gearbox can\'t stop us now.', '{name} has entered the chat. Weakness detected.', 'Opened {name}. Time to get stupid.'],
    loadedProfile: ['Profile loaded. Your bank is about to get disrespected.', 'Profile open. Golden keys? We print those now.'],
    saved: ['Saved. Now go ruin some boss\'s whole day.', 'Done. Put it back with Save Wizard and go be a menace.', 'File saved. Gearbox is shaking rn.', 'Saved {file}. Go flex.'],
    god: ['You are now a god. Act like it.', 'Ascension complete. Bosses are filing complaints.', 'GOD MODE ON. Touch grass? Never heard of her.', 'Congrats, you\'re basically a Vault Monster now.'],
    op: ['{name} is now OP as hell.', '{name} just hit the gym.', '{name}: buffed. Enemies: emotionally damaged.', '{name} is cooking now.'],
    modded: ['{name} is now stupid broken. Use responsibly (you won\'t).', '☢ {name} went nuclear.', '{name} is now illegal in 4 galaxies.', '{name} has no business being this strong.'],
    opAll: ['{n} items just got OP as hell.', 'Whole backpack buffed. {n} items. You\'re welcome.'],
    moddedAll: ['☢ {n} items are now war crimes.', '{n} items went full nuclear. Gearbox has left the chat.'],
    ammo: ['∞ Infinite ammo kit on. Hold that trigger forever.', '∞ Reloading is for peasants now.'],
    nades: ['∞ Grenades for days. Spam that button.', '∞ Nade spam unlocked. Your thumb will hurt.'],
    del: ['Yeeted {name} into the void. (Undo if you panic)', '{name} is gone. Rest in pieces.', 'Deleted {name}. It knew too much.'],
    dup: ['Duplicated {name}. Infinite money glitch energy.', 'Ctrl+C, Ctrl+V. Now you have two {name}.'],
    undo: ['Undone. We pretend that never happened.', 'Ctrl+Z\'d. Nobody saw that.'],
    err: ['Well sh*t: {msg}', 'That didn\'t work, chief: {msg}', 'Oops, my bad: {msg}'],
    openFail: ['That\'s not a BL3 save, chief. {msg}', 'Can\'t read that one. {msg}'],
    copied: ['Code copied. Go flex on Discord.', 'Copied. Spread the chaos.'],
    kit: ['{icon} {name} kit equipped. Go wild.', '{icon} {name} loadout locked and loaded.'],
    vault: ['⭐ {name} added to your favorites.', '⭐ {name} saved to favorites for later shenanigans.'],
    forged: ['🔨 Forged {what}. Hot off the anvil.', '🔨 {what} coming right up.'],
    imported: ['Imported {n} items. Free loot, baby.'],
  };
  function say(key, vars = {}) {
    const pool = LINES[key] || [key];
    let s = pool[Math.floor(Math.random() * pool.length)];
    s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
    return clean(s);
  }

  // ------------------------------------------------------------------ sounds (synthesized, no files)
  let ac = null;
  function ctx() {
    if (!ac) { try { ac = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(c, freq, t0, dur, type = 'square', vol = 0.12, slideTo) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(c, t0, dur, vol = 0.25, lp = 900) {
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start(t0);
  }
  function sfx(name) {
    if (!settings.sound) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    switch (name) {
      case 'click': tone(c, 520, t, 0.05, 'square', 0.05); break;
      case 'chunk': noise(c, t, 0.12, 0.35, 600); tone(c, 90, t, 0.18, 'sine', 0.3, 45); break;
      case 'op': tone(c, 330, t, 0.12, 'square', 0.08, 660); tone(c, 660, t + 0.1, 0.16, 'square', 0.08, 990); noise(c, t + 0.05, 0.1, 0.2, 2000); break;
      case 'modded': tone(c, 1200, t, 0.25, 'sawtooth', 0.07, 80); noise(c, t + 0.15, 0.45, 0.5, 500); tone(c, 55, t + 0.15, 0.5, 'sine', 0.4, 30); break;
      case 'god': [261, 329, 392, 523, 659].forEach((f, i) => tone(c, f, t + i * 0.07, 0.6, 'triangle', 0.08)); noise(c, t + 0.35, 0.6, 0.45, 400); tone(c, 50, t + 0.35, 0.7, 'sine', 0.45, 28); break;
      case 'delete': tone(c, 600, t, 0.25, 'sawtooth', 0.06, 60); break;
      case 'error': tone(c, 140, t, 0.18, 'square', 0.1); tone(c, 110, t + 0.18, 0.25, 'square', 0.1); break;
      case 'save': tone(c, 880, t, 0.1, 'triangle', 0.1); tone(c, 1320, t + 0.09, 0.2, 'triangle', 0.1); break;
      case 'coin': tone(c, 988, t, 0.08, 'square', 0.07); tone(c, 1319, t + 0.08, 0.25, 'square', 0.07); break;
    }
  }
  function shake(power = 1) {
    if (!settings.shake) return;
    const el = document.getElementById('app');
    if (!el) return;
    el.classList.remove('shake1', 'shake2', 'shake3');
    void el.offsetWidth;
    el.classList.add('shake' + Math.max(1, Math.min(3, power)));
    setTimeout(() => el.classList.remove('shake1', 'shake2', 'shake3'), 700);
  }
  function boom(kind) {
    const map = { op: ['op', 1], modded: ['modded', 2], god: ['god', 3], kit: ['chunk', 2], save: ['save', 0], delete: ['delete', 0], error: ['error', 0] };
    const [s, p] = map[kind] || ['click', 0];
    sfx(s); if (p) shake(p);
  }

  // ------------------------------------------------------------------ favorites vault
  const vault = {
    list() { try { return JSON.parse(localStorage.getItem('vf_vault') || '[]'); } catch (e) { return []; } },
    save(list) { localStorage.setItem('vf_vault', JSON.stringify(list)); },
    add(item, note) {
      const list = vault.list();
      const code = item.code();
      if (list.some(x => x.code === code)) return false;
      list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code, name: item.name, kind: item.kind, rarity: item.rarity, level: item.level, mayhem: item.mayhem, parts: item.parts.length, note: note || '', added: Date.now() });
      vault.save(list);
      return true;
    },
    remove(id) { vault.save(vault.list().filter(x => x.id !== id)); },
    clear() { vault.save([]); },
  };

  // ------------------------------------------------------------------ share card
  const RCOL = { 1: '#e8e8e8', 2: '#3ddc5f', 3: '#3b8cff', 4: '#b05cff', 5: '#ff8a00' };
  function wrap(g, text, maxW) {
    const out = []; let line = '';
    for (const ch of text.split(/(\s+)/)) {
      if (g.measureText(line + ch).width > maxW && line) { out.push(line.trim()); line = ch.trimStart(); } else line += ch;
    }
    if (line.trim()) out.push(line.trim());
    return out;
  }
  function wrapHard(g, text, maxW) {
    const out = []; let line = '';
    for (const ch of text) { if (g.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; }
    if (line) out.push(line);
    return out;
  }
  function shareCard(item, est) {
    const W = 1000, P = 50;
    const col = RCOL[item.rarity] || RCOL[5];
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim() || '#ffd21f';
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    const bars = (est && est.bars) || [];
    const traits = ((est && est.traits) || []).slice(0, 6).map(clean);
    g.font = '22px monospace';
    const codeLines = wrapHard(g, item.code(), W - P * 2 - 40);
    const H = 260 + bars.length * 48 + traits.length * 34 + codeLines.length * 28 + 150;
    cv.width = W; cv.height = H;
    // background
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#16161c'); bg.addColorStop(1, '#0b0b0e');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W - 120, 60, 10, W - 120, 60, 520);
    glow.addColorStop(0, hexA(col, 0.35)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = col; g.fillRect(0, 0, 14, H);
    g.strokeStyle = '#000'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
    // title
    let y = P + 50;
    g.fillStyle = col; g.font = 'bold 60px Impact, "Arial Black", sans-serif';
    for (const l of wrap(g, item.name.toUpperCase(), W - P * 2)) { g.fillText(l, P, y); y += 64; }
    g.fillStyle = '#9a99a3'; g.font = '26px sans-serif';
    g.fillText(['Level ' + item.level, item.mayhem ? 'Mayhem ' + item.mayhem : null, item.parts.length + ' parts', ({ weapon: 'Gun', shield: 'Shield', grenade: 'Grenade', relic: 'Relic', com: 'Class Mod' })[item.kind]].filter(Boolean).join('  ·  '), P, y + 6);
    y += 56;
    // bars
    for (const b of bars) {
      g.fillStyle = '#cfcfd6'; g.font = 'bold 24px sans-serif'; g.fillText(b.label, P, y + 20);
      const bx = P + 220, bw = 400;
      g.fillStyle = '#000'; g.fillRect(bx, y + 4, bw, 20);
      const over = b.value > 10.5;
      const grd = g.createLinearGradient(bx, 0, bx + bw, 0);
      if (over) { grd.addColorStop(0, '#7b2cff'); grd.addColorStop(1, '#ff4df0'); } else { grd.addColorStop(0, '#ff9500'); grd.addColorStop(1, accent); }
      g.fillStyle = grd; g.fillRect(bx, y + 4, bw * Math.min(1, b.value / 10), 20);
      g.fillStyle = over ? '#e2b8ff' : '#fff'; g.font = 'bold 24px sans-serif'; g.fillText(clean(b.text), bx + bw + 20, y + 22);
      y += 48;
    }
    y += 10;
    g.font = '24px sans-serif'; g.fillStyle = '#d8d8de';
    for (const t of traits) { g.fillText('• ' + (t.length > 70 ? t.slice(0, 68) + '…' : t), P, y + 20); y += 34; }
    y += 20;
    g.fillStyle = '#000'; g.fillRect(P, y, W - P * 2, codeLines.length * 28 + 30);
    g.fillStyle = accent; g.font = '22px monospace';
    codeLines.forEach((l, i) => g.fillText(l, P + 20, y + 32 + i * 28));
    y += codeLines.length * 28 + 70;
    g.fillStyle = accent; g.font = 'bold 34px Impact, "Arial Black", sans-serif'; g.fillText('VAULT FORGE', P, y);
    const wm = g.measureText('VAULT FORGE').width;
    g.fillStyle = '#666'; g.font = '20px sans-serif'; g.fillText('BL3 save editor · stats are estimates', P + wm + 18, y - 4);
    return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
  }

  root.VFX = { settings, set, THEMES, applyTheme, clean, say, sfx, shake, boom, vault, shareCard };
  if (document.readyState !== 'loading') applyTheme(); else document.addEventListener('DOMContentLoaded', applyTheme);
})(window);
