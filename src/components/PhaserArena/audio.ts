const MUSIC_LEVEL1 = "/assets/music/let-the-games-begin-21858.mp3";
const MUSIC_LEVEL2 = "/assets/music/space-438391.mp3";
const LOW_HEALTH_TRACK_OGG = "/assets/music/tension_low_health.ogg";
const LOW_HEALTH_TRACK_MP3 = "/assets/music/tension_low_health.mp3";
const LOW_HEALTH_FALLBACK = "/assets/music/SpacyLoop.ogg";

export type AudioManagerState = {
  musicVolume?: number;
  sfxVolume?: number;
  lowHealthActive?: boolean;
};

export type AudioManagerOptions = {
  getState: () => AudioManagerState;
  getCurrentSectorLevel: () => number;
  setCurrentSectorLevel: (level: number) => void;
};

function getMainMusicUrlForLevel(level: number): string {
  return level >= 2 ? MUSIC_LEVEL2 : MUSIC_LEVEL1;
}

export type AudioManager = {
  ensureAudioContext(): AudioContext;
  unlockAudio(): void;
  getAudioUnlocked(): boolean;
  startMusic(): void;
  switchMainMusicToSectorLevel(level: number): void;
  stopMusic(): void;
  startLowHealthMusic(): void;
  stopLowHealthMusic(): void;
  updateVolumes(state: AudioManagerState): void;
  playLaserSound(): void;
  startContinuousLaserSound(sfxVol: number): void;
  stopContinuousLaserSound(): void;
  playPickupSound(): void;
  playExplosionSound(): void;
  playEnemyHitSound(): void;
  playEnemyAttackSound(): void;
  playLevelUpFanfare(): void;
  playHeartbeatSound(): void;
  playShipHitSound(): void;
};

