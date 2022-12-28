'use strict';

const puppeteer = require('puppeteer');

module.exports = ({ strapi }) => ({


    async getSkroutzCategories({ platform }) {
        try {

            const categoriesList = []
            const { name, entryURL } = platform
            // const browser = await puppeteer.launch()
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            const page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 600 })
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            await page.goto(entryURL, { waitUntil: "networkidle0" });
            // const pageUrl = page.url();


            const bodyHandle = await page.$('body');
            const acceptCookiesButton = await bodyHandle.$("div.actions #accept-all")
            await acceptCookiesButton.click()

            await page.waitForNavigation()

            const allCategoriesButton = await page.$("div.categories>button")
            await allCategoriesButton.click()


            await page.waitForSelector('.all-categories-list a', { visible: true })
            let scrapCategories = await page.$eval('.all-categories-list', (element) => {
                const categoriesAnchor = element.querySelectorAll("a")
                // let liElements = navList.length

                const categories = []
                for (let anchor of categoriesAnchor) {
                    const category = {}
                    category.title = anchor.getAttribute("title").trim()
                    category.link = anchor.getAttribute("href")

                    categories.push(category)

                }
                return categories;
            })

            for (let category of scrapCategories) {

                categoriesList.push(category.title)
                const checkIfCategoryExists = await strapi.db.query('plugin::platforms-scraper.platform-category').findOne({
                    where: { name: category.title },
                });

                if (!checkIfCategoryExists) {
                    await strapi.entityService.create('plugin::platforms-scraper.platform-category', {
                        data: {
                            name: category.title,
                            link: `https://www.skroutz.gr${category.link}`,
                            platform: platform.id
                        },
                    });
                }
            }

            const platforms = await strapi.entityService.findMany('plugin::platforms-scraper.platform', {
                where: {
                    name: name
                },
                populate: {
                    categories: true
                }
            })

            for (let category of platforms[0].categories) {
                if (!categoriesList.includes(category.name)) {
                    await strapi.entityService.delete('plugin::platforms-scraper.platform-category', category.id)
                }
            }
            await browser.close();
        } catch (error) {
            console.log(error)
        }
    },


    async scrapSkroutzCategory(page, categoryLink) {
        try {
            await page.goto(categoryLink, { waitUntil: "networkidle0" });
            // // const pageUrl = page.url();

            const bodyHandle = await page.$('body');
            // 
            let productsList = []

            let scrapProductsList = await bodyHandle.$eval('#sku-list', (element) => {
                const productsAnchorList = element.querySelectorAll("li>a")
                // let liElements = navList.length

                const products = []
                for (let anchor of productsAnchorList) {
                    const product = {}
                    product.title = anchor.getAttribute("title").trim()
                    const productLink = anchor.getAttribute("href")
                    product.link = `https://www.skroutz.gr${productLink}`

                    products.push(product)

                }
                return products;
            })

            productsList = productsList.concat(scrapProductsList)

            while (await bodyHandle.$(".list-controls .paginator>li>a>.next-arrow")) {
                const nextPageButton = await bodyHandle.$(".list-controls .paginator>li>a>.next-arrow")

                await nextPageButton.click();
                await page.waitForNavigation()

                let scrapProductsList = await bodyHandle.$eval('#sku-list', (element) => {
                    const productsAnchorList = element.querySelectorAll("li>a")
                    // let liElements = navList.length

                    const products = []
                    for (let anchor of productsAnchorList) {
                        const product = {}
                        product.title = anchor.getAttribute("title").trim()
                        const productLink = anchor.getAttribute("href")
                        product.link = `https://www.skroutz.gr${productLink}`

                        products.push(product)

                    }
                    return products;
                })

                productsList = productsList.concat(scrapProductsList)

            }

            for (let product of productsList) {
                await this.scrapSkroutzProduct(page, product.link)
            }
            console.log("productsList:", productsList, "length:", productsList.length)


        } catch (error) {
            console.log(error)
        }
    },

    async scrapSkroutzProduct(page, productLink) {
        try {
            await page.goto(productLink, { waitUntil: "networkidle0" });
            // // const pageUrl = page.url();


            const bodyHandle = await page.$('body');
            const filterButton = await bodyHandle.$('.reset-filters')
            if(filterButton)
            {
                filterButton.click()
            }

            await page.waitForTimeout(3000); 
            let scrapShops = await page.$eval('#prices', (element) => {
                const shopsList = element.querySelectorAll("li")
            })
            //giampouras na parw

            // await page.waitForRespone() 
            // const commerceToggle =await page.waitForSelector('#ecommerce-toggle')
            // //         // async () => {
 
            // console.log(commerceToggle)
            // await commerceToggle.click()
            // commerceToggle.click() 
            //     )

            // // 
            // let productsList = []

            // let scrapProductsList = await bodyHandle.$eval('#sku-list', (element) => {
            //   const productsAnchorList = element.querySelectorAll("li>a")
            //   // let liElements = navList.length

            //   const products = []
            //   for (let anchor of productsAnchorList) {
            //     const product = {}
            //     product.title = anchor.getAttribute("title").trim()
            //     const productLink = anchor.getAttribute("href")
            //     product.link = `https://www.skroutz.gr${productLink}`

            //     products.push(product)

            //   }
            //   return products;
            // })

            // productsList = productsList.concat(scrapProductsList)

            // while (await bodyHandle.$(".list-controls .paginator>li>a>.next-arrow")) {
            //   const nextPageButton = await bodyHandle.$(".list-controls .paginator>li>a>.next-arrow")

            //   await nextPageButton.click();
            //   await page.waitForNavigation()

            //   let scrapProductsList = await bodyHandle.$eval('#sku-list', (element) => {
            //     const productsAnchorList = element.querySelectorAll("li>a")
            //     // let liElements = navList.length

            //     const products = []
            //     for (let anchor of productsAnchorList) {
            //       const product = {}
            //       product.title = anchor.getAttribute("title").trim()
            //       const productLink = anchor.getAttribute("href")
            //       product.link = `https://www.skroutz.gr${productLink}`

            //       products.push(product)

            //     }
            //     return products;
            //   })

            //   productsList = productsList.concat(scrapProductsList)

            // }

            // for(let product of productsList){

            // }
            // console.log("productsList:", productsList, "length:", productsList.length)

        } catch (error) {
            console.log(error)
        }
    },

});
