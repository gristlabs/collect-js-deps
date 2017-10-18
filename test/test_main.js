"use strict";
/* global describe, it */

const assert = require('chai').assert;
const path = require('path');
const fse = require('fs-extra');
const tmp = require('tmp-promise');
const klaw = require('klaw');
const testutil = require('./testutil');
const collect = require('../index');

describe("collect-js-deps", function() {
  this.timeout(30000);      // It can take a longer on TravisCI.

  function collectFiles(root) {
    return new Promise((resolve, reject) => {
      const items = [];
      klaw(root)
      .on('data', item => { if (item.stats.isFile()) { items.push(item.path); } })
      .on('end', () => resolve(items))
      .on('error', err => reject(err));
    });
  }

  it("should process typescript", function() {
    return testutil.consoleCapture(messages => {
      return collect.main(['--list', '-p', '[', 'tsify', ']', 'test/fixtures/a/foo.js'])
      .then(() => assert.deepEqual(messages, [
        'log: test/fixtures/a/bar.ts',
        'log: test/fixtures/a/foo.js',
      ]));
    });
  });

  it("should not add wrapping to output", function() {
    return tmp.dir({ prefix: 'collect-js-test-', unsafeCleanup: true })
    .then(o => testutil.consoleCapture(messages => {
      const tmpDir = o.path;
      return collect.main(['--outdir', tmpDir, '-p', '[', 'tsify', ']', 'test/fixtures/a/foo.js'])
      .then(() => assert.deepEqual(messages, []))
      .then(() => collectFiles(tmpDir))
      .then(paths => {
        assert.deepEqual(paths.map(p => path.relative(tmpDir, p)), [
          'test/fixtures/a/bar.js',   // Note that this has been changed to .js.
          'test/fixtures/a/foo.js',
        ]);
      })
      .then(() => Promise.all([
        fse.readFile(path.join(tmpDir, 'test/fixtures/a/foo.js'), { encoding: 'utf8' }),
        fse.readFile('test/fixtures/a/foo.js', { encoding: 'utf8' }),
      ]))
      .then(contents => assert.equal(contents[0], contents[1]))
      .then(() => fse.readFile(path.join(tmpDir, 'test/fixtures/a/bar.js'), { encoding: 'utf8' }))
      .then(content => assert.equal(content, 'console.log("bar", __dirname, __filename);\n'));
    }));
  });

});
