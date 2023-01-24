'use strict';

const puppeteer = require('puppeteer');

module.exports = ({ strapi }) => ({

    convertPrice(price) {
        return strapi.plugin('platforms-scraper')
            .service('helpers')
            .convertPrice(price);
    },

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
                    category.numberOfProducts = anchor.querySelector('small').textContent.replace('(', '').replace(')', '').trim()

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
                            numberOfProducts: category.numberOfProducts,
                            platform: platform.id
                        },
                    });
                }
                else {
                    await strapi.db.query('plugin::platforms-scraper.platform-category').update({
                        where: { name: category.title },
                        data: {
                            name: category.title,
                            link: `https://www.skroutz.gr${category.link}`,
                            numberOfProducts: category.numberOfProducts,
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

            await strapi
                .plugin('platforms-scraper')
                .service('categoryHelpers')
                .updateCategoriesMerchantFee(platform);

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
            // console.log("productsList:", productsList, "length:", productsList.length)


        } catch (error) {
            console.log(error)
        }
    },

    async scrapSkroutzProduct(page, productLink) {
        try {
            const product = {}
            await page.goto(productLink, { waitUntil: "networkidle0" });

            const bodyHandle = await page.$('body');
            const skuActions = await page.$('.sku-actions-wrapper');
            if (skuActions) {
                await bodyHandle.$eval('.sku-actions-wrapper', (element) => {
                    element.scrollIntoView({ behavior: 'smooth' })
                });
                // await bodyHandle.waitForSelector('a.reset-filters');
                await page.waitForTimeout(200);
            }

            const filterButton = await bodyHandle.$('a.reset-filters')
            if (filterButton) {
                filterButton.click()
            }

            await page.waitForTimeout(1500);

            const shopsList = await bodyHandle.$$('#prices>li')
            const shops = []
            for (let shop of shopsList) {
                const shopScrap = {}
                await shop.$eval('.shop', (element) => {
                    element.scrollIntoView({ behavior: 'smooth' })
                });
                await shop.waitForSelector('.price-content');
                const shopName = await shop.$eval('.shop', (element) => {
                    let shopNameElement = element.querySelector('.shop-name')
                    if (shopNameElement) { return shopNameElement.textContent.trim() }
                });

                shopScrap.name = shopName

                const shopProductName = await shop.$eval('.description h3 a', (element) => {
                    // let shopNameElement = element.querySelector('.shop-name')
                    return element.textContent.trim()
                });

                shopScrap.productDescription = shopProductName

                const shopPrices = await shop.$eval('.price-content', (element) => {
                    const priceContent = {}
                    const priceElement = element.querySelector('.dominant-price')
                    priceContent.price = priceElement.textContent.replace('€', '').trim()

                    const ecommerceWrapper = element.querySelector('.price-content-ecommerce')
                    if (ecommerceWrapper) {
                        const ecommerceCosts = {}
                        const ecommerceCostsElement = ecommerceWrapper.querySelectorAll('.extra-cost')
                        for (let costs of ecommerceCostsElement) {
                            const name = costs.querySelector('span').textContent.trim()
                            const value = costs.querySelector('em').textContent.replace('€', '').replace('+', '').trim()

                            if (name === 'Μεταφορικά') {
                                ecommerceCosts.shipping = value
                            }
                            else if (name === 'Σύνολο') {
                                ecommerceCosts.total = value
                            }
                        }

                        priceContent.marketplace = ecommerceCosts
                    }

                    const shopWrapper = element.querySelector('.price-content-shop')
                    if (shopWrapper) {
                        const shopCosts = {}
                        const shopCostsElement = shopWrapper.querySelectorAll('.extra-cost')
                        for (let costs of shopCostsElement) {
                            const name = costs.querySelector('span').textContent.trim()
                            const value = costs.querySelector('em').textContent.replace('€', '').replace('+', '').trim()

                            if (name === 'Μεταφορικά') {
                                shopCosts.shipping = value
                            }
                            else if (name === 'Σύνολο') {
                                shopCosts.total = value
                            }
                        }

                        priceContent.shop = shopCosts
                    }

                    return priceContent
                });

                shopScrap.shopPrices = shopPrices
                shops.push(shopScrap)
            }

            let scrapProductPage = await page.$eval('.scrollable', (element) => {
                product = {}
                product.numberOfShops = element.querySelector(".sku-offers>a>span>span").textContent.trim();
                product.numberOfReviews = element.querySelector(".sku-reviews>a>span") ? element.querySelector(".sku-reviews>a>span").textContent.replace(')', '').replace('(', '').trim() : 0;
                product.averageRating = element.querySelector(".rating-summary .rating-average>b") ? element.querySelector(".rating-summary .rating-average>b").textContent.trim() : 0;

                return product
            })

            product.statistics = scrapProductPage
            product.shops = shops


            // product.shops.forEach(x => {
            //     console.log(x)
            // })
            console.log(product.statistics)

            const myShop = product.shops.find(x => x.name === "Magnet Market")
            console.log("myShop:", myShop)

            const myShopPosition = product.shops.findIndex(x => x.name === "Magnet Market")
            console.log("myShopPosition:", myShopPosition + 1)
            if (myShopPosition === 0) {
                if (product.shops.length > 1) {
                    console.log("SecondShop:", product.shops[1].name, "Price:", product.shops[1].shopPrices.price)
                    console.log("Difference From Second:",
                        this.convertPrice(product.shops[1].shopPrices.price)
                        - this.convertPrice(myShop.shopPrices.price))
                }
                else{
                    console.log("Μοναδικός με αυτό το Προϊόν")
                }
            }
            else {
                console.log("FirstShop:", product.shops[0].name, "Price:", product.shops[0].shopPrices.price)
                console.log("Difference From First:", this.convertPrice(myShop.shopPrices.price)
                    - this.convertPrice(product.shops[0].shopPrices.price))
            }

            const marketplace = product.shops.filter(x => x.shopPrices.marketplace !== undefined)

            // console.log("marketplace:", marketplace) 

            const myShopInMarketplace = marketplace.findIndex(x => x.name === "Magnet Market")
            console.log("myShopPositionInMarketplace:", myShopInMarketplace + 1)

            if (myShopInMarketplace === 0) {
                if (marketplace.length > 1) {
                    console.log("SecondShop:", marketplace[1].name, "Price:", marketplace[1].shopPrices.price)
                    console.log("Difference From Second in Marketplace:",
                        this.convertPrice(marketplace[1].shopPrices.price)
                        - this.convertPrice(myShop.shopPrices.price))
                }
                else {
                    console.log("Μοναδικός στο Marketplace")
                }
            }
            else {
                console.log("FirstShop:", marketplace[0].name, "Price:", marketplace[0].shopPrices.price)
                console.log("Difference From First in Marketplace:",
                    this.convertPrice(myShop.shopPrices.price)
                    - this.convertPrice(marketplace[0].shopPrices.price))
            }

        } catch (error) {
            console.log(error)
        }
    },

});
