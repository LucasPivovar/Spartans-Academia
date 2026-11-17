(() => {
  const cards = [...document.querySelectorAll(".plan-card")];
  const controls = [...document.querySelectorAll(".btn-secondary, .plan-btn:not(.plan-btn--primary)")];
  const svgNS = "http://www.w3.org/2000/svg";
  const shapes = [...cards, ...controls].map(element => {
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("cut-outline");
    svg.setAttribute("aria-hidden", "true");
    const outline = document.createElementNS(svgNS, "path");
    outline.classList.add("cut-outline-line");
    svg.append(outline);
    let accent;
    if (element.matches(".plan-card")) {
      accent = document.createElementNS(svgNS, "path");
      accent.classList.add("cut-outline-accent");
      svg.append(accent);
    }
    element.append(svg);
    element.classList.add("has-cut-outline");
    return { element, svg, outline, accent };
  });

  // Use actual pixel dimensions so every diagonal meets the straight edges.
  const draw = ({ element, svg, outline, accent }) => {
    const w = element.clientWidth;
    const h = element.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const isCard = element.matches(".plan-card");
    const secondary = element.matches(".btn-secondary");
    const topCut = isCard ? 26 : 12;
    const bottomCut = isCard ? 14 : 0;
    const s = .8;
    const d = secondary
      ? `M12 ${s}H${w-s}V${h-12}L${w-12} ${h-s}H${s}V12Z`
      : `M${s} ${s}H${w-topCut}L${w-s} ${topCut}V${h-s}H${bottomCut || s}L${s} ${h-(bottomCut || s)}Z`;
    outline.setAttribute("d", d);
    if (accent) accent.setAttribute("d", element.matches(".plan-card--featured")
      ? `M1.5 1.5H${w-26}L${w-1.5} 26`
      : `M${w-26} 1.5L${w-1.5} 26`);
  };
  shapes.forEach(draw);
  const resizeObserver = new ResizeObserver(entries => {
    entries.forEach(({ target }) => draw(shapes.find(shape => shape.element === target)));
  });
  shapes.forEach(({ element }) => resizeObserver.observe(element));

  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  cards.forEach(card => card.classList.remove("reveal"));
  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    const desktop = matchMedia("(min-width: 961px)").matches;
    const removeListeners = [];
    cards.forEach((card, index) => {
      let entered = false;
      const content = card.querySelectorAll(".plan-top, .plan-price, .plan-features, .plan-btn");
      gsap.timeline({
        scrollTrigger: { trigger: card, start: "top 91%", once: true },
        delay: desktop ? index * .1 : 0,
        onComplete: () => { entered = true; gsap.set([card, ...content], { clearProps: "transform,opacity,visibility" }); },
      })
        .fromTo(card, { autoAlpha: 0, y: 30, scale: .985 }, { autoAlpha: 1, y: 0, scale: 1, duration: .68, ease: "power3.out" })
        .fromTo(content, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .4, stagger: .055, ease: "power2.out" }, .12);

      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const lift = () => { if (entered) gsap.to(card, { y: -5, duration: .26, ease: "power2.out", overwrite: "auto" }); };
        const settle = () => { if (entered) gsap.to(card, { y: 0, duration: .3, ease: "power2.out", overwrite: "auto" }); };
        card.addEventListener("pointerenter", lift);
        card.addEventListener("pointerleave", settle);
        card.addEventListener("focusin", lift);
        card.addEventListener("focusout", settle);
        removeListeners.push(() => {
          card.removeEventListener("pointerenter", lift);
          card.removeEventListener("pointerleave", settle);
          card.removeEventListener("focusin", lift);
          card.removeEventListener("focusout", settle);
        });
      }
    });
    return () => removeListeners.forEach(remove => remove());
  });
})();
