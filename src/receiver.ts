import { parsePacket } from './packet.ts';
import { multicastGroup } from './util.ts';

export async function* sACNReceiver(universe: number, options: Partial<ReceiverOptions> = {}) {
    const cfg = {
        iface: "0.0.0.0",
        port: 5568,
        ...options,
    };
    const socket = Deno.listenDatagram({
        transport: "udp",
        port: cfg.port,
        reuseAddress: true, // multiple receivers
        loopback: true, // loopback multicast packets
        hostname: cfg.iface,
    });

    await socket.joinMulticastV4(multicastGroup(universe), cfg.iface);

    for await (const [chunk] of socket) {
        const packet = parsePacket(chunk);

        yield packet;
    }
}

export interface ReceiverOptions {
    port: number;
    iface: string;
}

export class Receiver {
    // private socket: Deno.DatagramConn;

    private lastSequence = new Map<string, number>();

    readonly options: ReceiverOptions;

    constructor(public readonly universe: number, options: Partial<ReceiverOptions> = {}) {
        this.options = {
            port: 5568,
            iface: "",
            ...options
        };


        // this.socket.on('message', (msg, rinfo) => {
        //     try {
        //         const packet = new Packet(msg, rinfo.address);

        //         // somehow we received a packet for a universe we're not listening to
        //         // silently drop this packet
        //         if (!this.universes.includes(packet.universe)) return;

        //         // we keep track of the last sequence per sender and per universe (see #37)
        //         const key = packet.cid.toString('utf8') + packet.universe;

        //         const outOfOrder =
        //             this.lastSequence[key] &&
        //             Math.abs(this.lastSequence[key]! - packet.sequence) > 20;

        //         const oldSequence = this.lastSequence[key];
        //         this.lastSequence[key] = packet.sequence === 255 ? -1 : packet.sequence;

        //         if (outOfOrder) {
        //             throw new Error(
        //                 `Packet significantly out of order in universe ${packet.universe} from ${packet.sourceName} (${oldSequence} -> ${packet.sequence})`,
        //             );
        //         }

        //         this.emit('packet', packet);
        //     } catch (err) {
        //         const event =
        //             err instanceof AssertionError
        //                 ? 'PacketCorruption'
        //                 : 'PacketOutOfOrder';
        //         this.emit(event, err);
        //     }
        // });
        // this.socket.on('error', (ex) => this.emit('error', ex));
        // this.socket.bind(this.port, () => {
        //     for (const uni of this.universes) {
        //         try {
        //             this.socket.addMembership(multicastGroup(uni), this.iface);
        //         } catch (err) {
        //             this.emit('error', err); // emit errors from socket.addMembership
        //         }
        //     }
        // });
    }

    async listen() {

    }

    // [[Symbol.asyncIterator]]();

    // public addUniverse(universe: number): this {
    //     // already listening to this one; do nothing
    //     if (this.universes.includes(universe)) return this;

    //     this.socket.addMembership(multicastGroup(universe), this.iface);
    //     this.universes.push(universe);
    //     return this;
    // }

    // public removeUniverse(universe: number): this {
    //     // not listening to this one; do nothing
    //     if (!this.universes.includes(universe)) return this;

    //     this.socket.dropMembership(multicastGroup(universe), this.iface);
    //     this.universes = this.universes.filter((n) => n !== universe);
    //     return this;
    // }

    // public close(callback?: () => void): this {
    //     this.socket.close(callback);
    //     return this;
    // }
}
