const soundtrack = new Audio('/sounds/badnight-theme.wav');
const typingSounds = [new Audio('/sounds/type-key-1.wav'), new Audio('/sounds/type-key-2.wav')];
const narrationSounds = [1, 2, 3].map((n) => new Audio(`/sounds/typewriter-${n}.wav`));
const volumes = { master: 1, music: 0.2, typing: 0.16, narration: 0.12 };
let audioEnabled = true;
let nextTypingSound = 0;
let nextNarrationSound = 0;

soundtrack.loop = true;
soundtrack.preload = 'none';
typingSounds.forEach((sound) => { sound.preload = 'auto'; });
narrationSounds.forEach((sound) => { sound.preload = 'auto'; });
void soundtrack.play().catch(() => {});

function resumeSoundtrack() {
  if (audioEnabled && soundtrack.paused) void soundtrack.play().catch(() => {});
}

function applyVolumes() {
  soundtrack.volume = volumes.master * volumes.music;
  typingSounds.forEach((sound) => { sound.volume = volumes.master * volumes.typing; });
  narrationSounds.forEach((sound) => { sound.volume = volumes.master * volumes.narration; });
}

applyVolumes();

export function setVolume(channel, value) {
  volumes[channel] = Math.max(0, Math.min(1, value));
  applyVolumes();
}

export function setAudioEnabled(enabled) {
  if (enabled) {
    audioEnabled = true;
    void soundtrack.play().catch(() => {});
    return true;
  }

  audioEnabled = false;
  soundtrack.pause();
  soundtrack.currentTime = 0;
  [...typingSounds, ...narrationSounds].forEach((sound) => {
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

export function playNarrationSound() {
  if (!audioEnabled) return;
  resumeSoundtrack();
  const sound = narrationSounds[nextNarrationSound];
  nextNarrationSound = (nextNarrationSound + 1) % narrationSounds.length;
  sound.currentTime = 0;
  void sound.play().catch(() => {});
}
