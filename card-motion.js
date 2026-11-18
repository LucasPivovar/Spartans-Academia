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

(() => {
 const track=document.querySelector('#reviews-track');
 if(!track) return;
 const slides=[...track.querySelectorAll('.testimonial')];
 const status=document.querySelector('.reviews-status');
 let current=0;
 const update=()=>{current=slides.reduce((best,slide,i)=>Math.abs(slide.offsetLeft-slides[0].offsetLeft-track.scrollLeft)<Math.abs(slides[best].offsetLeft-slides[0].offsetLeft-track.scrollLeft)?i:best,0);status.textContent=(current+1)+' / '+slides.length;};
 document.querySelectorAll('[data-review-step]').forEach(button=>button.addEventListener('click',()=>{
  const next=(current+Number(button.dataset.reviewStep)+slides.length)%slides.length;
  track.scrollTo({left:slides[next].offsetLeft-slides[0].offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }));
 track.addEventListener('scroll',update,{passive:true});
 track.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();document.querySelector('[data-review-step="'+(event.key==='ArrowRight'?'1':'-1')+'"]').click();}});
 update();
})();
