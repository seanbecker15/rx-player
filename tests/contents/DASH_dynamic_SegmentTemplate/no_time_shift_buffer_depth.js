const BASE_URL =
  "http://" +
  // eslint-disable-next-line no-undef
  __TEST_CONTENT_SERVER__.URL +
  ":" +
  // eslint-disable-next-line no-undef
  __TEST_CONTENT_SERVER__.PORT +
  "/DASH_dynamic_SegmentTemplate/media/";

// Provide infos on this content under JSON.
// Useful for integration tests on DASH parsers.
export default {
  url: BASE_URL + "Manifest_no-timeShiftBufferDepth.mpd",
  transport: "dash",
  isLive: true,
  periods: [
    {
      adaptations: {
        audio: [
          {
            isAudioDescription: false,
            language: "eng",
            normalizedLanguage: "eng",
            representations: [
              {
                bitrate: 48000,
                codec: "mp4a.40.2",
                mimeType: "audio/mp4",
                index: {
                  init: {
                    url: "A48/init.mp4",
                  },
                  segments: [],
                  // ...
                },
              },
            ],
          },
        ],
        video: [
          {
            representations: [
              {
                bitrate: 300000,
                height: 360,
                width: 640,
                codec: "avc1.64001e",
                mimeType: "video/mp4",
                index: {
                  init: {
                    url: "V300/init.mp4",
                  },
                  segments: [],
                  // ...
                },
              },
            ],
          },
        ],
      },
    },
  ],
};
