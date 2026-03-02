/**
 * @fileoverview CSS/Stylus processing tasks.
 *
 * Handles the complete CSS build pipeline:
 * - **Linting**: Stylint for code quality
 * - **Compilation**: Stylus to CSS with Rupture plugin
 * - **PostCSS**: Autoprefixer and CSS MQPacker
 * - **Minification**: CleanCSS level 2 optimisation
 * - **Source maps**: Optional inline source maps
 *
 * @module tasks/stylus
 * @see {@link ../config.js} for CSS configuration
 */

import autoprefixer from "autoprefixer";
import CleanCSS from "clean-css";
import fs from "fs";
import mqpacker from "css-mqpacker";
import path from "path";
import postcss from "postcss";
import stylus from "stylus";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

/** @private */
const __filename = fileURLToPath(import.meta.url);

/** @private */
const __dirname = path.dirname(__filename);

import { cleanFiles, createMinificationProcessor, processWithCache, readProcessWrite, removeSourceMapReferences } from "../task_utilities.js";
import { createTaskError, formatError, log } from "../utilities.js";
import { DependencyError, FileSystemError, ProcessError, SyntaxError } from "../errors.js";
import { ENV, PATHS, TOOLS } from "../config.js";

/**
 * Clean CSS files.
 * Removes all generated CSS files from the output directory.
 *
 * @async
 * @returns {Promise<number>} Number of files deleted.
 */
export async function cleanCss () {
    return cleanFiles(PATHS.common.css, {
        context: "Stylus",
    });
}

/**
 * Lint Stylus files with error handling and context.
 */
export async function lintStylus () {
    log("Linting Stylus files...", "INFO", "Stylus");

    try {
        // We use the CLI for stylint as it doesn't have a decent Node.js API.
        const stylusDir = path.join(PATHS.css.input, "..");
        const configFile = TOOLS.stylint.configFile;

        // Validate input directory exists.
        if (!fs.existsSync(stylusDir)) {
            throw createTaskError(
                FileSystemError,
                `Stylus directory not found: ${stylusDir}`,
                "lint-stylus",
                stylusDir,
            );
        }

        // Validate config file exists.
        if (!fs.existsSync(configFile)) {
            throw createTaskError(
                FileSystemError,
                `Stylint config file not found: ${configFile}`,
                "lint-stylus",
                configFile,
            );
        }

        // Prefer local binary to avoid PATH issues when not run via NPM scripts.
        const localStylint = path.join(__dirname, "..", "..", "node_modules", ".bin", "stylint");
        const stylintCmd = fs.existsSync(localStylint) ? localStylint : "stylint";

        // Check if stylint is available.
        if (!fs.existsSync(localStylint)) {
            try {
                execFileSync("which", ["stylint"], { stdio: "ignore" });
            } catch {
                throw createTaskError(
                    DependencyError,
                    "Stylint is not installed or not found in PATH",
                    "lint-stylus",
                );
            }
        }

        try {
            execFileSync(
                stylintCmd,
                [stylusDir, "-c", configFile],
                { stdio: "inherit" },
            );

            log("Stylus linting completed", "INFO", "Stylus");
            return true;
        } catch (error) {
            // Stylint exits with non-zero code when lint errors are found.
            if (error.status && error.status !== 0) {
                throw createTaskError(
                    SyntaxError,
                    `Stylus linting found issues in your files`,
                    "lint-stylus",
                    stylusDir,
                );
            } else {
                throw createTaskError(
                    ProcessError,
                    `Stylint execution failed: ${error.message}`,
                    "lint-stylus",
                    stylusDir,
                    error,
                );
            }
        }
    } catch (error) {
        if (error instanceof FileSystemError || error instanceof DependencyError || error instanceof SyntaxError) {
            throw error;
        }

        throw createTaskError(
            ProcessError,
            `Stylus linting failed: ${formatError(error)}`,
            "lint-stylus",
            null,
            error,
        );
    }
}

/**
 * Create a Stylus compiler with the configured options.
 * @param {string} stylusCode - Stylus code to compile
 * @param {string} inputFile - Input file path
 * @returns {Object} - Configured Stylus compiler
 */
async function createStylusCompiler (stylusCode, inputFile) {
    // Set up stylus compiler.
    const compiler = stylus(stylusCode)
        .set("filename", inputFile)
        .set("compress", TOOLS.stylus.compress);

    // Add sourcemaps if enabled.
    if (TOOLS.stylus.sourcemap) {
        compiler.set("sourcemap", TOOLS.stylus.sourcemap);
    }

    // Use Rupture for responsive utilities if configured.
    if (TOOLS.stylus.use.includes("rupture")) {
        const rupture = (await import("rupture")).default;
        compiler.use(rupture());
    }

    return compiler;
}

