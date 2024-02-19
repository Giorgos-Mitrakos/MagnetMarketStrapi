'use strict';

const getFileService = require('./get-file-to-import');
const parseService = require('./parse-xml-service');
const helpers = require('./helpers');
const mapping = require('./mapping');
const oktabitHelper = require('./oktabit-helper');
const gerasisHelper = require('./gerasis-helper');
const logicomHelper = require('./logicom-helper');
const zegetronHelper = require('./zegetron-helper');
const novatronHelper = require('./novatron-helper');
const questHelper = require('./quest-helper');
const globalsatHelper = require('./globalsat-helper');
const westnetHelper = require('./westnet-helper');
const dotMediaHelper = require('./dotMedia-helper');
const telehermesHelper = require('./telehermes-helper');
const smart4allHelper = require('./smart4all-helper');
const cpiHelper = require('./cpi-helper');
const allwanHelper = require('./allwan-helper');
const damkalidisHelper = require('./damkalidis-helper');
const netoneHelper = require('./netone-helper');
const iasonHelper = require('./iason-helper');
const aciHelper = require('./aci-helper');
const imageHelper = require('./image-helper');

module.exports = {
  getFileService,
  parseService,
  helpers, 
  mapping,
  oktabitHelper,
  gerasisHelper,
  logicomHelper,
  zegetronHelper,
  novatronHelper,
  questHelper,
  globalsatHelper,
  westnetHelper,
  dotMediaHelper,
  telehermesHelper,
  smart4allHelper,
  cpiHelper,
  allwanHelper,
  damkalidisHelper,
  netoneHelper,
  iasonHelper,
  aciHelper,
  imageHelper,
};

