# collect-js-deps

> Collect the minimal list of dependencies required by a JS file.

This module allows you to examine all dependencies of your Javascript project,
and collect or list just those files that it relies on. It uses Browserify, and
supports transforms (incuding `tsify` to compile TypeScript) to produce
transformed or compiled files as output.

## Installation

```
npm install --save-dev collect-js-deps
```

## Usage

```
$(npm bin)/collect-js-deps [--help] [browserify_options] <start_file>
```
