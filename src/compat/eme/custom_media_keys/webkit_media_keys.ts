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

import EventEmitter from "../../../utils/event_emitter";
import noop from "../../../utils/noop";
import startsWith from "../../../utils/starts_with";
import wrapInPromise from "../../../utils/wrapInPromise";
import type { IMediaElement } from "../../browser_compatibility_types";
import getWebKitFairplayInitData from "../get_webkit_fairplay_initdata";
import type {
  ICustomMediaKeys,
  ICustomMediaKeySession,
  ICustomMediaKeyStatusMap,
  IMediaKeySessionEvents,
} from "./types";
import type { IWebKitMediaKeys } from "./webkit_media_keys_constructor";
import { WebKitMediaKeysConstructor } from "./webkit_media_keys_constructor";

export interface ICustomWebKitMediaKeys {
  _setVideo: (videoElement: IMediaElement) => Promise<unknown>;
  createSession(mimeType: string, initData: Uint8Array): ICustomMediaKeySession;
  setServerCertificate(setServerCertificate: BufferSource): Promise<void>;
}

/**
 * Check if keyType is for fairplay DRM
 * @param {string} keyType
 * @returns {boolean}
 */
function isFairplayKeyType(keyType: string): boolean {
  return startsWith(keyType, "com.apple.fps");
}

/**
 * Set media keys on video element using native HTMLMediaElement
 * setMediaKeys from WebKit.
 * @param {HTMLMediaElement} elt
 * @param {Object|null} mediaKeys
 * @returns {Promise}
 */
function setWebKitMediaKeys(elt: IMediaElement, mediaKeys: unknown): Promise<unknown> {
  return wrapInPromise(() => {
    if (elt.webkitSetMediaKeys === undefined) {
      throw new Error("No webKitMediaKeys API.");
    }
    elt.webkitSetMediaKeys(mediaKeys);
  });
}

/**
 * On Safari browsers (>= 9), there are specific webkit prefixed APIs for cyphered
 * content playback. Standard EME APIs are therefore available since Safari 12.1, but they
 * don't allow to play fairplay cyphered content.
 *
 * This class implements a standard EME API polyfill that wraps webkit prefixed Safari
 * EME custom APIs.
 */
class WebkitMediaKeySession
  extends EventEmitter<IMediaKeySessionEvents>
  implements ICustomMediaKeySession
{
  public readonly closed: Promise<void>;
  public expiration: number;
  public keyStatuses: ICustomMediaKeyStatusMap;

  private readonly _videoElement: IMediaElement;
  private readonly _keyType: string;
  private _nativeSession: undefined | MediaKeySession;
  private _serverCertificate: Uint8Array | undefined;

  private _closeSession: () => void;
  private _unbindSession: () => void;

  /**
   * @param {HTMLMediaElement} mediaElement
   * @param {string} keyType
   * @param {Uint8Array | undefined} serverCertificate
   */
  constructor(
    mediaElement: IMediaElement,
    keyType: string,
    serverCertificate?: Uint8Array,
  ) {
    super();
    this._serverCertificate = serverCertificate;
    this._videoElement = mediaElement;
    this._keyType = keyType;

    this._unbindSession = noop;
    this._closeSession = noop; // Just here to make TypeScript happy
    this.closed = new Promise((resolve) => {
      this._closeSession = resolve;
    });
    this.keyStatuses = new Map();
    this.expiration = NaN;
  }

  public update(license: BufferSource): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        this._nativeSession === undefined ||
        this._nativeSession.update === undefined ||
        typeof this._nativeSession.update !== "function"
      ) {
        return reject("Unavailable WebKit key session.");
      }
      try {
        let uInt8Arraylicense: Uint8Array;
        if (license instanceof ArrayBuffer) {
          uInt8Arraylicense = new Uint8Array(license);
        } else if (license instanceof Uint8Array) {
          uInt8Arraylicense = license;
        } else {
          uInt8Arraylicense = new Uint8Array(license.buffer);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        resolve(this._nativeSession.update(uInt8Arraylicense));
      } catch (err) {
        reject(err);
      }
    });
  }

  public generateRequest(_initDataType: string, initData: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      const elt = this._videoElement;
      if (elt.webkitKeys?.createSession === undefined) {
        throw new Error("No WebKitMediaKeys API.");
      }

      let formattedInitData;
      if (isFairplayKeyType(this._keyType)) {
        if (this._serverCertificate === undefined) {
          throw new Error(
            "A server certificate is needed for creating fairplay session.",
          );
        }
        formattedInitData = getWebKitFairplayInitData(initData, this._serverCertificate);
      } else {
        formattedInitData = initData;
      }

      const keySession = elt.webkitKeys.createSession("video/mp4", formattedInitData);
      if (keySession === undefined || keySession === null) {
        throw new Error("Impossible to get the key sessions");
      }
      this._listenEvent(keySession);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this._nativeSession = keySession;
      resolve();
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._unbindSession();
      this._closeSession();
      if (this._nativeSession === undefined) {
        reject("No session to close.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._nativeSession.close();
      resolve();
    });
  }

  load(): Promise<boolean> {
    return Promise.resolve(false);
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }

  get sessionId(): string {
    return this._nativeSession?.sessionId ?? "";
  }

  private _listenEvent(session: MediaKeySession): void {
    this._unbindSession(); // If previous session was linked

    const onEvent = (evt: Event) => {
      this.trigger(evt.type, evt);
    };

    ["keymessage", "message", "keyadded", "ready", "keyerror", "error"].forEach((evt) => {
      session.addEventListener(evt, onEvent);
      session.addEventListener(`webkit${evt}`, onEvent);
    });

    this._unbindSession = () => {
      ["keymessage", "message", "keyadded", "ready", "keyerror", "error"].forEach(
        (evt) => {
          session.removeEventListener(evt, onEvent);
          session.removeEventListener(`webkit${evt}`, onEvent);
        },
      );
    };
  }
}

