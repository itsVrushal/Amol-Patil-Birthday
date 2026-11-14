/**
 * i18n.js — Bilingual support (English + Marathi)
 * Reads from config and swaps all [data-i18n] elements on language toggle.
 */

let currentLang = 'en';
let configData  = null;

export function initI18n(config) {
  configData  = config;
  currentLang = config.site.defaultLanguage || 'en';
}

export function getLang() { return currentLang; }

export function t(keyPath, lang = currentLang) {
  const keys = keyPath.split('.');
  let val = configData;
  for (const k of keys) {
    if (val == null) return keyPath;
    val = val[k];
  }
  if (val && typeof val === 'object') {
    return val[lang] || val['en'] || keyPath;
  }
  return val ?? keyPath;
}

export function switchLang(lang, onSwitch) {
  currentLang = lang;
  renderAll();
  if (onSwitch) onSwitch(lang);
}

export function renderAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  // Slide-specific text (title, caption, year per slide)
  document.querySelectorAll('[data-i18n-slide]').forEach(el => {
    const slideId  = el.getAttribute('data-i18n-slide');
    const field    = el.getAttribute('data-i18n-field');
    const slide    = configData.slides.find(s => s.id === slideId);
    if (!slide) return;
    const val = slide[field];
    if (val && typeof val === 'object') {
      el.textContent = val[currentLang] || val['en'] || '';
    } else if (val) {
      el.textContent = val;
    }
  });

  // Update html lang attribute
  document.documentElement.lang = currentLang === 'mr' ? 'mr' : 'en';
}
