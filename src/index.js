/**
 * Public entry point for the ear-clipping triangulator.
 *
 * Re-exports the core implementation so consumers depend on `src/index.js`
 * rather than reaching into `src/core.js`. This keeps the public surface
 * stable if the internals get reorganized later.
 */

export { triangulate } from "./core.js";
