'use strict';

const puppeteer = require('puppeteer');
const xlsx = require('xlsx')

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
    try {
      await this.updatePlatformCategories(platform)

      const categoriesToScrap = platform.platformCategories.filter(category => category.isChecked === true)

      // const browser = await puppeteer.launch()
      const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 600 })
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

      if (platform.name === "Skroutz") {
        for (let category of categoriesToScrap) {
          await strapi
            .plugin('platforms-scraper')
            .service('skroutzHelpers')
            .scrapSkroutzCategory(page, category.link);
        }
      }

      await browser.close();
    } catch (error) {
      console.log(error)
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
