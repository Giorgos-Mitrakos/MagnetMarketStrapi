'use strict';

module.exports = {
  async index(ctx) {

    if (ctx.request.body.entry.name === 'Logicom') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseLogicomXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Oktabit') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService') 
        .parseOktabitXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Zegetron') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService') 
        .parseZegetronXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Globalsat') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseGlobalsat(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'dotmedia') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService') 
        .parseDotMediaOnlyXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'telehermes') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseTelehermesXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'westnet') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseWestnetXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'gerasis') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseGerasisXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'novatron') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseNovatronXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'quest') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseQuestXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'smart4all') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseSmart4AllXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'damkalidis') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseDamkalidisXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'cpi') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseCpiXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'netone') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseNetoneXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'iason') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseIasonXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name.toLowerCase() === 'allwan') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseAllwanXml(ctx.request.body);
    }
    else {
      console.log("Wrong file")
    }
  },

  async success(ctx) {

    ctx.body = await strapi
      .plugin('import-products')
      .service('getFileService')
      .fileImportSuccess(ctx.request.body);
  },
};