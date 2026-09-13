/**
 * SUMO IS A BOXER — Fight audio.
 *
 * ENGINE GAP — AUDIO SUBSYSTEM. My Game Engine 1.0 exposes no audio capability
 * at all: there is no audio module in the repository and nothing audio-shaped
 * on the public surface (ENGINE_GAPS.md — GAP-11). This is therefore
 * game-owned Web Audio, written as a small concrete sound bank for THIS game.
 * It deliberately does NOT invent a speculative universal engine audio
 * architecture; when the engine earns one, this file is what it replaces.
 *
 * Everything is synthesised. One shared noise buffer, one master chain, and
 * short-lived oscillator/buffer nodes per hit — the standard Web Audio
 * one-shot pattern, where a stopped node is released by the graph rather than
 * pooled by hand.
 */

const NOISE_SECONDS = 2;

/**
 * @returns {object} Audio handle.
 */
export function createFightAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let crowdGain = null;
  let crowdSource = null;
  let crowdFilter = null;
  let started = false;
  let muted = false;

  /**
   * Builds the graph on first user gesture, as autoplay policy requires.
   *
   * @returns {boolean} True once the context is running.
   */
  function ensure() {
    if (started) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const Ctor = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.62;
    master.connect(context.destination);

    const frames = Math.floor(context.sampleRate * NOISE_SECONDS);
    noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let value = 0;
    for (let i = 0; i < frames; i += 1) {
      // Slightly brown noise: less fizzy than white, better for cloth and crowd.
      value = (value + (Math.random() * 2 - 1) * 0.35) * 0.96;
      data[i] = Math.max(-1, Math.min(1, value * 2.2));
    }

    started = true;
    return true;
  }

  /**
   * @param {object} options
   * @returns {AudioBufferSourceNode|null}
   */
  function noise({ duration = 0.2, gain = 0.3, type = 'bandpass', frequency = 900, q = 1.2, sweepTo = null, delay = 0 }) {
    if (!ensure()) return null;
    const now = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.value = q;
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), now + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + duration * 0.14);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
    return source;
  }

  /**
   * @param {object} options
   */
  function tone({ frequency = 200, duration = 0.2, gain = 0.2, type = 'sine', sweepTo = null, delay = 0 }) {
    if (!ensure()) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (sweepTo !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), now + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.02, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  return {
    /** True once the graph exists. */
    get ready() {
      return started;
    },

    /** Must be called from a user gesture. */
    unlock() {
      if (!ensure()) return false;
      if (!crowdSource) startCrowd();
      return true;
    },

    /**
     * @param {boolean} value
     */
    setMuted(value) {
      muted = Boolean(value);
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.62, context.currentTime, 0.05);
    },

    /** @returns {boolean} */
    get muted() {
      return muted;
    },

    /**
     * @param {boolean} heavy
     */
    whoosh(heavy = false) {
      noise({
        duration: heavy ? 0.3 : 0.17,
        gain: heavy ? 0.2 : 0.12,
        frequency: heavy ? 1500 : 2400,
        sweepTo: heavy ? 220 : 460,
        q: 0.85
      });
    },

    /** A glove caught on a forearm: dull, short, no crack. */
    block() {
      noise({ duration: 0.12, gain: 0.26, type: 'lowpass', frequency: 700, q: 0.7 });
      tone({ frequency: 128, duration: 0.1, gain: 0.16, type: 'triangle', sweepTo: 74 });
    },

    /**
     * @param {boolean} heavy
     */
    impact(heavy = false) {
      noise({
        duration: heavy ? 0.24 : 0.14,
        gain: heavy ? 0.42 : 0.28,
        type: 'lowpass',
        frequency: heavy ? 1200 : 1700,
        sweepTo: heavy ? 180 : 300,
        q: 0.9
      });
      tone({ frequency: heavy ? 92 : 140, duration: heavy ? 0.26 : 0.14, gain: heavy ? 0.34 : 0.2, type: 'sine', sweepTo: heavy ? 44 : 70 });
      if (heavy) tone({ frequency: 58, duration: 0.34, gain: 0.22, type: 'sine', sweepTo: 32, delay: 0.01 });
      if (crowdGain && context) {
        // The room reacts.
        const now = context.currentTime;
        crowdGain.gain.cancelScheduledValues(now);
        crowdGain.gain.setTargetAtTime(heavy ? 0.24 : 0.15, now, 0.06);
        crowdGain.gain.setTargetAtTime(0.075, now + (heavy ? 0.7 : 0.35), 0.5);
      }
    },

    /** The hollow snap of a guard collapsing. */
    guardBreak() {
      tone({ frequency: 340, duration: 0.3, gain: 0.3, type: 'square', sweepTo: 92 });
      noise({ duration: 0.34, gain: 0.3, type: 'bandpass', frequency: 2100, sweepTo: 380, q: 1.6 });
      tone({ frequency: 70, duration: 0.4, gain: 0.26, type: 'sine', sweepTo: 38, delay: 0.02 });
    },

    /**
     * @param {boolean} heavy
     */
    grunt(heavy = false) {
      const base = heavy ? 132 : 176;
      tone({ frequency: base, duration: heavy ? 0.3 : 0.18, gain: 0.13, type: 'sawtooth', sweepTo: base * 0.6 });
      noise({ duration: heavy ? 0.26 : 0.16, gain: 0.08, type: 'bandpass', frequency: 620, q: 2.4 });
    },

    /**
     * The round bell.
     *
     * @param {number} [times=1]
     */
    bell(times = 1) {
      for (let i = 0; i < times; i += 1) {
        const delay = i * 0.42;
        tone({ frequency: 860, duration: 1.3, gain: 0.26, type: 'sine', delay });
        tone({ frequency: 1290, duration: 1.0, gain: 0.14, type: 'sine', delay });
        tone({ frequency: 2320, duration: 0.65, gain: 0.07, type: 'sine', delay });
      }
    },

    /** A short crowd surge, for knockdowns and the finish. */
    crowdSurge(strength = 1) {
      if (!crowdGain || !context) return;
      const now = context.currentTime;
      crowdGain.gain.cancelScheduledValues(now);
      crowdGain.gain.setTargetAtTime(0.1 + 0.26 * strength, now, 0.1);
      crowdGain.gain.setTargetAtTime(0.075, now + 1.4 * strength, 0.8);
    },

    /** Releases the audio graph. */
    dispose() {
      if (!started) return;
      try {
        crowdSource?.stop();
        crowdSource?.disconnect();
        crowdFilter?.disconnect();
        crowdGain?.disconnect();
        master?.disconnect();
        context?.close();
      } catch {
        // A context already closed by the browser is not an error worth raising.
      }
      crowdSource = null;
      crowdGain = null;
      crowdFilter = null;
      master = null;
      context = null;
      started = false;
    }
  };

  /**
   * The room tone: a filtered noise bed with a slow swell, always running.
   */
  function startCrowd() {
    if (!ensure() || crowdSource) return;
    crowdSource = context.createBufferSource();
    crowdSource.buffer = noiseBuffer;
    crowdSource.loop = true;
    crowdFilter = context.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.value = 420;
    crowdFilter.Q.value = 0.55;
    crowdGain = context.createGain();
    crowdGain.gain.value = 0.075;

    // A slow amplitude drift so the room never sits perfectly still.
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.022;
    lfo.connect(lfoGain).connect(crowdGain.gain);
    lfo.start();

    crowdSource.connect(crowdFilter).connect(crowdGain).connect(master);
    crowdSource.start();
  }
}
