#!/usr/bin/env python3
"""
Builds js/data.js from the files in tools/sources/.

Sources (see README "Credits"):
  * inventoryserialdb / balance_name_mapping / balance_to_inv_key / apoc_consts
      -> apocalyptech/bl3-cli-saveedit (zlib license)
  * fdh_* -> FromDarkHell/BL3SaveEditor (GPLv3)
  * *.proto -> Gibbed / apocalyptech protobuf definitions

Usage: python3 tools/build_data.py
"""
import json
import lzma
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sources')
OUT = os.path.join(HERE, '..', 'js', 'data.js')


def load(name):
    with lzma.open(os.path.join(SRC, name), 'rt', encoding='utf-8') as f:
        return json.load(f)


def short(path):
    return path.split('.')[-1] if '.' in path else path.split('/')[-1]


# ---------------------------------------------------------------- protobufs
SCALARS = {'int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64', 'bool',
           'string', 'bytes', 'float', 'double', 'fixed32', 'fixed64',
           'sfixed32', 'sfixed64'}


def parse_proto(text, schema):
    """Very small .proto parser, good enough for the BL3 definitions."""
    text = re.sub(r'//[^\n]*', '', text)
    tokens = re.findall(r'[A-Za-z_][A-Za-z0-9_.]*|\d+|[{};=]', text)
    i = 0
    stack = []
    enums = set()
    while i < len(tokens):
        t = tokens[i]
        if t in ('message', 'enum'):
            name = tokens[i + 1]
            stack.append((t, name))
            if t == 'message':
                schema[name] = {}
            else:
                enums.add(name)
            i += 3
            continue
        if t == '}':
            stack.pop()
            i += 1
            continue
        if t in ('syntax', 'package', 'import'):
            while tokens[i] != ';':
                i += 1
            i += 1
            continue
        if stack and stack[-1][0] == 'enum':
            # NAME = N ;
            i += 4
            continue
        if stack and stack[-1][0] == 'message':
            repeated = False
            if t == 'repeated':
                repeated = True
                i += 1
            ftype = tokens[i]
            fname = tokens[i + 1]
            assert tokens[i + 2] == '='
            fnum = int(tokens[i + 3])
            assert tokens[i + 4] == ';'
            i += 5
            schema[stack[-1][1]][fnum] = [fname, ftype, 1 if repeated else 0]
            continue
        i += 1
    return enums


def build_schema():
    schema = {}
    enums = set()
    for f in ('OakShared.proto', 'OakSave.proto', 'OakProfile.proto'):
        with open(os.path.join(SRC, f)) as df:
            enums |= parse_proto(df.read(), schema)
    # resolve enums -> int32 ; check all types are known
    for msg, fields in schema.items():
        for num, f in fields.items():
            if f[1] in enums:
                f[1] = 'enum'
            elif f[1] not in SCALARS and f[1] not in schema:
                raise Exception('Unknown type {} in {}'.format(f[1], msg))
    return schema


# ---------------------------------------------------------------- item data
def classify(bal_lower):
    b = bal_lower
    if '/classmods/' in b or 'classmod' in b.split('/')[-1] or '_cm_' in b:
        return 'com'
    if '/artifacts/' in b or 'artifact' in b.split('/')[-1]:
        return 'relic'
    if '/shields/' in b or 'shield' in b.split('/')[-1]:
        return 'shield'
    if '/grenademods/' in b or 'grenademod' in b.split('/')[-1] or '_gm_' in b:
        return 'grenade'
    if '/weapon' in b or 'balance_' in b.split('/')[-1]:
        return 'weapon'
    return 'other'


WTYPES = [('_ar_', 'Assault Rifle'), ('_sm_', 'SMG'), ('_smg', 'SMG'), ('_ps_', 'Pistol'),
          ('_pistol', 'Pistol'), ('_sg_', 'Shotgun'), ('_shotgun', 'Shotgun'),
          ('_sr_', 'Sniper'), ('_hw_', 'Heavy'), ('heavy', 'Heavy')]
MANUS = [('atlas', 'Atlas'), ('_atl', 'Atlas'), ('childrenofthevault', 'COV'), ('_cov', 'COV'),
         ('dahl', 'Dahl'), ('_dal', 'Dahl'), ('hyperion', 'Hyperion'), ('_hyp', 'Hyperion'),
         ('jakobs', 'Jakobs'), ('_jak', 'Jakobs'), ('maliwan', 'Maliwan'), ('_mal', 'Maliwan'),
         ('tediore', 'Tediore'), ('_ted', 'Tediore'), ('torgue', 'Torgue'), ('_tor', 'Torgue'),
         ('vladof', 'Vladof'), ('_vla', 'Vladof'), ('anshin', 'Anshin'), ('_ans', 'Anshin'),
         ('pangolin', 'Pangolin'), ('_pan', 'Pangolin'), ('eridian', 'Eridian')]


def wtype(bal_lower, invkey):
    s = '/' + bal_lower.split('/')[-1] + '_'
    k = (invkey or '').lower() + '_'
    for tok, name in WTYPES:
        if tok in s or tok in '_' + k:
            return name
    for tok, name in [('/assaultrifles/', 'Assault Rifle'), ('/smgs/', 'SMG'), ('/pistols/', 'Pistol'),
                      ('/shotguns/', 'Shotgun'), ('/sniperrifles/', 'Sniper'), ('/heavyweapons/', 'Heavy')]:
        if tok in bal_lower:
            return name
    if 'smg' in k:
        return 'SMG'
    if 'pistol' in k:
        return 'Pistol'
    if 'shotgun' in k:
        return 'Shotgun'
    return ''


