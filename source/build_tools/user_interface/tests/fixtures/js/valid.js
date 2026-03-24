/**
 * Test JavaScript file for build system testing.
 * This file imports a module to test bundling.
 */

import { greet, add } from "./modules/helper.js";

const APP_NAME = "Test Application";

function init () {
    const message = greet("World");
    const sum = add(2, 3);
    console.log(`${APP_NAME}: ${message}, sum is ${sum}`);
}

export { init, APP_NAME };

// Self-executing for browser environment
if (typeof window !== "undefined") {
    init();
}
