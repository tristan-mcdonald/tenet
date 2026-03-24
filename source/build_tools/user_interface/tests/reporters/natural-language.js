/**
 * Natural language test reporter for Node.js test runner.
 *
 * Transforms test events into readable prose output, making it clear
 * what the build tools are doing and whether they're working correctly.
 */

import colors from "picocolors";

/**
 * Format duration in a human-readable way.
 */
function formatDuration (ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Transform test name into natural language.
 * "should register tasks correctly" -> "registers tasks correctly"
 */
function describeTest (name) {
    return name
        .replace(/^should\s+/i, "")
        .replace(/^it\s+/i, "")
        .replace(/^test\s+/i, "");
}

/**
 * Custom reporter that outputs natural language descriptions.
 */
export default async function* naturalLanguageReporter (source) {
    const suiteStack = [];
    const stats = {
        passed: 0,
        failed: 0,
        skipped: 0,
        startTime: Date.now(),
    };

    yield `\n${colors.bold("Running build tools test suite...")}\n`;
    yield `${colors.gray("─".repeat(50))}\n\n`;

    for await (const event of source) {
        switch (event.type) {
            case "test:start": {
                // Track suite nesting
                if (event.data.nesting === 0) {
                    suiteStack.length = 0;
                    yield `${colors.cyan(colors.bold("Testing:"))} ${event.data.name}\n`;
                } else if (event.data.nesting === 1 && !event.data.name.startsWith("should")) {
                    yield `\n  ${colors.white(event.data.name)}\n`;
                }
                break;
            }

            case "test:pass": {
                // Only show leaf tests (actual test cases, not describe blocks)
                if (event.data.details?.type === "suite") {
                    break;
                }

                stats.passed++;
                const duration = event.data.details?.duration_ms;
                const durationStr = duration ? colors.gray(` (${formatDuration(duration)})`) : "";
                yield `    ${colors.green("PASS")} ${describeTest(event.data.name)}${durationStr}\n`;
                break;
            }

            case "test:fail": {
                if (event.data.details?.type === "suite") {
                    break;
                }

                stats.failed++;
                yield `    ${colors.red("FAIL")} ${describeTest(event.data.name)}\n`;

                // Show error details
                const error = event.data.details?.error;
                if (error) {
                    const message = error.message || String(error);
                    yield `         ${colors.red("Error:")} ${message.split("\n")[0]}\n`;

                    // Show expected vs actual if available
                    if (error.expected !== undefined && error.actual !== undefined) {
                        yield `         ${colors.gray("Expected:")} ${JSON.stringify(error.expected)}\n`;
                        yield `         ${colors.gray("Actual:")}   ${JSON.stringify(error.actual)}\n`;
                    }
                }
                break;
            }

            case "test:skip": {
                stats.skipped++;
                yield `    ${colors.yellow("SKIP")} ${describeTest(event.data.name)}\n`;
                break;
            }

            case "test:diagnostic": {
                // Show diagnostic messages (from t.diagnostic())
                yield `    ${colors.gray("INFO")} ${event.data.message}\n`;
                break;
            }

            case "test:stderr":
            case "test:stdout": {
                // Optionally show stdout/stderr
                break;
            }

            case "test:complete": {
                // Test file completed
                break;
            }
        }
    }

    // Final summary
    const totalTime = formatDuration(Date.now() - stats.startTime);
    const total = stats.passed + stats.failed + stats.skipped;

    yield `\n${colors.gray("─".repeat(50))}\n`;
    yield `${colors.bold("Summary:")}\n\n`;

    if (stats.failed === 0) {
        yield `  ${colors.green(colors.bold("All tests passed"))}\n`;
    } else {
        yield `  ${colors.red(colors.bold(`${stats.failed} test(s) failed`))}\n`;
    }

    yield `\n`;
    yield `  ${colors.green(`${stats.passed} passed`)}\n`;
    if (stats.failed > 0) {
        yield `  ${colors.red(`${stats.failed} failed`)}\n`;
    }
    if (stats.skipped > 0) {
        yield `  ${colors.yellow(`${stats.skipped} skipped`)}\n`;
    }
    yield `  ${colors.gray(`${total} total`)}\n`;
    yield `\n`;
    yield `  ${colors.gray(`Completed in ${totalTime}`)}\n\n`;
}
