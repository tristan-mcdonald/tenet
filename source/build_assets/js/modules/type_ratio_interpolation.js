function scale_ratio (current_viewport_width, minimum_value, maximum_value) {
    // store the minimum viewport width at which `--ratio`
    // custom property will be set. this must match values
    // set in `breakpoints.styl` & `typography.styl`.
    const min_range = 480;
    // store the maximum viewport width at which `--ratio`
    // custom property will be set. this must match values
    // set in `breakpoints.styl` & `typography.styl`.
    const max_range = 1680;
    // calculate and store the rate at wich our ratio changes
    // when the viewport width changes by 1px
    const rate_of_change = (maximum_value - minimum_value) / (max_range - min_range);
    // store the intercept (the value of Y when all X=0)
    const value_at_viewport_zero = minimum_value - rate_of_change * min_range;
    // if we follow a linear progression from ratio m at viewport M,
    // to ratio n at viewport N, calculate and store the ratio at viewport X
    const interpolated_ratio = current_viewport_width * rate_of_change + value_at_viewport_zero;
    // use `interpolated_ratio` value if it's within range.
    // if it would be smaller than the smallest acceptable ratio, use the smallest.
    // if it would be larger than the largest acceptable ratio, use the largest.
    const bounded_ratio = Math.max(minimum_value, Math.min(interpolated_ratio, maximum_value));
    // store final ratio in CSS custom property `--ratio`
    document.documentElement.style.setProperty("--ratio", bounded_ratio);
}
/*
    interpolate between type ratio minimum and maximum values,
    and store the result in a CSS custom property
*/
export default function () {
    // store the lowest ratio to use for our typographic scale.
    // This must match the value set in `typographic-variables.styl`.
    const type_ratio_low = 1.125;
    // store the highest ratio to use for our typographic scale.
    // This must match the value set in `typographic-variables.styl`.
    const type_ratio_high = 1.28;
    // store the current viewport width
    const screen_width = window.innerWidth;
    // apply the ratio scaling function, to apply
    // the ratio for the current viewport width
    scale_ratio(screen_width, type_ratio_low, type_ratio_high);
    // watch for change in the viewport width
    window.addEventListener("resize", () => {
        // store the current viewport width
        const screen_width = window.innerWidth;
        // recalculate ratio when change is detected
        scale_ratio(screen_width, type_ratio_low, type_ratio_high);
    });
}
