#!/usr/bin/env node

/**
 * =================
 * generate_build.mjs
 * =================
 *
 * This file allows to produce the main RxPlayer's builds.
 *
 * To run it, just call this file through your node.js binary:
 * ```sh
 * node generate_build.mjs
 * ```
 *
 * For now it heavily relies on unix-like utilities such as `find` and `sed` and
 * spawns new process to run them inside that script.
 * More cross-platform and safer solutions should be found in the future.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import generateEmbeds from "./generate_embeds.mjs";
import runBundler from "./run_bundler.mjs";
import removeDir from "./utils/remove_dir.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.join(currentDirectory, "../");
const BUILD_ARTEFACTS_TO_REMOVE = [
  "dist/commonjs",
  "dist/es2017",
  "src/__GENERATED_CODE",
];

const WORKER_IN_FILE = path.join(ROOT_DIR, "src/worker_entry_point.ts");
const WORKER_OUT_FILE = path.join(ROOT_DIR, "dist/worker.js");

// If true, this script is called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { argv } = process;
  if (argv.includes("-h") || argv.includes("--help")) {
    displayHelp();
    process.exit(0);
  }
  const devMode = argv.includes("-d") || argv.includes("--dev-mode");
  const noCheck = argv.includes("-n") || argv.includes("--no-check");
  generateBuild({
    devMode,
    noCheck,
  });
}

/**
 * @param {Object|undefined} options
 * @param {boolean|undefined} [options.devMode]
 * @param {boolean|undefined} [options.noCheck]
 * @returns {Promise}
 */
export default async function generateBuild(options = {}) {
  try {
    const devMode = options.devMode === true;
    const noCheck = options.noCheck === true;
    console.log(" 🧹 Removing previous build artefacts...");
    await removePreviousBuildArtefacts();

    const distDir = path.join(ROOT_DIR, "./dist");
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir);
    }

    const dashWasmDir = path.join(distDir, "./mpd-parser.wasm");
    if (!fs.existsSync(dashWasmDir)) {
      console.log(" 🏭 Generating WebAssembly file...");
      await spawnProm(
        "npm run --silent " + (devMode ? "build:wasm:debug" : "build:wasm:release"),
        [],
        (code) => new Error(`WebAssembly compilation process exited with code ${code}`),
      );
    } else {
      console.log(
        " 🏭 Reusing already-generated WebAssembly file (please re-compile it if source changed).",
      );
    }

    console.log(" 👷 Bundling worker files...");
    await Promise.all([
      runBundler(WORKER_IN_FILE, {
        watch: false,
        minify: !devMode,
        outfile: WORKER_OUT_FILE,
        production: !devMode,
        silent: true,
      }),
    ]);

    console.log(" 🤖 Generating embedded code...");
    await generateEmbeds();

    console.log(" ⚙️ Compiling project with TypeScript...");
    await compile({ devMode, noCheck });
  } catch (err) {
    console.error("Fatal error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(" 🙌 SUCCESS!");
}

/**
 * Remove directories and files from a previously built RxPlayer.
 * @returns {Promise}
 */
async function removePreviousBuildArtefacts() {
  await Promise.all(
    BUILD_ARTEFACTS_TO_REMOVE.map((name) => {
      const relativePath = path.join(ROOT_DIR, name);
      return removeDir(relativePath);
    }),
  );
}

/**
 * Compile the project by spawning a separate procress running TypeScript.
 * @param {Object} opts
 * @param {boolean} opts.devMode
 * @param {boolean} opts.noCheck
 * @returns {Promise}
 */
async function compile(opts) {
  // Sadly TypeScript compiler API seems to be sub-par.
  // I did not find for example how to exclude some files (our unit tests)
  // easily by running typescript directly from NodeJS.
  // So we just spawn a separate process running tsc:
  await Promise.all([
    spawnProm(
      "npx tsc -p",
      [
        path.join(ROOT_DIR, opts.devMode ? "tsconfig.dev.json" : "tsconfig.json"),
        opts.noCheck ? "--noCheck" : "",
      ],
      (code) => new Error(`CommonJS compilation process exited with code ${code}`),
    ),
    spawnProm(
      "npx tsc -p",
      [
        path.join(
          ROOT_DIR,
          opts.devMode ? "tsconfig.dev.commonjs.json" : "tsconfig.commonjs.json",
        ),
        opts.noCheck ? "--noCheck" : "",
      ],
      (code) => new Error(`es2018 compilation process exited with code ${code}`),
    ),
  ]);
}

/**
 * @param {string} command
 * @param {Array.<string>} args
 * @param {Function} errorOnCode
 */
function spawnProm(command, args, errorOnCode) {
  return new Promise((res, rej) => {
    spawn(command, args, { shell: true, stdio: "inherit" }).on("close", (code) => {
      if (code !== 0) {
        rej(errorOnCode(code));
      }
      res();
    });
  });
}

/**
 * Display through `console.log` an helping message relative to how to run this
 * script.
 */
function displayHelp() {
  console.log(
    `Usage: node build_worker.mjs [options]
Options:
  -h, --help             Display this help
  -p, --dev-mode         Build all files in development mode (more runtime checks, worker not minified)
  -n, --no-check         Skip type checking for inputed files.`,
  );
}
