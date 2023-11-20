import { Packet, parsePacket } from './packet.ts';
import { multicastGroup } from '../lib/util.ts';
import { bufferEqual } from "../lib/util.ts";

export interface ReceiverOptions {
    readonly port: number;
    readonly iface: string;
    readonly dmxAOnly: boolean;
}

export type Universe = number;

// from Deno // unexported
interface MulticastV4Membership {
    /** Leaves the multicast group. */
    leave: () => Promise<void>;
    /** Sets the multicast loopback option. If enabled, multicast packets will be looped back to the local socket. */
    setLoopback: (loopback: boolean) => Promise<void>;
    /** Sets the time-to-live of outgoing multicast packets for this socket. */
    setTTL: (ttl: number) => Promise<void>;
}

export interface ReceiverPacket {
    readonly rawPacket: Packet;
    readonly universe: number;
    readonly data: Uint8Array;
}

export interface sACNSource {
    readonly cid: Uint8Array,
    readonly label: string,
    priority: number,
}

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

        this.cleanupInterval = setInterval(() => {
            this.cleanupSources();
        }, 5000);
    }

    private readonly multicast = new Map<Universe, MulticastV4Membership>();
    public async addUniverse(universe: number) {
        if (this.multicast.has(universe))
            return false;

        const membership: MulticastV4Membership = await this.socket.joinMulticastV4(multicastGroup(universe), this.options.iface);
        this.multicast.set(universe, membership);
        return true;
    }
    public async removeUniverse(universe: number) {
        if (!this.multicast.has(universe))
            return false;

        await this.multicast.get(universe)!.leave();
        this.multicast.delete(universe);
        return true;
    }

    readonly sources = new Set<sACNSource>();
    private readonly sourceTimeout = new WeakMap<sACNSource, number>();
    private readonly sequence = new WeakMap<sACNSource, Map<number, number>>();

    getSource(cid: Uint8Array) {
        for (const source of this.sources) {
            if (bufferEqual(source.cid, cid))
                return source;
        }
        return null;
    }

    async *onPacket(): AsyncGenerator<Packet, void, void> {
        for await (const [chunk] of this.socket) {
            const packet = parsePacket(chunk);
            const source: sACNSource = this.getSource(packet.cid) || {
                cid: packet.cid,
                label: packet.sourceLabel,
                priority: packet.priority,
            };
            if (!this.sources.has(source))
                this.sources.add(source);

            this.sourceTimeout.set(source, performance.now());

            if (!this.sequence.has(source))
                this.sequence.set(source, new Map());

            const lastSeq = this.sequence.get(source)!.get(packet.universe) || -1;

            if (lastSeq !== -1) {
                const diff = packet.sequence - lastSeq;

                if (diff === 1 || diff === -255) {
                    // fine
                } else if (diff > 1 && diff < 5) {
                    console.warn(`%c[sACN] [${source.label}] [U${packet.universe}] ${diff - 1} frame(s) dropped`, "color: orange");
                } else {
                    console.error(`%c[sACN] [${source.label}] [U${packet.universe}] frame significantly out of order (${lastSeq} -> ${packet.sequence})`, "color: red");
                }
            }

            this.sequence.get(source)!.set(packet.universe, packet.sequence);

            if (!this.options.dmxAOnly || packet.data[0] === 0) // only 0-start codes // no RDM...
                yield packet;
        }
    }

    private cleanupSources() {
        const clearPoint = performance.now() - 5000;
        for (const source of this.sources) {
            const lastTime = this.sourceTimeout.get(source);
            if (lastTime && lastTime < clearPoint)
                this.sources.delete(source);
        }
    }

    private readonly lastSourceData = new WeakMap<sACNSource, Map<number, [Uint8Array, number]>>();
    private readonly lastChanData = new Map<number, number>();

    async *[Symbol.asyncIterator]() {
        for await (const packet of this.onPacket()) {
            const packetSource = this.getSource(packet.cid)!;
            if (!this.lastSourceData.has(packetSource))
                this.lastSourceData.set(packetSource, new Map());

            this.lastSourceData.get(packetSource)!.set(packet.universe, [packet.data, packet.priority]);

            const sources = new Map<number, Set<sACNSource>>();

            let highestPriority = -1;

            for (const source of this.sources) {
                const lastSourceData = this.lastSourceData.get(source)?.get(packet.universe);
                if (lastSourceData) {
                    const [, priority] = lastSourceData;
                    if (priority < highestPriority)
                        continue; // speed up

                    if (!sources.has(priority))
                        sources.set(priority, new Set());

                    sources.get(priority)!.add(source);

                    highestPriority = Math.max(highestPriority, priority);
                }
            }

            const highPrioritySources = sources.get(highestPriority)!;

            const sourceData = [...highPrioritySources].map(source => this.lastSourceData.get(source)!.get(packet.universe)![0]);

            const universeBase = (packet.universe - 1) * 512;

            for (let i = 1; i < 513; i++) {
                const globChan = universeBase + i;
                let highest = 0;
                for (const data of sourceData) {
                    if (data[i] > highest) {
                        highest = data[i];
                    }
                }
                const old = this.lastChanData.get(globChan) ?? -1;
                if (old !== highest) {
                    this.lastChanData.set(globChan, highest);
                    yield [globChan, highest] as const;
                }
            }
        }
    }

    dispose() {
        clearInterval(this.cleanupInterval);
        this.socket.close();
    }

    [Symbol.dispose]() {
        this.dispose();
    }
}
