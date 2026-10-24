const soundtrack = new Audio('/sounds/badnight-theme.wav');
soundtrack.loop = true;
soundtrack.volume = 0.2;
soundtrack.preload = 'none';

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
