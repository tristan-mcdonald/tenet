/*
    allow enchanced focus detection (depends on a11y.js)
*/
export default function () {
    /* global ally */
    // inform the developer that a11y.js has loaded
    console.info("loaded version", ally.version, "of a11y.js");
    // detect focus source using a11y.js, which will be stored
    // as CSS classes on the `html` element
    const focusSource = ally.style.focusSource(); // eslint-disable-line no-unused-vars
}
