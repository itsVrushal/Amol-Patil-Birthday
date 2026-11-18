/**
 * slides.js — Builds the DOM for each photo slide from config.json
 * Each slide has 3 parallax layers:
 *   1. .slide__bg       — background photo (darkened, moves slowest)
 *   2. .slide__text     — title + caption (moves at medium speed)
 *   3. .slide__cutout   — AI-removed PNG (moves fastest, creates depth)
 *
 * Fully configurable via config.json:
 *   - textPosition: "left" | "right" | "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" (or object)
 *   - cutoutPosition: "right" | "left" | "center" | "bottom-right" | "bottom-left" | "bottom-center" (or object)
 *   - cutoutScale: e.g. 1.0, 0.9, 1.15
 *   - cutoutOffset: { x: 0, y: 0 } or { x: "-5vw", y: "2vh" }
 *   - textOffset: { x: 0, y: 0 }
 *   - parallaxIntensity: multiplier for parallax movement (default: 1.5)
 */

export function buildSlides(config) {
  const track = document.getElementById('slidesTrack');
  const outro = document.getElementById('slide-outro');
  if (!track) return;

  const defaultLang = config.site?.defaultLanguage || 'en';

  config.slides.forEach((slide, index) => {
    // 1. Text position & styles
    const textCfg = slide.textPosition || 'left';
    const { textClass, textInlineStyle } = parseTextPosition(textCfg, slide.textOffset);

    // 2. Cutout position & styles
    // Default cutout position opposes text position if not explicitly set
    const defaultCutoutPos = (typeof textCfg === 'string' && textCfg.includes('left')) ? 'right' : 'left';
    const cutoutCfg = slide.cutoutPosition || defaultCutoutPos;
    const { cutoutClass, cutoutInlineStyle, imgInlineStyle } = parseCutoutPosition(
      cutoutCfg,
      slide.cutoutScale,
      slide.cutoutOffset
    );

    // Background styling & offsets
    const bgUrl = `/images/originals/${bgJpg(slide.backgroundImage)}`;
    const cutoutSrc = `/images/cutouts/${cutoutWebp(slide.cutoutImage)}`;
    const isImmediate = index < 3;

    let bgInlineStyle = isImmediate ? `background-image: url('${bgUrl}');` : '';
    if (slide.backgroundPosition) {
      bgInlineStyle += ` background-position: ${slide.backgroundPosition};`;
    }
    const bgOffset = slide.backgroundOffset || slide.bgOffset;
    let bgOffsetX = 0;
    let bgOffsetY = 0;
    if (bgOffset) {
      if (bgOffset.x != null) bgOffsetX = bgOffset.x;
      if (bgOffset.y != null) bgOffsetY = bgOffset.y;
    } else {
      if (slide.bgOffsetX != null) bgOffsetX = slide.bgOffsetX;
      if (slide.bgOffsetY != null) bgOffsetY = slide.bgOffsetY;
    }

    const initialImgSrc = isImmediate
      ? cutoutSrc
      : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

    const section = document.createElement('section');
    section.className = `slide slide--photo`;
    section.id = slide.id;
    section.dataset.index = index;
    section.dataset.loaded = isImmediate ? 'true' : 'false';
    section.dataset.intensity = slide.parallaxIntensity != null ? slide.parallaxIntensity : 1.5;
    section.dataset.bgOffsetX = bgOffsetX;
    section.dataset.bgOffsetY = bgOffsetY;

    section.innerHTML = `
      <!-- Layer 1: Background Photo -->
      <div class="slide__bg" data-bg="${bgUrl}" style="${bgInlineStyle}"></div>

      <!-- Vignette Overlay -->
      <div class="slide__vignette"></div>

      <!-- Layer 2: Text Overlay -->
      <div class="${textClass}" style="${textInlineStyle}">
        <div class="accent-line fade-in-up"></div>
        <h2 class="slide__title fade-in-up"
            data-i18n-slide="${slide.id}" data-i18n-field="title">
          ${getLangVal(slide.title, defaultLang)}
        </h2>
        <p class="slide__caption fade-in-up"
           data-i18n-slide="${slide.id}" data-i18n-field="caption">
          ${getLangVal(slide.caption, defaultLang)}
        </p>
      </div>

      <!-- Layer 3: Foreground Person Cutout -->
      <div class="${cutoutClass}" style="${cutoutInlineStyle}">
        <div class="slide__cutout-inner">
          <div class="slide__cutout-wrap">
            <img
              src="${initialImgSrc}"
              data-src="${cutoutSrc}"
              alt="${getLangVal(slide.title, defaultLang)}"
              loading="${isImmediate ? 'eager' : 'lazy'}"
              decoding="async"
              style="${imgInlineStyle}"
              onerror="this.closest('.slide__cutout').style.display='none'"
            />
          </div>
        </div>
      </div>
    `;

    if (outro) {
      track.insertBefore(section, outro);
    } else {
      track.appendChild(section);
    }
  });
}

