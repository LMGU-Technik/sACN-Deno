export function multicastGroup(universe: number): string {
  if ((universe > 0 && universe <= 63999) || universe === 64214) {
    return `239.255.${universe >> 8}.${universe & 255}`;
  }
  throw new RangeError('universe must be between 1-63999');
}

export const inRange = (n: number): number =>
  Math.min(255, Math.max(Math.round(n), 0));

export function bit(bitt: 8 | 16 | 24 | 32, num: number): number[] {
  if (bitt % 8) throw new Error('num of bits must be divisible by 8');

  const chunks: number[] = [];
  for (let i = 0; i < bitt; i += 8) {
    chunks.unshift((num >> i) & 255);
  }
  return chunks;
}

export const empty = (len: number): number[] =>
  Array.from(new Uint8Array(new ArrayBuffer(len)));
