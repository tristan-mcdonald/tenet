/**
 * Interpolate between type ratio minimum and maximum values, and store the result in a CSS custom
 * property.
 */
export default function () {
    /**
     * Store the lowest ratio to use for our typographic scale. This must match the value set in
     * `typographic-variables.styl`.
     */
    const typeRatioLow = 1.1;
    /**
     * Store the highest ratio to use for our typographic scale. This must match the value set in
     * `typographic-variables.styl`.
     */
    const typeRatioHigh = 1.2;
    // Store the current viewport width.
    const screenWidth = window.innerWidth;
    // Apply the ratio scaling function, to apply the ratio for the current viewport width.
    scaleRatio(screenWidth, typeRatioLow, typeRatioHigh);
    // Watch for change in the viewport width.
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        // Store the current viewport width.
        const screenWidth = window.innerWidth;
        // Recalculate ratio when change is detected.
        resizeTimeout = setTimeout(scaleRatio(screenWidth, typeRatioLow, typeRatioHigh), 100);
    });
}

function scaleRatio (currentViewportWidth, minimumValue, maximumValue) {
    /**
     * The minimum viewport width at which `--ratio` custom property will be set. this must match
     * values set in `breakpoints.styl` & `typography.styl`.
     */
    const minRange = 480;
    /**
     * The maximum viewport width at which `--ratio` custom property will be set. this must match
     * values set in `breakpoints.styl` & `typography.styl`.
     */
    const maxRange = 1480;
    // Calculate the rate at which our ratio changes when the viewport width changes by 1px.
    const rateOfChange = (maximumValue - minimumValue) / (maxRange - minRange);
    // Store the intercept (the value of Y when all X=0).
    const valueAtViewportZero = minimumValue - rateOfChange * minRange;
    /**
     * If we follow a linear progression from ratio m at viewport M to ratio n at viewport N,
     * calculate and store the ratio at viewport X.
     */
    const interpolatedRatio = currentViewportWidth * rateOfChange + valueAtViewportZero;
    /**
     * Use `interpolatedRatio` value if it's within range. If it would be smaller than the smallest
     * acceptable ratio, use the smallest. If it would be larger than the largest acceptable ratio,
     * use the largest.
     */
    const boundedRatio = Math.max(minimumValue, Math.min(interpolatedRatio, maximumValue));
    // Store final ratio in CSS custom property `--ratio`.
    document.documentElement.style.setProperty("--ratio", boundedRatio);
}
