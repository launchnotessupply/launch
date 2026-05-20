(() => {
  const SELECTORS = {
    component: '[data-hover-features="component"]',
    linkList: '[data-hover-features="link-list"]',
    linkItem: '[data-hover-features="link-item"]',
    visualFrame: '[data-hover-features="visual-frame"]',
    visualList: '[data-hover-features="visual-list"]',
    visualItem: '[data-hover-features="visual-item"]',
  };

  const ACTIVE_CLASS = "cc-active";
  const SCROLL_MODE_QUERY =
    "(hover: none), (pointer: coarse), (any-pointer: coarse)";
  const CONTROLLER_KEY = "__hoverFeaturesController";

  const debounce = (func, wait) => {
    let timeout;

    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const queryAll = (root, selector) =>
    Array.from(root.querySelectorAll(selector));

  const requestFrame = (callback) => {
    if (window.requestAnimationFrame)
      return window.requestAnimationFrame(callback);

    return window.setTimeout(callback, 16);
  };

  const cancelFrame = (id) => {
    if (window.cancelAnimationFrame) {
      window.cancelAnimationFrame(id);
      return;
    }

    window.clearTimeout(id);
  };

  const belongsToComponent = (component, el) => {
    return el.closest(SELECTORS.component) === component;
  };

  const isScrollModeDevice = () => {
    return window.matchMedia(SCROLL_MODE_QUERY).matches;
  };

  const isScrollable = (el) => {
    if (!el || el === window) return false;

    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScroll =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

    return canScroll && el.scrollHeight > el.clientHeight + 1;
  };

  const getScrollTargets = (el) => {
    const targets = [el];
    let parent = el.parentElement;

    while (
      parent &&
      parent !== document.body &&
      parent !== document.documentElement
    ) {
      if (isScrollable(parent)) {
        targets.push(parent);
      }

      parent = parent.parentElement;
    }

    targets.push(window);

    return targets.filter((target, index) => targets.indexOf(target) === index);
  };

  const queryScoped = (component, selector) => {
    return queryAll(component, selector).filter((el) =>
      belongsToComponent(component, el),
    );
  };

  const queryScopedFirst = (component, selector) => {
    return (
      queryAll(component, selector).find((el) =>
        belongsToComponent(component, el),
      ) || null
    );
  };

  const getKey = (el) => {
    if (!el || !el.dataset || typeof el.dataset.hoverFeatureKey !== "string")
      return "";

    return el.dataset.hoverFeatureKey.trim();
  };

  const warnOnce = (component, message, detail) => {
    if (!component._hoverFeaturesWarnings) {
      component._hoverFeaturesWarnings = new Set();
    }

    if (component._hoverFeaturesWarnings.has(message)) return;

    component._hoverFeaturesWarnings.add(message);

    if (window.console && typeof window.console.warn === "function") {
      window.console.warn(`[hover-features] ${message}`, detail || component);
    }
  };

  const getActiveKey = (component) => {
    const activeLink = queryScoped(
      component,
      `${SELECTORS.linkItem}.${ACTIVE_CLASS}`,
    )[0];
    const activeVisual = queryScoped(
      component,
      `${SELECTORS.visualItem}.${ACTIVE_CLASS}`,
    )[0];

    return getKey(activeLink) || getKey(activeVisual);
  };

  const buildRegistry = (component) => {
    const linkList = queryScopedFirst(component, SELECTORS.linkList);
    const visualFrame =
      queryScopedFirst(component, SELECTORS.visualFrame) ||
      queryScopedFirst(component, SELECTORS.visualList);
    const linkItems = queryScoped(component, SELECTORS.linkItem);
    const visualItems = queryScoped(component, SELECTORS.visualItem);
    const visualByKey = new Map();
    const entriesByKey = new Map();
    const linkToEntry = new WeakMap();
    const entries = [];
    const linkKeys = new Set();

    if (!linkList) {
      warnOnce(component, `Missing ${SELECTORS.linkList}; component skipped.`);
      return null;
    }

    visualItems.forEach((visual) => {
      const key = getKey(visual);

      if (!key) {
        warnOnce(
          component,
          `A visual item is missing data-hover-feature-key; it will be ignored.`,
          visual,
        );
        return;
      }

      if (visualByKey.has(key)) {
        warnOnce(
          component,
          `Duplicate visual key "${key}"; using the first visual item.`,
          visual,
        );
        return;
      }

      visualByKey.set(key, visual);
    });

    linkItems.forEach((link) => {
      const key = getKey(link);

      if (!key) {
        warnOnce(
          component,
          `A link item is missing data-hover-feature-key; it will be ignored.`,
          link,
        );
        return;
      }

      if (linkKeys.has(key)) {
        warnOnce(
          component,
          `Duplicate link key "${key}"; using the first link item.`,
          link,
        );
        return;
      }

      linkKeys.add(key);

      const visual = visualByKey.get(key);

      if (!visual) {
        warnOnce(
          component,
          `No visual item found for link key "${key}"; link will be ignored.`,
          link,
        );
        return;
      }

      const entry = { key, link, visual };
      entries.push(entry);
      entriesByKey.set(key, entry);
      linkToEntry.set(link, entry);
    });

    if (!entries.length) {
      warnOnce(
        component,
        "No valid link/visual pairs found; component skipped.",
      );
      return null;
    }

    return {
      component,
      linkList,
      visualFrame,
      linkItems,
      visualItems,
      entries,
      entriesByKey,
      linkToEntry,
      activeKey: "",
    };
  };

  const setActive = (registry, entry) => {
    if (!entry) return false;

    if (
      registry.activeKey === entry.key &&
      entry.link.classList.contains(ACTIVE_CLASS) &&
      entry.visual.classList.contains(ACTIVE_CLASS)
    ) {
      return true;
    }

    registry.linkItems.forEach((link) => {
      link.classList.remove(ACTIVE_CLASS);
    });

    registry.visualItems.forEach((visual) => {
      visual.classList.remove(ACTIVE_CLASS);
    });

    entry.link.classList.add(ACTIVE_CLASS);
    entry.visual.classList.add(ACTIVE_CLASS);
    registry.activeKey = entry.key;

    return true;
  };

  const getInitialEntry = (registry, preferredKey) => {
    if (preferredKey && registry.entriesByKey.has(preferredKey)) {
      return registry.entriesByKey.get(preferredKey);
    }

    return registry.entries[0];
  };

  const getEventEntry = (registry, event) => {
    if (!(event.target instanceof Element)) return null;

    const link = event.target.closest(SELECTORS.linkItem);

    if (
      !link ||
      !registry.linkList.contains(link) ||
      !belongsToComponent(registry.component, link)
    ) {
      return null;
    }

    return registry.linkToEntry.get(link) || null;
  };

  const cleanupComponent = (component) => {
    const state = component._hoverFeaturesState;

    if (!state) return;

    state.cleanup.forEach((cleanup) => {
      cleanup();
    });

    if (state.rafId !== null) {
      cancelFrame(state.rafId);
    }

    if (state.scrollEndTimeout !== null) {
      window.clearTimeout(state.scrollEndTimeout);
    }

    delete component._hoverFeaturesState;
  };

  const createState = (component, registry) => {
    const state = {
      cleanup: [],
      component,
      rafId: null,
      scrollEndTimeout: null,
      registry,
    };

    component._hoverFeaturesState = state;

    return state;
  };

  const initDesktop = (state) => {
    const { registry } = state;

    const handlePointerOver = (event) => {
      setActive(registry, getEventEntry(registry, event));
    };

    const handleFocusIn = (event) => {
      setActive(registry, getEventEntry(registry, event));
    };
    const hoverEvent = window.PointerEvent ? "pointerover" : "mouseover";

    registry.linkList.addEventListener(hoverEvent, handlePointerOver, {
      passive: true,
    });
    registry.linkList.addEventListener("focusin", handleFocusIn);

    state.cleanup.push(() => {
      registry.linkList.removeEventListener(hoverEvent, handlePointerOver);
      registry.linkList.removeEventListener("focusin", handleFocusIn);
    });
  };

  const getSafeViewportBottom = (registry, visibleBottom) => {
    if (!registry.visualFrame) return visibleBottom;

    const frameRect = registry.visualFrame.getBoundingClientRect();
    const linkListRect = registry.linkList.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const overlapsViewport =
      frameRect.bottom > 0 &&
      frameRect.top < viewportHeight &&
      frameRect.right > 0 &&
      frameRect.left < viewportWidth;
    const overlapsLinkList =
      frameRect.right > linkListRect.left &&
      frameRect.left < linkListRect.right;

    if (!overlapsViewport || !overlapsLinkList || frameRect.top <= 0) {
      return visibleBottom;
    }

    return Math.min(visibleBottom, frameRect.top);
  };

  const findClosestEntryToSafeCenter = (registry) => {
    const rootRect = registry.linkList.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    if (rootRect.top >= viewportHeight) {
      return registry.entries[0];
    }

    if (rootRect.bottom <= 0) {
      return registry.entries[registry.entries.length - 1];
    }

    const visibleTop = Math.max(rootRect.top, 0);
    const visibleBottom = getSafeViewportBottom(
      registry,
      Math.min(rootRect.bottom, viewportHeight),
    );

    if (visibleBottom <= visibleTop) {
      return null;
    }

    const rootCenterY = visibleTop + (visibleBottom - visibleTop) / 2;
    let closestEntry = null;
    let closestDistance = Infinity;

    registry.entries.forEach((entry) => {
      const rect = entry.link.getBoundingClientRect();
      const entryCenterY = rect.top + rect.height / 2;

      if (!rect.width && !rect.height) return;
      if (entryCenterY < visibleTop || entryCenterY > visibleBottom) return;

      const distance = Math.abs(entryCenterY - rootCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEntry = entry;
      }
    });

    return closestEntry;
  };

  const initMobile = (state) => {
    const { registry } = state;
    const scrollTargets = getScrollTargets(registry.linkList);

    const updateActiveFromScroll = () => {
      if (state.rafId !== null) return;

      state.rafId = requestFrame(() => {
        state.rafId = null;
        setActive(registry, findClosestEntryToSafeCenter(registry));
      });

      window.clearTimeout(state.scrollEndTimeout);
      state.scrollEndTimeout = window.setTimeout(() => {
        state.scrollEndTimeout = null;
        setActive(registry, findClosestEntryToSafeCenter(registry));
      }, 120);
    };
    const handleDirectSelect = (event) => {
      setActive(registry, getEventEntry(registry, event));
    };

    scrollTargets.forEach((target) => {
      target.addEventListener("scroll", updateActiveFromScroll, {
        passive: true,
      });
    });

    registry.linkList.addEventListener("click", handleDirectSelect, {
      passive: true,
    });
    registry.linkList.addEventListener("focusin", handleDirectSelect);

    state.cleanup.push(() => {
      scrollTargets.forEach((target) => {
        target.removeEventListener("scroll", updateActiveFromScroll);
      });

      registry.linkList.removeEventListener("click", handleDirectSelect);
      registry.linkList.removeEventListener("focusin", handleDirectSelect);
    });

    updateActiveFromScroll();
  };

  const initComponent = (component) => {
    const preferredKey = getActiveKey(component);

    cleanupComponent(component);

    const registry = buildRegistry(component);

    if (!registry) return;

    const state = createState(component, registry);

    setActive(registry, getInitialEntry(registry, preferredKey));

    if (isScrollModeDevice()) {
      initMobile(state);
    } else {
      initDesktop(state);
    }
  };

  const initializeHoverFeatures = () => {
    queryAll(document, SELECTORS.component).forEach(initComponent);
  };

  const globalCleanup = [];
  let booted = false;

  const destroy = () => {
    queryAll(document, SELECTORS.component).forEach(cleanupComponent);
    globalCleanup.splice(0).forEach((cleanup) => {
      cleanup();
    });
    booted = false;
  };

  const previousController = window[CONTROLLER_KEY];

  if (previousController && typeof previousController.destroy === "function") {
    previousController.destroy();
  }

  window[CONTROLLER_KEY] = {
    destroy,
    refresh: initializeHoverFeatures,
  };

  const boot = () => {
    if (booted) return;

    booted = true;

    initializeHoverFeatures();

    const handleResize = debounce(initializeHoverFeatures, 250);
    const handleOrientationChange = debounce(initializeHoverFeatures, 250);

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    globalCleanup.push(() => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    });
  };

  if (window.Webflow && typeof window.Webflow.push === "function") {
    window.Webflow.push(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
