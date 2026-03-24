#!/usr/bin/env node
/* eslint-env node */
/* global process */

/**
 * @fileoverview Main entry point for the Tenet CSS build system.
 *
 * This file registers all build tasks and provides the CLI interface for:
 * - Production builds (`npm run build`)
 * - Development mode with file watching (`npm run develop`)
 * - Linting (`npm run lint`)
 *
 * @module build
 * @see {@link ./build_modules/config.js} for configuration
 * @see {@link ./build_modules/task_registry.js} for task runner implementation
 */

import colors from "picocolors";
import fs from "fs";
import { cleanCss, lintStylus, minifyCss, removeCssSourceMapReferences, transpileStylus } from "./build_modules/tasks/stylus.js";
import { cleanJavaScript, lintJavaScript, minifyJavaScript, removeJsSourceMapReferences, transpileJavaScript } from "./build_modules/tasks/javascript_esbuild.js";
import { createBuildProgress, isQuietMode, isVerboseMode, log, logPhase, logSuccess, printBuildSummary, recordTaskCompletion, recordTaskStart, writeBuildStats } from "./build_modules/utilities.js";
import { createTaskRunner } from "./build_modules/task_registry.js";
import { createWatcher } from "./build_modules/tasks/watcher.js";
import { ENV } from "./build_modules/config.js";
import { minifyImages } from "./build_modules/tasks/images.js";

/**
 * Create and configure the task runner with all build tasks.
 *
 * Registers the following tasks:
 * - **Clean tasks**: 
 *      `clean`, `clean-js`, `clean-css`
 * - **JavaScript tasks**: 
 *      `lint-js`, `transpile-js`, `minify-js`, `remove-js-sourcemap`, `build-js`
 * - **CSS tasks**: 
 *      `lint-stylus`, `transpile-stylus`, `minify-css`, `remove-css-sourcemap`, `build-css`
 * - **Image tasks**: 
 *      `minify-images`
 * - **Meta tasks**: 
 *      `build`, `develop`, `lint`
 *
 * @returns {TaskRegistry} Configured task runner instance with all tasks registered.
 * @see {@link ./build_modules/task_registry.js} for TaskRegistry implementation.
 */
