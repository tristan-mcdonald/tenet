/**
 * @fileoverview Task-specific utility functions for the build system.
 *
 * Provides reusable utilities for common task operations:
 * - **File cleaning**: Delete files by glob pattern
 * - **Cached processing**: Process files with hash-based caching
 * - **Batch processing**: Process multiple files with concurrency control
 * - **Minification**: Create minification processors with statistics
 * - **Source maps**: Remove source map references from output files
 *
 * @module task_utilities
 * @see {@link ./utilities.js} for lower-level utilities
 */

import fs from "fs";
import path from "path";

import { BuildError, FileSystemError, ProcessError, ValidationError } from "./errors.js";
import { createTaskError, ensureDirectoryExists, formatBytes, formatError, log, needsProcessing, needsProcessingWithDependencies, recordFileProcessed, updateCache, updateCacheWithDependencies } from "./utilities.js";
import { ENV } from "./config.js";

/**
 * Clean files matching a glob pattern.
 * @param {string|string[]} patterns - Glob pattern(s) to match files for deletion.
 * @param {Object} options - Options for cleaning.
 * @param {string} options.context - Context name for logging.
 * @param {string[]} options.ignore - Patterns to ignore.
 * @returns {Promise<number>} - Number of files deleted.
 */
export async function cleanFiles (patterns, options = {}) {
    const { context = "Clean", ignore = [] } = options;

    try {
        const { glob } = await import("glob");

        log(`Cleaning ${context} files...`, "INFO", context);

        // Normalize patterns to array.
        const patternArray = Array.isArray(patterns) ? patterns : [patterns];

        // Find all files matching patterns.
        const filesToDelete = [];
        for (const pattern of patternArray) {
            try {
                const matches = await glob(pattern, {
                    nodir: true,
                    ignore,
                });
                filesToDelete.push(...matches);
            } catch (error) {
                throw createTaskError(
                    ValidationError,
                    `Invalid glob pattern "${pattern}": ${error.message}`,
                    context,
                    null,
                    error,
                );
            }
        }

        // Delete files.
        let deletedCount = 0;
        const errors = [];

        for (const file of filesToDelete) {
            try {
                fs.rmSync(file, { force: true });
                log(`Deleted ${file}`, "DEBUG", context);
                deletedCount++;
            } catch (error) {
                const fileError = createTaskError(
                    FileSystemError,
                    `Failed to delete ${file}`,
                    context,
                    file,
                    error,
                );
                errors.push(fileError);
            }
        }

        // Report any deletion errors.
        if (errors.length > 0) {
            const errorMessage = `Failed to delete ${errors.length} files`;
            const aggregateError = createTaskError(
                FileSystemError,
                errorMessage,
                context,
            );

            aggregateError.context.failedFiles = errors.map(e => e.context.file);
            aggregateError.suggestions.push("Check file permissions and ensure files are not in use");

            throw aggregateError;
        }

        log(`Deleted ${deletedCount} ${context} files`, "INFO", context);
        return deletedCount;
    } catch (error) {
        if (error instanceof BuildError) {
            throw error;
        }

        throw createTaskError(
            FileSystemError,
            `Clean operation failed: ${error.message}`,
            context,
            null,
            error,
        );
    }
}

/**
 * Remove sourcemap references from a file.
 * @param {string} filePath - Path to the file.
 * @param {string} type - Type of sourcemap ('js' or 'css').
 * @param {Object} options - Options.
 * @returns {Object} - Result with file path.
 */
