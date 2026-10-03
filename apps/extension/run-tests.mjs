import * as esbuild from "esbuild";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  const outfile = path.resolve(__dirname, "dist/test-bundle.mjs");
  
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "tests/extension.test.mjs")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    external: ["jsdom"],
  });

  // Run the bundled test with node
  await import(`file://${outfile}`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
