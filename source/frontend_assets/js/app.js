"use strict";
// import functions
import ClassListPolyfill from ".modules/classlist_polyfill";
import ForEachPolyfill from "./modules/foreach_polyfill";
import FocusAccessibility from "./modules/focus_accessibility";
import TypeRatioInterpolation from "./modules/type_ratio_interpolation";
/*
    polyfill to enable use of forEach on node lists in IE11
*/
ForEachPolyfill();
/*
    polyfill to allow use of replace method
    on a classList in internet explorer
*/
ClassListPolyfill();
/*
    interpolate between type ratio minimum and maximum values,
    and store the result in a CSS custom property
*/
TypeRatioInterpolation();
/*
    allow enchanced focus detection (depends on a11y.js)
*/
FocusAccessibility();
