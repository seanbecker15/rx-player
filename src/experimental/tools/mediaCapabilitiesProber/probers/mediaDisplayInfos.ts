/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import globalScope from "../../../../utils/global_scope";
import isNullOrUndefined from "../../../../utils/is_null_or_undefined";
import type { IMediaConfiguration } from "../types";
import { ProberStatus } from "../types";

/**
 * @param {Object} config
 * @returns {Promise}
 */
export default function probeMatchMedia(
  config: IMediaConfiguration,
): Promise<[ProberStatus]> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    if (typeof globalScope.matchMedia !== "function") {
      throw new Error(
        "MediaCapabilitiesProber >>> API_CALL: " + "matchMedia not available",
      );
    }
    if (
      isNullOrUndefined(config.display) ||
      config.display.colorSpace === undefined ||
      config.display.colorSpace.length === 0
    ) {
      throw new Error(
        "MediaCapabilitiesProber >>> API_CALL: " +
          "Not enough arguments for calling matchMedia.",
      );
    }

    const match = globalScope.matchMedia(`(color-gamut: ${config.display.colorSpace})`);
    if (match.media === "not all") {
      throw new Error(
        "MediaCapabilitiesProber >>> API_CALL: " +
          "Bad arguments for calling matchMedia.",
      );
    }

    const result: [ProberStatus] = [
      match.matches ? ProberStatus.Supported : ProberStatus.NotSupported,
    ];
    resolve(result);
  });
}
