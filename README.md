# ⚡ VAULT FORGE — Borderlands 3 Save Editor

A Borderlands 3 save editor for **PS4 / PS5** saves decrypted with **Save Wizard**, and for **PC** saves.
It runs in your browser: nothing to install, nothing gets uploaded, and it works offline.

![](https://img.shields.io/badge/PS4%20%2F%20PS5-Save%20Wizard-blue) ![](https://img.shields.io/badge/PC-supported-yellow) ![](https://img.shields.io/badge/runs-in%20your%20browser-green)

---

## 🚀 Fastest way to use it

1. Download **[`dist/BL3-Save-Editor.html`](dist/BL3-Save-Editor.html)** (click it, then the download button).
2. Double-click the file. It opens in Chrome, Edge, Firefox or Safari.
3. Drop your save on it.

That one file contains the whole editor.

> You can also host the repo with GitHub Pages (Settings → Pages → deploy from branch, root folder) and open `index.html` from any device, including your phone.

---

## 🎮 PS5 (PS4 version of the game) step by step

1. **PS5:** Settings → Saved Data and Game/App Settings → Saved Data (PS4) → **Copy to USB drive** → Borderlands 3.
2. On your PC, open **Save Wizard** → pick the BL3 save → **Advanced Mode** → **Decrypt**, then export the files.
   * Character saves are `1.sav`, `2.sav`, … (one per character).
   * `profile.sav` holds the bank, golden keys, guardian rank and cosmetics.
3. Open the decrypted `.sav` in Vault Forge. It detects PS4 vs PC on its own.
4. Edit away, then press **💾 Save file**.
5. In Save Wizard, **replace** the decrypted file with the one you just saved, then **encrypt / re-sign** it to your PSN profile.
6. Copy the save back from the USB to the PS5. Load the game. 🔥

⚠ **Always keep a backup of your original save.**

---

## 🔥 What it does

### Big buttons (Command Center)
| Button | What happens |
|---|---|
| **⚡ GOD MODE** | Level 72, skill points to max every tree, 2 billion money & eridium, every SDU maxed, full ammo, every gear slot + Eridian tools, Mayhem 10 on all playthroughs, TVHM unlocked, a big Guardian Rank boost (you pick tokens per reward), every vehicle / part / skin. Optional: make every item OP. Each part can be switched off. |
| **🔥 OP EVERYTHING** | Every item goes to level 72 and Mayhem 10, with the best anointment for your class. It still looks like a "legit god roll". |
| **☢ MODDED EVERYTHING** | Stupid overpowered. Stacks extra parts, every element at once and up to 15 anointments on every item. A **power slider** sets how far it goes, from *Spicy* to *BROKEN*. |
| **∞ INFINITE AMMO** | Max ammo SDUs and full ammo. Every gun also gets no-ammo / ammo-regen anointments, stacked magazines, and Infiniti parts where they fit. |
| **∞ INFINITE GRENADES** | Max grenade SDU and full grenades. Grenades get the grenade-regen anointment, and class mods get stacked grenade capacity. |

### 🎲 Loot Piñata (random loot, zero thinking)
Can't decide what to mod? Whack the piñata and get random legendaries that are already OP or MODDED.
* **What:** anything, or just guns / shields / grenades / relics / class mods (class mods match your character)
* **Power:** 🔥 OP, ☢ MODDED, or 🎰 Mix (random, with random modded strength)
* **Send to:** your backpack / bank, or your ⭐ Vault
* **How many:** 1, 5, 10, 25, or 💥 **FILL IT UP** (backpack up to 40 items, bank up to 100, vault +25)

The loot pops in one by one. Don't like it? Hit **🎲 Reroll** and that batch gets swapped for a new one.
The Lazy Box takes it too: `loot 10`, `pinata 25 modded`, `surprise me`.

### 🎁 Loadout kits (one tap = whole loadout)
Eight themed 8-piece kits: 4 guns, shield, grenade, a class mod for YOUR character, and a relic. On a character save they get auto-equipped. Pick 🔥 OP or ☢ MODDED:
🔥 Fire Demon · ⚡ Shock Therapy · ❄ Ice Ice Baby · ☢ Chernobyl · 💀 Boss Deleter · ∞ Never Reload (infinite ammo kit on everything) · 🚀 Explosion Addict · 🎲 Chaos Roulette (random legendaries, random elements, pray).
The Lazy Box understands them too: `kit fire`, `boss deleter`, `op never reload`.

### 🔥 Glow-up popup
When you hit OP or MODDED on an item, its stat bars animate from old to new, with the change shown (`does the job → hits hard asf +3.8`).

### ⭐ Vault
Hit ⭐ on any item to stash it. The Vault lives in your browser, so you can drop stashed items into ANY character or profile later.

### 🖼 Share cards
Turns any item into an image with its stats, perks and BL3 code, ready for Discord or Reddit. On a phone it opens the share menu.

### ⚙ Settings
* Themes: Vault Yellow, Siren Purple, Moze Red, Zane Ice, FL4K Toxic, Blacked Out
* Sound effects (ka-chunk, zaps, booms) and screen shake, each can be switched off
* Glow-up popup on/off
* **Family-friendly mode** cleans up the bad words, for streams or your little bro

### Per item (Backpack / Bank)
Every item card has **🔥 OP**, **☢ MODDED**, **∞ ammo kit**, **✎ Edit**, **⧉ duplicate**, **📋 copy code** and **🗑 delete**.
The toolbar has the same actions for **all items** (or only the items your filter shows: guns, shields, grenades, relics or class mods).

The **✎ Edit** window lets you change:
* level (1–127), Mayhem level, main anointment
* **parts**: add any part, stack copies (`+`), remove (`−`), with readable part names
* **anointments**: up to 15, including ones not normally allowed on that item (that's modded)
* equip slot, favorite / junk
* live **BL3(...) code** you can copy and share

### 📊 Stats & part info
Every item shows a quick **vibe check** on its card ("⚡ shoots fast asf · 🧱 no recoil · 💥 hits hard"). Tap it, or the **📊** button, for the full breakdown:
* stat bars for damage, fire rate, accuracy, recoil, mag size, reload and handling (shields get capacity / recharge, grenades get damage / blast radius)
* plain-English labels from "shoots slow as hell" up to "shoots fast asf", and "kicks like a mule" down to "no recoil". Modded gear unlocks the ☢ tiers ("bullet hose from hell")
* what the manufacturer does (Jakobs ricochet, Dahl burst, COV overheat…), the element and what it's good against, the legendary parts and the anointments
* **what each part does**: barrel, grip, stock, mag, scope, underbarrel, shield perks, grenade behaviors, relic bonuses, class-mod skills…

The stats also update live in the item editor and in the Forge preview. BL3 doesn't store stats in the save: the game works them out from the parts. So these are **estimates** from the parts, rarity, level, Mayhem and anointments, not exact in-game numbers.

### 🔨 The Forge: build any item from scratch
Search 780+ items (every legendary gun, shield, grenade, relic and class mod, plus the generic rarities). Filter by type, brand and rarity. Pick **Normal / OP / MODDED**, an element (fire / shock / corrosive / cryo / radiation), a level and how many you want, then hit **FORGE IT**.

### ⌨ The Lazy Box (just type it)
```
god mode
modded fingerbiter
3x op legendary shock jakobs shotgun
modded relic
op shield
5x random modded weapon
infinite ammo
level 72
money max
mayhem 10
BL3(A/keqg/yMeLAidiwT5/bWQwqG3OuxeEhDH4LZAPWg1a2HG2imaCQ)    ← paste any amount of item codes
```

### 👤 Character / 🗝 Profile
* Name, level, skill points, money, eridium, Mayhem, TVHM, Guardian Rank, SDUs, ammo, gear slots, Eridian Analyzer / Resonator, vehicles
* Profile: golden / diamond / vault card keys, bank SDUs, Guardian Rank, every cosmetic
* **Import / export item codes** in bulk
* **Undo** for every change
* **Save as PS4 or PC** (converts between platforms)

---

## ❓ Good to know

* **Modded gear is for offline / solo play.** In rare cases a heavily stacked item can look glitchy or crash the game. Turn the power slider down if that happens.
* **Forged items** get their parts picked automatically: the item's own legendary parts plus a clean base build. They decode and re-encode correctly, but nobody has tested them on a console yet. If one looks off in-game, importing a real code for that item (📥 Import codes) is the most reliable route.
* "Infinite ammo" in BL3 can't be a single save-file switch. The game has no such flag, so the editor stacks every ammo-regen / no-ammo-use effect the game has. Some of those anointments only work for a certain class (for example Moze's Iron Bear "no ammo" one).
* Unchanged items keep their exact original bytes. A save opened and saved without changes comes out byte-for-byte identical.

---

## 🛠 For developers

```
js/core.js      protobuf codec, GVAS container, PC + PS4 save/profile crypto, item serial codec
js/editor.js    character + profile editing logic
js/presets.js   loadout kits
js/fx.js        sounds, shake, themes, funny lines, vault, share cards
js/forge.js     item builder, OP / MODDED / ammo kits, GOD mode, lazy-text command parser
js/app.js       UI
js/data.js      generated game data (tools/build_data.py)
tests/test.js   node tests (round trips, PS4 detection, all 780+ catalog items, god mode, commands)
```

```
npm test                         # or: node tests/test.js
python3 tools/build_data.py      # regenerate js/data.js from tools/sources/
python3 tools/build_single.py    # rebuild dist/BL3-Save-Editor.html
```

## 🙏 Credits

Built on years of community reverse-engineering work:

* **Gibbed**: save encryption, protobuf definitions, item serial obfuscation
* **apocalyptech / CJ Kucera**: [bl3-cli-saveedit](https://github.com/apocalyptech/bl3-cli-saveedit) (zlib license): inventory serial DB, balance names, game constants, editing logic reference
* **FromDarkHell**: [BL3SaveEditor](https://github.com/FromDarkHell/BL3SaveEditor) (GPL-3.0): PS4 keys, part names, part dependency data, anointment pools, demo save

Licensed under **GPL-3.0** (see `LICENSE`). Not affiliated with Gearbox or 2K.
