// One-off generator: insert entity-translation entries for the combat-potion
// ladder + the Eastbrook rare "Grix the Tunnelking" into src/ui/i18n.ts.
//
// These live in the positional `PHASE11_ITEM_IDS` / `PHASE11_MOB_IDS` arrays and a
// parallel `[...names]` array per locale (zipped by index; a runtime guard throws
// on length mismatch). Hand-editing 11 locale arrays in a ~12k-line file is slow
// and error-prone, so we append the new ids + each locale's name at the END of
// every array — appending keeps all existing positions byte-identical.
//
// Run: node scripts/i18n_add_potion_content.mjs
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('src/ui/i18n.ts');

// New ids, in append order. Item order must match the name order below.
const NEW_ITEM_IDS = [
  'lesser_healing_potion', 'lesser_mana_potion', 'healing_potion', 'mana_potion', 'tunnelkings_spade',
];
const NEW_MOB_IDS = ['grix_the_tunnelking'];

// Locale order of the 11 explicit phase11 blocks (es_ES/fr_CA/en_CA inherit).
const LOCALES = ['en', 'es', 'fr_FR', 'it_IT', 'de_DE', 'zh_CN', 'zh_TW', 'ko_KR', 'ja_JP', 'pt_BR', 'ru_RU'];

// [lesser_healing, lesser_mana, healing, mana, tunnelkings_spade]
const ITEM_NAMES = {
  en: ['Lesser Healing Potion', 'Lesser Mana Potion', 'Healing Potion', 'Mana Potion', "Tunnelking's Spade"],
  es: ['Poción inferior de sanación', 'Poción inferior de maná', 'Poción de sanación', 'Poción de maná', 'Pala del Rey del Túnel'],
  fr_FR: ['Potion de soins inférieure', 'Potion de mana inférieure', 'Potion de soins', 'Potion de mana', 'Pelle du Roi des tunnels'],
  it_IT: ['Pozione curativa inferiore', 'Pozione di mana inferiore', 'Pozione curativa', 'Pozione di mana', 'Vanga del Re dei tunnel'],
  de_DE: ['Schwacher Heiltrank', 'Schwacher Manatrank', 'Heiltrank', 'Manatrank', 'Spaten des Tunnelkönigs'],
  zh_CN: ['次级治疗药水', '次级法力药水', '治疗药水', '法力药水', '隧道之王的铲子'],
  zh_TW: ['次級治療藥水', '次級法力藥水', '治療藥水', '法力藥水', '隧道之王的鏟子'],
  ko_KR: ['중급 치유 물약', '중급 마나 물약', '치유 물약', '마나 물약', '땅굴왕의 삽'],
  ja_JP: ['中級回復ポーション', '中級マナポーション', '回復ポーション', 'マナポーション', 'トンネルキングのシャベル'],
  pt_BR: ['Poção de cura inferior', 'Poção de mana inferior', 'Poção de cura', 'Poção de mana', 'Pá do Rei dos Túneis'],
  ru_RU: ['Слабое зелье лечения', 'Слабое зелье маны', 'Зелье лечения', 'Зелье маны', 'Лопата Короля туннелей'],
};
const MOB_NAMES = {
  en: ['Grix the Tunnelking'],
  es: ['Grix el Rey del Túnel'],
  fr_FR: ['Grix le Roi des tunnels'],
  it_IT: ['Grix il Re dei tunnel'],
  de_DE: ['Grix der Tunnelkönig'],
  zh_CN: ['隧道之王格里克斯'],
  zh_TW: ['隧道之王格里克斯'],
  ko_KR: ['땅굴왕 그릭스'],
  ja_JP: ['トンネルキング・グリックス'],
  pt_BR: ['Grix, o Rei dos Túneis'],
  ru_RU: ['Грикс, Король туннелей'],
};

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('lesser_healing_potion')) {
  console.error('i18n already contains lesser_healing_potion — aborting (already applied).');
  process.exit(1);
}

const quote = (s) => `"${s.replace(/"/g, '\\"')}"`;

// 1) Append ids to the two `const PHASE11_*_IDS = [ ... ] as const;` arrays.
function appendIds(text, constName, ids) {
  const start = text.indexOf(`const ${constName} = [`);
  if (start < 0) throw new Error(`${constName} not found`);
  const close = text.indexOf('] as const;', start);
  if (close < 0) throw new Error(`${constName} closer not found`);
  const line = '  ' + ids.map((id) => `'${id}'`).join(', ') + ',\n';
  return text.slice(0, close) + line + text.slice(close);
}
src = appendIds(src, 'PHASE11_ITEM_IDS', NEW_ITEM_IDS);
src = appendIds(src, 'PHASE11_MOB_IDS', NEW_MOB_IDS);

// 2) Walk the phase11 name arrays in order and append each locale's names before
//    the `], 'item'),` / `], 'mob'),` closer. There are exactly 11 of each, in
//    LOCALES order.
function appendNames(text, label, namesByLocale) {
  const lines = text.split('\n');
  const closerRe = new RegExp(`^(\\s*)\\],\\s*'${label}'\\),\\s*$`);
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(closerRe);
    if (!m) continue;
    const locale = LOCALES[idx];
    if (!locale) throw new Error(`More '${label}' closers than locales (${idx + 1})`);
    const indent = m[1] + '  ';
    const names = namesByLocale[locale].map(quote).join(', ');
    lines.splice(i, 0, `${indent}${names},`);
    i++; // skip the line we just inserted
    idx++;
  }
  if (idx !== LOCALES.length) throw new Error(`Expected ${LOCALES.length} '${label}' arrays, found ${idx}`);
  return lines.join('\n');
}
src = appendNames(src, 'item', ITEM_NAMES);
src = appendNames(src, 'mob', MOB_NAMES);

fs.writeFileSync(FILE, src);
console.log(`Inserted ${NEW_ITEM_IDS.length} items + ${NEW_MOB_IDS.length} mob across ${LOCALES.length} locales.`);
