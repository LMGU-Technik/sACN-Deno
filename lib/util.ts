export function multicastGroup(universe: number): string {
    if ((universe > 0 && universe <= 63999) || universe === 64214) {
        return `239.255.${universe >> 8}.${universe & 0xFF}`;
    }
    throw new RangeError('universe must be between 1-63999');
}

export function bufferEqual(a: Uint8Array, b: Uint8Array) {
    if (a.byteLength != b.byteLength)
        return false;

    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i])
            return false;
    }

    return true;
}
