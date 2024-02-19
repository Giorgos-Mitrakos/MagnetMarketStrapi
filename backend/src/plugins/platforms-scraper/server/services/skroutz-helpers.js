'use strict';

const puppeteer = require('puppeteer');
const userAgent = require('user-agents');

module.exports = ({ strapi }) => ({

    convertPrice(price) {
        return strapi.plugin('platforms-scraper')
            .service('helpers')
            .convertPrice(price);
    },

    async getSkroutzCategories({ platform }) {
        const browser = await strapi
            .plugin('import-products')
            .service('helpers')
            .createBrowser()
        try {

            const categoriesList = []
            const { name, entryURL } = platform

            const agents = userAgent.random().toString()
            const page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 600 })
            await page.setUserAgent(agents);

            await page.goto(entryURL, { waitUntil: "networkidle0" });
            // const pageUrl = page.url();


            const bodyHandle = await page.$('body');
            const acceptCookiesButton = await bodyHandle.$("div.actions #accept-all")
            if (acceptCookiesButton) {
                await acceptCookiesButton.click()

                await page.waitForNavigation()
            }

            await page.$eval('div.categories>button', (element) => {
                element.scrollIntoView({ behavior: 'smooth' })
            });

            await page.waitForTimeout(strapi
                .plugin('import-products')
                .service('helpers')
                .randomWait(1000, 2000))

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
                    category.link = anchor.getAttribute("href").split("?")[0]
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

            const platforms = await strapi.entityService.findMany('api::platform.platform', {
                where: {
                    name: name
                },
                populate: {
                    platformCategories: true
                }
            })

            for (let category of platforms[0].platformCategories) {
                if (!categoriesList.includes(category.name)) {
                    await strapi.entityService.delete('plugin::platforms-scraper.platform-category', category.id)
                }
            }

            await strapi
                .plugin('platforms-scraper')
                .service('categoryHelpers')
                .updateCategoriesMerchantFee(platform);

        } catch (error) {
            console.log(error)
        }
        finally {
            await browser.close();
        }
    },

    async scrapSkroutzCategory(page, categoryLink) {
        try {
            await page.goto(categoryLink, { waitUntil: "networkidle0" });

            const bodyHandle = await page.$('body');
            const acceptCookiesButton = await bodyHandle.$("div.actions #accept-all")
            if (acceptCookiesButton) {
                await acceptCookiesButton.click()
                await page.waitForNavigation()
            }

            await page.waitForTimeout(strapi
                .plugin('import-products')
                .service('helpers')
                .randomWait(1000, 3000))

            const closeHelperButton = await page.$(".widget-header>button")
            if (closeHelperButton)
                await closeHelperButton.click()

            let productsList = []

            let scrapProductsList = await page.$eval('body', (element) => {
                const productsAnchorList = element.querySelectorAll("#sku-list>li>a")

                const products = []
                for (let anchor of productsAnchorList) {
                    const product = {}
                    product.title = anchor.getAttribute("title").trim()
                    const productLink = anchor.getAttribute("href").split("?")[0]
                    product.link = `https://www.skroutz.gr${productLink}`

                    products.push(product)

                }
                return products;
            })

            productsList = productsList.concat(scrapProductsList)

            await page.$eval('.list-controls', (element) => {
                element.scrollIntoView({ behavior: 'smooth' })
            });

            await page.waitForTimeout(strapi
                .plugin('import-products')
                .service('helpers')
                .randomWait(1000, 3000))

            // const nextArrow = await page.$(".list-controls  a>i.next-arrow")
            while (await page.$(".list-controls  a>i.next-arrow")) {
                await page.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(1500, 3000))

                const nextPageButton = await page.$(".list-controls  a>i.next-arrow")

                await nextPageButton.click();
                await page.waitForNavigation()

                let scrapProductsList = await page.$eval('body', (element) => {
                    const productsAnchorList = element.querySelectorAll("#sku-list>li>a")
                    // let liElements = navList.length

                    const products = []
                    for (let anchor of productsAnchorList) {
                        const product = {}
                        product.title = anchor.getAttribute("title").trim()
                        const productLink = anchor.getAttribute("href").split("?")[0]
                        product.link = `https://www.skroutz.gr${productLink}`

                        products.push(product)

                    }
                    return products;
                })

                productsList = productsList.concat(scrapProductsList)

            }

            console.log("productsList:", productsList, "length:", productsList.length)

            for (let product of productsList) {
                await page.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(3000, 6000))

                await this.scrapSkroutzProduct(page, product.link)
            }
        } catch (error) {
            console.log(error)
        }
    },

    async scrapSkroutzProduct(page, productLink) {
        try {
            const product = {}
            await page.goto(productLink, { waitUntil: "networkidle0" });

            const bodyHandle = await page.$('body');

            const AcceptCookiesButton = await bodyHandle.$('#accept-essential')
            if (AcceptCookiesButton) {
                AcceptCookiesButton.click()
            }

            const skuActions = await page.$('.sku-actions-wrapper');
            if (skuActions) {
                await bodyHandle.$eval('.sku-actions-wrapper', (element) => {
                    element.scrollIntoView({ behavior: 'smooth' })
                });
                // await bodyHandle.waitForSelector('a.reset-filters');
                await page.waitForTimeout(200);
                // const filterButton = await bodyHandle.$('a.reset-filters')
                // if (filterButton) { 
                //     filterButton.click()
                // }
            }

            await page.waitForTimeout(strapi
                .plugin('import-products')
                .service('helpers')
                .randomWait(1000, 2000))

            const shopsList = await page.$$('#prices>li')
            const shops = []

            // const proposedShop = await page.$('div.sold-by-info>p');

            product.proposedShop = await page.$eval('div.sold-by-info>p>button', (element) => {
                return element.textContent.trim()
            })

            await page.waitForSelector('.navigation-bar-wrapper');
            await bodyHandle.$eval('.navigation-bar-wrapper', (element) => {
                element.scrollIntoView({ behavior: 'smooth' })
            });
            await page.waitForSelector('.sku-offers');

            let scrapProductPage = await page.$eval('.scrollable', (element) => {
                product = {}
                const navbar = element.querySelector(".navigation-bar-wrapper");
                const navbarListWrapper = navbar.querySelector("nav");
                const navbarList = navbarListWrapper.querySelector(".sku-offers");
                product.numberOfShops = navbarList.querySelector(".sku-offers > a > span > span").textContent.trim();
                product.numberOfReviews = navbar.querySelector("ul>li.sku-reviews>a>span") ? element.querySelector("li.sku-reviews>a>span").textContent.replace(')', '').replace('(', '').trim() : 0;
                product.averageRating = element.querySelector(".rating-summary .rating-average>b") ? element.querySelector(".rating-summary .rating-average>b").textContent.trim() : 0;

                return product
            })

            let scrapAvarageRatingProduct = await page.$eval('.user-actions>div>div>a>div>div.actual-rating', (element) => {
                product = {}
                product.averageRating = element.textContent.trim();

                return product
            })

            product.statistics = scrapProductPage
            product.statistics.averageRating = scrapAvarageRatingProduct.averageRating


            for (let shop of shopsList) {
                const shopScrap = {}
                await shop.$eval('.shop', (element) => {
                    element.scrollIntoView({ behavior: 'smooth' })
                });
                await page.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(300, 1000))

                await shop.waitForSelector('.price-content');
                const shopName = await shop.$eval('.shop', (element) => {
                    let shopInfo = {}
                    let shopNameElement = element.querySelector('.shop-name')
                    if (shopNameElement) { shopInfo.name = shopNameElement.textContent.trim() }
                    let isProShop = element.querySelector('.pro-badge-btn')
                    if (isProShop) { shopInfo.isPro = true }
                    else { shopInfo.isPro = false }

                    return shopInfo
                });

                shopScrap.name = shopName.name
                shopScrap.isProShop = shopName.isPro

                const shopProductDescription = await shop.$eval('.description>.item', (element) => {
                    const productDescription = {}
                    let shopNameElement = element.querySelector('h3>a')
                    productDescription.name = shopNameElement.textContent.trim()
                    let shopAvailabilityElement = element.querySelector('p.availability>span')
                    if (shopAvailabilityElement)
                        productDescription.availability = shopAvailabilityElement.textContent.trim()
                    let shopExpressElement = element.querySelector('.ndd-wrapper')
                    if (shopExpressElement) {
                        productDescription.isExpressDelivery = true
                    } else { productDescription.isExpressDelivery = false }

                    return productDescription
                });

                shopScrap.productDescriptionName = shopProductDescription.name
                shopScrap.productAvailability = shopProductDescription.availability
                shopScrap.isExpressDelivery = shopProductDescription.isExpressDelivery

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

            product.shops = shops
            console.log(product)

            // // product.shops.forEach(x => {
            // //     console.log(x)
            // // })
            // console.log(product.statistics)

            // const myShop = product.shops.find(x => x.name === "Magnet Market")
            // console.log("myShop:", myShop)

            // const myShopPosition = product.shops.findIndex(x => x.name === "Magnet Market")
            // console.log("myShopPosition:", myShopPosition + 1)
            // if (myShopPosition === 0) {
            //     if (product.shops.length > 1) {
            //         console.log("SecondShop:", product.shops[1].name, "Price:", product.shops[1].shopPrices.price)
            //         console.log("Difference From Second:",
            //             this.convertPrice(product.shops[1].shopPrices.price)
            //             - this.convertPrice(myShop.shopPrices.price))
            //     }
            //     else {
            //         console.log("Μοναδικός με αυτό το Προϊόν")
            //     }
            // }
            // else {
            //     console.log("FirstShop:", product.shops[0].name, "Price:", product.shops[0].shopPrices.price)
            //     console.log("Difference From First:", this.convertPrice(myShop.shopPrices.price)
            //         - this.convertPrice(product.shops[0].shopPrices.price))
            // }

            // const marketplace = product.shops.filter(x => x.shopPrices.marketplace !== undefined)

            // // console.log("marketplace:", marketplace) 

            // const myShopInMarketplace = marketplace.findIndex(x => x.name === "Magnet Market")
            // console.log("myShopPositionInMarketplace:", myShopInMarketplace + 1)

            // if (myShopInMarketplace === 0) {
            //     if (marketplace.length > 1) {
            //         console.log("SecondShop:", marketplace[1].name, "Price:", marketplace[1].shopPrices.price)
            //         console.log("Difference From Second in Marketplace:",
            //             this.convertPrice(marketplace[1].shopPrices.price)
            //             - this.convertPrice(myShop.shopPrices.price))
            //     }
            //     else {
            //         console.log("Μοναδικός στο Marketplace")
            //     }
            // }
            // else {
            //     console.log("FirstShop:", marketplace[0].name, "Price:", marketplace[0].shopPrices.price)
            //     console.log("Difference From First in Marketplace:",
            //         this.convertPrice(myShop.shopPrices.price)
            //         - this.convertPrice(marketplace[0].shopPrices.price))
            // }

        } catch (error) {
            console.log(error)
        }
    },

});
