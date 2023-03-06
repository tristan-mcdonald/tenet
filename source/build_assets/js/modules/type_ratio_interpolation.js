function scaleRatio (currentViewportWidth, minimumValue, maximumValue) {
    // store the minimum viewport width at which `--ratio`
    // custom property will be set. this must match values
    // set in `breakpoints.styl` & `typography.styl`.
    const minRange = 480;
    // store the maximum viewport width at which `--ratio`
    // custom property will be set. this must match values
    // set in `breakpoints.styl` & `typography.styl`.
    const maxRange = 1680;
    // calculate and store the rate at wich our ratio changes
    // when the viewport width changes by 1px
    const rateOfChange = (maximumValue - minimumValue) / (maxRange - minRange);
    // store the intercept (the value of Y when all X=0)
    const valueAtViewportZero = minimumValue - rateOfChange * minRange;
    // if we follow a linear progression from ratio m at viewport M,
    // to ratio n at viewport N, calculate and store the ratio at viewport X
    const interpolatedRatio = currentViewportWidth * rateOfChange + valueAtViewportZero;
    // use `interpolatedRatio` value if it's within range.
    // if it would be smaller than the smallest acceptable ratio, use the smallest.
    // if it would be larger than the largest acceptable ratio, use the largest.
    const boundedRatio = Math.max(minimumValue, Math.min(interpolatedRatio, maximumValue));
    // store final ratio in CSS custom property `--ratio`
    document.documentElement.style.setProperty("--ratio", boundedRatio);
}
/*
    interpolate between type ratio minimum and maximum values,
    and store the result in a CSS custom property
*/
export default function () {
    // store the lowest ratio to use for our typographic scale.
    // This must match the value set in `typographic-variables.styl`.
    const typeRatioLow = 1.125;
    // store the highest ratio to use for our typographic scale.
    // This must match the value set in `typographic-variables.styl`.
    const typeRatioHigh = 1.28;
    // store the current viewport width
    const screenWidth = window.innerWidth;
    // apply the ratio scaling function, to apply
    // the ratio for the current viewport width
    scaleRatio(screenWidth, typeRatioLow, typeRatioHigh);
    // watch for change in the viewport width
    window.addEventListener("resize", () => {
        // store the current viewport width
        const screenWidth = window.innerWidth;
        // recalculate ratio when change is detected
        scaleRatio(screenWidth, typeRatioLow, typeRatioHigh);
    });
}
