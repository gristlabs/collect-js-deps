"use strict";

const bluebird = require('bluebird');
const sinon = require('sinon');

/**
 * Capture console output in the enclosed function. Usage:
 *
 *    return consoleCapture(['log', 'warn'], messages => {
 *      ...
 *      assert.deepEqual(messages, [...]);
 *    });
 *
 * @param {String} optMethodNames: If given, an array of console's method names to capture.
 *    The method name is always prefixed to the captured messages as "method: ". If omitted,
 *    equivalent to just ['log'].
 * @param {Function} bodyFunc: Function to call while capturing messages. Console will be restored
 *    after the function returns. If the function returns a Promise, it will be waited for.
 *
 * Note that captured messages are an approximation of what console would output: only %s and %d
 * get interpolated in the format string.
 */
function consoleCapture(optMethodNames, bodyFunc) {
  let methodNames = (bodyFunc === undefined ? ['log'] : optMethodNames);
  let func = (bodyFunc === undefined ? optMethodNames : bodyFunc);
  let messages = [];
  methodNames.forEach(m => sinon.stub(console, m).callsFake(
    (...args) => _capture(messages, m, ...args)));
  return bluebird.try(() => func(messages))
  .finally(() => methodNames.forEach(m => console[m].restore()));
}
exports.consoleCapture = consoleCapture;

function _capture(messages, methodName, format, ...args) {
  // Format the message, nice and simple.
  let i = 0;
  if (typeof format == 'string') {
    format = format.replace(/\%s|\%d/g, () => args[i++]);
  }
  let message = methodName + ': ' + format;
  for ( ; i < args.length; i++) {
    message += ' ' + args[i];
  }
  messages.push(message);
}
