#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import sys

import onnx
from onnx import checker
from onnx.utils import extract_model


def pick_name(candidates, available):
    for name in candidates:
        if name in available:
            return name
    return None


def mb(n):
    return n / 1024 / 1024


def main():
    ap = argparse.ArgumentParser(description="Extract TinyCLIP vision-only ONNX subgraph")
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--report")
    args = ap.parse_args()

    src = Path(args.input)
    dst = Path(args.output)
    if not src.exists():
        raise SystemExit(f"Input model not found: {src}")

    print(f"[TinyCLIP] Loading full ONNX: {src.name} ({mb(src.stat().st_size):.1f} MB)", flush=True)
    model = onnx.load(str(src), load_external_data=True)
    graph = model.graph
    graph_inputs = [x.name for x in graph.input]
    graph_outputs = [x.name for x in graph.output]

    print(f"[TinyCLIP] Graph inputs : {', '.join(graph_inputs)}", flush=True)
    print(f"[TinyCLIP] Graph outputs: {', '.join(graph_outputs)}", flush=True)

    image_input = pick_name(
        ["pixel_values", "image", "images", "input_pixels", "input_image"],
        graph_inputs,
    )
    image_output = pick_name(
        ["image_embeds", "image_features", "vision_model_output", "pooler_output"],
        graph_outputs,
    )

    if image_input is None:
        raise SystemExit("Could not find the image input tensor.")
    if image_output is None:
        raise SystemExit("Could not find the image embedding output tensor.")

    print(f"[TinyCLIP] Extracting subgraph: {image_input} -> {image_output}", flush=True)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    extract_model(str(src), str(dst), [image_input], [image_output])

    print("[TinyCLIP] Validating extracted ONNX...", flush=True)
    out_model = onnx.load(str(dst), load_external_data=True)
    checker.check_model(out_model)

    out_bytes = dst.stat().st_size
    saved_pct = (1 - out_bytes / src.stat().st_size) * 100
    report = {
        "input_model": str(src),
        "output_model": str(dst),
        "selected_input": image_input,
        "selected_output": image_output,
        "input_bytes": src.stat().st_size,
        "output_bytes": out_bytes,
        "reduction_percent": round(saved_pct, 2),
        "graph_inputs": [x.name for x in out_model.graph.input],
        "graph_outputs": [x.name for x in out_model.graph.output],
        "node_count": len(out_model.graph.node),
        "initializer_count": len(out_model.graph.initializer),
    }
    if args.report:
        Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"[TinyCLIP] Vision-only ONNX ready: {mb(out_bytes):.1f} MB "
        f"({saved_pct:.1f}% smaller than full model)",
        flush=True,
    )
    print(f"[TinyCLIP] Output: {dst}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr, flush=True)
        raise
