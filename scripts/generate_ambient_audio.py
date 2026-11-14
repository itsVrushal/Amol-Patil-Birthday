import wave, math, struct
from pathlib import Path

out_path = Path("d:/git reps/Amol Patil/public/music/track1.wav")
out_path.parent.mkdir(parents=True, exist_ok=True)

sample_rate = 44100
duration = 16.0  # seconds
num_samples = int(sample_rate * duration)

# Ambient chord frequencies (C major 9 / warm dream pad):
# C3 (130.81), G3 (196.00), B3 (246.94), E4 (329.63), G4 (392.00), D5 (587.33)
notes = [
    (130.81, 0.28),
    (196.00, 0.22),
    (246.94, 0.18),
    (329.63, 0.16),
    (392.00, 0.12),
    (587.33, 0.08),
]

samples = []
for i in range(num_samples):
    t = i / sample_rate
    # Smooth sinusoidal envelope for seamless loop
    # env = 0 at t=0 and t=duration, peaks in the middle
    env = 0.5 * (1.0 - math.cos(2.0 * math.pi * t / duration))
    
    val = 0.0
    for freq, amp in notes:
        # Subtle slow chorus vibrato
        detune = 1.0 + 0.003 * math.sin(2.0 * math.pi * 0.25 * t)
        val += amp * math.sin(2.0 * math.pi * freq * detune * t)
        # Add gentle warm harmonic
        val += (amp * 0.3) * math.sin(2.0 * math.pi * freq * 2.0 * t)

    val = val * env * 0.75
    # Clamp
    val = max(-1.0, min(1.0, val))
    int_val = int(val * 32767.0)
    samples.append(int_val)

with wave.open(str(out_path), "wb") as wav:
    wav.setnchannels(2)  # stereo
    wav.setsampwidth(2)  # 16-bit
    wav.setframerate(sample_rate)
    data = bytearray()
    for s in samples:
        # Left and slightly panned right
        data.extend(struct.pack("<hh", s, int(s * 0.95)))
    wav.writeframes(data)

print(f"Generated seamless ambient audio loop at: {out_path}")
