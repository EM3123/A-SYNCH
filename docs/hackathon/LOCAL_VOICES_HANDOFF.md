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

Verified: typecheck; 54 evals; backend smoke; frontend build/lint; production
Next build with webpack; all four voices return HTTP 200 and valid 24 kHz mono
WAVs; browser voice selector; automatic spoken reply reaches Speaking; Stop
during preparation. Microphone permission and blocked-autoplay paths were not
retested in this change. Local model generation adds a few seconds of latency.
