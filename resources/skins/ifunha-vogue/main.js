(function() {
  'use strict';

  // ============================================
  // 마스트헤드 글자 진입 애니메이션 (한 번만)
  // ============================================
  function initMasthead() {
    var mastheadEl = document.getElementById('masthead-text');
    var wrap = document.getElementById('masthead');
    if (!mastheadEl || !wrap) return;

    var text = mastheadEl.textContent.trim();
    mastheadEl.innerHTML = '';

    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
      span.style.animationDelay = (0.2 + i * 0.1) + 's';
      mastheadEl.appendChild(span);
    }

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        wrap.classList.add('is-loaded');
      });
    });
  }

  // ============================================
  // 히어로 슬라이드 + 좌우 카피
  // ============================================
  var SLIDE_INTERVAL = 4000;
  var FADE_OUT = 600;
  var FADE_IN = 600;
  var slides = document.querySelectorAll('.hero-slide');
  var indicatorsWrap = document.getElementById('indicators');
  var indicators = document.querySelectorAll('.indicator');

  var currentSlide = 0;
  var totalSlides = slides.length;

  // ★ indicators 자동 생성 (banner_loop 슬라이드 수에 맞춤)
  if (indicatorsWrap && indicators.length === 0 && totalSlides > 0) {
    for (var ii = 0; ii < totalSlides; ii++) {
      var ind = document.createElement('span');
      ind.className = 'indicator' + (ii === 0 ? ' active' : '');
      ind.dataset.idx = ii;
      indicatorsWrap.appendChild(ind);
    }
    indicators = document.querySelectorAll('.indicator');
  }

  // ★ 첫 슬라이드 active (banner_loop 첫 항목)
  if (totalSlides > 0 && !document.querySelector('.hero-slide.active')) {
    slides[0].classList.add('active');
  }

  function showSlide(idx) {
    for (var i = 0; i < slides.length; i++) {
      if (i === idx) slides[i].classList.add('active');
      else slides[i].classList.remove('active');
    }

    for (var j = 0; j < indicators.length; j++) {
      if (j === idx) indicators[j].classList.add('active');
      else indicators[j].classList.remove('active');
    }
  }

  var slideInterval = null;
  if (totalSlides > 1) {
    slideInterval = setInterval(function() {
      currentSlide = (currentSlide + 1) % totalSlides;
      showSlide(currentSlide);
    }, SLIDE_INTERVAL);
  }

  for (var k = 0; k < indicators.length; k++) {
    (function(idx) {
      indicators[idx].addEventListener('click', function() {
        currentSlide = idx;
        showSlide(currentSlide);
        if (slideInterval) clearInterval(slideInterval);
        slideInterval = setInterval(function() {
          currentSlide = (currentSlide + 1) % totalSlides;
          showSlide(currentSlide);
        }, SLIDE_INTERVAL);
      });
    })(k);
  }

  // ============================================
  // NAV 스크롤 고정
  // ============================================
  var nav = document.getElementById('nav');
  var navPlaceholder = document.getElementById('navPlaceholder');
  var hero = document.getElementById('hero');

  function handleNavScroll() {
    if (!hero || !nav) return;
    var heroBottom = hero.offsetTop + hero.offsetHeight;
    if (window.scrollY >= heroBottom) {
      nav.classList.add('fixed');
      if (navPlaceholder) navPlaceholder.classList.add('active');
    } else {
      nav.classList.remove('fixed');
      if (navPlaceholder) navPlaceholder.classList.remove('active');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });

  // ============================================
  // CINEMATIC - scene 활성화 로직
  // ============================================
  var scenes = document.querySelectorAll('.scene');
  var sceneContents = document.querySelectorAll('.scene-content');

  function handleScenesScroll() {
    var winH = window.innerHeight;
    var activeIdx = -1;
    var maxVisibility = 0;

    scenes.forEach(function(scene, idx) {
      var rect = scene.getBoundingClientRect();
      var scrolled = winH - rect.top;
      var total = scene.offsetHeight + winH;
      var progress = Math.max(0, Math.min(1, scrolled / total));

      var bg = scene.querySelector('.scene-bg');
      if (bg) {
        var bgOpacity = 0;
        if (progress < 0.2) bgOpacity = progress / 0.2;
        else if (progress < 0.8) bgOpacity = 1;
        else bgOpacity = 1 - (progress - 0.8) / 0.2;
        bg.style.opacity = bgOpacity;
      }

      if (progress > 0.35 && progress < 0.55) {
        var visibility = 1 - Math.abs(0.45 - progress) * 2;
        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          activeIdx = idx;
        }
      }
    });

    sceneContents.forEach(function(content, idx) {
      if (idx === activeIdx) content.classList.add('is-active');
      else content.classList.remove('is-active');
    });
  }
  window.addEventListener('scroll', handleScenesScroll, { passive: true });

  // ============================================
  // FADE IN 섹션 애니메이션
  // ============================================
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.fade').forEach(function(el) { io.observe(el); });
  } else {
    document.querySelectorAll('.fade').forEach(function(el) { el.classList.add('in'); });
  }

  // 포트폴리오 필터 버튼
  document.querySelectorAll('.filter-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
  });

  // FAQ 아코디언 - 한 번에 하나만 열림
  document.querySelectorAll('.faq-item').forEach(function(item) {
    var qBtn = item.querySelector('.faq-q');
    if (!qBtn) return;
    qBtn.addEventListener('click', function() {
      var wasOpen = item.classList.contains('is-open');
      document.querySelectorAll('.faq-item').forEach(function(other) {
        other.classList.remove('is-open');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
      }
    });
  });

  // ============================================
  // 초기화
  // ============================================
  window.addEventListener('load', function() {
    initMasthead();
    handleScenesScroll();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      handleScenesScroll();
    });
  } else {
    handleScenesScroll();
  }
})();
