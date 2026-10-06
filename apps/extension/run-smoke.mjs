import * as esbuild from "esbuild";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSmokeTest() {
  const outfile = path.resolve(__dirname, "dist/smoke-bundle.mjs");

  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "smoke-test.mjs")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    external: ["jsdom"],
  });

  // Run the bundled test with node
  await import(`file://${outfile}`);
}

runSmokeTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
