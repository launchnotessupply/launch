(function () {
  "use strict";
  const MOBILE_BREAKPOINT = 767;
  const ACTIVE_CLASS = "cc-active";
  const AUTOPLAY_PROGRESS_CLASS = "autoplay-tabs_progress";

  function isMobileTabsViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function shouldDisableTabsOnMobile(component) {
    return (
      component.getAttribute("data-tabs-disable-mobile") === "true" &&
      isMobileTabsViewport()
    );
  }

  function enableMobileDisabledState(component) {
    component.setAttribute("data-tabs-mobile-disabled-active", "true");

    queryScoped(component, "[data-tabs-pane]").forEach((pane) => {
      pane.setAttribute("aria-hidden", "false");
    });
  }

  function disableMobileDisabledState(component) {
    component.removeAttribute("data-tabs-mobile-disabled-active");
  }

  function belongsToTabsComponent(component, element) {
    return element.closest("[data-tabs-component]") === component;
  }

  function queryScoped(component, selector) {
    return Array.from(component.querySelectorAll(selector)).filter((element) =>
      belongsToTabsComponent(component, element),
    );
  }

  function queryScopedFirst(component, selector) {
    return queryScoped(component, selector)[0] || null;
  }

  /**
   * Initialize a single tabs component
   */
  function initTabsComponent(component) {
    const existingCleanup =
      component.__autoplayTabsCleanup || component.__tabsCleanup;

    if (typeof existingCleanup === "function") {
      existingCleanup();
      delete component.__tabsCleanup;
    }

    const tabMenu = queryScopedFirst(component, "[data-tabs-menu]");
    const dropdownMenu = queryScopedFirst(
      component,
      "[data-tabs-menu-dropdown-menu]",
    );
    const tabMenuWrapper = queryScopedFirst(
      component,
      "[data-tabs-menu-wrapper]",
    );
    const tabLinks = queryScoped(component, "[data-tabs-link]");
    const tabPanes = queryScoped(component, "[data-tabs-pane]");

    if (
      !tabMenu ||
      !dropdownMenu ||
      !tabMenuWrapper ||
      !tabLinks.length ||
      !tabPanes.length
    ) {
      return;
    }

    // Convert NodeLists to arrays once for better performance
    const tabLinksArray = tabLinks;
    const tabPanesArray = tabPanes;

    // State
    let currentActiveIndex = 0;
    let dropdownToggle = queryScopedFirst(
      component,
      "[data-tabs-menu-dropdown-toggle]",
    );
    let dropdownText = dropdownToggle
      ? dropdownToggle.querySelector("[data-tabs-menu-dropdown-text]")
      : null;
    let isMobileDropdown =
      tabMenu.getAttribute("data-tab-mobile-dropdown") === "true";

    // Cache autoplay toggle button
    let autoplayToggleButton = queryScopedFirst(
      component,
      "[data-tabs-autoplay-toggle]",
    );
    const autoplayProgressList = queryScopedFirst(
      component,
      "[data-tabs-autoplay-progress-list]",
    );
    let autoplayProgressButtons = [];
    let autoplayProgressTemplate = null;

    // Autoplay state
    let autoplayEnabled = tabMenu.getAttribute("data-tabs-autoplay") === "true";
    const parsedAutoplayDuration = parseFloat(
      tabMenu.getAttribute("data-tabs-autoplay-duration"),
    );
    let autoplayDuration =
      isFinite(parsedAutoplayDuration) && parsedAutoplayDuration > 0
        ? parsedAutoplayDuration
        : 5;
    let autoplayHoverPause =
      tabMenu.getAttribute("data-tabs-autoplay-hover-pause") === "true";
    let autoplayTimer = null;
    let autoplayObserver = null;
    let isAutoplayPaused = false;
    let autoplayStartTime = null;
    let autoplayElapsedTime = 0;
    const autoplayPauseReasons = {
      user: false,
      hover: false,
      visibility: false,
    };

    // Cache window width for responsive checks
    let cachedWindowWidth = window.innerWidth;
    let resizeTimer = null;

    // Event listener references for cleanup
    const eventListeners = [];

    /**
     * Set the active tab by index
     */
    function setActiveTab(index) {
      if (index < 0 || index >= tabLinksArray.length) {
        return;
      }

      // Batch DOM reads and writes to avoid layout thrashing
      const overlays = [];
      const isActiveStates = [];

      // Phase 1: Read from DOM
      for (let i = 0; i < tabLinksArray.length; i++) {
        const link = tabLinksArray[i];
        const overlay = link.querySelector("[data-tabs-link-button]");
        overlays.push(overlay);
        isActiveStates.push(i === index);
      }

      // Phase 2: Write to DOM (batch updates)
      for (let i = 0; i < tabLinksArray.length; i++) {
        const link = tabLinksArray[i];
        const isActive = isActiveStates[i];

        link.setAttribute("aria-selected", isActive);
        link.classList.toggle(ACTIVE_CLASS, isActive);

        if (overlays[i]) {
          overlays[i].setAttribute("tabindex", isActive ? "0" : "-1");
        }
      }

      // Update tab panes
      for (let i = 0; i < tabPanesArray.length; i++) {
        const isActive = i === index;
        tabPanesArray[i].setAttribute("aria-hidden", !isActive);
        tabPanesArray[i].classList.toggle(ACTIVE_CLASS, isActive);
      }

      currentActiveIndex = index;
      updateAutoplayProgressButtons(index);

      // Update dropdown toggle text if it exists
      if (dropdownText && isMobileDropdown) {
        const activeTabName =
          tabLinksArray[index].getAttribute("data-tab-link-name");
        dropdownText.textContent =
          activeTabName || tabLinksArray[index].textContent;
      }

      // Close dropdown if open
      if (dropdownToggle && dropdownMenu.classList.contains("cc-open")) {
        closeDropdown();
      }

      // Scroll active tab into view within the overflow container
      if (!isMobileDropdown) {
        const activeLink = tabLinksArray[index];
        const scrollContainer = tabMenuWrapper;

        // Batch read operations
        const containerLeft = scrollContainer.scrollLeft;
        const containerWidth = scrollContainer.clientWidth;
        const tabLeft = activeLink.offsetLeft;
        const tabWidth = activeLink.offsetWidth;

        // Scroll to show the tab on the left side of the container
        if (
          tabLeft < containerLeft ||
          tabLeft + tabWidth > containerLeft + containerWidth
        ) {
          scrollContainer.scrollTo({
            left: tabLeft,
            behavior: "smooth",
          });
        }
      }

      // Restart autoplay if enabled
      if (autoplayEnabled) {
        if (isAutoplayPaused) {
          // Reset elapsed time when manually switching tabs while paused
          autoplayElapsedTime = 0;
        } else {
          restartAutoplay();
        }
      }
    }

    /**
     * Open the mobile dropdown
     */
    function openDropdown() {
      if (!dropdownToggle || !dropdownMenu) return;
      dropdownMenu.classList.add("cc-open");
      dropdownToggle.classList.add("cc-open");
      dropdownToggle.setAttribute("aria-expanded", "true");
    }

    /**
     * Close the mobile dropdown
     */
    function closeDropdown() {
      if (!dropdownToggle || !dropdownMenu) return;
      dropdownMenu.classList.remove("cc-open");
      dropdownToggle.classList.remove("cc-open");
      dropdownToggle.setAttribute("aria-expanded", "false");
    }

    /**
     * Toggle the mobile dropdown
     */
    function toggleDropdown() {
      if (dropdownMenu.classList.contains("cc-open")) {
        closeDropdown();
      } else {
        openDropdown();
      }
    }

    /**
     * Setup mobile dropdown interactions
     */
    function setupMobileDropdown() {
      if (!isMobileDropdown || !dropdownToggle) return;

      // Set initial aria attributes
      dropdownToggle.setAttribute("aria-haspopup", "true");
      dropdownToggle.setAttribute("aria-expanded", "false");

      // Set initial text to active tab
      const activeLink =
        tabLinksArray.find(
          (link) => link.getAttribute("aria-selected") === "true",
        ) ||
        tabLinksArray.find((link) => link.classList.contains(ACTIVE_CLASS)) ||
        tabLinksArray[0];
      if (dropdownText && activeLink) {
        const activeTabName = activeLink.getAttribute("data-tab-link-name");
        dropdownText.textContent = activeTabName || activeLink.textContent;
      }

      // Toggle dropdown on click
      const toggleHandler = function (e) {
        e.stopPropagation();
        toggleDropdown();
      };
      dropdownToggle.addEventListener("click", toggleHandler);
      eventListeners.push({
        element: dropdownToggle,
        type: "click",
        handler: toggleHandler,
      });

      // Close dropdown when clicking outside - use delegation on document
      const outsideClickHandler = function (e) {
        if (!component.contains(e.target)) {
          closeDropdown();
        }
      };
      document.addEventListener("click", outsideClickHandler);
      eventListeners.push({
        element: document,
        type: "click",
        handler: outsideClickHandler,
      });

      // Close on escape key - use delegation on document
      const escapeHandler = function (e) {
        if (e.key === "Escape" && dropdownMenu.classList.contains("cc-open")) {
          closeDropdown();
          dropdownToggle.focus();
        }
      };
      document.addEventListener("keydown", escapeHandler);
      eventListeners.push({
        element: document,
        type: "keydown",
        handler: escapeHandler,
      });
    }

    /**
     * Setup autoplay progress bars
     */
    function setupAutoplayProgressBars() {
      // Set CSS variable for duration
      component.style.setProperty(
        "--autoplay-duration",
        `${autoplayDuration}s`,
      );

      if (!autoplayProgressList) return;

      const storedTemplate =
        autoplayProgressList.__autoplayTabsProgressTemplate;
      const templateSource =
        storedTemplate ||
        autoplayProgressList.querySelector(`.${AUTOPLAY_PROGRESS_CLASS}`) ||
        autoplayProgressList.querySelector("[data-tabs-autoplay-progress]") ||
        autoplayProgressList.firstElementChild;

      if (templateSource && !storedTemplate) {
        autoplayProgressList.__autoplayTabsProgressTemplate =
          templateSource.cloneNode(true);
      }

      autoplayProgressTemplate =
        autoplayProgressList.__autoplayTabsProgressTemplate || null;
      autoplayProgressButtons = tabLinksArray.map(createAutoplayProgressButton);

      autoplayProgressList.replaceChildren(...autoplayProgressButtons);

      autoplayProgressButtons.forEach((button, index) => {
        const clickHandler = function (e) {
          e.preventDefault();
          setActiveTab(index);
        };

        button.addEventListener("click", clickHandler);
        eventListeners.push({
          element: button,
          type: "click",
          handler: clickHandler,
        });

        if (button.tagName !== "BUTTON") {
          const keydownHandler = function (e) {
            if (e.key !== "Enter" && e.key !== " ") return;

            e.preventDefault();
            setActiveTab(index);
          };

          button.addEventListener("keydown", keydownHandler);
          eventListeners.push({
            element: button,
            type: "keydown",
            handler: keydownHandler,
          });
        }
      });
    }

    /**
     * Create one autoplay progress button for a tab link
     */
    function createAutoplayProgressButton(tabLink, index) {
      const button = autoplayProgressTemplate
        ? autoplayProgressTemplate.cloneNode(true)
        : document.createElement("button");
      const label = getTabLabel(tabLink, index);

      button.removeAttribute("id");
      button.classList.add(AUTOPLAY_PROGRESS_CLASS);
      button.classList.remove(ACTIVE_CLASS);
      button.setAttribute("data-tabs-autoplay-progress", "");
      button.setAttribute("data-tabs-autoplay-progress-index", index);
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

    /**
     * Get an accessible label for generated progress buttons
     */
    function getTabLabel(tabLink, index) {
      const tabName = tabLink.getAttribute("data-tab-link-name");
      const label = tabName || tabLink.textContent || `Tab ${index + 1}`;

      return label.trim().replace(/\s+/g, " ") || `Tab ${index + 1}`;
    }

    /**
     * Sync generated progress buttons to the active tab
     */
    function updateAutoplayProgressButtons(index) {
      if (!autoplayProgressButtons.length) return;

      for (let i = 0; i < autoplayProgressButtons.length; i++) {
        const button = autoplayProgressButtons[i];
        const isActive = i === index;

        button.classList.toggle(ACTIVE_CLASS, isActive);

        if (isActive) {
          button.setAttribute("aria-current", "true");
        } else {
          button.removeAttribute("aria-current");
        }
      }
    }

    /**
     * Restart the active progress pseudo-element animation
     */
    function restartAutoplayProgress(index) {
      const progressButton = autoplayProgressButtons[index];

      if (progressButton) {
        progressButton.classList.remove(ACTIVE_CLASS);
        // Force style recalculation so ::before/::after animations restart.
        void progressButton.offsetWidth;
        progressButton.classList.add(ACTIVE_CLASS);
        progressButton.setAttribute("aria-current", "true");
        return;
      }

      // Backwards compatibility for older markup with a progress child in the tab.
      const activeLink = tabLinksArray[index];
      const progressBar = activeLink.querySelector(
        "[data-tabs-autoplay-progress]",
      );

      if (progressBar) {
        progressBar.style.animation = "none";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            progressBar.style.animation = "";
          });
        });
      }
    }

    /**
     * Start autoplay
     */
    function startAutoplay() {
      if (!autoplayEnabled || isAutoplayPaused) return;

      stopAutoplay();

      const remainingTime = Math.max(
        0,
        autoplayDuration * 1000 - autoplayElapsedTime,
      );
      autoplayStartTime = Date.now();

      autoplayTimer = setTimeout(() => {
        const nextIndex = (currentActiveIndex + 1) % tabLinksArray.length;
        setActiveTab(nextIndex);
      }, remainingTime);
    }

    /**
     * Stop autoplay
     */
    function stopAutoplay() {
      if (autoplayTimer) {
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }
      autoplayStartTime = null;
    }

    /**
     * Restart autoplay (used when manually switching tabs)
     */
    function restartAutoplay() {
      if (!autoplayEnabled) return;

      // Reset elapsed time
      autoplayElapsedTime = 0;

      restartAutoplayProgress(currentActiveIndex);

      startAutoplay();
    }

    /**
     * Update toggle button aria-label
     */
    function updateToggleButton() {
      if (!autoplayToggleButton) return;

      if (autoplayPauseReasons.user) {
        autoplayToggleButton.setAttribute("aria-label", "Play autoplay");
      } else {
        autoplayToggleButton.setAttribute("aria-label", "Pause autoplay");
      }
    }

    /**
     * Check whether autoplay has any active pause reason
     */
    function hasAutoplayPauseReason() {
      return (
        autoplayPauseReasons.user ||
        autoplayPauseReasons.hover ||
        autoplayPauseReasons.visibility
      );
    }

    /**
     * Apply or clear a specific autoplay pause reason
     */
    function setAutoplayPauseReason(reason, shouldPause) {
      if (!autoplayEnabled || !(reason in autoplayPauseReasons)) return;

      const wasPaused = isAutoplayPaused;
      autoplayPauseReasons[reason] = shouldPause;
      isAutoplayPaused = hasAutoplayPauseReason();

      if (!wasPaused && isAutoplayPaused && autoplayStartTime !== null) {
        autoplayElapsedTime += Date.now() - autoplayStartTime;
      }

      component.classList.toggle("autoplay-paused", isAutoplayPaused);

      if (wasPaused !== isAutoplayPaused) {
        if (isAutoplayPaused) {
          stopAutoplay();
        } else {
          startAutoplay();
        }
      }

      updateToggleButton();
    }

    /**
     * Pause autoplay
     */
    function pauseAutoplay(reason) {
      setAutoplayPauseReason(reason || "user", true);
    }

    /**
     * Resume autoplay
     */
    function resumeAutoplay(reason) {
      setAutoplayPauseReason(reason || "user", false);
    }

    /**
     * Setup intersection observer for autoplay
     */
    function setupAutoplayObserver() {
      if (!autoplayEnabled) return;

      if (!("IntersectionObserver" in window)) {
        if ("hidden" in document) {
          const visibilityChangeHandler = function () {
            if (document.hidden) {
              pauseAutoplay("visibility");
            } else {
              resumeAutoplay("visibility");
            }
          };

          document.addEventListener(
            "visibilitychange",
            visibilityChangeHandler,
          );
          eventListeners.push({
            element: document,
            type: "visibilitychange",
            handler: visibilityChangeHandler,
          });

          visibilityChangeHandler();
        }

        return;
      }

      autoplayObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              resumeAutoplay("visibility");
            } else {
              pauseAutoplay("visibility");
            }
          });
        },
        { threshold: 0.5 },
      );

      autoplayObserver.observe(component);
    }

    /**
     * Setup hover pause for autoplay
     */
    function setupAutoplayHoverPause() {
      if (!autoplayEnabled || !autoplayHoverPause) return;

      const mouseEnterHandler = () => {
        pauseAutoplay("hover");
      };
      const mouseLeaveHandler = () => {
        resumeAutoplay("hover");
      };

      component.addEventListener("mouseenter", mouseEnterHandler);
      component.addEventListener("mouseleave", mouseLeaveHandler);

      eventListeners.push({
        element: component,
        type: "mouseenter",
        handler: mouseEnterHandler,
      });
      eventListeners.push({
        element: component,
        type: "mouseleave",
        handler: mouseLeaveHandler,
      });
    }

    /**
     * Setup play/pause toggle button
     */
    function setupAutoplayToggle() {
      if (!autoplayEnabled || !autoplayToggleButton) return;

      const toggleHandler = () => {
        if (autoplayPauseReasons.user) {
          resumeAutoplay();
        } else {
          pauseAutoplay();
        }
      };

      autoplayToggleButton.addEventListener("click", toggleHandler);
      eventListeners.push({
        element: autoplayToggleButton,
        type: "click",
        handler: toggleHandler,
      });

      updateToggleButton();
    }

    /**
     * Find initial active tab index
     */
    function findInitialActiveIndex() {
      // Check for URL hash match
      if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const matchIndex = tabLinksArray.findIndex((link) => link.id === hash);
        if (matchIndex !== -1) {
          return matchIndex;
        }
      }

      // Check for cc-active class
      const customActiveIndex = tabLinksArray.findIndex((link) =>
        link.classList.contains(ACTIVE_CLASS),
      );
      if (customActiveIndex !== -1) {
        return customActiveIndex;
      }

      // Default to first tab
      return 0;
    }

    /**
     * Setup keyboard navigation
     */
    function setupKeyboardNav() {
      const tabLinksLength = tabLinksArray.length;

      tabLinksArray.forEach((link) => {
        const overlay = link.querySelector("[data-tabs-link-button]");
        if (!overlay) return;

        const keydownHandler = function (e) {
          let newIndex = currentActiveIndex;

          switch (e.key) {
            case "ArrowLeft":
              e.preventDefault();
              newIndex =
                currentActiveIndex > 0
                  ? currentActiveIndex - 1
                  : tabLinksLength - 1;
              break;
            case "ArrowRight":
              e.preventDefault();
              newIndex =
                currentActiveIndex < tabLinksLength - 1
                  ? currentActiveIndex + 1
                  : 0;
              break;
            case "Home":
              e.preventDefault();
              newIndex = 0;
              break;
            case "End":
              e.preventDefault();
              newIndex = tabLinksLength - 1;
              break;
            default:
              return;
          }

          setActiveTab(newIndex);
          const nextOverlay = tabLinksArray[newIndex].querySelector(
            "[data-tabs-link-button]",
          );
          if (nextOverlay) {
            nextOverlay.focus();
          }
        };

        overlay.addEventListener("keydown", keydownHandler);
        eventListeners.push({
          element: overlay,
          type: "keydown",
          handler: keydownHandler,
        });
      });
    }

    /**
     * Setup click handlers
     */
    function setupClickHandlers() {
      tabLinksArray.forEach((link, index) => {
        const overlay = link.querySelector("[data-tabs-link-button]");
        if (!overlay) return;

        const clickHandler = function (e) {
          e.preventDefault();
          setActiveTab(index);

          // Scroll the active tab into view on mobile - use cached width
          if (cachedWindowWidth < 768 && !isMobileDropdown) {
            link.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
            });
          }
        };

        overlay.addEventListener("click", clickHandler);
        eventListeners.push({
          element: overlay,
          type: "click",
          handler: clickHandler,
        });
      });
    }

    /**
     * Setup window resize handler
     */
    function setupResizeHandler() {
      const resizeHandler = function () {
        // Debounce resize events
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          cachedWindowWidth = window.innerWidth;
        }, 150);
      };

      window.addEventListener("resize", resizeHandler);
      eventListeners.push({
        element: window,
        type: "resize",
        handler: resizeHandler,
      });
    }

    /**
     * Cleanup function to remove event listeners and observers
     */
    function cleanup() {
      // Remove all event listeners
      eventListeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
      });
      eventListeners.length = 0;

      // Disconnect observer
      if (autoplayObserver) {
        autoplayObserver.disconnect();
        autoplayObserver = null;
      }

      // Clear timers
      stopAutoplay();
      clearTimeout(resizeTimer);
      resizeTimer = null;

      if (autoplayProgressButtons.length) {
        autoplayProgressButtons.forEach((button) => {
          button.remove();
        });
        autoplayProgressButtons = [];
      }

      if (component.__autoplayTabsCleanup === cleanup) {
        delete component.__autoplayTabsCleanup;
      }
    }

    /**
     * Initialize the component
     */
    function init() {
      // Setup mobile dropdown if needed
      setupMobileDropdown();

      // Setup autoplay if needed
      setupAutoplayProgressBars();
      setupAutoplayObserver();
      setupAutoplayHoverPause();
      setupAutoplayToggle();

      // Find and set initial active tab
      const initialIndex = findInitialActiveIndex();
      setActiveTab(initialIndex);

      // Setup interactions
      setupClickHandlers();
      setupKeyboardNav();
      setupResizeHandler();

      // Start autoplay if enabled
      if (autoplayEnabled) {
        startAutoplay();
      }

      // Handle hash changes for deep linking
      const hashChangeHandler = function () {
        if (window.location.hash) {
          const hash = window.location.hash.substring(1);
          const matchIndex = tabLinksArray.findIndex(
            (link) => link.id === hash,
          );
          if (matchIndex !== -1) {
            setActiveTab(matchIndex);
          }
        }
      };

      window.addEventListener("hashchange", hashChangeHandler);
      eventListeners.push({
        element: window,
        type: "hashchange",
        handler: hashChangeHandler,
      });
    }

    // Initialize this component
    init();

    // Store cleanup function on component for potential later use
    component.__autoplayTabsCleanup = cleanup;
  }

  /**
   * Initialize all tabs components on the page
   */
  function initAllTabs() {
    const components = document.querySelectorAll("[data-tabs-component]");

    if (!components.length) {
      return;
    }

    components.forEach((component) => {
      if (shouldDisableTabsOnMobile(component)) {
        const existingCleanup =
          component.__autoplayTabsCleanup || component.__tabsCleanup;

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

  // Wait for DOM to be fully loaded before initializing
  let globalResizeTimer = null;

  function setupGlobalResizeHandler() {
    window.addEventListener("resize", function () {
      clearTimeout(globalResizeTimer);

      globalResizeTimer = setTimeout(() => {
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
