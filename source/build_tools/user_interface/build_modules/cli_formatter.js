import colors from "picocolors";

// CLI output modes.
const isVerboseMode = process.argv.includes("--verbose") || process.env.VERBOSE === "true";
const isQuietMode = process.argv.includes("--quiet") || process.env.QUIET === "true";

// Import error handling for formatting.
import {
    BuildError,
    ErrorCategory,
    ErrorSeverity,
} from "./errors.js";

/**
 * Progress indicator for long-running tasks.
 */
export class ProgressIndicator {
    constructor (label = "Processing", total = null) {
        this.label = label;
        this.total = total;
        this.current = 0;
        this.spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        this.spinnerIndex = 0;
        this.interval = null;
        this.startTime = Date.now();
        this.isActive = false;

        // Don't show progress in quiet mode or when output is not a TTY.
        this.shouldShow = !isQuietMode && process.stdout.isTTY;
    }

    start () {
        if (!this.shouldShow || this.isActive) return this;

        this.isActive = true;
        this.interval = setInterval(() => {
            this.render();
        }, 100);

        return this;
    }

    update (current = null, newLabel = null) {
        if (current !== null) this.current = current;
        if (newLabel !== null) this.label = newLabel;

        if (this.shouldShow && this.isActive) {
            this.render();
        }

        return this;
    }

    render () {
        if (!this.shouldShow) return;

        const spinner = this.spinnerFrames[this.spinnerIndex];
        this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;

        let output = `${colors.cyan(spinner)} ${this.label}`;

        if (this.total) {
            const percentage = Math.min(Math.floor((this.current / this.total) * 100), 100);
            const progress = this.renderProgressBar(percentage);
            output += ` ${progress} ${percentage}%`;
        }

        // Clear line and write new content.
        process.stdout.write(`\r\x1b[K${output}`);
    }

    renderProgressBar (percentage, width = 20) {
        const filled = Math.floor(width * (percentage / 100));
        const empty = width - filled;
        return colors.gray("[") + colors.green("█".repeat(filled)) + colors.gray("─".repeat(empty)) + colors.gray("]");
    }

    complete (message = null, success = true) {
        if (!this.shouldShow) return this;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        this.isActive = false;

        // Clear the line.
        process.stdout.write("\r\x1b[K");

        if (message) {
            const duration = Date.now() - this.startTime;
            const icon = success ? colors.green("✓") : colors.red("✗");
            const timeStr = this.formatDuration(duration);

            if (isVerboseMode) {
                console.log(`${icon} ${message} ${colors.gray(`(${timeStr})`)}`); // eslint-disable-line no-console
            } else {
                console.log(`${icon} ${message}`); // eslint-disable-line no-console
            }
        }

        return this;
    }

    fail (message = null) {
        return this.complete(message, false);
    }

    formatDuration (ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(1);
        return `${minutes}m ${seconds}s`;
    }
}

/**
 * Format different types of CLI messages consistently.
 */
export const formatMessage = {
    /**
     * Format success messages.
     */
    success (message, details = null) {
        const icon = colors.green("✓");
        let output = `${icon} ${message}`;

        if (details && isVerboseMode) {
            output += colors.gray(` (${details})`);
        }

        return output;
    },

    /**
     * Format error messages with `BuildError` support.
     */
    error (message, suggestion = null, buildError = null) {
        // Determine icon and colors based on error category if available.
        let icon = colors.red("✗");
        let messageColor = colors.red;

        if (buildError instanceof BuildError) {
            // Category-specific icons and colors
            switch (buildError.category) {
                case ErrorCategory.FILESYSTEM:
                    icon = colors.red("📁");
                    break;
                case ErrorCategory.SYNTAX:
                    icon = colors.red("🔤");
                    break;
                case ErrorCategory.DEPENDENCY:
                    icon = colors.red("📦");
                    break;
                case ErrorCategory.NETWORK:
                    icon = colors.red("🌐");
                    break;
                case ErrorCategory.CONFIGURATION:
                    icon = colors.red("⚙️");
                    break;
                case ErrorCategory.PROCESS:
                    icon = colors.red("⚡");
                    break;
                case ErrorCategory.TIMEOUT:
                    icon = colors.red("⏱️");
                    break;
                default:
                    icon = colors.red("✗");
            }

            // Severity-based coloring.
            switch (buildError.severity) {
                case ErrorSeverity.CRITICAL:
                    messageColor = colors.red;
                    break;
                case ErrorSeverity.ERROR:
                    messageColor = colors.red;
                    break;
                case ErrorSeverity.WARNING:
                    messageColor = colors.yellow;
                    icon = colors.yellow(icon.replace("✗", "⚠"));
                    break;
                case ErrorSeverity.INFO:
                    messageColor = colors.blue;
                    icon = colors.blue("ℹ");
                    break;
            }
        }

        let output = `${icon} ${messageColor(message)}`;

        // Show error code in verbose mode.
        if (isVerboseMode && buildError instanceof BuildError) {
            output += colors.gray(` [${buildError.code}]`);
        }

        if (suggestion) {
            output += `\n${colors.yellow("💡")} ${colors.yellow(suggestion)}`;
        }

        return output;
    },

    /**
     * Format warning messages.
     */
    warning (message, details = null) {
        const icon = colors.yellow("⚠");
        let output = `${icon} ${colors.yellow(message)}`;

        if (details && isVerboseMode) {
            output += colors.gray(` (${details})`);
        }

        return output;
    },

    /**
     * Format info messages.
     */
    info (message, context = null) {
        if (isQuietMode) return "";

        let output = colors.blue("ℹ") + ` ${message}`;

        if (context && isVerboseMode) {
            output += colors.gray(` [${context}]`);
        }

        return output;
    },

    /**
     * Format debug messages (only shown in verbose mode).
     */
    debug (message, context = null) {
        if (!isVerboseMode) return "";

        const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
        const contextStr = context ? `[${context}] ` : "";

        return colors.gray(`${timestamp} DEBUG   ${contextStr}${message}`);
    },

    /**
     * Format section headers.
     */
    section (title) {
        if (isQuietMode) return "";

        return `\n${colors.bold(colors.blue(title))}`;
    },

    /**
     * Format build phase indicators.
     */
    phase (phase, description = null) {
        if (isQuietMode) return "";

        let output = `\n${colors.bold(colors.cyan("▶"))} ${colors.bold(phase)}`;

        if (description) {
            output += colors.gray(` - ${description}`);
        }

        return output;
    },

    /**
     * Format file paths for better readability.
     */
    path (filePath, basePath = null) {
        if (!filePath) return "";

        let displayPath = filePath;

        if (basePath && filePath.startsWith(basePath)) {
            displayPath = "./" + filePath.slice(basePath.length + 1);
        }

        return colors.cyan(displayPath);
    },

    /**
     * Format command suggestions.
     */
    command (cmd, description = null) {
        let output = colors.green(`$ ${cmd}`);

        if (description) {
            output += colors.gray(` # ${description}`);
        }

        return output;
    },
};

