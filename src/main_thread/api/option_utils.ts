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
 * This file exports various helpers to parse options given to various APIs,
 * throw if something is wrong, and return a normalized option object.
 */

import type { IMediaElement } from "../../compat/browser_compatibility_types";
import config from "../../config";
import log from "../../log";
import type {
  IAudioTrackSwitchingMode,
  IConstructorOptions,
  IKeySystemOption,
  ILoadedManifestFormat,
  ILoadVideoOptions,
  IManifestLoader,
  IRequestConfig,
  IRepresentationFilter,
  ISegmentLoader,
  IServerSyncInfos,
  IRxPlayerMode,
  ICmcdOptions,
} from "../../public_types";
import arrayIncludes from "../../utils/array_includes";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import objectAssign from "../../utils/object_assign";

/** Value once parsed for the `startAt` option of the `loadVideo` method. */
export type IParsedStartAtOption =
  | { position: number }
  | { wallClockTime: number }
  | { percentage: number }
  | { fromLastPosition: number }
  | { fromLivePosition: number }
  | { fromFirstPosition: number };

/** Options of the RxPlayer's constructor once parsed. */
export interface IParsedConstructorOptions {
  maxBufferAhead: number;
  maxBufferBehind: number;
  wantedBufferAhead: number;
  maxVideoBufferSize: number;
  videoResolutionLimit: "videoElement" | "screen" | "none";
  throttleVideoBitrateWhenHidden: boolean;

  videoElement: IMediaElement;
  baseBandwidth: number;
}

/**
 * Base type which the types for the parsed options of the RxPlayer's
 * `loadVideo` method exend.
 */
interface IParsedLoadVideoOptionsBase {
  url: string | undefined;
  transport: string;
  autoPlay: boolean;
  initialManifest: ILoadedManifestFormat | undefined;
  keySystems: IKeySystemOption[];
  lowLatencyMode: boolean;
  minimumManifestUpdateInterval: number;
  requestConfig: IRequestConfig;
  startAt: IParsedStartAtOption | undefined;
  enableFastSwitching: boolean;
  defaultAudioTrackSwitchingMode: IAudioTrackSwitchingMode | undefined;
  onCodecSwitch: "continue" | "reload";
  checkMediaSegmentIntegrity?: boolean | undefined;
  checkManifestIntegrity?: boolean | undefined;
  manifestLoader?: IManifestLoader | undefined;
  referenceDateTime?: number | undefined;
  representationFilter?: IRepresentationFilter | string | undefined;
  segmentLoader?: ISegmentLoader | undefined;
  serverSyncInfos?: IServerSyncInfos | undefined;
  mode: IRxPlayerMode;
  cmcd: ICmcdOptions | undefined;
  __priv_manifestUpdateUrl?: string | undefined;
  __priv_patchLastSegmentInSidx?: boolean | undefined;
}

/**
 * Options of the RxPlayer's `loadVideo` method once parsed when a "native"
 * `textTrackMode` is asked.
 */
interface IParsedLoadVideoOptionsNative extends IParsedLoadVideoOptionsBase {
  textTrackMode: "native";
}

/**
 * Options of the RxPlayer's `loadVideo` method once parsed when an "html"
 * `textTrackMode` is asked.
 */
interface IParsedLoadVideoOptionsHTML extends IParsedLoadVideoOptionsBase {
  textTrackMode: "html";
  textTrackElement: HTMLElement;
}

/**
 * Type enumerating all possible forms for the parsed options of the RxPlayer's
 * `loadVideo` method.
 */
export type IParsedLoadVideoOptions =
  | IParsedLoadVideoOptionsNative
  | IParsedLoadVideoOptionsHTML;

/**
 * Parse options given to the API constructor and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 * @param {Object|undefined} options
 * @returns {Object}
 */
