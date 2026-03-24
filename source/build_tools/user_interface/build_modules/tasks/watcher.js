/**
 * @fileoverview File watcher for development mode.
 *
 * Provides file system monitoring for automatic rebuilds during development:
 * - **JavaScript watcher**: Triggers lint → transpile → minify on JS changes
 * - **Stylus watcher**: Triggers lint → transpile → minify on Stylus changes
 * - **Image watcher**: Triggers optimisation on new/changed images
 *
 * Features:
 * - Debounced change handling (prevents rapid re-triggers)
 * - Error recovery (continues watching after errors)
 * - Ready file signal for external integration
 *
 * @module tasks/watcher
 * @see {@link ../config.js} for watch patterns
 */

import chokidar from "chokidar";
import fs from "fs";
import path from "path";

import { createContextualError, FileSystemError, ProcessError, ValidationError } from "../errors.js";
import { createTaskError, log } from "../utilities.js";
import { PATHS, TOOLS } from "../config.js";

/**
 * Default watcher options for Chokidar.
 * @type {Object}
 */
const DEFAULT_WATCHER_OPTIONS = {
    ignored: /(^|[/\\])\./, // Ignore dotfiles.
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
    },
};

/**
 * File watcher for development mode.
 */
export class Watcher {
    /**
     * Create a new watcher.
     * @param {Object} taskRunner - Task runner instance
     */
    constructor (taskRunner) {
        this._taskRunner = taskRunner;
        this._watchers = new Map();
        this._debounceTimers = new Map();
        this._isReady = false;
        this._debounceDelay = 300; // 3 second debounce.
    }

    /**
     * Get ready state.
     * @returns {boolean} - Whether the watcher is ready.
     */
    get isReady () {
        return this._isReady;
    }

    /**
     * Initialize the watcher with error handling.
     */
    async initialise () {
        try {
            log("Initializing file watchers...", "INFO", "Watcher");

            // Validate that required paths are configured.
            if (!PATHS.develop?.readyFile) {
                throw createTaskError(
                    ValidationError,
                    "Development ready file path is not configured",
                    "watcher-init",
                );
            }

            // Create ready file to signal that watchers are ready.
            try {
                if (fs.existsSync(PATHS.develop.readyFile)) {
                    fs.rmSync(PATHS.develop.readyFile);
                }
            } catch (error) {
                log(`Warning: Failed to remove existing ready file: ${error.message}`, "WARNING", "Watcher");
            }

            // Set up watchers with error handling.
            const watcherSetupPromises = [];

            try {
                watcherSetupPromises.push(this._setupJavaScriptWatcher());
            } catch (error) {
                throw createTaskError(
                    FileSystemError,
                    `Failed to set up JavaScript watcher: ${error.message}`,
                    "watcher-init",
                    null,
                    error,
                );
            }

            try {
                watcherSetupPromises.push(this._setupStylusWatcher());
            } catch (error) {
                throw createTaskError(
                    FileSystemError,
                    `Failed to set up Stylus watcher: ${error.message}`,
                    "watcher-init",
                    null,
                    error,
                );
            }

            try {
                watcherSetupPromises.push(this._setupImageWatcher());
            } catch (error) {
                throw createTaskError(
                    FileSystemError,
                    `Failed to set up image watcher: ${error.message}`,
                    "watcher-init",
                    null,
                    error,
                );
            }

            // Wait for all watchers to be set up.
            try {
                await Promise.all(watcherSetupPromises);
            } catch (error) {
                throw createTaskError(
                    ProcessError,
                    `Watcher setup failed: ${error.message}`,
                    "watcher-init",
                    null,
                    error,
                );
            }

            // Mark as ready and create ready file.
            this._isReady = true;

            try {
                fs.writeFileSync(PATHS.develop.readyFile, "");
            } catch (error) {
                // This is not critical, so just log a warning.
                log(`Warning: Failed to create ready file: ${error.message}`, "WARNING", "Watcher");
            }

            log("File watchers initialised and ready", "INFO", "Watcher");
            return true;
        } catch (error) {
            if (error instanceof FileSystemError || error instanceof ProcessError || error instanceof ValidationError) {
                throw error;
            }

            throw createTaskError(
                ProcessError,
                `Watcher initialization failed: ${error.message}`,
                "watcher-init",
                null,
                error,
            );
        }
    }

    /**
     * Set up JavaScript file watcher.
     * @private
     */
    async _setupJavaScriptWatcher () {
        const watcher = chokidar.watch(TOOLS.watch.js, DEFAULT_WATCHER_OPTIONS);

        watcher.on("change", (filePath) => {
            this._handleFileChange("javascript", filePath, async () => {
                log(`JavaScript change detected: ${path.basename(filePath)}`, "INFO", "Watcher");
                await this._taskRunner.runSequence([
                    "lint-js",
                    "transpile-js",
                    "minify-js",
                    "remove-js-sourcemap",
                ], { watcher: true });
            });
        });

        this._watchers.set("javascript", watcher);
        log("JavaScript watcher set up", "DEBUG", "Watcher");
    }

