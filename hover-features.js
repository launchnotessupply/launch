(() => {
  const debounce = (func, wait) => {
    let timeout;

    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const isDesktopOrTablet = () => window.matchMedia('(min-width: 768px)').matches;

  const initializeHoverFeatures = () => {
    if (!isDesktopOrTablet()) {
      document.querySelectorAll('[data-hover-feature-mode]').forEach((component) => {
        if (!component._hoverFeaturesInitialized) return;

        component.removeEventListener('mouseover', component._handleMouseOver);
        component.removeEventListener('mouseout', component._handleMouseOut);
        component.removeEventListener('focusin', component._handleFocusIn);

        component.querySelectorAll('[data-hover-features="link-item"].cc-hover').forEach((hovered) => {
          hovered.classList.remove('cc-hover');
        });

        delete component.dataset.scriptInitialized;
        delete component._hoverFeaturesInitialized;
        delete component._handleMouseOver;
        delete component._handleMouseOut;
        delete component._handleFocusIn;
      });

      return;
    }

    document.querySelectorAll('[data-hover-feature-mode]').forEach((component) => {
      if (component._hoverFeaturesInitialized) return;

      component.dataset.scriptInitialized = 'true';
      component._hoverFeaturesInitialized = true;

      const linkItem = '[data-hover-features="link-item"]';

      const clearActive = () => {
        component.querySelectorAll(`${linkItem}.cc-active`).forEach((active) => {
          active.classList.remove('cc-active');
        });
      };

      const clearHover = () => {
        component.querySelectorAll(`${linkItem}.cc-hover`).forEach((hovered) => {
          hovered.classList.remove('cc-hover');
        });
      };

      const setActive = (el) => {
        if (!el) return;
        const activeItems = component.querySelectorAll(`${linkItem}.cc-active`);
        if (activeItems.length === 1 && activeItems[0] === el) return;
        clearActive();
        el.classList.add('cc-active');
      };

      const setHover = (el) => {
        if (!el) return;
        if (el.classList.contains('cc-hover')) return;
        clearHover();
        el.classList.add('cc-hover');
      };

      const setInitialActive = () => {
        setActive(component.querySelector(`${linkItem}.cc-active`) || component.querySelector(linkItem));
      };

      const handleMouseOver = (e) => {
        if (!component.contains(e.target)) return;

        const el = e.target.closest(linkItem);

        if (el && component.contains(el)) {
          setHover(el);
          setActive(el);
        }
      };

      const handleMouseOut = (e) => {
        if (!component.contains(e.target)) return;

        const el = e.target.closest(linkItem);
        if (!el || !component.contains(el)) return;

        const nextLinkItem = e.relatedTarget?.closest?.(linkItem);
        if (nextLinkItem === el) return;

        el.classList.remove('cc-hover');
      };

      const handleFocusIn = (e) => {
        if (!component.contains(e.target)) return;

        const el = e.target.closest(linkItem);
        if (el && component.contains(el)) {
          setActive(el);
        }
      };

      component._handleMouseOver = handleMouseOver;
      component._handleMouseOut = handleMouseOut;
      component._handleFocusIn = handleFocusIn;

      setInitialActive();

      component.addEventListener('mouseover', handleMouseOver, { passive: true });
      component.addEventListener('mouseout', handleMouseOut, { passive: true });
      component.addEventListener('focusin', handleFocusIn);
    });
  };

  const boot = () => {
    initializeHoverFeatures();
    window.addEventListener('resize', debounce(initializeHoverFeatures, 250));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