/**
 * Render Stylus to CSS with error handling.
 * @param {Object} compiler - Stylus compiler
 * @param {string} inputFile - Input file path for error context
 * @returns {Promise<string>} - Compiled CSS
 */
function renderStylus (compiler, inputFile = "unknown") {
    return new Promise((resolve, reject) => {
        compiler.render((err, result) => {
            if (err) {
                // Create a detailed Stylus compilation error.
                const stylusError = createTaskError(
                    SyntaxError,
                    `Stylus compilation error: ${err.message}`,
                    "transpile-stylus",
                    inputFile,
                    err,
                );

                // Add line/column information if available.
                if (err.lineno) {
                    stylusError.context.line = err.lineno;
                }
                if (err.column) {
                    stylusError.context.column = err.column;
                }
                if (err.filename) {
                    stylusError.context.file = err.filename;
                }

                stylusError.suggestions.push("Check the Stylus syntax in the specified file");
                stylusError.suggestions.push("Review variable definitions and imports");

                reject(stylusError);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Process CSS with PostCSS plugins with error handling.
 * @param {string} css - CSS to process
 * @param {string} inputFile - Input file path
 * @param {string} outputFile - Output file path
 * @returns {Promise<Object>} - PostCSS result
 */
async function processWithPostCSS (css, inputFile, outputFile) {
    try {
        const postcssProcessor = postcss([
            autoprefixer(),
            mqpacker(),
        ]);

        return await postcssProcessor.process(css, {
            from: inputFile,
            to: outputFile,
            map: ENV.activeProfile.sourceMaps ? { inline: true } : false,
        });
    } catch (error) {
        throw createTaskError(
            ProcessError,
            `PostCSS processing failed: ${error.message}`,
            "transpile-stylus",
            inputFile,
            error,
        );
    }
}

/**
 * Transpile Stylus to CSS.
 */
export async function transpileStylus () {
    log("Transpiling Stylus to CSS...", "INFO", "Stylus");

    const inputFile = PATHS.css.input;
    const outputFile = path.join(PATHS.css.output, "app.css");
    const cacheFile = PATHS.css.cache;

    // Custom processor for Stylus with dependency handling.
    const stylusProcessor = async (inputs, output) => {
        const [mainFile] = inputs;

        // Use the shared `readProcessWrite` utility for cleaner code.
        return readProcessWrite({
            input: mainFile,
            output,
            context: "Stylus",
            processor: async (stylusCode, inputFile, outputFile) => {
                // Set up and run the Stylus compiler.
                const compiler = await createStylusCompiler(stylusCode, inputFile);
                const css = await renderStylus(compiler, inputFile);

                // Process with PostCSS.
                const postcssResult = await processWithPostCSS(css, inputFile, outputFile);

                return { content: postcssResult.css, css: postcssResult.css };
            },
        });
    };

    // Get all dependencies for cache handling.
    const stylusCode = fs.readFileSync(inputFile, "utf8");
    const renderer = stylus(stylusCode)
        .set("filename", inputFile)
        .set("compress", TOOLS.stylus.compress);
    const dependencies = renderer.deps(inputFile);
    const allFiles = [inputFile, ...dependencies];

    return processWithCache({
        input: allFiles,
        output: outputFile,
        cache: cacheFile,
        processor: stylusProcessor,
        context: "Stylus",
    });
}

/**
 * Minify CSS.
 */
export const minifyCss = createMinificationProcessor({
    minifier: async (inputFile, outputFile) => {
        // Read the input file.
        const css = fs.readFileSync(inputFile, "utf8");

        // Minify with clean-css.
        const cleanCss = new CleanCSS(TOOLS.cleanCss);
        const minified = cleanCss.minify(css);

        // Check for errors.
        if (minified.errors.length > 0) {
            throw new Error(`CSS minification errors: ${minified.errors.join(", ")}`);
        }

        // Write the minified CSS.
        fs.writeFileSync(outputFile, minified.styles);

        // Write source map if enabled.
        if (ENV.activeProfile.sourceMaps && minified.sourceMap) {
            fs.writeFileSync(`${outputFile}.map`, JSON.stringify(minified.sourceMap));
        }

        return {
            file: outputFile,
            stats: {
                originalSize: minified.stats.originalSize,
                minifiedSize: minified.stats.minifiedSize,
                timeSpent: minified.stats.timeSpent,
                efficiency: minified.stats.efficiency,
            },
        };
    },
    inputPath: () => path.join(PATHS.css.output, "app.css"),
    outputPath: () => PATHS.css.uglified,
    context: "CSS",
});

/**
 * Remove sourcemap references if needed.
 */
export async function removeCssSourceMapReferences () {
    return removeSourceMapReferences(PATHS.css.uglified, "css", {
        context: "Stylus",
    });
}