function parseConstructorOptions(
  options: IConstructorOptions,
): IParsedConstructorOptions {
  let maxBufferAhead: number;
  let maxBufferBehind: number;
  let wantedBufferAhead: number;
  let maxVideoBufferSize: number;

  let videoElement: IMediaElement;
  let baseBandwidth: number;

  const {
    DEFAULT_BASE_BANDWIDTH,
    DEFAULT_VIDEO_RESOLUTION_LIMIT,
    DEFAULT_MAX_BUFFER_AHEAD,
    DEFAULT_MAX_BUFFER_BEHIND,
    DEFAULT_MAX_VIDEO_BUFFER_SIZE,
    DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN,
    DEFAULT_WANTED_BUFFER_AHEAD,
  } = config.getCurrent();

  if (isNullOrUndefined(options.maxBufferAhead)) {
    maxBufferAhead = DEFAULT_MAX_BUFFER_AHEAD;
  } else {
    maxBufferAhead = Number(options.maxBufferAhead);
    if (isNaN(maxBufferAhead)) {
      throw new Error("Invalid maxBufferAhead parameter. Should be a number.");
    }
  }

  if (isNullOrUndefined(options.maxBufferBehind)) {
    maxBufferBehind = DEFAULT_MAX_BUFFER_BEHIND;
  } else {
    maxBufferBehind = Number(options.maxBufferBehind);
    if (isNaN(maxBufferBehind)) {
      throw new Error("Invalid maxBufferBehind parameter. Should be a number.");
    }
  }

  if (isNullOrUndefined(options.wantedBufferAhead)) {
    wantedBufferAhead = DEFAULT_WANTED_BUFFER_AHEAD;
  } else {
    wantedBufferAhead = Number(options.wantedBufferAhead);
    if (isNaN(wantedBufferAhead)) {
      throw new Error("Invalid wantedBufferAhead parameter. Should be a number.");
    }
  }

  if (isNullOrUndefined(options.maxVideoBufferSize)) {
    maxVideoBufferSize = DEFAULT_MAX_VIDEO_BUFFER_SIZE;
  } else {
    maxVideoBufferSize = Number(options.maxVideoBufferSize);
    if (isNaN(maxVideoBufferSize)) {
      throw new Error("Invalid maxVideoBufferSize parameter. Should be a number.");
    }
  }

  const videoResolutionLimit = isNullOrUndefined(options.videoResolutionLimit)
    ? DEFAULT_VIDEO_RESOLUTION_LIMIT
    : options.videoResolutionLimit;

  const throttleVideoBitrateWhenHidden = isNullOrUndefined(
    options.throttleVideoBitrateWhenHidden,
  )
    ? DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN
    : !!options.throttleVideoBitrateWhenHidden;

  if (isNullOrUndefined(options.videoElement)) {
    videoElement = document.createElement("video");
  } else if (
    options.videoElement.nodeName.toLowerCase() === "video" ||
    options.videoElement.nodeName.toLowerCase() === "audio"
  ) {
    videoElement = options.videoElement;
  } else {
    throw new Error("Invalid videoElement parameter. Should be a HTMLMediaElement.");
  }

  if (isNullOrUndefined(options.baseBandwidth)) {
    baseBandwidth = DEFAULT_BASE_BANDWIDTH;
  } else {
    baseBandwidth = Number(options.baseBandwidth);
    if (isNaN(baseBandwidth)) {
      throw new Error("Invalid baseBandwidth parameter. Should be a number.");
    }
  }

  return {
    maxBufferAhead,
    maxBufferBehind,
    videoResolutionLimit,
    videoElement,
    wantedBufferAhead,
    maxVideoBufferSize,
    throttleVideoBitrateWhenHidden,
    baseBandwidth,
  };
}

/**
 * Check the format of given reload options.
 * Throw if format in invalid.
 * @param {object | undefined} options
 */
