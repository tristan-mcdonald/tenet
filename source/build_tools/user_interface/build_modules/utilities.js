/**
 * @fileoverview Utility functions for the build system.
 *
 * Provides common functionality used across build tasks:
 * - **Logging**: Level-based logging with CLI formatting
 * - **Caching**: SHA256 hash-based file caching
 * - **Statistics**: Build timing and file processing stats
 * - **Error handling**: Error formatting and recovery
 * - **File operations**: Directory creation, JSON file handling
 *
 * @module utilities
 * @see {@link ./cli_formatter.js} for CLI output formatting
 * @see {@link ./errors.js} for error types
 */

import colors from "picocolors";
import crypto from "crypto";
import fs from "fs";
import notifier from "node-notifier";
import path from "path";

import { BuildError, createContextualError, extractErrorInfo, isRecoverableError, ErrorSeverity } from "./errors.js";
import { ENV, PATHS } from "./config.js";
import { logFormatted, ProgressIndicator, BuildProgress, isVerboseMode, isQuietMode } from "./cli_formatter.js";

/**
 * Log level constants for filtering messages.
 * @enum {number}
 * @readonly
 */
const LOG_LEVELS = {
    DEBUG: 0,
    ERROR: 3,
    INFO: 1,
    NONE: 4,
    WARNING: 2,
};

// Current log level (can be set via environment variable).
const currentLogLevel = process.env.LOG_LEVEL
    ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO
    : LOG_LEVELS.INFO;

// Build statistics.
const buildStats = {
    startTime: Date.now(),
    tasks: {},
    files: {
        processed: 0,
        cached: 0,
        sizes: {},
    },
};

/**
 * Logging with levels and formatting.
 * Uses the CLI formatter for consistent user experience.
 */
export function log (message, level = "INFO", context = null, details = null) {
    const logLevel = LOG_LEVELS[level.toUpperCase()];

    if (logLevel < currentLogLevel) {
        return;
    }

    // Map log levels to formatter types.
    const levelMap = {
        DEBUG: "debug",
        INFO: "info",
        WARNING: "warning",
        ERROR: "error",
    };

    const formatterType = levelMap[level.toUpperCase()] || "info";

    logFormatted(formatterType, message, context, details);
}

/**
 * Format an error message from an Error object or string.
 */
export function formatError (error, includeStack = false) {
    if (!(error instanceof Error)) {
        return String(error);
    }

    // Handle `BuildError` instances with formatting.
    if (error instanceof BuildError) {
        const formatted = error.getFormattedMessage();

        if (includeStack) {
            return `${formatted}\nError Code: ${error.code}\nCategory: ${error.category}\nSeverity: ${error.severity}\n${error.stack}`;
        }

        return formatted;
    }

    // Handle regular errors.
    return includeStack
        ? `${error.message}\n${error.stack}`
        : error.message;
}

/**
 * Handle errors for build tasks with error reporting and suggestions.
 */
export function handleBuildError (context, error, handled = false) {
    // Convert generic errors to contextual errors.
    const contextualError = error instanceof BuildError
        ? error
        : createContextualError(error, { task: context, operation: "build" });

    const errorMessage = formatError(contextualError, isVerboseMode);

    if (!handled) {
        /**
         * Use the error's built-in suggestions if available, otherwise provide context-specific
         * suggestions.
         */
        const suggestions = contextualError.suggestions || [];

        if (suggestions.length === 0) {
            // Fallback to legacy suggestion logic.
            if (error.code === "ENOENT") {
                suggestions.push("Check that all required files exist and paths are correct");
            } else if (error.message?.includes("permission")) {
                suggestions.push("Check file permissions or run with appropriate privileges");
            } else if (error.message?.includes("EACCES")) {
                suggestions.push("Permission denied - check file/directory permissions");
            } else if (context.toLowerCase().includes("lint")) {
                suggestions.push("Run with --fix to automatically resolve some issues");
            } else {
                suggestions.push("Run with --verbose for detailed error information");
            }
        }

        // Display the main error.
        logFormatted("error", `${context} failed: ${errorMessage}`, suggestions[0]);

        // Display additional suggestions if available.
        if (suggestions.length > 1) {
            suggestions.slice(1).forEach(suggestion => {
                logFormatted("info", `💡 ${suggestion}`);
            });
        }

        // Show error code and category in verbose mode.
        if (isVerboseMode && contextualError instanceof BuildError) {
            logFormatted("debug", `Error Code: ${contextualError.code}`, "Error Details");
            logFormatted("debug", `Category: ${contextualError.category}`, "Error Details");
            logFormatted("debug", `Severity: ${contextualError.severity}`, "Error Details");
        }
    }

    // Record error in build stats with information.
    const errorInfo = extractErrorInfo(contextualError);
    recordTaskCompletion(context, false, {
        error: errorMessage,
        errorCode: errorInfo.code,
        errorCategory: errorInfo.category,
        errorSeverity: errorInfo.severity,
    });

    // Write build stats before exiting.
    writeBuildStats();
    if (!isQuietMode) {
        printBuildSummary();
    }

    process.exit(1);
}

