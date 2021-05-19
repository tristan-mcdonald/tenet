"use strict";
/*
    require constants used by gulp.
*/
const { series } = require("gulp");
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
exports.develop = series(
    PRIVATE_TASKS.clean,
    PUBLIC_TASKS.develop
);
exports.default = series(
    PRIVATE_TASKS.clean,
    PUBLIC_TASKS.develop
);
