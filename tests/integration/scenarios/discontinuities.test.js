import { describe, beforeEach, afterEach, it, expect } from "vitest";
import RxPlayer from "../../../dist/es2017";
import { checkAfterSleepWithBackoff } from "../../utils/checkAfterSleepWithBackoff.js";
import { waitForLoadedStateAfterLoadVideo } from "../../utils/waitForPlayerState";
import {
  discontinuitiesBetweenPeriodsInfos,
  differentTypesDiscontinuitiesInfos,
} from "../../contents/DASH_static_SegmentTemplate_Multi_Periods";
import {
  discontinuityInfos,
  notStartingAt0ManifestInfos,
} from "../../contents/DASH_static_SegmentTimeline";

let player;

describe("discontinuities handling", () => {
  beforeEach(() => {
    player = new RxPlayer();
  });

  afterEach(() => {
    player.dispose();
  });

  describe("discontinuities between periods", () => {
    const { url, transport } = discontinuitiesBetweenPeriodsInfos;
    it("should seek over discontinuities between periods", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.setPlaybackRate(2);
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 118 },
      });
      await waitForLoadedStateAfterLoadVideo(player);
      expect(discontinuitiesWarningReceived).to.equal(0);
      await checkAfterSleepWithBackoff({ maxTimeMs: 3000 }, () => {
        expect(player.getPosition()).to.be.above(131);
        expect(player.getPlayerState()).to.equal("PLAYING");
        expect(discontinuitiesWarningReceived).to.equal(1);
      });
    }, 7000);

    it("should seek to next Period when loading in discontinuity", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 121 },
      });
      expect(discontinuitiesWarningReceived).to.equal(0);
      await waitForLoadedStateAfterLoadVideo(player);
      expect(player.getPosition()).to.be.at.least(131);
      expect(player.getPlayerState()).to.equal("PLAYING");
      expect(discontinuitiesWarningReceived).to.equal(1);
    }, 4000);

    it("should seek to next Period when seeking in discontinuity", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.loadVideo({ url, transport, autoPlay: true });
      await waitForLoadedStateAfterLoadVideo(player);
      expect(discontinuitiesWarningReceived).to.equal(0);
      player.seekTo(122);
      await checkAfterSleepWithBackoff({ maxTimeMs: 1000 }, () => {
        expect(player.getPosition()).to.be.at.least(131);
        expect(player.getPlayerState()).to.equal("PLAYING");
        expect(discontinuitiesWarningReceived).to.equal(1);
      });
    }, 4000);
  });

  describe("discontinuities between periods with different types", () => {
    const { url, transport } = differentTypesDiscontinuitiesInfos;
    it("should seek over discontinuities between periods", async function ({ skip }) {
      // eslint-disable-next-line no-undef
      if (__BROWSER_NAME__ === "firefox") {
        // test is failing on firefox in the CI because it seems to not support audio only
        skip();
      }

      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.setPlaybackRate(2);
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 118 },
      });
      await waitForLoadedStateAfterLoadVideo(player);
      expect(discontinuitiesWarningReceived).to.equal(0);
      await checkAfterSleepWithBackoff({ maxTimeMs: 3000 }, () => {
        expect(player.getPlayerState()).to.equal("PLAYING");
        expect(discontinuitiesWarningReceived).to.equal(1);
        expect(player.getPosition()).to.be.above(131);
      });
    }, 7000);

    it("should seek to next Period when loading in discontinuity", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 121 },
      });
      expect(discontinuitiesWarningReceived).to.equal(0);
      await waitForLoadedStateAfterLoadVideo(player);
      expect(player.getPosition()).to.be.at.least(131);
      expect(player.getPlayerState()).to.equal("PLAYING");
      expect(discontinuitiesWarningReceived).to.equal(1);
    }, 4000);

    it("should seek to next Period when seeking in discontinuity", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.loadVideo({ url, transport, autoPlay: true });
      await waitForLoadedStateAfterLoadVideo(player);
      expect(discontinuitiesWarningReceived).to.equal(0);
      player.seekTo(122);
      await checkAfterSleepWithBackoff({ maxTimeMs: 1000 }, () => {
        expect(player.getPosition()).to.be.at.least(131);
        expect(player.getPlayerState()).to.equal("PLAYING");
        expect(discontinuitiesWarningReceived).to.be.at.least(1);

        // TODO this is a known very minor issue, investigate and fix in the
        // RxPlayer's code?
        expect(discontinuitiesWarningReceived).to.be.at.most(2);
      });
    }, 4000);
  });

  describe("discontinuities in Period announced in Manifest", () => {
    const { url, transport } = discontinuityInfos;
    it("should seek over discontinuities in a Period", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.setPlaybackRate(2);
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 22 },
      });
      await waitForLoadedStateAfterLoadVideo(player);
      expect(discontinuitiesWarningReceived).to.equal(0);
      await checkAfterSleepWithBackoff({ maxTimeMs: 4000 }, () => {
        expect(player.getPosition()).to.be.above(28);
        expect(player.getPlayerState()).to.equal("PLAYING");
        expect(discontinuitiesWarningReceived).to.equal(1);
      });
    }, 8000);

    it("should seek over discontinuity when loading on one", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 25 },
      });
      expect(discontinuitiesWarningReceived).to.equal(0);
      await waitForLoadedStateAfterLoadVideo(player);
      expect(player.getPosition()).to.be.at.least(28);
      expect(player.getPlayerState()).to.equal("PLAYING");
      expect(discontinuitiesWarningReceived).to.equal(1);
    }, 4000);

    it("should seek over discontinuity when seeking in one", async function () {
      let discontinuitiesWarningReceived = 0;
      player.addEventListener("warning", (err) => {
        if (err.type === "MEDIA_ERROR" && err.code === "DISCONTINUITY_ENCOUNTERED") {
          discontinuitiesWarningReceived++;
        }
      });
      player.loadVideo({ url, transport, autoPlay: true });
      await waitForLoadedStateAfterLoadVideo(player);
      expect(discontinuitiesWarningReceived).to.equal(0);
      player.seekTo(25);
      await checkAfterSleepWithBackoff({ maxTimeMs: 4000 }, () => {
        expect(player.getPosition()).to.be.at.least(28);
        expect(player.getPlayerState()).to.equal("PLAYING");
        expect(discontinuitiesWarningReceived).to.be.at.least(1);

        // Due to an issue seen in Firefox, the discontinuity might actually
        // be seeked in two parts in it
        expect(discontinuitiesWarningReceived).to.be.at.most(2);
      });
    }, 6000);
  });

  describe("Content not starting at 0", () => {
    const { url, transport } = notStartingAt0ManifestInfos;
    it("should seek over discontinuity when loading in it", async function () {
      player.loadVideo({
        url,
        transport,
        autoPlay: true,
        startAt: { position: 0 },
      });
      await waitForLoadedStateAfterLoadVideo(player);
      await checkAfterSleepWithBackoff({ maxTimeMs: 2000 }, () => {
        expect(player.getPosition()).to.be.above(12);
        expect(player.getPlayerState()).to.equal("PLAYING");
      });
    }, 7000);
  });
});
