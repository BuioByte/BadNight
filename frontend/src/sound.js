const soundtrack = new Audio('/sounds/badnight-theme.wav');
const typingSounds = [new Audio('/sounds/type-key-1.wav'), new Audio('/sounds/type-key-2.wav')];
const volumes = { master: 1, music: 0.2, typing: 0.16 };
let audioEnabled = true;
let nextTypingSound = 0;

soundtrack.loop = true;
soundtrack.preload = 'none';
typingSounds.forEach((sound) => { sound.preload = 'auto'; });
void soundtrack.play().catch(() => {});

function resumeSoundtrack() {
  if (audioEnabled && soundtrack.paused) void soundtrack.play().catch(() => {});
}

document.addEventListener('pointerdown', resumeSoundtrack, { once: true });
document.addEventListener('keydown', resumeSoundtrack, { once: true });

function applyVolumes() {
  soundtrack.volume = volumes.master * volumes.music;
  typingSounds.forEach((sound) => { sound.volume = volumes.master * volumes.typing; });
}

export function setVolume(channel, value) {
  volumes[channel] = Math.max(0, Math.min(1, value));
  applyVolumes();
}

export async function setAudioEnabled(enabled) {
  if (enabled) {
    audioEnabled = true;
    try {
      await soundtrack.play();
    } catch {
      return true;
    }
    return true;
  }

  audioEnabled = false;
  soundtrack.pause();
  soundtrack.currentTime = 0;
  typingSounds.forEach((sound) => {
    sound.pause();
    sound.currentTime = 0;
  });
  return true;
}

export function playTypingSound() {
  if (!audioEnabled) return;
  resumeSoundtrack();
  const sound = typingSounds[nextTypingSound];
  nextTypingSound = (nextTypingSound + 1) % typingSounds.length;
  sound.currentTime = 0;
  void sound.play().catch(() => {});
}
