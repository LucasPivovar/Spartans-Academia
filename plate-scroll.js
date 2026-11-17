/* A decorative plate follows the page gutters instead of crossing the content. */
(() => {
  const plate = document.querySelector(".scroll-plate");
  const main = document.querySelector("main");
  const photo = document.querySelector(".about-media");
  const space = document.querySelector("#estrutura");
  const gallery = document.querySelector(".coverflow");
  const heading = document.querySelector("#plans-title");
  if (!plate || !photo || !space || !gallery || !heading || !window.gsap || !window.ScrollTrigger || !window.MotionPathPlugin) return;

  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    let timeline;
    const box = (element) => {
      let left = 0;
      let top = 0;
      let parent = element;
      while (parent && parent !== main) {
        left += parent.offsetLeft;
        top += parent.offsetTop;
        parent = parent.offsetParent;
      }
      return { left, right: left + element.offsetWidth, top, bottom: top + element.offsetHeight, width: element.offsetWidth, height: element.offsetHeight };
    };

    const build = () => {
      timeline?.scrollTrigger?.kill();
      timeline?.kill();
      // Reveal transforms must not affect the measured anchors.
      const imageBox = box(photo);
      const spaceBox = box(space);
      const galleryBox = box(gallery);
      const titleBox = box(heading);
      const mobile = matchMedia("(max-width: 960px)").matches;
      const width = main.clientWidth;
      const size = width <= 640 ? 58 : mobile ? 72 : 112;
      const half = size / 2;
      const start = { x: Math.max(half + 6, imageBox.left + 8), y: imageBox.bottom - 12 };
      const rail = mobile ? width - 12 : Math.max(half + 10, imageBox.left - 90);
      const finish = {
        x: mobile ? width - half - 16 : Math.min(width - half - 36, titleBox.right + half + 34),
        y: titleBox.top + titleBox.height * .58,
      };
      const points = mobile ? [
        start,
        { x: imageBox.left + imageBox.width * .6, y: imageBox.bottom + 12 },
        { x: rail, y: imageBox.bottom + 36 },
        { x: rail - 6, y: spaceBox.top + 70 },
        { x: rail, y: galleryBox.top + galleryBox.height * .5 },
        { x: rail - 24, y: spaceBox.bottom - 64 },
        finish,
      ] : [
        start,
        { x: rail + 18, y: imageBox.bottom + 74 },
        { x: width * .22, y: spaceBox.top + 118 },
        { x: rail, y: galleryBox.top + 72 },
        { x: rail + 16, y: galleryBox.top + galleryBox.height * .5 },
        { x: rail + 62, y: spaceBox.bottom - 100 },
        { x: width * .33, y: titleBox.top - 48 },
        finish,
      ];
      gsap.set(plate, { width: size, height: size, xPercent: -50, yPercent: -50, x: start.x, y: start.y, autoAlpha: 1 });
      gsap.set(plate.firstElementChild, { rotation: 0 });
      timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "traveling-plate",
          trigger: main,
          start: () => main.getBoundingClientRect().top + scrollY + start.y - innerHeight * .52,
          end: () => main.getBoundingClientRect().top + scrollY + finish.y - innerHeight * .43,
          scrub: .65,
          invalidateOnRefresh: true,
        },
      });
      timeline.to(plate, { motionPath: { path: points, curviness: 1.15, autoRotate: false }, duration: 1 }, 0);
      timeline.to(plate.firstElementChild, { rotation: mobile ? -720 : 1080, duration: 1 }, 0);
    };

    // Wait for fonts and images so the route matches the real layout.
    let disposed = false;
    let resizeTimer;
    const ready = async () => {
      await document.fonts.ready;
      await Promise.all([photo.querySelector("img"), ...gallery.querySelectorAll("img")].map(img => img?.decode?.().catch(() => {})));
      if (!disposed) { build(); ScrollTrigger.refresh(); }
    };
    const resized = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (!disposed) { build(); ScrollTrigger.refresh(); } }, 180);
    };
    ready();
    window.addEventListener("resize", resized);
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", resized);
      timeline?.scrollTrigger?.kill();
      timeline?.kill();
      gsap.set(plate, { autoAlpha: 0 });
    };
  });
})();
