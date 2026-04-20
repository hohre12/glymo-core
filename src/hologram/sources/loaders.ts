// ── Compressed-Asset Loader Singletons ───────────────────────────────────────
//
// Lazy-init wrappers around three's KTX2Loader (Basis Universal texture
// transcoding) and DRACOLoader (mesh compression). Both are infra-level
// wires for the GLTF / GLB pipeline — registering them on every GLTFLoader
// instance means a future curated asset can ship as a Draco-encoded GLB or
// embed `.ktx2` textures and the existing per-source load() will parse it
// without further code changes. Current curated catalog GLBs are
// uncompressed and parse fine without these wires; the registration is a
// no-op when the GLB does not use the corresponding extension.
//
// Why singletons? Each loader instance allocates a WASM transcoder /
// decoder behind the scenes (KTX2Loader spins up a worker pool inside
// three's BasisTextureLoader). Re-creating per load() would leak workers
// across the page lifetime — three's own examples/jsm/loaders/* docs treat
// these as one-per-app singletons.
//
// Decoder paths default to `/three/{basis,draco}/` under the host's public
// root. Hosts that serve from a non-root pathname (e.g. Next.js with
// `basePath`) MUST call `setLoaderDecoderPaths({ basis, draco })` before
// the first source.load() call. The setter resets the cached singletons so
// the next access picks up the new paths.
//
// Lazy dynamic import: both `three/examples/jsm/loaders/{KTX2,DRACO}Loader`
// stay out of the initial bundle until a source actually wires them. This
// matches the renderer's own lazy-import pattern for `three/webgpu` and
// keeps the text-mode-only payload small.

let ktx2Path = '/three/basis/';
let dracoPath = '/three/draco/';
let ktx2Loader: unknown = null;
let dracoLoader: unknown = null;

/**
 * Override the default decoder paths. Call BEFORE the first source.load()
 * fires so the singletons pick up the new mount; calling later resets the
 * cached instances and the next access re-creates them with the new path
 * (existing already-registered loaders inside in-flight GLTFLoader calls
 * still reference the OLD instance — only future load() calls observe the
 * change).
 */
export function setLoaderDecoderPaths(paths: { ktx2?: string; draco?: string }): void {
  if (paths.ktx2 !== undefined) ktx2Path = paths.ktx2;
  if (paths.draco !== undefined) dracoPath = paths.draco;
  // Reset cached singletons so the next access reads the new path.
  ktx2Loader = null;
  dracoLoader = null;
}

/**
 * Resolve the shared KTX2Loader singleton, lazily importing `three/examples
 * /jsm/loaders/KTX2Loader.js` on first call. The transcoder path defaults to
 * `/three/basis/` and is overridable via {@link setLoaderDecoderPaths}.
 *
 * Note: KTX2Loader requires a one-time `detectSupport(renderer)` call against
 * a live WebGPU renderer to determine which transcode target to request from
 * the WASM transcoder. Sources that load standalone `.ktx2` textures (not
 * embedded inside a GLB) need to plumb the renderer reference through to
 * call detectSupport themselves; the GLTFLoader path handles support
 * detection internally when given a configured KTX2Loader.
 *
 * `deps` is reserved for future expansion (e.g. renderer reference for
 * detectSupport). Currently unused but kept in the signature so callers do
 * not need to refactor when that wiring lands.
 */
export async function getKtx2Loader(_deps: {
  THREE: typeof import('three/webgpu');
}): Promise<unknown> {
  if (ktx2Loader) return ktx2Loader;
  const mod = await import('three/examples/jsm/loaders/KTX2Loader.js');
  const KTX2LoaderClass = mod.KTX2Loader;
  const loader = new KTX2LoaderClass();
  (loader as { setTranscoderPath: (p: string) => unknown }).setTranscoderPath(ktx2Path);
  ktx2Loader = loader;
  return loader;
}

/**
 * Resolve the shared DRACOLoader singleton, lazily importing `three/examples
 * /jsm/loaders/DRACOLoader.js` on first call. The decoder path defaults to
 * `/three/draco/` and is overridable via {@link setLoaderDecoderPaths}.
 */
export async function getDracoLoader(): Promise<unknown> {
  if (dracoLoader) return dracoLoader;
  const mod = await import('three/examples/jsm/loaders/DRACOLoader.js');
  const DRACOLoaderClass = mod.DRACOLoader;
  const loader = new DRACOLoaderClass();
  (loader as { setDecoderPath: (p: string) => unknown }).setDecoderPath(dracoPath);
  dracoLoader = loader;
  return loader;
}

/**
 * Test-only — clear the cached singletons so the next get* call
 * re-instantiates. Production code MUST NOT call this; the singletons exist
 * specifically because re-creating them leaks WASM workers.
 */
export function __resetLoaderSingletonsForTest(): void {
  ktx2Loader = null;
  dracoLoader = null;
}
