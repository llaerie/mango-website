/* ═══════════════════════════════════════════════════
   MANGO — HOMEPAGE INTERACTIONS (PRODUCTION)
   Hero scroll-scrub, background warmth, entrance anims
   Single rAF handler · IntersectionObserver · no deps
   ═══════════════════════════════════════════════════ */

import './style.css';

// ─── CONFIG ─────────────────────────────────────────
const IS_MOBILE = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── COLOR UTILITIES ────────────────────────────────
// HSL interpolation to avoid muddy browns during background transitions

function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (v) => {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpHSL(hex1, hex2, t) {
  const [h1, s1, l1] = hexToHSL(hex1);
  const [h2, s2, l2] = hexToHSL(hex2);
  // Lerp each channel
  const h = h1 + (h2 - h1) * t;
  const s = s1 + (s2 - s1) * t;
  const l = l1 + (l2 - l1) * t;
  return hslToHex(h, s, l);
}

// Background warmth waypoints (avoids muddy browns)
const BG_WAYPOINTS = [
  { at: 0.0, color: '#0F0E0C' },
  { at: 0.3, color: '#1A1710' },
  { at: 0.6, color: '#2C2412' },
  { at: 1.0, color: '#4A3A18' },
];

function getWarmthColor(progress) {
  // Find the two waypoints we're between
  for (let i = 0; i < BG_WAYPOINTS.length - 1; i++) {
    const a = BG_WAYPOINTS[i];
    const b = BG_WAYPOINTS[i + 1];
    if (progress >= a.at && progress <= b.at) {
      const segmentT = (progress - a.at) / (b.at - a.at);
      return lerpHSL(a.color, b.color, segmentT);
    }
  }
  return BG_WAYPOINTS[BG_WAYPOINTS.length - 1].color;
}


// ─── DOM REFS ───────────────────────────────────────
const nav = document.getElementById('nav');
const heroSection = document.getElementById('hero');
const heroVideo = document.getElementById('heroVideo');
const heroContent = document.getElementById('heroContent');
const heroOverlay = document.getElementById('heroOverlay');
const heroBgWarmth = document.getElementById('heroBgWarmth');
const heroScrollHint = document.getElementById('heroScrollHint');
const preloader = document.getElementById('preloader');


// ─── 1. NAVIGATION BEHAVIOR ────────────────────────
let lastScrollY = 0;
let navHidden = false;
let ticking = false;

function updateNav() {
  const currentScrollY = window.scrollY;

  // Show background once scrolled past initial hero
  if (currentScrollY > 80) {
    nav.classList.add('nav--scrolled');
  } else {
    nav.classList.remove('nav--scrolled');
  }

  // Hide on scroll-down, show on scroll-up (all viewports)
  if (currentScrollY > lastScrollY && currentScrollY > 200) {
    if (!navHidden) {
      nav.classList.add('nav--hidden');
      navHidden = true;
    }
  } else {
    if (navHidden) {
      nav.classList.remove('nav--hidden');
      navHidden = false;
    }
  }

  lastScrollY = currentScrollY;
}


// ─── 2. HERO + REVEAL SCROLL SYSTEM ─────────────────
// Video autoplays smoothly; scroll only controls:
//   • Headline fade
//   • Background warmth
//   • Overlay opacity
//   • Scroll hint fade
let heroScrollActive = true;

if (!IS_MOBILE && !PREFERS_REDUCED_MOTION && heroVideo) {
  // Let the video autoplay naturally — no scroll scrubbing
  heroVideo.play().catch(() => {
    // Autoplay blocked — that's fine, video will show first frame
  });
}

function updateHeroScroll() {
  if (!heroSection) return;

  const heroRect = heroSection.getBoundingClientRect();
  const heroHeight = heroSection.offsetHeight;
  const viewportH = window.innerHeight;
  const scrolled = -heroRect.top;

  // Overall progress through the 250vh section
  const totalProgress = Math.max(0, Math.min(1, scrolled / (heroHeight - viewportH)));

  // ── Headline fade ──
  // Hero headline holds for first 40% of total scroll, then fades over the next 20%
  if (heroContent) {
    const fadeStart = 0.25;
    const fadeEnd = 0.45;
    if (totalProgress <= fadeStart) {
      heroContent.style.opacity = '1';
    } else if (totalProgress >= fadeEnd) {
      heroContent.style.opacity = '0';
    } else {
      const fadeProg = (totalProgress - fadeStart) / (fadeEnd - fadeStart);
      heroContent.style.opacity = String(1 - fadeProg);
    }
  }

  // ── Overlay fade ──
  // Reduce dark overlay slightly during reveal to let phone breathe
  if (heroOverlay) {
    const overlayStart = 0.3;
    if (totalProgress > overlayStart) {
      const revealP = Math.min(1, (totalProgress - overlayStart) / 0.7);
      heroOverlay.style.opacity = String(1 - revealP * 0.3);
    } else {
      heroOverlay.style.opacity = '1';
    }
  }

  // ── Background warmth ──
  // The bg-warmth layer opacity increases as we progress into the reveal beat
  if (heroBgWarmth) {
    const warmStart = 0.2;
    if (totalProgress > warmStart) {
      const warmP = Math.min(1, (totalProgress - warmStart) / 0.8);
      heroBgWarmth.style.opacity = String(warmP * 0.6); // Max 60% opacity
      heroBgWarmth.style.backgroundColor = getWarmthColor(warmP);
    } else {
      heroBgWarmth.style.opacity = '0';
    }
  }

  // ── Scroll hint fade ──
  // Fade out the scroll chevron once user starts scrolling
  if (heroScrollHint) {
    if (totalProgress > 0.08) {
      heroScrollHint.style.opacity = '0';
    } else {
      heroScrollHint.style.opacity = '';
    }
  }
}


// ─── 3. INTERSECTION OBSERVER — Entrance Animations ─
function setupEntryAnimations() {
  if (PREFERS_REDUCED_MOTION) return;

  // Standard entrance: text and images
  const revealElements = document.querySelectorAll('.reveal-on-entry, .reveal-on-entry-image');
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0,
      rootMargin: '0px 0px -25% 0px',
    }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // Manifesto: staggered entrance
  const manifestoElements = document.querySelectorAll('.manifesto-reveal');
  const manifestoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const siblings = document.querySelectorAll('.manifesto-reveal');
          siblings.forEach((el, i) => {
            setTimeout(() => {
              el.classList.add('visible');
            }, i * 300);
          });
          siblings.forEach((el) => manifestoObserver.unobserve(el));
        }
      });
    },
    { threshold: 0.2 }
  );

  if (manifestoElements.length > 0) {
    manifestoObserver.observe(manifestoElements[0]);
  }

  // Design Story: synchronized image + copy entrance per beat
  const storyBeats = document.querySelectorAll('.story__beat');
  const storyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Reveal all children simultaneously
          entry.target.querySelectorAll('.reveal-on-entry, .reveal-on-entry-image').forEach((child) => {
            child.classList.add('visible');
          });
          storyObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0,
      rootMargin: '0px 0px -20% 0px',
    }
  );
  storyBeats.forEach((beat) => {
    // Remove children from the general observer so they don't fire independently
    beat.querySelectorAll('.reveal-on-entry, .reveal-on-entry-image').forEach((child) => {
      revealObserver.unobserve(child);
    });
    storyObserver.observe(beat);
  });
}


