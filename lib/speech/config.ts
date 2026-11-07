// Generic synthetic voices, never a recording or clone of a teammate.
export const KOKORO_VOICES = [
  { id: "af_heart", label: "Heart · American" },
  { id: "af_bella", label: "Bella · American" },
  { id: "am_michael", label: "Michael · American" },
  { id: "bf_emma", label: "Emma · British" },
] as const;

export type KokoroVoice = (typeof KOKORO_VOICES)[number]["id"];
export const DEFAULT_VOICE: KokoroVoice = "af_heart";
export const MAX_SPEECH_CHARACTERS = 6000;

export function isKokoroVoice(value: unknown): value is KokoroVoice {
  return KOKORO_VOICES.some((voice) => voice.id === value);
}
