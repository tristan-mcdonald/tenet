/**
 * @fileoverview Centralised configuration for the Tenet CSS build system.
 *
 * This module exports three main configuration objects:
 * - {@link ENV} - Environment settings and build profiles
 * - {@link PATHS} - File and directory path configuration
 * - {@link TOOLS} - Tool-specific configuration options
 *
 * @module config
 */

import path from "path";
import { ensureDirectoryExists } from "./utilities.js";
import { fileURLToPath } from "url";

/**
 * ES module compatibility - get current file path.
 * @private
 * @type {string}
 */
const __filename = fileURLToPath(import.meta.url);

/**
 * ES module compatibility - get current directory path.
 * @private
 * @type {string}
 */
const __dirname = path.dirname(__filename);

/*
 * ============================================================================
 * Directory Path Constants
 * ============================================================================
 */

/**
 * Absolute path to the source directory (`source/`).
 * @private
 * @type {string}
 */
const SOURCE = path.resolve(__dirname, "../../..");

/**
 * Absolute path to the project root directory.
 * @private
 * @type {string}
 */
const ROOT = path.resolve(__dirname, "../../../../..");

/**
 * Absolute path to the source assets directory (`source/assets/`).
 * @private
 * @type {string}
 */
const ASSETS = path.join(SOURCE, "assets");

/**
 * Absolute path to the build tools directory (`source/build_tools/`).
 * @private
 * @type {string}
 */
const BUILD_TOOLS = path.join(SOURCE, "build_tools");

/**
 * Absolute path to the cache directory (`.cache/`).
 * @private
 * @type {string}
 */
const CACHE = path.join(BUILD_TOOLS, "user_interface/.cache");

/**
 * Absolute path to the distribution/output directory (`distribution/assets/`).
 * @private
 * @type {string}
 */
const STATIC = path.join(SOURCE, "../distribution/assets");

// Ensure that cache directory exists on module load.
ensureDirectoryExists(CACHE);

/*
 * ============================================================================
 * Path Helper Functions
 * ============================================================================
 */

/**
 * Path helper functions for generating absolute paths.
 *
 * Each function takes path segments and joins them with the corresponding base path.
 *
 * @private
 * @type {Object}
 * @property {Function} assets - Generate path relative to `source/assets/`.
 * @property {Function} buildTools - Generate path relative to `source/build_tools/`.
 * @property {Function} cache - Generate path relative to `.cache/`.
 * @property {Function} root - Generate path relative to project root.
 * @property {Function} source - Generate path relative to `source/`.
 * @property {Function} static - Generate path relative to `distribution/assets/`.
 *
 * @example
 * basePaths.assets("js/app.js") // => "/path/to/source/assets/js/app.js"
 * basePaths.static("css")       // => "/path/to/distribution/assets/css"
 */
const basePaths = {
    assets: (...parts) => path.join(ASSETS, ...parts),
    buildTools: (...parts) => path.join(BUILD_TOOLS, ...parts),
    cache: (...parts) => path.join(CACHE, ...parts),
    root: (...parts) => path.join(ROOT, ...parts),
    source: (...parts) => path.join(SOURCE, ...parts),
    static: (...parts) => path.join(STATIC, ...parts),
};

/*
 * ============================================================================
 * Environment Configuration (ENV)
 * ============================================================================
 */

/**
 * @typedef {Object} BuildProfile
 * @property {boolean} minify - Whether to minify output files.
 * @property {boolean} sourceMaps - Whether to generate source maps.
 * @property {boolean} cache - Whether to use file caching.
 * @property {boolean} stats - Whether to track build statistics.
 */

/**
 * Environment configuration and build profiles.
 *
 * Contains environment detection, CLI flags, and profile-based settings.
 *
 * @type {Object}
 * @property {boolean} isDevelopment - True if running in development mode.
 * @property {boolean} sourceMaps - True if source maps should be generated.
 * @property {boolean} isCI - True if running in a CI environment.
 * @property {boolean} fix - True if `--fix` flag was passed (for linting).
 * @property {Object} profiles - Build profile definitions.
 * @property {BuildProfile} profiles.development - Development profile settings.
 * @property {BuildProfile} profiles.production - Production profile settings.
 * @property {BuildProfile} activeProfile - The currently active profile (getter).
 *
 * @example
 * if (ENV.isDevelopment) {
 *     console.log("Running in development mode");
 * }
 *
 * if (ENV.activeProfile.minify) {
 *     // Minify the output
 * }
 */
