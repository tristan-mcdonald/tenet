"use strict";

// interpret all `require` statements in source js & load the code into the stream,
// concatenating it all into one file
// allows use of commonjs when targeting the browser
// `babelify` is also a dependency here, but is not explicitly required
const browserify = require("browserify");

// serve files locally, and across the network
// synchronise file changes with the browser
const bs = require("browser-sync").create();

// we must convert the vinyl virtual file format into a buffer,
// that can be interpreted by other libraries in the gulp ecosystem
const buffer = require("vinyl-buffer");

// configurably optimize generated CSS to remove any duplication/unnecessary rules
const cleanCss = require("gulp-clean-css");

// adds colour to our logged messages for greater clarity
const color = require("gulp-color");

// combine duplicate media queries in CSS, improves performance
const combineMq = require("gulp-combine-mq");

// encode images referenced in css into the compiled file to reduce http requests
// leave out svg as it can be problematic
const cssBase64 = require("gulp-css-base64");

// replace css imports with the imported file"s contents
// note this is different to partial imports in stylus
const cssImport = require("gulp-cssimport");

// lint js while developing
const eslint = require("gulp-eslint");

// adds includes to html templates; a basic static-site builder
const fileInclude = require("gulp-file-include");

// run build tasks
const gulp = require("gulp");

// minify html files after templates are rendered
// docs here: https://github.com/kangax/html-minifier
const htmlMin = require("gulp-htmlmin");

// image minification tools
const imagemin = require("gulp-imagemin");

// Gives us nice logging output
const log = require("fancy-log");

// autoprefix outputted css
const prefix = require("gulp-autoprefixer");

// simple virtual file rename utility for gulp streams
const rename = require("gulp-rename");

// stylus library for very simple declaration of media queries
const rupture = require("rupture");

// now included in gulp, run tasks concurrently or in an order
const { series, parallel } = require("gulp");

// gulp uses `vinyl`, a virtual file format to pass data through pipes
// as such, we must ensure browserify output can be interpreted by following pipe operations
// `vinyl-source-stream` loads browserify output into a vinyl object
const source = require("vinyl-source-stream");

// allow the browser to map minified code back to a readable source
const sourcemaps = require("gulp-sourcemaps");

// transpile stylus into css
const stylus = require("gulp-stylus");

// minify js & replace variable names to make file size as small as possible
const uglify = require("gulp-uglify");

// file names & paths
// all paths keys must either correlate to a gulp task, or be under `common`
const PATHS = {
    common: {
        sourcemapsOut: "./" // use external sourcemaps
    },
    files: {
        entry: "templates/pages/*.html",
        dest: "./dist",
        watch: "templates/**/*"
    },
    images: {
        entry: "assets/images/*",
        dest: "dist/assets/images",
        watch: "assets/images/**/*"
    },
    javascript: {
        common: {
            dest: "dist/assets/js"
        },
        app: {
            outputName: "app.js",
            entry: "assets/js/app.js",
            watch: "assets/js/**/*"
        },
        vendor: {
            outputName: "vendor.js",
            entry: "assets/js/vendor/**/*",
            watch: "assets/js/vendor/*"
        },
        final: {
            outputName: "app.min.js",
            app: "dist/assets/js/app.js",
            vendor: "dist/assets/js/vendor.js",
            watch: "assets/js/**/*"
        }
    },
    styles: {
        common: {
            dest: "dist/assets/css"
        },
        stylus: {
            outputName: "app.css",
            entry: "assets/stylus/app.styl",
            watch: "assets/stylus/**/*"
        }
    }
};

// terrible welcome message - really needs to be ASCII text
function welcome(callback) {
    log.info(`
// list of browsers that will open/load the website upon running Gulp
const browsers = [
    // "firefox",
    // "safari",
    "google chrome"
];


  ::::::::::: :::::::::: ::::    ::: :::::::::: :::::::::::
     :+:     :+:        :+:+:   :+: :+:            :+:
    +:+     +:+        :+:+:+  +:+ +:+            +:+
   +#+     +#++:++#   +#+ +:+ +#+ +#++:++#       +#+
  +#+     +#+        +#+  +#+#+# +#+            +#+
 #+#     #+#        #+#   #+#+# #+#            #+#
###     ########## ###    #### ##########     ###
    `);
    callback();
}

// run js through eslint while developing
// we do not fail on eslint error here; there is a precommit hook set up for that
// during development code will continue to compile despite warnings (not blocking dev)
// @param {*} callback - the "done" callback fired when all gulp pipes have completed
function lint(callback) {
    gulp.src(PATHS.javascript.app.watch)
        .pipe(eslint())
        .pipe(eslint.format());
    callback();
}

// render html files from templates
// change baseurl to the github pages url if using that to present designs
// minify html
// @param {*} callback
function html(callback) {
    gulp.src(PATHS.files.entry)
        .on("error", function(er) {
            log.error(
                `

-----------------------------
HTML error encountered:
-----------------------------

` + er.toString()
            );
            this.emit("end");
        })
        .pipe(
            fileInclude({
                prefix: "@@",
                basepath: "@file",
                context: {
                    baseurl: "dist" // this only works if the variable is all lowercase with no underscore
                }
            })
        )
        .pipe(
            htmlMin({
                collapseWhitespace: true,
                caseSensitive: true,
                collapseInlineTagWhitespace: true,
                decodeEntities: true,
                minifyCSS: true,
                minifyJS: true,
                removeComments: true
            })
        )
        .pipe(gulp.dest(PATHS.files.dest));
    callback();
}

