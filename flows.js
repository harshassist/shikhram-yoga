const currentPage = location.pathname.split('/').pop() || 'index.html';
const flowMoney = value => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);

function createModal(className, content) {
  const dialog = document.createElement('dialog');
  dialog.className = `flow-dialog ${className}`;
  dialog.innerHTML = `<button class="flow-close" aria-label="Close">×</button>${content}`;
  document.body.appendChild(dialog);
  dialog.querySelector('.flow-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  return dialog;
}

function openFlow(dialog) { dialog.showModal(); document.body.classList.add('modal-open'); }

// Context-aware navigation and mobile CTA.
const pageActions = {
  'teachers.html': {label:'Book a class', target:'schedule'},
  'sound-healing.html': {label:'Book sound session', target:'schedule'},
  'retreats.html': {label:'Reserve retreat', target:'retreat'},
  'corporate.html': {label:'Request proposal', target:'proposal'},
  'shop.html': {label:'Bag', target:'bag'}
};
const pageAction = pageActions[currentPage];
if (pageAction) {
  const existing = document.querySelector('.header-actions .button, .header-actions .icon-button');
  if (existing) { existing.textContent = pageAction.label; existing.classList.add('context-action'); }
  const mobileAction = document.createElement('button');
  mobileAction.className = 'mobile-context-cta'; mobileAction.textContent = pageAction.label;
  mobileAction.dataset.target = pageAction.target; document.body.appendChild(mobileAction);
}

// Fast teacher and individual sound scheduling.
if (['teachers.html','sound-healing.html'].includes(currentPage)) {
  const isSound = currentPage === 'sound-healing.html';
  let selectedService = isSound ? 'Resonance Journey' : 'Shikhram · Hatha & Breathwork';
  const schedule = createModal('schedule-dialog', `<div class="fast-flow"><p class="eyebrow">${isSound ? 'Sound session' : 'Private practice'}</p><h2>Choose a time that feels <em>right.</em></h2><div class="fast-step active" data-fast="1"><p class="selected-service"></p><div class="date-row"><button type="button" class="selected"><b>Tue</b><span>01 Sep</span></button><button type="button"><b>Wed</b><span>02 Sep</span></button><button type="button"><b>Sat</b><span>05 Sep</span></button></div><div class="slot-grid"><button type="button">07:00 AM</button><button type="button">09:30 AM</button><button type="button">06:00 PM</button></div><p class="inline-trust">₹1,200 · 60 minutes · Online or Pune studio</p><button class="button fast-next" type="button">Continue</button></div><form class="fast-step" data-fast="2"><label>Name<input name="name" required autocomplete="name"></label><label>Phone or email<input name="contact" required autocomplete="tel"></label><button class="button" type="submit">Request this session</button><a class="whatsapp-fallback" href="https://wa.me/919999999999?text=${encodeURIComponent(isSound ? 'Hi, I would like to book a sound healing session.' : 'Hi, I would like to book a private yoga class.')}" target="_blank" rel="noopener">Book on WhatsApp instead ↗</a></form><div class="fast-step fast-success" data-fast="3"><span class="success-mark">✓</span><p class="eyebrow">Session requested</p><h3>We’ll confirm on WhatsApp.</h3><p>Your preferred time is being held. This is a demo—no real booking was created.</p><button class="button fast-done">Done</button></div></div>`);
  const showFast = step => schedule.querySelectorAll('.fast-step').forEach(el => el.classList.toggle('active', Number(el.dataset.fast) === step));
  const openSchedule = service => { selectedService = service || selectedService; schedule.querySelector('.selected-service').textContent = selectedService; showFast(1); openFlow(schedule); };
  document.querySelectorAll('.card-actions .button[href="#book"], .sound-session-grid .button').forEach(trigger => trigger.addEventListener('click', event => { event.preventDefault(); openSchedule(trigger.closest('article')?.querySelector('h2,h3')?.textContent); }));
  schedule.querySelectorAll('.date-row button,.slot-grid button').forEach(button => button.addEventListener('click', () => { button.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('selected')); button.classList.add('selected'); }));
  schedule.querySelector('.fast-next').addEventListener('click', () => showFast(2));
  schedule.querySelector('form').addEventListener('submit', event => { event.preventDefault(); showFast(3); });
  schedule.querySelector('.fast-done').addEventListener('click', () => schedule.close());
  document.querySelector('.context-action')?.addEventListener('click', event => { event.preventDefault(); openSchedule(); });
  document.querySelector('.mobile-context-cta')?.addEventListener('click', () => openSchedule());
}

