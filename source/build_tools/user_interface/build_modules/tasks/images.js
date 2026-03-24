/**
 * @fileoverview Image optimisation tasks.
 *
 * Handles image processing with ImageMin:
 * - **JPEG**: mozjpeg compression (quality 80, progressive)
 * - **PNG**: pngquant compression (quality 65-80%)
 *
 * Features:
 * - Batch processing with concurrency control
 * - Hash-based caching for unchanged images
 * - Detailed optimisation statistics
 *
 * @module tasks/images
 * @see {@link ../config.js} for image configuration
 */

import fs from "fs";
import imagemin from "imagemin";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import path from "path";

import { calculateOptimization, findFilesForPattern, logFileProcessing, processBatchFiles } from "../task_utilities.js";
import { createTaskError, ensureDirectoryExists, log, needsProcessing, recordFileProcessed, updateCache } from "../utilities.js";
import { ErrorSeverity, FileSystemError, ProcessError, ValidationError } from "../errors.js";
import { PATHS, TOOLS } from "../config.js";

/**
 * Supported image types and their ImageMin processor factories.
 * @type {Object.<string, Function>}
 * @private
 */
const IMAGE_PROCESSORS = {
    ".jpg": (options) => imageminMozjpeg(options),
    ".jpeg": (options) => imageminMozjpeg(options),
    ".png": (options) => imageminPngquant(options),
};

// Default concurrency limit for image processing.
const CONCURRENCY_LIMIT = 5;

/**
 * Minify images using imagemin with error handling.
 */
export async function minifyImages () {
    log("Minifying images...", "INFO", "Images");

    try {
        // Validate image input path configuration
        if (!PATHS.images.input) {
            throw createTaskError(
                ValidationError,
                "Image input path is not configured",
                "minify-images",
            );
        }

        // Get image files using shared utility.
        let result;
        try {
            result = await findFilesForPattern(PATHS.images.input, {
                context: "Images",
                silent: false,
            });
        } catch (error) {
            throw createTaskError(
                FileSystemError,
                `Failed to find image files: ${error.message}`,
                "minify-images",
                PATHS.images.input,
                error,
            );
        }

        const imageFiles = result.matches;

        if (result.isMissing) {
            const warningError = createTaskError(
                FileSystemError,
                "No image files found to process",
                "minify-images",
                PATHS.images.input,
            );
            warningError.severity = ErrorSeverity.WARNING;
            warningError.suggestions.push("Check your image input path configuration");
            warningError.suggestions.push("Ensure image files exist in the specified directory");

            // For image processing, this is often not critical, so we'll just warn and return.
            log(warningError.message, "WARNING", "Images");
            return { total: 0, processed: 0, cached: 0, skipped: 0 };
        }

        log(`Found ${imageFiles.length} image files to process`, "INFO", "Images");

        // Validate that we have supported image processors.
        if (Object.keys(IMAGE_PROCESSORS).length === 0) {
            throw createTaskError(
                ValidationError,
                "No image processors are configured",
                "minify-images",
            );
        }

        // Process images in batches with progress reporting.
        let results;
        try {
            results = await processBatchFiles(imageFiles, processImage, {
                concurrency: CONCURRENCY_LIMIT,
                context: "Images",
                onProgress: (processed, total) => {
                    log(`Processed ${processed}/${total} images`, "DEBUG", "Images");
                },
            });
        } catch (error) {
            throw createTaskError(
                ProcessError,
                `Image batch processing failed: ${error.message}`,
                "minify-images",
                null,
                error,
            );
        }

        // Check for any processing errors.
        const errorResults = results.filter(r => r.error);
        if (errorResults.length > 0) {
            log(`Warning: ${errorResults.length} images failed to process`, "WARNING", "Images");
            errorResults.forEach(r => {
                log(`  - ${r.file}: ${r.error}`, "WARNING", "Images");
            });
        }

        // Summarize and log results.
        const summary = summarizeResults(results, imageFiles.length);
        logSummary(summary);
        return summary;
    } catch (error) {
        if (error instanceof FileSystemError || error instanceof ValidationError || error instanceof ProcessError) {
            throw error;
        }

        throw createTaskError(
            ProcessError,
            `Image minification failed: ${error.message}`,
            "minify-images",
            null,
            error,
        );
    }
}


/**
 * Summarize processing results.
 * @param {Array} results - Array of processing results
 * @param {number} total - Total number of files
 * @returns {Object} - Summary object
 */
function summarizeResults (results, total) {
    return {
        total,
        processed: results.filter(r => r.processed).length,
        cached: results.filter(r => r.cached).length,
        skipped: results.filter(r => r.skipped).length,
    };
}

/**
 * Log processing summary.
 * @param {Object} summary - Summary object
 */
function logSummary (summary) {
    log("Image processing complete:", "INFO", "Images");
    log(`  - Processed: ${summary.processed}`, "INFO", "Images");
    log(`  - From cache: ${summary.cached}`, "INFO", "Images");
    log(`  - Skipped: ${summary.skipped}`, "INFO", "Images");
}

