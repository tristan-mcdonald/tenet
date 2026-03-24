/**
 * Unit tests for the error handling system.
 *
 * Tests the BuildError class hierarchy, error classification,
 * and contextual error creation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    BuildError,
    FileSystemError,
    ValidationError,
    DependencyError,
    SyntaxError,
    ConfigurationError,
    NetworkError,
    ProcessError,
    TimeoutError,
    ResourceError,
    ErrorSeverity,
    ErrorCategory,
    createContextualError,
    isRecoverableError,
    formatErrorForUser,
    extractErrorInfo,
} from "../../build_modules/errors.js";

describe("Error System", () => {

    describe("BuildError base class", () => {

        it("creates error with correct defaults", () => {
            const error = new BuildError("Something went wrong");

            assert.equal(error.message, "Something went wrong");
            assert.equal(error.severity, ErrorSeverity.ERROR);
            assert.equal(error.category, ErrorCategory.UNKNOWN);
            assert.equal(error.recoverable, false);
            assert.ok(error.code, "should generate an error code");
            assert.ok(error.timestamp, "should have a timestamp");
            assert.deepEqual(error.context, {});
            assert.deepEqual(error.suggestions, []);
        });

        it("accepts custom options", () => {
            const error = new BuildError("Custom error", {
                code: "CUSTOM_001",
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.VALIDATION,
                recoverable: true,
                context: { file: "/path/to/file.js" },
                suggestions: ["Try this fix"],
            });

            assert.equal(error.code, "CUSTOM_001");
            assert.equal(error.severity, ErrorSeverity.WARNING);
            assert.equal(error.category, ErrorCategory.VALIDATION);
            assert.equal(error.recoverable, true);
            assert.equal(error.context.file, "/path/to/file.js");
            assert.deepEqual(error.suggestions, ["Try this fix"]);
        });

        it("preserves original error as cause", () => {
            const original = new Error("Original error");
            const wrapped = new BuildError("Wrapped error", { cause: original });

            assert.equal(wrapped.cause, original);
            assert.equal(wrapped.cause.message, "Original error");
        });

        it("formats message with file context", () => {
            const error = new BuildError("File operation failed", {
                context: { file: "/src/app.js" },
            });

            const formatted = error.getFormattedMessage();
            assert.ok(formatted.includes("/src/app.js"));
        });

        it("formats message with task context", () => {
            const error = new BuildError("Task failed", {
                context: { task: "build-js" },
            });

            const formatted = error.getFormattedMessage();
            assert.ok(formatted.includes("build-js"));
        });

        it("returns error details object", () => {
            const error = new BuildError("Test error", {
                category: ErrorCategory.SYNTAX,
            });

            const details = error.getErrorDetails();

            assert.equal(details.message, "Test error");
            assert.equal(details.category, ErrorCategory.SYNTAX);
            assert.ok(details.code);
            assert.ok(details.timestamp);
            assert.ok(details.stack);
        });
    });

    describe("Specialized error classes", () => {

        it("FileSystemError has correct category", () => {
            const error = new FileSystemError("File not found");
            assert.equal(error.category, ErrorCategory.FILESYSTEM);
        });

        it("ValidationError has correct category and severity", () => {
            const error = new ValidationError("Invalid input");
            assert.equal(error.category, ErrorCategory.VALIDATION);
            assert.equal(error.severity, ErrorSeverity.ERROR);
        });

        it("DependencyError is critical by default", () => {
            const error = new DependencyError("Module not found");
            assert.equal(error.category, ErrorCategory.DEPENDENCY);
            assert.equal(error.severity, ErrorSeverity.CRITICAL);
        });

        it("SyntaxError has correct category", () => {
            const error = new SyntaxError("Unexpected token");
            assert.equal(error.category, ErrorCategory.SYNTAX);
        });

        it("ConfigurationError is critical by default", () => {
            const error = new ConfigurationError("Invalid config");
            assert.equal(error.category, ErrorCategory.CONFIGURATION);
            assert.equal(error.severity, ErrorSeverity.CRITICAL);
        });

        it("NetworkError is recoverable by default", () => {
            const error = new NetworkError("Connection failed");
            assert.equal(error.category, ErrorCategory.NETWORK);
            assert.equal(error.recoverable, true);
        });

        it("ProcessError has correct category", () => {
            const error = new ProcessError("Process exited with code 1");
            assert.equal(error.category, ErrorCategory.PROCESS);
        });

        it("TimeoutError is recoverable by default", () => {
            const error = new TimeoutError("Operation timed out");
            assert.equal(error.category, ErrorCategory.TIMEOUT);
            assert.equal(error.recoverable, true);
        });

        it("ResourceError is critical by default", () => {
            const error = new ResourceError("Out of memory");
            assert.equal(error.category, ErrorCategory.RESOURCE);
            assert.equal(error.severity, ErrorSeverity.CRITICAL);
        });
    });

    describe("createContextualError", () => {

        it("classifies ENOENT errors as FileSystemError", () => {
            const original = new Error("ENOENT: no such file or directory");
            const contextual = createContextualError(original, { task: "build" });

            assert.ok(contextual instanceof FileSystemError);
            assert.ok(contextual.suggestions.length > 0);
            assert.equal(contextual.cause, original);
        });

        it("classifies permission errors as FileSystemError", () => {
            const original = new Error("EACCES: permission denied");
            const contextual = createContextualError(original, {});

            assert.ok(contextual instanceof FileSystemError);
        });

        it("classifies syntax errors correctly", () => {
            const original = new Error("Unexpected token }");
            const contextual = createContextualError(original, {});

            assert.ok(contextual instanceof SyntaxError);
        });

        it("classifies network errors correctly", () => {
            const original = new Error("network request failed");
            const contextual = createContextualError(original, {});

            assert.ok(contextual instanceof NetworkError);
        });

        it("classifies command not found as DependencyError", () => {
            const original = new Error("command not found: eslint");
            const contextual = createContextualError(original, {});

            assert.ok(contextual instanceof DependencyError);
        });

        it("preserves context from options", () => {
            const original = new Error("Something failed");
            const contextual = createContextualError(original, {
                task: "lint-js",
                file: "/src/app.js",
            });

            assert.equal(contextual.context.task, "lint-js");
            assert.equal(contextual.context.file, "/src/app.js");
        });

        it("falls back to BuildError for unknown errors", () => {
            const original = new Error("Unknown issue occurred");
            const contextual = createContextualError(original, {});

            assert.ok(contextual instanceof BuildError);
            assert.equal(contextual.category, ErrorCategory.UNKNOWN);
        });
    });

    describe("isRecoverableError", () => {

        it("returns true for NetworkError", () => {
            const error = new NetworkError("Connection failed");
            assert.equal(isRecoverableError(error), true);
        });

        it("returns true for TimeoutError", () => {
            const error = new TimeoutError("Request timed out");
            assert.equal(isRecoverableError(error), true);
        });

        it("returns false for DependencyError", () => {
            const error = new DependencyError("Module not installed");
            assert.equal(isRecoverableError(error), false);
        });

        it("returns false for ConfigurationError", () => {
            const error = new ConfigurationError("Invalid config");
            assert.equal(isRecoverableError(error), false);
        });

        it("returns true for errors marked as recoverable", () => {
            const error = new BuildError("Recoverable issue", {
                recoverable: true,
            });
            assert.equal(isRecoverableError(error), true);
        });

        it("checks message content for generic errors", () => {
            const syntaxError = new Error("syntax error in file");
            assert.equal(isRecoverableError(syntaxError), true);

            const lintError = new Error("lint check failed");
            assert.equal(isRecoverableError(lintError), true);
        });
    });

    describe("formatErrorForUser", () => {

        it("formats BuildError with suggestions", () => {
            const error = new BuildError("Build failed", {
                context: { file: "/src/app.js" },
                suggestions: ["Check the syntax", "Run with --verbose"],
            });

            const formatted = formatErrorForUser(error);

            assert.ok(formatted.includes("Build failed"));
            assert.ok(formatted.includes("/src/app.js"));
            assert.ok(formatted.includes("Check the syntax"));
            assert.ok(formatted.includes("Run with --verbose"));
        });

        it("wraps generic errors", () => {
            const error = new Error("Generic error");
            const formatted = formatErrorForUser(error);

            assert.ok(formatted.includes("Generic error"));
        });
    });

    describe("extractErrorInfo", () => {

        it("extracts details from BuildError", () => {
            const error = new BuildError("Test error", {
                code: "TEST_001",
                category: ErrorCategory.SYNTAX,
                severity: ErrorSeverity.WARNING,
            });

            const info = error.getErrorDetails();

            assert.equal(info.message, "Test error");
            assert.equal(info.code, "TEST_001");
            assert.equal(info.category, ErrorCategory.SYNTAX);
            assert.equal(info.severity, ErrorSeverity.WARNING);
        });

        it("extracts message from generic Error", () => {
            const error = new Error("Plain error");
            const info = extractErrorInfo(error);

            assert.equal(info.message, "Plain error");
            assert.equal(info.category, ErrorCategory.UNKNOWN);
        });

        it("handles string errors", () => {
            const info = extractErrorInfo("String error message");

            assert.equal(info.message, "String error message");
        });
    });
});
