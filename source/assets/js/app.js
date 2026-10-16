"use strict";

import dialogCommands from "./modules/dialog_commands";
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

/**
 * Open and close dialogs with invoker commands in browsers which don't yet support them.
 */
dialogCommands();
