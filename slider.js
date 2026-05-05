(function () {
  "use strict";

  function initializeSwipers() {
    const swiperElements = document.querySelectorAll('[data-slider="slider"]');

    if (swiperElements.length === 0) {
      return;
    }

    swiperElements.forEach((element, index) => {
      initializeSwiper(element, index);
    });
  }

  function initializeWhenReady() {
    if (typeof Swiper === "undefined") {
      setTimeout(initializeWhenReady, 50);
      return;
    }

    initializeSwipers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeWhenReady);
  } else {
    initializeWhenReady();
  }

  function getSwiperConfig(element) {
    const componentWrapper =
      element.closest('[data-slider="component"]') || element;
    const computedStyle = getComputedStyle(componentWrapper);

    const xsColumns =
      parseFloat(computedStyle.getPropertyValue("--xs").trim()) || 4;
    const smColumns =
      parseFloat(computedStyle.getPropertyValue("--sm").trim()) || xsColumns;
    const mdColumns =
      parseFloat(computedStyle.getPropertyValue("--md").trim()) || smColumns;
    const lgColumns =
      parseFloat(computedStyle.getPropertyValue("--lg").trim()) || mdColumns;

    const spaceBetween =
      parseInt(computedStyle.getPropertyValue("--gap").trim(), 10) || 24;

    const defaultSpan =
      parseFloat(componentWrapper.dataset.slideSpan) ||
      parseFloat(element.dataset.slideSpan) ||
      parseFloat(computedStyle.getPropertyValue("--slide-span").trim()) ||
      1;

    const xsSpan =
      parseFloat(componentWrapper.dataset.slideSpanXs) || defaultSpan;
    const smSpan =
      parseFloat(componentWrapper.dataset.slideSpanSm) || defaultSpan;
    const mdSpan =
      parseFloat(componentWrapper.dataset.slideSpanMd) || defaultSpan;
    const lgSpan =
      parseFloat(componentWrapper.dataset.slideSpanLg) || defaultSpan;

    function slidesPerView(columns, span) {
      return Math.max(columns / span, 1);
    }

    const config = {
      breakpoints: {
        0: {
          slidesPerView: slidesPerView(xsColumns, xsSpan),
          spaceBetween: spaceBetween,
        },
        480: {
          slidesPerView: slidesPerView(smColumns, smSpan),
          spaceBetween: spaceBetween,
        },
        768: {
          slidesPerView: slidesPerView(mdColumns, mdSpan),
          spaceBetween: spaceBetween,
        },
        992: {
          slidesPerView: slidesPerView(lgColumns, lgSpan),
          spaceBetween: spaceBetween,
        },
      },
      watchSlidesProgress: true,
      simulateTouch: true,
      allowTouchMove: true,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: { enabled: true },
      watchOverflow: true,
      normalizeSlideIndex: false,
      roundLengths: false,
    };

    const grabCursor = element.dataset.grabCursor;
    config.grabCursor = grabCursor === "false" ? false : true;

    const nextEl = componentWrapper.querySelector('[data-slider="next"]');
    const prevEl = componentWrapper.querySelector('[data-slider="previous"]');

    if (nextEl && prevEl) {
      config.navigation = { nextEl, prevEl };
    }

    const paginationEl = componentWrapper.querySelector(
      '[data-slider="pagination"]',
    );

    if (paginationEl) {
      config.pagination = {
        el: paginationEl,
        clickable: true,
        bulletElement: "button",
        bulletClass: "slider-pagination_button",
        bulletActiveClass: "cc-active",
      };
    }

    if (element.dataset.loop === "true") {
      config.loop = true;
      config.loopFillGroupWithBlank = true;

      const loopAdditionalSlides = element.dataset.loopAdditionalSlides;
      if (loopAdditionalSlides && !isNaN(loopAdditionalSlides)) {
        config.loopAdditionalSlides = parseInt(loopAdditionalSlides, 10);
      }
    }

    const autoplayDelay = element.dataset.autoplay;
    if (autoplayDelay && autoplayDelay !== "false" && !isNaN(autoplayDelay)) {
      config.autoplay = {
        delay: parseInt(autoplayDelay, 10),
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      };
    }

    if (element.dataset.centered === "true") {
      config.centeredSlides = true;
      config.centeredSlidesBounds = true;
    }

    if (element.dataset.effect === "fade") {
      config.effect = "fade";
      config.fadeEffect = { crossFade: true };
    }

    const speed = element.dataset.speed;
    if (speed && !isNaN(speed)) {
      config.speed = parseInt(speed, 10);
    }

    return config;
  }
})();
