'use strict';
const platforms = require("./platforms");
const platformCategories = require("./platformCategories");

module.exports = {
    platform: {
        schema: platforms
    },
    "platform-category": {
        schema: platformCategories
    },
};
