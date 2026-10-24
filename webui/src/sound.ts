type Sound = 'start' | 'step' | 'room' | 'win';

let audio: AudioContext | undefined;

export async function enableSound(): Promise<boolean> {
  try {
    audio ??= new AudioContext();
    await audio.resume();
    return audio.state === 'running';
  } catch {
    return false;
  }
}

export function playSound(sound: Sound): void {
  if (!audio || audio.state !== 'running') return;

  const notes: Record<Sound, number[]> = {
    start: [523.25, 783.99],
    step: [196],
    room: [392, 523.25],
    win: [523.25, 659.25, 783.99, 1046.5],
  };
  const durations: Record<Sound, number> = {
    start: 0.55,
    step: 0.18,
    room: 0.35,
    win: 0.7,
  };
  const now = audio.currentTime;
  const duration = durations[sound];

  notes[sound].forEach((frequency, index) => {
    const oscillator = audio!.createOscillator();
    const volume = audio!.createGain();
    const start = now + index * (sound === 'win' ? 0.15 : 0.1);
    oscillator.type = sound === 'step' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (sound === 'step') oscillator.frequency.exponentialRampToValueAtTime(95, start + duration);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(sound === 'step' ? 0.045 : 0.07, start + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(audio!.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}
