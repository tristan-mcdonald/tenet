module.exports = {
    init: () => {
        /*
            polyfill to enable us to use forEach on node lists in internet explorer
        */
        (() => {
            if ("NodeList" in window && !NodeList.prototype.forEach) {
                NodeList.prototype.forEach = function (callback, thisArg) {
                    thisArg = thisArg || window;
                    for (var i = 0; i < this.length; i++) {
                        callback.call(thisArg, this[i], i, this);
                    }
                };
            }
            if (window.HTMLCollection && !HTMLCollection.prototype.forEach) {
                HTMLCollection.prototype.forEach = Array.prototype.forEach;
            }
        })();
    },
};
