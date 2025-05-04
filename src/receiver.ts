/**
 * @license GPL-3.0-or-later
 * LMGU-Technik sACN-Deno
 *
 * Copyright (C) 2023 - 2025 Hans Schallmoser
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { type Packet, parsePacket } from "./packet.ts";
import { multicastGroup } from "../lib/util.ts";
import { bufferEqual } from "../lib/util.ts";

/**
 * Configure the receiver
 */
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

/**
 * from Deno/std, unexported
 */
interface MulticastV4Membership {
    /** Leaves the multicast group. */
    leave: () => Promise<void>;
    /** Sets the multicast loopback option. If enabled, multicast packets will be looped back to the local socket. */
    setLoopback: (loopback: boolean) => Promise<void>;
    /** Sets the time-to-live of outgoing multicast packets for this socket. */
    setTTL: (ttl: number) => Promise<void>;
}

/**
 * Represents one sACN source (e.g. a light console or control software)
 */
export interface sACNSource {
    readonly cid: Uint8Array;
    readonly label: string;
    priority: number;
}

/**
 * sACN Receiver
 */
export class Receiver {
    readonly socket: Deno.DatagramConn;
    readonly options: ReceiverOptions;
    readonly cleanupInterval: number;
    constructor(options: Partial<ReceiverOptions> = {}) {
        this.options = {
            iface: "0.0.0.0",
            port: 5568,
            dmxAOnly: true,
            ...options,
        };

        this.socket = Deno.listenDatagram({
            transport: "udp",
            port: this.options.port,
            reuseAddress: true, // multiple receivers
            loopback: true, // loopback multicast packets
            hostname: this.options.iface,
        });

        // clear on dispose
        this.cleanupInterval = setInterval(() => {
            this.cleanupSources();
        }, 5000);
    }

    // universe => MulticastMembership
    private readonly multicast = new Map<
        number,
        MulticastV4Membership | null
    >();

    /**
     * returns true if successful, false if already listening to universe
     */
    public async addUniverse(universe: number): Promise<boolean> {
        if (this.multicast.has(universe)) {
            return false;
        }

        // prevent race condition when calling multiple times parallel
        this.multicast.set(universe, null);

        const membership: MulticastV4Membership = await this.socket
            .joinMulticastV4(
                multicastGroup(universe),
                this.options.iface,
            );
        this.multicast.set(universe, membership);
        return true;
    }

    /**
     * returns true if successful, false if not listening to universe
     */
    public async removeUniverse(universe: number): Promise<boolean> {
        const membership = this.multicast.get(universe);

        if (!membership) {
            return false;
        }

        this.multicast.set(universe, null);

        await membership!.leave();

        this.multicast.delete(universe);
        return true;
    }

    /**
     * all currently active sources
     */
    readonly sources: Set<sACNSource> = new Set<sACNSource>();

    /**
     * stores last packet of sources as performance.now() timestamp
     */
    private readonly sourceTimeout = new WeakMap<sACNSource, number>();

    /**
     * last sequence number for each source and universe
     * Map<Source, Map<Universe, Sequence>>
     */
    private readonly sequence = new WeakMap<sACNSource, Map<number, number>>();

    /**
     * Source by CID
     */
    getSource(cid: Uint8Array): sACNSource | null {
        for (const source of this.sources) {
            if (bufferEqual(source.cid, cid)) {
                return source;
            }
        }
        return null;
    }

    /**
     * get bare packets, checks sequence
     * USE ONLY ONCE AND NOT IN CONJUNCTION WITH `Receiver.[Symbol.asyncIterator]()`
     */
    async *onPacket(): AsyncGenerator<Packet, void, void> {
        for await (const [chunk] of this.socket) {
            try {
                const packet = parsePacket(chunk);
                const source: sACNSource = this.getSource(packet.cid) || {
                    cid: packet.cid,
                    label: packet.sourceLabel,
                    priority: packet.priority,
                };
                if (!this.sources.has(source)) {
                    this.sources.add(source);
                }

                this.sourceTimeout.set(source, performance.now());

                if (!this.sequence.has(source)) {
                    this.sequence.set(source, new Map());
                }

                const lastSeq =
                    this.sequence.get(source)!.get(packet.universe) ||
                    -1;

                if (lastSeq !== -1) {
                    const diff = packet.sequence - lastSeq;

                    if (diff === 1 || diff === -255) {
                        // fine
                    } else if (diff > 1 && diff < 5) {
                        console.warn(
                            `%c[sACN] [${source.label}] [U${packet.universe}] ${
                                diff - 1
                            } frame(s) dropped`,
                            "color: orange",
                        );
                    } else if (diff === 0) {
                        // duplicate
                    } else {
                        console.error(
                            `%c[sACN] [${source.label}] [U${packet.universe}] frame significantly out of order (${lastSeq} -> ${packet.sequence})`,
                            "color: red",
                        );
                    }
                }

                this.sequence.get(source)!.set(
                    packet.universe,
                    packet.sequence,
                );

                if (!this.options.dmxAOnly || packet.data[0] === 0) { // only 0-start codes // no RDM...
                    yield packet;
                }
            } catch (e) {
                console.error(`[sACN] ${e}`);
            }
        }
    }

