/**
 * @license GPL-3.0-or-later
 * LMGU-Technik sACN-Deno
 *
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

import { Sender } from "../src/sender.ts";

function main() {
    const sender = new Sender({
        universe: 1,
        iface: "172.19.0.1",

        minRefreshRate: 5,
    });

    const data = new Uint8Array(513);

    crypto.getRandomValues(data);

    data[0] = 0x00;

    sender.send(data);
}
main();
