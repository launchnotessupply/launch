(function () {
  "use strict";

  const SELECTORS = {
    component: "[data-tab-component]",
    list: "[data-tab-list]",
    link: "[data-tab-link]",
    pane: "[data-tab-pane]",
    progressList: "[data-tab-progress-list]",
    progress: "[data-tab-progress]",
  };

  const ACTIVE_CLASS = "cc-active";
  const DEFAULT_DURATION = 5000;
  const instances = [];

  function getOwnElements(root, selector) {
    return Array.from(root.querySelectorAll(selector)).filter((el) => {
      return el.closest(SELECTORS.component) === root;
    });
  }

  function parseDuration(value) {
    const duration = Number(value);
    return Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION;
  }

  function initAll() {
    instances.forEach((instance) => instance.destroy());
    instances.length = 0;

    document.querySelectorAll(SELECTORS.component).forEach((root, index) => {
      const instance = createTabs(root, index);
      if (instance) instances.push(instance);
    });
  }

  function createTabs(root, componentIndex) {
    const list = getOwnElements(root, SELECTORS.list)[0];
    const links = getOwnElements(root, SELECTORS.link);
    const panes = getOwnElements(root, SELECTORS.pane);
    const progressList = getOwnElements(root, SELECTORS.progressList)[0];

    if (!list || !links.length || !panes.length) return null;

    const count = Math.min(links.length, panes.length);
    const tabLinks = links.slice(0, count);
    const tabPanes = panes.slice(0, count);

    const autoplay = root.dataset.tabAutoplay === "true";
    const duration = parseDuration(root.dataset.tabDuration);
    const pauseOnHover = root.dataset.tabPauseOnHover !== "false";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let activeIndex = Math.max(
      0,
      tabLinks.findIndex((link) => link.classList.contains(ACTIVE_CLASS))
    );

    let progressItems = [];
    let rafId = null;
    let startedAt = 0;
    let pausedAt = 0;
    let isPaused = false;

    setupAccessibility();
    setupProgress();
    activate(activeIndex, false);

    tabLinks.forEach((link, index) => {
      link.addEventListener("click", onClick);
      link.addEventListener("keydown", onKeydown);

      function onClick() {
        activate(index, true);
        restartAutoplay();
      }

      function onKeydown(event) {
        const nextIndex = getKeyboardIndex(event, index);
        if (nextIndex === null) return;

        event.preventDefault();
        activate(nextIndex, true);
        tabLinks[nextIndex].focus();
        restartAutoplay();
      }

      link._tabCleanup = () => {
        link.removeEventListener("click", onClick);
        link.removeEventListener("keydown", onKeydown);
      };
    });

    if (pauseOnHover) {
      root.addEventListener("mouseenter", pauseAutoplay);
      root.addEventListener("mouseleave", resumeAutoplay);
    }

    root.addEventListener("focusin", pauseAutoplay);
    root.addEventListener("focusout", onFocusOut);

    if (autoplay && !reducedMotion && count > 1) {
      startAutoplay();
    } else {
      setProgress(1);
    }

    function setupAccessibility() {
      list.setAttribute("role", "tablist");

      tabLinks.forEach((link, index) => {
        const pane = tabPanes[index];
        const tabId = link.id || `tab-${componentIndex + 1}-${index + 1}`;
        const paneId = pane.id || `tab-panel-${componentIndex + 1}-${index + 1}`;
        const label = link.dataset.tabLinkName;

        link.id = tabId;
        pane.id = paneId;

        if (link.tagName === "BUTTON") link.setAttribute("type", "button");
        if (label) link.setAttribute("aria-label", label);

        link.setAttribute("role", "tab");
        link.setAttribute("aria-controls", paneId);

        pane.setAttribute("role", "tabpanel");
        pane.setAttribute("aria-labelledby", tabId);
      });
    }

    function setupProgress() {
      if (!progressList) return;

      progressList.innerHTML = "";
      progressList.setAttribute("aria-hidden", "true");

      for (let index = 0; index < count; index += 1) {
        const progress = document.createElement("span");
        progress.className = "autoplay-tabs_progress";
        progress.setAttribute("data-tab-progress", "");
        progress.style.setProperty("--tab-progress", "0");
        progressList.appendChild(progress);
      }

      progressItems = Array.from(progressList.querySelectorAll(SELECTORS.progress));
    }

    function activate(index, resetProgress) {
      activeIndex = index;

      tabLinks.forEach((link, linkIndex) => {
        const isActive = linkIndex === activeIndex;
        link.classList.toggle(ACTIVE_CLASS, isActive);
        link.setAttribute("aria-selected", String(isActive));
        link.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      tabPanes.forEach((pane, paneIndex) => {
        const isActive = paneIndex === activeIndex;
        pane.classList.toggle(ACTIVE_CLASS, isActive);
        pane.setAttribute("aria-hidden", String(!isActive));
        pane.toggleAttribute("hidden", !isActive);
      });

      progressItems.forEach((progress, progressIndex) => {
        progress.classList.toggle(ACTIVE_CLASS, progressIndex === activeIndex);
      });

      if (resetProgress) setProgress(0);
    }

    function setProgress(value) {
      progressItems.forEach((progress, index) => {
        const amount = index < activeIndex ? 1 : index === activeIndex ? value : 0;
        progress.style.setProperty("--tab-progress", String(amount));
      });
    }

    function startAutoplay() {
      startedAt = performance.now();
      rafId = requestAnimationFrame(tick);
    }

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      setProgress(progress);

      if (progress >= 1) {
        activate((activeIndex + 1) % count, true);
        startedAt = now;
      }

      rafId = requestAnimationFrame(tick);
    }

    function restartAutoplay() {
      if (!autoplay || reducedMotion || count <= 1) return;
      cancelAnimationFrame(rafId);
      isPaused = false;
      startAutoplay();
    }

    function pauseAutoplay() {
      if (!autoplay || isPaused) return;
      isPaused = true;
      pausedAt = performance.now();
      cancelAnimationFrame(rafId);
    }

    function resumeAutoplay() {
      if (!autoplay || !isPaused) return;
      isPaused = false;
      startedAt += performance.now() - pausedAt;
      rafId = requestAnimationFrame(tick);
    }

    function onFocusOut(event) {
      if (!root.contains(event.relatedTarget)) resumeAutoplay();
    }

    function getKeyboardIndex(event, index) {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") return (index + 1) % count;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") return (index - 1 + count) % count;
      if (event.key === "Home") return 0;
      if (event.key === "End") return count - 1;
      return null;
    }

    return {
      destroy() {
        cancelAnimationFrame(rafId);
        tabLinks.forEach((link) => link._tabCleanup && link._tabCleanup());
        root.removeEventListener("mouseenter", pauseAutoplay);
        root.removeEventListener("mouseleave", resumeAutoplay);
        root.removeEventListener("focusin", pauseAutoplay);
        root.removeEventListener("focusout", onFocusOut);
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  window.AttributesTabs = {
    reinitialize: initAll,
    getInstances: function () {
      return instances;
    },
  };
})();