    /**
     * removes all sources whose last packet was sent more than 5s ago,
     * called every 5s (interval setup in constructor)
     */
    private cleanupSources() {
        const clearPoint = performance.now() - 5000;
        for (const source of this.sources) {
            const lastTime = this.sourceTimeout.get(source);
            if (lastTime && lastTime < clearPoint) {
                this.sources.delete(source);
            }
        }
    }

    /**
     * sACNSource => (Universe => [Data, Priority])
     */
    private readonly lastSourceData = new WeakMap<
        sACNSource,
        Map<number, [Uint8Array, number]>
    >();

    /**
     * Chan(global) => Value
     */
    private readonly lastChanData = new Map<number, number>();

    /**
     * Merges Channels and returns all channels as ReadonlyMap
     * AsyncIterator<ReadonlyMap<number, number>>
     * Only use once and not in conjunction with `Receiver.[Symbol.asyncIterator]`
     */
    async *onChanData(): AsyncGenerator<ReadonlyMap<number, number>> {
        for await (const packet of this.onPacket()) {
            const packetSource = this.getSource(packet.cid)!;
            if (!this.lastSourceData.has(packetSource)) {
                this.lastSourceData.set(packetSource, new Map());
            }

            // store current packet
            this.lastSourceData.get(packetSource)!.set(packet.universe, [
                packet.data,
                packet.priority,
            ]);

            // groups sources by priority
            // Priority => Set<Sources>
            const sources = new Map<number, Set<sACNSource>>();

            let highestPriority = -1;

            for (const source of this.sources) {
                const lastSourceData = this.lastSourceData.get(source)?.get(
                    packet.universe,
                );
                if (lastSourceData) {
                    const [, priority] = lastSourceData;
                    if (priority < highestPriority) {
                        continue; // speed up
                    }

                    if (!sources.has(priority)) {
                        sources.set(priority, new Set());
                    }

                    sources.get(priority)!.add(source);

                    highestPriority = Math.max(highestPriority, priority);
                }
            }

            // we only need the highest priority sources
            const highPrioritySources = sources.get(highestPriority)!;

            // get their data
            const sourceData = [...highPrioritySources].map((source) =>
                this.lastSourceData.get(source)!.get(packet.universe)![0]
            );

            // speed up addr to globalAddr conversion
            const universeBase = (packet.universe - 1) * 512;

            let changed = false;

            for (let i = 1; i < 513; i++) {
                const globChan = universeBase + i;
                let highest = 0;
                for (const data of sourceData) {
                    if (data[i] > highest) {
                        highest = data[i];
                    }
                }
                const old = this.lastChanData.get(globChan) ?? -1;
                if (old !== highest) { // only update if changed
                    this.lastChanData.set(globChan, highest);

                    changed = true;
                }
            }

            if (changed)
                yield new Map(this.lastChanData) as ReadonlyMap<number, number>;
        }
    }

    /**
     * Merges Channels
     * AsyncIterator<[Chan(glob), Value]>
     * Only use once and not in conjunction with `Receiver.onChanData()`
     */
    async *[Symbol.asyncIterator](): AsyncIterator<readonly [number, number]> {
        let lastData: ReadonlyMap<number, number> | null = null;

        for await (const data of this.onChanData()) {
            for (const [chan, value] of data) {
                if (lastData && lastData.get(chan) === value) {
                    continue; // no change
                }

                yield [chan, value];
            }

            lastData = data;
        }
    }

    /**
     * cleanup
     */
    dispose() {
        clearInterval(this.cleanupInterval);
        this.socket.close();
    }

    /**
     * alias to .dispose(), needed for `using` keyword
     */
    [Symbol.dispose]() {
        this.dispose();
    }
}
