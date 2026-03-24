/**
 * Unit tests for the task registry.
 *
 * Tests task registration, execution, dependencies,
 * and parallel/sequential running.
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createTaskRunner } from "../../build_modules/task_registry.js";

describe("Task Registry", () => {

    describe("createTaskRunner", () => {

        it("creates a new task registry instance", () => {
            const runner = createTaskRunner();

            assert.ok(runner, "should create a runner");
            assert.equal(typeof runner.registerTask, "function");
            assert.equal(typeof runner.hasTask, "function");
            assert.equal(typeof runner.runTask, "function");
        });
    });

    describe("registerTask", () => {

        it("registers a task that can be looked up", () => {
            const runner = createTaskRunner();
            const taskFn = () => "done";

            runner.registerTask("test-task", taskFn, {
                description: "A test task",
            });

            assert.equal(runner.hasTask("test-task"), true);
        });

        it("returns the runner for chaining", () => {
            const runner = createTaskRunner();

            const result = runner
                .registerTask("task1", () => {})
                .registerTask("task2", () => {});

            assert.equal(result, runner);
            assert.equal(runner.hasTask("task1"), true);
            assert.equal(runner.hasTask("task2"), true);
        });
    });

    describe("hasTask", () => {

        it("returns true for registered tasks", () => {
            const runner = createTaskRunner();
            runner.registerTask("my-task", () => {});

            assert.equal(runner.hasTask("my-task"), true);
        });

        it("returns false for unregistered tasks", () => {
            const runner = createTaskRunner();

            assert.equal(runner.hasTask("nonexistent"), false);
        });
    });

    describe("getTaskNames", () => {

        it("returns array of registered task names", () => {
            const runner = createTaskRunner();
            runner.registerTask("alpha", () => {});
            runner.registerTask("beta", () => {});
            runner.registerTask("gamma", () => {});

            const names = runner.getTaskNames();

            assert.ok(Array.isArray(names));
            assert.ok(names.includes("alpha"));
            assert.ok(names.includes("beta"));
            assert.ok(names.includes("gamma"));
            assert.equal(names.length, 3);
        });

        it("returns empty array when no tasks registered", () => {
            const runner = createTaskRunner();
            const names = runner.getTaskNames();

            assert.deepEqual(names, []);
        });
    });

    describe("runTask", () => {

        it("executes a registered task", async () => {
            const runner = createTaskRunner();
            const taskFn = mock.fn(() => "task result");

            runner.registerTask("my-task", taskFn);
            const result = await runner.runTask("my-task");

            assert.equal(taskFn.mock.callCount(), 1);
            assert.equal(result, "task result");
        });

        it("throws descriptive error for non-existent task", async () => {
            const runner = createTaskRunner();
            runner.registerTask("existing", () => {});

            await assert.rejects(
                () => runner.runTask("nonexistent"),
                (error) => {
                    assert.ok(error.message.includes("not found"));
                    assert.ok(error.message.includes("Available tasks"));
                    assert.ok(error.message.includes("existing"));
                    return true;
                },
            );
        });

        it("skips disabled tasks and returns null", async () => {
            const runner = createTaskRunner();
            const taskFn = mock.fn();

            runner.registerTask("disabled-task", taskFn, { enabled: false });
            const result = await runner.runTask("disabled-task");

            assert.equal(taskFn.mock.callCount(), 0);
            assert.equal(result, null);
        });

        it("passes context to task function", async () => {
            const runner = createTaskRunner();
            let receivedContext = null;

            runner.registerTask("context-task", (ctx) => {
                receivedContext = ctx;
            });

            await runner.runTask("context-task", { custom: "value" });

            assert.ok(receivedContext);
            assert.equal(receivedContext.custom, "value");
            assert.equal(receivedContext.taskName, "context-task");
        });

        it("handles async task functions", async () => {
            const runner = createTaskRunner();

            runner.registerTask("async-task", async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return "async result";
            });

            const result = await runner.runTask("async-task");
            assert.equal(result, "async result");
        });
    });

    describe("runSequence", () => {

        it("executes tasks in order", async () => {
            const runner = createTaskRunner();
            const executionOrder = [];

            runner.registerTask("first", async () => {
                executionOrder.push("first");
            });
            runner.registerTask("second", async () => {
                executionOrder.push("second");
            });
            runner.registerTask("third", async () => {
                executionOrder.push("third");
            });

            await runner.runSequence(["first", "second", "third"]);

            assert.deepEqual(executionOrder, ["first", "second", "third"]);
        });

        it("returns array of results", async () => {
            const runner = createTaskRunner();

            runner.registerTask("a", () => "result-a");
            runner.registerTask("b", () => "result-b");

            const results = await runner.runSequence(["a", "b"]);

            assert.deepEqual(results, ["result-a", "result-b"]);
        });

        it("passes context to all tasks", async () => {
            const runner = createTaskRunner();
            const contexts = [];

            runner.registerTask("t1", (ctx) => contexts.push(ctx.shared));
            runner.registerTask("t2", (ctx) => contexts.push(ctx.shared));

            await runner.runSequence(["t1", "t2"], { shared: "data" });

            assert.deepEqual(contexts, ["data", "data"]);
        });
    });

    describe("runParallel", () => {

        it("executes tasks concurrently", async () => {
            const runner = createTaskRunner();
            const startTimes = {};

            runner.registerTask("slow1", async () => {
                startTimes.slow1 = Date.now();
                await new Promise(r => setTimeout(r, 50));
                return "slow1";
            });

            runner.registerTask("slow2", async () => {
                startTimes.slow2 = Date.now();
                await new Promise(r => setTimeout(r, 50));
                return "slow2";
            });

            const start = Date.now();
            await runner.runParallel(["slow1", "slow2"]);
            const totalTime = Date.now() - start;

            // If run in parallel, total time should be ~50ms, not ~100ms
            assert.ok(totalTime < 90, `Expected parallel execution to take <90ms, took ${totalTime}ms`);

            // Both should start at nearly the same time
            const timeDiff = Math.abs(startTimes.slow1 - startTimes.slow2);
            assert.ok(timeDiff < 20, `Tasks should start together, diff was ${timeDiff}ms`);
        });

        it("returns array of results in order", async () => {
            const runner = createTaskRunner();

            runner.registerTask("fast", async () => {
                await new Promise(r => setTimeout(r, 5));
                return "fast-result";
            });

            runner.registerTask("slow", async () => {
                await new Promise(r => setTimeout(r, 20));
                return "slow-result";
            });

            // Even though fast finishes first, results should be in input order
            const results = await runner.runParallel(["slow", "fast"]);

            assert.deepEqual(results, ["slow-result", "fast-result"]);
        });
    });

    describe("Task dependencies", () => {

        it("runs dependencies before the main task", async () => {
            const runner = createTaskRunner();
            const executionOrder = [];

            runner.registerTask("dep1", () => executionOrder.push("dep1"));
            runner.registerTask("dep2", () => executionOrder.push("dep2"));
            runner.registerTask("main", () => executionOrder.push("main"), {
                dependencies: ["dep1", "dep2"],
            });

            await runner.runTask("main");

            assert.equal(executionOrder[0], "dep1");
            assert.equal(executionOrder[1], "dep2");
            assert.equal(executionOrder[2], "main");
        });

        it("runs parallel dependencies concurrently", async () => {
            const runner = createTaskRunner();
            const startTimes = {};

            runner.registerTask("dep1", async () => {
                startTimes.dep1 = Date.now();
                await new Promise(r => setTimeout(r, 30));
            });

            runner.registerTask("dep2", async () => {
                startTimes.dep2 = Date.now();
                await new Promise(r => setTimeout(r, 30));
            });

            runner.registerTask("main", () => {}, {
                dependencies: ["dep1", "dep2"],
                parallel: true,
            });

            await runner.runTask("main");

            // Dependencies should start at nearly the same time
            const timeDiff = Math.abs(startTimes.dep1 - startTimes.dep2);
            assert.ok(timeDiff < 20, `Parallel deps should start together, diff was ${timeDiff}ms`);
        });
    });
});
