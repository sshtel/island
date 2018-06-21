'use strict';

var gulp = require('gulp');
var jasmine = require('gulp-jasmine');
var istanbul = require('gulp-istanbul');
var tslint = require('gulp-tslint');
var remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');

var sources = ['./src/**/*.ts'];

function executeIslandDocGen(options) {
  if (process.env.npm_lifecycle_event === 'test') {
    return function (done) { return done(); };
  }

  options = options || {};
  return function (done) {
    var islandDoc = require('island-doc').default;
    islandDoc.run(done);
  };
}

// for incremental build test
function compileWithGulpTypescript() {
  var ts = require('gulp-typescript');
  var sourcemaps = require('gulp-sourcemaps');
  var tsProject = ts.createProject('tsconfig.json');

  var tsResult = gulp.src('src/**/*.ts', { since: gulp.lastRun('scripts') })
    .pipe(sourcemaps.init())
    .pipe(tsProject());

  tsResult.dts.pipe(gulp.dest('dist'));
  return tsResult.js.pipe(sourcemaps.write()).pipe(gulp.dest('dist'));
}

function executeTypescriptCompiler(options) {
  options = options || {};
  options.project = options.project || process.cwd();

  var command = makeTscCommandString(options);
  return function compileTypescript(done) {
    require('child_process').exec(command, function (err, stdout, stderr) {
      var outString = stdout.toString();
      if (outString) console.log('\n', outString);
      if (options.taskAlwaysSucceed) {
        return done();
      }
      done(err);
    });
  };
}

function makeTscCommandString(options) {
  return 'tsc ' +
    Object.keys(options)
      .filter(function (key) {
        return key !== 'taskAlwaysSucceed';
      })
      .map(function (key) {
        return '--' + key + ' ' + (options[key] || '');
      })
      .join(' ');
}

function watch() {
  gulp.watch(sources, gulp.series('scripts'));
}

function clean(done) {
  var del = require('del');
  del(['./dist', './node_modules', './coverage'], done);
}

function registerJasmineTasks() {
  var files = require('glob').sync('./dist/spec/*.js');
  files.forEach(function (name) {
    // ./dist/spec/abc.spec.js => abc.spec
    var taskName = name.match(/^.*\/(.*)\.js$/)[1];
    jasmineTask(taskName);
  });
}

function jasmineTask(name) {
  var buildAndTest = 'run-' + name;
  gulp.task(buildAndTest, gulp.series(['build'], function () {
    return gulp.src('./dist/spec/' + name + '.js')
      .pipe(jasmine());
  }));

  gulp.task(name, gulp.series([buildAndTest], function () {
    // gulp.watch(sources, [buildAndTest]);
  }));
}

function preIstanbulTask() {
  return gulp.src(['dist/**/*.js', '!dist/spec/**/*.js'])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
}

function istanbulTask() {
  const stream = gulp.src(['dist/spec/*.js']).pipe(jasmine());
  // https://github.com/gulpjs/gulp/issues/358 or gulp-plumber
  stream.on('error', (e) => {
    console.error('error on running coverage: ', e);
    process.exit(1);
  });
  return stream.pipe(istanbul.writeReports());
}

function remapIstanbulTask() {
  return gulp.src('coverage/coverage-final.json')
    .pipe(remapIstanbul({
      reports: {
        html: 'coverage/remap-report',
        'lcovonly': 'coverage/lcov-remap.info'
      }
    }));
}

function doLint() {
  if (process.env.npm_lifecycle_event === 'test') {
    return gulp.src('empty', { allowEmpty: true });
  }
  return gulp.src('src/**/*.ts')
    .pipe(tslint({
      fix: true,
      formatter: 'stylish'
    }))
    .pipe(tslint.report({
      summarizeFailureOutput: true
    }));
}

gulp.task('tslint', doLint);
gulp.task('env-doc', executeIslandDocGen());
gulp.task('buildIgnoreError', executeTypescriptCompiler({noEmitOnError: '', taskAlwaysSucceed: true}));

gulp.task('clean', clean);
gulp.task('watch', watch);
gulp.task('scripts', compileWithGulpTypescript);
gulp.task('build', gulp.series(gulp.parallel('tslint', 'env-doc'), executeTypescriptCompiler()));
gulp.task('pre-coverage', preIstanbulTask);
gulp.task('coverage-js', istanbulTask);
gulp.task('coverage', gulp.series('build', 'pre-coverage', 'coverage-js', remapIstanbulTask));

registerJasmineTasks();