// compile stylus into clean css for the browser
// executes the following operations:
// - run the stylus through the stylus compiler
// - combine all relevant media queries for concise & debuggable css
// - utilise cleancss to clean and minify the stylus output
// - Write a minified css file to the destination
// @param {*} callback - the "done" callback fired when all gulp pipes have completed
function styles(callback) {
    gulp.src(PATHS.styles.stylus.entry)
        .on("error", function(er) {
            log.error(
                `

-----------------------------
Stylus error encountered:
-----------------------------

` + er.toString()
            );
            this.emit("end");
        })
        .pipe(sourcemaps.init())
        .pipe(stylus({ use: [rupture()] }))
        .pipe(
            cssBase64({
                baseDir: PATHS.images.dest,
                extensionsAllowed: [".gif", ".jpg", ".png"],
                maxWeightResource: 100
            })
        )
        .pipe(cssImport())
        .pipe(prefix())
        .pipe(combineMq())
        .pipe(gulp.dest(PATHS.styles.common.dest))
        .pipe(cleanCss({ level: 1 }))
        .pipe(rename({ extname: ".min.css" }))
        .pipe(sourcemaps.write(PATHS.common.sourcemapsOut))
        .pipe(gulp.dest(PATHS.styles.common.dest));
    callback();
}

// run all source images through minification.
// for svg, we typically manually edit the outputted code from
// a vector illustration program and use them as an include within a
// template, in which case we do not need to pass them through optimisation
// @param {*} callback
function images(callback) {
    gulp.src(PATHS.images.entry)
        .on("error", function(er) {
            log.error(
                `

-----------------------------
Image processing error encountered:
-----------------------------

` + er.toString()
            );
            this.emit("end");
        })
        .pipe(
            imagemin([
                imagemin.gifsicle({ interlaced: true }),
                imagemin.jpegtran({ progressive: true }),
                imagemin.optipng({ optimizationLevel: 5 }),
                imagemin.svgo({
                    plugins: [
                        { removeViewBox: false },
                        { cleanupIDs: false },
                        { removeComments: true }
                    ]
                })
            ])
        )
        .pipe(gulp.dest(PATHS.images.dest));
    callback();
}

// compile js for use in the browser
// executes the following operations:
// - browserify the js
// - use babel to transpile to es5
// - convert browserify output to a gulp buffer
// - write an unminified version to the destination folder
// - uglify a copy of the unminified version
// - create sourcemaps
// - write a minified version to the destination folder
// @param {*} callback - the "done" callback fired when all gulp pipes have completed
function scripts(callback) {
    // set up the browserify instance on a task basis
    const b = browserify({
        entries: PATHS.javascript.app.entry,
        debug: true
    });
    b.transform("babelify", {
        // transpile down to es5
        presets: [
            [
                "@babel/preset-env",
                {
                    targets: {
                        // % refers to the global coverage of users from browserslist
                        browsers: [">0.25%", "not op_mini all", "ie >= 11"]
                    }
                }
            ]
        ]
    })
        .bundle()
        .on("error", function(er) {
            log.error(
                `

-----------------------------
Javascript error encountered:
-----------------------------

` + er.toString()
            );
            this.emit("end");
        })
        .pipe(source("app.js"))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(uglify())
        .pipe(sourcemaps.write(PATHS.common.sourcemapsOut))
        .pipe(gulp.dest(PATHS.javascript.common.dest));
    callback();

// render html files from templates
// change baseurl to the github pages url if using that to present designs
// minify html
// @param {*} callback
function renderTemplates (callback) {
    pump(
        [
            gulp.src(PATHS.files.entry),
            fileInclude({
                prefix: "@@",
                basepath: "@file",
                context: {
                    baseurl: "dist", // this only works if the variable is all lowercase with no underscore
                },
            }),
            htmlMin({
                caseSensitive: true,
                collapseInlineTagWhitespace: false,
                collapseWhitespace: true,
                decodeEntities: true,
                minifyCSS: true,
                minifyJS: true,
                removeComments: true,
            }),
            gulp.dest(PATHS.files.dest),
        ],
        callback
    );
}

// BrowserSync ia watching
function browserSync() {
    bs.init({
        server: {
            baseDir: "./dist"
        },
        notify: false,
        browser: browsers,
        files: ["dist/assets/css/*.min.css"],
        reloadOnRestart: true
    });
}

// BrowserSync is also reloading
function browserSyncReload(callback) {
    bs.reload();
    callback();
};

// watch function to fire appropriate tasks on file change
function watch() {
    gulp.watch(PATHS.files.watch, gulp.series(html, browserSyncReload));
    gulp.watch(PATHS.images.watch, gulp.series(images, browserSyncReload));
    gulp.watch(PATHS.styles.stylus.watch, styles); // Needs no following task as css is streamed in browserSync function
    gulp.watch(
        PATHS.javascript.app.watch,
        gulp.series(scripts, browserSyncReload)
    );
};

/* == == tasks == == */
const watchFiles = parallel(watch, browserSync);
exports.welcome = welcome;
exports.lint = lint;
exports.html = html;
exports.styles = styles;
exports.images = images;
exports.scripts = scripts;
exports.default = series(
    welcome,
    styles,
    scripts,
    images,
    html,
    watchFiles
);
