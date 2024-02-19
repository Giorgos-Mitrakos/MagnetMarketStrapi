'use strict';

const puppeteer = require('puppeteer');
const xlsx = require('xlsx')
const userAgent = require('user-agents');

module.exports = ({ strapi }) => ({
  async getPlatforms() { 
    const platforms = await strapi.db.query('api::platform.platform').findMany({
      populate: {
        platformCategories: true,
        merchantFeeCatalogue: true
      }
    })
    return platforms;
  },

  async scrapPlatformCategories({ platform }) {
    const browser = await strapi
            .plugin('import-products')
            .service('helpers')
            .createBrowser()
    try {
      await this.updatePlatformCategories(platform)

      const categoriesToScrap = platform.platformCategories.filter(category => category.isChecked === true)

      const agents = userAgent.random().toString()
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 600 })
      await page.setUserAgent(agents);

      if (platform.name === "Skroutz") {
        for (let category of categoriesToScrap) {
          await strapi
            .plugin('platforms-scraper')
            .service('skroutzHelpers')
            .scrapSkroutzCategory(page, category.link);
        }
      }

      
    } catch (error) {
      console.log(error)
    }
    finally{
      await browser.close();
    }
  },

  async updatePlatformCategories(platform) {
    try {
      for (let category of platform.platformCategories) {
        await strapi.entityService.update('plugin::platforms-scraper.platform-category', category.id,
          {
            data: {
              isChecked: category.isChecked ? category.isChecked : false,
            }
          })
      }
    } catch (error) {
      console.log(error)
    }
  },

  async updateCategoriesMerchantFee({ name }) {
    try {
      const platform = await strapi.db.query('api::platform.platform').findOne({
        where: { name: name },
        populate: {
          categories: true,
          merchantFeeCatalogue: true
        }
      })

      if (!platform.merchantFeeCatalogue)
        return

      const wb = xlsx.readFile(`./public${platform.merchantFeeCatalogue.url}`)
      const ws = wb.Sheets['Τιμοκατάλογος προμηθειών']
      const data = xlsx.utils.sheet_to_json(ws)

      for (let category of platform.categories) {
        const filteredCategories = data.filter(x => x['Κατηγορία'] === category.name)
        const filteredCategory = filteredCategories[0]
        console.log(filteredCategory)
        console.log(filteredCategory['Προμήθεια Marketplace (%)'],
          filteredCategory['Προμήθεια CPS (%)'])

        const updatedCategory = await strapi.db.query('plugin::platforms-scraper.platform-category').update({
          where: { name: category.name },
          data: {
            marketPlaceFee: parseFloat(filteredCategory['Προμήθεια Marketplace (%)']),
            cpsFee: filteredCategory['Προμήθεια CPS (%)'] === "-" ? null : parseFloat(filteredCategory['Προμήθεια CPS (%)'])
          },
        });

        console.log(updatedCategory)
      }
      // console.log(filteredData.length)
    } catch (error) {
      console.log(error)
    }
  },
});
