/* 
* LMGU-Technik sACN-Deno

* Copyright (C) 2023 Hans Schallmoser

* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.

* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.

* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { globalToDmx } from "../lib/dmxAddr.ts";
import { Receiver } from "../src/receiver.ts";

async function main() {
    const receiver = new Receiver();
    receiver.addUniverse(1);

    for await (const [chan, value] of receiver) {
        const [univ, addr] = globalToDmx(chan);
        console.log(`Chan ${univ}/${addr} = ${value}`);
    }
}
main().catch(err => {
    console.error(err);
});
