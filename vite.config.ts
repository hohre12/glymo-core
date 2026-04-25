import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Multi-entry library build for @glymo/core.
//
// We run TWO logical builds in a single config (selected via the `BUILD_TARGET`
// env var, set by the npm scripts):
//
//   1. `library` (default, plus all subpaths except the worker)
//      - `src/index.ts`              → dist/glymo.{mjs,js}
//      - `src/classifier/index.ts`   → dist/classifier/classifier.{mjs,js}
//      - shared chunks live in dist/ as Rollup decides
//
//   2. `worker`
//      - `src/classifier/classifier.worker.ts` → dist/classifier/classifier.worker.{mjs,js}
//      - emitted as a single self-contained bundle (no shared chunks),
//        so consumer bundlers can copy the file as a Web Worker asset
//        without chasing `../shared.js` references that live outside
//        `dist/classifier/`.
//
// The worker MUST be standalone because consumer apps construct it with the
// canonical idiom
//   new Worker(new URL('@glymo/core/classifier/classifier.worker.js',
//                      import.meta.url), { type: 'module' });
// Webpack / Next.js Turbopack / Vite all resolve that pattern at build time
// and copy the worker file as a hashed asset, but they do NOT recursively
// follow the worker's own imports through `node_modules` — so any chunk
// reference outside the published worker file would 404 at runtime.
//
// Two passes (rather than one) is the canonical solution; see
// docs/plans/drawing-classifier-migration.md §7.1 + R3.

const target = process.env.BUILD_TARGET ?? 'library';

export default defineConfig(() => {
  if (target === 'worker') {
    return {
      build: {
        emptyOutDir: false,
        lib: {
          entry: 'src/classifier/classifier.worker.ts',
          formats: ['es', 'cjs'],
          fileName: (format) =>
            format === 'es'
              ? 'classifier/classifier.worker.mjs'
              : 'classifier/classifier.worker.js',
        },
        rollupOptions: {
          // Worker must be fully self-contained. Consumer bundlers
          // (webpack / Next.js Turbopack / Vite) treat the worker file as
          // a raw URL asset via `new URL(..., import.meta.url)` and copy
          // it to `/_next/static/media/` without re-bundling. Any bare
          // module specifier left in the worker (e.g. `onnxruntime-web`)
          // cannot be resolved by the browser's module worker loader at
          // runtime and silently fails to load — no console error, just
          // a dead classifier. This is the single reason the 0.10.0
          // worker bundle was broken end-to-end in production.
          //
          // `onnxruntime-web` is therefore NOT external for this pass;
          // Rollup inlines it into the worker output (~MB gzipped, but
          // the alternative is a non-functional worker). The WASM backend
          // still fetches its own `.wasm` / `.jsep.wasm` files lazily at
          // runtime — those are loaded by the bundled ORT Web JS itself
          // via cross-origin fetch, so they do not need to be part of
          // this bundle.
          //
          // The library build (below) keeps `onnxruntime-web` external
          // because the library subpath IS re-bundled by the consumer's
          // webpack, and consumers declare `onnxruntime-web` as a peer
          // dependency for deduplication.
          output: {
            // Force a single self-contained bundle. Vite 8 / new Rollup
            // canonical option for "do not split into shared chunks".
            // (Without this, Rollup hoists shared imports like `model-cache`
            // into a sibling `../model-cache-*.js` chunk that lives outside
            // the published worker file and 404s in consumer apps because
            // bundlers like Next.js / webpack do NOT recursively follow
            // worker imports through `node_modules`.)
            codeSplitting: false,
          },
        },
        target: 'es2022',
        minify: 'esbuild',
        sourcemap: true,
      },
    };
  }

  return {
    plugins: [
      dts({
        rollupTypes: false,
        exclude: ['tests/**', 'src/**/__tests__/**'],
      }),
    ],
    build: {
      emptyOutDir: true,
      lib: {
        entry: {
          index: 'src/index.ts',
          'classifier/classifier': 'src/classifier/index.ts',
          // Phase 6 sub-slice 6a-1 — `@glymo/core/render` subpath that
          // hosts the new SceneGraph + Layer types. Loaded only by the
          // post-Phase-6 single-canvas codepath in `@glymo/ui`; the legacy
          // CanvasRenderer / WebGPURenderer paths still come in via the
          // root `index` entry so consumers on the pre-flag branch pay
          // zero cost.
          'render/index': 'src/render/index.ts',
        },
        name: 'Glymo',
        formats: ['es', 'cjs'],
        // Root subpath keeps its historical `glymo.{mjs,js}` filenames; the
        // classifier subpath lands under the directory implied by the entry
        // key. Switching the root entry filename would break every existing
        // @glymo/core consumer, so it stays pinned.
        fileName: (format, entryName) => {
          const ext = format === 'es' ? 'mjs' : 'js';
          if (entryName === 'index') {
            return `glymo.${ext}`;
          }
          return `${entryName}.${ext}`;
        },
      },
      rollupOptions: {
        external: [
          '@mediapipe/tasks-vision',
          'three',
          /^three\//,
          // Classifier-only peerDependency — opt-in for consumers via the
          // `@glymo/core/classifier` subpath, declared optional in
          // package.json.peerDependenciesMeta.
          'onnxruntime-web',
        ],
      },
      target: 'es2022',
      minify: 'esbuild',
      sourcemap: true,
    },
  };
});
