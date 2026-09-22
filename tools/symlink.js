// Using this instead of require() since require() doesn't exist in ES modules
import path from "node:path"
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import yargs from "yargs";
import { hideBin} from "yargs/helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {{dataPath: Array<string>; symLinkName: string;}} FoundryConfig
 */

const argv = yargs(hideBin(process.argv))
  .option("clean", {
    alias: "c",
    type: "boolean",
    default: false,
  })
  .parseSync();

/**
 * @type {FoundryConfig}
 */
const foundryConfig = fs.readJSONSync(
  path.resolve(__dirname, "..", "foundryconfig.json")
);

function createSymlink() {
  foundryConfig.dataPath.forEach((dataPath) => {
     const linkDirectory = path.resolve(
      dataPath,
      "Data",
      "systems",
      foundryConfig.symLinkName
    );
    
    console.log(`Linking dist to ${linkDirectory}.`);
    const systemsDirectory = path.resolve(linkDirectory, "..");
    if (!fs.pathExistsSync(systemsDirectory)) {
      throw new Error(
        `Link directory parent folder "${systemsDirectory}" not found.`
      );
    }

    if (!fs.existsSync(linkDirectory)) {
      // link path doesn't exist, create it.
      fs.symlinkSync(path.resolve(__dirname, ".."), linkDirectory);
    }
  });

  console.log(`Linking foundry files to ${path.join("foundry")}.`);
  let fileRoot = "";
  // As of 13.338, the Node install is *not* nested but electron installs *are*
  const nested = fs.existsSync(path.join(foundryConfig.installPath, "resources", "app"));

  if (nested) fileRoot = path.join(foundryConfig.installPath, "resources", "app");
  else fileRoot = foundryConfig.installPath;

  try {
    fs.mkdirSync("foundry");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }

  // Javascript files
  for (const p of ["client", "common", "tsconfig.json"]) {
    try {
      fs.symlinkSync(path.join(fileRoot, p), path.join("foundry", p));
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }

  // Language files
  try {
    fs.symlinkSync(path.join(fileRoot, "public", "lang"), path.join("foundry", "lang"));
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}

function removeSymlink() {
  foundryConfig.dataPath.forEach((dataPath) => {
    const linkDirectory = path.resolve(
      dataPath,
      "Data",
      "systems",
      foundryConfig.symLinkName
    );
    console.log(`Removing build in ${linkDirectory}.`);
    fs.removeSync(linkDirectory);
  });

  console.log(`Removing foundry files in ${path.join("foundry")}.`);
  // Check if the foundry directory exists and is a directory
  if (fs.existsSync("foundry") && fs.lstatSync("foundry").isDirectory()) {
    // Remove the foundry directory
    fs.removeSync("foundry");
  }
}

if (argv.clean) {
  removeSymlink();
} else {
  createSymlink();
}
