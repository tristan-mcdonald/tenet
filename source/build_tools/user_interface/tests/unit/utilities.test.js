/**
 * Unit tests for utility functions.
 *
 * Tests pure utility functions like formatting, hashing,
 * and file operations.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    formatDuration,
    formatBytes,
    formatError,
    calculateFileHash,
    ensureDirectoryExists,
    readJsonFile,
} from "../../build_modules/utilities.js";

import { BuildError, ErrorCategory } from "../../build_modules/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../output/utilities-test");

describe("Utilities", () => {

    afterEach(() => {
        // Clean up test output
        if (fs.existsSync(OUTPUT_DIR)) {
            fs.rmSync(OUTPUT_DIR, { recursive: true });
        }
    });

    describe("formatDuration", () => {

        it("formats milliseconds to seconds", () => {
            assert.equal(formatDuration(500), "0.50s");
            assert.equal(formatDuration(1000), "1.00s");
            assert.equal(formatDuration(1500), "1.50s");
            assert.equal(formatDuration(2345), "2.35s");
        });

        it("formats zero milliseconds", () => {
            assert.equal(formatDuration(0), "0.00s");
        });

        it("formats minutes and seconds for longer durations", () => {
            assert.equal(formatDuration(60000), "1m 0.00s");
            assert.equal(formatDuration(65000), "1m 5.00s");
            assert.equal(formatDuration(125000), "2m 5.00s");
        });

        it("handles precise decimal values", () => {
            assert.equal(formatDuration(123), "0.12s");
            assert.equal(formatDuration(999), "1.00s");
        });
    });

    describe("formatBytes", () => {

        it("formats zero bytes", () => {
            assert.equal(formatBytes(0), "0 Bytes");
        });

        it("formats bytes", () => {
            assert.equal(formatBytes(100), "100 Bytes");
            assert.equal(formatBytes(512), "512 Bytes");
            assert.equal(formatBytes(1023), "1023 Bytes");
        });

        it("formats kilobytes", () => {
            assert.equal(formatBytes(1024), "1 KB");
            assert.equal(formatBytes(1536), "1.5 KB");
            assert.equal(formatBytes(2048), "2 KB");
        });

        it("formats megabytes", () => {
            assert.equal(formatBytes(1048576), "1 MB");
            assert.equal(formatBytes(1572864), "1.5 MB");
        });

        it("respects decimal places parameter", () => {
            assert.equal(formatBytes(1536, 0), "2 KB");
            assert.equal(formatBytes(1536, 1), "1.5 KB");
            assert.equal(formatBytes(1536, 3), "1.5 KB");
        });
    });

    describe("formatError", () => {

        it("formats string input", () => {
            const result = formatError("Simple error message");
            assert.equal(result, "Simple error message");
        });

        it("formats generic Error", () => {
            const error = new Error("Something went wrong");
            const result = formatError(error);
            assert.equal(result, "Something went wrong");
        });

        it("formats BuildError with context", () => {
            const error = new BuildError("Build failed", {
                context: { file: "/path/to/file.js" },
            });

            const result = formatError(error);
            assert.ok(result.includes("Build failed"));
            assert.ok(result.includes("/path/to/file.js"));
        });

        it("includes stack trace when requested", () => {
            const error = new Error("With stack");
            const result = formatError(error, true);

            assert.ok(result.includes("With stack"));
            assert.ok(result.includes("at "), "should include stack trace");
        });

        it("includes BuildError details with stack", () => {
            const error = new BuildError("Detailed error", {
                code: "ERR_001",
                category: ErrorCategory.SYNTAX,
            });

            const result = formatError(error, true);

            assert.ok(result.includes("ERR_001"));
            assert.ok(result.includes("syntax"));
        });
    });

    describe("calculateFileHash", () => {

        it("returns consistent SHA256 hash for file", () => {
            // Use a known fixture file
            const fixturePath = path.join(__dirname, "../fixtures/js/valid.js");

            const hash1 = calculateFileHash(fixturePath);
            const hash2 = calculateFileHash(fixturePath);

            assert.equal(hash1, hash2, "same file should produce same hash");
            assert.equal(hash1.length, 64, "SHA256 produces 64 hex characters");
            assert.match(hash1, /^[a-f0-9]{64}$/, "should be valid hex string");
        });

        it("produces different hashes for different files", () => {
            const jsFixture = path.join(__dirname, "../fixtures/js/valid.js");
            const helperFixture = path.join(__dirname, "../fixtures/js/modules/helper.js");

            const hash1 = calculateFileHash(jsFixture);
            const hash2 = calculateFileHash(helperFixture);

            assert.notEqual(hash1, hash2, "different files should have different hashes");
        });

        it("returns null for non-existent file", () => {
            const hash = calculateFileHash("/nonexistent/path/file.js");
            assert.equal(hash, null);
        });
    });

    describe("ensureDirectoryExists", () => {

        it("creates directory if it does not exist", () => {
            const testDir = path.join(OUTPUT_DIR, "new-directory");

            assert.equal(fs.existsSync(testDir), false, "directory should not exist yet");

            ensureDirectoryExists(testDir);

            assert.equal(fs.existsSync(testDir), true, "directory should now exist");
        });

        it("creates nested directories", () => {
            const nestedDir = path.join(OUTPUT_DIR, "deep/nested/directory");

            ensureDirectoryExists(nestedDir);

            assert.equal(fs.existsSync(nestedDir), true);
        });

        it("does nothing if directory already exists", () => {
            const testDir = path.join(OUTPUT_DIR, "existing");
            fs.mkdirSync(testDir, { recursive: true });

            // Should not throw
            ensureDirectoryExists(testDir);

            assert.equal(fs.existsSync(testDir), true);
        });
    });

    describe("readJsonFile", () => {

        it("reads and parses JSON file correctly", () => {
            const packageJson = path.join(__dirname, "../../package.json");
            const data = readJsonFile(packageJson);

            assert.equal(data.type, "module");
            assert.ok(data.devDependencies, "should have devDependencies");
        });

        it("returns default value for non-existent file", () => {
            const result = readJsonFile("/nonexistent/file.json", { fallback: true });
            assert.deepEqual(result, { fallback: true });
        });

        it("returns empty object as default when no default provided", () => {
            const result = readJsonFile("/nonexistent/file.json");
            assert.deepEqual(result, {});
        });

        it("returns default value for invalid JSON", () => {
            // Create a temp file with invalid JSON
            const invalidJsonPath = path.join(OUTPUT_DIR, "invalid.json");
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
            fs.writeFileSync(invalidJsonPath, "{ invalid json }");

            const result = readJsonFile(invalidJsonPath, { default: "value" });
            assert.deepEqual(result, { default: "value" });
        });
    });
});
