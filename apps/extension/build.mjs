import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  const outdir = path.resolve(__dirname, "dist");
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
  }

  // Copy HTML & CSS
  fs.copyFileSync(
    path.resolve(__dirname, "src/popup/popup.html"),
    path.resolve(outdir, "popup.html")
  );
  fs.copyFileSync(
    path.resolve(__dirname, "src/popup/popup.css"),
    path.resolve(outdir, "popup.css")
  );

  // Bundle background, content, popup scripts
  await esbuild.build({
    entryPoints: {
      background: path.resolve(__dirname, "src/background/index.ts"),
      content: path.resolve(__dirname, "src/content/index.ts"),
      popup: path.resolve(__dirname, "src/popup/popup.ts"),
    },
    bundle: true,
    outdir,
    format: "esm",
    target: ["chrome110"],
    sourcemap: true,
    logLevel: "info",
  });

  console.log("JobOS Extension build completed successfully.");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
