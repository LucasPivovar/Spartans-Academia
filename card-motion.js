(() => {
 const cards = document.querySelectorAll('.plan-card');
 if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
 const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'cubic-bezier(.2,.7,.3,1)'});
  observer.unobserve(entry.target);
 }), {threshold:.12});
 cards.forEach(card => observer.observe(card));
})();
