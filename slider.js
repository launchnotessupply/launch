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
  }

  function processWebflowCMSLists(element) {
    const webflowSelectors = [".w-dyn-list", ".w-dyn-items", ".w-dyn-item"];

    webflowSelectors.forEach((selector) => {
      const webflowElements = element.querySelectorAll(selector);

      webflowElements.forEach((webflowElement) => {
        const children = Array.from(webflowElement.childNodes);

        children.forEach((child) => {
          webflowElement.parentNode.insertBefore(child, webflowElement);
        });

        webflowElement.remove();
      });
    });
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

  window.AttributesSwiper = {
    reinitialize: function () {
      if (typeof Swiper === "undefined") return;

      const swiperElements = document.querySelectorAll(
        '[data-slider="slider"]',
      );

      swiperElements.forEach((element) => {
        if (element.swiperInstance) {
          element.swiperInstance.destroy(true, true);
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
