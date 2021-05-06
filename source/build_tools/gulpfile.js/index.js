const { dest, parallel, series, src, watch } = require("gulp");

const babelify    = require("babelify");              // transpile javascript for browser compatability
const browserify  = require("browserify");            // allows use of commonjs when targeting the browser
const browsersync = require("browser-sync").create(); // serve files over LAN, and synchronise file changes with the browser
const del         = require("delete");                // allow gulp to delete files
const eslint      = require("gulp-eslint");           // lint javascript
const rename      = require("gulp-rename");           // allow gulp to rename files
const rupture     = require("rupture");               // stylus library for simple declaration of media queries
const sourcemaps  = require("gulp-sourcemaps");       // allow the browser to map minified code back to a readable source
const stylint     = require("gulp-stylint");          // lint stylus
const stylus      = require("gulp-stylus");           // transpile stylus into css
const uglify      = require("gulp-uglify");           // minify javascript & replace variable names, to reduce file size
const vinylBuffer      = require("vinyl-buffer");     // convert gulp's vinyl virtual file format into a buffer
const vinylSource = require("vinyl-source-stream");   // loads browserify's output into a vinyl object

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
        config: ".stylintrc",
        input: "../build_assets/stylus/app.styl",
        lint: "../build_assets/stylus/**/*.styl",
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
        // allow deletion of files outside of the working directory
        { force: true },
    ),
    cb();
}
/*
    task to lint javascript during development.
*/
function lintJavascript() {
    return src(PATHS.javascript.lint)
        // pass in location of `.eslint` config file
        .pipe(eslint(PATHS.javascript.config))
        .pipe(eslint.format())
}
/*
    task to transpile, bundle, and uglify javascript, and create a sourcemap.
*/
function transpileJavascript() {
    // bundle commonjs modules into one file
    const bundler = browserify(PATHS.javascript.input, { debug: true })
        // transpile modern javascript to es5 using babel
        .transform("babelify", { presets: ["@babel/preset-env"] });
    return bundler.bundle()
        // write transpiled javascript to the destination folder
        .pipe(vinylSource("app.js"))
        .pipe(vinylBuffer())
        .pipe(dest(PATHS.javascript.output))
        // add a suffix to minified file name
        .pipe(rename({extname: ".min.js"}))
        .pipe(sourcemaps.init({ loadMaps: true }))
        // minify javascript & replace variable names
        .pipe(uglify())
        .pipe(sourcemaps.write("./"))
        // write minified javascript to the destination folder
        .pipe(dest(PATHS.javascript.output));
}
/*
    task to run all javascript tasks in sequence.
*/
function allJavascript(cb) {
    series(
        lintJavascript,
        transpileJavascript
    )
    cb();
}
/*
    task to lint stylus during development.
*/
function lintStylus() {
    return src(PATHS.stylus.lint)
        .pipe(stylint({ config: PATHS.stylus.config }))
        .pipe(stylint.reporter());
}
/*
    task to transpile stylus and make css more efficient.
*/
function transpileStylus(cb) {
    return src(PATHS.stylus.input)
        .pipe(stylus({
            use: [
                rupture(), // stylus library for simple declaration of media queries
            ],
        }))
        .pipe(dest(PATHS.stylus.output));
    cb();
}
/*
    task to run all stylus tasks in sequence.
*/
function allStylus(cb) {
    series(
        lintStylus,
        transpileStylus
    )
    cb();
}
function liveReload(cb) {
    // place code for your task here
    cb()
}
exports.default = lintStylus;


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
