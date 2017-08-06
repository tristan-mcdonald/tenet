var gulp		= require('gulp'),
    gutil		= require('gulp-util'),
    stylus		= require('gulp-stylus'),
    jeet		= require('jeet'),
    rupture		= require('rupture'),
    prefix		= require('gulp-autoprefixer'),
    plumber		= require('gulp-plumber'),
    livereload	= require('gulp-livereload');

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
    .pipe(gulp.dest(''));
});

// autoprefixer and livereload
gulp.task('autoprefixer', ['stylus'], function () {
  return gulp.src('style.css')
    .pipe(prefix())
    .pipe(gulp.dest(''))
    .pipe(livereload());
});

// initialise livereload and gulp watch
livereload.listen();
gulp.watch('stylus/**/*.styl', ['autoprefixer']);
gulp.task('default', ['autoprefixer']);