/**
 * Integration tests for JavaScript build pipeline.
 *
 * Tests ESBuild bundling and minification on real fixture files,
 * verifying that the actual tools produce correct output.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../fixtures");
const OUTPUT = path.join(__dirname, "../output/js-integration");

describe("JavaScript Build Integration", () => {

    before(() => {
        fs.mkdirSync(OUTPUT, { recursive: true });
    });

    after(() => {
        if (fs.existsSync(OUTPUT)) {
            fs.rmSync(OUTPUT, { recursive: true });
        }
    });

    describe("ESBuild bundling", () => {

        it("bundles JavaScript with ES module imports into single file", async (t) => {
            const inputFile = path.join(FIXTURES, "js/valid.js");
            const outputFile = path.join(OUTPUT, "bundle.js");

            await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: outputFile,
                format: "iife",
                platform: "browser",
            });

            assert.ok(fs.existsSync(outputFile), "bundled file should exist");

            const content = fs.readFileSync(outputFile, "utf8");
            assert.ok(content.length > 0, "output should have content");

            // IIFE format wraps code in an immediately-invoked function
            assert.ok(
                content.includes("(() =>") || content.includes("(function()"),
                "should be wrapped in IIFE format",
            );

            // The bundled output should include code from both files
            assert.ok(content.includes("Hello"), "should include helper module code");
            assert.ok(content.includes("Test Application"), "should include main module code");

            t.diagnostic(`Bundled ${fs.statSync(outputFile).size} bytes`);
        });

        it("resolves and bundles import dependencies", async () => {
            const inputFile = path.join(FIXTURES, "js/valid.js");
            const outputFile = path.join(OUTPUT, "with-deps.js");

            const result = await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: outputFile,
                format: "iife",
                metafile: true,
            });

            // Check that ESBuild tracked the dependency
            const inputs = Object.keys(result.metafile.inputs);
            assert.ok(inputs.length >= 2, "should have at least 2 input files (main + helper)");

            const hasHelper = inputs.some(p => p.includes("helper.js"));
            assert.ok(hasHelper, "should track helper.js as dependency");
        });

        it("generates source maps when requested", async () => {
            const inputFile = path.join(FIXTURES, "js/valid.js");
            const outputFile = path.join(OUTPUT, "with-sourcemap.js");

            await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: outputFile,
                sourcemap: true,
            });

            const mapFile = outputFile + ".map";
            assert.ok(fs.existsSync(mapFile), "source map file should exist");

            const mapContent = JSON.parse(fs.readFileSync(mapFile, "utf8"));
            assert.ok(mapContent.sources, "source map should have sources array");
            assert.ok(mapContent.mappings, "source map should have mappings");
        });
    });

    describe("ESBuild minification", () => {

        it("minifies JavaScript and reduces file size", async (t) => {
            const inputFile = path.join(FIXTURES, "js/valid.js");
            const normalOutput = path.join(OUTPUT, "normal.js");
            const minifiedOutput = path.join(OUTPUT, "minified.js");

            // Build non-minified version
            await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: normalOutput,
                minify: false,
            });

            // Build minified version
            await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: minifiedOutput,
                minify: true,
            });

            const normalSize = fs.statSync(normalOutput).size;
            const minifiedSize = fs.statSync(minifiedOutput).size;

            assert.ok(
                minifiedSize < normalSize,
                `minified (${minifiedSize}B) should be smaller than normal (${normalSize}B)`,
            );

            const reduction = ((normalSize - minifiedSize) / normalSize * 100).toFixed(1);
            t.diagnostic(`Minification reduced size by ${reduction}%`);
        });

        it("removes whitespace and shortens variable names", async () => {
            const inputFile = path.join(FIXTURES, "js/valid.js");
            const outputFile = path.join(OUTPUT, "minified-check.js");

            await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: outputFile,
                minify: true,
            });

            const content = fs.readFileSync(outputFile, "utf8");

            // Minified code should have minimal newlines
            const newlineCount = (content.match(/\n/g) || []).length;
            assert.ok(newlineCount < 5, "minified code should have few newlines");

            // Check that it's a single line or nearly so
            assert.ok(
                content.trim().split("\n").length <= 2,
                "minified code should be compact",
            );
        });
    });

    describe("ESBuild browser targeting", () => {

        it("transpiles for browser target", async () => {
            const inputFile = path.join(FIXTURES, "js/valid.js");
            const outputFile = path.join(OUTPUT, "browser-target.js");

            await esbuild.build({
                entryPoints: [inputFile],
                bundle: true,
                outfile: outputFile,
                format: "iife",
                platform: "browser",
                target: ["chrome80", "firefox78", "safari13"],
            });

            const content = fs.readFileSync(outputFile, "utf8");

            // Should produce valid JavaScript for browsers
            assert.ok(content.length > 0);
            assert.ok(!content.includes("require("), "should not use CommonJS require");
        });
    });

    describe("Error handling", () => {

        it("reports syntax errors with helpful messages", async () => {
            // Create a temporary file with syntax error
            const badFile = path.join(OUTPUT, "bad-syntax.js");
            fs.writeFileSync(badFile, "function broken( { return }");

            await assert.rejects(
                () => esbuild.build({
                    entryPoints: [badFile],
                    bundle: true,
                    outfile: path.join(OUTPUT, "should-fail.js"),
                }),
                (error) => {
                    assert.ok(error.message.includes("error"), "should report error");
                    return true;
                },
            );
        });

        it("reports missing import errors", async () => {
            const badFile = path.join(OUTPUT, "bad-import.js");
            fs.writeFileSync(badFile, 'import { missing } from "./nonexistent.js";');

            await assert.rejects(
                () => esbuild.build({
                    entryPoints: [badFile],
                    bundle: true,
                    outfile: path.join(OUTPUT, "should-fail.js"),
                }),
                (error) => {
                    assert.ok(
                        error.message.includes("resolve") || error.message.includes("not found"),
                        "should report resolution error",
                    );
                    return true;
                },
            );
        });
    });
});
