(function () {
  "use strict";

  const SELECTORS = {
    component: "[data-tab-component]",
    list: "[data-tab-list]",
    link: "[data-tab-link]",
    pane: "[data-tab-pane]",
    progressList: "[data-tab-progress-list]",
    progress: "[data-tab-progress]",
    toggle: "[data-tab-autoplay-toggle]"
  };

  const ACTIVE_CLASS = "cc-active";
  const PAUSED_CLASS = "autoplay-paused";
  const DEFAULT_DURATION = 5000;
  const instances = [];

  function getScoped(root, selector) {
    return Array.from(root.querySelectorAll(selector)).filter((element) => {
      return element.closest(SELECTORS.component) === root;
    });
  }

  function getDuration(value) {
    const duration = Number(value);
    return Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION;
  }

  function initAllTabs() {
    instances.forEach((instance) => instance.destroy());
    instances.length = 0;

    document.querySelectorAll(SELECTORS.component).forEach((component, index) => {
      const instance = initTabComponent(component, index);
      if (instance) instances.push(instance);
    });
  }

  function initTabComponent(component, componentIndex) {
    const list = getScoped(component, SELECTORS.list)[0];
    const links = getScoped(component, SELECTORS.link);
    const panes = getScoped(component, SELECTORS.pane);
    const progressList = getScoped(component, SELECTORS.progressList)[0];
    const autoplayToggle = getScoped(component, SELECTORS.toggle)[0];

    if (!list || !links.length || !panes.length) return null;

    const count = Math.min(links.length, panes.length);
    const tabLinks = links.slice(0, count);
    const tabPanes = panes.slice(0, count);
    const autoplayEnabled = component.dataset.tabAutoplay === "true";
    const duration = getDuration(component.dataset.tabDuration);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canAutoplay = autoplayEnabled && !reduceMotion && count > 1;

    let activeIndex = getInitialActiveIndex();
    let progressItems = [];
    let autoplayTimer = null;
    let autoplayStartedAt = 0;
    let autoplayElapsed = 0;
    let isPaused = false;

    component.style.setProperty("--autoplay-duration", `${duration}ms`);

    setupAccessibility();
    setupProgress();
    setActiveTab(activeIndex, false);
    setupEvents();

    if (canAutoplay) startAutoplay();
    updateToggleButton();

    function setupAccessibility() {
      list.setAttribute("role", "tablist");

      tabLinks.forEach((link, index) => {
        const pane = tabPanes[index];
        const tabId = link.id || `tab-${componentIndex + 1}-${index + 1}`;
        const paneId = pane.id || `tab-panel-${componentIndex + 1}-${index + 1}`;
        const label = link.getAttribute("data-tab-link-name");

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

      tabLinks.forEach(() => {
        const progress = document.createElement("span");
        progress.className = "autoplay-tabs_progress";
        progress.setAttribute("data-tab-progress", "");
        progressList.appendChild(progress);
      });

      progressItems = Array.from(progressList.querySelectorAll(SELECTORS.progress));
    }

    function setupEvents() {
      tabLinks.forEach((link, index) => {
        link.addEventListener("click", () => {
          setActiveTab(index, true);
        });

        link.addEventListener("keydown", (event) => {
          const nextIndex = getKeyboardIndex(event, index);
          if (nextIndex === null) return;

          event.preventDefault();
          setActiveTab(nextIndex, true);
          tabLinks[nextIndex].focus();
        });
      });

      component.addEventListener("mouseenter", pauseAutoplay);
      component.addEventListener("mouseleave", resumeAutoplay);
      component.addEventListener("focusin", pauseAutoplay);
      component.addEventListener("focusout", (event) => {
        if (!component.contains(event.relatedTarget)) resumeAutoplay();
      });

      if (autoplayToggle) {
        autoplayToggle.addEventListener("click", toggleAutoplay);
      }
    }

    function setActiveTab(index, shouldRestartAutoplay) {
      if (index < 0 || index >= count) return;

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
      });

      progressItems.forEach((progress, progressIndex) => {
        progress.classList.toggle(ACTIVE_CLASS, progressIndex === activeIndex);
      });

      restartProgressAnimation();

      if (shouldRestartAutoplay) restartAutoplay();
    }

    function restartProgressAnimation() {
      const activeProgress = progressItems[activeIndex];
      if (!activeProgress) return;

      activeProgress.classList.remove(ACTIVE_CLASS);
      void activeProgress.offsetWidth;
      activeProgress.classList.add(ACTIVE_CLASS);
    }

    function startAutoplay() {
      if (!canAutoplay || isPaused) return;

      stopAutoplay();

      const remainingTime = Math.max(duration - autoplayElapsed, 0);
      autoplayStartedAt = Date.now();

      autoplayTimer = window.setTimeout(() => {
        autoplayElapsed = 0;
        setActiveTab((activeIndex + 1) % count, false);
        startAutoplay();
      }, remainingTime);
    }

    function stopAutoplay() {
      if (!autoplayTimer) return;
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }

    function restartAutoplay() {
      if (!canAutoplay) return;

      autoplayElapsed = 0;
      stopAutoplay();

      if (!isPaused) startAutoplay();
    }

    function pauseAutoplay() {
      if (!canAutoplay || isPaused) return;

      isPaused = true;
      autoplayElapsed += Date.now() - autoplayStartedAt;
      component.classList.add(PAUSED_CLASS);
      stopAutoplay();
      updateToggleButton();
    }

    function resumeAutoplay() {
      if (!canAutoplay || !isPaused) return;

      isPaused = false;
      component.classList.remove(PAUSED_CLASS);
      startAutoplay();
      updateToggleButton();
    }

    function toggleAutoplay() {
      if (isPaused) {
        resumeAutoplay();
      } else {
        pauseAutoplay();
      }
    }

    function updateToggleButton() {
      if (!autoplayToggle) return;
      autoplayToggle.setAttribute(
        "aria-label",
        isPaused ? "Play autoplay" : "Pause autoplay"
      );
    }

    function getInitialActiveIndex() {
      const activeByClass = tabLinks.findIndex((link) => {
        return link.classList.contains(ACTIVE_CLASS);
      });

      return activeByClass >= 0 ? activeByClass : 0;
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
        stopAutoplay();
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllTabs);
  } else {
    initAllTabs();
  }

  window.AttributesTabs = {
    reinitialize: initAllTabs,
    getInstances() {
      return instances;
    }
  };
})();