export function createAudioManager(
  options: AudioManagerOptions
): AudioManager {
  const { getState, getCurrentSectorLevel, setCurrentSectorLevel } = options;
  let audioContext: AudioContext | undefined;
  let audioUnlocked = false;
  let musicTrack: HTMLAudioElement | undefined;
  let lowHealthMusicTrack: HTMLAudioElement | undefined;
  let continuousLaserSound: HTMLAudioElement | undefined;
  let continuousLaserSynthetic: { oscillator: OscillatorNode; gain: GainNode } | undefined;

  function ensureAudioContext(): AudioContext {
    if (audioContext?.state === "closed") {
      audioContext = undefined;
    }
    if (!audioContext) {
      const AudioCtx =
        typeof window !== "undefined"
          ? (window.AudioContext ||
              (window as Window & { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext)
          : null;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (!audioContext) throw new Error("AudioContext not available");
    return audioContext;
  }

  function unlockAudio(): void {
    try {
      const context = ensureAudioContext();
      if (context.state === "suspended") {
        void context.resume().then(() => {
          audioUnlocked = context.state === "running";
          startMusic();
        }).catch(() => {
          audioUnlocked = false;
        });
        return;
      }
      audioUnlocked = context.state === "running";
      startMusic();
    } catch {
      audioUnlocked = false;
    }
  }

  function startMusic(): void {
    if (musicTrack || !audioUnlocked) return;
    try {
      const context = ensureAudioContext();
      if (context.state !== "running") return;
      const url = getMainMusicUrlForLevel(getCurrentSectorLevel());
      const track = new Audio(url);
      track.loop = true;
      const musicVol = getState().musicVolume ?? 0.45;
      track.volume = Math.max(0, Math.min(1, musicVol));
      void track.play().catch(() => {});
      musicTrack = track;
    } catch {
      // ignore
    }
  }

  function switchMainMusicToSectorLevel(level: number): void {
    if (getCurrentSectorLevel() === level) return;
    setCurrentSectorLevel(level);
    if (!musicTrack || !audioUnlocked) return;
    const url = getMainMusicUrlForLevel(level);
    const musicVol = getState().musicVolume ?? 0.45;
    const baseVol = Math.max(0, Math.min(1, musicVol));
    const lowHealth = getState().lowHealthActive;
    const vol = lowHealth ? baseVol * 0.25 : baseVol;
    try {
      musicTrack.pause();
      musicTrack.currentTime = 0;
    } catch {
      // ignore
    }
    musicTrack = undefined;
    const next = new Audio(url);
    next.loop = true;
    next.volume = vol;
    musicTrack = next;
    void next.play().catch(() => {});
  }

  function stopMusic(): void {
    if (musicTrack) {
      try {
        musicTrack.pause();
        musicTrack.currentTime = 0;
      } catch {
        // ignore
      }
      musicTrack = undefined;
    }
    stopLowHealthMusic();
  }

  function startLowHealthMusic(): void {
    if (lowHealthMusicTrack || !audioUnlocked) return;
    const musicVol = getState().musicVolume ?? 0.45;
    const vol = Math.max(0, Math.min(1, musicVol));
    const tryLoad = (url: string, onError: () => void) => {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = vol;
      const tryPlay = () => {
        if (lowHealthMusicTrack !== audio) return;
        void audio.play().catch(() => {});
      };
      audio.addEventListener("canplaythrough", tryPlay, { once: true });
      audio.addEventListener("error", onError, { once: true });
      lowHealthMusicTrack = audio;
      tryPlay();
    };
    tryLoad(LOW_HEALTH_TRACK_OGG, () => {
      if (lowHealthMusicTrack === undefined) return;
      lowHealthMusicTrack = undefined;
      tryLoad(LOW_HEALTH_TRACK_MP3, () => {
        if (lowHealthMusicTrack === undefined) return;
        lowHealthMusicTrack = undefined;
        tryLoad(LOW_HEALTH_FALLBACK, () => {
          lowHealthMusicTrack = undefined;
        });
      });
    });
  }

  function stopLowHealthMusic(): void {
    if (lowHealthMusicTrack) {
      try {
        lowHealthMusicTrack.pause();
        lowHealthMusicTrack.currentTime = 0;
      } catch {
        // ignore
      }
      lowHealthMusicTrack = undefined;
    }
  }

  function updateVolumes(state: AudioManagerState): void {
    const base = Math.max(0, Math.min(1, state.musicVolume ?? 0.45));
    const factor = state.lowHealthActive ? 0.25 : 1;
    if (musicTrack) musicTrack.volume = base * factor;
    if (lowHealthMusicTrack) lowHealthMusicTrack.volume = base;
  }

  function playLaserSound(): void {
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain.gain.setValueAtTime(0.05 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.12);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function startContinuousLaserSyntheticSound(sfxVol: number): void {
    if (!audioUnlocked) return;
    const context = ensureAudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, context.currentTime);
    gain.gain.setValueAtTime(
      0.06 * Math.max(0, Math.min(1, sfxVol)),
      context.currentTime
    );
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    osc.start(0);
    continuousLaserSynthetic = { oscillator: osc, gain };
  }

  function startContinuousLaserSound(sfxVol: number): void {
    if (typeof window === "undefined") return;
    const vol = Math.max(0, Math.min(1, sfxVol * 0.7));
    const sound = new Audio("/assets/sfx/continuous_laser.ogg");
    sound.loop = true;
    sound.volume = vol;
    sound
      .play()
      .then(() => {
        continuousLaserSound = sound;
      })
      .catch(() => {
        startContinuousLaserSyntheticSound(vol);
      });
  }

  function stopContinuousLaserSound(): void {
    if (continuousLaserSound) {
      continuousLaserSound.pause();
      continuousLaserSound.currentTime = 0;
      continuousLaserSound = undefined;
    }
    if (continuousLaserSynthetic) {
      try {
        continuousLaserSynthetic.oscillator.stop();
        continuousLaserSynthetic.oscillator.disconnect();
        continuousLaserSynthetic.gain.disconnect();
      } catch {
        // already stopped
      }
      continuousLaserSynthetic = undefined;
    }
  }

  function playPickupSound(): void {
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.05 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.14);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function playExplosionSound(): void {
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const buffer = context.createBuffer(
      1,
      context.sampleRate * 0.25,
      context.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.12 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(now);
    source.stop(now + 0.24);
  }

  function playEnemyHitSound(): void {
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const minGain = 0.0001;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    gain.gain.setValueAtTime(minGain, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(minGain, 0.06 * sfx),
      now + 0.01
    );
    gain.gain.exponentialRampToValueAtTime(minGain, now + 0.14);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.16);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function playEnemyAttackSound(): void {
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const minGain = 0.0001;
    osc.type = "square";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(minGain, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(minGain, 0.04 * sfx),
      now + 0.01
    );
    gain.gain.exponentialRampToValueAtTime(minGain, now + 0.2);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.22);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function playLevelUpFanfare(): void {
    if (typeof window === "undefined") return;
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.12 * sfx, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + i * 0.12 + 0.25
      );
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.26);
    });
  }

  function playHeartbeatSound(): void {
    if (!audioUnlocked) return;
    const vol =
      Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55)) * 0.2;
    const context = ensureAudioContext();
    const now = context.currentTime;
    const playThump = (t: number) => {
      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(55, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.08);
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(vol, t + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gainNode);
      gainNode.connect(context.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    };
    playThump(now);
    playThump(now + 0.15);
  }

  function playShipHitSound(): void {
    if (!audioUnlocked) return;
    const sfx = Math.max(0, Math.min(1, getState().sfxVolume ?? 0.55));
    const context = ensureAudioContext();
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);
    gain.gain.setValueAtTime(0.08 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  return {
    ensureAudioContext,
    unlockAudio,
    getAudioUnlocked: () => audioUnlocked,
    startMusic,
    switchMainMusicToSectorLevel,
    stopMusic,
    startLowHealthMusic,
    stopLowHealthMusic,
    updateVolumes,
    playLaserSound,
    startContinuousLaserSound,
    stopContinuousLaserSound,
    playPickupSound,
    playExplosionSound,
    playEnemyHitSound,
    playEnemyAttackSound,
    playLevelUpFanfare,
    playHeartbeatSound,
    playShipHitSound,
  };
}
