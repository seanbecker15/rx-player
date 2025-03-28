import type { ISegmentSinkMetrics } from "../../../../core/segment_sinks/segment_sinks_store";
import type { IBufferType } from "../../../../core/types";
import type {
  IAdaptationMetadata,
  IPeriodMetadata,
  IRepresentationMetadata,
} from "../../../../manifest";
import { getPeriodForTime } from "../../../../manifest";
import isNullOrUndefined from "../../../../utils/is_null_or_undefined";
import type { CancellationSignal } from "../../../../utils/task_canceller";
import type RxPlayer from "../../public_api";
import SegmentSinkGraph from "../buffer_graph";
import { DEFAULT_REFRESH_INTERVAL } from "../constants";
import {
  createElement,
  createGraphCanvas,
  createMetricTitle,
  isExtendedMode,
} from "../utils";

export default function createSegmentSinkGraph(
  instance: RxPlayer,
  bufferType: IBufferType,
  title: string,
  parentElt: HTMLElement,
  cancelSignal: CancellationSignal,
): HTMLElement {
  const bufferGraphWrapper = createElement("div");
  const bufferTitle = createMetricTitle(title);
  const canvasElt = createGraphCanvas();
  const bufferSizeElt = document.createElement("span");
  const currentRangeRepInfoElt = createElement("div");
  const loadingRangeRepInfoElt = createElement("div");
  const bufferGraph = new SegmentSinkGraph(canvasElt);
  const intervalId = setInterval(update, DEFAULT_REFRESH_INTERVAL);
  cancelSignal.register(() => {
    clearInterval(intervalId);
  });

  let bufferMetrics: ISegmentSinkMetrics | null = null;
  instance
    .__priv_getSegmentSinkMetrics()
    .then((metrics) => {
      bufferMetrics = metrics ?? null;
    })
    .catch(() => {
      // Do nothing
    });

  bufferGraphWrapper.appendChild(bufferTitle);
  bufferGraphWrapper.appendChild(canvasElt);
  bufferGraphWrapper.appendChild(bufferSizeElt);
  bufferGraphWrapper.appendChild(currentRangeRepInfoElt);
  bufferGraphWrapper.appendChild(loadingRangeRepInfoElt);
  bufferSizeElt.style.marginLeft = "5px";
  bufferSizeElt.style.fontSize = "0.9em";
  bufferGraphWrapper.style.padding = "5px 0px";
  update();
  return bufferGraphWrapper;

  function update() {
    if (instance.getVideoElement() === null) {
      // disposed player. Clean-up everything
      bufferGraphWrapper.style.display = "none";
      bufferGraphWrapper.innerHTML = "";
      clearInterval(intervalId);
      return;
    }
    instance
      .__priv_getSegmentSinkMetrics()
      .then((metrics) => {
        bufferMetrics = metrics ?? null;
        updateBufferMetrics();
      })
      .catch(() => {
        // DO nothing
      });
  }

  function updateBufferMetrics() {
    const showAllInfo = isExtendedMode(parentElt);
    const metricsForType = bufferMetrics?.segmentSinks[bufferType];
    const inventory = metricsForType?.segmentInventory;
    if (bufferMetrics === null || inventory === undefined) {
      bufferGraphWrapper.style.display = "none";
      bufferSizeElt.innerHTML = "";
      currentRangeRepInfoElt.innerHTML = "";
      loadingRangeRepInfoElt.innerHTML = "";
    } else {
      bufferGraphWrapper.style.display = "block";
      if (metricsForType?.sizeEstimate !== undefined) {
        const sizeEstimate = metricsForType.sizeEstimate;
        let sizeStr: string;
        if (sizeEstimate > 2e6) {
          sizeStr = (sizeEstimate / 1e6).toFixed(2) + "MB";
        } else if (sizeEstimate > 2e3) {
          sizeStr = (sizeEstimate / 1e3).toFixed(2) + "kB";
        } else {
          sizeStr = sizeEstimate + "B";
        }
        bufferSizeElt.innerHTML = sizeStr;
      } else {
        bufferSizeElt.innerHTML = "";
      }
      const currentTime = instance.getPosition();
      const width = Math.min(parentElt.clientWidth - 150, 600);
      bufferGraph.update({
        currentTime,
        minimumPosition: instance.getMinimumPosition() ?? undefined,
        maximumPosition: instance.getMaximumPosition() ?? undefined,
        inventory,
        width,
        height: 10,
      });

      if (!showAllInfo) {
        currentRangeRepInfoElt.innerHTML = "";
        loadingRangeRepInfoElt.innerHTML = "";
        return;
      }

      currentRangeRepInfoElt.innerHTML = "";
      for (const rangeInfo of inventory) {
        const { bufferedStart, bufferedEnd, infos } = rangeInfo;
        if (
          bufferedStart !== undefined &&
          bufferedEnd !== undefined &&
          currentTime >= bufferedStart &&
          currentTime < bufferedEnd
        ) {
          currentRangeRepInfoElt.appendChild(createMetricTitle("play"));
          currentRangeRepInfoElt.appendChild(
            createElement("span", {
              textContent: constructRepresentationInfo(infos),
            }),
          );
          break;
        }
      }

      loadingRangeRepInfoElt.innerHTML = "";
      const rep = instance.__priv_getCurrentRepresentations()?.[bufferType];
      const adap = instance.__priv_getCurrentAdaptation()?.[bufferType];
      const manifest = instance.__priv_getManifest();
      if (manifest !== null && !isNullOrUndefined(rep) && !isNullOrUndefined(adap)) {
        const period = getPeriodForTime(manifest, currentTime);
        if (period !== undefined) {
          loadingRangeRepInfoElt.appendChild(createMetricTitle("load"));
          loadingRangeRepInfoElt.appendChild(
            createElement("span", {
              textContent: constructRepresentationInfo({
                period,
                adaptation: adap,
                representation: rep,
              }),
            }),
          );
        }
      }
    }
  }
}