/**
 * Handle errors for development tasks with recovery options.
 * Enhanced to work with the new error classification system.
 */
export function handleDevelopmentError (context, error) {
    // Convert generic errors to contextual errors.
    const contextualError = error instanceof BuildError
        ? error
        : createContextualError(error, { task: context, operation: "watch" });

    const errorMessage = formatError(contextualError);

    // Determine if this error is recoverable.
    const recoverable = isRecoverableError(contextualError);

    /**
     * Use the error's built-in suggestions if available, otherwise provide context-specific
     * suggestions.
     */
    const suggestions = contextualError.suggestions || [];

    if (suggestions.length === 0) {
        if (recoverable) {
            suggestions.push("Development mode will continue watching for changes. Fix the issue and save to retry.");
        } else {
            suggestions.push("This error may require restarting development mode.");
        }
    }

    // Display the error with appropriate severity.
    const logLevel = contextualError.severity === ErrorSeverity.CRITICAL ? "error" : "warning";
    logFormatted(logLevel, `${context} error: ${errorMessage}`, suggestions[0]);

    // Display additional suggestions if available.
    if (suggestions.length > 1) {
        suggestions.slice(1).forEach(suggestion => {
            logFormatted("info", `💡 ${suggestion}`);
        });
    }

    // Show desktop notification with enhanced information.
    if (!isQuietMode) {
        const notificationTitle = recoverable ? "Development error (recoverable)" : "Development error";
        const shortMessage = errorMessage.substring(0, 100) + (errorMessage.length > 100 ? "..." : "");

        notifier.notify({
            title: notificationTitle,
            message: `${context}: ${shortMessage}`,
            sound: true,
            wait: false,
        });
    }

    // Record error in build stats.
    const errorInfo = extractErrorInfo(contextualError);
    recordTaskCompletion(context, false, {
        error: errorMessage,
        errorCode: errorInfo.code,
        errorCategory: errorInfo.category,
        errorSeverity: errorInfo.severity,
        recoverable: recoverable,
    });
}

/**
 * Ensures a directory exists, creating it if necessary.
 */
export function ensureDirectoryExists (dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Calculate file hash for cache invalidation.
 */
export function calculateFileHash (filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash("sha256");
        hashSum.update(fileBuffer);
        return hashSum.digest("hex");
    } catch (error) {
        log(`Failed to calculate hash for ${filePath}: ${error.message}`, "WARNING");
        return null;
    }
}

/**
 * Read and parse a JSON file, returning an empty object if the file doesn't exist.
 */
export function readJsonFile (filePath, defaultValue = {}) {
    try {
        return fs.existsSync(filePath)
            ? JSON.parse(fs.readFileSync(filePath, "utf8"))
            : defaultValue;
    } catch (error) {
        log(`Failed to read JSON file ${filePath}: ${error.message}`, "WARNING");
        return defaultValue;
    }
}

/**
 * Check if files need processing based on their hashes.
 */
