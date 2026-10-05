# Shikharam Yoga — Programmatic Video & Reel Production Guide

This guide documents the automated video and audio generation system for **Shikharam Yoga**. It explains how to generate, preview, customize, and render high-converting Instagram Reels and widescreen website brand films.

---

## 1. System Overview & Architecture

The video pipeline consists of two decoupled, high-performance engines:

```
┌──────────────────────────────────────────────────────────┐
│ 1. AUDIO & VOICEOVER PIPELINE (scripts/generate_audio.py) │
│                                                          │
│  Script Blocks  ──►  Neural Speech  ──►  Sidechain Duck  │
│  (Hinglish)          (Madhur/Swara)      (432Hz Ambient) │
│                             │                            │
│                             ▼                            │
│                    EBU R128 Loudness                     │
│                    (-16 LUFS, -1.5 dBTP)                 │
│                             │                            │
│                             ▼                            │
│                 narration-manifest.json                  │
│             + shikhram-voiceover-master.mp3              │
└─────────────────────────────┬────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ 2. VIDEO RENDERING ENGINE (Remotion / React)             │
│                                                          │
│  video/src/ShikhramHindiReel.tsx (9:16 Vertical Reel)    │
│  video/src/ShikhramAnthem.tsx    (16:9 Widescreen Film)  │
│  video/src/ShikhramReel.tsx      (9:16 English Edition)  │
│                             │                            │
│                             ▼                            │
│                  Web-Optimized H.264 MP4                 │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Available Video Compositions

| Composition ID | Aspect Ratio | Dimensions | Best For |
| :--- | :--- | :--- | :--- |
| **`DynamicReel`** | **9:16 Vertical** | 1080 × 1920 | **Fully Data-Driven Reel**: Reads ANY JSON script file (`scripts/reels/*.json`), dynamically rendering all cards, backgrounds, headlines, and voice timings. |
| **`ShikhramHindiReel`** | **9:16 Vertical** | 1080 × 1920 | Dedicated Hindi voiceover reel synchronized to narration manifest. |
| **`ShikhramAnthem`** | **16:9 Landscape** | 1920 × 1080 | Website Hero banner, "Watch Brand Film" modal, presentation screens. |
| **`ShikhramReel`** | **9:16 Vertical** | 1080 × 1920 | English-language global audience mobile promo. |

---

## 3. How to Generate Any Video in 3 Steps

### Step 1: Pick or Create Your Script JSON
You can make a new reel just by creating a JSON file in `scripts/reels/` (e.g. `scripts/reels/01-thaki-zindagi.json` or `scripts/reels/02-rishikesh-retreat.json`).

Generate the studio-grade audio and dynamic manifest:
```bash
# Default (Thaki Hui Zindagi):
.venv/bin/python scripts/generate_audio.py

# Or specify any script JSON:
.venv/bin/python scripts/generate_audio.py --script scripts/reels/02-rishikesh-retreat.json

# Or switch to female narrator voice:
.venv/bin/python scripts/generate_audio.py --script scripts/reels/01-thaki-zindagi.json --voice hi-IN-SwaraNeural
```
*(Uses SHA-256 caching. If the script hasn't changed, it reuses the audio in 0.1s).*

---

### Step 2: Live Preview in Remotion Studio (Browser)
To inspect animations, typography, and audio scrubbable frame-by-frame:

```bash
cd video
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Step 3: Render Finished MP4 Video
Run the render command from the `video/` directory:

#### For the 9:16 Spoken Hindi Reel:
```bash
cd video
npx remotion render ShikhramHindiReel ../assets/videos/shikhram-hindi-reel.mp4 --concurrency=4
ffmpeg -y -i ../assets/videos/shikhram-hindi-reel.mp4 -c:v libx264 -crf 24 -preset fast -movflags +faststart -c:a aac ../assets/videos/shikhram-hindi-reel-web.mp4
cd ..
```

#### For the 16:9 Widescreen Brand Anthem:
```bash
cd video
npx remotion render ShikhramAnthem ../assets/videos/shikhram-anthem.mp4 --concurrency=4
ffmpeg -y -i ../assets/videos/shikhram-anthem.mp4 -c:v libx264 -crf 24 -preset fast -movflags +faststart -c:a aac ../assets/videos/shikhram-anthem-web.mp4
cd ..
```

---

## 4. Customizing the Script & Voice

Open `scripts/generate_audio.py` to change voice or text:

### Changing the Voice
Inside `VOICE_CONFIG`:
```python
VOICE_CONFIG = {
    "voice_id": "hi-IN-MadhurNeural", # Warm, calm Indian male (Aniket founder tone)
    # Alternative: "hi-IN-SwaraNeural" for warm Indian female voice
    # Alternative: "en-IN-NeerjaExpressiveNeural" for Indian English
    "rate": "+2%",     # Conversational pacing
    "pitch": "-1Hz",   # Warmth and depth
}
```

### Editing the Script Blocks
The script uses **Natural Speech Blocks** instead of isolated sentences. Each block contains a cohesive thought so the voice model understands context and maintains human rhythm:

```python
SCRIPT_BLOCKS = [
    {
        "id": "scene1",
        "title": "The Urban Reality",
        "subtitle": "थकी हुई ज़िंदगी...",
        "text": "थकी हुई ज़िंदगी, भागती हुई सांसें... क्या आप भी रोज़ के तनाव में खुद को खो चुके हैं?",
        "pause_after_seconds": 0.5
    },
    {
        "id": "scene2",
        "title": "Who Comes to Shikharam",
        "subtitle": "शिखरम् कौन आता है?",
        "text": "शिखरम् में आपका स्वागत है। यहां आते हैं बर्नआउट से थके प्रोफेश्नल्स, बेचैन मन वाले साधक, और वो जो खुद को फिर से तलाशना चाहते हैं।",
        "pause_after_seconds": 0.5
    },
    # Add or edit scenes here
]
```

When you re-run `.venv/bin/python scripts/generate_audio.py`, Remotion will automatically adjust its duration and scene transitions to match the new audio!

---

## 5. Audio Engineering Standards Applied

- **Integrated Loudness**: Standardized at `-16.0 LUFS` via `loudnorm` filter (ideal for Instagram and mobile web).
- **True Peak**: Strictly capped at `-1.5 dBTP` (eliminates distortion and clipping).
- **Sidechain Ducking**: The 432Hz ambient singing bowl background automatically drops by 14 dB whenever the narrator speaks, and gently breathes upward during pauses.
- **Vocal EQ & Compression**: High-pass filter at 75 Hz to cut rumble, presence boost at 3 kHz for vocal clarity, and 2.5:1 ratio compression for consistent warmth.

---

## 6. How to Embed Video on the Website

### Option A: "Watch Brand Film (15s)" Lightbox Modal (Recommended)
Add a button to `index.html` inside the hero actions:
```html
<button class="button-film" id="openBrandFilmBtn" type="button">
  <span class="film-play-icon">▶</span>
  <span>Watch Brand Film <small>15s</small></span>
</button>
```

And place the video in a dialog/lightbox:
```html
<dialog id="brandFilmModal" class="film-dialog">
  <div class="film-modal-content">
    <button class="film-close" onclick="this.closest('dialog').close()">✕</button>
    <video controls playsinline preload="metadata">
      <source src="assets/videos/shikhram-anthem-web.mp4" type="video/mp4">
    </video>
  </div>
</dialog>
```

### Option B: Ambient Looping Video Background
Inside `.hero-image` on `index.html`:
```html
<video 
  class="hero-video-bg" 
  autoplay 
  muted 
  loop 
  playsinline 
  preload="metadata"
  poster="assets/shikhram-hero.png"
>
  <source src="assets/videos/shikhram-anthem-web.mp4" type="video/mp4">
</video>
```
*(With `autoplay muted loop playsinline`, browsers play it smoothly without blocking).*
