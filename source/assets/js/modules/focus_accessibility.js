/**
 * Detect whether focus was triggered by keyboard, mouse, or script, and adds appropriate data
 * attributes to the HTML element.
 */
export default function () {
    let lastInputMethod = "script";
    const html = document.documentElement;

    // Listen for mouse/touch/pointer events.
    const pointerEvents = [
        "mousedown",
        "MSPointerDown",
        "pointerdown",
        "touchstart",
    ];

    pointerEvents.forEach(function (eventName) {
        document.addEventListener(eventName, function (event) {
            if (event.isPrimary !== false) {
                lastInputMethod = "pointer";
            }
        }, true);
    });

    // Listen for keyboard events.
    document.addEventListener("keydown", function (event) {
        const key = event.key;

        // Ignore modifier keys.
        if (key === "Shift" ||
            key === "Control" ||
            key === "Alt" ||
            key === "Meta" ||
            key === "ContextMenu"
        ) return;

        lastInputMethod = "key";
    }, true);

    // Listen for focus events.
    document.addEventListener("focusin", function () {
        html.setAttribute("data-focus-source", lastInputMethod);
    }, true);

    // Initial state.
    html.setAttribute("data-focus-source", "script");

    // Create and expose the focus source methods.
    window.focusSource = {
        // Get current focus source.
        current: function () {
            return html.getAttribute("data-focus-source");
        },

        // Check if a specific focus source has been used.
        used: function (source) {
            return source === lastInputMethod;
        },

        // Lock to a specific focus source.
        lock: function (source) {
            if (source) {
                lastInputMethod = source;
                html.setAttribute("data-focus-source", source);
            }
        },

        // Unlock focus source.
        unlock: function () {
            lastInputMethod = "script";
        },
    };

    // Return the focus source object for module usage.
    return window.focusSource;
}
