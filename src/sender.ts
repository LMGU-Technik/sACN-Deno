import { multicastGroup } from "../lib/util.ts";
import { buildPacket, type Options } from "./packet.ts";

export interface SenderOptions {
    /** The universe to send to. Must be within 1-63999 */
    universe: number;
    /**
     * The multicast port to use. All professional consoles broadcast to the default port.
     * @default 5568
     */
    port: number;
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
      'cid' | 'sourceLabel' | 'priority' | 'useRawDmxValues'
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

export class Sender {
    private socket: Deno.DatagramConn;
    readonly options: SenderOptions;

    private readonly multicast = new Map<
        number,
        MulticastV4Membership | null
    >();

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
    #latestPacketOptions: Omit<Options, 'sequence' | 'universe'> | undefined;

    constructor(options: SenderOptions) {
        this.options = options
  
        this.#destinationIp = options.useUnicastDestination || multicastGroup(options.universe);

        this.socket = Deno.listenDatagram({
            transport: "udp",
            port: this.options.port,
            reuseAddress: true, // multiple receivers
            loopback: true, // loopback multicast packets
            hostname: this.options.iface,
        });

        if (options.minRefreshRate) {
            this.#loopId = setInterval(() => this.reSend(), 1000 / options.minRefreshRate);
        }
    }

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

    public send(packet: Omit<Options, 'sequence' | 'universe'>): Promise<number> {
        const finalPacket = { ...this.options.defaultPacketOptions, ...packet };
        this.#latestPacketOptions = finalPacket;
        const array = buildPacket({
            ...finalPacket,
            universe: this.options.universe,
            sequence: this.sequence
        });
        this.sequence = (this.sequence + 1) % 256;
        return this.socket.send(array, {hostname:(this.#destinationIp),port:(this.options.port),transport:"udp"});
    }

    private reSend() {
        if (this.#latestPacketOptions) {
            this.send(this.#latestPacketOptions)
                .then(() => {
                    this.updateResendStatus(true);
                })
                .catch(() => {
                    this.updateResendStatus(false);
                });
        }
    }

    private updateResendStatus(success: boolean) {
        if (success !== this.resendStatus) {
            this.resendStatus = success;
        }
    }

    public close(): this {
        // if (this.#loopId) clearTimeout(this.#loopId);
        this.socket.close();
        return this;
    }
}