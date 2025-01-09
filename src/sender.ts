/**
 * @license GPL-3.0-or-later
 * LMGU-Technik sACN-Deno
 *
 * Copyright (C) 2025 Felix Beckh
 * Copyright (C) 2025 Hans Schallmoser
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

import { multicastGroup } from "../lib/util.ts";
import { DEFAULT_CID } from "./constants.ts";
import { buildPacket, type Options } from "./packet.ts";

export interface SenderOptions {
    /** The universe to send to. Must be within 1-63999 */
    universe: number;
    /**
     * The multicast port to use. All professional consoles broadcast to the default port.
     * @default 5568
     */
    port?: number;
    /**
     * Allow multiple programs on your computer to send to the same sACN universe.
     * @default false
     */
    reuseAddr?: boolean;
    /**
     * How often the data should be re-sent (**in Hertz/Hz**), even if it hasn't changed.
     *
     * By default data will only be sent once (equivilant of setting `refreshRate: 0`).
     *
     * To re-send data 5 times per second (`5Hz`), set `refreshRate: 5`. This is equivilant to `200ms`.
     *
     * @default 0
     */
    minRefreshRate?: number;

    /** some options can be sepecified when you instantiate the sender, instead of sepecifying them on every packet */
    defaultPacketOptions?: Pick<
        Options,
        "cid" | "sourceLabel" | "priority"
    >;

    // IPv4 address of the network interface
    iface: string;

    /**
     * If you set this option to an IP address, then data will be sent
     * purely to this address, instead of the whole network.
     *
     * This option is not recommended and may not be supported by all devices.
     */
    useUnicastDestination?: string;
}

export class Sender {
    private socket: Deno.DatagramConn;
    readonly options: SenderOptions;

    // private readonly multicast = new Map<
    //     number,
    //     MulticastV4Membership | null
    // >();

    private sequence = 0;

    /**
     * this is normally a multicast address, but it could be
     * a unicast address if the user configures `useUnicastDestination`
     */
    readonly #destinationIp: string;

    public resendStatus = false;

    #loopId: number | undefined;

    /**
     * we keep track of the most recent value of every channel, so that we can
     * send it regulally if `refreshRate` != 0. `undefined` if nothing has been
     * sent yet.
     */
    // #latestPacketOptions: Omit<Options, 'sequence' | 'universe'> | undefined;

    #defaultPacketOptions: Pick<
        Options,
        "cid" | "sourceLabel" | "priority"
    >;

    constructor(options: SenderOptions) {
        this.options = options;

        this.#destinationIp = options.useUnicastDestination ||
            multicastGroup(options.universe);

        this.#defaultPacketOptions = {
            cid: DEFAULT_CID,
            sourceLabel: "sACN-Deno",
            priority: 100,
            ...options.defaultPacketOptions,
        };

        this.socket = Deno.listenDatagram({
            transport: "udp",
            port: this.options.port ?? 5568,
            reuseAddress: true,
            loopback: true, // loopback multicast packets
            hostname: this.options.iface,
        });
    }

    public send(data: Uint8Array) {
        const packet = buildPacket({
            ...this.#defaultPacketOptions,
            data,
            universe: this.options.universe,
            sequence: this.sequence,
        });
        this.sequence = (this.sequence + 1) % 256;
        if (this.#loopId) clearTimeout(this.#loopId);
        if (this.options.minRefreshRate) {
            this.#loopId = setTimeout(() => {
                this.send(data);
            }, 1000 / this.options.minRefreshRate);
        }
        this.socket.send(packet, {
            hostname: this.#destinationIp,
            port: this.options.port ?? 5568,
            transport: "udp",
        });
    }

    public close() {
        if (this.#loopId) clearTimeout(this.#loopId);
        this.socket.close();
    }
}
