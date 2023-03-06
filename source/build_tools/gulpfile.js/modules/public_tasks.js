"use strict";
/*
    require constants used by Gulp.
*/
const { series, watch } = require("gulp");
/*
    require NPM packages.
*/
const sync = require("browser-sync").create(); // serve files over lan, and synchronise file changes with the browser
/*
    require paths object, containing all paths used.
*/
const PATHS = require("./paths");
/*
    require all private tasks.
*/
const PRIVATE_TASKS = require("./private_tasks");
/*
    public task for local development.
*/
function develop () {
    // start a development browser
    sync.init({
        notify: false,
        open: false,
        reloadOnRestart: true,
        server: PATHS.server.root,
        tunnel: true,
    });
    // watch JS files for changes
    watch(
        PATHS.javascript.watch,
        // run when function is initialised
        { ignoreInitial: false },
        // run all JS tasks in sequence
        series(
            PRIVATE_TASKS.lint_javascript,
            PRIVATE_TASKS.transpile_javascript,
        )
    );
    // watch Stylus files for changes
    watch(
        PATHS.stylus.watch,
        // run when function is initialised
        { ignoreInitial: false },
        // run all Stylus tasks in sequence
        series(
            PRIVATE_TASKS.lint_stylus,
            PRIVATE_TASKS.transpile_stylus,
        )
    );
}
function reference () {
    // watch Nunjucks files for changes
    watch(
        PATHS.templates.watch,
        // run when function is initialised
        { ignoreInitial: false },
        PRIVATE_TASKS.transpile_templates,
    );
}
/*
    export private tasks.
*/
exports.develop   = develop;
exports.reference = reference;
