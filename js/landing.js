/**
 * Landing Page - Scroll animations & Service Worker registration
 */
(function() {
  'use strict';

  // Scroll-triggered section fade-in via IntersectionObserver
  const sections = document.querySelectorAll('.section');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    sections.forEach(section => observer.observe(section));
  } else {
    // Fallback: show all sections
    sections.forEach(section => section.classList.add('visible'));
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('Service Worker registered:', reg.scope);
    }).catch(err => {
      console.warn('Service Worker registration failed:', err);
    });
  }

})();
