# Plugins

## Overview

To allow the player to be extended, a system of "plugins" has been added.

Those plugins are often under the form of functions passed as an argument to the
`loadVideo` API call.

## segmentLoader

The `segmentLoader` is a function that can be included as an option of the `loadVideo` API
call.

A `segmentLoader` allows to define a custom audio/video segment loader (it might on the
future work for other types of segments, so always check the type if you only want those
two). The segment loader is the part performing the segment request. One usecase where you
might want to set your own segment loader is to integrate Peer-to-Peer segment downloading
through the player.

Before the complete documentation, let's write an example which will just use an
XMLHttpRequest (it has no use, as our implementation does the same thing and more):

```js
/**
 * @param {Object} segmentInfo - Information about the segment to download
 * @param {Object} callbacks - Object containing several callbacks to indicate
 * that the segment has been loaded, the loading operation has failed or to
 * fallback to our default implementation. More information on this object below
 * this code example.
 * @returns {Function|undefined} - If a function is defined in the return value,
 * it will be called if and when the request is canceled.
 */
const customSegmentLoader = (segmentInfo, callbacks) => {
  // we will only use this custom loader for videos segments.
  // we will also ignore edge cases where the URL is undefined.
  if (segmentInfo.trackType !== "video" || segmentInfo.url === undefined) {
    callbacks.fallback();
    return;
  }

  const xhr = new XMLHttpRequest();
  const sendingTime = performance.now();

  xhr.onload = function onXHRLoaded(r) {
    if (200 <= xhr.status && xhr.status < 300) {
      const duration = performance.now() - sendingTime;
      const size = r.total;
      const data = xhr.response;
      callbacks.resolve({ duration, size, data });
    } else {
      const err = new Error("didn't work");
      callbacks.reject(err);
    }
  };

  xhr.onprogress = function onXHRProgress(event) {
    const currentTime = performance.now();
    callbacks.progress({
      duration: currentTime - sendingTime,
      size: event.loaded,
      totalSize: event.total,
    });
  };

  xhr.onerror = function onXHRError() {
    const err = new Error("didn't work");
    callbacks.reject(err);
  };

  xhr.open("GET", segmentInfo.url);
  xhr.responseType = "arraybuffer";

  const ranges = segmentInfo.byteRanges;
  if (ranges) {
    // Theoretically, we could have multiple non-contiguous byte ranges, which
    // would imply several requests.
    // In reality, this is extremely rare so we just create a global byte-range
    // encompassing all in this example.
    const range = [ranges[0][0], ranges[ranges.length - 1][1]];
    if (range[1] && range[1] !== Infinity) {
      xhr.setRequestHeader("Range", `bytes=${range[0]}-${range[1]}`);
    } else {
      xhr.setRequestHeader("Range", `bytes=${range[0]}-`);
    }
  }

  xhr.send();

  return () => {
    xhr.abort();
  };
};
```

As you can see, this function takes two arguments:

