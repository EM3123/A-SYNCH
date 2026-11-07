// Read one complete WAV at a time. The server keeps generating the next sentence
// while the caller plays the current one, without waiting for the whole answer.
export async function* readSpeechStream(body: ReadableStream<Uint8Array>): AsyncGenerator<{ text: string; audio: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as { text?: unknown; audio?: unknown };
        if (typeof chunk.text !== 'string' || typeof chunk.audio !== 'string' || !chunk.audio) {
          throw new Error('Invalid speech chunk');
        }
        yield { text: chunk.text, audio: chunk.audio };
      }
      if (done) {
        if (pending.trim()) throw new Error('Incomplete speech chunk');
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
