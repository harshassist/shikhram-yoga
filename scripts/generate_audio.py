#!/usr/bin/env python3
"""
Shikharam Yoga - Generalized Dynamic Reel Audio Engine.

Generates studio-grade voiceover audio from ANY reel JSON script:
  python scripts/generate_audio.py --script scripts/reels/01-thaki-zindagi.json
  python scripts/generate_audio.py --script scripts/reels/02-rishikesh-retreat.json

Key Capabilities:
- Dynamic input: Reads any multi-scene JSON specification.
- Voice Identity: Indian wellness creator (MadhurNeural / SwaraNeural).
- SHA-256 caching: Prevents redundant synthesis if script hasn't changed.
- Post-processing: Highpass (75Hz), Presence EQ (3kHz), Transparent Compression.
- Automated Sidechain Ducking: 432Hz ambient Tibetan soundscape ducks 14dB under speech.
- EBU R128 Loudness Normalization: -16 LUFS, True Peak <= -1.5 dBTP.
- Generates video/public/narration-manifest.json for dynamic Remotion video rendering.
"""

import os
import sys
import json
import hashlib
import asyncio
import subprocess
import math
import wave
import struct
import shutil
import argparse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / ".cache" / "audio"
PUBLIC_DIR = ROOT_DIR / "video" / "public"
DEFAULT_SCRIPT = ROOT_DIR / "scripts" / "reels" / "01-thaki-zindagi.json"

DEFAULT_VOICE = {
    "brand": "Shikharam Yoga",
    "persona": "Indian wellness creator",
    "voice_id": "hi-IN-MadhurNeural",
    "rate": "+2%",
    "pitch": "-1Hz",
    "loudness_target_lufs": -16.0,
    "true_peak_db": -1.5,
    "loudness_range_lra": 11.0,
    "sample_rate": 44100,
    "fps": 30
}


def ensure_environment():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def compute_cache_hash(script_data, voice_config):
    payload = {"voice": voice_config, "script": script_data}
    dumped = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(dumped.encode("utf-8")).hexdigest()[:16]


def get_audio_duration(file_path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file_path)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return float(res.stdout.strip())


async def synthesize_speech(text: str, voice_id: str, rate: str, pitch: str, out_path: Path):
    try:
        import edge_tts
    except ImportError:
        print("[ERROR] edge_tts is not installed in current environment.")
        sys.exit(1)

    comm = edge_tts.Communicate(text=text, voice=voice_id, rate=rate, pitch=pitch)
    with open(out_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])


def generate_ambient_music(duration_seconds: float, out_path: Path, sample_rate=44100):
    total_samples = int(sample_rate * (duration_seconds + 1.0))
    harmonics = [
        {"freq": 216.0, "detune": 0.0, "amp": 0.35},
        {"freq": 432.0, "detune": 0.8, "amp": 0.45},
        {"freq": 432.0, "detune": -0.8, "amp": 0.45},
        {"freq": 648.0, "detune": 0.4, "amp": 0.22},
        {"freq": 864.0, "detune": -0.4, "amp": 0.15},
    ]
    strikes = [0.0, 7.5, 16.0, 23.5]
    data = bytearray()

    for i in range(total_samples):
        t = i / sample_rate
        env = 1.0
        if t < 2.0:
            env = 0.5 * (1.0 - math.cos(math.pi * t / 2.0))
        elif t > (duration_seconds - 2.0):
            remain = duration_seconds - t
            env = max(0.0, 0.5 * (1.0 + math.cos(math.pi * (2.0 - remain) / 2.0)))

        sample = 0.0
        for h in harmonics:
            shimmer = h["detune"] * math.sin(2 * math.pi * 0.18 * t)
            freq = h["freq"] + shimmer
            sample += math.sin(2 * math.pi * freq * t) * h["amp"] * 0.25

        for st in strikes:
            if t >= st:
                dt = t - st
                strike_env = math.exp(-dt * 0.65)
                bell = (
                    math.sin(2 * math.pi * 432.0 * dt) * 0.38 +
                    math.sin(2 * math.pi * 864.0 * dt) * 0.22 +
                    math.sin(2 * math.pi * 1296.0 * dt) * 0.12
                ) * strike_env
                sample += bell * 0.32

        sample = max(-0.95, min(0.95, sample * env * 0.38))
        int_sample = int(sample * 32767.0)
        data += struct.pack("<hh", int_sample, int_sample)

    with wave.open(str(out_path), "w") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(data)


