"use strict";
/*
    define paths object, containing all paths used.
*/
module.exports = {
    javascript: {
        config: "./.eslintrc",
        input: "../build_assets/js/app.js",
        lint: "../build_assets/js/**/*.js",
        output: "../../distribution/assets/js/",
        transpiled: "../../distribution/assets/js/app.js",
        uglified: "../../distribution/assets/js/app.min.js",
        watch: "../build_assets/js/**/*.js",
    },
    images: {
        css: "../build_assets/images",
    },
    server: {
        root: "../../distribution/assets/reference",
    },
    stylus: {
        config: ".stylintrc",
        input: "../build_assets/stylus/app.styl",
        lint: "../build_assets/stylus/**/*.styl",
        output: "../../distribution/assets/css/",
        transpiled: "../../distribution/assets/css/app.css",
        uglified: "../../distribution/assets/css/app.min.css",
        watch: "../build_assets/stylus/**/*.styl",
    },
    templates: {
        input_file: "../reference/templates/index.njk",
        input_folder: "../reference/templates/",
        output: "../../distribution/assets/reference",
        watch: "../reference/templates/**/*.njk",
    },
};
