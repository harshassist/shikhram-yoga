const bookingDialog = document.querySelector('#booking-dialog');
const bookingForm = document.querySelector('#booking-form');
const retreatData = {
  rishikesh: { title:'Return to the Source', dates:'18–23 Oct 2026 · Rishikesh', deposit:8000, balanceDate:'18 Sep 2026', places:'6 places left', image:'retreat-rishikesh' },
  sahyadri: { title:'Stillness in the Hills', dates:'12–14 Dec 2026 · Sahyadri', deposit:5000, balanceDate:'12 Nov 2026', places:'New retreat', image:'retreat-sahyadri' },
  goa: { title:'Breath by the Sea', dates:'06–09 Feb 2027 · South Goa', deposit:7000, balanceDate:'06 Jan 2027', places:'Waitlist', image:'retreat-goa' }
};
let activeRetreat = retreatData.rishikesh;
let activeStep = 1;

function money(value) { return new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(value); }
function selectedRoom() { return bookingForm.querySelector('input[name="room"]:checked'); }
function amountDue() { const price = Number(selectedRoom().dataset.price); return bookingForm.elements.payment.value === 'full' ? price : activeRetreat.deposit; }
function updatePrice() {
  const price = Number(selectedRoom().dataset.price); const due = amountDue();
  document.querySelector('.due-today').textContent = money(due);
  document.querySelector('.balance-note').textContent = due === price ? 'Nothing more to pay' : `Remaining ${money(price-due)} due by ${activeRetreat.balanceDate}`;
}
function showStep(step) {
  activeStep = step;
  document.querySelectorAll('.booking-step').forEach(item => item.classList.toggle('active', Number(item.dataset.step) === step));
  document.querySelectorAll('.booking-progress span').forEach((item,index) => item.classList.toggle('active', index < step));
  if (step === 3) {
    document.querySelector('.review-retreat').textContent = activeRetreat.title;
    document.querySelector('.review-room').textContent = selectedRoom().value;
    document.querySelector('.review-due').textContent = money(amountDue());
  }
}
function openBooking(key) {
  activeRetreat = retreatData[key]; activeStep = 1; bookingForm.reset();
  bookingDialog.querySelector('#booking-title').textContent = activeRetreat.title;
  bookingDialog.querySelector('.booking-dates').textContent = activeRetreat.dates;
  bookingDialog.querySelector('.booking-trust span').textContent = activeRetreat.places;
  bookingDialog.querySelector('.booking-thumb').className = `booking-thumb ${activeRetreat.image}`;
  bookingForm.hidden = false; bookingDialog.querySelector('.booking-success').hidden = true;
  showStep(1); updatePrice(); bookingDialog.showModal(); document.body.classList.add('modal-open');
}

document.querySelectorAll('.reserve-trigger').forEach(button => button.addEventListener('click', () => openBooking(button.dataset.retreat)));
document.querySelector('.waitlist-trigger')?.addEventListener('click', () => openBooking('goa'));
bookingDialog?.querySelector('.booking-close').addEventListener('click', () => bookingDialog.close());
bookingDialog?.addEventListener('close', () => document.body.classList.remove('modal-open'));
bookingDialog?.addEventListener('click', event => { if (event.target === bookingDialog) bookingDialog.close(); });
bookingForm?.addEventListener('change', event => { if (event.target.matches('[name="room"], [name="payment"]')) updatePrice(); });
bookingForm?.querySelectorAll('.booking-next').forEach(button => button.addEventListener('click', () => {
  if (activeStep === 2) { const step = bookingForm.querySelector('[data-step="2"]'); if (![...step.querySelectorAll('[required]')].every(field => field.reportValidity())) return; }
  showStep(Math.min(3, activeStep + 1));
}));
bookingForm?.querySelectorAll('.booking-back').forEach(button => button.addEventListener('click', () => showStep(Math.max(1, activeStep - 1))));
bookingForm?.addEventListener('submit', event => { event.preventDefault(); bookingForm.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active')); bookingDialog.querySelector('.booking-success').hidden = false; });
bookingDialog?.querySelector('.booking-done').addEventListener('click', () => bookingDialog.close());