def process_audio(script_path: Path, voice_override=None):
    ensure_environment()
    with open(script_path, "r", encoding="utf-8") as f:
        script_data = json.load(f)

    voice_config = dict(DEFAULT_VOICE)
    voice_config["voice_id"] = voice_override or script_data.get("voice_id", voice_config["voice_id"])
    voice_config["rate"] = script_data.get("rate", voice_config["rate"])
    voice_config["pitch"] = script_data.get("pitch", voice_config["pitch"])

    cache_key = compute_cache_hash(script_data, voice_config)
    cache_dir = CACHE_DIR / cache_key
    cache_manifest = cache_dir / "manifest.json"
    cache_master = cache_dir / "shikhram-voiceover-master.mp3"

    print("=" * 64)
    print(f"  SHIKHARAM YOGA — DYNAMIC AUDIO ENGINE")
    print(f"  Script:    {script_data.get('title', script_path.name)}")
    print(f"  Voice ID:  {voice_config['voice_id']}")
    print(f"  Cache Key: {cache_key}")
    print("=" * 64)

    if cache_manifest.exists() and cache_master.exists():
        print("[CACHE HIT] Reusing cached studio narration audio.")
        shutil.copy(cache_master, PUBLIC_DIR / "shikhram-voiceover-master.mp3")
        shutil.copy(cache_manifest, PUBLIC_DIR / "narration-manifest.json")
        with open(cache_manifest, "r", encoding="utf-8") as f:
            return json.load(f)

    print("[CACHE MISS] Generating neural voiceover blocks...")
    cache_dir.mkdir(parents=True, exist_ok=True)

    block_files = []
    scenes_meta = []
    current_time = 0.5

    for idx, scene in enumerate(script_data["scenes"]):
        scene_id = scene.get("id", f"scene{idx+1}")
        spoken = scene.get("spoken_text", scene.get("body", ""))
        raw_path = cache_dir / f"{scene_id}_raw.mp3"

        print(f"  -> Synthesizing [{scene_id}]: \"{scene.get('headline', '')}\"")
        asyncio.run(synthesize_speech(
            text=spoken,
            voice_id=voice_config["voice_id"],
            rate=voice_config["rate"],
            pitch=voice_config["pitch"],
            out_path=raw_path
        ))

        dur = get_audio_duration(raw_path)
        start_time = current_time
        end_time = start_time + dur
        pause = scene.get("pause_after_seconds", 0.5)

        # Merge full scene presentation metadata with calculated frame timing
        scene_record = dict(scene)
        scene_record.update({
            "start_seconds": round(start_time, 3),
            "end_seconds": round(end_time, 3),
            "duration_seconds": round(dur, 3),
            "start_frame": int(round(start_time * voice_config["fps"])),
            "end_frame": int(round(end_time * voice_config["fps"]))
        })
        scenes_meta.append(scene_record)
        block_files.append((raw_path, start_time, dur))
        current_time = end_time + pause

    total_duration = current_time
    total_frames = int(round(total_duration * voice_config["fps"]))
    print(f"  Total Duration: {total_duration:.2f}s ({total_frames} frames @ {voice_config['fps']} fps)")

    # Concatenate voice with precise timing
    dry_voice_path = cache_dir / "voice_dry.wav"
    ffmpeg_inputs = []
    filter_delays = []
    mix_labels = []

    for idx, (path, start_t, _) in enumerate(block_files):
        ffmpeg_inputs.extend(["-i", str(path)])
        delay_ms = int(round(start_t * 1000))
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms}[v{idx}]")
        mix_labels.append(f"[v{idx}]")

    amix_filter = f"{';'.join(filter_delays)};{''.join(mix_labels)}amix=inputs={len(block_files)}:duration=longest:dropout_transition=0[outv]"
    subprocess.run(
        ["ffmpeg", "-y"] + ffmpeg_inputs + ["-filter_complex", amix_filter, "-map", "[outv]", str(dry_voice_path)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )

    # Ambient Music with Sidechain Ducking & EBU R128 Loudnorm
    ambient_music_path = cache_dir / "ambient_music.wav"
    print("  -> Generating 432Hz ambient Tibetan soundscape...")
    generate_ambient_music(total_duration, ambient_music_path)

    print("  -> Applying vocal chain, sidechain ducking & -16 LUFS loudnorm...")
    master_wav_path = cache_dir / "master.wav"
    complex_filter = (
        "[0:a]highpass=f=75,equalizer=f=3000:t=q:w=1.0:g=2.0,acompressor=threshold=-20dB:ratio=2.5:attack=15:release=120[voice_proc];"
        "[voice_proc]asplit=2[voice_out][voice_trigger];"
        "[1:a]volume=0.32[music_base];"
        "[music_base][voice_trigger]sidechaincompress=threshold=0.08:ratio=4.0:attack=20:release=350[music_ducked];"
        "[voice_out][music_ducked]amix=inputs=2:duration=longest:dropout_transition=1[mix_raw];"
        f"[mix_raw]loudnorm=I={voice_config['loudness_target_lufs']}:TP={voice_config['true_peak_db']}:LRA={voice_config['loudness_range_lra']}[final_master]"
    )

    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(dry_voice_path),
        "-i", str(ambient_music_path),
        "-filter_complex", complex_filter,
        "-map", "[final_master]",
        "-ar", str(voice_config["sample_rate"]),
        str(master_wav_path)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Convert to MP3
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(master_wav_path),
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        str(cache_master)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Export Manifest
    manifest_payload = {
        "version": "2.0",
        "title": script_data.get("title", ""),
        "brand": script_data.get("brand", voice_config["brand"]),
        "voice": voice_config["voice_id"],
        "total_duration_seconds": round(total_duration, 3),
        "total_frames": total_frames,
        "fps": voice_config["fps"],
        "scenes": scenes_meta
    }
    with open(cache_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest_payload, f, indent=2, ensure_ascii=False)

    shutil.copy(cache_master, PUBLIC_DIR / "shikhram-voiceover-master.mp3")
    shutil.copy(cache_manifest, PUBLIC_DIR / "narration-manifest.json")
    print(f"[SUCCESS] Audio pipeline complete for: {script_data.get('title')}")
    print(f"  Master MP3: {PUBLIC_DIR / 'shikhram-voiceover-master.mp3'}")
    print(f"  Manifest:   {PUBLIC_DIR / 'narration-manifest.json'}")

    return manifest_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Shikharam Yoga Dynamic Audio Generator")
    parser.add_argument("--script", "-s", type=str, default=str(DEFAULT_SCRIPT), help="Path to reel JSON script")
    parser.add_argument("--voice", "-v", type=str, default=None, help="Override voice ID (e.g. hi-IN-SwaraNeural)")
    args = parser.parse_args()

    process_audio(Path(args.script), voice_override=args.voice)
