// All sound is synthesized with WebAudio — no audio files, no network.
// Effects: gunshot, siren blip, pickup chime, engine hum, crash thud, rain.
// Music: a procedural synthwave loop (minor-key bass + arpeggio + kick),
// scheduled a bar ahead so it never stutters. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuf = null;
  let muted = false;
  let musicOn = false;
  let nextBarTime = 0;
  let barIndex = 0;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      // A quiet two-oscillator engine hum that follows the car speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // A-minor synthwave: Am – F – C – G, one bar each, 100 BPM.
  const BASS = [55, 43.65, 65.41, 49];
  const CHORDS = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
    [196, 246.94, 293.66],
  ];
  const BAR = 2.4;

  function scheduleBar(when, index) {
    const root = BASS[index % 4];
    const chord = CHORDS[index % 4];
    for (let beat = 0; beat < 4; beat += 1) {
      const t = when + beat * (BAR / 4);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = root * (beat === 0 ? 1 : 2);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + BAR / 4 - 0.02);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(musicGain);
      osc.start(t);
      osc.stop(t + BAR / 4);
      // Kick on every beat.
      const kick = ctx.createOscillator();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(120, t);
      kick.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0.9, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      kick.connect(kg);
      kg.connect(musicGain);
      kick.start(t);
      kick.stop(t + 0.2);
      // Arpeggio sparkle, two notes per beat.
      for (let n = 0; n < 2; n += 1) {
        const nt = t + n * (BAR / 8);
        const note = chord[(beat * 2 + n) % 3] * 2;
        const a = ctx.createOscillator();
        a.type = 'square';
        a.frequency.value = note;
        const ag = ctx.createGain();
        ag.gain.setValueAtTime(0.0001, nt);
        ag.gain.linearRampToValueAtTime(0.12, nt + 0.01);
        ag.gain.exponentialRampToValueAtTime(0.001, nt + BAR / 8 - 0.02);
        a.connect(ag);
        ag.connect(musicGain);
        a.start(nt);
        a.stop(nt + BAR / 8);
      }
    }
  }

  return {
    resume,
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true;
      nextBarTime = ctx.currentTime + 0.1;
      barIndex = 0;
    },
    updateMusic() {
      if (!musicOn || !ctx) return;
      while (nextBarTime < ctx.currentTime + 0.6) {
        scheduleBar(nextBarTime, barIndex);
        barIndex += 1;
        nextBarTime += BAR;
      }
    },
    setEngine(speedRatio) {
      if (!ctx || !engineGain) return;
      engineGain.gain.value = 0.015 + speedRatio * 0.05;
      engineOsc.frequency.value = 55 + speedRatio * 90;
    },
    sfx(name) {
      if (!ensure()) return;
      if (name === 'shoot') {
        noise(0.12, 0.5, 2600);
        blip(180, 0.09, 'square', 0.25, 60);
      } else if (name === 'enemyShoot') {
        noise(0.1, 0.25, 1800);
      } else if (name === 'siren') {
        blip(720, 0.28, 'sine', 0.16, 1080);
      } else if (name === 'pickup') {
        blip(660, 0.12, 'sine', 0.3);
        setTimeout(() => blip(990, 0.18, 'sine', 0.3), 90);
      } else if (name === 'cash') {
        blip(880, 0.1, 'triangle', 0.3);
        setTimeout(() => blip(1174, 0.12, 'triangle', 0.3), 80);
        setTimeout(() => blip(1568, 0.2, 'triangle', 0.3), 160);
      } else if (name === 'crash') {
        noise(0.25, 0.5, 500);
      } else if (name === 'busted') {
        blip(440, 0.3, 'sawtooth', 0.25, 220);
        setTimeout(() => blip(330, 0.4, 'sawtooth', 0.25, 165), 250);
      } else if (name === 'steal') {
        blip(520, 0.1, 'square', 0.2, 780);
      }
    },
  };
}
