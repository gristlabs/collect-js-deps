#!/usr/bin/env node
"use strict";

const path = require('path');
const fse = require('fs-extra');
const through = require('through2');
const browserifyArgs = require('browserify/bin/args');

const _nativeExt = ['.js', '.json'];

/**
 * Replaces extension of fpath with newExt unless fpath has a .js or .json extension.
 */
function replaceExt(fpath, newExt) {
  const oldExt = path.extname(fpath);
  return _nativeExt.includes(oldExt) ? fpath :
    path.join(path.dirname(fpath), path.basename(fpath, oldExt) + newExt);
}

class Collector {
  constructor(opts) {
    opts = opts || {};
    this._outDir = opts.outdir;
    this._list = Boolean(opts.list);
    this._checkedPackageDirs = new Set();
  }

  /**
   * Main file processory. Prints file with --list option, saves its contents with --outdir
   * options, and handles parent package.json files if any.
   */
  processFile(fpath, source) {
    const relPath = path.relative('', fpath);
    if (!relPath || relPath.startsWith('..')) {
      // Ignore files that are not under the current directory.
      return Promise.resolve();
    }

    return this._outputSource(relPath, source)
    .then(() => this._processPackages(relPath));
  }

  /**
   * Handle package.json files in parent directories of relPath up until the current directory
   * (excluding it). These files are needed for require() calls to work within outdir, and they
   * are the main reason for using this module over simply 'browserify --list'.
   */
  _processPackages(relPath) {
    let dirs = [];
    let d = path.dirname(relPath);
    while (d !== '.' && !this._checkedPackageDirs.has(d)) {
      this._checkedPackageDirs.add(d);
      dirs.push(d);
      d = path.dirname(d);
    }
    return Promise.all(dirs.map(d => this._processPackage(d)));
  }

  _processPackage(relDirPath) {
    const p = path.join(relDirPath, 'package.json');
    return fse.pathExists(p)
    .then(exists => exists ? this._outputCopy(p) : null);
  }

  _outputSource(relPath, content) {
    if (this._list) { console.log(relPath); }
    if (!this._outDir) { return Promise.resolve(); }
    const outPath = path.join(this._outDir, replaceExt(relPath, '.js'));
    return fse.outputFile(outPath, content);
  }

  _outputCopy(relPath) {
    if (this._list) { console.log(relPath); }
    if (!this._outDir) { return Promise.resolve(); }
    return fse.copy(relPath, path.join(this._outDir, relPath));
  }
}

/**
 * Collect all JS files as gathered by the passed-in browserify instance. For this usage,
 * .browserField should normally be false (which is set automatically for command-line usage by
 * including --node into the command line).
 * @param b - Browserify instance.
 * @param opts.outdir - Optional directory to which to place copy of files (possibly transformed).
 *    In case of transforms of non-js files (e.g. compiling .ts files with tsify), the output file
 *    will be saved with .js extension.
 * @param opts.list - Optional boolean for whether to print all source files encountered.
 */
function collect_js_deps(b, opts) {
  const collector = new Collector(opts);

  b.pipeline.get('deps').push(through.obj((row, enc, next) => {
    let p = row.file || row.id;
    collector.processFile(p, row.source).then(() => { next(); });
  }));
  return b;
}

module.exports = collect_js_deps;

if (require.main === module) {
  let args = ['--node'].concat(process.argv.slice(2));
  let b = browserifyArgs(args);
  let outDir = (b.argv.outdir || b.argv.o);
  if (b.argv._[0] === 'help' || b.argv.h || b.argv.help ||
    (process.argv.length <= 2 && process.stdin.isTTY)) {
    console.log('Usage: collect-js-deps --outdir <path> [--list] {BROWSERIFY-OPTIONS} [entry files]');
    process.exit(1);
  }
  if (!outDir && !b.argv.list) {
    console.log('collect-js-deps requires --outDir (-o) option for output directory, or --list');
    process.exit(1);
  }
  collect_js_deps(b, { list: b.argv.list, outdir: outDir });
  b.bundle();
}
