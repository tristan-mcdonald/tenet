"use strict";
// polyfill to enable us to use forEach on node lists in internet explorer
const ForEachPolyfill = require("./modules/foreach-polyfill");
ForEachPolyfill.init();
// polyfill to allow use of replace method on a classList in internet explorer
const ClassListPolyfill = require("./modules/classlist-polyfill");
ClassListPolyfill.init();
// interpolate between minimum ratio & maximum ratio, based on current viewport width
const TypeRatioInterpolation = require("./modules/type-ratio-interpolation");
TypeRatioInterpolation.init();
// detect focus source using a11y.js
const FocusAccessibility = require("./modules/focus-accessibility");
FocusAccessibility.init();
