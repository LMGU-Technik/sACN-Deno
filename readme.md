# sACN receiver in Deno.js

💡 This module can receive [DMX](https://en.wikipedia.org/wiki/DMX512) data sent
via [sACN](https://en.wikipedia.org/wiki/E1.31) from professional lighting
consoles (e.g. [ETC Eos](https://www.etcconnect.com/),
[Onyx](https://obsidiancontrol.com/)).

This is a Deno.js port of https://github.com/k-yle/sACN, but it is NOT API
compatible (especially events). Most parts are rewritten from ground up using
modern APIs (ArrayBuffer, TypedArray, AsyncIterator, ...). Unlike k-yle/sACN
this one natively supports merging multiple senders (HTP with Priorities).

## Install

```typescript
import {...} from "https://deno.land/x/sacn/mod.ts"
```

or

[@deno-plc/sacn ![JSR](https://jsr.io/badges/@deno-plc/sacn)](https://jsr.io/@deno-plc/sacn)

## Deno CLI flags

- `--unstable-net`, because UDP support in Deno is still unstable.
- `--allow-net`, this is a networking library ;-)

## Receiver API

```typescript
// see https://github.com/LMGU-Technik/sACN-Deno/tree/main/examples

import { globalToDmx, Receiver } from "https://deno.land/x/sacn/mod.ts";

const receiver = new Receiver({
    // options
});
await receiver.addUniverse(1);

for await (const [chan, value] of receiver) {
    const [univ, addr] = globalToDmx(chan);
    console.log(`Chan ${univ}/${addr} = ${value}`);
}
```

### `new Receiver(options: ReceiverOptions)`

```typescript
export interface ReceiverOptions {
    /**
     * @default 5568 // nearly every implementation uses this port
     */
    readonly port: number;
    /**
     * network interface to listen on,
     * @default "0.0.0.0" // listen to all interfaces
     */
    readonly iface: string;
    /**
     * drop all non-zero start code packets
     * @default true
     */
    readonly dmxAOnly: boolean;
}
```

### `Receiver.addUniverse(universe: number): Promise<boolean>`

Adds a universe to listen on. Returns `false` if already listening on the
specified one.

### `Receiver.removeUniverse(universe: number): Promise<boolean>`

Stops listening on universe. Returns `false` if not listening on the specified
one.

### `Receiver.[Symbol.asyncIterator](): AsyncIterator<[number,number]>`

Used to obtain value changes

Note: use only once

```typescript
for await (const [chan, value] of receiver) {
    // chan is a global address, this helper function can be used to split into universe and address
    const [univ, addr] = globalToDmx(chan);
    console.log(`Chan ${univ}/${addr} = ${value}`);
}
```

### `Receiver.onPacket(): AsyncGenerator<Packet>`

Advanced: Used to obtain bare packets

Note: use only once and not in conjunction with
`Receiver.[Symbol.asyncIterator]()`

```typescript
for await (const packet of receiver.onPacket()) {
    // do stuff ...
}
```

```typescript
interface Packet {
    cid: Uint8Array;
    priority: number;
    sequence: number;
    universe: number;
    data: Uint8Array;
    sourceLabel: string;
}
```

### `Receiver.[Symbol.dispose](): void` / `Receiver.dispose(): void`

Frees up resources. Supports
[`using` keyword](https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/#using-declarations-and-explicit-resource-management).

## Sender API

> Coming soon. Contributions welcome.

## Network Requirements

- Multicast must be enabled. sACN uses port `5568` on `239.255.x.x`
- Network infrastructure that supports at least 100Mbps (100BaseT)

## Protocol Docs

The Architecture for Control Networks (ACN) and derived protocols are created by
the Entertainment Services and Technology Association (ESTA).

- sACN is defined in [ANSI E1.31](./docs/E1.31-2018.pdf)
- RDMNet (currently not supported) is defined in
  [ANSI E1.33](./docs/E1.33-2019.pdf)

## Testing

- This software has been tested against [sACNView](https://sacnview.org/)
  (Third-party software) and [ETC Eos](https://www.etcconnect.com/) (Third-party
  software)

## License

(c) 2023 - 2024 Hans Schallmoser

Licensed under the terms of the GNU General public license (see LICENSE file)

Based on the work of Kyℓe Hensel: https://github.com/k-yle/sACN (Apache-2.0).
