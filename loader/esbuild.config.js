import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const minify = process.argv.includes("--minify");

const options = {
  entryPoints: [
    "src/aqProtocolLoader.js",
	"src/aqBoot.js",
  ],
  bundle: true,
  format: "iife",
  target: "es2020",
  banner: { js: '"use strict";' },
  outdir: "../js/",
  minify
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching…");
} else {
  await esbuild.build(options);
}