class WebKitCustomMediaKeys implements ICustomWebKitMediaKeys {
  private _videoElement?: IMediaElement;
  private _mediaKeys?: IWebKitMediaKeys;
  private _serverCertificate?: Uint8Array;
  private _keyType: string;

  constructor(keyType: string) {
    if (WebKitMediaKeysConstructor === undefined) {
      throw new Error("No WebKitMediaKeys API.");
    }
    this._keyType = keyType;
    this._mediaKeys = new WebKitMediaKeysConstructor(keyType);
  }

  _setVideo(videoElement: IMediaElement): Promise<unknown> {
    this._videoElement = videoElement;
    if (this._videoElement === undefined) {
      throw new Error("Video not attached to the MediaKeys");
    }
    return setWebKitMediaKeys(this._videoElement, this._mediaKeys);
  }

  createSession(/* sessionType */): ICustomMediaKeySession {
    if (this._videoElement === undefined || this._mediaKeys === undefined) {
      throw new Error("Video not attached to the MediaKeys");
    }
    return new WebkitMediaKeySession(
      this._videoElement,
      this._keyType,
      this._serverCertificate,
    );
  }

  setServerCertificate(serverCertificate: Uint8Array): Promise<void> {
    this._serverCertificate = serverCertificate;
    return Promise.resolve();
  }
}

export default function getWebKitMediaKeysCallbacks(): {
  isTypeSupported: (keyType: string) => boolean;
  createCustomMediaKeys: (keyType: string) => WebKitCustomMediaKeys;
  setMediaKeys: (
    elt: IMediaElement,
    mediaKeys: MediaKeys | ICustomMediaKeys | null,
  ) => Promise<unknown>;
} {
  if (WebKitMediaKeysConstructor === undefined) {
    throw new Error("No WebKitMediaKeys API.");
  }
  const isTypeSupported = WebKitMediaKeysConstructor.isTypeSupported;
  const createCustomMediaKeys = (keyType: string) => new WebKitCustomMediaKeys(keyType);
  const setMediaKeys = (
    elt: IMediaElement,
    mediaKeys: MediaKeys | ICustomMediaKeys | null,
  ): Promise<unknown> => {
    if (mediaKeys === null) {
      return setWebKitMediaKeys(elt, mediaKeys);
    }
    if (!(mediaKeys instanceof WebKitCustomMediaKeys)) {
      throw new Error(
        "Custom setMediaKeys is supposed to be called " + "with webkit custom MediaKeys.",
      );
    }
    return mediaKeys._setVideo(elt);
  };
  return {
    isTypeSupported,
    createCustomMediaKeys,
    setMediaKeys,
  };
}
