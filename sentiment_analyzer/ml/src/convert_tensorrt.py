"""Optional wrapper around NVIDIA trtexec; requires a local NVIDIA/TensorRT installation."""
from __future__ import annotations
import argparse, shutil, subprocess
from pathlib import Path

def convert(onnx_path: str, engine_path: str, fp16: bool = True):
    executable = shutil.which("trtexec")
    if not executable:
        raise RuntimeError("trtexec was not found. Install NVIDIA TensorRT on a compatible GPU system.")
    command = [executable, f"--onnx={Path(onnx_path)}", f"--saveEngine={Path(engine_path)}", "--minShapes=input_ids:1x8,attention_mask:1x8", "--optShapes=input_ids:8x128,attention_mask:8x128", "--maxShapes=input_ids:32x256,attention_mask:32x256"]
    if fp16: command.append("--fp16")
    subprocess.run(command, check=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx", required=True)
    parser.add_argument("--engine", default="artifacts/tensorrt/sentiment.plan")
    parser.add_argument("--no-fp16", action="store_true")
    args = parser.parse_args()
    convert(args.onnx, args.engine, not args.no_fp16)
