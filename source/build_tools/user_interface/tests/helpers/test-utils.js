/**
 * Shared test utilities for the build tools test suite.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Common paths for tests.
 */
export const PATHS = {
    fixtures: path.join(__dirname, "../fixtures"),
    output: path.join(__dirname, "../output"),
    buildModules: path.join(__dirname, "../../build_modules"),
};

/**
 * Ensure the test output directory exists.
 */
export function ensureOutputDir () {
    if (!fs.existsSync(PATHS.output)) {
        fs.mkdirSync(PATHS.output, { recursive: true });
    }
    return PATHS.output;
}

/**
 * Create a temporary directory for a specific test.
 */
export function createTempDir (testName) {
    const dir = path.join(PATHS.output, testName, Date.now().toString());
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Clean up a directory after tests.
 */
export function cleanupDir (dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
    }
}

/**
 * Clean up all test output.
 */
export function cleanupAllOutput () {
    cleanupDir(PATHS.output);
}

/**
 * Read a fixture file.
 */
export function readFixture (relativePath) {
    const fullPath = path.join(PATHS.fixtures, relativePath);
    return fs.readFileSync(fullPath, "utf8");
}

/**
 * Check if a file exists.
 */
export function fileExists (filePath) {
    return fs.existsSync(filePath);
}

/**
 * Read a file's contents.
 */
export function readFile (filePath) {
    return fs.readFileSync(filePath, "utf8");
}

/**
 * Write content to a file (for test setup).
 */
export function writeFile (filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
}

/**
 * Get file size in bytes.
 */
export function getFileSize (filePath) {
    return fs.statSync(filePath).size;
}

/**
 * Wait for a condition to be true (useful for async tests).
 */
export async function waitFor (conditionFn, timeout = 5000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await conditionFn()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a simple mock function that tracks calls.
 * (For cases where you don't want to use node:test mock)
 */
export function createSpy () {
    const calls = [];
    const spy = function (...args) {
        calls.push(args);
        return spy.returnValue;
    };
    spy.calls = calls;
    spy.callCount = () => calls.length;
    spy.calledWith = (...args) => calls.some(
        call => JSON.stringify(call) === JSON.stringify(args),
    );
    spy.returnValue = undefined;
    spy.returns = (value) => {
        spy.returnValue = value;
        return spy;
    };
    return spy;
}