const ENV = {
    /** @type {boolean} True if NODE_ENV is not "production" and command is not "build". */
    isDevelopment: process.env.NODE_ENV !== "production" && process.argv[2] !== "build",

    /** @type {boolean} True unless SOURCE_MAPS environment variable is "false". */
    sourceMaps: process.env.SOURCE_MAPS !== "false",

    /** @type {boolean} True if CI, GITHUB_ACTIONS, or GITLAB_CI environment variable is "true". */
    isCI: process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.GITLAB_CI === "true",

    /** @type {boolean} True if --fix flag was passed via command line. */
    fix: process.argv.includes("--fix"),

    /**
     * Build profile definitions.
     * @type {Object.<string, BuildProfile>}
     */
    profiles: {
        /** Development profile - no minification, source maps enabled. */
        development: {
            minify: false,
            sourceMaps: true,
            cache: true,
            stats: true,
        },
        /** Production profile - minification enabled, no source maps. */
        production: {
            minify: true,
            sourceMaps: false,
            cache: true,
            stats: true,
        },
    },

    /**
     * Get the currently active build profile based on environment.
     * @returns {BuildProfile} The active profile settings.
     */
    get activeProfile () {
        return this.isDevelopment ? this.profiles.development : this.profiles.production;
    },
};

/*
 * ============================================================================
 * File Paths Configuration (PATHS)
 * ============================================================================
 */

/**
 * @typedef {Object} JavaScriptPaths
 * @property {string} config - Path to ESLint configuration file.
 * @property {string} input - Path to JavaScript entry file.
 * @property {string} output - Path to JavaScript output directory.
 * @property {string} transpiled - Path to transpiled (non-minified) output.
 * @property {string} uglified - Path to minified output.
 * @property {string} cache - Path to JavaScript cache file.
 * @property {string[]} lint - Array of glob patterns for files to lint.
 */

/**
 * @typedef {Object} CssPaths
 * @property {string} config - Path to Stylint configuration file.
 * @property {string} input - Path to Stylus entry file.
 * @property {string} output - Path to CSS output directory.
 * @property {string} uglified - Path to minified CSS output.
 * @property {string} cache - Path to CSS cache file.
 * @property {string} glob - Glob pattern for all CSS files.
 * @property {string} lint - Glob pattern for Stylus files to lint.
 */

/**
 * @typedef {Object} ImagePaths
 * @property {string} input - Glob pattern for source images.
 * @property {string} output - Path to image output directory.
 * @property {string} base - Base path for calculating relative output paths.
 * @property {string} cache - Path to image cache file.
 */

/**
 * File paths configuration for all build tasks.
 *
 * All paths are absolute and generated using the `basePaths` helper functions.
 *
 * @type {Object}
 * @property {string[]} deleteIgnore - Files to ignore when cleaning.
 * @property {JavaScriptPaths} js - JavaScript-related paths.
 * @property {CssPaths} css - CSS/Stylus-related paths.
 * @property {ImagePaths} images - Image-related paths.
 * @property {Object} develop - Development mode paths.
 * @property {Object} cache - Cache directory paths.
 * @property {Object} stats - Build statistics paths.
 * @property {Object} common - Common glob patterns for cleaning.
 */
const PATHS = {
    /**
     * Files to ignore when running clean tasks.
     * @type {string[]}
     */
    deleteIgnore: [],

    /**
     * JavaScript file paths and patterns.
     * @type {JavaScriptPaths}
     */
    js: {
        config: basePaths.buildTools("user_interface/eslint.config.mjs"),
        input: basePaths.assets("js/app.js"),
        output: basePaths.static("js"),
        transpiled: basePaths.static("js/app.js"),
        uglified: basePaths.static("js/app.min.js"),
        cache: basePaths.cache("js_cache.json"),
        lint: [
            basePaths.source("assets/js/app.js"),
            basePaths.source("assets/js/modules/**/*.js"),
            basePaths.source("build_tools/user_interface/build.js"),
            basePaths.source("build_tools/user_interface/build_modules/**/*.js"),
        ],
    },

    /**
     * CSS/Stylus file paths and patterns.
     * @type {CssPaths}
     */
    css: {
        config: basePaths.buildTools("user_interface/.stylintrc"),
        input: basePaths.assets("stylus/app.styl"),
        output: basePaths.static("css"),
        uglified: basePaths.static("css/app.min.css"),
        cache: basePaths.cache("css-cache.json"),
        glob: basePaths.static("css/**/*"),
        lint: basePaths.assets("stylus/**/*.styl"),
    },

    /**
     * Image file paths and patterns.
     * @type {ImagePaths}
     */
    images: {
        input: basePaths.assets("images/**/*.{png,jpg,jpeg}"),
        output: basePaths.static("images"),
        base: basePaths.assets("images"),
        cache: basePaths.cache("images-cache.json"),
    },

    /**
     * Development mode paths.
     * @type {Object}
     * @property {string} readyFile - File created when watchers are ready.
     */
    develop: {
        readyFile: basePaths.buildTools(".user_interface_build_ready"),
    },

    /**
     * Cache directory paths.
     * @type {Object}
     * @property {string} directory - Cache directory path.
     * @property {string} manifest - Cache manifest file path.
     */
    cache: {
        directory: CACHE,
        manifest: basePaths.cache("manifest.json"),
    },

    /**
     * Build statistics paths.
     * @type {Object}
     * @property {string} output - Build statistics JSON file path.
     */
    stats: {
        output: basePaths.cache("build-stats.json"),
    },

    /**
     * Common glob patterns for cleaning generated files.
     * @type {Object}
     * @property {string} css - Glob pattern for all generated CSS files.
     * @property {string} js - Glob pattern for all generated JS files.
     */
    common: {
        css: basePaths.static("css/**/*"),
        js: basePaths.static("js/**/*"),
    },
};