1. **segmentInfo** (`object`): An Object giving information about the wanted segments.
   This object contains the following properties:

   - **url** (`string|undefined`): The URL the segment request should normally be
     performed at.

     This property can be `undefined` in a condition where the segment URL either doesn't
     exist or has not been communicated by the Manifest.

   - _timeout_ (`number|undefined`: Timeout in milliseconds after which a request should
     preferably be aborted, according to current configuration.

     This property is mainly indicative, you may or may not want to exploit this
     information depending on your use cases.

   - _isInit_ (`boolean|undefined`): If true this segment is an initialization segment
     which contains no decodable data.

     Those types of segment are mainly there for initialization purposes, such as giving
     initial infos to the decoder on subsequent media segments that will be pushed.

     Note that if `isInit` is false, it only means that the segment contains decodable
     media, it can also contain important initialization information.

     If `undefined`, we could not determine whether this segment was an initialization
     segment. This case is not currently possible but may be in future versions.

   - _byteRanges_ (`Array.<[number, number]>|undefined`): If defined, only the
     corresponding byte-ranges, which are subsets in bytes of the full data concerned,
     should be loaded.

     If multiple non-contiguous byte-ranges are given, the result should be the
     concatenation of those byte-ranges, in the same order.

     For example `[[0, 100], [150, 180]]` means that the bytes of both 0 to 100 (included)
     and from 150 to 180 (included) should be requested. The communicated result should
     then be a concatenation of both in the same order.

   - _trackType_ (`string`): The concerned type of track. Can be `"video"`, `"audio"`,
     `"text"` (for subtitles)

   - _cmcdPayload_ (`Object|undefined`): Optional object that describes the "Common Media
     Client Data" (CMCD) that may be provided alongside the resource for this request.

     When set, takes the form of an object with two fields: `type` (a `string`) and value,
     whose format will depend on the value of `type`.

     When `type` is set to `"query"`, then `value` represents a CMCD payload formatted to
     be inserted in a query string. It is in this case an array of 2-tuples with the first
     value being a field's name as a string and the second element being either that
     field's value if set to a string or indicating that the field has no value. For
     example a `value` set to
     `[["first", "val"], ["second", null], ["third", "something"]]` could be translated
     into the query string `?first=val&second&third=something`.

     When `type` is set to `"headers"`, then `value` represents a CMCD payload formatted
     to be inserted as headers. It is in this case an object where keys are header names
     and values are the corresponding header values.

2. **callbacks**: An object containing multiple callbacks to allow this `segmentLoader` to
   communicate various events to the RxPlayer.

   This Object contains the following functions:

   - **resolve**: To call after the segment is loaded, to communicate it to the RxPlayer.

     When called, it should be given an object with the following properties:

     - _data_ (`ArrayBuffer`|`Uint8Array`) - the segment data.

     - _duration_ (`Number|undefined`) - the duration the request took, in milliseconds.

       This value may be used to estimate the ideal user bandwidth.

     - _size_ (`Number|undefined`) size, in bytes, of the total downloaded response.

       This value may be used to estimate the ideal user bandwidth.

   - **progress** - Callback to call when progress information is available on the current
     request. This callback allows to improve our adaptive streaming logic by better
     predicting the bandwidth before the request is finished and whether a request is
     stalling.

     When called, it should be given an object with the following properties:

     - _duration_ (`Number`) - The duration since the beginning of the request, in
       milliseconds.

     - _size_ (`Number`) - the current size loaded, in bytes.

     - _totalSize_ (`Number|undefined`) - the whole size of the wanted data, in bytes. Can
       be let to undefined when not known.

   - **reject**: Callback to call when an error is encountered which made loading the
     segment impossible.

     It is recommended (but not enforced) to give it an Object or error instance with the
     following properties:

     - _canRetry_ (`boolean|undefined`): If set to `true`, the RxPlayer may retry the
       request (depending on the configuration set by the application).

       If set to `false`, the RxPlayer will never try to retry this request and will
       probably just stop the current content.

       If not set or set to `undefined`, the RxPlayer might retry or fail depending on
       other factors.

   - **fallback**: Callback to call if you want to call our default implementation instead
     for loading this segment. No argument is needed.

The `segmentLoader` can also return a function, which will be called if/when the request
is aborted. You can define one to clean-up or dispose all resources.

## manifestLoader

The `manifestLoader` is a function that can be included as an option of the `loadVideo`
API call.

A manifestLoader allows to define a custom
[Manifest](../../Getting_Started/Glossary.md#manifest) loader.

Before the complete documentation, let's write an example which will just use an
XMLHttpRequest (it has no use, as our implementation does the same thing and more):

```js
/**
 * @param {Object} manifestInfo - Information about the Manifest to download
 * @param {Object} callbacks - Object containing several callbacks to indicate
 * that the manifest has been loaded, the loading operation has failed or to
 * fallback to our default implementation. More information on this object below
 * this code example.
 * @returns {Function|undefined} - If a function is defined in the return value,
 * it will be called if and when the request is canceled.
 */
const customManifestLoader = (manifestInfo, callbacks) => {
  const { url } = manifestInfo;
  const xhr = new XMLHttpRequest();
  const baseTime = performance.now();

  xhr.onload = (r) => {
    if (200 <= xhr.status && xhr.status < 300) {
      const duration = performance.now() - baseTime;

      const now = Date.now();
      const receivingTime = now;

      // Note: We could have calculated `sendingTime` before the request, but
      // that date would be wrong if the user updated the clock while the
      // request was pending.
      // `performance.now` doesn't depend on the user's clock. It is thus a
      // better candidate here.
      // This is why we re-calculate the sendingTime a posteriori, we are now
      // sure to be aligned with the current clock.
      const sendingTime = now - duration;

      // the request could have been redirected,
      // we have to feed back the real URL
      const _url = xhr.responseURL || url;

      const size = r.total;
      const data = xhr.response;
      callbacks.resolve({
        url: _url,
        sendingTime,
        receivingTime,
        duration,
        size,
        data,
      });
    } else {
      const err = new Error("didn't work");
      err.xhr = xhr;
      callbacks.reject(err);
    }
  };

  xhr.onerror = () => {
    const err = new Error("didn't work");
    err.xhr = xhr;
    callbacks.reject(err);
  };

  xhr.open("GET", url);
  xhr.responseType = "document";

  xhr.send();

  return () => {
    xhr.abort();
  };
};
```

As you can see, this function takes three arguments:

1. **manifestInfo** (`object`): An Object giving information about the wanted Manifest.
   This object contains the following properties:

   - **url** (`string|undefined`): The URL the Manifest request should normally be
     performed at.

     This argument can be `undefined` in very rare and specific conditions where the
     Manifest URL doesn't exist or has not been communicated by the application.

   - _timeout_ (`number|undefined`): Timeout in milliseconds after which a request should
     preferably be aborted, according to current configuration.

     This property is mainly indicative, you may or may not want to exploit this
     information depending on your use cases.

   - _cmcdPayload_ (`Object|undefined`): Optional object that describes the "Common Media
     Client Data" (CMCD) that may be provided alongside the resource for this request.

     When set, takes the form of an object with two fields: `type` (a `string`) and value,
     whose format will depend on the value of `type`.

     When `type` is set to `"query"`, then `value` represents a CMCD payload formatted to
     be inserted in a query string. It is in this case an array of 2-tuples with the first
     value being a field's name as a string and the second element being either that
     field's value if set to a string or indicating that the field has no value. For
     example a `value` set to
     `[["first", "val"], ["second", null], ["third", "something"]]` could be translated
     into the query string `?first=val&second&third=something`.

     When `type` is set to `"headers"`, then `value` represents a CMCD payload formatted
     to be inserted as headers. It is in this case an object where keys are header names
     and values are the corresponding header values.

2. **callbacks**: An object containing multiple callbacks to allow this `manifestLoader`
   to communicate the loaded Manifest or an encountered error to the RxPlayer.

   This Object contains the following functions:

   - **resolve**: To call after the Manifest is loaded, to communicate it to the RxPlayer.

     When called, it should be given an object with the following properties:

     - _data_ - the Manifest data. Many formats are accepted depending on what makes sense
       in the current transport: string, Document, ArrayBuffer, Uint8Array, object.

     - _duration_ (`Number|undefined`) - the duration of the request, in milliseconds.

     - _size_ (`Number|undefined`) size, in bytes, of the total downloaded response.

     - _url_ (`string|undefined`) - url of the Manifest (after any potential redirection
       if one).

     - _sendingTime_ (`number|undefined`) - Time at which the manifest request was done as
       a unix timestamp in milliseconds.

     - _receivingTime_ (`number|undefined`) - Time at which the manifest request was
       finished as a unix timestamp in milliseconds.

   - **reject**: Callback to call when an error is encountered which made loading the
     Manifest impossible.

     It is recommended (but not enforced) to give it an Object or error instance with the
     following properties:

     - _canRetry_ (`boolean|undefined`): If set to `true`, the RxPlayer may retry the
       request (depending on the configuration set by the application).

       If set to `false`, the RxPlayer will never try to retry this request and will
       probably just stop the current content.

       If not set or set to `undefined`, the RxPlayer might retry or fail depending on
       other factors.

   - **fallback**: Callback to call if you want to call our default implementation instead
     for this Manifest. No argument is needed.

The `manifestLoader` can also return a function, which will be called if/when the request
is aborted. You can define one to clean-up or dispose all resources.

## representationFilter

The representationFilter is a function that can be included as an option of the
`loadVideo` API call.

A representationFilter allows you to filter out
[Representations](../../Getting_Started/Glossary.md#representation) (i.e. media qualities)
based on its attributes.

The representationFilter will be called each time we load a
[Manifest](../../Getting_Started/Glossary.md#manifest) with two arguments:

- representation `{Object}`: An object describing the `Representation`.

  This object contains the following properties:

  - `id` (`string`): The id used to identify this Representation.

  - `bitrate` (`Number|undefined`): The bitrate of this Representation, in bits per
    seconds.

    `undefined` if unknown.

  - `width` (`Number|undefined`): If the `Representation` is from a video track and if its
    width is known, this is the width of video, in pixels.

  - `height` (`Number|undefined`): If the `Representation` is from a video track and if
    its height is known, this is the height of video, in pixels.

  - `codecs` (`Array.<string>|undefined`): Codec(s) relied on by the media segments of
    that Representation.

    For the great majority of cases, this value will be set to either `undefined` (meaning
    the codec is unknown) or to an array with a single element which will be the actual
    codec relied on when the corresponding Representation will be played.

    However in some very rare scenarios, this value might be set to an array with multiple
    codecs, itself being a list of its candidate codecs from the most wanted to the most
    compatible. The conditions for this more complex format are very specific:

    - It can only happen if the `representationFilter` callback is called in an
      environment where it hasn't yet been possible for the RxPlayer to check for codec
      support (mainly when running through the RxPlayer's `MULTI_THREAD` feature in a
      browser without MSE-in-worker capabilities).

    - The corresponding Representation is compatible to a restrictive codec yet also
      retro-compatible to a less restrictive one.

      The main example being Dolby Vision Representations which are retro-compatible to
      HDR10 HEVC codecs. In that very specific case, we could have an array with two
      elements:

      1.  The Dolby Vision codec
      2.  The base HDR10 codec

  - `frameRate` (`Number|undefined`): If the `Representation` is from a video track and if
    its frame rate is known, this is the frame rate of video, in image per seconds.

  - `hdrInfo` (`Object|undefined`): If the `Representation` is from a video track and if
    it has HDR information associated to it, this is set to an object describing the hdr
    characteristics of the track. (see [HDR support documentation](../hdr.md#hdrinfo))

  - `contentProtections` (`Object|undefined`): Encryption information linked to this
    content.

    If set to an Object, the Representation is known to be encrypted. If unset or set to
    `undefined` the Representation is either unencrypted or we don't know if it is.

    When set to an object, it may contain the following properties:

    - `keyIds` (`Array.<Uint8Array>|undefined`): Known key ids linked to that
      Representation.

- context `{Object}`: Basic context about this `Representation`. Contains the following
  keys:

  - trackType `{string}`: The concerned type of track. Can be `"video"`, `"audio"`,
    `"text"` (for subtitles)

  - language `{string|undefined}`: The language the `Representation` is in, as announced
    by the Manifest.

  - normalizedLanguage `{string|undefined}`: An attempt to translate the language into an
    ISO 639-3 code. If the translation attempt fails (no corresponding ISO 639-3 language
    code is found), it will equal the value of `language`

  - isClosedCaption `{Boolean|undefined}`: If set to `true` and if this is a text track,
    the `Representation` links to subtitles with added hints for the hard of hearing.

  - isAudioDescription `{Boolean|undefined}`: If set to `true` and if this is an audio
    track, the `Representation` links to an audio track with added commentary for the
    visually impaired.

  - isDub `{Boolean|undefined}`): If set to `true` and if this is an audio track, then
    this audio track is a "dub", meaning it was recorded in another language than the
    original. If set to `false`, we know that this audio track is in an original language.

    This property is `undefined` if we do not known whether it is in an original language
    or if does not apply for the track type.

  - isSignInterpreted `{Boolean|undefined}`): If set to `true` and if this is a video
    track, then it contains visual sign interpretation.

This function should then returns `true` if the `Representation` should be kept or `false`
if it should be removed.

For example, here is a `representationFilter` that removes video `Representation`s with a
video resolution higher than HD (1920x1080):

```js
/**
 * @param {Object} representationInfo
 * @param {Object} infos - supplementary information about the given
 * Representation.
 * @returns {boolean}
 */
function representationFilter(representationInfo, infos) {
  if (infos.trackType === "video") {
    // If video representation, allows only those for which the height and width
    // is known to be below our 1920x1080 limit
    const { width, height } = representationInfo;
    return width != null && height != null && width <= 1920 && height <= 1080;
  }

  // Otherwise, allow all non-video representations
  return true;
}
```
