'use strict';

const slugify = require("slugify");
const puppeteer = require('puppeteer');
const fs = require('fs');
const { env } = require("process");

module.exports = ({ strapi }) => ({

    async scrapQuest(categoryMap, report, entry, auth) {
        try {

            let filteredCategories = {
                categories: [],
            }
            // const browser = await puppeteer.launch()
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            const page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 600 })
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            if (fs.existsSync('./public/QuestCookies.json')) {
                fs.readFile('./public/QuestCookies.json', async (err, data) => {
                    if (err)
                        console.log(err);
                    else {
                        const cookies = JSON.parse(data);
                        await page.setCookie(...cookies);
                        console.log("File readen successfully\n");
                    }
                })
            }

            await page.goto('https://www.questonline.gr', { waitUntil: "networkidle0" });
            const pageUrl = page.url();
            await page.waitForTimeout(1500)

            if (pageUrl === "https://www.questonline.gr/Special-Pages/Logon?ReturnUrl=%2f") {
                const bodyHandle = await page.$('body');

                const acceptCookiesForm = await page.$('#CybotCookiebotDialog')
                if (acceptCookiesForm) {
                    const acceptCookiesButton = await page.$('#CybotCookiebotDialogBodyButtonAccept')
                    acceptCookiesButton.click();
                }

                const formHandle = await bodyHandle.$('form');

                const usernameWrapper = await formHandle.$('#username');
                const username = await usernameWrapper.$('input');
                const passwordWrapper = await formHandle.$('#password');
                const password = await passwordWrapper.$('input');
                const button = await formHandle.$('#submit-button');
                await username.type(process.env.QUEST_USERNAME)
                await password.type(process.env.QUEST_PASSWORD)
                await Promise.all([
                    await button.click(),
                    await page.waitForNavigation()
                ])
                await page.cookies()
                    .then((cookies) => {
                        const cookiesJson = JSON.stringify(cookies, null, 2)
                        return cookiesJson
                    })
                    .then((cookiesJson) => {
                        fs.writeFile('./public/QuestCookies.json', cookiesJson, (err) => {
                            if (err)
                                console.log(err);
                            else {
                                console.log("File written successfully\n");
                            }
                        })
                    })
                    .catch((error) => console.log(error))
            }

            const bodyHandle = await page.$('body');
            const navListWrapper = await page.$("div.nav-2-wrapper")
            let scrapCategories = await page.$eval('div.nav-2-wrapper', (element) => {
                const navList = element.querySelectorAll(".nav-2")
                // let liElements = navList.length

                const categories = []
                for (let ul of navList) {
                    let categoriesList = ul.querySelectorAll("li");

                    for (let li of categoriesList) {
                        let category = {}
                        const categoryAnchor = li.querySelector('a')
                        const categoryTitleSpan = li.querySelector('span')
                        category.title = categoryTitleSpan.textContent.trim()
                        category.link = categoryAnchor.getAttribute("href")
                        category.subCategories = []
                        categories.push(category)
                    }
                }
                return categories;
            })

            // filteredCategories.categories = scrapCategories

            let newCategories = await strapi
                .plugin('import-products')
                .service('helpers')
                .filterCategories(scrapCategories, categoryMap.isWhitelistSelected, categoryMap.whitelist_map, categoryMap.blacklist_map)

            filteredCategories.categories = newCategories
            // console.log(newCategories)
            const charMaps = await strapi
                .plugin('import-products')
                .service('helpers')
                .parseCharsToMap(categoryMap.char_name_map, categoryMap.char_value_map);

            for (let category of newCategories) {
                await this.scrapQuestSubcategories(page, category, filteredCategories, categoryMap, report, entry, auth);
                // filteredCategories.categories = await this.filterCategories(filteredCategories.categories, categoryMap.isWhitelistSelected, categoryMap.whitelist_map, categoryMap.blacklist_map)
            }


            // let scrapCategory = await this.scrapNovatronCategory(newCategories, page, categoryMap, charMaps, report, entry, auth)
            await browser.close();
        } catch (error) {
            console.log(error)
        }
    },

    async scrapQuestSubcategories(page, category, filteredCategories, categoryMap, report, entry, auth) {
        try {
            await page.goto(`https://www.questonline.gr${category.link}`, { waitUntil: "networkidle0" });
            const scrapSub = await page.$eval('.side-menu', (element) => {
                const subList = element.querySelector('ul')
                const subcategoriesList = subList.querySelectorAll('li')

                const subcategories = []
                for (let sub of subcategoriesList) {
                    let subcategory = {}
                    const subcategoryAnchor = sub.querySelector('a')
                    subcategory.title = subcategoryAnchor.textContent.trim()
                    subcategory.link = subcategoryAnchor.getAttribute('href')
                    subcategory.subCategories = []
                    subcategories.push(subcategory)
                }
                return subcategories
            })

            const catIndex = filteredCategories.categories.findIndex(x => x.title === category.title)
            filteredCategories.categories[catIndex].subCategories = scrapSub
            filteredCategories.categories = await strapi
                .plugin('import-products')
                .service('helpers')
                .filterCategories(filteredCategories.categories, categoryMap.isWhitelistSelected, categoryMap.whitelist_map, categoryMap.blacklist_map)

            for (let sub of filteredCategories.categories[catIndex].subCategories) {
                await this.scrapQuestSubcategories2(page, category.title, sub, filteredCategories, categoryMap, report, entry, auth)
            }
        } catch (error) {
            console.log(error)
        }
    },

    async scrapQuestSubcategories2(page, category, subcategory, filteredCategories, categoryMap, report, entry, auth) {
        try {
            await page.goto(`https://www.questonline.gr${subcategory.link}`, { waitUntil: "networkidle0" });
            const sideMenu = await page.$('.side-menu')

            const catIndex = filteredCategories.categories.findIndex(x => x.title === category)
            const subIndex = filteredCategories.categories[catIndex].subCategories.findIndex(x => x.title === subcategory.title)

            if (sideMenu) {
                const scrapSub = await page.$eval('.side-menu', (element) => {
                    const subList = element.querySelector('ul')
                    const subcategoriesList = subList.querySelectorAll('li')

                    const subcategories = []
                    for (let sub of subcategoriesList) {
                        let subcategory = {}
                        const subcategoryAnchor = sub.querySelector('a')
                        subcategory.title = subcategoryAnchor.textContent.trim()
                        subcategory.link = subcategoryAnchor.getAttribute('href')
                        subcategory.subCategories = []
                        subcategories.push(subcategory)
                    }
                    return subcategories
                })


                filteredCategories.categories[catIndex].subCategories[subIndex].subCategories = scrapSub
                filteredCategories.categories = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .filterCategories(filteredCategories.categories, categoryMap.isWhitelistSelected, categoryMap.whitelist_map, categoryMap.blacklist_map)

                for (let sub2 of filteredCategories.categories[catIndex].subCategories[subIndex].subCategories) {
                    await this.scrapQuestCategory(page, sub2.link, category, subcategory.title, sub2.title, categoryMap, report, entry, auth)
                    await page.waitForTimeout(1000);
                }
            }
            else {
                await this.scrapQuestCategory(page, subcategory.link, category, subcategory.title, null, categoryMap, report, entry, auth)
            }

        } catch (error) {
            console.log(error)
        }
    },

    async scrapQuestCategory(page, link, category, subcategory, sub2category, categoryMap, report, entry, auth) {
        try {
            await page.goto(`https://www.questonline.gr${link}?pagesize=300&skuavailableindays=1`, { waitUntil: "networkidle0" });

            const scrapProducts = await page.$eval('div.region-area-three>div.inner-area.inner-area-three', (element) => {
                const productListWrapper = element.querySelector('div.box>ul.product-list')
                const productList = productListWrapper.querySelectorAll('li>article>div.description-container')

                const products = []
                for (let prod of productList) {
                    let product = {}
                    const leftContainer = prod.querySelector('div.description-container-left')
                    const titleWrapper = leftContainer.querySelector('header.title-container>h2.title>a')
                    product.title = titleWrapper.textContent.trim()
                    product.link = titleWrapper.getAttribute('href')
                    product.supplierCode = leftContainer.querySelector('.product-code').textContent.split('.')[1].trim();

                    const inOffer = leftContainer.querySelector('.offer')
                    if (inOffer) {
                        const discount = leftContainer.querySelector('.discount>span').textContent.replace("%", "").replace("-", "")
                        product.in_offer = true
                        product.discount = discount
                    } else {
                        product.in_offer = false
                        product.discount = 0
                    }

                    const rightContainer = prod.querySelector('.description-container-right')
                    const productAvailability = rightContainer.querySelector('div.availability>span').textContent.trim()
                    const priceWrapper = rightContainer.querySelector('.price-container')
                    product.price = priceWrapper.querySelector('.final-price').textContent.replace('€', '').replace(',', '.').trim()

                    product.stockLevel = productAvailability
                    products.push(product)
                }
                return products
            })

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .updateAndFilterScrapProducts(scrapProducts, categoryMap, category, subcategory, sub2category, report, entry)

            // console.log(products)
            for (let product of products) {
                // if (stockLevelFilter.includes(product.stockLevel)) {
                //     console.log(product)
                await this.scrapQuestProduct(page, product.link, category, subcategory, sub2category, categoryMap, report, entry, auth)
                // }
            }

        } catch (error) {
            console.log(error)
        }
    },

    async scrapQuestProduct(page, productLink, category, subcategory, sub2category, categoryMap, report, entry, auth) {
        try {
            await page.goto(`https://www.questonline.gr${productLink}`, { waitUntil: "networkidle0" });

            const scrapProduct = await page.$eval('.details-page', (scrap) => {
                const product = {}

                const element = scrap.querySelector('div.content-container div.region-area-two')
                const titleWrapper = element.querySelector('div.content-container div.region-area-two .inner-area-one .title')
                product.title = titleWrapper.textContent.trim();
                const supplierCodeWrapper = element.querySelector('#SkuNumber')
                product.supplierCode = supplierCodeWrapper.textContent.split('.')[1].trim();

                const inOffer = element.querySelector('.offer')
                if (inOffer) {
                    const discount = element.querySelector('.discount>span').textContent.replace("%", "").replace("-", "")
                    product.in_offer = true
                    product.discount = discount
                } else {
                    product.in_offer = false
                    product.discount = 0
                }

                const imageWrapper = element.querySelectorAll('.box-two .thumbnails li img')
                product.imagesSrc = []
                for (let imgSrc of imageWrapper) {
                    const src = imgSrc.getAttribute('src').split('?')[0]
                    // const imageLink = src.startsWith('/') ? `https://www.questonline.gr${src}` : src;
                    if (src.startsWith('/'))
                        product.imagesSrc.push(`https://www.questonline.gr${src}`)
                }

                const priceWrapper = element.querySelector('.box-three')
                product.deletedPrice = priceWrapper.querySelector('.deleted-price')?.textContent.replace('€', '').replace(',', '.').trim()
                product.price = priceWrapper.querySelector('.final-price').textContent.replace('€', '').replace(',', '.').trim()

                product.stockLevel = priceWrapper.querySelector('#realAvail').textContent.trim()

                const tabsWrapper = scrap.querySelector('.tabs-content .technical-charact')

                const liWrappers = tabsWrapper.querySelectorAll('li')

                const prod_chars = []
                for (let i = 0; i < liWrappers.length; i += 2) {
                    prod_chars.push({
                        name: liWrappers[i].querySelector('span').textContent.trim(),
                        value: liWrappers[i + 1].querySelector('span').textContent.trim(),
                    })
                }

                product.prod_chars = prod_chars

                return product
            })

            await this.importQuestProduct(scrapProduct, `https://www.questonline.gr${productLink}`, category, subcategory, sub2category,
                categoryMap, report, entry, auth)

        } catch (error) {
            console.log(error)
        }
    },

    async importQuestProduct(product, productLink, category, subcategory, sub2category,
        categoryMap, report, entry, auth) {
        console.log("category:", category, "subcategory:", subcategory, "sub2category:", sub2category)
        try {
            let stockLevelFilter = []
            for (let stock of categoryMap.stock_map) {
                stockLevelFilter.push(stock.name)
            }

            if (!stockLevelFilter.includes(product.stockLevel)) {
                return
            }

            let minPrice = categoryMap.minimumPrice ? categoryMap.minimumPrice : 0;
            let maxPrice;
            if (categoryMap.maximumPrice && categoryMap.maximumPrice > 0) {
                maxPrice = categoryMap.maximumPrice;
            }
            else {
                maxPrice = 100000;
            }

            let mpn = product.prod_chars.find(x => x.name === "Part Number").value;
            let barcode = product.prod_chars.find(x => x.name === "EAN Number").value;

            let price = product.price;
            let salePrice = product.deletedPrice ? product.deletedPrice : "";

            if (price < minPrice || price > maxPrice) {
                return
            }

            console.log("price:", price, "salePrice:", salePrice)
            const entryCheck = await strapi
                .plugin('import-products')
                .service('helpers')
                .checkIfProductExists(mpn);

            let brandName = product.prod_chars.find(x => x.name === "Κατασκευαστής")?.value;

            const brandId = await strapi
                .plugin('import-products')
                .service('helpers')
                .brandIdCheck(brandName, product);

            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await strapi
                .plugin('import-products')
                .service('helpers')
                .getCategory(categoryMap.categories_map, product.title, category, subcategory, sub2category);

            console.log("categoryInfo:", categoryInfo, "brandId:", brandId)

            if (!entryCheck) {
                try {
                    const charMaps = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .parseCharsToMap(categoryMap.char_name_map, categoryMap.char_value_map);
                    //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
                    const { mapCharNames, mapCharValues } = charMaps
                    const parsedChars = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .parseChars(product.prod_chars, mapCharNames, mapCharValues)

                    let imageUrls = []
                    for (let imageUrl of product.imagesSrc) {
                        imageUrls.push({ url: imageUrl })
                    }

                    const price_progress = []
                    price_progress.push({
                        date: new Date(),
                        price: price,
                        in_offer: product.in_offer, 
                        discount: product.discount
                    })

                    const supplierInfo = [{
                        name: entry.name,
                        wholesale: parseFloat(price).toFixed(2),
                        supplierProductId: product.supplierCode,
                        // sale_price: parseFloat(salePrice).toFixed(2),
                        supplierProductURL: productLink,
                        in_offer: product.in_offer,
                        price_progress: price_progress
                    }]

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPrice(product, supplierInfo, categoryInfo, brandId);


                    const data = {
                        name: product.title,
                        // short_description: product.productMiniDescription,
                        // description: product.productDescription,
                        category: categoryInfo.id,
                        price: parseFloat(productPrice).toFixed(2),
                        mpn: mpn ? mpn : null,
                        barcode: barcode ? barcode : null,
                        slug: slugify(`${product.title}-${mpn}`, { lower: true, remove: /[*+~=#.,±°;_()/'"!:@]/g }),
                        publishedAt: new Date(),
                        status: "InStock",
                        brand: { id: brandId },
                        related_import: entry.id,
                        supplierInfo: supplierInfo,
                        prod_chars: parsedChars,
                        ImageURLS: imageUrls,
                    }

                    const newEntry = await strapi.entityService.create('api::product.product', {
                        data: data,
                    });

                    report.related_entries.push(newEntry.id)
                    report.created += 1;
                    console.log("Created:", report.created)

                    //Κατεβάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
                    let responseImage = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .getAndConvertImgToWep(product.imagesSrc, data, newEntry.id, auth);

                    // //Δημιουργώ αυτόματα το SEO για το προϊόν
                    await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .saveSEO(responseImage.mainImageID.data[0], data, newEntry.id);

                } catch (error) { 
                    console.log(error)
                }
            }
            else {
                try {
                    report.related_entries.push(entryCheck.id)

                    const supplierInfo = [] //entryCheck.supplierInfo
                    const relatedImport = entryCheck.related_import;
                    const relatedImportId = []
                    relatedImport.forEach(x => {
                        relatedImportId.push(x.id)
                    })
                    relatedImportId.push(entry.id)
                    let searchSupplierInfo = supplierInfo.find((o, i) => {
                        if (o.name === entry.name) {
                            const price_progress = o.price_progress;
                            price_progress.push({
                                date: new Date(),
                                price: product.price,
                                in_offer: product.in_offer,
                                discount: product.discount
                            })

                            supplierInfo[i] = {
                                name: entry.name,
                                wholesale: parseFloat(price).toFixed(2),
                                supplierProductId: product.supplierCode,
                                // price: parseFloat(salePrice).toFixed(2),
                                supplierProductURL: productLink,
                                in_offer: product.in_offer,
                                price_progress: price_progress
                            }
                            return true;
                        }
                    })

                    if (!searchSupplierInfo) {
                        supplierInfo.push({
                            name: entry.name,
                            wholesale: parseFloat(price).toFixed(2),
                            supplierProductId: product.supplierCode,
                            // price: parseFloat(salePrice).toFixed(2),
                            supplierProductURL: productLink,
                            in_offer: product.in_offer,
                            price_progress: [{
                                date: new Date(),
                                price: product.price,
                                in_offer: product.in_offer,
                                discount: product.discount
                            }]
                        })
                    }

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPrice(entryCheck, supplierInfo, categoryInfo, brandId);

                    await strapi.entityService.update('api::product.product', entryCheck.id, {
                        data: {
                            name: product.productTitle,
                            categories: categoryInfo.id,
                            price: parseFloat(productPrice),
                            supplierInfo: supplierInfo,
                            related_import: relatedImportId,
                        },
                    });
                    report.updated += 1
                    console.log("Updated:", report.updated)
                } catch (error) {
                    console.log(error)
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

});