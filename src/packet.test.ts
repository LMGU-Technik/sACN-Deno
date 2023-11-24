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

import { assertEquals } from "https://deno.land/std@0.207.0/assert/mod.ts";
import { buildFlagsAndLength } from "./packet.ts";

Deno.test("Flags & Length", () => {
    assertEquals(
        buildFlagsAndLength(0, {
            data: new Uint8Array(513),
        }),
        638 | (0x7 << 12),
    );
});
