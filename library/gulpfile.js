var gulp = require('gulp')
var concat = require('gulp-concat')

gulp.task('phone', function () {
  return gulp.src(['js/*.js', 'js/phone/*.js'])
    .pipe(concat('phone.js'))
    .pipe(gulp.dest('./dist'))
})

gulp.task('server', function () {
  return gulp.src(['js/*.js', 'js/server/*.js'])
    .pipe(concat('server.js'))
    .pipe(gulp.dest('./dist'))
})

gulp.task('analysis', function () {
  return gulp.src(['js/*.js'])
    .pipe(concat('analysis.js'))
    .pipe(gulp.dest('./dist'))
})