export function removeSourceMapReferences (filePath, type = "js", options = {}) {
    const { context = "SourceMap" } = options;

    if (ENV.activeProfile.sourceMaps) {
        log(`Keeping sourcemap references (enabled in config)`, "INFO", context);
        return { skipped: true };
    }

    log(`Removing sourcemap references from ${filePath}...`, "INFO", context);

    try {
        let content = fs.readFileSync(filePath, "utf8");

        // Remove sourcemap references based on type.
        if (type === "js") {
            content = content.replace(/\/\/# sourceMappingURL=.*\.map\s*/g, "");
        } else if (type === "css") {
            content = content.replace(/\/\*# sourceMappingURL=.*\.map \*\//g, "");
        }

        fs.writeFileSync(filePath, content, "utf8");
        log("Sourcemap references removed", "INFO", context);

        return { file: filePath };
    } catch (error) {
        throw new Error(`Failed to remove sourcemap references: ${formatError(error)}`);
    }
}

/**
 * Process a file with caching support and error handling.
 * @param {Object} options - Processing options
 * @param {string|string[]} options.input - Input file(s)
 * @param {string} options.output - Output file path
 * @param {string} options.cache - Cache file path
 * @param {Function} options.processor - Processing function
 * @param {string} options.context - Context for logging
 * @param {boolean} options.skipIfExists - Skip if output exists
 * @returns {Promise<Object>} - Processing result
 */
export async function processWithCache (options) {
    const {
        input,
        output,
        cache,
        processor,
        context = "Process",
        skipIfExists = true,
    } = options;

    // Validate inputs
    if (!input || !output || !processor) {
        throw createTaskError(
            ValidationError,
            "Missing required parameters: input, output, and processor are required",
            context,
        );
    }

    // Handle both single file and multiple files.
    const inputs = Array.isArray(input) ? input : [input];

    // Validate input files exist.
    for (const inputFile of inputs) {
        if (!fs.existsSync(inputFile)) {
            throw createTaskError(
                FileSystemError,
                `Input file not found: ${inputFile}`,
                context,
                inputFile,
            );
        }
    }

    try {
        const needsProc = inputs.length === 1
            ? needsProcessing(inputs[0], cache)
            : needsProcessingWithDependencies(inputs, cache);

        // Check if processing is needed.
        if (!needsProc && skipIfExists && fs.existsSync(output)) {
            log(`Using cached ${context} for ${inputs[0]}`, "INFO", context);
            recordFileProcessed(output, true);
            return { cached: true, file: output };
        }

        // Ensure output directory exists.
        try {
            ensureDirectoryExists(path.dirname(output));
        } catch (error) {
            throw createTaskError(
                FileSystemError,
                `Failed to create output directory for ${output}`,
                context,
                output,
                error,
            );
        }

        // Run the processor with error context.
        let result;
        try {
            result = await processor(inputs, output);
        } catch (error) {
            throw createTaskError(
                ProcessError,
                `Processing failed for ${inputs.join(", ")}`,
                context,
                inputs[0],
                error,
            );
        }

        // Update cache.
        try {
            if (inputs.length === 1) {
                updateCache(inputs[0], cache);
            } else {
                updateCacheWithDependencies(inputs, cache);
            }
        } catch (error) {
            // Cache update failure is not critical, so just warn.
            log(`Warning: Failed to update cache: ${error.message}`, "WARNING", context);
        }

        // Record processing.
        recordFileProcessed(output);
        log(`${context} completed: ${output}`, "INFO", context);

        return {
            cached: false,
            file: output,
            ...result,
        };
    } catch (error) {
        if (error instanceof BuildError) {
            throw error;
        }

        throw createTaskError(
            BuildError,
            `${context} failed: ${formatError(error)}`,
            context,
            inputs[0],
            error,
        );
    }
}

/**
 * Process files in batches with concurrency control.
 * @param {string[]} files - Array of files to process.
 * @param {Function} processor - Function to process each file.
 * @param {Object} options - Processing options.
 * @returns {Promise<Array>} - Array of results.
 */
export async function processBatchFiles (files, processor, options = {}) {
    const {
        concurrency = 5,
        context = "Batch",
        onProgress = null,
    } = options;

    const results = [];
    const totalFiles = files.length;

    log(`Processing ${totalFiles} files in batches of ${concurrency}`, "INFO", context);

    for (let i = 0; i < totalFiles; i += concurrency) {
        const batch = files.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(file => tryProcessFile(file, processor, context)),
        );

        results.push(...batchResults);

        // Report progress if callback provided.
        if (onProgress) {
            const processed = Math.min(i + concurrency, totalFiles);
            onProgress(processed, totalFiles);
        }
    }

    return results;
}

/**
 * Safely process a file with error handling.
 * @param {string} file - File to process.
 * @param {Function} processor - Processing function.
 * @param {string} context - Context for logging.
 * @returns {Promise<Object>} - Processing result.
 */
export async function tryProcessFile (file, processor, context = "Process") {
    try {
        return await processor(file);
    } catch (error) {
        log(`Error processing ${file}: ${error.message}`, "ERROR", context);
        return {
            file,
            error: error.message,
            skipped: true,
            reason: "error",
        };
    }
}

/**
 * Wrap a task function with error handling and context.
 * @param {string} taskName - Name of the task.
 * @param {Function} taskFn - Task function to wrap.
 * @param {Object} options - Wrapper options.
 * @param {string} options.category - Error category to use.
 * @param {string} options.severity - Error severity level.
 * @param {string[]} options.suggestions - Default suggestions for errors.
 * @returns {Function} - Wrapped function.
 */
export function wrapTaskWithError (taskName, taskFn) {
    return async function wrappedTask (...args) {
        try {
            return await taskFn(...args);
        } catch (error) {
            if (error instanceof BuildError) {
                // Already a BuildError, so just re-throw with additional context.
                error.context.wrappedTask = taskName;
                throw error;
            }

            // Convert to a contextual `BuildError`.
            throw createTaskError(
                BuildError,
                `${taskName} failed: ${formatError(error)}`,
                taskName,
                null,
                error,
            );
        }
    };
}

/**
 * Calculate and format optimization statistics.
 * @param {number} originalSize - Original file size in bytes.
 * @param {number} optimizedSize - File size in bytes after processing.
 * @returns {Object} - Statistics for the processing results.
 */
export function calculateOptimization (originalSize, optimizedSize) {
    const savings = originalSize - optimizedSize;
    const percentage = originalSize > 0
        ? Math.round((savings / originalSize) * 100)
        : 0;

    return {
        originalSize,
        optimizedSize,
        savings,
        percentage,
        originalFormatted: formatBytes(originalSize),
        optimizedFormatted: formatBytes(optimizedSize),
        savingsFormatted: formatBytes(savings),
    };
}

/**
 * Log file processing with standardized format.
 * @param {string} file - File being processed.
 * @param {Object} result - Processing result.
 * @param {string} context - Context for logging.
 */
export function logFileProcessing (file, result, context = "Process") {
    if (result.cached) {
        log(`Using cached version of ${file}`, "DEBUG", context);
    } else if (result.error) {
        log(`Failed to process ${file}: ${result.error}`, "ERROR", context);
    } else if (result.skipped) {
        log(`Skipped ${file}: ${result.reason || "unknown"}`, "DEBUG", context);
    } else if (result.optimized) {
        const stats = calculateOptimization(result.originalSize, result.optimizedSize);
        log(
            `Processed ${file}: ${stats.originalFormatted} → ${stats.optimizedFormatted} (${stats.percentage}% reduction)`,
            "INFO",
            context,
        );
    } else {
        log(`Processed ${file}`, "INFO", context);
    }
}

/**
 * Create a processor function with minification support.
 * @param {Object} options - Processor options.
 * @returns {Function} - Processor function.
 */
export function createMinificationProcessor (options) {
    const {
        minifier,
        inputPath,
        outputPath,
        context = "Minify",
    } = options;

    return async function minificationProcessor () {
        if (!ENV.activeProfile.minify) {
            log(`${context} skipped (disabled in config)`, "INFO", context);
            return { skipped: true };
        }

        log(`Minifying with ${context}...`, "INFO", context);

        const input = typeof inputPath === "function" ? inputPath() : inputPath;
        const output = typeof outputPath === "function" ? outputPath() : outputPath;

        const result = await minifier(input, output);

        if (result.stats) {
            const optimization = calculateOptimization(
                result.stats.originalSize,
                result.stats.minifiedSize,
            );
            log(
                `${context} complete: ${optimization.originalFormatted} → ${optimization.optimizedFormatted} (${optimization.percentage}% reduction)`,
                "INFO",
                context,
            );
        }

        recordFileProcessed(output);
        return result;
    };
}

/**
 * Find files matching a pattern, handling both glob patterns and direct file paths.
 * @param {string} pattern - File pattern to match.
 * @param {Object} options - Options for file finding.
 * @returns {Promise<{matches: string[], isMissing: boolean}>} - Matching files and status.
 */
export async function findFilesForPattern (pattern, options = {}) {
    const { context = "FileFind", silent = false } = options;
    const { glob } = await import("glob");

    try {
        // Check if it's a glob pattern or a direct file path.
        if (pattern.includes("*")) {
            // It's a glob pattern.
            if (!silent) {
                log(`Checking glob pattern: ${pattern}`, "DEBUG", context);
            }
            const matches = await glob(pattern, {
                nodir: true,
                silent: true,
            });

            if (matches.length === 0) {
                if (!silent) {
                    log(`No files found for pattern: ${pattern}`, "WARNING", context);
                }
            } else if (!silent) {
                log(`Found ${matches.length} files for pattern: ${pattern}`, "DEBUG", context);
            }

            return { matches, isMissing: matches.length === 0 };
        } else {
            // It's a direct file path.
            if (!silent) {
                log(`Checking file: ${pattern}`, "DEBUG", context);
            }

            if (fs.existsSync(pattern)) {
                if (!silent) {
                    log(`File exists: ${pattern}`, "DEBUG", context);
                }
                return { matches: [pattern], isMissing: false };
            } else {
                if (!silent) {
                    log(`Missing file: ${pattern}`, "WARNING", context);
                }
                return { matches: [], isMissing: true };
            }
        }
    } catch (error) {
        if (!silent) {
            log(`Error processing pattern ${pattern}: ${error.message}`, "WARNING", context);
        }
        return { matches: [], isMissing: true };
    }
}

/**
 * Read a file, process it with a custom function, and write the result.
 * @param {Object} options - Processing options
 * @param {string} options.input - Input file path
 * @param {string} options.output - Output file path
 * @param {Function} options.processor - Function to process file content
 * @param {string} options.context - Context for logging
 * @param {string} options.encoding - File encoding (default: 'utf8')
 * @returns {Promise<Object>} - Processing result
 */
export async function readProcessWrite (options) {
    const {
        input,
        output,
        processor,
        context = "Process",
        encoding = "utf8",
    } = options;

    try {
        // Ensure output directory exists.
        ensureDirectoryExists(path.dirname(output));

        // Read input file.
        const inputContent = fs.readFileSync(input, encoding);

        // Process content.
        const result = await processor(inputContent, input, output);

        // Write output - handle both string content and custom result objects.
        if (typeof result === "string") {
            fs.writeFileSync(output, result, encoding);
            log(`${context} completed: ${input} → ${output}`, "INFO", context);
            return { file: output, content: result };
        } else if (result && result.content) {
            fs.writeFileSync(output, result.content, encoding);
            log(`${context} completed: ${input} → ${output}`, "INFO", context);
            return { file: output, ...result };
        } else {
            // Processor handled writing itself.
            log(`${context} completed: ${input} → ${output}`, "INFO", context);
            return { file: output, ...result };
        }
    } catch (error) {
        throw new Error(`${context} failed for ${input}: ${formatError(error)}`);
    }
}
