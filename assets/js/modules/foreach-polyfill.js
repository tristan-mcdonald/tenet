module.exports = {
    // polyfill to enable us to use forEach on node lists in IE11
    init: () => {
        if ("NodeList" in window && !NodeList.prototype.forEach) {
            NodeList.prototype.forEach = function (callback, thisArg) {
                thisArg = thisArg || window;
                for (var i = 0; i < this.length; i++) {
                    callback.call(thisArg, this[i], i, this);
                }
            };
        }
    }
};