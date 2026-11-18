/**
 * loader.js — Opening animation: a fanned stack of images deals in,
 * then fans out as the site reveals beneath.
 *
 * Animation sequence:
 *   1. Cards stack up from behind (staggered, slight rotation)
 *   2. Cards fan like a deck of playing cards
 *   3. Father's name fades in below
 *   4. User clicks or waits → cards scatter, loader lifts up → site enters
 */

import { gsap } from 'gsap';
import { bgJpg, cutoutWebp } from './slides.js';

const SHOW_DURATION = 1200; // ms before auto-dismiss (after fan anim)
const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initLoader(config, slides, siteReadyPromise, onDismiss) {
  const loaderEl = document.getElementById('loader');
  const stackEl = document.getElementById('loaderStack');
  const nameEl = document.getElementById('loaderName');
  const titleEl = document.querySelector('.loader-title');
  const preloaderEl = document.getElementById('loaderPre');
  const progressBar = document.getElementById('loaderProgressBar');
  const statusText = document.getElementById('loaderStatusText');

  // Under reduced motion the story serves itself: no loader, straight in (27)
  if (!loaderEl || !stackEl || REDUCED) {
    if (loaderEl) loaderEl.style.display = 'none';
    if (onDismiss) onDismiss();
    return;
  }

  // Set father's name
  const lang = document.documentElement.lang || config.site.defaultLanguage || 'en';
  if (nameEl) {
    nameEl.textContent = (config.site.title && (config.site.title[lang] || config.site.title['en'])) || 'Amol Patil';
  }

  // Pick up to 7 slides for the stack (spread from centre of list)
  const preview = pickPreviewSlides(slides, 7);

  // Build card elements
  preview.forEach((slide) => {
    const card = document.createElement('div');
    card.className = 'loader-card';
    const img = document.createElement('img');
    img.src = `/images/originals/${bgJpg(slide.backgroundImage)}`;
    img.alt = '';
    img.loading = 'eager';
    card.appendChild(img);
    stackEl.appendChild(card);
  });

  const cards = Array.from(stackEl.querySelectorAll('.loader-card'));

  // ── Initial state: cards stacked in centre, invisible ─────────
  gsap.set(cards, {
    opacity: 0,
    scale: 0.75,
    rotationZ: 0,
    xPercent: -50,
    yPercent: -50,
    left: '50%',
    top: '50%',
    position: 'absolute'
  });
  if (titleEl) {
    gsap.set(titleEl, { opacity: 0, y: 18 });
  }

  // ── Preload 7 card images so collage deals with crisp images ──
  const cardUrls = preview.map(s => `/images/originals/${bgJpg(s.backgroundImage)}`);
  let cardsLoaded = 0;
  const totalCards = cardUrls.length;

  function advanceCardProgress() {
    cardsLoaded++;
    const pct = Math.min(100, Math.round((cardsLoaded / totalCards) * 100));
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
    }
  }

  // Dismiss controller
  let dismissed = false;
  let tl = null;
  let swayTween = null;

  const triggerDismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (tl) tl.kill();
    if (swayTween) swayTween.kill();
    window.removeEventListener('wheel', triggerDismiss);
    window.removeEventListener('keydown', triggerDismiss);
    window.removeEventListener('touchstart', triggerDismiss);
    dismissLoader(cards, loaderEl, onDismiss);
  };

  loaderEl.addEventListener('click', triggerDismiss, { once: true });
  window.addEventListener('wheel', triggerDismiss, { once: true, passive: true });
  window.addEventListener('keydown', triggerDismiss, { once: true });
  window.addEventListener('touchstart', triggerDismiss, { once: true, passive: true });

  // Preload card images
  const cardPromises = cardUrls.map(url => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = () => {
        advanceCardProgress();
        resolve();
      };
      img.src = url;
    });
  });

  // Safety timer for collage cards (3.0s max wait)
  let cardSafetyFired = false;
  const cardSafetyTimer = setTimeout(() => {
    cardSafetyFired = true;
    startCardsCelebration();
  }, 3000);

  Promise.all(cardPromises).then(() => {
    if (!cardSafetyFired) {
      clearTimeout(cardSafetyTimer);
      startCardsCelebration();
    }
  });

  function startCardsCelebration() {
    if (dismissed) return;

    if (progressBar) progressBar.style.width = '100%';

    // Smoothly fade out the preloader ring and bar
    if (preloaderEl) {
      gsap.to(preloaderEl, {
        opacity: 0,
        scale: 0.92,
        duration: 0.45,
        ease: 'power2.inOut',
        onComplete: () => {
          preloaderEl.style.display = 'none';
        }
      });
    }

    // ── Build & run cards fan timeline ──
    tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    // Step 1: Cards deal in, staggered
    tl.to(cards, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      stagger: 0.08,
    });

    // Step 2: Fan out wide like a hand of dealt photographs
    const total = cards.length;
    tl.to(cards, {
      rotationZ: (i) => ((i - (total - 1) / 2) * 6.5),
      x: (i) => ((i - (total - 1) / 2) * 90),
      y: (i) => Math.pow(Math.abs(i - (total - 1) / 2), 1.4) * 8,
      scale: (i) => 1.0 - Math.abs(i - (total - 1) / 2) * 0.03,
      duration: 1.0,
      stagger: 0.05,
      ease: 'power3.out',
    }, '-=0.2');

    // Step 3: Name appears
    tl.to(titleEl, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.3');

    // Step 4: Keep collage visible until webapp is 100% loaded & ready!
    tl.call(() => {
      // Gentle breathing floating motion while cards hold on screen
      swayTween = gsap.to(cards, {
        y: (i) => Math.pow(Math.abs(i - (total - 1) / 2), 1.4) * 8 + ((i % 2 === 0) ? 6 : -6),
        duration: 3.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      // Wait for BOTH:
      // 1. Minimum display time (1400ms) to admire the cards & golden title
      // 2. AND the webapp behind being 100% booted, decoded, and ready!
      const minDisplayPromise = new Promise(res => setTimeout(res, SHOW_DURATION));
      const readyPromise = siteReadyPromise ? Promise.resolve(siteReadyPromise) : Promise.resolve();

      Promise.all([minDisplayPromise, readyPromise]).then(() => {
        triggerDismiss();
      });
    });
  }
}

function dismissLoader(cards, loaderEl, onDismiss) {
  const tl = gsap.timeline({
    onComplete: () => {
      loaderEl.style.display = 'none';
      if (onDismiss) onDismiss();
    }
  });

  // Cards scatter outward
  tl.to(cards, {
    opacity: 0,
    scale: 1.2,
    y: (i) => (Math.random() - 0.5) * 300,
    x: (i) => (Math.random() - 0.5) * 400,
    rotationZ: (i) => (Math.random() - 0.5) * 60,
    duration: 0.5,
    stagger: { amount: 0.2, from: 'center' },
    ease: 'power3.in',
  });

  // Loader slides up and out
  tl.to(loaderEl, {
    yPercent: -105,
    duration: 0.7,
    ease: 'expo.inOut',
  }, '-=0.2');
}

function pickPreviewSlides(slides, n) {
  if (slides.length <= n) return slides;
  const step = Math.floor(slides.length / n);
  return Array.from({ length: n }, (_, i) => slides[i * step]);
}
