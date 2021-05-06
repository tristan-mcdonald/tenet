// interpret all `require` statements in source js & load the code into the stream,
// concatenating it all into one file
// allows use of commonjs when targeting the browser
// `babelify` is also a dependency here, but is not explicitly required
const browserify   = require("browserify");
// serve files locally, and across the network
// synchronise file changes with the browser
const browserSync  = require("browser-sync").create();
// we must convert the vinyl virtual file format into a buffer,
// that can be interpreted by other libraries in the gulp ecosystem
const buffer       = require("vinyl-buffer");
// configurably optimize generated CSS to remove any duplication/unnecessary rules
const cleanCss     = require("gulp-clean-css");
// combine duplicate media queries in CSS, improves performance
const combineMq    = require("gulp-combine-mq");
// encode images referenced in css into the compiled file to reduce http requests
// leave out svg as it can be problematic
const cssBase64    = require("gulp-css-base64");
// replace css imports with the imported file"s contents
// note this is different to partial imports in stylus
const cssImport    = require("gulp-cssimport");
// lint js while developing
const eslint       = require("gulp-eslint");
// run build tasks
const gulp         = require("gulp");
// image minification tools
const imagemin     = require("gulp-imagemin");
// autoprefix outputted css
const prefix       = require("gulp-autoprefixer");
// view google pagespeed insights reporting on the project
const psi          = require("psi");
// allow for better management of errors across pipes
const pump         = require("pump");
// simple virtual file rename utility for gulp streams
const rename       = require("gulp-rename");
// run tasks in sequence
const runSequence  = require("run-sequence");
// stylus library for simple declaration of media queries
const rupture      = require("rupture");
// gulp uses `vinyl`, a virtual file format to pass data through pipes
// as such, we must ensure browserify output can be interpreted by following pipe operations
// `vinyl-source-stream` loads browserify output into a vinyl object
const source       = require("vinyl-source-stream");
// allow the browser to map minified code back to a readable source
const sourcemaps   = require("gulp-sourcemaps");
// transpile stylus into css
const stylus       = require("gulp-stylus");
// minify js & replace variable names to make file size as small as possible
const uglify       = require("gulp-uglify");
// add your IP address to run google pagespeed insights tasks
const devMachineIp = "your-ip-address-here";
// file names & paths
// all paths keys must either correlate to a gulp task, or be under `common`
const PATHS = {
    common: {
        sourcemapsOut: "./", // use external sourcemaps
        // used by pagespeed insights tasks, must be public-accessible
        // add your IP address to devMachineIp constant
        // then serve your site on 0.0.0.0:9080 (if using the npm package static-server)
        site: "http://" + devMachineIp + ":9080",
    },
    images: {
        entry: "../build_assets/images/*",
        dest: "../../static/images",
        watch: "../build_assets/images/**/*",
    },
    javascript: {
        common: {
            dest: "../../static/js",
        },
        app: {
            outputName: "app.js",
            entry: "../build_assets/js/app.js",
            watch: "../build_assets/js/**/*",
        },
        final: {
            outputName: "app.min.js",
            app: "../../static/js/app.js",
            watch: "../build_assets/js/**/*",
        },
    },
    styles: {
        common: {
            dest: "../../static/css",
        },
        stylus: {
            outputName: "app.css",
            entry: "../build_assets/stylus/app.styl",
            watch: "../build_assets/stylus/**/*",
        },
        output: {
            watch: "../../static/css/app.min.css",
        }
    },
};
// run js through eslint while developing
// we do not fail on eslint error here; there is a precommit hook set up for that
// during development code will continue to compile despite warnings (not blocking dev)
// @param {*} callback - the "done" callback fired when all gulp pipes have completed
function lintJavascript (callback) {
    pump(
        [
            gulp.src(PATHS.javascript.app.watch),
            eslint({configFile: ".eslintrc"}),
            eslint.format()
        ],
        callback
    );
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
function compileJavascript (callback) {
    const transpileJS = browserify(PATHS.javascript.app.entry, {
        debug: true,
    }).transform("babelify", {
        // transpile down to es5
        "presets": [
            ["@babel/preset-env", {
                "targets": {
                    // % refers to the global coverage of users from browserslist
                    "browsers": [
                        ">0.25%",
                        "not op_mini all",
                        "ie >= 11",
                    ],
                },
            }],
        ],
    });
    pump(
        [
            transpileJS.bundle(),
            source(PATHS.javascript.app.outputName),
            buffer(),
            gulp.dest(PATHS.javascript.common.dest),
            rename({ extname: ".min.js" }),
            sourcemaps.init({
                loadMaps: true,
            }),
            uglify(),
            sourcemaps.write(PATHS.common.sourcemapsOut),
            gulp.dest(PATHS.javascript.common.dest),
        ],
        callback
    );
}
// compile stylus into clean css for the browser
// executes the following operations:
// - run the stylus through the stylus compiler
// - combine all relevant media queries for concise & debuggable css
// - utilise cleancss to clean and minify the stylus output
// - Write a minified css file to the destination
// @param {*} callback - the "done" callback fired when all gulp pipes have completed
function compileStylus (callback) {
    pump(
        [
            gulp.src(PATHS.styles.stylus.entry),
            sourcemaps.init(),
            stylus({
                use: [
                    rupture(),
                ],
            }),
            cssBase64({
                baseDir: PATHS.images.dest,
                extensionsAllowed: [
                    ".gif",
                    ".jpg",
                    ".png",
                ],
                maxWeightResource: 100,
            }),
            cssImport(),
            prefix(),
            combineMq(),
            gulp.dest(PATHS.styles.common.dest),
            cleanCss({
                level: 1,
            }),
            rename({
                extname: ".min.css",
            }),
            sourcemaps.write(PATHS.common.sourcemapsOut),
            gulp.dest(PATHS.styles.common.dest),
        ],
        callback
    );
}
// run all source images through minification.
// for svg, we typically manually edit the outputted code from
// a vector illustration program and use them as an include within a
// template, in which case we do not need to pass them through optimisation
// @param {*} callback
function minifyImages (callback) {
    pump(
        [
            gulp.src(PATHS.images.entry),
            imagemin([
                imagemin.gifsicle({ interlaced: true }),
                imagemin.jpegtran({ progressive: true }),
                imagemin.optipng({ optimizationLevel: 5 }),
                imagemin.svgo({
                    plugins: [
                        { removeViewBox: true },
                        { cleanupIDs: true },
                    ],
                }),
            ]),
            gulp.dest(PATHS.images.dest),
        ],
        callback
    );
}
/* == == tasks == == */
// js tasks
gulp.task("javascript:lint", lintJavascript);
gulp.task("javascript:app", compileJavascript);
gulp.task("javascript", callback => {
    runSequence(
        "javascript:lint",
        "javascript:app",
        callback
    );
});
// style tasks
gulp.task("stylus", compileStylus);
gulp.task("styles", callback => {
    runSequence(
        "stylus",
        callback
    );
});
// image tasks
gulp.task("images", minifyImages);
// watch function to fire appropriate tasks on file change
function watch () {
    browserSync.init({
        notify: false,
        open: false,
        proxy: "../distribution",
        reloadOnRestart: true,
    });
    gulp.watch(PATHS.images.watch, ["images"]).on("change", browserSync.reload);
    gulp.watch(PATHS.styles.stylus.watch, ["styles"]);
    // reload browser once stylus has been compiled
    gulp.watch(PATHS.styles.output.watch).on(
        "change",
        browserSync.reload
    );
    gulp.watch(PATHS.javascript.app.watch, ["javascript"]).on("change", browserSync.reload);
}
// default task
gulp.task(
    "default",
    [
        "images",
        "styles",
        "javascript",
    ],
    watch
);
// google pagespeed insights tasks, not included in the default task
gulp.task("mobile", () => {
    return psi(PATHS.common.site, {
        nokey: "true",
        strategy: "mobile",
    }).then(function (data) {
        console.log("Speed score: " + data.ruleGroups.SPEED.score);
        console.log("Usability score: " + data.ruleGroups.USABILITY.score);
    });
});
gulp.task("desktop", () => {
    return psi(PATHS.common.site, {
        nokey: "true",
        strategy: "desktop",
    }).then(function (data) {
        console.log("Speed score: " + data.ruleGroups.SPEED.score);
    });
});
// run both of the above pagespeed tasks
gulp.task("pagespeed", ["mobile", "desktop"]);
