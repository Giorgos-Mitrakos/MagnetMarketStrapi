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
        .parseDotMedia(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Westnet') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseWestnetXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Gerasis') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseGerasisXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Novatron') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseNovatronXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'QUEST') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseQuestXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Damkalidis') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseDamkalidisXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Shopflix') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseShopflixXml(ctx.request.body);
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