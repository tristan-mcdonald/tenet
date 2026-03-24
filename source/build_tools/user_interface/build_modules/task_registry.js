/**
 * @fileoverview Task registry and runner for the build system.
 *
 * Provides a simple task management system that supports:
 * - Task registration with dependencies
 * - Sequential and parallel task execution
 * - Error handling with development mode recovery
 * - Build statistics tracking
 *
 * @module task_registry
 * @see {@link ./config.js} for configuration
 * @see {@link ./errors.js} for error types
 */

import { BuildError, createContextualError, isRecoverableError } from "./errors.js";
import { createTaskError, formatError, handleBuildError, handleDevelopmentError, isQuietMode, isVerboseMode, log, logSuccess, recordTaskCompletion, recordTaskStart } from "./utilities.js";
import { ENV } from "./config.js";

/**
 * @typedef {Object} TaskOptions
 * @property {string} [description=""] - Human-readable task description.
 * @property {string[]} [dependencies=[]] - Task names to run before this task.
 * @property {boolean} [parallel=false] - Whether to run dependencies in parallel.
 * @property {boolean} [enabled=true] - Whether the task is enabled.
 * @property {boolean} [critical=true] - Whether errors should stop the build.
 */

/**
 * Default task options.
 * @type {TaskOptions}
 */
const DEFAULT_TASK_OPTIONS = {
    description: "",
    dependencies: [],
    parallel: false,
    enabled: true,
    critical: true,
};

/**
 * Task registry for managing and executing build tasks.
 *
 * Provides task registration, dependency management, and execution with
 * support for both sequential and parallel workflows.
 *
 * @class
 * @example
 * const runner = createTaskRunner();
 *
 * runner.registerTask("clean", cleanFn, { description: "Clean build files" });
 * runner.registerTask("build", buildFn, { dependencies: ["clean"] });
 *
 * await runner.runTask("build");
 */
class TaskRegistry {
    /**
     * Create a new TaskRegistry instance.
     */
    constructor () {
        /**
         * Map of registered tasks.
         * @type {Map<string, {name: string, fn: Function, options: TaskOptions}>}
         * @private
         */
        this._tasks = new Map();

        /**
         * Whether running in development mode.
         * @type {boolean}
         * @private
         */
        this._isDevelopment = ENV.isDevelopment;
    }

    /**
     * Register a task with the registry.
     * @param {string} name - Task name
     * @param {Function} fn - Task function
     * @param {Object} options - Task options
     */
    registerTask (name, fn, options = {}) {
        this._tasks.set(name, {
            name,
            fn,
            options: { ...DEFAULT_TASK_OPTIONS, ...options },
        });
        return this;
    }

    /**
     * Check if a task exists.
     * @param {string} name - Task name
     * @returns {boolean} - Whether the task exists
     */
    hasTask (name) {
        return this._tasks.has(name);
    }

    /**
     * Get a list of all registered task names.
     * @returns {string[]} - Array of task names
     */
    getTaskNames () {
        return [...this._tasks.keys()];
    }

    /**
     * Run a task by name.
     * @param {string} name - Task name
     * @param {Object} context - Task context
     * @returns {Promise<any>} - Task result
     */
    async runTask (name, context = {}) {
        if (!this._tasks.has(name)) {
            const availableTasks = [...this._tasks.keys()].join(", ");
            throw createTaskError(
                BuildError,
                `Task "${name}" not found. Available tasks: ${availableTasks}`,
                "task-registry",
                null,
            );
        }

        const task = this._tasks.get(name);

        // Skip disabled tasks
        if (!task.options.enabled) {
            log(`Skipping disabled task: ${name}`, "INFO", "TaskRunner");
            return null;
        }

        // Run task dependencies first.
        if (task.options.dependencies.length > 0) {
            try {
                await this._runDependencies(task, context);
            } catch (error) {
                // Add dependency context to the error
                const dependencyError = createContextualError(error, {
                    task: name,
                    operation: "dependency",
                    dependencies: task.options.dependencies,
                });
                throw dependencyError;
            }
        }

        // Start task timing.
        recordTaskStart(name);

        // Only show task execution details in verbose mode.
        if (isVerboseMode) {
            const description = task.options.description
                ? ` - ${task.options.description}`
                : "";
            log(`Running task: ${name}${description}`, "INFO", "TaskRunner");
        }

        // Enhance context with task information.
        const taskExecutionContext = {
            ...context,
            taskName: name,
            taskDescription: task.options.description,
            taskCritical: task.options.critical,
        };

        try {
            // Execute the task.
            const result = await task.fn(taskExecutionContext);
            if (result instanceof Error) {
                return this._handleTaskError(task, result, taskExecutionContext, true);
            }

            // Record successful completion.
            recordTaskCompletion(name, true);

            // Show success message for major tasks in non-verbose mode.
            if (!isVerboseMode && !isQuietMode && this._isMajorTask(name)) {
                logSuccess(`${name} completed`);
            }

            return result;
        } catch (error) {
            // Add task context to any error that occurs.
            const taskError = error instanceof BuildError
                ? error
                : createContextualError(error, {
                    task: name,
                    operation: task.options.description || "task execution",
                    critical: task.options.critical,
                });

            return this._handleTaskError(task, taskError, taskExecutionContext);
        }
    }

