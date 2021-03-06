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
      console.log("Warning: skipping file outside root directory: %s", fpath);
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

exports.collect_js_deps = collect_js_deps;


/**
 * Command-line interface to collect_js_deps. Takes an array of arguments as may be passed to
 * collect-js-deps on the command-line.
 * @returns Promise resolved on success, rejected on error.
 */
function main(args) {
  return new Promise((resolve, reject) => {
    let b = browserifyArgs(['--node', '--no-detect-globals'].concat(args));
    let outdir = (b.argv.outdir || b.argv.o);
    if (b.argv._[0] === 'help' || b.argv.h || b.argv.help ||
      (process.argv.length <= 2 && process.stdin.isTTY)) {
      reject(new Error('Usage: collect-js-deps --outdir <path> [--list] ' +
        '{BROWSERIFY-OPTIONS} [entry files]'));
      return;
    }
    if (!outdir && !b.argv.list) {
      reject(new Error('collect-js-deps requires --outdir (-o) option for output directory, or --list'));
      return;
    }
    collect_js_deps(b, { list: b.argv.list, outdir });
    b.bundle((err, body) => err ? reject(err) : resolve());
  });
}
exports.main = main;


if (require.main === module) {
  main(process.argv.slice(2))
  .catch(err => {
    console.log("Error", err.message);
    process.exit(1);
  });
}
