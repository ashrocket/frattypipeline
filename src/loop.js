// Seamless loops cut from a longer recording. The samples just past the loop's end are
// crossfaded (equal power) into its first few milliseconds, so wrapping around continues the
// waveform instead of clicking. Pure on Float32Arrays; works with any AudioContext.
export function loopSamples(data, start, length, fade) {
  const out = data.slice(start, start + length);
  for (let i = 0; i < fade && start + length + i < data.length; i++) {
    const a = (i / fade) * (Math.PI / 2);
    out[i] = data[start + i] * Math.sin(a) + data[start + length + i] * Math.cos(a);
  }
  return out;
}
export function seamlessLoop(ctx, buffer, startS, endS, fadeS = 0.012) {
  const rate = buffer.sampleRate,
    start = Math.round(startS * rate),
    length = Math.round((endS - startS) * rate),
    fade = Math.round(fadeS * rate),
    out = ctx.createBuffer(buffer.numberOfChannels, length, rate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) out.copyToChannel(loopSamples(buffer.getChannelData(ch), start, length, fade), ch);
  return out;
}
