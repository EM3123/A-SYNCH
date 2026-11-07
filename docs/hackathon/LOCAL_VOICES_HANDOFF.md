# Local Kokoro voices — Nov 7

Part B now has Heart, Bella, Michael, Emma, and Browser voice in its reply-voice
picker. Kokoro runs on the local Next.js server using quantized CPU inference.
No TTS API key or Python service is needed. The first request downloads public
weights into ignored `.cache/kokoro/`; text/audio is kept in memory, not saved.

This branch builds on the restored `02dbe73` worktree snapshot. Upstream `main`
has newer conversational copy/hands-free work (`d65c21f`) in the same Part B
component. Do not replace that component wholesale when integrating: preserve
the new upstream conversation features and bring over the voice picker, local
audio lifecycle, `/api/speech`, `lib/speech/`, and native package configuration.
No shared AskResponse contract or Trust Layer behavior was changed here.

Playback cancellation covers Stop, mute, new question, microphone input,
voice switching, and unmount. Fetch/generation failure falls back to browser
speech; blocked autoplay offers a direct Play voice action on the prepared WAV.
Only fixed generic voices are accepted. VoxCPM2 is not installed.

Latency follow-up: the earlier implementation waited for the entire WAV.
Part B now preloads the model and requests `stream: true`; the endpoint sends
sentence-sized WAVs as NDJSON. The client plays the first short phrase while
the server generates the rest. Four seconds without playable audio triggers
browser speech for the remaining text. A warm-model sample improved first
playable audio from 11.53 seconds to 1.86 seconds. Generation speed still depends
on CPU load; total generation time was not reduced by the same factor.

Verified: typecheck; 58 evals; backend smoke; frontend build/lint; production
Next build with webpack; all four voices return HTTP 200 and valid 24 kHz mono
WAVs; browser voice selector; automatic spoken reply reaches Speaking; Stop
during preparation, including streamed playback; malformed/truncated stream
rejection and early first-chunk delivery. Browser fallback on a slow first
phrase was observed. Microphone permission and blocked-autoplay paths were not
retested in this change.
