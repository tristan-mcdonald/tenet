"use strict";
/*
    require constants used by gulp.
*/
const { series, watch } = require("gulp");
/*
    require npm packages.
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
function develop() {
    // start a development browser
    sync.init({
        notify: false,
        open: false,
        reloadOnRestart: true,
        server: PATHS.server.root,
        tunnel: true,
    });
    // watch nunjucks files for changes
    watch(
        PATHS.templates.watch,
        // run when function is initialised
        { ignoreInitial: false },
        PRIVATE_TASKS.transpileTemplates
    );
    // watch javascript files for changes
    watch(
        PATHS.javascript.watch,
        // run when function is initialised
        { ignoreInitial: false },
        // run all javascript tasks in sequence
        series(
            PRIVATE_TASKS.lintJavascript,
            PRIVATE_TASKS.transpileJavascript
        )
    );
    // watch stylus files for changes
    watch(
        PATHS.stylus.watch,
        // run when function is initialised
        { ignoreInitial: false },
        // run all stylus tasks in sequence
        series(
            PRIVATE_TASKS.lintStylus,
            PRIVATE_TASKS.transpileStylus
        )
    );
}
/*
    export private tasks.
*/
exports.develop = develop;
