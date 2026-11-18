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
 const track=document.querySelector('#reviews-track'); if(!track)return;
 const slides=[...track.querySelectorAll('.testimonial')],status=document.querySelector('.reviews-status');
 let page=0;
 const perPage=()=>innerWidth<=640?1:innerWidth<=960?2:3;
 const pages=()=>Math.ceil(slides.length/perPage());
 const update=()=>{ const step=slides[1].offsetLeft-slides[0].offsetLeft; page=Math.min(pages()-1,Math.round(track.scrollLeft/(step*perPage())));status.textContent=(page+1)+' / '+pages(); };
 const go=(direction)=>{page=(page+direction+pages())%pages();track.scrollTo({left:slides[page*perPage()].offsetLeft-slides[0].offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 document.querySelectorAll('[data-review-step]').forEach(button=>button.addEventListener('click',()=>go(Number(button.dataset.reviewStep))));
 track.addEventListener('scroll',update,{passive:true});
 track.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();go(event.key==='ArrowRight'?1:-1);}});
 new ResizeObserver(update).observe(track);update();
})();
