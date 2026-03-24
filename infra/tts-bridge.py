# tts-bridge.py — Watch Minecraft Docker logs, synthesize speech with Piper, POST PCM to TTS plugin

import subprocess
import re
import threading
import queue
import requests
import json
import os
import sys
import base64
import time
import numpy as np
from scipy.signal import resample_poly
from piper import PiperVoice

# ── Constants ──

AGENT_NAMES = frozenset({"luna", "max", "ivy", "rust", "ember", "flint", "sage", "wren"})

PLUGIN_URL = os.environ.get("TTS_PLUGIN_URL", "http://localhost:8765/tts")

_default_voices_config = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts-voices.json")
VOICES_CONFIG = os.environ.get("TTS_VOICES_CONFIG") or _default_voices_config

MC_CONTAINER = os.environ.get("MC_CONTAINER", "hermescraft-server")
MC_LOG_FILE = os.environ.get("MC_LOG_FILE", "")  # If set, tail this file instead of docker logs

# Paper server chat log format: [HH:MM:SS INFO]: <playername> message text here
CHAT_RE = re.compile(r'\[.*?INFO\].*?<(\w+)> (.+)')

# ── Voice loading ──
# Load ALL voice models at startup — PiperVoice.load() takes 200-500ms per model.
# Never load per-request.

def _load_voices(config_path):
    voices = {}
    try:
        with open(config_path) as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"[tts] ERROR: voices config not found: {config_path}", flush=True)
        return voices
    except json.JSONDecodeError as e:
        print(f"[tts] ERROR: invalid JSON in voices config: {e}", flush=True)
        return voices

    for agent, model_path in config.items():
        if not os.path.isfile(model_path):
            print(f"[tts] WARNING: model file missing for {agent}: {model_path} — skipping", flush=True)
            continue
        try:
            voices[agent] = PiperVoice.load(model_path)
            print(f"[tts] Loaded voice for {agent}: {model_path}", flush=True)
        except Exception as e:
            print(f"[tts] WARNING: failed to load voice for {agent}: {e} — skipping", flush=True)

    return voices


# ── Synthesis ──

def synthesize_48k(voice, text):
    """Synthesize text with the given PiperVoice and resample from 22050Hz to 48000Hz.

    Returns raw 16-bit mono PCM bytes at 48000Hz.
    """
    # Concatenate all audio chunks from Piper (22050Hz 16-bit mono)
    raw = b"".join(c.audio_int16_bytes for c in voice.synthesize(text))

    # Convert to float32 for resampling
    samples_22k = np.frombuffer(raw, dtype=np.int16).astype(np.float32)

    # Resample 22050 -> 48000 Hz
    # 48000/22050 = 160/147 (fully reduced fraction)
    # IMPORTANT: use the reduced fraction, NOT up=48000, down=22050 — that allocates a huge filter
    samples_48k = resample_poly(samples_22k, up=160, down=147)

    return samples_48k.astype(np.int16).tobytes()


# ── Worker thread ──
# Bounded queue prevents memory buildup if synthesis can't keep up.

job_queue = queue.Queue(maxsize=32)


def _worker(voices):
    """Synthesis worker: dequeue (agent, text) jobs, synthesize, POST to plugin."""
    while True:
        try:
            agent, text = job_queue.get()
            try:
                voice = voices[agent]
                pcm = synthesize_48k(voice, text)
                encoded = base64.b64encode(pcm).decode("ascii")
                payload = {"agent": agent, "pcm_b64": encoded}

                try:
                    resp = requests.post(PLUGIN_URL, json=payload, timeout=5.0)
                    print(
                        f"[tts] {agent}: '{text[:50]}{'...' if len(text) > 50 else ''}'"
                        f" -> {len(pcm)} bytes, HTTP {resp.status_code}",
                        flush=True,
                    )
                except requests.RequestException as e:
                    print(f"[tts] ERROR posting audio for {agent}: {e}", flush=True)

            except Exception as e:
                print(f"[tts] ERROR synthesizing for {agent}: {e}", flush=True)
            finally:
                job_queue.task_done()

        except Exception as e:
            # Catch-all to keep the worker alive
            print(f"[tts] ERROR in worker loop: {e}", flush=True)


# ── Log tail ──

def _tail_logs(voices):
    """Tail MC server logs and enqueue chat messages from known agents."""
    while True:
        try:
            if MC_LOG_FILE:
                print(f"[tts] Tailing log file: {MC_LOG_FILE}", flush=True)
                proc = subprocess.Popen(
                    ["tail", "-n", "0", "-F", MC_LOG_FILE],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                )
            else:
                print(f"[tts] Connecting to Docker logs: {MC_CONTAINER}", flush=True)
                proc = subprocess.Popen(
                    ["docker", "logs", "-f", MC_CONTAINER],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )

            for line in proc.stdout:
                m = CHAT_RE.search(line)
                if not m:
                    continue
                sender = m.group(1).lower()
                message = m.group(2).strip()

                if sender not in AGENT_NAMES:
                    continue
                if sender not in voices:
                    # Agent is known but voice model was not loaded (missing file)
                    continue

                try:
                    job_queue.put_nowait((sender, message))
                except queue.Full:
                    print(
                        f"[tts] WARNING: Queue full, dropping message from {sender}",
                        flush=True,
                    )

            # Subprocess exited — MC server may not be ready yet
            rc = proc.wait()
            src = MC_LOG_FILE or MC_CONTAINER
            print(
                f"[tts] Log source process exited (rc={rc}, src={src}). Retrying in 5s...",
                flush=True,
            )

        except FileNotFoundError:
            print("[tts] ERROR: 'docker' command not found. Retrying in 5s...", flush=True)
        except Exception as e:
            print(f"[tts] ERROR in log tail: {e}. Retrying in 5s...", flush=True)

        time.sleep(5)


# ── Main ──

def main():
    print("[tts] HermesCraft TTS Bridge", flush=True)
    print(f"[tts] Voices config: {VOICES_CONFIG}", flush=True)
    print(f"[tts] Plugin URL: {PLUGIN_URL}", flush=True)
    print(f"[tts] MC container: {MC_CONTAINER}", flush=True)
    print(f"[tts] Loading voice models...", flush=True)

    voices = _load_voices(VOICES_CONFIG)

    print(f"[tts] Loaded {len(voices)} voice models", flush=True)

    if not voices:
        print(
            "[tts] ERROR: No voice models loaded. Check tts-voices.json and model paths. Exiting.",
            flush=True,
        )
        sys.exit(1)

    # Start synthesis worker thread (daemon — exits with main process)
    worker_thread = threading.Thread(target=_worker, args=(voices,), daemon=True)
    worker_thread.start()
    print("[tts] Worker thread started", flush=True)

    # Enter log tail loop (runs forever, retries on failure)
    try:
        _tail_logs(voices)
    except KeyboardInterrupt:
        print("\n[tts] Interrupted — shutting down.", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