function parseTextPosition(pos, offset) {
  let textClass = 'slide__text';
  let textInlineStyle = '';

  if (typeof pos === 'string') {
    textClass += ` slide__text--${pos}`;
  } else if (typeof pos === 'object' && pos !== null) {
    if (pos.left)   textInlineStyle += `left: ${pos.left}; `;
    if (pos.right)  textInlineStyle += `right: ${pos.right}; `;
    if (pos.top)    textInlineStyle += `top: ${pos.top}; `;
    if (pos.bottom) textInlineStyle += `bottom: ${pos.bottom}; `;
    if (pos.align)  textInlineStyle += `text-align: ${pos.align}; `;
    if (pos.width)  textInlineStyle += `max-width: ${pos.width}; `;
  }

  if (offset) {
    const ox = typeof offset.x === 'number' ? `${offset.x}px` : (offset.x || '0');
    const oy = typeof offset.y === 'number' ? `${offset.y}px` : (offset.y || '0');
    textInlineStyle += `transform: translate(${ox}, ${oy}); `;
  }

  return { textClass, textInlineStyle };
}

function parseCutoutPosition(pos, scale, offset) {
  let cutoutClass = 'slide__cutout';
  let cutoutInlineStyle = '';
  let imgInlineStyle = '';

  if (typeof pos === 'string') {
    cutoutClass += ` slide__cutout--${pos}`;
  } else if (typeof pos === 'object' && pos !== null) {
    if (pos.left)   cutoutInlineStyle += `justify-content: flex-start; padding-left: ${pos.left}; `;
    if (pos.right)  cutoutInlineStyle += `justify-content: flex-end; padding-right: ${pos.right}; `;
    if (pos.top)    cutoutInlineStyle += `align-items: flex-start; padding-top: ${pos.top}; `;
    if (pos.bottom) cutoutInlineStyle += `align-items: flex-end; padding-bottom: ${pos.bottom}; `;
  }

  const transforms = [];
  if (scale != null && scale !== 1.0) {
    transforms.push(`scale(${scale})`);
  }
  if (offset) {
    const ox = typeof offset.x === 'number' ? `${offset.x}px` : (offset.x || '0');
    const oy = typeof offset.y === 'number' ? `${offset.y}px` : (offset.y || '0');
    transforms.push(`translate(${ox}, ${oy})`);
  }
  if (transforms.length > 0) {
    imgInlineStyle = `transform: ${transforms.join(' ')}; transform-origin: bottom center;`;
  }

  return { cutoutClass, cutoutInlineStyle, imgInlineStyle };
}

function getLangVal(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj['en'] || '';
}

// Return JPG filename even if original was JPG/JPEG
export function bgJpg(filename) {
  if (!filename) return '';
  return filename.replace(/\.(JPG|JPEG|jpeg)$/i, '.jpg');
}

export function cutoutWebp(filename) {
  if (!filename) return '';
  return filename.replace(/\.(png|PNG)$/i, '.webp');
}

export function ensureSlideLoaded(index) {
  const slides = document.querySelectorAll('#slidesTrack > .slide--photo');
  if (index < 0 || index >= slides.length) return;
  const slide = slides[index];
  if (!slide || slide.dataset.loaded === 'true') return;

  const bg = slide.querySelector('.slide__bg');
  if (bg && bg.dataset.bg && (!bg.style.backgroundImage || bg.style.backgroundImage === 'none')) {
    bg.style.backgroundImage = `url('${bg.dataset.bg}')`;
  }

  const img = slide.querySelector('.slide__cutout-wrap img');
  if (img && img.dataset.src && img.src !== img.dataset.src) {
    img.src = img.dataset.src;
  }

  slide.dataset.loaded = 'true';
}

export function loadSlideWindow(centerIdx, bufferBefore = 2, bufferAfter = 4) {
  const slides = document.querySelectorAll('#slidesTrack > .slide--photo');
  if (!slides || !slides.length) return;
  const start = Math.max(0, centerIdx - bufferBefore);
  const end = Math.min(slides.length - 1, centerIdx + bufferAfter);
  for (let i = start; i <= end; i++) {
    ensureSlideLoaded(i);
  }
}
