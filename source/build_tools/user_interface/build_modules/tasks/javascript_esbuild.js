/**
 * @fileoverview JavaScript processing tasks using ESBuild.
 *
 * Handles the complete JavaScript build pipeline:
 * - **Linting**: ESLint with unicorn and comment-length plugins
 * - **Bundling**: ESBuild module bundling (IIFE format)
 * - **Minification**: ESBuild minification with dead code elimination
 * - **Source maps**: Optional source map generation
 * - **Caching**: Dependency-aware caching for incremental builds
 *
 * @module tasks/javascript_esbuild
 * @see {@link ../config.js} for JavaScript configuration
 */

import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { ESLint } from "eslint";

import { cleanFiles, findFilesForPattern, processWithCache, removeSourceMapReferences, wrapTaskWithError } from "../task_utilities.js";
import { createTaskError, log, needsJavaScriptProcessing, recordFileProcessed, updateJavaScriptCache } from "../utilities.js";
import { DependencyError, ErrorCategory, ErrorSeverity, FileSystemError, ProcessError, SyntaxError } from "../errors.js";
import { ENV, PATHS, TOOLS } from "../config.js";

/**
 * Clean JavaScript files.
 * Removes all generated JS files from the output directory.
 *
 * @async
 * @returns {Promise<number>} Number of files deleted.
 */
export async function cleanJavaScript () {
    return cleanFiles(PATHS.common.js, {
        context: "JavaScript",
        ignore: PATHS.deleteIgnore,
    });
}

/**
 * Lint JavaScript files.
 */
export async function lintJavaScript (fix = false) {
    log("Linting JavaScript files...", "INFO", "JavaScript");

    try {
        // Initialize ESLint with error handling.
        let eslint;
        try {
            eslint = new ESLint({
                overrideConfigFile: TOOLS.eslint.configFile,
                cwd: path.resolve(path.dirname(PATHS.js.lint[0]), "../../.."), // Use the project root as cwd.
                baseConfig: {
                    ignores: [],
                },
                fix,
            });
        } catch (error) {
            throw createTaskError(
                DependencyError,
                `Failed to initialize ESLint: ${error.message}`,
                "lint-js",
                TOOLS.eslint.configFile,
                error,
            );
        }

        // Find all files to lint.
        log(`Current working directory: ${process.cwd()}`, "DEBUG", "JavaScript");
        log("Checking lint patterns:", "DEBUG", "JavaScript");

        let fileResults;
        try {
            fileResults = await Promise.all(
                PATHS.js.lint.map(pattern =>
                    findFilesForPattern(pattern, { context: "JavaScript", silent: false }),
                ),
            );
        } catch (error) {
            throw createTaskError(
                FileSystemError,
                `Failed to find JavaScript files for linting: ${error.message}`,
                "lint-js",
                null,
                error,
            );
        }

        // Collect results.
        const existingFiles = fileResults.flatMap(result => result.matches);
        const missingPatterns = PATHS.js.lint.filter(
            (_, index) => fileResults[index].isMissing,
        );

        // Report missing files.
        if (missingPatterns.length > 0) {
            log("The following patterns had no matching files:", "WARNING", "JavaScript");
            missingPatterns.forEach(pattern => {
                log(`  - ${pattern}`, "WARNING", "JavaScript");
            });
        }

        // Check if we have files to lint.
        if (existingFiles.length === 0) {
            const warningError = createTaskError(
                FileSystemError,
                "No JavaScript files found for linting",
                "lint-js",
            );
            warningError.severity = ErrorSeverity.WARNING;
            warningError.suggestions.push("Check your lint patterns in the configuration");
            warningError.suggestions.push("Ensure JavaScript files exist in the specified paths");
            throw warningError;
        }

        // Log files being linted.
        log(`Linting ${existingFiles.length} JavaScript files`, "INFO", "JavaScript");
        logFileSample(existingFiles);

        // Run ESLint.
        let results;
        try {
            results = await eslint.lintFiles(existingFiles);
        } catch (error) {
            throw createTaskError(
                ProcessError,
                `ESLint execution failed: ${error.message}`,
                "lint-js",
                null,
                error,
            );
        }

        // Write fixes to disk if fix mode is enabled.
        if (fix) {
            try {
                await ESLint.outputFixes(results);
            } catch (error) {
                log(`Warning: Failed to write some fixes: ${error.message}`, "WARNING", "JavaScript");
            }
        }

        // Format and display results.
        try {
            const formatter = await eslint.loadFormatter("stylish");
            const resultText = formatter.format(results);

            if (resultText) {
                log(resultText, "INFO", "ESLint");
            }
        } catch (error) {
            log(`Warning: Failed to format lint results: ${error.message}`, "WARNING", "JavaScript");
        }

        // Check for errors and create error information.
        const hasErrors = results.some(result => result.errorCount > 0);
        if (hasErrors) {
            const errorFiles = results
                .filter(result => result.errorCount > 0)
                .map(result => result.filePath);

            const errorCount = results.reduce((sum, result) => sum + result.errorCount, 0);
            const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0);

            const lintError = createTaskError(
                SyntaxError,
                `ESLint found ${errorCount} error(s) and ${warningCount} warning(s) in ${errorFiles.length} file(s)`,
                "lint-js",
            );

            lintError.context.errorCount = errorCount;
            lintError.context.warningCount = warningCount;
            lintError.context.errorFiles = errorFiles;

            if (fix) {
                lintError.suggestions.push("Some issues may have been auto-fixed. Check the output above.");
            } else {
                lintError.suggestions.push("Run with --fix to automatically resolve some issues");
            }
            lintError.suggestions.push("Review the ESLint output above for specific error details");

            throw lintError;
        }

        log("JavaScript linting completed", "INFO", "JavaScript");
        return results;
    } catch (error) {
        if (error instanceof SyntaxError || error instanceof DependencyError || error instanceof FileSystemError) {
            throw error;
        }

        throw createTaskError(
            ProcessError,
            `JavaScript linting failed: ${error.message}`,
            "lint-js",
            null,
            error,
        );
    }
}

