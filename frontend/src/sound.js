const soundtrack = new Audio('/sounds/badnight-theme.wav');
const typingSounds = [new Audio('/sounds/type-key-1.wav'), new Audio('/sounds/type-key-2.wav')];
const volumes = { master: 1, music: 0.2, typing: 0.16 };
let audioEnabled = false;
let nextTypingSound = 0;
let lastTypingSound = 0;

soundtrack.loop = true;
soundtrack.preload = 'none';
typingSounds.forEach((sound) => { sound.preload = 'auto'; });

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
    try {
      await soundtrack.play();
      audioEnabled = true;
      return true;
    } catch {
      return false;
    }
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
  const now = performance.now();
  if (!audioEnabled || now - lastTypingSound < 65) return;
  lastTypingSound = now;
  const sound = typingSounds[nextTypingSound];
  nextTypingSound = (nextTypingSound + 1) % typingSounds.length;
  sound.currentTime = 0;
  void sound.play().catch(() => {});
}