function checkReloadOptions(options?: {
  reloadAt?: { position?: number; relative?: number };
  keySystems?: IKeySystemOption[];
  autoPlay?: boolean;
}): void {
  if (options === null || (typeof options !== "object" && options !== undefined)) {
    throw new Error("API: reload - Invalid options format.");
  }
  if (
    options?.reloadAt === null ||
    (typeof options?.reloadAt !== "object" && options?.reloadAt !== undefined)
  ) {
    throw new Error("API: reload - Invalid 'reloadAt' option format.");
  }
  if (
    typeof options?.reloadAt?.position !== "number" &&
    options?.reloadAt?.position !== undefined
  ) {
    throw new Error("API: reload - Invalid 'reloadAt.position' option format.");
  }
  if (
    typeof options?.reloadAt?.relative !== "number" &&
    options?.reloadAt?.relative !== undefined
  ) {
    throw new Error("API: reload - Invalid 'reloadAt.relative' option format.");
  }
  if (!Array.isArray(options?.keySystems) && options?.keySystems !== undefined) {
    throw new Error("API: reload - Invalid 'keySystems' option format.");
  }
  if (options?.autoPlay !== undefined && typeof options.autoPlay !== "boolean") {
    throw new Error("API: reload - Invalid 'autoPlay' option format.");
  }
}

/**
 * Parse options given to loadVideo and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 *
 * Throws if any mandatory option is not set.
 * @param {Object|undefined} options
 * @returns {Object}
 */