    /**
     * Check if a task should be considered a "major" task for user-facing output.
     * @private
     * @param {string} taskName - Task name
     * @returns {boolean} - Whether the task is a major task
     */
    _isMajorTask (taskName) {
        const majorTasks = [
            "build",
            "build-css",
            "build-js",
            "clean",
            "develop",
            "lint",
            "minify-images",
        ];
        return majorTasks.includes(taskName);
    }

    /**
     * Handle task errors with error classification and user messaging.
     * @private
     * @param {Object} task - Task object.
     * @param {Error} error - Error object.
     * @param {Object} context - Task context.
     * @param {boolean} handled - Whether the error has already been handled.
     * @returns {Promise<Error>} - The error object.
     */
    async _handleTaskError (task, error, context, handled = false) {
        // Ensure we have a BuildError instance for consistent handling.
        const buildError = error instanceof BuildError
            ? error
            : createContextualError(error, {
                task: task.name,
                operation: task.options.description || "task execution",
                critical: task.options.critical,
            });

        // In verbose mode, show detailed error info.
        if (isVerboseMode || !handled) {
            log(`Task "${task.name}" failed: ${formatError(buildError)}`, "ERROR", "TaskRunner");

            // Show additional context in verbose mode.
            if (isVerboseMode && buildError instanceof BuildError) {
                log(`Error Category: ${buildError.category}`, "DEBUG", "TaskRunner");
                log(`Error Severity: ${buildError.severity}`, "DEBUG", "TaskRunner");
                if (buildError.context && Object.keys(buildError.context).length > 0) {
                    log(`Error Context: ${JSON.stringify(buildError.context, null, 2)}`, "DEBUG", "TaskRunner");
                }
            }
        }

        // Error recording with classification details.
        const errorInfo = {
            error: formatError(buildError),
            taskName: task.name,
            taskCritical: task.options.critical,
        };

        if (buildError instanceof BuildError) {
            errorInfo.errorCode = buildError.code;
            errorInfo.errorCategory = buildError.category;
            errorInfo.errorSeverity = buildError.severity;
            errorInfo.recoverable = buildError.recoverable;
        }

        recordTaskCompletion(task.name, false, errorInfo);

        // Determine error handling strategy based on environment, criticality, and error type.
        const shouldRecoverInDev = this._isDevelopment &&
                                   (!task.options.critical || isRecoverableError(buildError));

        if (shouldRecoverInDev) {
            handleDevelopmentError(task.name, buildError);
        } else {
            handleBuildError(task.name, buildError, handled);
        }

        return buildError;
    }

    /**
     * Run task dependencies.
     * @private
     * @param {Object} task - Task object.
     * @param {Object} context - Task context.
     */
    async _runDependencies (task, context) {
        if (task.options.parallel) {
            // Run dependencies in parallel.
            await Promise.all(
                task.options.dependencies.map(dep => this.runTask(dep, context)),
            );
        } else {
            // Run dependencies in sequence.
            for (const dep of task.options.dependencies) {
                await this.runTask(dep, context);
            }
        }
    }

    /**
     * Run a sequence of tasks.
     * @param {string[]} taskNames - Array of task names.
     * @param {Object} context - Task context.
     * @returns {Promise<any[]>} - Array of task results.
     */
    async runSequence (taskNames, context = {}) {
        const results = [];
        const isWatcherContext = context.watcher === true;

        for (const name of taskNames) {
            try {
                const result = await this.runTask(name, context);

                /**
                 * Check if `runTask` returned an error object instead of throwing.
                 * This happens when development errors are handled gracefully by
                 * `_handleTaskError`.
                 */
                if (result instanceof Error || result instanceof BuildError) {
                    // For linting tasks in development mode, we want to stop the sequence.
                    if (this._isDevelopment && name.includes("lint")) {
                        log(`Stopping sequence due to ${name} failure`, "WARNING", "TaskRunner");

                        /**
                         * In watcher context, just stop the sequence and return; don't re-throw,
                         * because error was already handled as development error.
                         */
                        if (isWatcherContext) {
                            results.push(result);
                            log("Skipping remaining tasks in sequence - fix the error and save to retry", "INFO", "TaskRunner");
                            return results;
                        } else {
                            // In standalone context (build/lint commands), re-throw to exit.
                            throw result;
                        }
                    }

                    // For other errors, add to results but continue.
                    results.push(result);
                } else {
                    results.push(result);
                }
            } catch (error) {
                /**
                 * This catches errors that were actually thrown (not handled as development
                 * errors). These are typically critical errors that should always stop execution.
                 */
                results.push(error);

                // Re-throw to stop execution regardless of context.
                throw error;
            }
        }
        return results;
    }

    /**
     * Run tasks in parallel.
     * @param {string[]} taskNames - Array of task names.
     * @param {Object} context - Task context.
     * @returns {Promise<any[]>} - Array of task results.
     */
    async runParallel (taskNames, context = {}) {
        return Promise.all(
            taskNames.map(name => this.runTask(name, context)),
        );
    }
}

/**
 * Create a task registry instance.
 * @returns {TaskRegistry} - Task registry instance.
 */
export function createTaskRunner () {
    return new TaskRegistry();
}
