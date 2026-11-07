import path from "node:path";
import { KokoroTTS } from "kokoro-js";
import { env, RawAudio } from "@huggingface/transformers";
import type { KokoroVoice } from "./config";
import { speechChunks } from "./text";

type SpeechRuntime = { model?: Promise<KokoroTTS>; busy: boolean };
const localGlobal = globalThis as typeof globalThis & { asynchSpeech?: SpeechRuntime };
const state = localGlobal.asynchSpeech ??= { busy: false };

export class SpeechBusyError extends Error {}

function loadModel(): Promise<KokoroTTS> {
  if (!state.model) {
    // Only model weights are cached. Conversation text/audio is never written.
    env.cacheDir = path.resolve(process.cwd(), ".cache/kokoro");
    state.model = KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "cpu",
    }).catch((error: unknown) => {
      state.model = undefined;
      throw error;
    });
  }
  return state.model;
}

export async function synthesizeSpeech(text: string, voice: KokoroVoice, signal?: AbortSignal): Promise<ArrayBuffer> {
  // A local demo needs one bounded job, not unbounded concurrent CPU inference.
  if (state.busy) throw new SpeechBusyError("Local voice is busy; browser speech is available.");
  state.busy = true;
  try {
    signal?.throwIfAborted();
    const model = await loadModel();
    signal?.throwIfAborted();
    const waves: Float32Array[] = [];
    for (const chunk of speechChunks(text)) {
      signal?.throwIfAborted();
      const result = await model.generate(chunk, { voice, speed: 1.04 });
      signal?.throwIfAborted();
      waves.push(result.audio);
    }
    const waveform = new Float32Array(waves.reduce((size, wave) => size + wave.length, 0));
    let offset = 0;
    for (const wave of waves) {
      waveform.set(wave, offset);
      offset += wave.length;
    }
    if (!waveform.length) throw new Error("Local voice returned no audio.");
    return new RawAudio(waveform, 24000).toWav();
  } finally {
    state.busy = false;
  }
}