def manufacturer(bal_lower, invkey, name, kind):
    if kind == 'relic':
        return 'Artifact'
    if kind == 'com':
        return 'ClassMod'
    toks = set(re.split(r'[_/.]', bal_lower))
    if kind == 'weapon':
        toks |= set(re.split(r'_', (invkey or '').lower()))
    for tok, m in MANUS:
        if tok.strip('_') in toks:
            return m
    words = set(re.split(r'[^a-z]+', (name or '').lower()))
    for tok, m in MANUS:
        if len(tok.strip('_')) > 3 and tok.strip('_') in words:
            return m
    return ''


def rarity(bal_lower, name):
    s = bal_lower.split('/')[-1] + ' ' + (name or '').lower()
    for tok, r in [('legendary', 5), ('_05', 5), ('veryrare', 4), ('very_rare', 4), ('purple', 4),
                   ('_04', 4), ('rare', 3), ('blue', 3), ('_03', 3), ('uncommon', 2), ('green', 2),
                   ('_02', 2), ('common', 1), ('white', 1), ('_01', 1)]:
        if tok in s:
            return r
    if '_unique' in bal_lower or '/unique' in bal_lower or 'patchdlc' in bal_lower:
        return 5
    return 5


def main():
    serialdb = load('inventoryserialdb.json.xz')
    names = load('balance_name_mapping.json.xz')
    invkeys = load('balance_to_inv_key.json.xz')
    consts = load('apoc_consts.json.xz')
    partnames = load('fdh_part_name_mapping.json.xz')
    prefixnames = load('fdh_prefix_name_mapping.json.xz')
    bal2inv = load('fdh_balance_to_inv_data.json.xz')
    validparts = load('fdh_valid_part_database.json.xz')
    pools = load('fdh_generic_pools.json.xz')

    invdata_assets = serialdb['InventoryData']['assets']
    invdata_by_short = {}
    for idx, a in enumerate(invdata_assets):
        invdata_by_short.setdefault(short(a).lower(), idx)

    # balance -> invdata index (into InventoryData assets)
    bal_invdata = {}
    for bal, inv in bal2inv.items():
        idx = invdata_by_short.get(inv.lower())
        if idx is not None:
            bal_invdata[bal.lower()] = idx

    # Catalog of named, creatable items
    catalog = []
    bal_assets = serialdb['InventoryBalanceData']['assets']
    for full in bal_assets:
        low = full.lower()
        base = low.rsplit('.', 1)[0]
        name = names.get(base)
        key = invkeys.get(low)
        if not name or not key:
            continue
        if low not in bal_invdata:
            continue
        kind = classify(low)
        if kind == 'other':
            continue
        if 'fabricator' in low:
            continue
        catalog.append({
            'b': full,
            'n': name,
            'k': kind,
            't': wtype(low, key) if kind == 'weapon' else '',
            'm': manufacturer(low, key, name, kind),
            'r': rarity(low, name),
        })
    catalog.sort(key=lambda c: (c['k'], -c['r'], c['n']))

    deps = {}
    for part, info in validparts.items():
        d = [short(x) for x in info.get('Dependencies', [])]
        e = [short(x) for x in info.get('Excluders', [])]
        if d or e:
            deps[short(part)] = [d, e]

    keep_consts = [
        'class_to_eng', 'classobj_to_class', 'currency_to_curhash', 'slot_to_eng', 'slotobj_to_slot',
        'sdu_to_eng', 'sduobj_to_sdu', 'sdu_to_max', 'psdu_to_eng', 'psduobj_to_psdu', 'psdu_to_max',
        'ammo_to_eng', 'ammoobj_to_ammo', 'ammo_to_max', 'challenge_to_eng', 'challenge_char_lock',
        'challengeobj_to_challenge', 'level_stat', 'level_challenges', 'required_xp_list', 'max_level',
        'mayhem_part_to_lvl', 'mayhem_invdata_types', 'anointable_invdata_types',
        'guardian_rank_rewards', 'vehicle_to_eng', 'vehicle_chassis', 'vehicle_parts', 'vehicle_skins',
        'chassis_excluders', 'goldenkey_category', 'diamondkey_category', 'vaultcard1key_category',
        'vaultcard2key_category', 'vaultcard3key_category', '_weapon_cust_crc32_table',
        'profile_skins', 'profile_heads', 'profile_echothemes', 'profile_emotes',
        'profile_roomdeco_obj_to_eng', 'profile_weaponskins_obj_to_eng',
        'profile_weapontrinkets_obj_to_eng', 'map_to_eng', 'pet_to_eng', 'petkey_to_pet',
        'cube_puzzle_stat',
    ]
    c = {k: consts[k] for k in keep_consts}

    data = {
        'serialdb': serialdb,
        'names': names,
        'invkeys': invkeys,
        'balInvData': bal_invdata,
        'partNames': {short(k): v for k, v in partnames.items()},
        'prefixNames': {short(k): v for k, v in prefixnames.items()},
        'partRules': deps,
        'anointPools': {k: [short(x) for x in v] for k, v in pools.items()},
        'catalog': catalog,
        'consts': c,
        'schema': build_schema(),
    }
    js = ('/* Generated by tools/build_data.py - do not edit by hand. */\n'
          'window.BL3_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print('wrote', OUT, len(js), 'bytes; catalog', len(catalog), 'items')
    from collections import Counter
    print(Counter(x['k'] for x in catalog))


if __name__ == '__main__':
    main()