function constructRepresentationInfo(content: {
  period: IPeriodMetadata;
  adaptation: IAdaptationMetadata;
  representation: IRepresentationMetadata;
}): string {
  const period = content.period;
  const {
    language,
    isAudioDescription,
    isClosedCaption,
    isTrickModeTrack,
    isSignInterpreted,
    type: bufferType,
  } = content.adaptation;
  const { id, height, width, bitrate, codecs, hdrInfo } = content.representation;
  let representationInfo = `"${id}" `;
  if (height !== undefined && width !== undefined) {
    representationInfo += `${width}x${height} `;
  }
  if (bitrate !== undefined) {
    representationInfo += `(${(bitrate / 1000).toFixed(0)}kbps) `;
  }
  if (codecs !== undefined && codecs.length > 0) {
    representationInfo += `c:"${codecs.join(" / ")}" `;
  }
  if (language !== undefined) {
    representationInfo += `l:"${language}" `;
  }
  if (bufferType === "video" && hdrInfo !== undefined) {
    representationInfo += "hdr:1 ";
  }
  if (bufferType === "video" && typeof isSignInterpreted === "boolean") {
    representationInfo += `si:${isSignInterpreted ? 1 : 0} `;
  }
  if (bufferType === "video" && typeof isTrickModeTrack === "boolean") {
    representationInfo += `tm:${isTrickModeTrack ? 1 : 0} `;
  }
  if (bufferType === "audio" && typeof isAudioDescription === "boolean") {
    representationInfo += `ad:${isAudioDescription ? 1 : 0} `;
  }
  if (bufferType === "text" && typeof isClosedCaption === "boolean") {
    representationInfo += `cc:${isClosedCaption ? 1 : 0} `;
  }
  representationInfo += `p:${period.start}-${period.end ?? "?"}`;
  return representationInfo;
}