/**
 * Process a single image with error handling.
 * @param {string} file - Path to image file
 * @returns {Object} - Processing result
 */
async function processImage (file) {
    const relativePath = path.relative(PATHS.images.base, file);
    const destPath = path.join(PATHS.images.output, relativePath);
    const cacheFile = PATHS.images.cache;
    const ext = path.extname(file).toLowerCase();

    try {
        // Validate that input file exists.
        if (!fs.existsSync(file)) {
            return {
                file,
                error: "File not found",
                skipped: true,
                reason: "file-not-found",
            };
        }

        // Check if we need to process this file.
        if (!needsProcessing(file, cacheFile) && fs.existsSync(destPath)) {
            log(`Using cached image for ${relativePath}`, "DEBUG", "Images");
            recordFileProcessed(destPath, true);
            return { file, cached: true };
        }

        // Skip unsupported file types.
        if (!IMAGE_PROCESSORS[ext]) {
            log(`Skipping unsupported file: ${file} (${ext})`, "DEBUG", "Images");
            return {
                file,
                skipped: true,
                reason: "not-supported",
                supportedTypes: Object.keys(IMAGE_PROCESSORS),
            };
        }

        log(`Processing image: ${relativePath}`, "DEBUG", "Images");

        // Ensure output directory exists.
        try {
            ensureDirectoryExists(path.dirname(destPath));
        } catch (error) {
            return {
                file,
                error: `Failed to create output directory: ${error.message}`,
                skipped: true,
                reason: "directory-creation-failed",
            };
        }

        // Get the appropriate processor for this file type.
        const processor = IMAGE_PROCESSORS[ext];
        const processorOptions = ext.includes("png")
            ? TOOLS.imagemin.pngquant
            : TOOLS.imagemin.mozjpeg;

        // Validate processor options
        if (!processorOptions) {
            return {
                file,
                error: `No processor options configured for ${ext}`,
                skipped: true,
                reason: "missing-options",
            };
        }

        // Read the input file.
        let fileBuffer;
        try {
            fileBuffer = fs.readFileSync(file);
        } catch (error) {
            return {
                file,
                error: `Failed to read input file: ${error.message}`,
                skipped: true,
                reason: "read-error",
            };
        }

        // Validate file buffer.
        if (!fileBuffer || fileBuffer.length === 0) {
            return {
                file,
                error: "Empty or invalid image file",
                skipped: true,
                reason: "invalid-file",
            };
        }

        // Optimize the image.
        let optimizedBuffer;
        try {
            optimizedBuffer = await imagemin.buffer(fileBuffer, {
                plugins: [processor(processorOptions)],
            });
        } catch (error) {
            return {
                file,
                error: `Image optimization failed: ${error.message}`,
                skipped: true,
                reason: "optimization-failed",
            };
        }

        // Validate optimized buffer.
        if (!optimizedBuffer || optimizedBuffer.length === 0) {
            return {
                file,
                error: "Image optimization produced empty result",
                skipped: true,
                reason: "empty-optimization",
            };
        }

        // Write the optimized file.
        try {
            fs.writeFileSync(destPath, optimizedBuffer);
        } catch (error) {
            return {
                file,
                error: `Failed to write optimized file: ${error.message}`,
                skipped: true,
                reason: "write-error",
            };
        }

        // Update cache and record processing.
        try {
            updateCache(file, cacheFile);
            recordFileProcessed(destPath);
        } catch (error) {
            // Cache/recording errors are not critical, so we only log them.
            log(`Warning: Failed to update cache for ${file}: ${error.message}`, "WARNING", "Images");
        }

        // Calculate and log optimization results.
        try {
            const result = calculateOptimizationResult(file, destPath, relativePath);
            logFileProcessing(relativePath, result, "Images");
            return result;
        } catch (error) {
            // If we can't calculate optimization, still return success.
            log(`Warning: Failed to calculate optimization stats for ${file}: ${error.message}`, "WARNING", "Images");
            return {
                file,
                processed: true,
                optimized: false,
            };
        }
    } catch (error) {
        // Catch-all for any unexpected errors.
        log(`Unexpected error processing ${file}: ${error.message}`, "ERROR", "Images");
        return {
            file,
            error: error.message,
            skipped: true,
            reason: "unexpected-error",
        };
    }
}

/**
 * Calculate optimization results for reporting.
 * @param {string} originalFile - Path to original file
 * @param {string} optimizedFile - Path to optimized file
 * @param {string} relativePath - Relative path for logging
 * @returns {Object} - Optimization result
 */
function calculateOptimizationResult (originalFile, optimizedFile, relativePath) {
    const originalStats = fs.statSync(originalFile);
    const optimizedStats = fs.statSync(optimizedFile);
    const optimizationResult = calculateOptimization(
        originalStats.size,
        optimizedStats.size,
    );

    log(
        `Optimized ${relativePath}: ${optimizationResult.originalFormatted} → ${optimizationResult.optimizedFormatted} (${optimizationResult.percentage}% savings)`,
        "INFO",
        "Images",
    );

    return {
        file: originalFile,
        processed: true,
        optimized: true,
        ...optimizationResult,
    };
}
