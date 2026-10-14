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

/**
 * @file Support for the optional `visibleAt` layer property, which shows a layer only while the
 * global position along one or more dimensions is within a given voxel.  This is intended for data
 * that is stored as one layer per timepoint, e.g. `"visibleAt": {"t": 4}`.
 */

import type { CoordinateSpace } from "#src/coordinate_transform.js";
import { verifyObject } from "#src/util/json.js";

/**
 * Maps a dimension name to the voxel index at which a layer is visible.
 */
export type VisibleAt = Record<string, number>;

export function parseVisibleAt(obj: unknown): VisibleAt | undefined {
  if (obj === undefined || obj === null) return undefined;
  const parsed: VisibleAt = {};
  for (const [name, index] of Object.entries(verifyObject(obj))) {
    // Stricter than `verifyInt`, which would silently accept strings and truncate fractions.
    if (typeof index !== "number" || !Number.isInteger(index)) {
      throw new Error(
        `Expected integer for visibleAt dimension ${JSON.stringify(name)}, but received: ${JSON.stringify(index)}.`,
      );
    }
    parsed[name] = index;
  }
  return Object.keys(parsed).length === 0 ? undefined : parsed;
}

/**
 * Returns the voxel index containing `coordinate` along the specified dimension.
 */
function getVoxelIndex(
  coordinateSpace: CoordinateSpace,
  dimIndex: number,
  coordinate: number,
) {
  if (coordinateSpace.bounds.voxelCenterAtIntegerCoordinates[dimIndex]) {
    return Math.round(coordinate);
  }
  return Math.floor(coordinate);
}

/**
 * Returns whether a layer with the given `visibleAt` should be shown at `position`.
 *
 * Dimensions that are not present in the coordinate space are ignored, so a layer is only hidden
 * when a position is known and differs.
 */
export function isVisibleAtPosition(
  visibleAt: VisibleAt,
  coordinateSpace: CoordinateSpace,
  position: Float32Array,
) {
  if (!coordinateSpace.valid || position.length !== coordinateSpace.rank) {
    return true;
  }
  for (const [name, index] of Object.entries(visibleAt)) {
    const dimIndex = coordinateSpace.names.indexOf(name);
    if (dimIndex === -1) continue;
    if (
      getVoxelIndex(coordinateSpace, dimIndex, position[dimIndex]) !== index
    ) {
      return false;
    }
  }
  return true;
}

export interface VisibleAtLayer {
  visibleAt: VisibleAt | undefined;
  archived: boolean;
  setVisible(value: boolean): void;
}

/**
 * Sets the visibility of every layer that has `visibleAt` according to `position`.  Layers without
 * `visibleAt`, and archived layers, are left unchanged.
 */
export function updateVisibleAtLayers(
  layers: Iterable<VisibleAtLayer>,
  coordinateSpace: CoordinateSpace,
  position: Float32Array,
) {
  for (const layer of layers) {
    const { visibleAt } = layer;
    if (visibleAt === undefined || layer.archived) continue;
    layer.setVisible(isVisibleAtPosition(visibleAt, coordinateSpace, position));
  }
}
