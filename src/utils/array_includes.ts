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

/**
 * Array.prototype.includes ponyfill.
 * Returns ``true`` if the given array ``arr`` contains the element
 * ``searchElement``. false ``otherwise``.
 *
 * Inspired from MDN polyfill, but ponyfilled instead
 *
 * @example
 * ```js
 * arrayIncludes([1, 2, 3], 3);
 * // => true
 *
 * arrayIncludes([1, 2, 3], 7);
 * // => false
 *
 * const obj = { a: 4 };
 * arrayIncludes([obj, { b: 7 }, { a: 3 }], obj);
 * // => true
 *
 * // does not perform deep equality
 * arrayIncludes([{ a: 4 }, { b: 7 }, { a: 3 }], { a: 4 });
 * // => false
 *
 * // the third argument state the starting index. 0 if not set.
 *
 * arrayIncludes([1, 2, 3], 2, 1);
 * // => true
 *
 * arrayIncludes([1, 2, 3], 2, 2);
 * // => false
 * ```
 *
 * @param {Array} arr
 * @param {*} searchElement
 * @param {number} [fromIndex]
 * @returns {boolean}
 */
export default function arrayIncludes<T>(
  arr: T[],
  searchElement: T,
  fromIndex?: number,
): boolean {
  // eslint-disable-next-line no-restricted-properties, @typescript-eslint/unbound-method
  if (typeof Array.prototype.includes === "function") {
    // eslint-disable-next-line no-restricted-properties
    return arr.includes(searchElement, fromIndex);
  }

  const len = arr.length >>> 0;

  if (len === 0) {
    return false;
  }

  const n = (fromIndex as number) | 0;
  let k = n >= 0 ? Math.min(n, len - 1) : Math.max(len + n, 0);

  const areTheSame = (x: T, y: T) =>
    x === y ||
    // Viva las JavaScriptas!
    (typeof x === "number" && typeof y === "number" && isNaN(x) && isNaN(y));

  while (k < len) {
    if (areTheSame(arr[k], searchElement)) {
      return true;
    }
    k++;
  }

  return false;
}
