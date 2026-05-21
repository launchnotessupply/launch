(function () {
  "use strict";

  const MOBILE_BREAKPOINT = 767;
  const ACTIVE_CLASS = "cc-active";
  const PAUSED_CLASS = "autoplay-paused";
  const PROGRESS_CLASS = "autoplay-tabs_progress";
  const CLEANUP_KEY = "__autoplayTabsCleanup";

  const SELECTORS = {
    component: "[data-tabs-component]",
    menu: "[data-tabs-menu]",
    menuWrapper: "[data-tabs-menu-wrapper]",
    dropdownMenu: "[data-tabs-menu-dropdown-menu]",
    dropdownToggle: "[data-tabs-menu-dropdown-toggle]",
    dropdownText: "[data-tabs-menu-dropdown-text]",
    link: "[data-tabs-link]",
    linkButton: "[data-tabs-link-button]",
    pane: "[data-tabs-pane]",
    autoplayToggle: "[data-tabs-autoplay-toggle]",
    progressList: "[data-tabs-autoplay-progress-list]",
    progress: "[data-tabs-autoplay-progress]",
  };

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function isMobileTabsViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function belongsToTabsComponent(component, element) {
    return element && element.closest(SELECTORS.component) === component;
  }

  function queryScoped(component, selector) {
    return toArray(component.querySelectorAll(selector)).filter((element) =>
      belongsToTabsComponent(component, element),
    );
  }

  function queryScopedFirst(component, selector) {
    return queryScoped(component, selector)[0] || null;
  }

  function getConfigAttribute(component, fallbackElement, name) {
    if (component.hasAttribute(name)) {
      return component.getAttribute(name);
    }

    if (fallbackElement && fallbackElement.hasAttribute(name)) {
      return fallbackElement.getAttribute(name);
    }

    return null;
  }

  function getBooleanConfig(component, fallbackElement, name, fallback) {
    const value = getConfigAttribute(component, fallbackElement, name);

    if (value === null) return fallback;

    return value === "" || value === "true" || value === "1" || value === name;
  }

  function getDurationMsConfig(component, fallbackElement, name, fallback) {
    const value = getConfigAttribute(component, fallbackElement, name);

    if (value === null) return fallback;

    const normalizedValue = String(value).trim().toLowerCase();
    const parsedValue = parseFloat(normalizedValue);

    if (!isFinite(parsedValue) || parsedValue <= 0) return fallback;

    if (normalizedValue.endsWith("s") && !normalizedValue.endsWith("ms")) {
      return parsedValue * 1000;
    }

    return parsedValue;
  }

  function shouldDisableTabsOnMobile(component) {
    return (
      component.getAttribute("data-tabs-disable-mobile") === "true" &&
      isMobileTabsViewport()
    );
  }

  function enableMobileDisabledState(component) {
    component.setAttribute("data-tabs-mobile-disabled-active", "true");

    queryScoped(component, SELECTORS.pane).forEach((pane) => {
      pane.setAttribute("aria-hidden", "false");
    });
  }

  function disableMobileDisabledState(component) {
    component.removeAttribute("data-tabs-mobile-disabled-active");
  }

  function getTabLabel(tabLink, index) {
    const tabName = tabLink.getAttribute("data-tab-link-name");
    const label = tabName || tabLink.textContent || `Tab ${index + 1}`;

    return label.trim().replace(/\s+/g, " ") || `Tab ${index + 1}`;
  }

  function isProgressElement(element) {
    return (
      element &&
      (element.matches(SELECTORS.progress) ||
        element.classList.contains(PROGRESS_CLASS))
    );
  }

  function resolveProgressElements(component) {
    let list = queryScopedFirst(component, SELECTORS.progressList);
    let template =
      queryScopedFirst(component, `.${PROGRESS_CLASS}`) ||
      queryScopedFirst(component, SELECTORS.progress);

    if (isProgressElement(list)) {
      template = list;
      list = list.parentElement;
    }

    if (!list && template) {
      list = template.parentElement;
    }

    if (!belongsToTabsComponent(component, list)) {
      list = null;
    }

    if (list && !list.hasAttribute("data-tabs-autoplay-progress-list")) {
      list.setAttribute("data-tabs-autoplay-progress-list", "");
    }

    return { list, template };
  }

  function initTabsComponent(component) {
    const existingCleanup = component[CLEANUP_KEY] || component.__tabsCleanup;

    if (typeof existingCleanup === "function") {
      existingCleanup();
      delete component.__tabsCleanup;
    }

    const tabMenu = queryScopedFirst(component, SELECTORS.menu);
    const tabMenuWrapper =
      queryScopedFirst(component, SELECTORS.menuWrapper) || tabMenu;
    const tabLinks = queryScoped(component, SELECTORS.link);
    const tabPanes = queryScoped(component, SELECTORS.pane);

    if (!tabMenu || !tabMenuWrapper || !tabLinks.length || !tabPanes.length) {
      return;
    }

    const dropdownMenu = queryScopedFirst(component, SELECTORS.dropdownMenu);
    const dropdownToggle = queryScopedFirst(component, SELECTORS.dropdownToggle);
    const dropdownText = dropdownToggle
      ? dropdownToggle.querySelector(SELECTORS.dropdownText)
      : null;
    const isMobileDropdown =
      tabMenu.getAttribute("data-tab-mobile-dropdown") === "true";
    const autoplayToggleButton = queryScopedFirst(
      component,
      SELECTORS.autoplayToggle,
    );
    const progressElements = resolveProgressElements(component);
    const autoplayDurationMs = getDurationMsConfig(
      component,
      tabMenu,
      "data-tabs-autoplay-duration",
      5000,
    );
    const autoplayEnabled = getBooleanConfig(
      component,
      tabMenu,
      "data-tabs-autoplay",
      Boolean(progressElements.list),
    );
    const autoplayHoverPause = getBooleanConfig(
      component,
      tabMenu,
      "data-tabs-autoplay-hover-pause",
      false,
    );

    let currentActiveIndex = 0;
    let progressTemplate = progressElements.template;
    let progressButtons = [];
    let autoplayTimer = null;
    let autoplayStartedAt = 0;
    let autoplayRemainingMs = autoplayDurationMs;
    let pausedByUser = false;
    let pausedByHover = false;
    let cachedWindowWidth = window.innerWidth;
    let resizeTimer = null;
    const eventListeners = [];

    function addListener(element, type, handler) {
      if (!element) return;

      element.addEventListener(type, handler);
      eventListeners.push({ element, type, handler });
    }

    function isAutoplayPaused() {
      return pausedByUser || pausedByHover;
    }

    function updateAutoplayPausedState() {
      component.classList.toggle(PAUSED_CLASS, isAutoplayPaused());
      updateToggleButton();
    }

    function clearAutoplayTimer(trackElapsed) {
      if (!autoplayTimer) return;

      if (trackElapsed && autoplayStartedAt) {
        const elapsed = Date.now() - autoplayStartedAt;
        autoplayRemainingMs = Math.max(0, autoplayRemainingMs - elapsed);
      }

      clearTimeout(autoplayTimer);
      autoplayTimer = null;
      autoplayStartedAt = 0;
    }

    function startAutoplay(delayMs) {
      if (
        !autoplayEnabled ||
        isAutoplayPaused() ||
        tabLinks.length <= 1
      ) {
        return;
      }

      clearAutoplayTimer(false);

      autoplayRemainingMs = Math.max(0, delayMs || autoplayDurationMs);
      autoplayStartedAt = Date.now();
      autoplayTimer = window.setTimeout(() => {
        autoplayTimer = null;
        autoplayStartedAt = 0;
        autoplayRemainingMs = autoplayDurationMs;

        const nextIndex = (currentActiveIndex + 1) % tabLinks.length;
        setActiveTab(nextIndex, { restartAutoplay: false });
        restartProgressAnimation(nextIndex);
        startAutoplay(autoplayDurationMs);
      }, autoplayRemainingMs);
    }

    function restartAutoplay() {
      if (!autoplayEnabled) return;

      clearAutoplayTimer(false);
      autoplayRemainingMs = autoplayDurationMs;

      if (!isAutoplayPaused()) {
        restartProgressAnimation(currentActiveIndex);
        startAutoplay(autoplayDurationMs);
      }
    }

    function pauseAutoplay(reason) {
      if (!autoplayEnabled) return;

      if (reason === "hover") {
        pausedByHover = true;
      } else {
        pausedByUser = true;
      }

      clearAutoplayTimer(true);
      updateAutoplayPausedState();
    }

    function resumeAutoplay(reason) {
      if (!autoplayEnabled) return;

      if (reason === "hover") {
        pausedByHover = false;
      } else {
        pausedByUser = false;
      }

      updateAutoplayPausedState();

      if (!isAutoplayPaused()) {
        startAutoplay(autoplayRemainingMs || autoplayDurationMs);
      }
    }

    function updateToggleButton() {
      if (!autoplayToggleButton) return;

      autoplayToggleButton.setAttribute(
        "aria-label",
        pausedByUser ? "Play autoplay" : "Pause autoplay",
      );
    }

    function createProgressButton(tabLink, index) {
      const button = progressTemplate
        ? progressTemplate.cloneNode(true)
        : document.createElement("button");
      const label = getTabLabel(tabLink, index);

      button.removeAttribute("id");
      button.classList.add(PROGRESS_CLASS);
      button.classList.remove(ACTIVE_CLASS);
      button.setAttribute("data-tabs-autoplay-progress", "");
      button.setAttribute("data-tabs-autoplay-progress-index", String(index));
      button.setAttribute("aria-label", `Show ${label} tab`);
      button.removeAttribute("aria-current");

      if (button.tagName === "BUTTON") {
        button.setAttribute("type", "button");
      } else {
        button.setAttribute("role", "button");
        button.setAttribute("tabindex", "0");
      }

      return button;
    }

    function setupProgressButtons() {
      component.style.setProperty(
        "--autoplay-duration",
        `${autoplayDurationMs}ms`,
      );

      if (!progressElements.list) return;

      if (!progressElements.list.__autoplayTabsProgressTemplate) {
        progressElements.list.__autoplayTabsProgressTemplate = progressTemplate
          ? progressTemplate.cloneNode(true)
          : null;
      }

      progressTemplate =
        progressElements.list.__autoplayTabsProgressTemplate || null;
      progressButtons = tabLinks.map(createProgressButton);
      progressElements.list.replaceChildren(...progressButtons);

      progressButtons.forEach((button, index) => {
        addListener(button, "click", (event) => {
          event.preventDefault();
          setActiveTab(index);
        });

        if (button.tagName !== "BUTTON") {
          addListener(button, "keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            setActiveTab(index);
          });
        }
      });
    }

    function updateProgressButtons(index) {
      progressButtons.forEach((button, buttonIndex) => {
        const isActive = buttonIndex === index;

        button.classList.toggle(ACTIVE_CLASS, isActive);

        if (isActive) {
          button.setAttribute("aria-current", "true");
        } else {
          button.removeAttribute("aria-current");
        }
      });
    }

    function restartProgressAnimation(index) {
      const button = progressButtons[index];

      if (!button) return;

      button.classList.remove(ACTIVE_CLASS);
      void button.offsetWidth;
      button.classList.add(ACTIVE_CLASS);
      button.setAttribute("aria-current", "true");
    }

    function updateDropdownText(index) {
      if (!dropdownText || !isMobileDropdown) return;

      const activeTabName = tabLinks[index].getAttribute("data-tab-link-name");
      dropdownText.textContent = activeTabName || tabLinks[index].textContent;
    }

    function openDropdown() {
      if (!dropdownToggle || !dropdownMenu) return;

      dropdownMenu.classList.add("cc-open");
      dropdownToggle.classList.add("cc-open");
      dropdownToggle.setAttribute("aria-expanded", "true");
    }

    function closeDropdown() {
      if (!dropdownToggle || !dropdownMenu) return;

      dropdownMenu.classList.remove("cc-open");
      dropdownToggle.classList.remove("cc-open");
      dropdownToggle.setAttribute("aria-expanded", "false");
    }

    function toggleDropdown() {
      if (!dropdownMenu || !dropdownMenu.classList.contains("cc-open")) {
        openDropdown();
        return;
      }

      closeDropdown();
    }

    function scrollActiveTabIntoView(index) {
      if (isMobileDropdown || !tabMenuWrapper) return;

      const activeLink = tabLinks[index];
      const containerLeft = tabMenuWrapper.scrollLeft;
      const containerWidth = tabMenuWrapper.clientWidth;
      const tabLeft = activeLink.offsetLeft;
      const tabWidth = activeLink.offsetWidth;

      if (
        tabLeft < containerLeft ||
        tabLeft + tabWidth > containerLeft + containerWidth
      ) {
        tabMenuWrapper.scrollTo({
          left: tabLeft,
          behavior: "smooth",
        });
      }
    }

    function setActiveTab(index, options) {
      const settings = Object.assign({ restartAutoplay: true }, options);

      if (index < 0 || index >= tabLinks.length) return;

      tabLinks.forEach((link, linkIndex) => {
        const isActive = linkIndex === index;
        const overlay = link.querySelector(SELECTORS.linkButton);

        link.setAttribute("aria-selected", String(isActive));
        link.classList.toggle(ACTIVE_CLASS, isActive);

        if (overlay) {
          overlay.setAttribute("tabindex", isActive ? "0" : "-1");
        }
      });

      tabPanes.forEach((pane, paneIndex) => {
        const isActive = paneIndex === index;

        pane.setAttribute("aria-hidden", String(!isActive));
        pane.classList.toggle(ACTIVE_CLASS, isActive);
      });

      currentActiveIndex = index;
      updateProgressButtons(index);
      updateDropdownText(index);
      closeDropdown();
      scrollActiveTabIntoView(index);

      if (settings.restartAutoplay) {
        restartAutoplay();
      }
    }

    function findInitialActiveIndex() {
      if (window.location.hash) {
        const hash = window.location.hash.slice(1);
        const hashIndex = tabLinks.findIndex((link) => link.id === hash);

        if (hashIndex !== -1) return hashIndex;
      }

      const activeIndex = tabLinks.findIndex((link) =>
        link.classList.contains(ACTIVE_CLASS),
      );

      return activeIndex === -1 ? 0 : activeIndex;
    }

    function setupMobileDropdown() {
      if (!isMobileDropdown || !dropdownToggle || !dropdownMenu) return;

      dropdownToggle.setAttribute("aria-haspopup", "true");
      dropdownToggle.setAttribute("aria-expanded", "false");

      addListener(dropdownToggle, "click", (event) => {
        event.stopPropagation();
        toggleDropdown();
      });

      addListener(document, "click", (event) => {
        if (!component.contains(event.target)) {
          closeDropdown();
        }
      });

      addListener(document, "keydown", (event) => {
        if (event.key !== "Escape") return;

        closeDropdown();
        dropdownToggle.focus();
      });
    }

    function setupTabClicks() {
      tabLinks.forEach((link, index) => {
        const target = link.querySelector(SELECTORS.linkButton) || link;

        addListener(target, "click", (event) => {
          event.preventDefault();
          setActiveTab(index);

          if (cachedWindowWidth < 768 && !isMobileDropdown) {
            link.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
            });
          }
        });
      });
    }

    function setupKeyboardNav() {
      tabLinks.forEach((link) => {
        const target = link.querySelector(SELECTORS.linkButton) || link;

        addListener(target, "keydown", (event) => {
          let nextIndex = currentActiveIndex;

          switch (event.key) {
            case "ArrowLeft":
              nextIndex =
                currentActiveIndex > 0
                  ? currentActiveIndex - 1
                  : tabLinks.length - 1;
              break;
            case "ArrowRight":
              nextIndex =
                currentActiveIndex < tabLinks.length - 1
                  ? currentActiveIndex + 1
                  : 0;
              break;
            case "Home":
              nextIndex = 0;
              break;
            case "End":
              nextIndex = tabLinks.length - 1;
              break;
            default:
              return;
          }

          event.preventDefault();
          setActiveTab(nextIndex);

          const nextTarget =
            tabLinks[nextIndex].querySelector(SELECTORS.linkButton) ||
            tabLinks[nextIndex];
          nextTarget.focus();
        });
      });
    }

    function setupAutoplayControls() {
      if (!autoplayEnabled) return;

      if (autoplayHoverPause) {
        addListener(component, "mouseenter", () => pauseAutoplay("hover"));
        addListener(component, "mouseleave", () => resumeAutoplay("hover"));
      }

      if (autoplayToggleButton) {
        addListener(autoplayToggleButton, "click", () => {
          if (pausedByUser) {
            resumeAutoplay("user");
          } else {
            pauseAutoplay("user");
          }
        });

        updateToggleButton();
      }
    }

    function setupResizeHandler() {
      addListener(window, "resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          cachedWindowWidth = window.innerWidth;
        }, 150);
      });
    }

    function setupHashChangeHandler() {
      addListener(window, "hashchange", () => {
        if (!window.location.hash) return;

        const hash = window.location.hash.slice(1);
        const matchIndex = tabLinks.findIndex((link) => link.id === hash);

        if (matchIndex !== -1) {
          setActiveTab(matchIndex);
        }
      });
    }

    function cleanup() {
      eventListeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
      });
      eventListeners.length = 0;

      clearAutoplayTimer(false);
      component.classList.remove(PAUSED_CLASS);
      clearTimeout(resizeTimer);
      resizeTimer = null;

      progressButtons.forEach((button) => {
        button.remove();
      });
      progressButtons = [];

      if (component[CLEANUP_KEY] === cleanup) {
        delete component[CLEANUP_KEY];
      }
    }

    function init() {
      component.classList.remove(PAUSED_CLASS);
      setupProgressButtons();
      setupMobileDropdown();
      setupTabClicks();
      setupKeyboardNav();
      setupAutoplayControls();
      setupResizeHandler();
      setupHashChangeHandler();

      setActiveTab(findInitialActiveIndex(), { restartAutoplay: false });

      if (autoplayEnabled) {
        startAutoplay(autoplayDurationMs);
      }
    }

    init();
    component[CLEANUP_KEY] = cleanup;
  }

  function initAllTabs() {
    const components = toArray(document.querySelectorAll(SELECTORS.component));

    components.forEach((component) => {
      const existingCleanup = component[CLEANUP_KEY] || component.__tabsCleanup;

      if (shouldDisableTabsOnMobile(component)) {
        if (typeof existingCleanup === "function") {
          existingCleanup();
          delete component.__tabsCleanup;
        }

        enableMobileDisabledState(component);
        return;
      }

      disableMobileDisabledState(component);
      initTabsComponent(component);
    });
  }

  let lastMobileState = isMobileTabsViewport();
  let globalResizeTimer = null;

  function setupGlobalResizeHandler() {
    window.addEventListener("resize", () => {
      clearTimeout(globalResizeTimer);
      globalResizeTimer = window.setTimeout(() => {
        const nextMobileState = isMobileTabsViewport();

        if (nextMobileState === lastMobileState) return;

        lastMobileState = nextMobileState;
        initAllTabs();
      }, 150);
    });
  }

  function startTabsScript() {
    initAllTabs();
    setupGlobalResizeHandler();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTabsScript);
  } else {
    startTabsScript();
  }
})();
