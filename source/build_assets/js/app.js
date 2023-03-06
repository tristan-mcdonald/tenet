"use strict";
// import functions
import classlist_polyfill from "./modules/classlist_polyfill";
import for_each_polyfill from "./modules/foreach_polyfill";
import focus_accessibility from "./modules/focus_accessibility";
import type_ratio_interpolation from "./modules/type_ratio_interpolation";
/*
    polyfill to enable use of forEach on node lists in IE11
*/
for_each_polyfill();
/*
    polyfill to allow use of replace method
    on a classList in internet explorer
*/
classlist_polyfill();
/*
    interpolate between type ratio minimum and maximum values,
    and store the result in a CSS custom property
*/
type_ratio_interpolation();
/*
    allow enchanced focus detection (depends on a11y.js)
*/
focus_accessibility();