// ─── 4. MASTER SCROLL HANDLER ───────────────────────
// Single rAF-throttled scroll listener drives everything
function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateNav();
      if (!IS_MOBILE && !PREFERS_REDUCED_MOTION) {
        updateHeroScroll();
      }
      ticking = false;
    });
    ticking = true;
  }
}


// ─── 5. SMOOTH SCROLL FOR ANCHOR LINKS ──────────────
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}


// ─── 6. TOUCH FEEDBACK (mobile) ─────────────────────
function setupTouchFeedback() {
  if (!IS_MOBILE) return;
  document.querySelectorAll('.btn').forEach((btn) => {
    btn.addEventListener('touchstart', () => {
      btn.style.opacity = '0.9';
    }, { passive: true });
    btn.addEventListener('touchend', () => {
      setTimeout(() => { btn.style.opacity = ''; }, 200);
    }, { passive: true });
  });
}


// ─── INIT ───────────────────────────────────────────
function init() {
  // Force scroll to top on page load — prevent browser scroll restoration
  window.scrollTo(0, 0);
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Preloader: auto-dismiss after 2.2s
  if (preloader) {
    if (PREFERS_REDUCED_MOTION) {
      preloader.classList.add('preloader--hidden');
    } else {
      setTimeout(() => {
        preloader.classList.add('preloader--exiting');
        // Ensure we're at the top when preloader reveals the page
        window.scrollTo(0, 0);
        setTimeout(() => {
          preloader.classList.add('preloader--hidden');
        }, 600);
      }, 2200);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  setupEntryAnimations();
  setupSmoothScroll();
  setupTouchFeedback();

  // ─── NAV WORDMARK: hide while hero is in viewport ────────
  if (heroSection && nav) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            nav.classList.add('nav--hero-visible');
          } else {
            nav.classList.remove('nav--hero-visible');
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -50px 0px' }
    );
    heroObserver.observe(heroSection);
    // Start hidden since page loads at hero
    nav.classList.add('nav--hero-visible');
  }

  // ─── ENGINEERING SLIDESHOW — REMOVED ───────────────
  // Replaced with full stacked images — no JS needed


  // Reduced motion: make everything visible immediately
  if (PREFERS_REDUCED_MOTION) {
    document.querySelectorAll(
      '.reveal-on-entry, .reveal-on-entry-image, .manifesto-reveal, .fade-in'
    ).forEach((el) => {
      el.classList.add('visible');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  // Mobile: let video autoplay (poster fallback handled by browser)
  if (IS_MOBILE && heroVideo) {
    heroVideo.removeAttribute('preload');
    heroVideo.setAttribute('poster', '/images/mango-phone-back.png');
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
