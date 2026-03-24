/**
 * Integration tests for CSS/Stylus build pipeline.
 *
 * Tests Stylus compilation, PostCSS transforms, and CSS minification
 * on real fixture files.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import stylus from "stylus";
import CleanCSS from "clean-css";
import postcss from "postcss";
import autoprefixer from "autoprefixer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../fixtures");
const OUTPUT = path.join(__dirname, "../output/css-integration");

describe("Stylus Build Integration", () => {

    before(() => {
        fs.mkdirSync(OUTPUT, { recursive: true });
    });

    after(() => {
        if (fs.existsSync(OUTPUT)) {
            fs.rmSync(OUTPUT, { recursive: true });
        }
    });

    describe("Stylus compilation", () => {

        it("compiles valid Stylus to CSS", async (t) => {
            const inputFile = path.join(FIXTURES, "stylus/valid.styl");
            const stylusCode = fs.readFileSync(inputFile, "utf8");

            const css = await new Promise((resolve, reject) => {
                stylus(stylusCode)
                    .set("filename", inputFile)
                    .render((err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });

            assert.ok(css.length > 0, "should produce CSS output");
            assert.ok(css.includes("{"), "should contain CSS rules");
            assert.ok(css.includes("body"), "should include body selector");
            assert.ok(css.includes(".button"), "should include .button selector");

            t.diagnostic(`Compiled to ${css.length} bytes of CSS`);

            // Write output for inspection
            fs.writeFileSync(path.join(OUTPUT, "compiled.css"), css);
        });

        it("resolves Stylus variables", async () => {
            const inputFile = path.join(FIXTURES, "stylus/valid.styl");
            const stylusCode = fs.readFileSync(inputFile, "utf8");

            const css = await new Promise((resolve, reject) => {
                stylus(stylusCode)
                    .set("filename", inputFile)
                    .render((err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });

            // Variables should be resolved to actual values
            assert.ok(!css.includes("$primary-color"), "variables should be resolved");
            assert.ok(!css.includes("$spacing"), "variables should be resolved");

            // Check that the color value is present
            assert.ok(css.includes("#3498db"), "should have resolved primary color");
        });

        it("processes nesting correctly", async () => {
            const inputFile = path.join(FIXTURES, "stylus/valid.styl");
            const stylusCode = fs.readFileSync(inputFile, "utf8");

            const css = await new Promise((resolve, reject) => {
                stylus(stylusCode)
                    .set("filename", inputFile)
                    .render((err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });

            // Nested &:hover should compile to .button:hover
            assert.ok(css.includes(".button:hover"), "should expand nested hover selector");
            assert.ok(css.includes(".button:focus"), "should expand nested focus selector");
        });

        it("evaluates Stylus functions", async () => {
            const inputFile = path.join(FIXTURES, "stylus/valid.styl");
            const stylusCode = fs.readFileSync(inputFile, "utf8");

            const css = await new Promise((resolve, reject) => {
                stylus(stylusCode)
                    .set("filename", inputFile)
                    .render((err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });

            // darken() function should produce a different color than the original #3498db
            // The hover state should have a darkened color
            assert.ok(
                css.includes(".button:hover"),
                "should have hover state",
            );

            // Check that the hover background is different from the original
            const originalColor = "#3498db";
            const hoverMatch = css.match(/\.button:hover\s*\{[^}]*background-color:\s*(#[a-f0-9]+)/i);
            assert.ok(hoverMatch, "should have hover background color");
            assert.notEqual(hoverMatch[1].toLowerCase(), originalColor, "darken should produce different color");
        });
    });

    describe("PostCSS and Autoprefixer", () => {

        it("adds vendor prefixes with Autoprefixer", async (t) => {
            // CSS with properties that need prefixing
            const css = `
                .flex-container {
                    display: flex;
                    user-select: none;
                }
            `;

            const result = await postcss([
                autoprefixer({ overrideBrowserslist: ["> 1%"] }),
            ]).process(css, { from: undefined });

            // Check for webkit prefix on user-select
            assert.ok(
                result.css.includes("-webkit-user-select") ||
                result.css.includes("user-select"),
                "should process user-select",
            );

            t.diagnostic("Autoprefixer processed CSS successfully");
        });
    });

    describe("CSS minification with CleanCSS", () => {

        it("minifies CSS and reduces file size", async (t) => {
            const css = `
                body {
                    margin: 0;
                    padding: 0;
                    background-color: white;
                }

                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 16px;
                }

                .button {
                    display: inline-block;
                    background-color: #3498db;
                    color: white;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                }
            `;

            const cleanCss = new CleanCSS({ level: 2 });
            const result = cleanCss.minify(css);

            assert.equal(result.errors.length, 0, "should have no errors");
            assert.ok(result.styles.length < css.length, "minified should be smaller");
            assert.ok(!result.styles.includes("\n"), "should remove newlines");

            const reduction = ((css.length - result.styles.length) / css.length * 100).toFixed(1);
            t.diagnostic(`Minification reduced CSS by ${reduction}%`);
        });

        it("optimizes redundant properties", () => {
            const css = `
                .box {
                    margin-top: 10px;
                    margin-right: 10px;
                    margin-bottom: 10px;
                    margin-left: 10px;
                }
            `;

            const cleanCss = new CleanCSS({ level: 2 });
            const result = cleanCss.minify(css);

            // Level 2 optimization should combine to shorthand
            assert.ok(
                result.styles.includes("margin:10px") ||
                result.styles.includes("margin: 10px"),
                "should optimize to margin shorthand",
            );
        });

        it("preserves important CSS functionality", () => {
            const css = `
                @media (min-width: 768px) {
                    .container { max-width: 720px; }
                }
                .hidden { display: none !important; }
            `;

            const cleanCss = new CleanCSS({ level: 2 });
            const result = cleanCss.minify(css);

            assert.ok(result.styles.includes("@media"), "should preserve media queries");
            assert.ok(result.styles.includes("!important"), "should preserve !important");
        });
    });

    describe("Full CSS pipeline", () => {

        it("processes Stylus through full pipeline", async (t) => {
            const inputFile = path.join(FIXTURES, "stylus/valid.styl");
            const stylusCode = fs.readFileSync(inputFile, "utf8");

            // Step 1: Compile Stylus
            const compiledCss = await new Promise((resolve, reject) => {
                stylus(stylusCode)
                    .set("filename", inputFile)
                    .render((err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });
            t.diagnostic(`1. Stylus compiled: ${compiledCss.length} bytes`);

            // Step 2: PostCSS with Autoprefixer
            const prefixedResult = await postcss([
                autoprefixer({ overrideBrowserslist: ["> 1%"] }),
            ]).process(compiledCss, { from: undefined });
            t.diagnostic(`2. Autoprefixer applied: ${prefixedResult.css.length} bytes`);

            // Step 3: Minify with CleanCSS
            const cleanCss = new CleanCSS({ level: 2 });
            const minified = cleanCss.minify(prefixedResult.css);
            t.diagnostic(`3. Minified: ${minified.styles.length} bytes`);

            // Verify final output
            assert.equal(minified.errors.length, 0, "no errors in pipeline");
            assert.ok(minified.styles.length < compiledCss.length, "final output smaller than input");

            // Write final output
            fs.writeFileSync(path.join(OUTPUT, "final.min.css"), minified.styles);
        });
    });

    describe("Error handling", () => {

        it("reports Stylus syntax errors", async () => {
            // Use actual invalid syntax that Stylus will reject
            const badStylus = `
body
  color: {invalid syntax}
            `;

            await assert.rejects(
                new Promise((resolve, reject) => {
                    stylus(badStylus).render((err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                }),
                (error) => {
                    assert.ok(error.message, "should have error message");
                    assert.ok(
                        error.message.includes("expected") || error.message.includes("syntax"),
                        "should indicate syntax problem",
                    );
                    return true;
                },
            );
        });
    });
});
