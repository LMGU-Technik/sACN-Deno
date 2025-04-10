/**
 * @license GPL-3.0-or-later
 * LMGU-Technik sACN-Deno
 *
 * Copyright (C) 2023 Hans Schallmoser
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

import { assertEquals } from "https://deno.land/std@0.207.0/assert/mod.ts";
import { multicastGroup } from "./util.ts";

Deno.test("multicastAddr", () => {
    assertEquals(multicastGroup(1), "239.255.0.1");
    assertEquals(multicastGroup(0xFF), "239.255.0.255");
    assertEquals(multicastGroup(0x1FF), "239.255.1.255");
});
