/**
 * parallax.js — 3-layer horizontal parallax engine
 * Uses GSAP ScrollTrigger pinning + per-layer translateX offsets.
 *
 * Layer speeds (relative to scroll progress):
 *   BG      → moves at  0.7x  (slowest — far away)
 *   Text    → moves at  1.0x  (base speed)
 *   Cutout  → moves at  1.25x (fastest — closest to viewer)
 *
 * This creates the depth / parallax illusion.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const BG_SPEED     = 0.70;   // how much the BG lags behind scroll
const TEXT_OFFSET  = 80;     // px the text leads ahead of scroll
const CUTOUT_SPEED = 1.25;   // how much the cutout races ahead

let lenis = null;
let mainTrackAnim = null;
let registeredTotalSlides = 0;

function getTrackMetrics() {
  const track = document.getElementById('slidesTrack');
  const container = document.getElementById('scrollContainer') || document.documentElement;
  const viewW = container.clientWidth || window.innerWidth;
  const totalW = track ? track.scrollWidth : (viewW * 101);
  const scrollDist = Math.max(1, totalW - viewW);
  return { track, container, viewW, totalW, scrollDist };
}

export function initParallax(lenisInstance, totalSlides) {
  lenis = lenisInstance;
  registeredTotalSlides = totalSlides;
  const { track } = getTrackMetrics();
  if (!track) return;

  // ── 1. Pin the scroll container, translate on scroll ────────
  const trackAnim = gsap.to(track, {
    id: 'track-anim',
    x: () => {
      const { scrollDist } = getTrackMetrics();
      return -scrollDist;
    },
    ease: 'none',
    scrollTrigger: {
      id: 'main-scroll',
      trigger: '#scrollContainer',
      start: 'top top',
      end:   () => {
        const { scrollDist } = getTrackMetrics();
        return `+=${scrollDist}`;
      },
      scrub: true,
      pin:   true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateParallaxLayers(self.progress, totalSlides),
    }
  });
  mainTrackAnim = trackAnim;

  // ── 2. Slide-in animations for text elements ─────────────────
  document.querySelectorAll('.slide--photo').forEach((slide, i) => {
    const textEls = slide.querySelectorAll('.fade-in-up');
    
    // First slide text is ready immediately; subsequent slides animate in as you scroll
    if (i === 0) {
      gsap.set(textEls, { opacity: 1, y: 0 });
    } else {
      gsap.set(textEls, { opacity: 0, y: 25 });
    }

    ScrollTrigger.create({
      trigger: slide,
      containerAnimation: trackAnim,
      start: 'left 95%',
      end: 'right 5%',
      onEnter: () => {
        gsap.to(textEls, {
          opacity: 1, y: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      },
      onEnterBack: () => {
        gsap.to(textEls, {
          opacity: 1, y: 0,
          duration: 0.8,
          stagger: 0.06,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }
    });
  });

  window.addEventListener('resize', () => ScrollTrigger.refresh());
  setTimeout(() => ScrollTrigger.refresh(), 200);
  setTimeout(() => ScrollTrigger.refresh(), 800);

  // Start drift if initialized on a photo slide
  if (currentActiveIndex > 0) {
    triggerCutoutDrift(currentActiveIndex, 1);
  }
}

function updateParallaxLayers(progress, totalSlides) {
  const { track, scrollDist } = getTrackMetrics();
  if (!track) return;

  // Current scroll amount in pixels
  const scrolledPx = progress * scrollDist;

  document.querySelectorAll('.slide--photo').forEach((slide) => {
    const slideLeft = slide.offsetLeft;
    // How far this slide is from the viewport centre
    const relPos    = slideLeft - scrolledPx;
    const intensity = parseFloat(slide.dataset.intensity || 1.0);

    const bgEl     = slide.querySelector('.slide__bg');
    const textEl   = slide.querySelector('.slide__text');
    const cutoutEl = slide.querySelector('.slide__cutout');

    // Background — moves slower (lags behind in the distance)
    if (bgEl) {
      const offsetX = parseCssUnit(slide.dataset.bgOffsetX, window.innerWidth);
      const offsetY = parseCssUnit(slide.dataset.bgOffsetY, window.innerHeight);
      const bgX = -(relPos * 0.18 * intensity) + offsetX;
      bgEl.style.transform = `translate(${bgX}px, ${offsetY}px)`;
    }

    // Text — mid-ground floating movement
    if (textEl) {
      const txtX = -(relPos * 0.04 * intensity);
      textEl.style.transform = `translateX(${txtX}px)`;
    }

    // Cutout — foreground, moves faster (surges forward towards viewer, creating bold 3D depth)
    if (cutoutEl) {
      const cutX = (relPos * 0.22 * intensity);
      cutoutEl.style.transform = `translateX(${cutX}px)`;
    }
  });

  // Update dots + counter
  updateNav(progress, totalSlides);
}

let currentActiveIndex = 0;
let isNavigating = false;
let navTimeout = null;

export function getActiveSlideIndex() {
  return currentActiveIndex;
}

export function triggerCutoutDrift(activeIdx, dir = 1) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCED) return;

  const slides = document.querySelectorAll('#slidesTrack > .slide');
  const targetSlide = slides[activeIdx];

  // Gracefully settle all other slide cutouts so only the active slide is actively drifting
  document.querySelectorAll('.slide__cutout-inner').forEach(inner => {
    if (!targetSlide || !targetSlide.contains(inner)) {
      gsap.killTweensOf(inner);
      gsap.to(inner, { x: 0, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    }
  });

  if (!targetSlide || !targetSlide.classList.contains('slide--photo')) return;

  const cutoutInner = targetSlide.querySelector('.slide__cutout-inner');
  if (!cutoutInner) return;

  gsap.killTweensOf(cutoutInner);

  // Subtle drift distance (10px - 18px) based on viewport width
  const driftDist = Math.min(18, Math.max(10, window.innerWidth * 0.012));
  
  // Forward motion (slides enter from right): cutout glides subtly to the left
  // Backward motion (slides enter from left): cutout glides subtly to the right
  const startX  = dir >= 0 ? driftDist : -driftDist;
  const targetX = dir >= 0 ? -driftDist : driftDist;

  // Set initial subtle offset in motion direction
  gsap.set(cutoutInner, { x: startX });

  // Keep moving horizontally very subtly throughout the slide presentation
  gsap.to(cutoutInner, {
    x: targetX,
    duration: 8.5,
    ease: 'power1.out',
    overwrite: 'auto',
    onComplete: () => {
      // If remaining on the slide longer, continue moving in a subtle gentle sway
      const swayTarget = targetX + (dir >= 0 ? (driftDist * 0.5) : -(driftDist * 0.5));
      gsap.to(cutoutInner, {
        x: swayTarget,
        duration: 5.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }
  });
}

function updateNav(progress, totalSlides) {
  const slides  = document.querySelectorAll('#slidesTrack > .slide');
  const { scrollDist } = getTrackMetrics();
  const scrolled = progress * scrollDist;

  // Find the slide whose offsetLeft is closest to scrolled
  let activeIdx = 0;
  let minDiff = Infinity;
  slides.forEach((slide, i) => {
    const diff = Math.abs(slide.offsetLeft - scrolled);
    if (diff < minDiff) {
      minDiff = diff;
      activeIdx = i;
    }
  });
  
  if (!isNavigating && activeIdx !== currentActiveIndex) {
    const dir = activeIdx > currentActiveIndex ? 1 : -1;
    currentActiveIndex = activeIdx;
    triggerCutoutDrift(activeIdx, dir);
  } else if (!isNavigating) {
    currentActiveIndex = activeIdx;
  }

  // Counter (only counts photo slides, skip intro/outro)
  const photoIdx = activeIdx - 1; // subtract intro
  const counterCur = document.querySelector('.counter-current');
  const counterTot = document.querySelector('.counter-total');
  if (counterCur) {
    // Never leave a stale end value: intro reads 01, outro reads the last slide
    const shown = photoIdx < 0 ? 1 : Math.min(photoIdx + 1, totalSlides);
    counterCur.textContent = String(shown).padStart(2, '0');
  }
  if (counterTot) {
    counterTot.textContent = String(totalSlides).padStart(2, '0');
  }
}

export function goToSlide(index, immediate = false) {
  const slides = document.querySelectorAll('#slidesTrack > .slide');
  const total = slides.length;
  if (total === 0) return;

  const safeIdx = Math.max(0, Math.min(total - 1, index));
  const targetSlide = slides[safeIdx];
  if (!targetSlide) return;

  const dir = safeIdx >= currentActiveIndex ? 1 : -1;
  currentActiveIndex = safeIdx;
  isNavigating = true;
  clearTimeout(navTimeout);
  navTimeout = setTimeout(() => { isNavigating = false; }, immediate ? 50 : 1600);

  triggerCutoutDrift(safeIdx, dir);

  // Exact target in pixels matching this slide's offsetLeft
  const target = targetSlide.offsetLeft;
  const { scrollDist } = getTrackMetrics();
  const progress = Math.min(1, Math.max(0, target / (scrollDist || 1)));

  if (immediate) {
    lenis?.scrollTo(target, { immediate: true });
    if (mainTrackAnim) {
      mainTrackAnim.progress(progress);
    }
    updateParallaxLayers(progress, registeredTotalSlides);
    
    // Ensure active slide text is fully visible immediately
    targetSlide.querySelectorAll('.fade-in-up').forEach(el => {
      gsap.set(el, { opacity: 1, y: 0 });
    });
    isNavigating = false;
  } else {
    lenis?.scrollTo(target, {
      duration: 1.4,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      onComplete: () => {
        isNavigating = false;
        clearTimeout(navTimeout);
      }
    });
  }
}

function parseCssUnit(val, dimension) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const s = String(val).trim();
  if (s.endsWith('vw')) return (parseFloat(s) / 100) * window.innerWidth;
  if (s.endsWith('vh')) return (parseFloat(s) / 100) * window.innerHeight;
  if (s.endsWith('%')) return (parseFloat(s) / 100) * dimension;
  if (s.endsWith('px')) return parseFloat(s);
  return parseFloat(s) || 0;
}

if (typeof window !== 'undefined') {
  window.goToSlide = goToSlide;
}