/*
 * ============================================================================
 * Tool Configuration (TOOLS)
 * ============================================================================
 */

/**
 * Tool-specific configuration options.
 *
 * Contains settings for each build tool: ESBuild, Stylus, PostCSS, ImageMin, etc.
 *
 * @type {Object}
 * @property {Object} browserify - Browserify configuration (legacy, unused).
 * @property {Object} babel - Babel configuration (legacy, unused).
 * @property {Object} terser - Terser minification options (legacy, unused).
 * @property {Object} eslint - ESLint configuration.
 * @property {Object} esbuild - ESBuild bundler configuration.
 * @property {Object} stylus - Stylus compiler configuration.
 * @property {Object} stylint - Stylint linter configuration.
 * @property {Object} postcss - PostCSS plugin configuration.
 * @property {Object} cleanCss - CleanCSS minifier configuration.
 * @property {Object} imagemin - ImageMin optimiser configuration.
 * @property {Object} watch - File watcher patterns.
 */
const TOOLS = {
    /**
     * Browserify configuration (legacy - kept for reference).
     * @deprecated Use esbuild instead.
     */
    browserify: {
        debug: ENV.activeProfile.sourceMaps,
        extensions: [".js"],
        paths: [basePaths.assets("js")],
    },

    /**
     * Babel configuration (legacy - kept for reference).
     * @deprecated ESBuild handles transpilation.
     */
    babel: {
        presets: ["@babel/preset-env"],
    },

    /**
     * Terser minification options (legacy - kept for reference).
     * @deprecated ESBuild handles minification.
     */
    terser: {
        compress: {
            deadCode: true,
            dropConsole: !ENV.isDevelopment,
            dropDebugger: !ENV.isDevelopment,
        },
        mangle: true,
        sourceMap: ENV.activeProfile.sourceMaps,
    },

    /**
     * ESLint configuration.
     * @type {Object}
     * @property {string} configFile - Path to ESLint configuration file.
     */
    eslint: {
        configFile: PATHS.js.config,
    },

    /**
     * ESBuild bundler configuration.
     * @type {Object}
     * @property {string[]} target - Browser/ES version targets.
     * @property {Object} loader - File extension to loader mapping.
     * @property {Object} define - Global constant definitions.
     */
    esbuild: {
        target: [
            "chrome80",
            "edge80",
            "es2020",
            "firefox78",
            "safari13",
        ],
        loader: { ".js": "js" },
        define: {
            "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
        },
    },

    /**
     * Stylus compiler configuration.
     * @type {Object}
     * @property {boolean} compress - Whether to compress output (handled by CleanCSS).
     * @property {Object|boolean} sourcemap - Source map options or false to disable.
     * @property {string[]} use - Stylus plugins to use.
     */
    stylus: {
        compress: ENV.activeProfile.minify,
        sourcemap: ENV.activeProfile.sourceMaps ? { inline: true } : false,
        use: ["rupture"],
    },

    /**
     * Stylint linter configuration.
     * @type {Object}
     * @property {string} configFile - Path to Stylint configuration file.
     */
    stylint: {
        configFile: PATHS.css.config,
    },

    /**
     * PostCSS plugin configuration.
     * @type {Object}
     * @property {string[]} plugins - PostCSS plugins to use.
     */
    postcss: {
        plugins: ["autoprefixer", "css-mqpacker"],
    },

    /**
     * CleanCSS minifier configuration.
     * @type {Object}
     * @property {number} level - Optimisation level (0-2).
     * @property {boolean} sourceMap - Whether to generate source maps.
     */
    cleanCss: {
        level: 2,
        sourceMap: ENV.activeProfile.sourceMaps,
    },

    /**
     * ImageMin optimiser configuration.
     * @type {Object}
     * @property {Object} mozjpeg - JPEG optimisation options.
     * @property {Object} pngquant - PNG optimisation options.
     */
    imagemin: {
        mozjpeg: {
            quality: 80,
            progressive: true,
        },
        pngquant: {
            quality: [0.65, 0.8],
            speed: 4,
        },
    },

    /**
     * File watcher patterns for development mode.
     * @type {Object}
     * @property {string[]} js - JavaScript file patterns to watch.
     * @property {string} stylus - Stylus file pattern to watch.
     * @property {string} images - Image file pattern to watch.
     */
    watch: {
        js: PATHS.js.lint,
        stylus: PATHS.css.lint,
        images: PATHS.images.input,
    },
};

/*
 * ============================================================================
 * Exports
 * ============================================================================
 */

export { ENV, PATHS, TOOLS };
