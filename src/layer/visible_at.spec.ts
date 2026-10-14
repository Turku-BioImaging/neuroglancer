/**
 * @license
 * Copyright 2026 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect } from "vitest";
import { makeCoordinateSpace } from "#src/coordinate_transform.js";
import type { VisibleAtLayer } from "#src/layer/visible_at.js";
import {
  isVisibleAtPosition,
  parseVisibleAt,
  updateVisibleAtLayers,
} from "#src/layer/visible_at.js";

function makeSpace(voxelCenterAtIntegerCoordinates: boolean) {
  return makeCoordinateSpace({
    names: ["t", "z"],
    units: ["s", "m"],
    scales: Float64Array.of(10, 1e-6),
    bounds: {
      lowerBounds: Float64Array.of(0, 0),
      upperBounds: Float64Array.of(11, 100),
      voxelCenterAtIntegerCoordinates: [
        voxelCenterAtIntegerCoordinates,
        voxelCenterAtIntegerCoordinates,
      ],
    },
  });
}

describe("parseVisibleAt", () => {
  it("returns undefined when absent or empty", () => {
    expect(parseVisibleAt(undefined)).toBeUndefined();
    expect(parseVisibleAt(null)).toBeUndefined();
    expect(parseVisibleAt({})).toBeUndefined();
  });

  it("parses dimension indices", () => {
    expect(parseVisibleAt({ t: 4 })).toEqual({ t: 4 });
    expect(parseVisibleAt({ t: 4, z: 0 })).toEqual({ t: 4, z: 0 });
  });

  it("rejects invalid values", () => {
    expect(() => parseVisibleAt({ t: "4" })).toThrow();
    expect(() => parseVisibleAt({ t: 1.5 })).toThrow();
    expect(() => parseVisibleAt([4])).toThrow();
    expect(() => parseVisibleAt(4)).toThrow();
  });
});

describe("isVisibleAtPosition", () => {
  it("matches the voxel containing the position (voxel center at +0.5)", () => {
    const space = makeSpace(false);
    expect(isVisibleAtPosition({ t: 4 }, space, Float32Array.of(4.5, 0))).toBe(
      true,
    );
    expect(isVisibleAtPosition({ t: 4 }, space, Float32Array.of(4, 0))).toBe(
      true,
    );
    expect(isVisibleAtPosition({ t: 4 }, space, Float32Array.of(5.5, 0))).toBe(
      false,
    );
  });

  it("matches the nearest integer (voxel center at integer)", () => {
    const space = makeSpace(true);
    expect(isVisibleAtPosition({ t: 4 }, space, Float32Array.of(4, 0))).toBe(
      true,
    );
    expect(isVisibleAtPosition({ t: 4 }, space, Float32Array.of(4.4, 0))).toBe(
      true,
    );
    expect(isVisibleAtPosition({ t: 4 }, space, Float32Array.of(4.6, 0))).toBe(
      false,
    );
  });

  it("requires all listed dimensions to match", () => {
    const space = makeSpace(true);
    expect(
      isVisibleAtPosition({ t: 4, z: 7 }, space, Float32Array.of(4, 7)),
    ).toBe(true);
    expect(
      isVisibleAtPosition({ t: 4, z: 7 }, space, Float32Array.of(4, 8)),
    ).toBe(false);
  });

  it("does not hide layers when the position cannot be evaluated", () => {
    const space = makeSpace(true);
    expect(isVisibleAtPosition({ q: 4 }, space, Float32Array.of(0, 0))).toBe(
      true,
    );
    expect(isVisibleAtPosition({ t: 4 }, space, new Float32Array(0))).toBe(
      true,
    );
    const invalid = makeCoordinateSpace({
      valid: false,
      names: ["t", "z"],
      units: ["s", "m"],
      scales: Float64Array.of(10, 1e-6),
    });
    expect(isVisibleAtPosition({ t: 4 }, invalid, Float32Array.of(0, 0))).toBe(
      true,
    );
  });
});

describe("updateVisibleAtLayers", () => {
  function makeLayer(
    visibleAt: Record<string, number> | undefined,
    visible = true,
    archived = false,
  ) {
    const layer: VisibleAtLayer & { visible: boolean; listed: boolean } = {
      visibleAt,
      archived,
      visible,
      listed: true,
      setVisibleAtMatch(match: boolean) {
        layer.visible = match;
        layer.listed = match;
      },
    };
    return layer;
  }

  it("shows only the layer for the current timepoint", () => {
    const space = makeSpace(true);
    const layers = [0, 1, 2].map((t) => makeLayer({ t }));
    updateVisibleAtLayers(layers, space, Float32Array.of(1, 0));
    expect(layers.map((l) => l.visible)).toEqual([false, true, false]);
    expect(layers.map((l) => l.listed)).toEqual([false, true, false]);
    updateVisibleAtLayers(layers, space, Float32Array.of(2, 0));
    expect(layers.map((l) => l.visible)).toEqual([false, false, true]);
  });

  it("leaves layers without visibleAt and archived layers unchanged", () => {
    const space = makeSpace(true);
    const plainHidden = makeLayer(undefined, false);
    const plainShown = makeLayer(undefined, true);
    const archived = makeLayer({ t: 0 }, false, true);
    updateVisibleAtLayers(
      [plainHidden, plainShown, archived],
      space,
      Float32Array.of(0, 0),
    );
    expect(plainHidden.visible).toBe(false);
    expect(plainShown.visible).toBe(true);
    expect(archived.visible).toBe(false);
  });
});
