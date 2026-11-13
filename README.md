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

## 🖥 Desktop app (Windows / Mac / Linux)
Prefer a real app with a desktop icon? Grab it from the **[Releases](../../releases)** page:
* **Windows:** `Vault-Forge-…-setup.exe` (installer + desktop shortcut) or `Vault-Forge-…-portable.exe` (no install)
* **Mac:** `.dmg` · **Linux:** `.AppImage`

It's the same editor in its own window and works fully offline. The app isn't code-signed, so Windows may show "Windows protected your PC": click **More info → Run anyway**.

*Making a new release:* GitHub → **Actions** → **Desktop app** → **Run workflow** (or push a tag like `v1.1.0`). GitHub builds all three versions and posts them on the Releases page. Source: `desktop/` (Electron).

## 🎮 PS5 (PS4 version of the game) step by step

1. **PS5:** Settings → Saved Data and Game/App Settings → Saved Data (PS4) → **Copy to USB drive** → Borderlands 3.
2. On your PC, open **Save Wizard** → pick the BL3 save → **Advanced Mode** → **Decrypt**, then export the files.
   * Character saves are named `1`, `2`, … (one per character). Inside they're **JSON text**, and that's normal. Vault Forge reads and writes Save Wizard's JSON directly. Don't rename them.
   * `profile` holds the bank, golden keys, guardian rank and cosmetics.
   * **Other BL3 editors can't read Save Wizard's JSON.** Open it in Vault Forge, pick **Convert: PS4 .sav** in the top bar and save. That gives you a real `.sav` other editors accept. To go back, open the `.sav` here and pick **Convert: Save Wizard JSON**.
   * Never open & save the file in Notepad/TextEdit first, that can break it. If a file won't open, the **🩺 Save Doctor** tells you why.
3. Open the decrypted `.sav` in Vault Forge. It detects PS4 vs PC on its own.
4. Edit away, then press **💾 Save file**.
5. In Save Wizard, **replace** the decrypted file with the one you just saved (same name, e.g. `2`), then **encrypt / re-sign** it to your PSN profile.
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
* **Send to:** your backpack, your in-game 🏦 bank, or ⭐ Favorites
* **How many:** 1, 5, 10, 25, or 💥 **FILL IT UP** (backpack up to 40 items, bank up to 100, favorites +25)

The loot pops in one by one. Don't like it? Hit **🎲 Reroll** and that batch gets swapped for a new one.
The Lazy Box takes it too: `loot 10`, `pinata 25 modded`, `surprise me`.

### 🎁 Loadout kits (one tap = whole loadout)
Eight themed 8-piece kits: 4 guns, shield, grenade, a class mod for YOUR character, and a relic. On a character save they get auto-equipped. Pick 🔥 OP or ☢ MODDED:
🔥 Fire Demon · ⚡ Shock Therapy · ❄ Ice Ice Baby · ☢ Chernobyl · 💀 Boss Deleter · ∞ Never Reload (infinite ammo kit on everything) · 🚀 Explosion Addict · 🎲 Chaos Roulette (random legendaries, random elements, pray).
The Lazy Box understands them too: `kit fire`, `boss deleter`, `op never reload`.

### 🔥 Glow-up popup
When you hit OP or MODDED on an item, its stat bars animate from old to new, with the change shown (`does the job → hits hard asf +3.8`).

### 🏦 In-game bank
BL3 keeps your bank in the **profile** file (Save Wizard names it `profile`). While a character is open, tap **🏦 Link bank** (or pick "Send to: Bank" in the piñata) and choose your `profile` file. Then you can:
* send Loot Piñata drops straight into the bank
* move any backpack item to the bank with the 🏦 button, and back with 🎒 To backpack
* OP / MODDED everything in the bank from the 🏦 Bank tab

**💾 Save file** then gives you BOTH files (`2` and `profile`). Put both back with Save Wizard.

### ⭐ Favorites
Hit ⭐ on any item to save it in your browser (not the game), then drop it into ANY character later.

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

## 🔒 Console-safe mode & the sanity check (READ THIS on PS4/PS5)
BL3 runs a **sanity check** when a character loads and **deletes items that couldn't drop naturally**: stacked parts, multiple anointments, impossible part combos. MODDED gear works on PC setups without the check, but **on PS4/PS5 it gets deleted**.

Console-safe mode is **on by default**:
* every item shows **✅ LEGIT**, **❔ UNVERIFIED** (no part list to check against; real drops are fine) or **🚫 WILL BE DELETED**
* **🩹 Fix** (per item, or fix-all from the red banner) repairs items so the game keeps them
* OP = level 72 + Mayhem 10 + best anointment + best-rated *real* parts. MODDED, kits, piñata and the ammo kit all produce legit gear
* Save warns you if anything would be deleted and offers to fix it first

The legit part lists cover about 420 items (most guns plus the generic shields/grenades/relics/COMs) and come from [sandsmark's editor](https://github.com/sandsmark/borderlands3-save-editor) data. The check was verified against real PS4 game-made items. Turn console-safe mode off in ⚙ Settings if you're on PC and want the chaos.

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
* **sandsmark**: [borderlands3-save-editor](https://github.com/sandsmark/borderlands3-save-editor): per-item legit part lists and real in-game part/anointment descriptions (from a community spreadsheet)
* **FromDarkHell**: [BL3SaveEditor](https://github.com/FromDarkHell/BL3SaveEditor) (GPL-3.0): PS4 keys, part names, part dependency data, anointment pools, demo save

Licensed under **GPL-3.0** (see `LICENSE`). Not affiliated with Gearbox or 2K.
