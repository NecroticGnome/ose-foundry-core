import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

const staticFileFolders = ["lang", "packs", "templates"];

export default {
  input: "src/ose.js",
  output: {
    file: "dist/ose.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
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
