const bowl = document.querySelector('#singing-bowl');
const soundReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let audioContext;

function playBowl() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 6.5);
  master.connect(audioContext.destination);

  [174, 348.6, 522.4, 697.2, 1045].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index < 2 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(index % 2 ? 2.5 : -1.5, now);
    gain.gain.value = 1 / (index + 1.4);
    oscillator.connect(gain).connect(master);
    oscillator.start(now + index * 0.008);
    oscillator.stop(now + 6.6);
  });

  if (!soundReduceMotion) {
    bowl.closest('.bowl-stage').classList.remove('is-ringing');
    void bowl.offsetWidth;
    bowl.closest('.bowl-stage').classList.add('is-ringing');
  }
}

bowl?.addEventListener('click', playBowl);

const prompt = document.querySelector('.breath-prompt');
if (prompt && !soundReduceMotion) {
  const phases = ['Inhale slowly', 'Hold softly', 'Exhale completely', 'Rest'];
  let phase = 0;
  setInterval(() => { phase = (phase + 1) % phases.length; prompt.textContent = phases[phase]; }, 4000);
}
