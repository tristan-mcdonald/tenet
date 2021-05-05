/*
    tasks needed:
        lint javascript
        transpile javascript
        minify javascript
        lint stylus
        make javascript source files
        transpile stylus
        minify stylus
        make stylus source files
        watch
        livereload
*/
const { dest, parallel, series, src, watch } = require("gulp");

const babel   = require("gulp-babel");
const del     = require("delete");
const eslint  = require("gulp-eslint");
const rename  = require("gulp-rename");
const rupture = require("rupture");
const stylint = require("gulp-stylint");
const stylus  = require("gulp-stylus");
const uglify  = require("gulp-uglify");

const PATHS = {
    javascript: {
        config: "./.eslintrc",
        input: "../build_assets/js/app.js",
        lint: "../build_assets/js/**/*.js",
        output: "../../distribution/assets/js/",
        transpiled: "../../distribution/assets/js/app.js",
        uglified: "../../distribution/assets/js/app.min.js",
        watch: "../build_assets/js/**/*.js",
    },
    stylus: {
        input: "../build_assets/stylus/app.styl",
        output: "../../distribution/assets/stylus/",
        transpiled: "../../distribution/assets/css/app.css",
        uglified: "../../distribution/assets/css/app.min.css",
        watch: "../build_assets/stylus/**/*.styl",
    },
};

function clean(cb) {
    del(
        [
            PATHS.javascript.transpiled,
            PATHS.javascript.uglified,
            PATHS.stylus.transpiled,
            PATHS.stylus.uglified,
        ],
        // allow deleting files outside of the working directory
        { force: true },
    ),
    cb();
}
function lintJavascript(cb) {
    return src(PATHS.javascript.lint)
        .pipe(eslint(PATHS.javascript.config))
        .pipe(eslint.format())
    cb();
}
function transpileJavascript(cb) {
    return src(PATHS.javascript.input)
        .pipe(babel())
        .pipe(dest(PATHS.javascript.output))
    cb();
}
function minifyJavascript(cb) {
    return src(PATHS.javascript.transpiled)
        .pipe(uglify())
        .pipe(rename({ extname: '.min.js' }))
        .pipe(dest(PATHS.javascript.output));
    cb();
}
function allJavascript(cb) {
    series(
        lintJavascript,
        transpileJavascript,
        minifyJavascript
    )
    cb();
}
function lintStylus(cb) {
    return src(PATHS.stylus.lint)
        .pipe(stylint({config: ".stylintrc"}))
        .pipe(stylint.reporter());
    cb();
}
function transpileStylus(cb) {
    return src(PATHS.stylus.input)
        .pipe(stylus({
            use: [
                rupture(),
            ],
        }))
        .pipe(dest(PATHS.stylus.output));
    cb();
}
function minifyStylus(cb) {
    // place code for your task here
    cb();
}
function allStylus(cb) {
    series(
        lintStylus,
        transpileStylus,
        minifyStylus
    )
    cb();
}
function liveReload(cb) {
    // place code for your task here
    cb()
}
exports.default = lintJavascript;


// series(
//     clean,
//     watch(
//         PATHS.javascript.watch,
//         { ignoreInitial: false },
//         allJavascript
//     ),
//     watch(
//         PATHS.stylus.watch,
//         { ignoreInitial: false },
//         allStylus
//     )
// );
