/*
    interpolate between minimum ratio and maximum ratio,
    based on current viewport width
*/
function scaleRatio (width, minValue, maxValue) {
    const minRange      = 480;
    const maxRange      = 1680;
    const a             = (maxValue - minValue) / (maxRange - minRange);
    const b             = minValue - a * minRange;
    const ratio         = width * a + b;
    const adjustedRatio = Math.max(minValue, Math.min(ratio, maxValue));
    // update CSS custom property '--ratio' with ratio figure from the above calculation
    document.documentElement.style.setProperty("--ratio", adjustedRatio);
}
module.exports = {
    init: () => {
        /*
            interpolate between type ratio minimum and maximum values
            store the result in a CSS custom property
        */
        (() => {
            // add smallest type ratio from variables.styl here
            let typeRatioSmall = 1.125;
            // add largest type ratio from variables.styl here
            let typeRatioLarge = 1.24;
            // get current viewport width
            let screenWidth = window.innerWidth;
            // apply the ratio scaling function
            scaleRatio(screenWidth, typeRatioSmall, typeRatioLarge);
            // watch for change in the viewport width and recalculate if change is detected
            window.addEventListener("resize", () => {
                let screenWidth = window.innerWidth;
                scaleRatio(screenWidth, typeRatioSmall, typeRatioLarge);
            });
        })();
    },
};
