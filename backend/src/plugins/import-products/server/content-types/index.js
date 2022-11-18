'use strict';

const importxml = require("./importxml");
const categorymap = require("./categorymap");
const charnamemap = require("./charNamemap");
const charvaluemap = require("./charValuemap");
const stockmap = require("./stockMap");
const whitelistmap = require("./whitelistMap");
const blacklistmap = require("./blacklistMap");

module.exports = {
    importxml: {
        schema: importxml
    },
    categorymap: {
        schema: categorymap
    },
    charnamemap: {
        schema: charnamemap
    },
    charvaluemap: {
        schema: charvaluemap
    },
    stockmap: {
        schema: stockmap
    },
    whitelistmap: {
        schema: whitelistmap
    },
    blacklistmap: {
        schema: blacklistmap
    }
};
