"use strict";

import focusAccessibility from "./modules/focus_accessibility";
import typeRatioInterpolation from "./modules/type_ratio_interpolation";

/**
 * Interpolate between type ratio minimum and maximum values, and store the result in a CSS custom
 * property.
 */
typeRatioInterpolation();

/**
 * Allow enchanced focus detection (depends on a11y.js).
 */
focusAccessibility();
