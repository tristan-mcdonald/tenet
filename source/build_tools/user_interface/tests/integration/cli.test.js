/**
 * Integration tests for the build.js CLI entry point.
 *
 * Tests command-line interface behavior including help output,
 * error handling, and exit codes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_SCRIPT = path.join(__dirname, "../../build.js");

/**
 * Execute the build script with given arguments.
 *
 * @param {string[]} args - Command line arguments to pass.
 * @param {number} [timeout=10000] - Timeout in milliseconds.
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function execBuild (args = [], timeout = 10000) {
    return new Promise((resolve) => {
        const child = spawn("node", [BUILD_SCRIPT, ...args], {
            cwd: path.join(__dirname, "../.."),
            timeout,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {
            resolve({
                exitCode: code ?? 1,
                stdout,
                stderr,
            });
        });

        child.on("error", (error) => {
            resolve({
                exitCode: 1,
                stdout,
                stderr: stderr + error.message,
            });
        });
    });
}

describe("CLI Entry Point", () => {

    describe("Help command", () => {

        it("shows help with --help flag and exits 0", async (t) => {
            const { exitCode, stdout } = await execBuild(["--help"]);

            assert.equal(exitCode, 0, "should exit with code 0");
            assert.ok(stdout.includes("Frontend Build System"), "should show title");
            assert.ok(stdout.includes("Commands:"), "should list commands");
            assert.ok(stdout.includes("build"), "should mention build command");
            assert.ok(stdout.includes("develop"), "should mention develop command");

            t.diagnostic("Help output displayed correctly");
        });

        it("shows help with -h flag and exits 0", async () => {
            const { exitCode, stdout } = await execBuild(["-h"]);

            assert.equal(exitCode, 0);
            assert.ok(stdout.includes("Frontend Build System"));
        });

        it("shows help and exits 1 when no command provided", async () => {
            const { exitCode, stdout } = await execBuild([]);

            assert.equal(exitCode, 1, "should exit with code 1 when no command");
            assert.ok(stdout.includes("Frontend Build System"), "should still show help");
        });
    });

    describe("Error handling", () => {

        it("exits 1 for unknown command", async (t) => {
            const { exitCode, stdout, stderr } = await execBuild(["nonexistent-command"]);

            assert.equal(exitCode, 1, "should exit with code 1");
            const output = stdout + stderr;
            assert.ok(
                output.includes("not found") || output.includes("error") || output.includes("Error"),
                "should indicate error in output",
            );

            t.diagnostic("Unknown command handled correctly");
        });

        it("exits 1 for misspelled command", async () => {
            const { exitCode } = await execBuild(["biuld"]); // typo

            assert.equal(exitCode, 1);
        });
    });

    describe("Clean command", () => {

        it("runs clean task successfully", async (t) => {
            const { exitCode } = await execBuild(["clean"]);

            assert.equal(exitCode, 0, "clean should exit with code 0");

            t.diagnostic("Clean command completed successfully");
        });
    });

    describe("Lint command", () => {

        it("runs lint task", async (t) => {
            const { exitCode } = await execBuild(["lint"], 30000);

            // Lint may exit 0 (no issues) or 1 (issues found)
            // We just verify it runs without crashing
            assert.ok(
                exitCode === 0 || exitCode === 1,
                `lint should exit with 0 or 1, got ${exitCode}`,
            );

            t.diagnostic(`Lint completed with exit code ${exitCode}`);
        });
    });
});