// Corporate: short lead capture, not checkout.
if (currentPage === 'corporate.html') {
  const form = document.querySelector('#proposal form, .enquiry-panel form');
  if (form) {
    const success = document.createElement('div'); success.className='proposal-success'; success.hidden=true;
    success.innerHTML='<span class="success-mark">✓</span><p class="eyebrow">Enquiry received</p><h3>Thanks—we’ll send a proposal within one working day.</h3><p>This is a demo confirmation. No information has been transmitted.</p>';
    form.after(success);
    form.addEventListener('submit', event => { event.preventDefault(); form.hidden=true; success.hidden=false; });
    const wa=document.createElement('a'); wa.className='button whatsapp-primary'; wa.target='_blank'; wa.rel='noopener'; wa.href='https://wa.me/919999999999?text=Hi%2C%20I%27d%20like%20to%20book%20a%20Team%20Reset%20for%20my%20team.'; wa.textContent='Chat on WhatsApp'; form.appendChild(wa);
  }
  document.querySelector('.context-action')?.addEventListener('click', event => { event.preventDefault(); document.querySelector('#proposal')?.scrollIntoView({behavior:'smooth'}); });
  document.querySelector('.mobile-context-cta')?.addEventListener('click', () => document.querySelector('#proposal')?.scrollIntoView({behavior:'smooth'}));
}

// Shop: the only cart and checkout flow.
if (currentPage === 'shop.html') {
  const cart=[];
  const cartDialog=createModal('cart-dialog',`<div class="cart-flow"><p class="eyebrow">Your bag</p><h2>Chosen with <em>intention.</em></h2><div class="cart-items"></div><div class="cart-total"><span>Total</span><b>₹0</b></div><button class="button cart-checkout" disabled>Continue to checkout</button><div class="checkout-step" hidden><h3>Delivery summary</h3><label>Name<input required></label><label>Phone<input required></label><label>City / PIN<input required></label><div class="review-card"><p><span>Payment</span><b>UPI / Card in live site</b></p><p><span>Today</span><b class="checkout-total">₹0</b></p></div><button class="button mock-order">Place mock order</button></div><div class="order-success" hidden><span class="success-mark">✓</span><p class="eyebrow">Mock order confirmed</p><h3>Order SY-1042</h3><p>No payment was taken and no order was transmitted.</p></div></div>`);
  const renderCart=()=>{const items=cartDialog.querySelector('.cart-items');items.innerHTML=cart.length?cart.map(i=>`<article><span>${i.name}</span><b>${i.price}</b></article>`).join(''):'<p>Your bag is waiting.</p>';const total=cart.reduce((s,i)=>s+i.value,0);cartDialog.querySelector('.cart-total b').textContent=flowMoney(total);cartDialog.querySelector('.checkout-total').textContent=flowMoney(total);cartDialog.querySelector('.cart-checkout').disabled=!cart.length;document.querySelectorAll('.icon-button span').forEach(s=>s.textContent=cart.length);};
  document.querySelectorAll('.product-grid .price-row button').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('.listing-card');const price=card.querySelector('.price-row b').textContent;cart.push({name:card.querySelector('h2').textContent,price,value:Number(price.replace(/\D/g,''))});renderCart();openFlow(cartDialog);}));
  cartDialog.querySelector('.cart-checkout').addEventListener('click',()=>cartDialog.querySelector('.checkout-step').hidden=false);
  cartDialog.querySelector('.mock-order').addEventListener('click',()=>{cartDialog.querySelector('.checkout-step').hidden=true;cartDialog.querySelector('.order-success').hidden=false;});
  document.querySelector('.context-action')?.addEventListener('click',()=>{renderCart();openFlow(cartDialog);});
  document.querySelector('.mobile-context-cta')?.addEventListener('click',()=>{renderCart();openFlow(cartDialog);});
}

// Retreat sticky CTA opens the first available reservation.
if (currentPage === 'retreats.html') {
  document.querySelector('.context-action')?.addEventListener('click', event => { event.preventDefault(); document.querySelector('.reserve-trigger')?.click(); });
  document.querySelector('.mobile-context-cta')?.addEventListener('click', () => document.querySelector('.reserve-trigger')?.click());
}
