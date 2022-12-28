'use strict';

const puppeteer = require('puppeteer');

module.exports = ({ strapi }) => ({
  async getPlatforms() {
    const platforms = await strapi.entityService.findMany('plugin::platforms-scraper.platform', {
      populate: {
        categories: true
      }
    })
    return platforms;
  },

  async scrapPlatformCategories({ platform }) {
    try {
      await this.updatePlatformCategories(platform)

      const categoriesToScrap = platform.categories.filter(category => category.isChecked === true)

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
      for (let category of platform.categories) {
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
  }
});