function setupTaskRunner () {
    const runner = createTaskRunner();

    /**
     * Helper function to register a simple task with default options.
     * @param {string} name - Task name.
     * @param {Function} fn - Task function to execute.
     * @param {Object} [options={}] - Task options (description, dependencies, etc.).
     */
    const registerSimpleTask = (name, fn, options = {}) => {
        runner.registerTask(name, fn, options);
    };

    /**
     * Register clean tasks.
     */
    registerSimpleTask("clean-js", cleanJavaScript, {
        description: "Clean JavaScript files",
    });

    registerSimpleTask("clean-css", cleanCss, {
        description: "Clean CSS files",
    });

    runner.registerTask("clean", async () => {
        log("Cleaning all generated assets...", "INFO", "Clean");
        await runner.runParallel(["clean-js", "clean-css"]);
        log("All assets cleaned", "INFO", "Clean");
    }, {
        description: "Clean all generated assets",
        dependencies: [],
        parallel: true,
    });

    /**
     * Register JavaScript tasks.
     */
    runner.registerTask("lint-js", async () => {
        return await lintJavaScript(ENV.fix);
    }, {
        description: "Lint JavaScript files",
        critical: !ENV.isDevelopment,
    });

    registerSimpleTask("transpile-js", transpileJavaScript, {
        description: "Transpile and bundle JavaScript",
    });

    registerSimpleTask("minify-js", minifyJavaScript, {
        description: "Minify JavaScript",
        dependencies: ["transpile-js"],
    });

    registerSimpleTask("remove-js-sourcemap", removeJsSourceMapReferences, {
        description: "Remove JavaScript sourcemap references",
        dependencies: ["minify-js"],
    });

    runner.registerTask("build-js", async () => {
        log("Building JavaScript...", "INFO", "JavaScript");
        await runner.runSequence([
            "lint-js",
            "transpile-js",
            "minify-js",
            "remove-js-sourcemap",
        ]);
        log("JavaScript build complete", "INFO", "JavaScript");
    }, {
        description: "Build JavaScript (lint, transpile, minify)",
        critical: !ENV.isDevelopment,
    });

    /**
     * Register Stylus tasks.
     */
    registerSimpleTask("lint-stylus", lintStylus, {
        description: "Lint Stylus files",
        critical: false,
    });

    registerSimpleTask("transpile-stylus", transpileStylus, {
        description: "Transpile Stylus to CSS",
    });

    registerSimpleTask("minify-css", minifyCss, {
        description: "Minify CSS",
        dependencies: ["transpile-stylus"],
    });

    registerSimpleTask("remove-css-sourcemap", removeCssSourceMapReferences, {
        description: "Remove CSS sourcemap references",
        dependencies: ["minify-css"],
    });

    runner.registerTask("build-css", async () => {
        log("Building CSS...", "INFO", "Stylus");
        await runner.runSequence([
            "lint-stylus",
            "transpile-stylus",
            "minify-css",
            "remove-css-sourcemap",
        ]);
        log("CSS build complete", "INFO", "Stylus");
    }, {
        description: "Build CSS (lint, transpile, minify)",
        critical: !ENV.isDevelopment,
    });

    /**
     * Register image task.
     */
    registerSimpleTask("minify-images", minifyImages, {
        description: "Minify images",
    });

    /**
     * Register development task.
     */
    runner.registerTask("develop", async () => {
        if (!isQuietMode) {
            logPhase("Development Mode", "Setting up file watching and incremental builds");
        }

        const devProgress = createBuildProgress(["clean", "initial-build", "watch"]);

        // Initial clean and build.
        devProgress.startTask("Setup", "Preparing development environment");
        try {
            await runner.runParallel(["build-js", "build-css"]);
            devProgress.completeTask("Initial build completed");
        } catch {
            /**
             * In development mode, continue with watcher setup even if initial build fails. This
             * allows developers to fix issues and have the watcher pick up changes.
             */
            devProgress.completeTask("Initial build completed with errors - continuing with file watcher", false);
            log("Initial build failed, but starting file watcher anyway", "WARNING", "Development");
            log("Fix the errors and save files to retry builds", "INFO", "Development");
        }

        // Start file watchers.
        devProgress.startTask("Watcher", "Starting file system monitoring");
        const watcher = createWatcher(runner);
        await watcher.initialise();
        devProgress.completeTask("File watcher ready");

        if (!isQuietMode) {
            logSuccess("Development mode active", "Watching for file changes...");
            console.log(colors.gray("Press Ctrl+C to stop")); // eslint-disable-line no-console
        }

        // Handle process termination.
        process.on("SIGINT", async () => {
            if (!isQuietMode) {
                logPhase("Shutdown", "Cleaning up development resources");
            }
            await watcher.close();
            writeBuildStats();
            if (isVerboseMode) {
                printBuildSummary();
            }
            process.exit(0);
        });
    }, {
        description: "Start development mode with file watching",
        dependencies: ["clean"],
    });

    /**
     * Register build task.
     */
    runner.registerTask("build", async () => {
        recordTaskStart("build");

        // Create build progress tracker.
        const buildProgress = createBuildProgress(["clean", "build-js", "build-css", "minify-images"]);

        if (!isQuietMode) {
            logPhase("Production Build", "Building optimized assets for deployment");
        }

        // Run clean first.
        buildProgress.startTask("Clean", "Removing previous build artifacts");
        await runner.runTask("clean");
        buildProgress.completeTask("Build artifacts cleaned");

        // Run all build tasks in parallel.
        buildProgress.startTask("Assets", "Building JavaScript, CSS, and images");
        await runner.runParallel([
            "build-js",
            "build-css",
            "minify-images",
        ]);
        buildProgress.completeTask("All assets built successfully");

        // Write build stats and print summary.
        writeBuildStats();

        buildProgress.complete({
            files: {
                processed: 0,
                cached: 0,
            },
        });

        if (!isQuietMode) {
            printBuildSummary();
        }

        recordTaskCompletion("build", true);
    }, {
        description: "Build for production",
    });

    /**
     * Register standalone lint task for CLI usage.
     */
    runner.registerTask("lint", async () => {
        const fix = process.argv.includes("--fix");
        const progress = createBuildProgress(["lint"]);

        const actionText = fix ? "Linting and fixing JavaScript files" : "Linting JavaScript files";
        progress.startTask("Lint", actionText);

        try {
            const result = await lintJavaScript(fix);
            if (result && typeof result === "object" && !result.message) {
                const message = fix ? "JavaScript linting and fixing completed" : "JavaScript linting completed - no issues found";
                progress.completeTask(message);
                return result;
            } else if (result instanceof Error) {
                throw result;
            }
        } catch (error) {
            progress.completeTask(`Linting failed: ${error.message}`, false);
            throw error;
        }
    }, {
        description: "Lint JavaScript files",
        critical: true,
    });

    return runner;
}

