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

  config.slides.forEach((slide) => {
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

    const section = document.createElement('section');
    section.className = `slide slide--photo`;
    section.id = slide.id;
    section.dataset.index = config.slides.indexOf(slide);
    section.dataset.intensity = slide.parallaxIntensity != null ? slide.parallaxIntensity : 1.5;

    section.innerHTML = `
      <!-- Layer 1: Background Photo -->
      <div class="slide__bg" style="background-image: url('/images/originals/${bgJpg(slide.backgroundImage)}')"></div>

      <!-- Vignette Overlay -->
      <div class="slide__vignette"></div>

      <!-- Layer 2: Text Overlay -->
      <div class="${textClass}" style="${textInlineStyle}">
        <div class="accent-line fade-in-up"></div>
        <p class="slide__year fade-in-up"
           data-i18n-slide="${slide.id}" data-i18n-field="year">${slide.year || ''}</p>
        <h2 class="slide__title fade-in-up"
            data-i18n-slide="${slide.id}" data-i18n-field="title">
          ${getLangVal(slide.title, 'en')}
        </h2>
        <p class="slide__caption fade-in-up"
           data-i18n-slide="${slide.id}" data-i18n-field="caption">
          ${getLangVal(slide.caption, 'en')}
        </p>
      </div>

      <!-- Layer 3: Foreground Person Cutout -->
      <div class="${cutoutClass}" style="${cutoutInlineStyle}">
        <img
          src="/images/cutouts/${slide.cutoutImage}"
          alt="${getLangVal(slide.title, 'en')}"
          loading="eager"
          style="${imgInlineStyle}"
          onerror="this.parentElement.style.display='none'"
        />
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
function bgJpg(filename) {
  return filename.replace(/\.(JPG|JPEG|jpeg)$/i, '.jpg');
}
