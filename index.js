"use strict";

var path = require('path');
var fse = require('fs-extra');
var through = require('through2');

function replaceExt(fpath, newExt) {
  const oldExt = path.extname(fpath);
  return path.join(path.dirname(fpath), path.basename(fpath, oldExt) + newExt);
}

class Collector {
  constructor(outDir) {
    this._outDir = outDir;
    this._checkedPackageDirs = new Set();
  }

  processFile(fpath, source) {
    const relPath = path.relative('', fpath);
    const newPath = path.join(this._outDir, replaceExt(relPath, '.js'));
    return fse.outputFile(newPath, source)
    .then(() => this._processPackages(relPath));
  }

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
    .then(exists => exists ? fse.copy(p, path.join(this._outDir, p)) : null);
  }
}

function collect_js_deps(b, opts) {
  if (!opts) opts = {};
  if (typeof b === 'string') {
    throw new Error('should be used as a plugin, not a transform');
  }

  const outDir = opts.outDir || opts.o;
  if (!outDir) {
    throw new Error('collect-js-deps requires --outDir (-o) option for output directory');
  }
  const collector = new Collector(outDir);

  b.pipeline.get('deps').push(through.obj((row, enc, next) => {
    let p = row.file || row.id;
    collector.processFile(p, row.source).then(() => { next(); });
  }));
  return b;
}

module.exports = collect_js_deps;