export function needsProcessingWithDependencies (filePaths, cacheFilePath) {
    // Skip cache check if caching is disabled.
    if (!ENV.activeProfile.cache) {
        return true;
    }

    try {
        // If cache file doesn't exist, processing is needed.
        if (!fs.existsSync(cacheFilePath)) {
            return true;
        }

        const cacheData = readJsonFile(cacheFilePath);

        // Check each file for changes.
        for (const filePath of filePaths) {
            const currentHash = calculateFileHash(filePath);

            // If hash calculation failed, processing is needed.
            if (!currentHash) {
                return true;
            }

            // If file is not in cache or hash has changed, processing is needed.
            if (!cacheData[filePath] || cacheData[filePath] !== currentHash) {
                return true;
            }
        }

        // All files are up to date.
        return false;
    } catch (error) {
        log(`Cache check failed: ${error.message}`, "WARNING");
        return true;
    }
}

/**
 * Update cache with hashes for multiple files.
 */
export function updateCacheWithDependencies (filePaths, cacheFilePath) {
    try {
        // Read existing cache data or create new object.
        const cacheData = readJsonFile(cacheFilePath);

        // Update cache with new hashes for all files.
        for (const filePath of filePaths) {
            const currentHash = calculateFileHash(filePath);
            if (currentHash) {
                cacheData[filePath] = currentHash;
            }
        }

        // Ensure cache directory exists.
        ensureDirectoryExists(path.dirname(cacheFilePath));

        // Write updated cache data.
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
        log(`Failed to update dependency cache: ${error.message}`, "WARNING");
    }
}

/**
 * Check if a file needs processing based on its hash.
 */
export function needsProcessing (filePath, cacheFilePath) {
    // Skip cache check if caching is disabled.
    if (!ENV.activeProfile.cache) {
        return true;
    }

    try {
        // If cache file doesn't exist, processing is needed.
        if (!fs.existsSync(cacheFilePath)) {
            return true;
        }

        const cacheData = readJsonFile(cacheFilePath);
        const currentHash = calculateFileHash(filePath);

        // If hash calculation failed, processing is needed.
        if (!currentHash) {
            return true;
        }

        // Compare current hash with cached hash.
        return cacheData[filePath] !== currentHash;
    } catch (error) {
        log(`Cache check failed for ${filePath}: ${error.message}`, "WARNING");
        return true;
    }
}

/**
 * Update cache with new file hash.
 */
export function updateCache (filePath, cacheFilePath) {
    if (!ENV.activeProfile.cache) {
        return;
    }

    try {
        const currentHash = calculateFileHash(filePath);
        if (!currentHash) {
            return;
        }

        // Read existing cache data or create new object.
        const cacheData = readJsonFile(cacheFilePath);

        // Update cache with new hash.
        cacheData[filePath] = currentHash;

        // Ensure cache directory exists.
        ensureDirectoryExists(path.dirname(cacheFilePath));

        // Write updated cache data.
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
        log(`Failed to update cache for ${filePath}: ${error.message}`, "WARNING");
    }
}

/**
 * Record task start time for performance tracking.
 */
export function recordTaskStart (taskName) {
    if (!ENV.activeProfile.stats) {
        return;
    }

    // Initialize task object if it doesn't exist.
    buildStats.tasks[taskName] = buildStats.tasks[taskName] || {};
    buildStats.tasks[taskName].startTime = Date.now();

    if (isVerboseMode) {
        logFormatted("debug", `Starting task: ${taskName}`, "Stats");
    }
}

/**
 * Record task completion and duration.
 */
export function recordTaskCompletion (taskName, success = true, metadata = {}) {
    if (!ENV.activeProfile.stats) {
        return;
    }

    // Initialize task object if it doesn't exist.
    buildStats.tasks[taskName] = buildStats.tasks[taskName] || {
        startTime: buildStats.startTime,
    };

    const task = buildStats.tasks[taskName];
    const endTime = Date.now();
    const duration = task.startTime ? endTime - task.startTime : 0;

    // Update task stats
    Object.assign(task, {
        endTime,
        duration,
        success,
        metadata,
    });

    if (isVerboseMode) {
        const timeStr = formatDuration(duration);
        const status = success ? "completed" : "failed";
        logFormatted("debug", `Task ${taskName} ${status} in ${timeStr}`, "Stats");
    }
}

/**
 * Record file processing for statistics.
 */
