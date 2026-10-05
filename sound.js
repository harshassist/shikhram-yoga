const bowl = document.querySelector('#singing-bowl');
const soundReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let audioContext;
let currentRootFreq = 432;
let droneOscs = null;
let droneGain = null;
let isDronePlaying = false;

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playBowl() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 7.2);
  master.connect(ctx.destination);

  const base = currentRootFreq;
  const harmonics = [base * 0.5, base, base * 1.5, base * 2, base * 3];

  harmonics.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = index < 2 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(index % 2 ? 3.5 : -2.5, now);
    gain.gain.value = 1 / (index + 1.4);
    oscillator.connect(gain).connect(master);
    oscillator.start(now + index * 0.008);
    oscillator.stop(now + 7.3);
  });

  if (!soundReduceMotion && bowl) {
    const stage = bowl.closest('.bowl-stage');
    if (stage) {
      stage.classList.remove('is-ringing');
      void bowl.offsetWidth;
      stage.classList.add('is-ringing');
    }
  }
}

bowl?.addEventListener('click', playBowl);

// Frequency selector buttons
document.querySelectorAll('.freq-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRootFreq = Number(btn.dataset.freq) || 432;
    playBowl();
    if (isDronePlaying) {
      restartDrone();
    }
  });
});

// Ambient continuous drone player
function startDrone() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0.0001, now);
  droneGain.gain.linearRampToValueAtTime(0.09, now + 2.5); // Soft, peaceful ambient volume
  droneGain.connect(ctx.destination);

  const base = currentRootFreq * 0.5; // Deep sub octave
  const freqs = [base, base * 1.5, base * 2];
  droneOscs = [];

  freqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.detune.setValueAtTime(idx === 0 ? -2 : idx === 1 ? 2.5 : -1, now);

    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.1, now); // Gentle breathing wave
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.03, now);
    lfo.connect(lfoGain.gain);

    osc.connect(droneGain);
    osc.start(now);
    droneOscs.push(osc);
  });

  isDronePlaying = true;
}

function stopDrone() {
  if (!isDronePlaying || !droneGain) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  droneGain.gain.linearRampToValueAtTime(0.0001, now + 1.5);
  setTimeout(() => {
    if (droneOscs) {
      droneOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch (_) {} });
      droneOscs = null;
    }
    isDronePlaying = false;
  }, 1600);
}

function restartDrone() {
  stopDrone();
  setTimeout(startDrone, 800);
}

const droneBtn = document.querySelector('#ambient-drone-btn');
if (droneBtn) {
  droneBtn.addEventListener('click', () => {
    if (isDronePlaying) {
      stopDrone();
      droneBtn.classList.remove('active');
      const text = droneBtn.querySelector('.drone-state');
      if (text) text.textContent = 'Off';
    } else {
      startDrone();
      droneBtn.classList.add('active');
      const text = droneBtn.querySelector('.drone-state');
      if (text) text.textContent = 'Playing';
    }
  });
}

const prompt = document.querySelector('.breath-prompt');
if (prompt && !soundReduceMotion) {
  const phases = ['Inhale slowly', 'Hold softly', 'Exhale completely', 'Rest'];
  let phase = 0;
  setInterval(() => { phase = (phase + 1) % phases.length; prompt.textContent = phases[phase]; }, 4000);
}

