import { readFileSync } from "node:fs";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

const { id: systemId } = JSON.parse(readFileSync("./system.json", "utf-8"));

const staticFileFolders = ["lang", "packs", "templates"];

export default {
  input: "src/ose.js",
  output: {
    file: "dist/ose.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: { __SYSTEM_ID__: systemId },
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        outDir: "dist",
      },
    }),
    copy({
      targets: staticFileFolders.map((folderName) => ({
        src: `src/${folderName}`,
        dest: "dist",
      })),
    }),
  ],
};
