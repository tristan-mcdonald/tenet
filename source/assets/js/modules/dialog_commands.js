/**
 * Provide a fallback for the `command` and `commandfor` attributes on `button` elements, known as
 * invoker commands, which open and close `dialog` elements without JavaScript. Browsers which
 * support invoker commands natively don't run this fallback.
 */
export default function () {
    if ("command" in HTMLButtonElement.prototype) return;

    document.addEventListener("click", function (event) {
        const button = event.target.closest("button[commandfor]");

        if (!button) return;

        const dialog = document.getElementById(button.getAttribute("commandfor"));

        if (!(dialog instanceof HTMLDialogElement)) return;

        const command = button.getAttribute("command");

        if (command === "show-modal" && !dialog.open) {
            dialog.showModal();
        } else if (command === "close" || command === "request-close") {
            dialog.close();
        }
    });
}