    /**
     * Set up Stylus file watcher.
     * @private
     */
    async _setupStylusWatcher () {
        const watcher = chokidar.watch(TOOLS.watch.stylus, DEFAULT_WATCHER_OPTIONS);

        watcher.on("change", (filePath) => {
            this._handleFileChange("stylus", filePath, async () => {
                log(`Stylus change detected: ${path.basename(filePath)}`, "INFO", "Watcher");
                await this._taskRunner.runSequence([
                    "lint-stylus",
                    "transpile-stylus",
                    "minify-css",
                    "remove-css-sourcemap",
                ], { watcher: true });
            });
        });

        this._watchers.set("stylus", watcher);
        log("Stylus watcher set up", "DEBUG", "Watcher");
    }

    /**
     * Set up image file watcher.
     * @private
     */
    async _setupImageWatcher () {
        const options = {
            ...DEFAULT_WATCHER_OPTIONS,
            awaitWriteFinish: {
                stabilityThreshold: 500, // Images might be larger, so wait longer.
                pollInterval: 100,
            },
        };

        const watcher = chokidar.watch(TOOLS.watch.images, options);

        // Handle new images.
        watcher.on("add", (filePath) => {
            this._handleFileChange("images-add", filePath, async () => {
                log(`New image detected: ${path.basename(filePath)}`, "INFO", "Watcher");
                await this._taskRunner.runTask("minify-images", { watcher: true });
            });
        });

        // Handle changed images.
        watcher.on("change", (filePath) => {
            this._handleFileChange("images-change", filePath, async () => {
                log(`Image change detected: ${path.basename(filePath)}`, "INFO", "Watcher");
                await this._taskRunner.runTask("minify-images", { watcher: true });
            });
        });

        this._watchers.set("images", watcher);
        log("Image watcher set up", "DEBUG", "Watcher");
    }

    /**
     * Handle file change with debouncing and error handling.
     * @private
     * @param {string} fileType - Type of file being watched
     * @param {string} filePath - Path to the changed file
     * @param {Function} callback - Callback to execute
     */
    _handleFileChange (fileType, filePath, callback) {
        // Clear existing timer for this file type.
        if (this._debounceTimers.has(fileType)) {
            clearTimeout(this._debounceTimers.get(fileType));
        }

        // Set new timer.
        const timer = setTimeout(async () => {
            try {
                // Validate that the file still exists before processing.
                if (!fs.existsSync(filePath)) {
                    log(`File ${filePath} no longer exists, skipping processing`, "WARNING", "Watcher");
                    return;
                }

                await callback();
            } catch (error) {
                // Create a contextual error for file change handling.
                const changeError = createContextualError(error, {
                    task: "watcher",
                    operation: `handle-${fileType}-change`,
                    file: filePath,
                    fileType: fileType,
                });

                changeError.suggestions = changeError.suggestions || [];
                changeError.suggestions.push("Development mode will continue watching for changes");
                changeError.suggestions.push("Fix the issue and save the file to retry");

                if (fileType === "javascript") {
                    changeError.suggestions.push("Check for JavaScript syntax errors");
                } else if (fileType === "stylus") {
                    changeError.suggestions.push("Check for Stylus syntax errors");
                } else if (fileType.includes("images")) {
                    changeError.suggestions.push("Ensure the image file is valid and not corrupted");
                }

                log(`Error handling ${fileType} change: ${changeError.message}`, "ERROR", "Watcher");

                // In development mode, we should log the error but continue watching.
                if (changeError.suggestions.length > 0) {
                    changeError.suggestions.forEach(suggestion => {
                        log(`💡 ${suggestion}`, "INFO", "Watcher");
                    });
                }
            }
        }, this._debounceDelay);

        this._debounceTimers.set(fileType, timer);
    }

    /**
     * Close all watchers.
     */
    async close () {
        log("Closing file watchers...", "INFO", "Watcher");

        // Clear all debounce timers.
        for (const timer of this._debounceTimers.values()) {
            clearTimeout(timer);
        }
        this._debounceTimers.clear();

        // Close all watchers.
        const closePromises = Array.from(this._watchers.entries()).map(
            async ([key, watcher]) => {
                await watcher.close();
                log(`Closed ${key} watcher`, "DEBUG", "Watcher");
            },
        );

        await Promise.all(closePromises);
        this._watchers.clear();

        // Remove ready file.
        if (fs.existsSync(PATHS.develop.readyFile)) {
            fs.rmSync(PATHS.develop.readyFile);
        }

        this._isReady = false;
        log("All file watchers closed", "INFO", "Watcher");
    }
}

/**
 * Create a watcher instance.
 * @param {Object} taskRunner - Task runner instance
 * @returns {Watcher} - New watcher instance
 */
export function createWatcher (taskRunner) {
    return new Watcher(taskRunner);
}
