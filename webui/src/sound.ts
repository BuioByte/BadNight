const soundtrack = new Audio('/sounds/badnight-theme.wav');
const typeSounds = [new Audio('/sounds/type-key-1.wav'), new Audio('/sounds/type-key-2.wav')];
soundtrack.loop = true;
soundtrack.volume = 0.2;
soundtrack.preload = 'none';
typeSounds.forEach((sound) => {
  sound.volume = 0.16;
  sound.preload = 'auto';
});
let nextTypeSound = 0;
let lastTypeSound = 0;

export async function enableSound(): Promise<boolean> {
  try {
    await soundtrack.play();
    return true;
  } catch {
    return false;
  }
}

export function disableSound(): void {
  soundtrack.pause();
  soundtrack.currentTime = 0;
}

export function playTypeSound(): void {
  const now = performance.now();
  if (now - lastTypeSound < 65) return;
  lastTypeSound = now;
  const sound = typeSounds[nextTypeSound];
  nextTypeSound = (nextTypeSound + 1) % typeSounds.length;
  sound.currentTime = 0;
  void sound.play().catch(() => {});
}
