/**
 * main.js — Entry point
 * Orchestrates: config load → slide build → loader → parallax → i18n → music
 */

import { gsap }          from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis              from 'lenis';

import config            from '../config.json';
import { buildSlides }   from './slides.js';
import { initParallax, goToSlide, getActiveSlideIndex } from './parallax.js';
import { initLoader }    from './loader.js';
import { initI18n, switchLang, renderAll, getLang } from './i18n.js';
import { initMusic, setupMusicToggle, tryPlay } from './music.js';

gsap.registerPlugin(ScrollTrigger);

// One switch for every motion decision on the page (27)
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 2. Init i18n ─────────────────────────────────────────────
initI18n(config);

// ── 3. Build slide DOM ────────────────────────────────────────
buildSlides(config);
renderAll();

// ── 4. Init music ─────────────────────────────────────────────
initMusic(config);
setupMusicToggle();

// Unlock audio playback immediately on first user interaction anywhere
['click', 'wheel', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
  window.addEventListener(evt, () => tryPlay(), { passive: true });
});

// ── 6. Custom cursor ──────────────────────────────────────────
initCursor();

// ── 7. Language toggle & keyboard shortcut (Tab / L) ──────────
const initialLang = getLang();
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.lang === initialLang);
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchLang(lang);
  });
});

export function toggleLanguage() {
  const nextLang = getLang() === 'mr' ? 'en' : 'mr';
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === nextLang);
  });
  switchLang(nextLang);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key === 'l' || e.key === 'L') {
    e.preventDefault();
    toggleLanguage();
    tryPlay();
  }
});

// ── 8. Run opening loader, then boot site ─────────────────────
initLoader(config, config.slides, bootSite);


// ════════════════════════════════════════════════════════════════
function bootSite() {
  const app = document.getElementById('app');
  if (REDUCED) {
    app.style.opacity = '1';
  } else {
    gsap.to(app, { opacity: 1, duration: 0.6, ease: 'power2.out' });
  }

  // Show UI chrome
  document.getElementById('langToggle')?.classList.add('visible');
  document.getElementById('musicPlayer')?.classList.add('visible');

  // ── Lenis smooth scroll (vertical → mapped to horizontal) ───
  const lenis = new Lenis({
    orientation: 'vertical',
    gestureOrientation: 'both',
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 2.0,
    infinite: false,
    lerp: 0.085,
  });

  // Link Lenis scroll to GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  // Lenis → GSAP ticker
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Scroll events also try to unlock audio
  lenis.on('scroll', tryPlay);

  // ── Intro animation (content is visible by default in CSS) ──
  const introContent = document.querySelector('.intro-content');
  const scrollHint   = document.querySelector('.scroll-hint');
  if (!REDUCED) {
    gsap.from(introContent, { opacity: 0, y: 20, duration: 1.4, ease: 'power3.out', delay: 0.3 });
    gsap.from(scrollHint,   { opacity: 0,        duration: 1.0, ease: 'power2.out', delay: 1.4 });
  }

  // ── Init parallax engine ─────────────────────────────────────
  initParallax(lenis, config.slides.length);

  const totalSlides = document.querySelectorAll('#slidesTrack > .slide').length;

  // ── Auto-scroll after 10s of inactivity ──────────────────────
  const autoScrollDelay = (config.ui?.autoScrollSeconds || 10) * 1000;
  let autoScrollTimer = null;

  function resetAutoScroll() {
    clearTimeout(autoScrollTimer);
    if (REDUCED) return;
    autoScrollTimer = setTimeout(() => {
      const cur = getActiveSlideIndex();
      // If reached the end, loop back to the first photo slide (index 1)
      const next = (cur + 1) >= totalSlides ? 1 : (cur + 1);
      goToSlide(next);
      tryPlay();
      resetAutoScroll();
    }, autoScrollDelay);
  }

  resetAutoScroll();

  // Hold the auto-advance while the visitor is on a control
  const holdAutoScroll = () => clearTimeout(autoScrollTimer);
  [document.getElementById('musicPlayer'), document.getElementById('langToggle')]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener('mouseenter', holdAutoScroll);
      el.addEventListener('mouseleave', resetAutoScroll);
    });
  document.addEventListener('focusin', holdAutoScroll);
  document.addEventListener('focusout', resetAutoScroll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) holdAutoScroll();
    else resetAutoScroll();
  });

  // Reset timer on any user interaction
  lenis.on('scroll', resetAutoScroll);
  window.addEventListener('wheel', resetAutoScroll, { passive: true });
  window.addEventListener('touchmove', resetAutoScroll, { passive: true });
  window.addEventListener('touchstart', resetAutoScroll, { passive: true });
  window.addEventListener('keydown', resetAutoScroll, { passive: true });
  window.addEventListener('click', resetAutoScroll, { passive: true });

  // ── Touch swipe navigation for mobile ────────────────────────
  let touchStartX = 0;
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const diffX = touchStartX - e.changedTouches[0].clientX;
    const diffY = touchStartY - e.changedTouches[0].clientY;
    // If horizontal swipe is more significant than vertical
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
      const cur = getActiveSlideIndex();
      if (diffX > 0) {
        goToSlide(Math.min(cur + 1, totalSlides - 1));
      } else {
        goToSlide(Math.max(cur - 1, 0));
      }
      tryPlay();
      resetAutoScroll();
    }
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    const cur = getActiveSlideIndex();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const next = Math.min(cur + 1, totalSlides - 1);
      goToSlide(next);
      tryPlay();
      resetAutoScroll();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const prev = Math.max(cur - 1, 0);
      goToSlide(prev);
      tryPlay();
      resetAutoScroll();
    }
  });

  // ── Scroll hint hides after first scroll ────────────────────
  lenis.on('scroll', hideScrollHint, { once: true });
}

function hideScrollHint() {
  gsap.to('.scroll-hint', { opacity: 0, duration: 0.5 });
}

// ════════════════════════════════════════════════════════════════
function initCursor() {
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cursor';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = 0, my = 0;
  let rx = 0, ry = 0;
  let live = false;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.left  = mx + 'px';
    dot.style.top   = my + 'px';
    if (!live) { live = true; dot.classList.add('is-live'); ring.classList.add('is-live'); }
  });

  // Ring lags behind for smooth feel
  function animateRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  // Cursor grows on interactive elements (transform only, 10a)
  document.querySelectorAll('button, a').forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.classList.add('is-grow');
      ring.classList.add('is-grow');
    });
    el.addEventListener('mouseleave', () => {
      dot.classList.remove('is-grow');
      ring.classList.remove('is-grow');
    });
  });
}
