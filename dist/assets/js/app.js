(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

// interpolate between minimum ratio & maximum ratio, based on current viewport width
var TypeRatioInterpolation = require("./modules/type-ratio-interpolation");
TypeRatioInterpolation.init();

},{"./modules/type-ratio-interpolation":2}],2:[function(require,module,exports){
"use strict";

// interpolate between minimum ratio and maximum ratio,
// based on current viewport width
function scaleRatio(width, minValue, maxValue) {
    var minRange = 680;
    var maxRange = 1280;
    var a = (maxValue - minValue) / (maxRange - minRange);
    var b = minValue - a * minRange;
    var ratio = width * a + b;
    var adjustedRatio = Math.max(minValue, Math.min(ratio, maxValue));
    // update CSS custom property '--ratio' with ratio figure from the above math
    document.documentElement.style.setProperty("--ratio", adjustedRatio);
}

module.exports = {
    // interpolate between type ratio minimum and maximum values
    // store the result in a CSS custom property
    init: function init() {
        // get current viewport width
        var screenWidth = screen.width;
        // apply the ratio scaling function
        scaleRatio(screenWidth, 1.125, 1.24);
        // watch for change in the viewport width and recalculate if change is detected
        window.addEventListener("resize", function () {
            var screenWidth = screen.width;
            scaleRatio(screenWidth, 1.125, 1.333);
        });
    }
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhc3NldHMvanMvYXBwLmpzIiwiYXNzZXRzL2pzL21vZHVsZXMvdHlwZS1yYXRpby1pbnRlcnBvbGF0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQTtBQUNBLElBQU0seUJBQXlCLFFBQVEsb0NBQVIsQ0FBL0I7QUFDQSx1QkFBdUIsSUFBdkI7Ozs7O0FDRkE7QUFDQTtBQUNBLFNBQVMsVUFBVCxDQUFxQixLQUFyQixFQUE0QixRQUE1QixFQUFzQyxRQUF0QyxFQUFnRDtBQUM1QyxRQUFNLFdBQWdCLEdBQXRCO0FBQ0EsUUFBTSxXQUFnQixJQUF0QjtBQUNBLFFBQU0sSUFBZ0IsQ0FBQyxXQUFXLFFBQVosS0FBeUIsV0FBVyxRQUFwQyxDQUF0QjtBQUNBLFFBQU0sSUFBZ0IsV0FBVyxJQUFJLFFBQXJDO0FBQ0EsUUFBTSxRQUFnQixRQUFRLENBQVIsR0FBWSxDQUFsQztBQUNBLFFBQU0sZ0JBQWdCLEtBQUssR0FBTCxDQUFTLFFBQVQsRUFBbUIsS0FBSyxHQUFMLENBQVMsS0FBVCxFQUFnQixRQUFoQixDQUFuQixDQUF0QjtBQUNBO0FBQ0EsYUFBUyxlQUFULENBQXlCLEtBQXpCLENBQStCLFdBQS9CLENBQTJDLFNBQTNDLEVBQXNELGFBQXREO0FBQ0g7O0FBRUQsT0FBTyxPQUFQLEdBQWlCO0FBQ2I7QUFDQTtBQUNBLFVBQU0sZ0JBQU07QUFDUjtBQUNBLFlBQUksY0FBYyxPQUFPLEtBQXpCO0FBQ0E7QUFDQSxtQkFBVyxXQUFYLEVBQXdCLEtBQXhCLEVBQStCLElBQS9CO0FBQ0E7QUFDQSxlQUFPLGdCQUFQLENBQXdCLFFBQXhCLEVBQWtDLFlBQU07QUFDcEMsZ0JBQUksY0FBYyxPQUFPLEtBQXpCO0FBQ0EsdUJBQVcsV0FBWCxFQUF3QixLQUF4QixFQUErQixLQUEvQjtBQUNILFNBSEQ7QUFJSDtBQWJZLENBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLy8gaW50ZXJwb2xhdGUgYmV0d2VlbiBtaW5pbXVtIHJhdGlvICYgbWF4aW11bSByYXRpbywgYmFzZWQgb24gY3VycmVudCB2aWV3cG9ydCB3aWR0aFxuY29uc3QgVHlwZVJhdGlvSW50ZXJwb2xhdGlvbiA9IHJlcXVpcmUoXCIuL21vZHVsZXMvdHlwZS1yYXRpby1pbnRlcnBvbGF0aW9uXCIpO1xuVHlwZVJhdGlvSW50ZXJwb2xhdGlvbi5pbml0KCk7XG4iLCIvLyBpbnRlcnBvbGF0ZSBiZXR3ZWVuIG1pbmltdW0gcmF0aW8gYW5kIG1heGltdW0gcmF0aW8sXG4vLyBiYXNlZCBvbiBjdXJyZW50IHZpZXdwb3J0IHdpZHRoXG5mdW5jdGlvbiBzY2FsZVJhdGlvICh3aWR0aCwgbWluVmFsdWUsIG1heFZhbHVlKSB7XG4gICAgY29uc3QgbWluUmFuZ2UgICAgICA9IDY4MDtcbiAgICBjb25zdCBtYXhSYW5nZSAgICAgID0gMTI4MDtcbiAgICBjb25zdCBhICAgICAgICAgICAgID0gKG1heFZhbHVlIC0gbWluVmFsdWUpIC8gKG1heFJhbmdlIC0gbWluUmFuZ2UpO1xuICAgIGNvbnN0IGIgICAgICAgICAgICAgPSBtaW5WYWx1ZSAtIGEgKiBtaW5SYW5nZTtcbiAgICBjb25zdCByYXRpbyAgICAgICAgID0gd2lkdGggKiBhICsgYjtcbiAgICBjb25zdCBhZGp1c3RlZFJhdGlvID0gTWF0aC5tYXgobWluVmFsdWUsIE1hdGgubWluKHJhdGlvLCBtYXhWYWx1ZSkpO1xuICAgIC8vIHVwZGF0ZSBDU1MgY3VzdG9tIHByb3BlcnR5ICctLXJhdGlvJyB3aXRoIHJhdGlvIGZpZ3VyZSBmcm9tIHRoZSBhYm92ZSBtYXRoXG4gICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiLS1yYXRpb1wiLCBhZGp1c3RlZFJhdGlvKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgLy8gaW50ZXJwb2xhdGUgYmV0d2VlbiB0eXBlIHJhdGlvIG1pbmltdW0gYW5kIG1heGltdW0gdmFsdWVzXG4gICAgLy8gc3RvcmUgdGhlIHJlc3VsdCBpbiBhIENTUyBjdXN0b20gcHJvcGVydHlcbiAgICBpbml0OiAoKSA9PiB7XG4gICAgICAgIC8vIGdldCBjdXJyZW50IHZpZXdwb3J0IHdpZHRoXG4gICAgICAgIGxldCBzY3JlZW5XaWR0aCA9IHNjcmVlbi53aWR0aDtcbiAgICAgICAgLy8gYXBwbHkgdGhlIHJhdGlvIHNjYWxpbmcgZnVuY3Rpb25cbiAgICAgICAgc2NhbGVSYXRpbyhzY3JlZW5XaWR0aCwgMS4xMjUsIDEuMjQpO1xuICAgICAgICAvLyB3YXRjaCBmb3IgY2hhbmdlIGluIHRoZSB2aWV3cG9ydCB3aWR0aCBhbmQgcmVjYWxjdWxhdGUgaWYgY2hhbmdlIGlzIGRldGVjdGVkXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsICgpID0+IHtcbiAgICAgICAgICAgIGxldCBzY3JlZW5XaWR0aCA9IHNjcmVlbi53aWR0aDtcbiAgICAgICAgICAgIHNjYWxlUmF0aW8oc2NyZWVuV2lkdGgsIDEuMTI1LCAxLjMzMyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG4iXX0=