/**
 * Set up file logging if the `--log-file` flag is provided.
 *
 * When enabled, all stdout and stderr output is duplicated to the specified log file.
 * This is useful for CI environments or debugging build issues.
 *
 * @returns {string|null} Path to the log file if logging is enabled, null otherwise.
 * @example
 * // Enable logging with default filename
 * node build.js build --log-file
 *
 * // Enable logging with custom filename
 * node build.js build --log-file custom.log
 */
function setupFileLogging () {
    const logFileIndex = process.argv.indexOf("--log-file");
    if (logFileIndex === -1) {
        return null;
    }

    // Get log file path (either next argument or default).
    const logFilePath = logFileIndex + 1 < process.argv.length && !process.argv[logFileIndex + 1].startsWith("--")
        ? process.argv[logFileIndex + 1]
        : "build_output.log";

    // Create write stream for log file.
    const logStream = fs.createWriteStream(logFilePath, { flags: "w" });

    // Store original write methods.
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    // Override write methods to also write to log file.
    process.stdout.write = function (chunk, ...args) {
        logStream.write(chunk);
        return originalStdoutWrite.call(process.stdout, chunk, ...args);
    };

    process.stderr.write = function (chunk, ...args) {
        logStream.write(chunk);
        return originalStderrWrite.call(process.stderr, chunk, ...args);
    };

    // Close log stream on exit.
    process.on("exit", () => {
        logStream.end();
    });

    return logFilePath;
}

/**
 * Display help information and usage examples.
 *
 * Shows available commands, options, and example usage.
 * Called when no command is provided or when `--help` flag is used.
 *
 * @returns {void}
 */
function showHelp () {
    /* eslint-disable no-console */
    console.log("\n" + colors.bold("Frontend Build System"));
    console.log(colors.gray("A modern build system for JavaScript, CSS, and assets\n"));

    console.log(colors.bold("Usage:"));
    console.log("  node build.js <command> [options]\n");

    console.log(colors.bold("Commands:"));
    console.log("  build           Build for production (clean, transpile, minify)");
    console.log("  develop         Start development mode with file watching");
    console.log("  lint            Lint JavaScript files");
    console.log("  clean           Remove all generated assets");
    console.log("  build-js        Build only JavaScript assets");
    console.log("  build-css       Build only CSS assets");
    console.log("  minify-images   Optimize image assets\n");

    console.log(colors.bold("Options:"));
    console.log("  --fix           Automatically fix linting issues where possible");
    console.log("  --verbose       Show detailed output and timing information");
    console.log("  --quiet         Show minimal output (errors only)");
    console.log("  --log-file [path]  Write all output to a log file\n");

    console.log(colors.bold("Examples:"));
    console.log(colors.green("  node build.js build") + colors.gray("          # Build for production"));
    console.log(colors.green("  node build.js develop") + colors.gray("        # Start development mode"));
    console.log(colors.green("  node build.js lint --fix") + colors.gray("    # Lint and auto-fix JavaScript"));
    console.log(colors.green("  node build.js build --verbose") + colors.gray(" # Build with detailed output\n"));
    /* eslint-enable no-console */
}

/**
 * Main entry point for the build system.
 *
 * Parses command-line arguments, sets up logging, and executes the requested task.
 * Exits with code 0 on success, 1 on error.
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the requested task fails.
 */
async function main () {
    // Setup file logging if requested.
    const logFile = setupFileLogging();
    if (logFile) {
        log(`Logging output to ${logFile}`, "INFO", "Build");
    }

    try {
        const cmd = process.argv[2];

        // Validate command or show help.
        if (!cmd || cmd === "--help" || cmd === "-h") {
            showHelp();
            process.exit(!cmd ? 1 : 0);
        }

        await setupTaskRunner().runTask(cmd);

        // Log completion message for file logging.
        if (logFile) {
            log(`\nCompleted successfully. Output written to ${logFile}`, "INFO", "Build");
        }
    } catch (error) {
        if (error.stack) {
            log(error.stack, "ERROR");
        } else {
            log(`Fatal error: ${error.message}`, "ERROR");
        }

        if (logFile) {
            log(`\nFailed with errors. Output written to ${logFile}`, "ERROR", "Build");
        }

        process.exit(1);
    }
}

// Run the build system.
main();
