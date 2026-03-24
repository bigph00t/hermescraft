#!/usr/bin/env python3
# download-voices.py — Download all 8 Piper voice models to /workspace/models/piper/
import os
from huggingface_hub import hf_hub_download

VOICES = {
    "kristin-medium": "en/en_US/kristin/medium",
    "ryan-high": "en/en_US/ryan/high",
    "amy-medium": "en/en_US/amy/medium",
    "arctic-medium": "en/en_US/arctic/medium",
    "hfc_female-medium": "en/en_US/hfc_female/medium",
    "norman-medium": "en/en_US/norman/medium",
    "lessac-high": "en/en_US/lessac/high",
    "libritts_r-medium": "en/en_US/libritts_r/medium",
}

OUT_DIR = "/workspace/models/piper"
os.makedirs(OUT_DIR, exist_ok=True)

for name, hf_path in VOICES.items():
    fn = f"en_US-{name}"
    for ext in [".onnx", ".onnx.json"]:
        out_path = os.path.join(OUT_DIR, f"{fn}{ext}")
        if os.path.exists(out_path):
            print(f"Already have {fn}{ext}")
            continue
        try:
            downloaded = hf_hub_download(
                "rhasspy/piper-voices",
                f"{hf_path}/{fn}{ext}",
                local_dir=OUT_DIR,
            )
            # Move from nested dir to flat
            if downloaded != out_path and os.path.exists(downloaded):
                os.rename(downloaded, out_path)
            print(f"OK: {fn}{ext}")
        except Exception as e:
            print(f"FAIL: {fn}{ext}: {e}")

print("VOICES_DONE")
