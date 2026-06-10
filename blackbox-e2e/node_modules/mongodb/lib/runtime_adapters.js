"use strict";
/* eslint-disable no-restricted-imports*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_DRIVER_REQUIRE_PROPERTY_NAME = void 0;
exports.resolveRuntimeAdapters = resolveRuntimeAdapters;
/**
 * @internal
 *
 * This propery can be set on the global object to allow the driver to require otherwise blocked modules.
 * This is used by our test suite to allow tests to access the `os` module without allowing user code to do so.
 */
exports.ALLOWED_DRIVER_REQUIRE_PROPERTY_NAME = 'allowedDriverRequire';
/**
 * @internal
 *
 * Given a MongoClientOptions, this function resolves the set of runtime options, providing Nodejs implementations if
 * not provided by in `options`, and returns a `Runtime`.
 */
function resolveRuntimeAdapters(options) {
    globalThis[exports.ALLOWED_DRIVER_REQUIRE_PROPERTY_NAME] = true;
    try {
        const runtime = {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            os: options.runtimeAdapters?.os ?? require('os')
        };
        return runtime;
    }
    finally {
        globalThis[exports.ALLOWED_DRIVER_REQUIRE_PROPERTY_NAME] = false;
    }
}
//# sourceMappingURL=runtime_adapters.js.map