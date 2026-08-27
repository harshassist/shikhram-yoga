const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelector('.menu-button')?.addEventListener('click', (event) => {
  const nav = document.querySelector('.site-header nav');
  const open = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!open));
  nav.style.display = open ? '' : 'flex';
  if (!open) Object.assign(nav.style, {position:'absolute', top:'74px', left:'1rem', right:'1rem', padding:'1.5rem', background:'#302a22', flexDirection:'column', gap:'1rem'});
});

document.querySelectorAll('.product button').forEach((button) => {
  button.addEventListener('click', () => {
    const counter = document.querySelector('.icon-button span');
    counter.textContent = Number(counter.textContent) + 1;
    button.textContent = '✓';
    setTimeout(() => button.textContent = '+', 1200);
  });
});

document.querySelector('footer form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.textContent = '✓';
});

if (!reduceMotion && window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.timeline({defaults:{ease:'power3.out'}})
    .from('.site-header', {y:-80, opacity:0, duration:1})
    .from('.hero .reveal', {y:38, opacity:0, stagger:.12, duration:1.05}, '-=.55')
    .from('.hero-note, .scroll-cue', {opacity:0, duration:.8}, '-=.25');

  gsap.to('.hero-image', {scale:1.12, yPercent:8, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  gsap.to('.retreat-backdrop', {yPercent:12, ease:'none', scrollTrigger:{trigger:'.retreat-section', start:'top bottom', end:'bottom top', scrub:true}});

  gsap.utils.toArray('section:not(.hero)').forEach((section) => {
    const targets = section.querySelectorAll('.eyebrow, h2, .section-heading > p');
    if (targets.length) gsap.from(targets, {y:42, opacity:0, stagger:.09, duration:.9, ease:'power2.out', scrollTrigger:{trigger:section, start:'top 78%', once:true}});
  });

  gsap.from('.path-card', {y:60, opacity:0, stagger:.1, duration:.9, scrollTrigger:{trigger:'.path-grid', start:'top 80%', once:true}});
  gsap.from('.practice-card', {x:60, opacity:0, stagger:.08, duration:.9, scrollTrigger:{trigger:'.practice-track', start:'top 78%', once:true}});
  gsap.from('.teacher-card', {y:70, opacity:0, stagger:.12, duration:.9, scrollTrigger:{trigger:'.teacher-grid', start:'top 80%', once:true}});
  gsap.from('.product', {y:60, opacity:0, stagger:.14, duration:.9, scrollTrigger:{trigger:'.products', start:'top 80%', once:true}});
}
