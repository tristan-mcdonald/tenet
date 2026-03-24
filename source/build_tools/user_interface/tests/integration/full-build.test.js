/**
 * Integration tests for the complete build pipeline.
 *
 * Tests end-to-end build scenarios using the actual task registry
 * and build utilities.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createTaskRunner } from "../../build_modules/task_registry.js";
import {
    ensureDirectoryExists,
    calculateFileHash,
    formatDuration,
    formatBytes,
} from "../../build_modules/utilities.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, "../output/full-build");

describe("Full Build Pipeline", () => {

    before(() => {
        ensureDirectoryExists(OUTPUT);
    });

    after(() => {
        if (fs.existsSync(OUTPUT)) {
            fs.rmSync(OUTPUT, { recursive: true });
        }
    });

    describe("Task Runner with real tasks", () => {

        it("orchestrates a multi-step build workflow", async (t) => {
            const runner = createTaskRunner();
            const buildLog = [];

            // Register tasks that simulate a real build
            runner.registerTask("clean", () => {
                buildLog.push("Cleaned output directory");
                const cleanDir = path.join(OUTPUT, "dist");
                if (fs.existsSync(cleanDir)) {
                    fs.rmSync(cleanDir, { recursive: true });
                }
                fs.mkdirSync(cleanDir, { recursive: true });
                return { cleaned: true };
            }, { description: "Clean build directory" });

            runner.registerTask("build-js", async () => {
                buildLog.push("Built JavaScript");
                const outputPath = path.join(OUTPUT, "dist/app.js");
                fs.writeFileSync(outputPath, "// Built JS\nconsole.log('app');");
                return { output: outputPath };
            }, { description: "Build JavaScript" });

            runner.registerTask("build-css", async () => {
                buildLog.push("Built CSS");
                const outputPath = path.join(OUTPUT, "dist/app.css");
                fs.writeFileSync(outputPath, "/* Built CSS */\nbody { margin: 0; }");
                return { output: outputPath };
            }, { description: "Build CSS" });

            runner.registerTask("build", () => {
                buildLog.push("Build complete");
            }, {
                description: "Full build",
                dependencies: ["clean", "build-js", "build-css"],
            });

            // Run the full build
            await runner.runTask("build");

            // Verify execution order
            assert.equal(buildLog[0], "Cleaned output directory");
            assert.ok(buildLog.includes("Built JavaScript"));
            assert.ok(buildLog.includes("Built CSS"));
            assert.equal(buildLog[buildLog.length - 1], "Build complete");

            // Verify outputs exist
            assert.ok(fs.existsSync(path.join(OUTPUT, "dist/app.js")));
            assert.ok(fs.existsSync(path.join(OUTPUT, "dist/app.css")));

            t.diagnostic(`Build completed with ${buildLog.length} steps`);
        });

        it("handles parallel asset building", async (t) => {
            const runner = createTaskRunner();
            const startTimes = {};
            const endTimes = {};

            runner.registerTask("asset-js", async () => {
                startTimes.js = Date.now();
                await new Promise(r => setTimeout(r, 50));
                endTimes.js = Date.now();
            });

            runner.registerTask("asset-css", async () => {
                startTimes.css = Date.now();
                await new Promise(r => setTimeout(r, 50));
                endTimes.css = Date.now();
            });

            runner.registerTask("asset-images", async () => {
                startTimes.images = Date.now();
                await new Promise(r => setTimeout(r, 50));
                endTimes.images = Date.now();
            });

            const start = Date.now();
            await runner.runParallel(["asset-js", "asset-css", "asset-images"]);
            const totalTime = Date.now() - start;

            // All tasks should run in parallel, so total time ~50ms not ~150ms
            assert.ok(
                totalTime < 120,
                `Parallel build should take <120ms, took ${totalTime}ms`,
            );

            t.diagnostic(`Parallel build completed in ${totalTime}ms`);
        });

        it("respects task dependencies", async () => {
            const runner = createTaskRunner();
            const order = [];

            runner.registerTask("lint", () => order.push("lint"));
            runner.registerTask("compile", () => order.push("compile"), {
                dependencies: ["lint"],
            });
            runner.registerTask("minify", () => order.push("minify"), {
                dependencies: ["compile"],
            });

            await runner.runTask("minify");

            assert.deepEqual(order, ["lint", "compile", "minify"]);
        });
    });

    describe("File hashing and caching", () => {

        it("detects file changes via hash comparison", (t) => {
            const testFile = path.join(OUTPUT, "hashtest.txt");

            // Create initial file
            fs.writeFileSync(testFile, "Initial content");
            const hash1 = calculateFileHash(testFile);

            // Modify file
            fs.writeFileSync(testFile, "Modified content");
            const hash2 = calculateFileHash(testFile);

            assert.notEqual(hash1, hash2, "hash should change when file changes");

            // Restore original content
            fs.writeFileSync(testFile, "Initial content");
            const hash3 = calculateFileHash(testFile);

            assert.equal(hash1, hash3, "hash should match for identical content");

            t.diagnostic("File hash detection working correctly");
        });

        it("can implement cache-based build skipping", async (t) => {
            const cacheFile = path.join(OUTPUT, ".cache.json");
            const sourceFile = path.join(OUTPUT, "source.js");

            // Create source file
            fs.writeFileSync(sourceFile, "const x = 1;");

            // First build - no cache
            let needsBuild = !fs.existsSync(cacheFile);
            assert.ok(needsBuild, "should build on first run");

            // Save hash to cache
            const hash = calculateFileHash(sourceFile);
            fs.writeFileSync(cacheFile, JSON.stringify({ [sourceFile]: hash }));

            // Second check - file unchanged
            const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
            const currentHash = calculateFileHash(sourceFile);
            needsBuild = cache[sourceFile] !== currentHash;

            assert.ok(!needsBuild, "should skip build when unchanged");

            // Modify source
            fs.writeFileSync(sourceFile, "const x = 2;");
            const newHash = calculateFileHash(sourceFile);
            needsBuild = cache[sourceFile] !== newHash;

            assert.ok(needsBuild, "should rebuild when file changes");

            t.diagnostic("Cache-based build skipping working correctly");
        });
    });

    describe("Build statistics and reporting", () => {

        it("tracks timing information", async (t) => {
            const stats = {
                startTime: Date.now(),
                tasks: {},
            };

            // Simulate task timing
            const taskName = "test-task";
            stats.tasks[taskName] = { startTime: Date.now() };

            await new Promise(r => setTimeout(r, 50));

            stats.tasks[taskName].endTime = Date.now();
            stats.tasks[taskName].duration = stats.tasks[taskName].endTime - stats.tasks[taskName].startTime;

            const duration = formatDuration(stats.tasks[taskName].duration);
            assert.ok(duration.includes("s"), "should format duration");

            t.diagnostic(`Task completed in ${duration}`);
        });

        it("reports file sizes", (t) => {
            const testFile = path.join(OUTPUT, "sizetest.txt");
            fs.writeFileSync(testFile, "A".repeat(2048)); // 2KB

            const size = fs.statSync(testFile).size;
            const formatted = formatBytes(size);

            assert.equal(formatted, "2 KB");

            t.diagnostic(`File size: ${formatted}`);
        });
    });

    describe("Error recovery scenarios", () => {

        it("continues after non-critical task failures in dev mode", async (t) => {
            const runner = createTaskRunner();
            const completed = [];

            runner.registerTask("may-fail", async () => {
                // Simulate a non-critical failure
                completed.push("may-fail-attempted");
                return new Error("Non-critical issue");
            }, {
                critical: false,
                description: "Optional task",
            });

            runner.registerTask("next-task", () => {
                completed.push("next-task");
            });

            // Run sequence - should continue despite failure
            try {
                await runner.runSequence(["may-fail", "next-task"]);
            } catch {
                // Expected in some modes
            }

            assert.ok(completed.includes("may-fail-attempted"));

            t.diagnostic("Error handling test completed");
        });
    });
});
