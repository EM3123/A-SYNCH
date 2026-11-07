import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep native ONNX binaries and Kokoro's bundled voice files in Node, not
  // inside the browser bundle or the Next.js module graph.
  serverExternalPackages: ["kokoro-js", "@huggingface/transformers", "onnxruntime-node"],
};

export default config;
