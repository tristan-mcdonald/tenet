var cleanCSS = require('gulp-clean-css'),
concat       = require('gulp-concat'),
cssimport    = require('gulp-cssimport'),
fileinclude  = require('gulp-file-include'),
gulp         = require('gulp'),
gutil        = require('gulp-util'),
jeet         = require('jeet'),
livereload   = require('gulp-livereload'),
plumber      = require('gulp-plumber'),
prefix       = require('gulp-autoprefixer'),
rename       = require('gulp-rename'),
rupture      = require('rupture'),
stylus       = require('gulp-stylus'),
uglify       = require('gulp-uglify');

// js paths
var jsLibs = 'js/source/vendor/**/*.js',
    jsApp  = 'js/source/app.js',
    jsDest = 'js/distribution';

// error handling
var onError = function (err) {
    gutil.beep();
    console.log(err);
};

// stylus compilation
gulp.task('stylus', function() {
    return gulp.src('stylus/app.styl')
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(stylus({
            use: [jeet(), rupture()]
        }))
        .on('end', function(){ gutil.log('app.styl has been compiled to app.css'); })
        .pipe(gulp.dest(''));
});

// css tasks
gulp.task('css', ['stylus'], function () {
    return gulp.src('app.css')
        .pipe(cssimport())
        .on('end', function(){ gutil.log('css imports have been inlined'); })
        .pipe(prefix())
        .on('end', function(){ gutil.log('app.css has been autoprefixed'); })
        .pipe(cleanCSS({
            level: 1
        }))
        .pipe(gulp.dest(''))
        .on('end', function(){ gutil.log('app.css has been cleaned and minified'); })
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
        .pipe(gulp.dest(jsDest))
        .on('end', function(){ gutil.log('js files have been minified'); })
        .on('end', function(){ gutil.log('*** js task is finished ***'); })
        .pipe(livereload());
});

// file include task
gulp.task('fileinclude', function() {
    gulp.src(['templates/*.html'])
        .pipe(fileinclude({
            prefix: '@@',
            basepath: '@file'
        }))
    .pipe(gulp.dest('./'))
    .on('end', function(){ gutil.log('*** file include task is finished ***'); })
    .pipe(livereload());
});

// initialise livereload
livereload.listen();

// gulp watch
gulp.task('watch', function() {
    gulp.watch('stylus/**/*', ['css'])
    gulp.watch('js/source/**/*', ['scripts']);
    gulp.watch('templates/**/*', ['fileinclude']);
});

// default task
gulp.task('default', ['fileinclude', 'css', 'scripts', 'watch']);
