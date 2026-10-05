# 🎬 The Shikharam Yoga Reel Production Prompt Template

Use this prompt template whenever asking an AI assistant or video developer to generate or refine a video reel for **Shikharam Yoga** (or adapt it for any wellness brand).

---

```markdown
# TASK: Generate a Studio-Quality Wellness Reel for Shikharam Yoga

## 1. BRAND CONTEXT & IDENTITY
- **Brand**: Shikharam Yoga (The summit within · Traditional Hatha, Ashtanga, Pranayama, Sound Healing, Himalayan Retreats).
- **Tone**: Grounded luxury, serene, warm, authentic, transformational. Not corporate, not aggressive sales, not motivational hype.
- **Narrator Persona**: Indian wellness creator (calm, friendly, conversational, speaking directly to one viewer).
- **Language**: Natural Indian Hindi/Hinglish (Devanagari for Hindi phrases, common Indian English terms kept natural).

---

## 2. NARRATION & AUDIO PIPELINE RULES (CRITICAL)
1. **NO Isolated Sentence Slicing**: Do NOT generate sentence-by-sentence clips. Divide the narrative into 3 to 4 natural speech blocks with cohesive thoughts.
2. **NO Uniform Hardcoded Silence**: Do not add mathematical 500ms–1000ms delay gaps. Natural linguistic pauses must emerge from the speech itself.
3. **Voice Engine**:
   - Primary: High-fidelity Neural Indian Voice (`hi-IN-MadhurNeural` for warm male founder tone, or `hi-IN-SwaraNeural` for serene female tone).
   - Rate: `-2%` to `+2%` (unhurried, grounded).
   - Pitch: `-1Hz` (resonance and warmth).
4. **Studio Audio Standards**:
   - Master Loudness: `-16.0 LUFS` (EBU R128 standard).
   - True Peak: `<= -1.5 dBTP` (0 distortion/clipping).
   - Dynamic Ducking: 432Hz ambient singing bowl background must duck by ~14dB while narrator speaks, breathing upward during pauses.

---

## 3. STORYBOARD STRUCTURE (4 BLOCKS)

### Block 1: The Hook & Urban Reality (0s – ~7s)
- **Visual**: Dark moody amber glow, subtle breathing sacred geometry orb.
- **Eyebrow**: "THE URBAN REALITY"
- **Headline**: "थकी हुई ज़िंदगी..."
- **Narration**: Relatable emotional hook addressing corporate burnout, rushed breath, and seeking inner stillness.

### Block 2: Who Finds Sanctuary Here (~7s – ~16s)
- **Visual**: 3 staggered luxury glass cards.
- **Eyebrow**: "A SANCTUARY FOR EVERY SEEKER"
- **Headline**: "शिखरम् कौन आता है?"
- **Cards**:
  - 01: Corporate professionals seeking calm.
  - 02: Restless minds seeking sleep & release from anxiety.
  - 03: Seekers ready to discover their summit within.

### Block 3: The Sanctuary & Healing (~16s – ~23s)
- **Visual**: Arched meditation window or Rishikesh holy river with slow Ken Burns zoom.
- **Eyebrow**: "TRANSFORMATION & HEALING"
- **Headline**: "ठहरिए। सांस लीजिए।"
- **Subtext**: Authentic Hatha, Sound Healing & Himalayan Retreats. Guided by Aniket.

### Block 4: The Summit Within & CTA (~23s – ~30s)
- **Visual**: Shikhram Yoga golden logo mark, breathing glow aura.
- **Headline**: "भीतर के शिखर तक।"
- **Subtext**: "Rise to your highest self."
- **CTA Button**: "अपनी यात्रा शुरू करें →"
- **Footer**: "shikhram.com · Pune · Rishikesh"

---

## 4. ARCHITECTURAL REQUIREMENTS
- **Keep Visuals Decoupled from Audio**: Audio generates a `narration-manifest.json` with exact frame timestamps (`start_frame`, `end_frame`).
- **Dynamic Remotion Sync**: Video composition must read the manifest so scene transitions match the narrator's real pace.
- **Caching**: SHA-256 hash of script text + voice config to prevent redundant synthesis on video re-renders.
- **Fast-Start MP4**: Output must be web-optimized via FFmpeg (`-movflags +faststart`).
```
