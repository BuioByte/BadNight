from array import array
from pathlib import Path
import math
import struct
import wave


SAMPLE_RATE = 22050
SECONDS_PER_BAR = 4
BAR_COUNT = 8
LENGTH = SAMPLE_RATE * SECONDS_PER_BAR * BAR_COUNT
OUTPUT = Path(__file__).resolve().parents[1] / 'public/sounds/badnight-theme.wav'

chords = [
    [73.42, 110.00, 146.83, 174.61, 220.00],
    [58.27, 116.54, 146.83, 174.61, 220.00],
    [87.31, 130.81, 174.61, 196.00, 261.63],
    [65.41, 130.81, 146.83, 196.00, 261.63],
]
melodies = [
    [587.33, 698.46, 880.00, 659.25],
    [587.33, 523.25, 698.46, 587.33],
    [698.46, 783.99, 880.00, 1046.50],
    [783.99, 698.46, 587.33, 523.25],
]

left = array('f', [0.0]) * LENGTH
right = array('f', [0.0]) * LENGTH


def add_note(frequency, start, duration, volume, voice, pan=0.0):
    first = max(0, int(start * SAMPLE_RATE))
    last = min(LENGTH, int((start + duration) * SAMPLE_RATE))
    left_gain = math.sqrt((1.0 - pan) / 2.0)
    right_gain = math.sqrt((1.0 + pan) / 2.0)
    for sample in range(first, last):
        time = sample / SAMPLE_RATE - start
        if voice == 'pad':
            attack = min(1.0, time / 1.1)
            release = min(1.0, max(0.0, (duration - time) / 0.9))
            envelope = attack * release
            phase = 2.0 * math.pi * frequency * time
            tone = math.sin(phase) + 0.22 * math.sin(phase * 2.0) + 0.08 * math.sin(phase * 3.0)
            tone += 0.17 * math.sin(phase * 1.003 + 0.3)
        elif voice == 'bass':
            envelope = min(1.0, time / 0.12) * math.exp(-time / 4.4)
            tone = math.sin(2.0 * math.pi * frequency * time)
        else:
            envelope = (1.0 - math.exp(-time / 0.012)) * math.exp(-time / 1.05)
            phase = 2.0 * math.pi * frequency * time
            tone = math.sin(phase) + 0.36 * math.sin(phase * 2.0) + 0.12 * math.sin(phase * 3.0)
            tone += 0.18 * math.sin(phase * 4.01 + 0.2) * math.exp(-time / 0.22)
        value = volume * envelope * tone
        left[sample] += value * left_gain
        right[sample] += value * right_gain


for bar in range(BAR_COUNT):
    chord = chords[bar % len(chords)]
    start = bar * SECONDS_PER_BAR
    for index, frequency in enumerate(chord):
        add_note(frequency, start, SECONDS_PER_BAR, 0.012 if index < 3 else 0.007, 'pad', -0.35 + index * 0.17)
    add_note(chord[0] / 2, start, 3.75, 0.035, 'bass')
    for beat, frequency in enumerate(chord[1:5]):
        add_note(frequency * 2, start + beat, 1.7, 0.055, 'pluck', -0.28 + beat * 0.18)
    if bar % 2 == 0:
        for beat, frequency in enumerate(melodies[(bar // 2) % len(melodies)]):
            add_note(frequency, start + beat + 0.5, 1.9, 0.035, 'pluck', 0.25 - beat * 0.14)

dry_left = left[:]
dry_right = right[:]
delay_one = int(0.22 * SAMPLE_RATE)
delay_two = int(0.39 * SAMPLE_RATE)
for sample in range(delay_two, LENGTH):
    left[sample] += dry_right[sample - delay_one] * 0.12 + dry_left[sample - delay_two] * 0.055
    right[sample] += dry_left[sample - delay_one] * 0.12 + dry_right[sample - delay_two] * 0.055

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUTPUT), 'wb') as soundtrack:
    soundtrack.setnchannels(2)
    soundtrack.setsampwidth(2)
    soundtrack.setframerate(SAMPLE_RATE)
    frames = bytearray()
    for sample in range(LENGTH):
        fade = min(1.0, sample / (SAMPLE_RATE * 0.35), (LENGTH - sample) / (SAMPLE_RATE * 0.35))
        frames.extend(struct.pack('<hh',
            round(max(-1.0, min(1.0, left[sample] * fade * 2.3)) * 32767),
            round(max(-1.0, min(1.0, right[sample] * fade * 2.3)) * 32767),
        ))
    soundtrack.writeframes(frames)

print(f'Rendered {OUTPUT} ({BAR_COUNT * SECONDS_PER_BAR}s)')
