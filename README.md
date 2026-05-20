# Webflow Component and Animation Module Pattern
Use Webflow Components for reusable structure and styling. Use data attributes as the behavior contract between Webflow markup and shared JavaScript.
The goal is to get Webflow-style composability without scattering duplicate scripts across every animated section.
## Core Idea
Think in two layers:
```txt
Component = reusable HTML/CSS pattern
data-module = behavior contract
global JS = initializer/runtime
```
Webflow Components should own the markup, classes, slots, and visual variants. JavaScript should live in one shared place and initialize components based on explicit data attributes.
## Recommended Markup
When the whole section is the interactive component:
```html
<section class="section" data-module="feature-tabs">
  ...
</section>
```
When the behavior belongs to a component inside a larger section:
```html
<section class="section">
  <div data-module="feature-tabs">
    ...
  </div>
</section>
```
Use attributes for configuration instead of writing one-off scripts:
```html
<section
  class="section"
  data-module="autoplay-tabs"
  data-autoplay="true"
  data-interval="5000"
>
  ...
</section>
```
## Global Initializer
Keep one shared initializer that scans for behavior modules:
```js
const modules = {
  "autoplay-tabs": initAutoplayTabs,
  "feature-slider": initFeatureSlider,
  "logo-marquee": initLogoMarquee,
  "scroll-reveal": initScrollReveal,
};
document.querySelectorAll("[data-module]").forEach((el) => {
  if (el.dataset.initialized === "true") return;
  const init = modules[el.dataset.module];
  if (!init) return;
  el.dataset.initialized = "true";
  init(el);
});
```
This keeps behavior explicit, reusable, and easy to debug.
## How To Use Webflow Native Components
- Create separate Webflow Components for repeated interface patterns.
- Put `data-module` on the outer wrapper when the component needs JavaScript.
- Let the global initializer target any `[data-module]`, not only a specific Webflow Component instance.
- Keep real JavaScript in a shared file or site-wide custom code area.
- Use `data-*` attributes for per-instance options.
This gives designers the ability to add, remove, and reorder sections while keeping engineering behavior maintainable.
## What To Avoid
- Do not duplicate full GSAP scripts inside every section.
- Do not make every generic section script-aware by default.
- Do not rely on fragile page order or script order.
- Do not animate layout-heavy properties unless necessary.
- Do not initialize every below-the-fold animation eagerly if it can wait until visible.
## Performance Guidelines
- Load shared libraries like GSAP, ScrollTrigger, Lenis, or Swiper once.
- Prefer `defer` for shared scripts when possible.
- Initialize heavier modules with `IntersectionObserver`.
- Animate `transform` and `opacity` where possible.
- Guard against duplicate initialization with `data-initialized`.
- Respect `prefers-reduced-motion`.
- Keep module scripts small and focused.
## North Star
The ideal system lets a designer safely compose pages in Webflow while engineers maintain behavior in one predictable place.
Copy Webflow's modularity and section-level thinking. Do not copy duplicated per-section script blobs unless there is a very controlled reason.
