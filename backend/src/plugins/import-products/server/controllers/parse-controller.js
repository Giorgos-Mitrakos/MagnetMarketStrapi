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
        .parseOktabitXlsx(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Globalsat') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseGlobalsatXlsx(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'Westnet') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseWestnetXml(ctx.request.body);
    }
    else if (ctx.request.body.entry.name === 'GERASIS') {
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
    else if (ctx.request.body.entry.name === 'Damkalidis') {
      ctx.body = await strapi
        .plugin('import-products')
        .service('parseService')
        .parseDamkalidisXml(ctx.request.body);
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