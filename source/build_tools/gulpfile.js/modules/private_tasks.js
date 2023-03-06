"use strict";
/*
    require constants used by Gulp.
*/
const { dest, src } = require("gulp");
/*
    require npm packages.
*/
// autoprefix CSS for browser compatability
const autoprefix = require("gulp-autoprefixer");
// transpile JS for browser compatability
const babelify = require("babelify");
// allows use of commonjs when targeting the browser
const browserify = require("browserify");
// configurably optimize generated CSS
const clean_css = require("gulp-clean-css");
// combine rules within duplicate media queries in css
const combine_media_queries = require("gulp-join-media-queries");
// replace native CSS imports with the imported file's contents
const css_import = require("gulp-cssimport");
// allow Gulp to delete files
const del = require("delete");
// lint JS
const eslint = require("gulp-eslint");
// allow Gulp to rename files
const rename = require("gulp-rename");
// Stylus library for simple declaration of media queries
const rupture = require("rupture");
// allow the browser to map minified code back to a readable source
const sourcemaps = require("gulp-sourcemaps");
// lint Stylus
const stylint = require("gulp-stylint");
// transpile Stylus into CSS
const stylus = require("gulp-stylus");
// serve files over LAN, and synchronise file changes with the browser
const sync = require("browser-sync").create();
// minify JS & replace variable names, for efficiency
const uglify = require("gulp-uglify");
// convert Gulp's vinyl virtual file format into a buffer
const vinyl_buffer = require("vinyl-buffer");
// loads browserify's output into a vinyl object
const vinyl_source = require("vinyl-source-stream");
// transpiles Nunjucks templates into HTML
const nunjucks = require("gulp-nunjucks-render");
/*
    require paths object, containing all paths used.
*/
const PATHS = require("./paths");
/*
    private task to delete all compiled files.
*/
function clean(cb) {
    del(
        // delete the following files
        [
            PATHS.javascript.transpiled,
            PATHS.javascript.uglified,
            PATHS.stylus.transpiled,
            PATHS.stylus.uglified,
        ],
        // allow deletion of files outside of the working directory
        { force: true },
    ),
    // callback to signal task completion
    cb();
}
/*
    private task to transpile Nunjucks templates into HTML.
*/
function transpile_templates(cb) {
    return src(PATHS.templates.input_file)
        .pipe(nunjucks({ path: PATHS.templates.input_folder }))
        .pipe(dest(PATHS.templates.output))
        // reflect updated code in the browser
        .pipe(sync.stream())
        // callback to signal task completion
        .on("end", function() {
            cb();
        });
}
/*
    private task to lint JS.
*/
function lint_javascript(cb) {
    return src(PATHS.javascript.lint)
        // pass in location of `.eslint` config file
        .pipe(eslint(PATHS.javascript.config))
        .pipe(eslint.format())
        // callback to signal task completion
        .on("end", function() {
            cb();
        });
}
/*
    private task to transpile, bundle, and uglify JS, and create a sourcemap.
*/
function transpile_javascript(cb) {
    // bundle commonjs modules into one file
    const bundler = browserify(PATHS.javascript.input, { debug: true })
        // transpile modern JS to ES5 using Babel
        .transform("babelify", { presets: ["@babel/preset-env"] });
    return bundler.bundle()
        // write transpiled JS to the destination folder
        .pipe(vinyl_source("app.js"))
        .pipe(vinyl_buffer())
        .pipe(dest(PATHS.javascript.output))
        // add a suffix to minified file name
        .pipe(rename({extname: ".min.js"}))
        .pipe(sourcemaps.init({ loadMaps: true }))
        // minify JS & replace variable names
        .pipe(uglify())
        .pipe(sourcemaps.write("./"))
        // write minified JS to the destination folder
        .pipe(dest(PATHS.javascript.output))
        // reflect updated code in the browser
        .pipe(sync.stream())
        // callback to signal task completion
        .on("end", function() {
            cb();
        });
}
/*
    private task to lint Stylus.
*/
function lint_stylus(cb) {
    return src(PATHS.stylus.lint)
        .pipe(stylint({ config: PATHS.stylus.config }))
        .pipe(stylint.reporter())
        // callback to signal task completion
        .on("end", function() {
            cb();
        });
}
/*
    private task to transpile Stylus, make CSS more efficient, and create a sourcemap.
*/
function transpile_stylus(cb) {
    return src(PATHS.stylus.input)
        .pipe(sourcemaps.init())
        // use rupture library for simple declaration of media queries
        .pipe(stylus({
            compress: true,
            use: [rupture()]
        }))
        // replace native CSS imports with the imported file's contents
        .pipe(css_import())
        // autoprefix CSS for browser compatability
        .pipe(autoprefix())
        // combine rules within duplicate media queries into single media queries
        .pipe(combine_media_queries())
        // output CSS
        .pipe(dest(PATHS.stylus.output))
        // minify CSS and output a copy
        .pipe(clean_css({ level: 1 }))
        .pipe(rename({ extname: ".min.css" }))
        .pipe(sourcemaps.write("./"))
        .pipe(dest(PATHS.stylus.output))
        // reflect updated code in the browser
        .pipe(sync.stream())
        // callback to signal task completion
        .on("end", function() {
            cb();
        });
}
/*
    export private tasks.
*/
exports.clean                = clean;
exports.transpile_templates  = transpile_templates;
exports.lint_javascript      = lint_javascript;
exports.transpile_javascript = transpile_javascript;
exports.lint_stylus          = lint_stylus;
exports.transpile_stylus     = transpile_stylus;
