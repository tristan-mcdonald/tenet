// interpolate between minimum ratio and maximum ratio,
// based on current viewport width
function scaleRatio (width, minValue, maxValue) {
    const minRange      = 680;
    const maxRange      = 1280;
    const a             = (maxValue - minValue) / (maxRange - minRange);
    const b             = minValue - a * minRange;
    const ratio         = width * a + b;
    const adjustedRatio = Math.max(minValue, Math.min(ratio, maxValue));
    // update CSS custom property '--ratio' with ratio figure from the above math
    document.documentElement.style.setProperty("--ratio", adjustedRatio);
}

module.exports = {
    // interpolate between type ratio minimum and maximum values
    // store the result in a CSS custom property
    init: () => {
        // add smallest type ratio from variables.styl here
        let typeRatioSmall = 1.125;
        // add largest type ratio from variables.styl here
        let typeRatioLarge = 1.24;
        // get current viewport width
        let screenWidth = screen.width;
        // apply the ratio scaling function
        scaleRatio(screenWidth, typeRatioSmall, typeRatioLarge);
        // watch for change in the viewport width and recalculate if change is detected
        window.addEventListener("resize", () => {
            let screenWidth = screen.width;
            scaleRatio(screenWidth, typeRatioSmall, typeRatioLarge);
        });
    }
};