/**
 * Log a sample of files for debugging.
 * @param {string[]} files - Array of file paths
 * @param {number} sampleSize - Number of files to show
 */
function logFileSample (files, sampleSize = 5) {
    const filesToShow = files.slice(0, sampleSize);
    filesToShow.forEach(file => {
        log(`  - ${file}`, "DEBUG", "JavaScript");
    });

    if (files.length > sampleSize) {
        log(`  - ... and ${files.length - sampleSize} more files`, "DEBUG", "JavaScript");
    }
}

/**
 * Transpile and bundle JavaScript using ESBuild.
 */
export async function transpileJavaScript () {
    log("Transpiling and bundling JavaScript with ESBuild...", "INFO", "JavaScript");

    const inputFile = PATHS.js.input;
    const outputFile = PATHS.js.transpiled;
    const cacheFile = PATHS.js.cache;

    // Custom processor for ESBuild.
    const esbuildProcessor = async (inputs, output) => {
        // Configure and run ESBuild.
        const buildResult = await esbuild.build({
            entryPoints: [inputs[0]],
            bundle: true,
            outfile: output,
            sourcemap: ENV.activeProfile.sourceMaps,
            minify: false, // We use a separate minify step.
            platform: "browser",
            target: TOOLS.esbuild.target,
            format: "iife",
            loader: TOOLS.esbuild.loader,
            define: TOOLS.esbuild.define,
            resolveExtensions: [".js"],
            nodePaths: [path.join(path.dirname(inputs[0]), "modules")],
            metafile: true,
        });

        // Log build analysis if available.
        if (buildResult.metafile) {
            const text = await esbuild.analyzeMetafile(buildResult.metafile);
            log("ESBuild bundle analysis:", "DEBUG", "JavaScript");
            log(text, "DEBUG", "JavaScript");
        }

        // Update JavaScript-specific cache with dependency information.
        updateJavaScriptCache(inputs[0], cacheFile, buildResult.metafile);

        return { metafile: buildResult.metafile };
    };

    // Use custom cache checking for JavaScript (handles dependencies).
    if (!needsJavaScriptProcessing(inputFile, cacheFile) && fs.existsSync(outputFile)) {
        log(`Using cached JavaScript bundle for ${inputFile}`, "INFO", "JavaScript");
        recordFileProcessed(outputFile, true);
        return { cached: true };
    }

    // Process with our custom processor.
    return processWithCache({
        input: inputFile,
        output: outputFile,
        cache: cacheFile,
        processor: esbuildProcessor,
        context: "JavaScript",
        skipIfExists: false, // We handle this above with `needsJavaScriptProcessing`.
    });
}

/**
 * Minify JavaScript using ESBuild.
 */
export const minifyJavaScript = wrapTaskWithError(
    "JavaScript minification",
    async () => {
        if (!ENV.activeProfile.minify) {
            log("JavaScript minification skipped (disabled in config)", "INFO", "JavaScript");
            return { skipped: true };
        }

        log("Minifying JavaScript with ESBuild...", "INFO", "JavaScript");

        const inputFile = PATHS.js.transpiled;
        const outputFile = PATHS.js.uglified;

        // Validate input file exists.
        if (!fs.existsSync(inputFile)) {
            throw createTaskError(
                FileSystemError,
                `Input file for minification not found: ${inputFile}`,
                "minify-js",
                inputFile,
            );
        }

        // Configure minification options.
        const minifyOptions = {
            entryPoints: [inputFile],
            outfile: outputFile,
            minify: true,
            sourcemap: ENV.activeProfile.sourceMaps,
            target: TOOLS.esbuild.target,
        };

        // In production, drop console and debugger statements.
        if (!ENV.isDevelopment) {
            minifyOptions.drop = ["console", "debugger"];
        }

        try {
            // Run minification.
            const result = await esbuild.build(minifyOptions);

            // Check for build errors.
            if (result.errors && result.errors.length > 0) {
                const errorMessages = result.errors.map(err => err.text).join("; ");
                throw createTaskError(
                    SyntaxError,
                    `ESBuild minification errors: ${errorMessages}`,
                    "minify-js",
                    inputFile,
                );
            }

            // Check for warnings.
            if (result.warnings && result.warnings.length > 0) {
                result.warnings.forEach(warning => {
                    log(`ESBuild warning: ${warning.text}`, "WARNING", "JavaScript");
                });
            }

            log(`JavaScript minified to ${outputFile}`, "INFO", "JavaScript");
            recordFileProcessed(outputFile);

            return { file: outputFile };
        } catch (error) {
            if (error.message?.includes("ESBuild")) {
                throw createTaskError(
                    ProcessError,
                    `JavaScript minification failed: ${error.message}`,
                    "minify-js",
                    inputFile,
                    error,
                );
            }
            throw error;
        }
    },
    {
        category: ErrorCategory.PROCESS,
        severity: ErrorSeverity.ERROR,
        suggestions: ["Check that the transpiled JavaScript file is valid", "Ensure ESBuild is properly installed"],
    },
);

/**
 * Remove sourcemap references if needed.
 */
export async function removeJsSourceMapReferences () {
    return removeSourceMapReferences(PATHS.js.uglified, "js", {
        context: "JavaScript",
    });
}
