(function () {
  "use strict";

  if (typeof Swiper === "undefined") {
    return;
  }

  function initializeSwipers() {
    const swiperElements = document.querySelectorAll('[data-slider="slider"]');

    if (swiperElements.length === 0) {
      return;
    }

    swiperElements.forEach((element, index) => {
      initializeSwiper(element, index);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSwipers);
  } else {
    initializeSwipers();
  }

  let resizeTimeout;
  let lastWidth = window.innerWidth;

  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const currentWidth = window.innerWidth;

      if (currentWidth !== lastWidth) {
        lastWidth = currentWidth;

        if (window.AttributesSwiper && window.AttributesSwiper.reinitialize) {
          window.AttributesSwiper.reinitialize();
        }
      }
    }, 250);
  }

  window.addEventListener("resize", handleResize);

  function initializeSwiper(element, index) {
    try {
      processWebflowCMSLists(element);

      const config = getSwiperConfig(element);
      const swiper = new Swiper(element, config);

      element.swiperInstance = swiper;

      setupHeightCalculation(element, swiper);
      setupLateUpdates(element, swiper);
    } catch (error) {
      if (typeof console !== "undefined" && console.error) {
        console.error("Swiper initialization failed:", error);
      }
    }
  }

  function setupHeightCalculation(element, swiper) {
    function updateSliderHeight() {
      const slides = element.querySelectorAll(".swiper-slide");
      if (slides.length === 0) return;

      let maxHeight = 0;

      slides.forEach((slide) => {
        slide.style.height = "auto";
        const slideHeight = slide.offsetHeight;

        if (slideHeight > maxHeight) {
          maxHeight = slideHeight;
        }
      });

      if (maxHeight > 0) {
        element.style.height = maxHeight + "px";
      }
    }

    updateSliderHeight();

    swiper.on("slideChange", updateSliderHeight);
    swiper.on("slideChangeTransitionEnd", updateSliderHeight);
    swiper.on("touchEnd", updateSliderHeight);
    swiper.on("resize", updateSliderHeight);
    swiper.on("breakpoint", updateSliderHeight);
    swiper.on("imagesReady", updateSliderHeight);
  }

  function setupLateUpdates(element, swiper) {
    function updateSwiper() {
      if (!element.swiperInstance || element.swiperInstance.destroyed) return;

      element.swiperInstance.update();
    }

    window.addEventListener("load", updateSwiper, { once: true });

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(updateSwiper);
      observer.observe(element);
      element.swiperResizeObserver = observer;
    }
  }

  function processWebflowCMSLists(element) {
    const wrapper = element.querySelector(".swiper-wrapper");
    if (!wrapper) return;

    const webflowSelectors = [".w-dyn-list", ".w-dyn-items", ".w-dyn-item"];
    let changed = true;

    while (changed) {
      changed = false;

      Array.from(wrapper.children).forEach((child) => {
        const isWebflowWrapper = webflowSelectors.some((selector) =>
          child.matches(selector),
        );

        if (!isWebflowWrapper) return;

        Array.from(child.childNodes).forEach((grandchild) => {
          wrapper.insertBefore(grandchild, child);
        });

        child.remove();
        changed = true;
      });
    }
  }

  function getSwiperConfig(element) {
    const componentWrapper = element.closest('[data-slider="component"]');
    const settingsElement = componentWrapper || element;
    const computedStyle = getComputedStyle(settingsElement);

    const xs = getSlidesPerView(computedStyle, "--xs", 1);
    const sm = getSlidesPerView(computedStyle, "--sm", xs);
    const md = getSlidesPerView(computedStyle, "--md", 2);
    const lg = getSlidesPerView(computedStyle, "--lg", md);
    const spaceBetween = readCssNumber(computedStyle, "--gap", 24);

    const config = {
      breakpoints: {
        0: { slidesPerView: xs, spaceBetween: spaceBetween },
        480: { slidesPerView: sm, spaceBetween: spaceBetween },
        768: { slidesPerView: md, spaceBetween: spaceBetween },
        992: { slidesPerView: lg, spaceBetween: spaceBetween },
      },
      slidesPerGroup: 1,
      watchSlidesProgress: true,
      simulateTouch: true,
      allowTouchMove: true,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: { enabled: true },
      watchOverflow: false,
      normalizeSlideIndex: false,
      roundLengths: false,
      observer: true,
      observeParents: true,
    };

    const grabCursor = element.dataset.grabCursor;
    config.grabCursor = grabCursor !== "false";

    const scope = componentWrapper || element.parentElement || document;
    const nextEl = scope.querySelector('[data-slider="next"]');
    const prevEl = scope.querySelector('[data-slider="previous"]');

    if (nextEl && prevEl) {
      config.navigation = { nextEl, prevEl };
    }

    const paginationEl = scope.querySelector('[data-slider="pagination"]');

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
      config.breakpoints = {
        0: { slidesPerView: 1, spaceBetween: 0 },
      };
    }

    const speed = element.dataset.speed;
    if (speed && !isNaN(speed)) {
      config.speed = parseInt(speed, 10);
    }

    return config;
  }

  function getSlidesPerView(computedStyle, propertyName, fallback) {
    const base = readCssNumber(computedStyle, propertyName, fallback);
    const sharedPeek = readOptionalCssNumber(computedStyle, "--peek") || 0;
    const specificPeek =
      readOptionalCssNumber(computedStyle, propertyName + "-peek") ||
      sharedPeek;

    if (!isWholeNumber(base)) {
      return Math.max(base, 1);
    }

    return Math.max(base + specificPeek, 1);
  }

  function readCssNumber(computedStyle, propertyName, fallback) {
    const value = readOptionalCssNumber(computedStyle, propertyName);
    return value === null ? fallback : value;
  }

  function readOptionalCssNumber(computedStyle, propertyName) {
    const rawValue = computedStyle.getPropertyValue(propertyName).trim();
    const parsedValue = parseFloat(rawValue);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function isWholeNumber(value) {
    return Math.abs(value - Math.round(value)) < 0.001;
  }

  window.AttributesSwiper = {
    reinitialize: function () {
      if (typeof Swiper === "undefined") return;

      const swiperElements = document.querySelectorAll(
        '[data-slider="slider"]',
      );

      swiperElements.forEach((element) => {
        if (element.swiperResizeObserver) {
          element.swiperResizeObserver.disconnect();
          element.swiperResizeObserver = null;
        }

        if (element.swiperInstance) {
          element.swiperInstance.destroy(true, true);
          element.swiperInstance = null;
        }
      });

      setTimeout(() => {
        swiperElements.forEach((element, index) => {
          initializeSwiper(element, index);
        });
      }, 50);
    },

    getInstance: function (index) {
      const swiperElements = document.querySelectorAll(
        '[data-slider="slider"]',
      );

      if (swiperElements[index] && swiperElements[index].swiperInstance) {
        return swiperElements[index].swiperInstance;
      }

      return null;
    },
  };
})();
