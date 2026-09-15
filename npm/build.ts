// deno-lint-ignore no-import-prefix
import { build, emptyDir } from "jsr:@deno/dnt@^0.43.2"
import denoJson from "../deno.json" with { type: "json" }

const OUT_DIR = "./dist"

await emptyDir(OUT_DIR)

await build({
  entryPoints: ["./mod.ts"],
  outDir: OUT_DIR,
  shims: {},
  scriptModule: false,
  test: false,
  package: {
    name: denoJson.name,
    version: denoJson.version,
    description: "Onamea Workers",
    license: denoJson.license,
    publishConfig: { access: "public" },
    exports: {
      ".": {
        types: "./esm/mod.d.ts",
        import: "./esm/mod.js"
      }
    }
  },
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM"]
  },
  filterDiagnostic(diagnostic) {
    if (!diagnostic.file?.fileName.endsWith("_dnt.polyfills.ts")) return true
    return diagnostic.code !== 2591 && diagnostic.code !== 2552
  },
  postBuild() {
    Deno.copyFileSync("README.md", `${ OUT_DIR }/README.md`)
  }
})
