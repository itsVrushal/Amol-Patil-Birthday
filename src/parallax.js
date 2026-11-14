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

export function initParallax(lenisInstance, totalSlides) {
  lenis = lenisInstance;
  const track     = document.getElementById('slidesTrack');
  const totalW    = track.scrollWidth;
  const viewW     = window.innerWidth;
  const scrollDist = totalW - viewW;

  // ── 1. Pin the scroll container, translate on scroll ────────
  const trackAnim = gsap.to(track, {
    id: 'track-anim',
    x: () => -(scrollDist),
    ease: 'none',
    scrollTrigger: {
      id: 'main-scroll',
      trigger: '#scrollContainer',
      start: 'top top',
      end:   () => `+=${scrollDist}`,
      scrub: 1.2,
      pin:   true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateParallaxLayers(self.progress, totalSlides),
    }
  });

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
}

function updateParallaxLayers(progress, totalSlides) {
  const track  = document.getElementById('slidesTrack');
  const totalW = track.scrollWidth;
  const viewW  = window.innerWidth;

  // Current scroll amount in pixels
  const scrolledPx = progress * (totalW - viewW);

  document.querySelectorAll('.slide--photo').forEach((slide, i) => {
    const slideLeft = slide.offsetLeft;
    // How far this slide is from the viewport centre
    const relPos    = slideLeft - scrolledPx;
    const intensity = parseFloat(slide.dataset.intensity || 1.0);

    const bgEl     = slide.querySelector('.slide__bg');
    const textEl   = slide.querySelector('.slide__text');
    const cutoutEl = slide.querySelector('.slide__cutout');

    // Background — moves slower (lags behind in the distance)
    if (bgEl) {
      const bgX = -(relPos * 0.18 * intensity);
      bgEl.style.transform = `translateX(${bgX}px)`;
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

export function getActiveSlideIndex() {
  return currentActiveIndex;
}

function updateNav(progress, totalSlides) {
  // Total slides includes intro + photo slides + outro
  const dots    = document.querySelectorAll('.dot');
  const track   = document.getElementById('slidesTrack');
  const totalW  = track.scrollWidth;
  const viewW   = window.innerWidth;
  const slideW  = viewW;
  const scrolled = progress * (totalW - viewW);
  const activeIdx = Math.max(0, Math.min(dots.length - 1, Math.round(scrolled / slideW)));
  currentActiveIndex = activeIdx;

  dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));

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

export function goToSlide(index) {
  const viewW = window.innerWidth;
  const target = index * viewW;
  lenis?.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
}