/**
 * Console logging with consistent formatting and `BuildError` support.
 */
export function logFormatted (type, message, context = null, details = null) {
    let formatted = "";

    switch (type) {
        case "success":
            formatted = formatMessage.success(message, details);
            break;
        case "error":
            // Check if context is a `BuildError` instance for formatting.
            if (context instanceof BuildError) {
                formatted = formatMessage.error(message, null, context);
            } else {
                formatted = formatMessage.error(message, context); // Context as suggestion.
            }
            break;
        case "warning":
            formatted = formatMessage.warning(message, details);
            break;
        case "info":
            formatted = formatMessage.info(message, context);
            break;
        case "debug":
            formatted = formatMessage.debug(message, context);
            break;
        case "section":
            formatted = formatMessage.section(message);
            break;
        case "phase":
            formatted = formatMessage.phase(message, context);
            break;
        default:
            formatted = message;
    }

    if (formatted) {
        console.log(formatted); // eslint-disable-line no-console
    }
}

/**
 * Error logging function specifically for `BuildError` instances.
 */
export function logBuildError (buildError, suggestion = null) {
    const message = buildError.getFormattedMessage();
    const formatted = formatMessage.error(message, suggestion, buildError);

    console.log(formatted); // eslint-disable-line no-console

    // Show additional context in verbose mode.
    if (isVerboseMode && buildError.context && Object.keys(buildError.context).length > 0) {
        console.log(colors.gray("Error context:")); // eslint-disable-line no-console
        Object.entries(buildError.context).forEach(([key, value]) => {
            console.log(colors.gray(`  ${key}: ${value}`)); // eslint-disable-line no-console
        });
    }

    // Show suggestions if available.
    if (buildError.suggestions && buildError.suggestions.length > 0) {
        buildError.suggestions.forEach(suggestionText => {
            console.log(`${colors.yellow("💡")} ${colors.yellow(suggestionText)}`); // eslint-disable-line no-console
        });
    }
}

/**
 * Create and manage build progress across multiple tasks.
 */
export class BuildProgress {
    constructor (tasks = []) {
        this.tasks = tasks;
        this.currentTask = 0;
        this.currentProgress = null;
        this.startTime = Date.now();
        this.shouldShow = !isQuietMode && process.stdout.isTTY;
    }

    startTask (taskName, description = null) {
        if (!this.shouldShow) return this;

        this.currentTask++;

        // Show phase header for major tasks.
        if (!isVerboseMode && this.tasks.length > 1) {
            const progress = `(${this.currentTask}/${this.tasks.length})`;
            logFormatted("phase", `${taskName} ${colors.gray(progress)}`, description);
        }

        this.currentProgress = new ProgressIndicator(description || taskName);
        this.currentProgress.start();

        return this;
    }

    updateProgress (current, total, message = null) {
        if (this.currentProgress) {
            this.currentProgress.total = total;
            this.currentProgress.update(current, message);
        }

        return this;
    }

    completeTask (message, success = true) {
        if (this.currentProgress) {
            this.currentProgress.complete(message, success);
            this.currentProgress = null;
        }

        return this;
    }

    complete (summary = null) {
        if (this.currentProgress) {
            this.currentProgress.complete();
        }

        const totalTime = Date.now() - this.startTime;
        const timeStr = new ProgressIndicator().formatDuration(totalTime);

        if (summary && !isQuietMode) {
            console.log(`\n${formatMessage.success("Build complete", timeStr)}`); // eslint-disable-line no-console
            if (summary.files) {
                console.log(`${colors.gray("Files processed:")} ${summary.files.processed}, ${colors.gray("cached:")} ${summary.files.cached}`); // eslint-disable-line no-console
            }
        }

        return this;
    }
}

export { isVerboseMode, isQuietMode };
