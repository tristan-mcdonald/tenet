/**
 * @fileoverview Error handling system for the build tools.
 *
 * Provides a structured error classification system with:
 * - **Error categories**: filesystem, validation, dependency, syntax, etc.
 * - **Error severity**: critical, error, warning, info
 * - **Contextual errors**: File paths, task names, operation details
 * - **Recovery suggestions**: Actionable hints for fixing errors
 *
 * @module errors
 *
 * @example
 * import { FileSystemError, createContextualError } from "./errors.js";
 *
 * // Create a specific error type
 * throw new FileSystemError("File not found", {
 *     context: { file: "/path/to/file.js" },
 *     suggestions: ["Check the file path is correct"]
 * });
 *
 * // Wrap a generic error with context
 * try {
 *     // operation
 * } catch (error) {
 *     throw createContextualError(error, { task: "build-js" });
 * }
 */

/**
 * Error severity levels.
 * @enum {string}
 * @readonly
 */
export const ErrorSeverity = {
    CRITICAL: "critical", // Stops build completely.
    ERROR: "error",       // Task fails but build may continue.
    WARNING: "warning",   // Issue noted but task continues.
    INFO: "info",         // Informational message.
};

/**
 * Error categories for classification
 */
export const ErrorCategory = {
    FILESYSTEM: "filesystem",   // File operations, permissions, missing files.
    VALIDATION: "validation",   // Invalid inputs, configuration errors.
    DEPENDENCY: "dependency",   // Missing tools, version conflicts.
    SYNTAX: "syntax",           // Code syntax errors, linting failures.
    NETWORK: "network",         // Network requests, external resources.
    CONFIGURATION: "config",    // Build configuration issues.
    RESOURCE: "resource",       // Memory, disk space, system resources.
    PROCESS: "process",         // External process failures.
    TIMEOUT: "timeout",         // Operation timeouts.
    UNKNOWN: "unknown",         // Unclassified errors.
};

/**
 * Base class for all build errors.
 */
export class BuildError extends Error {
    constructor (message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = options.code || this._generateErrorCode();
        this.severity = options.severity || ErrorSeverity.ERROR;
        this.category = options.category || ErrorCategory.UNKNOWN;
        this.context = options.context || {};
        this.suggestions = options.suggestions || [];
        this.timestamp = new Date().toISOString();
        this.recoverable = options.recoverable || false;

        // Preserve original error if provided.
        if (options.cause instanceof Error) {
            this.cause = options.cause;
            this.stack = this.stack + "\nCaused by: " + options.cause.stack;
        }

        Error.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Generate a unique error code based on class and timestamp.
     */
    _generateErrorCode () {
        const prefix = this.constructor.name.replace("Error", "").toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        return `${prefix}_${timestamp}`;
    }

    /**
     * Get a formatted error message with context.
     */
    getFormattedMessage () {
        let message = this.message;

        if (this.context.file) {
            message += ` (file: ${this.context.file})`;
        }

        if (this.context.task) {
            message += ` (task: ${this.context.task})`;
        }

        if (this.context.operation) {
            message += ` (operation: ${this.context.operation})`;
        }

        return message;
    }

    /**
     * Get error details for logging or debugging.
     */
    getErrorDetails () {
        return {
            code: this.code,
            message: this.message,
            severity: this.severity,
            category: this.category,
            context: this.context,
            suggestions: this.suggestions,
            timestamp: this.timestamp,
            recoverable: this.recoverable,
            stack: this.stack,
        };
    }
}

/**
 * File system related errors (missing files, permissions, etc.).
 */
export class FileSystemError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.FILESYSTEM,
            ...options,
        });
    }
}

/**
 * Input validation errors.
 */
export class ValidationError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.VALIDATION,
            severity: ErrorSeverity.ERROR,
            ...options,
        });
    }
}

/**
 * External dependency errors (missing tools, version conflicts).
 */
export class DependencyError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.DEPENDENCY,
            severity: ErrorSeverity.CRITICAL,
            ...options,
        });
    }
}

/**
 * Syntax errors from linting or compilation.
 */
export class SyntaxError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.SYNTAX,
            severity: ErrorSeverity.ERROR,
            ...options,
        });
    }
}

/**
 * Configuration errors.
 */
export class ConfigurationError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.CONFIGURATION,
            severity: ErrorSeverity.CRITICAL,
            ...options,
        });
    }
}

/**
 * Network-related errors.
 */
export class NetworkError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.NETWORK,
            severity: ErrorSeverity.ERROR,
            recoverable: true,
            ...options,
        });
    }
}

/**
 * External process execution errors.
 */
