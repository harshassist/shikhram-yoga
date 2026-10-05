/**
 * Shikhram Yoga — Sanctuary Features
 * Interactive Breathwork Pacer, Practice Quiz, Booking Lookup, Calendar Sync, and Retreat Timeline
 */

(() => {
  // Common Web Audio Context for mindful chimes
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSoftChime(freq = 432, duration = 1.8) {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (_) {}
  }

  /* --------------------------------------------------------------------------
     1. Interactive Breathwork Pacer
     -------------------------------------------------------------------------- */
  const pacerContainer = document.querySelector('#breath-pacer');
  if (pacerContainer) {
    if (!pacerContainer.hasAttribute('role')) {
      pacerContainer.setAttribute('role', 'region');
    }
    if (!pacerContainer.hasAttribute('aria-label')) {
      pacerContainer.setAttribute('aria-label', 'Interactive Pranayama Breathwork Practice');
    }

    let liveAnnouncer = pacerContainer.querySelector('#pacer-announcer');
    if (!liveAnnouncer) {
      liveAnnouncer = document.createElement('div');
      liveAnnouncer.id = 'pacer-announcer';
      liveAnnouncer.className = 'sr-only';
      liveAnnouncer.setAttribute('aria-live', 'polite');
      liveAnnouncer.setAttribute('aria-atomic', 'true');
      pacerContainer.appendChild(liveAnnouncer);
    }

    const orb = pacerContainer.querySelector('.pacer-orb');
    const phaseText = pacerContainer.querySelector('.pacer-phase-text');
    const timerText = pacerContainer.querySelector('.pacer-timer-text');
    const toggleBtn = pacerContainer.querySelector('.pacer-toggle-btn');
    const cycleText = pacerContainer.querySelector('.pacer-cycle-count');
    const modeBtns = pacerContainer.querySelectorAll('.pacer-mode-btn');

    const patterns = {
      box: {
        name: 'Sama Vritti',
        phases: [
          { name: 'Inhale', duration: 4, scale: 1.15, freq: 432 },
          { name: 'Hold', duration: 4, scale: 1.15, freq: 528 },
          { name: 'Exhale', duration: 4, scale: 0.65, freq: 396 },
          { name: 'Stillness', duration: 4, scale: 0.65, freq: 348 }
        ]
      },
      calm: {
        name: '4-7-8 Pranayama',
        phases: [
          { name: 'Inhale', duration: 4, scale: 1.15, freq: 432 },
          { name: 'Hold Gently', duration: 7, scale: 1.15, freq: 528 },
          { name: 'Exhale Slowly', duration: 8, scale: 0.65, freq: 396 }
        ]
      },
      energy: {
        name: 'Awakening',
        phases: [
          { name: 'Inhale', duration: 3, scale: 1.15, freq: 528 },
          { name: 'Hold', duration: 3, scale: 1.15, freq: 639 },
          { name: 'Exhale', duration: 3, scale: 0.65, freq: 432 }
        ]
      }
    };

    let activePatternKey = 'box';
    let isRunning = false;
    let currentPhaseIdx = 0;
    let secondsLeft = 4;
    let completedCycles = 0;
    let timerInterval = null;

    function setPhase(idx) {
      currentPhaseIdx = idx;
      const cur = patterns[activePatternKey].phases[currentPhaseIdx];
      secondsLeft = cur.duration;
      phaseText.textContent = cur.name;
      timerText.textContent = `${secondsLeft}s`;
      orb.style.transition = `transform ${cur.duration}s cubic-bezier(0.4, 0, 0.2, 1)`;
      orb.style.transform = `scale(${cur.scale})`;
      if (isRunning) {
        playSoftChime(cur.freq, 1.2);
        if (liveAnnouncer) {
          liveAnnouncer.textContent = `${cur.name} phase, ${cur.duration} seconds`;
        }
      }
    }

    function tick() {
      secondsLeft--;
      if (secondsLeft > 0) {
        timerText.textContent = `${secondsLeft}s`;
      } else {
        const curPhases = patterns[activePatternKey].phases;
        let nextIdx = currentPhaseIdx + 1;
        if (nextIdx >= curPhases.length) {
          nextIdx = 0;
          completedCycles++;
          cycleText.textContent = `${completedCycles} ${completedCycles === 1 ? 'round' : 'rounds'} completed`;
        }
        setPhase(nextIdx);
      }
    }

    function startPacer() {
      isRunning = true;
      toggleBtn.textContent = 'Pause practice';
      pacerContainer.querySelector('.pacer-stage').classList.add('pacer-active');
      setPhase(currentPhaseIdx);
      timerInterval = setInterval(tick, 1000);
    }

    function stopPacer() {
      isRunning = false;
      toggleBtn.textContent = 'Resume practice';
      pacerContainer.querySelector('.pacer-stage').classList.remove('pacer-active');
      if (timerInterval) clearInterval(timerInterval);
    }

    toggleBtn.addEventListener('click', () => {
      if (isRunning) stopPacer();
      else startPacer();
    });

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePatternKey = btn.dataset.pattern || 'box';
        currentPhaseIdx = 0;
        completedCycles = 0;
        cycleText.textContent = 'Begin when ready';
        if (isRunning) {
          stopPacer();
          setPhase(0);
          startPacer();
        } else {
          setPhase(0);
          toggleBtn.textContent = 'Begin practice';
        }
      });
    });

    setPhase(0);
  }

  /* --------------------------------------------------------------------------
     2. "Find Your Practice" Guided Recommendation Quiz
     -------------------------------------------------------------------------- */
  const quizDialog = document.createElement('dialog');
  quizDialog.className = 'quiz-dialog';
  quizDialog.id = 'practice-quiz-dialog';
  quizDialog.innerHTML = `
    <div class="quiz-shell">
      <button class="quiz-close" aria-label="Close match quiz">×</button>
      <div class="quiz-step-indicator">
        <span class="step-num active" data-step="1">1</span>
        <i></i>
        <span class="step-num" data-step="2">2</span>
        <i></i>
        <span class="step-num" data-step="3">3</span>
      </div>
      <div class="quiz-content"></div>
    </div>
  `;
  document.body.appendChild(quizDialog);

  quizDialog.querySelector('.quiz-close').onclick = () => quizDialog.close();
  quizDialog.onclick = e => { if (e.target === quizDialog) quizDialog.close(); };

  const quizState = { step: 1, answers: {} };

  const quizQuestions = [
    {
      title: 'What brings you to the mat today?',
      eyebrow: 'Step 1 · Intention',
      options: [
        { key: 'strength', text: 'Traditional discipline & physical strength', sub: 'Classical Hatha & Ashtanga foundations' },
        { key: 'calm', text: 'Mental space, stress relief & conscious breath', sub: 'Mindful Vinyasa, Pranayama & Meditation' },
        { key: 'sound', text: 'Deep acoustic rest & nervous system release', sub: 'Himalayan singing bowls & gong sanctuary' },
        { key: 'retreat', text: 'A multi-day immersion away from routine', sub: 'Transformative journeys in Rishikesh & Sahyadri' }
      ]
    },
    {
      title: 'Where do you prefer to practice?',
      eyebrow: 'Step 2 · Setting',
      options: [
        { key: 'studio', text: 'In-person at our quiet Pune studio', sub: 'Hands-on adjustments & shared silence' },
        { key: 'online', text: 'Live virtual via Zoom from home', sub: 'High-presence guidance wherever you are' },
        { key: 'nature', text: 'Immersed in nature or mountains', sub: 'Clear rivers, forest hills & open sky' }
      ]
    },
    {
      title: 'What is your experience level?',
      eyebrow: 'Step 3 · Foundation',
      options: [
        { key: 'beginner', text: 'New or gently returning', sub: 'Kind pacing with full posture breakdown' },
        { key: 'seasoned', text: 'Regular practitioner or sadhaka', sub: 'Subtle alignment, deeper breath & stillness' }
      ]
    }
  ];

  function getRecommendation(answers) {
    if (answers[1] === 'retreat' || answers[2] === 'nature') {
      return {
        title: 'Return to the Source · Rishikesh',
        eyebrow: 'Recommended Retreat Journey',
        desc: 'A 5-night immersion by the Ganga in Rishikesh. Classical morning Hatha, pranayama, sattvic organic dining, and sound meditation under starlight.',
        format: 'Himalayan Mountain Sanctuary · Intimate Group',
        cta: 'Enquire about retreat',
        action: () => { quizDialog.close(); location.href = 'retreats.html#retreat-enquiry'; }
      };
    }
    if (answers[1] === 'sound') {
      return {
        title: 'Resonance Journey · Sound Meditation',
        eyebrow: 'Recommended Sound Sanctuary',
        desc: '60 minutes of acoustic immersion with hand-beaten Himalayan bronze bowls and Koshi chimes. Calms sensory overload and resets sleep patterns.',
        format: 'Acoustic Sound Bath · Private or Studio',
        cta: 'Explore sound session',
        action: () => { quizDialog.close(); location.href = 'sound-healing.html#sessions'; }
      };
    }
    if (answers[1] === 'calm') {
      return {
        title: 'Deepak · Meditation & Breathwork',
        eyebrow: 'Recommended Guide',
        desc: 'Personalized Hatha, Ashtanga, breathwork, and mindfulness sessions crafted to cultivate inner balance, release stress, and restore mental well-being.',
        format: 'Online & Private Guidance',
        cta: 'Book with Deepak',
        action: () => { quizDialog.close(); location.href = 'teachers.html#deepak'; }
      };
    }
    return {
      title: 'Aniket · Classical Hatha & Breathwork',
      eyebrow: 'Recommended Guide & Founder',
      desc: 'Grounding traditional practice taught with warmth and precision. Steady asana holds, authentic pranayama and stillness.',
      format: 'Pune Studio & Online',
      cta: 'Book with Aniket',
      action: () => { quizDialog.close(); location.href = 'teachers.html#shikhram'; }
    };
  }

  function renderQuizStep() {
    const content = quizDialog.querySelector('.quiz-content');
    quizDialog.querySelectorAll('.step-num').forEach(el => {
      const num = Number(el.dataset.step);
      el.classList.toggle('active', num === quizState.step);
    });

    if (quizState.step <= 3) {
      const q = quizQuestions[quizState.step - 1];
      content.innerHTML = `
        <p class="eyebrow">${q.eyebrow}</p>
        <h2 style="font: 400 2.2rem var(--serif, 'Italiana', serif); margin: 0.4rem 0 1.5rem;">${q.title}</h2>
        <div class="quiz-option-grid">
          ${q.options.map(opt => `
            <button class="quiz-option" data-key="${opt.key}">
              <div>
                <b>${opt.text}</b>
                <small>${opt.sub}</small>
              </div>
              <span class="quiz-arrow">→</span>
            </button>
          `).join('')}
        </div>
      `;
      content.querySelectorAll('.quiz-option').forEach(btn => {
        btn.onclick = () => {
          quizState.answers[quizState.step] = btn.dataset.key;
          quizState.step++;
          renderQuizStep();
        };
      });
    } else {
      const rec = getRecommendation(quizState.answers);
      content.innerHTML = `
        <p class="eyebrow">Your Mindful Match</p>
        <h2 style="font: 400 2.2rem var(--serif, 'Italiana', serif); margin: 0.4rem 0 1rem;">Chosen with <em>intention.</em></h2>
        <div class="quiz-result-card">
          <span style="color: var(--sanctuary-gold-light); text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.1em;">${rec.eyebrow}</span>
          <h3>${rec.title}</h3>
          <p>${rec.desc}</p>
          <div class="price-row">
            <span style="color: #eed6aa; font-size: 0.8rem;">${rec.format}</span>
            <button class="button" id="quiz-rec-cta" style="background: var(--sanctuary-gold); border: 0; color: #fff; padding: 0.6rem 1.4rem; border-radius: 99px; cursor: pointer;">${rec.cta} →</button>
          </div>
        </div>
        <div style="margin-top: 1.5rem; text-align: center;">
          <button type="button" class="text-link" id="quiz-restart" style="background:none;border:0;color:var(--sanctuary-muted);cursor:pointer;font-size:0.75rem;">← Start over</button>
        </div>
      `;
      content.querySelector('#quiz-rec-cta').onclick = rec.action;
      content.querySelector('#quiz-restart').onclick = () => {
        quizState.step = 1;
        quizState.answers = {};
        renderQuizStep();
      };
    }
  }

  function openQuiz() {
    quizState.step = 1;
    quizState.answers = {};
    renderQuizStep();
    quizDialog.showModal();
  }

  document.querySelectorAll('.quiz-trigger').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openQuiz();
    });
  });

  /* --------------------------------------------------------------------------
     3. Client Booking Lookup & 1-Click Calendar Sync
     -------------------------------------------------------------------------- */
  const lookupDialog = document.createElement('dialog');
  lookupDialog.className = 'lookup-dialog';
  lookupDialog.id = 'booking-lookup-dialog';
  lookupDialog.innerHTML = `
    <div class="lookup-shell">
      <button class="quiz-close" aria-label="Close lookup">×</button>
      <p class="eyebrow">Client Portal</p>
      <h2 style="font: 400 2.2rem var(--serif, 'Italiana', serif); margin: 0.4rem 0 1rem;">Find your <em>booking.</em></h2>
      <p style="color: var(--sanctuary-muted); font-size: 0.85rem;">Enter your reference code (e.g. SY-XXXX) or the email/phone used during booking.</p>
      <form class="lookup-form">
        <label style="display:grid;gap:0.4rem;font-size:0.8rem;color:var(--sanctuary-ink);">
          Booking reference or contact
          <input name="query" required placeholder="SY-XXXX or email@domain.com" style="border: 1px solid var(--sanctuary-line); padding: 0.75rem; border-radius: 4px; font: inherit; background: #fff;">
        </label>
        <button class="button" type="submit" style="background: #302a22; color: #fff; border: 0; padding: 0.8rem; border-radius: 99px; cursor: pointer; font: 500 0.8rem var(--sans, 'DM Sans'); text-transform: uppercase; letter-spacing: 0.08em;">Find details →</button>
      </form>
      <div class="lookup-results" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(lookupDialog);

  lookupDialog.querySelector('.quiz-close').onclick = () => lookupDialog.close();
  lookupDialog.onclick = e => { if (e.target === lookupDialog) lookupDialog.close(); };

  function generateGoogleCalendarUrl(event) {
    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const startIso = event.start ? new Date(event.start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
    const endIso = event.start ? new Date(new Date(event.start).getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
    const details = encodeURIComponent(`${event.title}\nBooking Ref: ${event.id}\nLead Teacher: Shikhram Yoga\nLocation: Shikhram Sanctuary, Pune / Live Online`);
    const location = encodeURIComponent('Shikhram Yoga Sanctuary, Koregaon Park, Pune');
    return `${baseUrl}&text=${encodeURIComponent(event.title)}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
  }

  function downloadIcsFile(event) {
    const startIso = event.start ? new Date(event.start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '20261018T040000Z';
    const endIso = event.start ? new Date(new Date(event.start).getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '20261023T120000Z';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Shikhram Yoga//Booking Portal//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id || 'SY-' + Date.now()}@shikhramyoga.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      `DTSTART:${startIso}`,
      `DTEND:${endIso}`,
      `SUMMARY:${event.title || 'Shikhram Yoga Practice'}`,
      `DESCRIPTION:Booking Reference: ${event.id || ''}. Arrive 10 minutes early. Wear comfortable cotton clothing and avoid heavy meals 2 hours prior.`,
      'LOCATION:Shikhram Yoga Sanctuary, Pune',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${event.id || 'shikhram-booking'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Expose calendar helper for booking confirmation dialogs
  window.shikhramCalendar = {
    googleUrl: generateGoogleCalendarUrl,
    downloadIcs: downloadIcsFile
  };

  const lookupForm = lookupDialog.querySelector('.lookup-form');
  lookupForm.onsubmit = async e => {
    e.preventDefault();
    const q = lookupForm.elements.query.value.trim();
    const resultBox = lookupDialog.querySelector('.lookup-results');
    resultBox.innerHTML = '<p style="color: var(--sanctuary-muted); margin-top: 1rem;">Locating booking record…</p>';

    try {
      if (!window.firebase || !window.firebase.firestore) {
        throw new Error('Database service is initializing. Please retry in a moment.');
      }
      const db = firebase.firestore();
      let record = null;

      // 1. Direct ID lookup
      if (q.toUpperCase().startsWith('SY-')) {
        const doc = await db.collection('requests').doc(q.toUpperCase()).get();
        if (doc.exists) record = doc.data();
      }

      // 2. Query by customer contact or reference match
      if (!record) {
        const snap = await db.collection('requests')
          .where('customer.contact', '==', q)
          .limit(1)
          .get();
        if (!snap.empty) {
          record = snap.docs[0].data();
        }
      }

      if (!record) {
        resultBox.innerHTML = `
          <div style="margin-top: 1.5rem; padding: 1rem; background: #fff; border: 1px solid var(--sanctuary-line); border-radius: 4px;">
            <p style="margin: 0; color: #8a2d1d;">No record found for "${escapeHtml(q)}".</p>
            <p style="margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--sanctuary-muted);">Double-check your reference code from your confirmation screen, or message us on WhatsApp for live assistance.</p>
          </div>
        `;
        return;
      }

      const item = (record.items && record.items[0]) || { title: 'Yoga Practice' };
      const eventObj = {
        id: record.id,
        title: item.title,
        start: item.start
      };

      resultBox.innerHTML = `
        <div class="lookup-record">
          <span class="status-badge ${record.status || 'requested'}">${(record.status || 'requested').replace('_', ' ')}</span>
          <h3 style="font: 400 1.6rem var(--serif, 'Italiana', serif); margin: 0.2rem 0;">${escapeHtml(item.title)}</h3>
          <p style="font-size: 0.85rem; color: var(--sanctuary-muted); margin: 0.3rem 0;">
            Reference: <b>${escapeHtml(record.id)}</b> · ${escapeHtml(record.customer?.name || 'Guest')}
          </p>
          ${item.start ? `<p style="font-size: 0.85rem; color: var(--sanctuary-ink); margin: 0.5rem 0;"><b>Scheduled for:</b> ${new Date(item.start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })} IST</p>` : ''}
          <div style="background: #fff; border: 1px solid var(--sanctuary-line); padding: 1rem; border-radius: 4px; margin-top: 1rem; font-size: 0.8rem; color: var(--sanctuary-muted);">
            <b>Practice Preparation:</b>
            <ul style="padding-left: 1.2rem; margin: 0.4rem 0 0;">
              <li>Arrive 10 minutes prior to settle your breath.</li>
              <li>Light, comfortable cotton clothing recommended.</li>
              <li>Avoid heavy meals within 2 hours of practice.</li>
            </ul>
          </div>
          <div class="calendar-sync-row">
            <a class="cal-btn" href="${generateGoogleCalendarUrl(eventObj)}" target="_blank" rel="noopener">📅 Add to Google Calendar</a>
            <button class="cal-btn" type="button" id="btn-dl-ics">🍏 Apple / Outlook (.ics)</button>
          </div>
        </div>
      `;

      resultBox.querySelector('#btn-dl-ics')?.addEventListener('click', () => downloadIcsFile(eventObj));
    } catch (err) {
      resultBox.innerHTML = `<p style="color: #8a2d1d; margin-top: 1rem;">Lookup error: ${escapeHtml(err.message)}</p>`;
    }
  };

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Hook all lookup triggers across footer or nav
  document.querySelectorAll('.lookup-trigger, a[href="#lookup"]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      lookupDialog.showModal();
    });
  });


})();