export function recordFileProcessed (filePath, cached = false, metadata = {}) {
    if (!ENV.activeProfile.stats) return;

    // Increment appropriate counter.
    buildStats.files[cached ? "cached" : "processed"]++;

    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            buildStats.files.sizes[filePath] = {
                size: stats.size,
                ...metadata,
            };
        }
    } catch (error) {
        log(`Failed to record file stats for ${filePath}: ${error.message}`, "DEBUG", "Stats");
    }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration (ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * Write build statistics to file.
 */
export function writeBuildStats () {
    if (!ENV.activeProfile.stats) {
        return;
    }

    try {
        // Update build stats with final timing information.
        buildStats.endTime = Date.now();
        buildStats.totalDuration = buildStats.endTime - buildStats.startTime;

        // Ensure stats directory exists.
        ensureDirectoryExists(path.dirname(PATHS.stats.output));

        // Write stats to file.
        fs.writeFileSync(
            PATHS.stats.output,
            JSON.stringify(buildStats, null, 2),
        );

        log(`Build stats written to ${PATHS.stats.output}`, "DEBUG", "Stats");
    } catch (error) {
        log(`Failed to write build stats: ${error.message}`, "WARNING", "Stats");
    }
}

/**
 * Print build summary to console with formatted output.
 */
export function printBuildSummary () {
    if (!ENV.activeProfile.stats || isQuietMode) return;

    const totalDuration = Date.now() - buildStats.startTime;
    const timeStr = formatDuration(totalDuration);

    if (!isVerboseMode) {
        // Concise summary for normal mode.
        const hasErrors = Object.values(buildStats.tasks).some(task => task.success === false);

        if (hasErrors) {
            logFormatted("error", "Build completed with errors", "Check the output above for details");
        } else {
            logFormatted("success", "Build completed successfully", timeStr);
        }

        // Show basic file stats.
        if (buildStats.files.processed > 0 || buildStats.files.cached > 0) {
            const filesSummary = [];
            if (buildStats.files.processed > 0) filesSummary.push(`${buildStats.files.processed} processed`);
            if (buildStats.files.cached > 0) filesSummary.push(`${buildStats.files.cached} from cache`);

            console.log(colors.gray(`Files: ${filesSummary.join(", ")}`)); // eslint-disable-line no-console
        }

        return;
    }

    // Detailed summary for verbose mode.
    logFormatted("section", "Build Summary");
    console.log(`${colors.gray("Total time:")} ${timeStr}`); // eslint-disable-line no-console
    console.log(`${colors.gray("Files processed:")} ${buildStats.files.processed}`); // eslint-disable-line no-console
    console.log(`${colors.gray("Files from cache:")} ${buildStats.files.cached}`); // eslint-disable-line no-console

    // List tasks by duration in verbose mode.
    const tasks = Object.entries(buildStats.tasks)
        .filter(([, task]) => task.duration)
        .sort((a, b) => b[1].duration - a[1].duration);

    if (tasks.length > 0) {
        console.log(`\n${colors.gray("Task durations:")}`); // eslint-disable-line no-console
        tasks.forEach(([name, task]) => {
            const status = task.success === false ? colors.red(" ✗") : colors.green(" ✓");
            console.log(`  ${name}: ${formatDuration(task.duration)}${status}`); // eslint-disable-line no-console
        });
    }
}

/**
 * Format bytes to human-readable format.
 */
export function formatBytes (bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Check if JavaScript needs processing based on entry file and all dependencies.
 * @param {string} entryFile - The entry JavaScript file path
 * @param {string} cacheFilePath - Path to the cache file
 * @returns {boolean} - True if processing is needed
 */
export function needsJavaScriptProcessing (entryFile, cacheFilePath) {
    // Skip cache check if caching is disabled.
    if (!ENV.activeProfile.cache) {
        return true;
    }

    try {
        // If cache file doesn't exist, processing is needed.
        if (!fs.existsSync(cacheFilePath)) {
            return true;
        }

        const cacheData = readJsonFile(cacheFilePath);

        // Check if we have JavaScript-specific cache data.
        if (!cacheData.javascript || !cacheData.javascript.dependencies) {
            return true;
        }

        const jsCache = cacheData.javascript;

        // Check entry file hash.
        const currentEntryHash = calculateFileHash(entryFile);
        if (!currentEntryHash || jsCache.entryHash !== currentEntryHash) {
            log(`Entry file ${entryFile} has changed`, "DEBUG", "Cache");
            return true;
        }

        // Check all dependency hashes.
        for (const [depPath, depHash] of Object.entries(jsCache.dependencies)) {
            if (!fs.existsSync(depPath)) {
                log(`Dependency ${depPath} no longer exists`, "DEBUG", "Cache");
                return true;
            }

            const currentDepHash = calculateFileHash(depPath);
            if (!currentDepHash || currentDepHash !== depHash) {
                log(`Dependency ${depPath} has changed`, "DEBUG", "Cache");
                return true;
            }
        }

        // All files are unchanged.
        return false;
    } catch (error) {
        log(`JavaScript cache check failed: ${error.message}`, "WARNING", "Cache");
        return true;
    }
}

/**
 * Update JavaScript cache with entry file and dependency information.
 * @param {string} entryFile - The entry JavaScript file path
 * @param {string} cacheFilePath - Path to the cache file
 * @param {Object} metafile - ESBuild metafile containing dependency information
 */
export function updateJavaScriptCache (entryFile, cacheFilePath, metafile) {
    if (!ENV.activeProfile.cache || !metafile) {
        return;
    }

    try {
        // Read existing cache data or create new object.
        const cacheData = readJsonFile(cacheFilePath);

        // Extract dependencies from metafile.
        const dependencies = {};
        if (metafile.inputs) {
            for (const inputPath of Object.keys(metafile.inputs)) {
                // Convert relative paths to absolute.
                const absolutePath = path.resolve(inputPath);

                // Only include JavaScript files.
                if (absolutePath.endsWith(".js")) {
                    const hash = calculateFileHash(absolutePath);
                    if (hash) {
                        dependencies[absolutePath] = hash;
                    }
                }
            }
        }

        // Update cache with JavaScript-specific data.
        cacheData.javascript = {
            entryHash: calculateFileHash(entryFile),
            dependencies,
            timestamp: Date.now(),
        };

        // Ensure cache directory exists.
        ensureDirectoryExists(path.dirname(cacheFilePath));

        // Write updated cache data.
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));

        log(`JavaScript cache updated with ${Object.keys(dependencies).length} dependencies`, "DEBUG", "Cache");
    } catch (error) {
        log(`Failed to update JavaScript cache: ${error.message}`, "WARNING", "Cache");
    }
}