export class ProcessError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.PROCESS,
            severity: ErrorSeverity.ERROR,
            ...options,
        });
    }
}

/**
 * Timeout errors.
 */
export class TimeoutError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.TIMEOUT,
            severity: ErrorSeverity.ERROR,
            recoverable: true,
            ...options,
        });
    }
}

/**
 * Resource related errors (disk space, memory, etc.).
 */
export class ResourceError extends BuildError {
    constructor (message, options = {}) {
        super(message, {
            category: ErrorCategory.RESOURCE,
            severity: ErrorSeverity.CRITICAL,
            ...options,
        });
    }
}

/**
 * Helper function to create contextual errors from generic errors.
 */
export function createContextualError (originalError, context = {}) {
    // Determine appropriate error class based on error message and context.
    const errorMessage = originalError.message || String(originalError);
    const lowerMessage = errorMessage.toLowerCase();

    let ErrorClass = BuildError;
    const suggestions = [];

    // File system errors.
    if (lowerMessage.includes("enoent") || lowerMessage.includes("no such file")) {
        ErrorClass = FileSystemError;
        suggestions.push("Check that the file path is correct and the file exists");
    } else if (lowerMessage.includes("eacces") || lowerMessage.includes("permission")) {
        ErrorClass = FileSystemError;
        suggestions.push("Check file permissions or run with appropriate privileges");
    } else if (lowerMessage.includes("eexist")) {
        ErrorClass = FileSystemError;
        suggestions.push("File or directory already exists");
    }

    // Dependency errors.
    else if (lowerMessage.includes("command not found") || lowerMessage.includes("not found in path")) {
        ErrorClass = DependencyError;
        suggestions.push("Install the required tool or check your PATH environment variable");
    }

    // Network errors.
    else if (lowerMessage.includes("network") || lowerMessage.includes("fetch") || lowerMessage.includes("timeout")) {
        ErrorClass = NetworkError;
        suggestions.push("Check your internet connection and try again");
    }

    // Syntax errors.
    else if (lowerMessage.includes("syntax") || lowerMessage.includes("parse") || lowerMessage.includes("unexpected token")) {
        ErrorClass = SyntaxError;
        suggestions.push("Check the syntax in the specified file");
    }

    // Process errors.
    else if (originalError.code || lowerMessage.includes("exit code") || lowerMessage.includes("spawn")) {
        ErrorClass = ProcessError;
        suggestions.push("Check the command output above for specific error details");
    }

    return new ErrorClass(errorMessage, {
        cause: originalError,
        context,
        suggestions,
        code: originalError.code,
    });
}

/**
 * Create an error with context information.
 */
export function createError (ErrorClass, message, context = {}) {
    const suggestions = getSuggestionsForContext(context);
    return new ErrorClass(message, {
        context,
        suggestions,
    });
}

/**
 * Get suggestions based on context.
 */
function getSuggestionsForContext (context) {
    const suggestions = [];

    if (context.task === "lint-js") {
        suggestions.push("Run with --fix to automatically resolve some issues");
    } else if (context.task === "transpile-js") {
        suggestions.push("Check for syntax errors in your JavaScript files");
    } else if (context.task === "transpile-stylus") {
        suggestions.push("Check for syntax errors in your Stylus files");
    } else if (context.operation === "watch") {
        suggestions.push("Development mode will continue watching for changes");
    }

    if (context.file) {
        suggestions.push(`Check the file: ${context.file}`);
    }

    return suggestions;
}

/**
 * Check if an error is recoverable in development mode.
 */
export function isRecoverableError (error) {
    if (error instanceof BuildError) {
        return error.recoverable;
    }

    // Some generic errors can be recoverable.
    const message = error.message?.toLowerCase() || "";
    return message.includes("syntax") ||
           message.includes("lint") ||
           message.includes("style");
}

/**
 * Get user-friendly error message with suggestions.
 */
export function formatErrorForUser (error) {
    if (!(error instanceof BuildError)) {
        error = createContextualError(error);
    }

    const parts = [error.getFormattedMessage()];

    if (error.suggestions.length > 0) {
        parts.push("Suggestions:");
        error.suggestions.forEach(suggestion => {
            parts.push(`  • ${suggestion}`);
        });
    }

    return parts.join("\n");
}

/**
 * Extract meaningful error information from various error types.
 */
export function extractErrorInfo (error) {
    const info = {
        message: "Unknown error occurred",
        code: null,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        context: {},
        suggestions: [],
    };

    if (error instanceof BuildError) {
        return error.getErrorDetails();
    }

    if (error instanceof Error) {
        info.message = error.message;
        info.code = error.code;
    } else if (typeof error === "string") {
        info.message = error;
    }

    return info;
}
