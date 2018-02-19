var cleanCSS   = require('gulp-clean-css'),
    concat     = require('gulp-concat'),
    cssimport  = require('gulp-cssimport'),
    gulp       = require('gulp'),
    gutil      = require('gulp-util'),
    jeet       = require('jeet'),
    livereload = require('gulp-livereload'),
    plumber    = require('gulp-plumber'),
    prefix     = require('gulp-autoprefixer'),
    rename     = require('gulp-rename'),
    rupture    = require('rupture'),
    stylus     = require('gulp-stylus'),
    uglify     = require('gulp-uglify');
// js paths
var jsLibs = 'scripts/libs/**/*.js',
    jsApp  = 'js/scripts/app.js',
    jsDest = 'js';
// error handling
var onError = function (err) {
    gutil.beep();
    console.log(err);
};
// stylus compilation
gulp.task('stylus', function() {
    return gulp.src('stylus/style.styl')
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(stylus({
            use: [jeet(), rupture()]
        }))
        .on('end', function(){ gutil.log('site.styl has been compiled to style.css'); })
        .pipe(gulp.dest(''));
});
// css tasks
gulp.task('css', ['stylus'], function () {
    return gulp.src('style.css')
        .pipe(cssimport())
        .on('end', function(){ gutil.log('css imports have been inlined'); })
        .pipe(prefix())
        .on('end', function(){ gutil.log('style.css has been autoprefixed'); })
        .pipe(cleanCSS({
            level: 1
        }))
        .pipe(gulp.dest(''))
        .on('end', function(){ gutil.log('style.css has been cleaned and minified'); })
        .on('end', function(){ gutil.log('*** css task is finished ***'); })
        .pipe(livereload());
});
// js tasks
gulp.task('scripts', function() {
    return gulp.src([jsLibs, jsApp])
        .pipe(concat('app.js'))
        .pipe(gulp.dest(jsDest))
        .on('end', function(){ gutil.log('js files have been concatenated'); })
        .pipe(rename('app.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest(jsDest))
        .on('end', function(){ gutil.log('js files have been minified'); })
        .on('end', function(){ gutil.log('*** js task is finished ***'); })
        .pipe(livereload());
});
// initialise livereload
livereload.listen();
// gulp watch
gulp.task('watch', function() {
    gulp.watch('stylus/**/*.styl', ['css'])
    gulp.watch('js/scripts/**/*.js', ['scripts']);
});
// default task
gulp.task('default', ['css', 'scripts', 'watch']);