/**
 * Create a progress indicator for long-running operations.
 */
export function createProgressIndicator (label, total = null) {
    return new ProgressIndicator(label, total);
}

/**
 * Create a build progress tracker for coordinating multiple tasks.
 */
export function createBuildProgress (tasks = []) {
    return new BuildProgress(tasks);
}

/**
 * Log a user-friendly success message.
 */
export function logSuccess (message, details = null) {
    logFormatted("success", message, null, details);
}

/**
 * Log a user-friendly error with suggestion.
 */
export function logError (message, suggestion = null) {
    logFormatted("error", message, suggestion);
}

/**
 * Log a section header for organizing output.
 */
export function logSection (title) {
    logFormatted("section", title);
}

/**
 * Log a build phase.
 */
export function logPhase (phase, description = null) {
    logFormatted("phase", phase, description);
}

/**
 * Create a contextual error with file and task information.
 * This is a convenience function for common error creation patterns.
 */
export function createTaskError (ErrorClass, message, taskName, filePath = null, originalError = null) {
    const context = { task: taskName };
    if (filePath) {
        context.file = filePath;
    }

    const options = { context };
    if (originalError) {
        options.cause = originalError;
    }

    return new ErrorClass(message, options);
}

/**
 * Wrap a function to automatically catch and convert errors to contextual errors.
 * Useful for file operations and other common error-prone operations.
 */
export function wrapWithErrorContext (fn, context = {}) {
    return async function wrappedFunction (...args) {
        try {
            return await fn(...args);
        } catch (error) {
            throw createContextualError(error, context);
        }
    };
}

// Export output mode functions.
export { isVerboseMode, isQuietMode };
