"use strict";
/*
    require constants used by gulp.
*/
const { series, watch } = require("gulp");
/*
    require paths object, containing all paths used.
*/
const PATHS = require("./modules/paths");
/*
    require all private tasks.
*/
const PRIVATE_TASKS = require("./modules/private_tasks");
/*
    require all public tasks.
*/
const PUBLIC_TASKS = require("./modules/public_tasks");
/*
    export all public tasks.
*/
exports.build = series(
    PRIVATE_TASKS.clean,
    PUBLIC_TASKS.build
);
exports.develop = series(
    PRIVATE_TASKS.clean,
    PUBLIC_TASKS.develop
);
exports.default = series(
    PRIVATE_TASKS.clean,
    PUBLIC_TASKS.develop
);
