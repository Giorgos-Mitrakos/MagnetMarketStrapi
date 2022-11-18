'use strict';

const getFileService = require('./get-file-to-import');
const parseService = require('./parse-xml-service');
const helpers = require('./helpers');
const mapping = require('./mapping');

module.exports = {
  getFileService,
  parseService,
  helpers,
  mapping,
};