function parseLoadVideoOptions(options: ILoadVideoOptions): IParsedLoadVideoOptions {
  let url: string | undefined;
  let transport: string;
  let keySystems: IKeySystemOption[];
  let textTrackMode: "native" | "html";
  let mode: IRxPlayerMode;
  let textTrackElement: HTMLElement | undefined;
  let startAt: IParsedStartAtOption | undefined;

  const {
    DEFAULT_AUTO_PLAY,
    DEFAULT_CODEC_SWITCHING_BEHAVIOR,
    DEFAULT_ENABLE_FAST_SWITCHING,
    DEFAULT_TEXT_TRACK_MODE,
  } = config.getCurrent();

  if (isNullOrUndefined(options)) {
    throw new Error("No option set on loadVideo");
  }

  if (!isNullOrUndefined(options.url)) {
    url = String(options.url);
  } else if (
    isNullOrUndefined(options.initialManifest) &&
    isNullOrUndefined(options.manifestLoader)
  ) {
    throw new Error(
      "Unable to load a content: no url set on loadVideo.\n" +
        "Please provide at least either an `url` argument, a " +
        "`initialManifest` option or a " +
        "`manifestLoader` option so the RxPlayer " +
        "can load the content.",
    );
  }

  if (isNullOrUndefined(options.transport)) {
    throw new Error("No transport set on loadVideo");
  } else {
    transport = String(options.transport);
  }

  const autoPlay = isNullOrUndefined(options.autoPlay)
    ? DEFAULT_AUTO_PLAY
    : !!options.autoPlay;

  if (isNullOrUndefined(options.keySystems)) {
    keySystems = [];
  } else {
    keySystems = Array.isArray(options.keySystems)
      ? options.keySystems
      : [options.keySystems];
    for (const keySystem of keySystems) {
      if (
        typeof keySystem.type !== "string" ||
        typeof keySystem.getLicense !== "function"
      ) {
        throw new Error(
          "Invalid key system given: Missing type string or " + "getLicense callback",
        );
      }
    }
  }

  const lowLatencyMode =
    options.lowLatencyMode === undefined ? false : !!options.lowLatencyMode;

  const initialManifest = options.initialManifest;
  const minimumManifestUpdateInterval = options.minimumManifestUpdateInterval ?? 0;

  let defaultAudioTrackSwitchingMode =
    options.defaultAudioTrackSwitchingMode ?? undefined;
  if (
    defaultAudioTrackSwitchingMode !== undefined &&
    !arrayIncludes(["seamless", "direct", "reload"], defaultAudioTrackSwitchingMode)
  ) {
    log.warn(
      "The `defaultAudioTrackSwitchingMode` loadVideo option must match one of " +
        "the following strategy name:\n" +
        "- `seamless`\n" +
        "- `direct`\n" +
        "- `reload`",
    );
    defaultAudioTrackSwitchingMode = undefined;
  }

  let onCodecSwitch = isNullOrUndefined(options.onCodecSwitch)
    ? DEFAULT_CODEC_SWITCHING_BEHAVIOR
    : options.onCodecSwitch;
  if (!arrayIncludes(["continue", "reload"], onCodecSwitch)) {
    log.warn(
      "The `onCodecSwitch` loadVideo option must match one of " +
        "the following string:\n" +
        "- `continue`\n" +
        "- `reload`\n" +
        "If badly set, " +
        DEFAULT_CODEC_SWITCHING_BEHAVIOR +
        " will be used as default",
    );
    onCodecSwitch = DEFAULT_CODEC_SWITCHING_BEHAVIOR;
  }

  if (isNullOrUndefined(options.textTrackMode)) {
    textTrackMode = DEFAULT_TEXT_TRACK_MODE;
  } else {
    if (options.textTrackMode !== "native" && options.textTrackMode !== "html") {
      throw new Error("Invalid textTrackMode.");
    }
    textTrackMode = options.textTrackMode;
  }

  if (textTrackMode === "html") {
    // TODO Better way to express that in TypeScript?
    if (isNullOrUndefined(options.textTrackElement)) {
      throw new Error(
        "You have to provide a textTrackElement " + 'in "html" textTrackMode.',
      );
    } else if (!(options.textTrackElement instanceof HTMLElement)) {
      throw new Error("textTrackElement should be an HTMLElement.");
    } else {
      textTrackElement = options.textTrackElement;
    }
  } else if (!isNullOrUndefined(options.textTrackElement)) {
    log.warn(
      "API: You have set a textTrackElement without being in " +
        'an "html" textTrackMode. It will be ignored.',
    );
  }

  if (isNullOrUndefined(options.mode)) {
    mode = "auto";
  } else {
    if (!arrayIncludes(["auto", "multithread", "main"], options.mode)) {
      throw new Error("Invalid `mode` option.");
    }
    mode = options.mode;
  }

  const enableFastSwitching = isNullOrUndefined(options.enableFastSwitching)
    ? DEFAULT_ENABLE_FAST_SWITCHING
    : options.enableFastSwitching;

  if (!isNullOrUndefined(options.startAt)) {
    if (
      "wallClockTime" in options.startAt &&
      options.startAt.wallClockTime instanceof Date
    ) {
      const wallClockTime =
        (options.startAt as { wallClockTime: Date }).wallClockTime.getTime() / 1000;
      startAt = objectAssign({}, options.startAt, { wallClockTime });
    } else {
      startAt = options.startAt as IParsedStartAtOption;
    }
  }

  const requestConfig = options.requestConfig ?? {};

  // All those eslint disable are needed because the option is voluntarily
  // hidden from the base type to limit discovery of this hidden API.
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    __priv_patchLastSegmentInSidx: (options as any).__priv_patchLastSegmentInSidx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    __priv_manifestUpdateUrl: (options as any).__priv_manifestUpdateUrl,
    checkMediaSegmentIntegrity: options.checkMediaSegmentIntegrity,
    checkManifestIntegrity: options.checkManifestIntegrity,
    autoPlay,
    defaultAudioTrackSwitchingMode,
    enableFastSwitching,
    initialManifest,
    keySystems,
    lowLatencyMode,
    manifestLoader: options.manifestLoader,
    minimumManifestUpdateInterval,
    requestConfig,
    onCodecSwitch,
    referenceDateTime: options.referenceDateTime,
    representationFilter: options.representationFilter,
    segmentLoader: options.segmentLoader,
    serverSyncInfos: options.serverSyncInfos,
    startAt,
    textTrackElement: textTrackElement as HTMLElement,
    textTrackMode,
    transport,
    mode,
    url,
    cmcd: options.cmcd,
  };
}

export { checkReloadOptions, parseConstructorOptions, parseLoadVideoOptions };
