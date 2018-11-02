// interpolate between minimum ratio & maximum ratio, based on current viewport width
const TypeRatioInterpolation = require("./modules/type-ratio-interpolation");
TypeRatioInterpolation.init();

// polyfill to enable us to use forEach on node lists in IE11
const ForEachPolyfill = require("./modules/foreach-polyfill");
ForEachPolyfill.init();
