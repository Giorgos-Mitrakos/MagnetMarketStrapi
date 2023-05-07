'use strict';

const slugify = require("slugify");
const puppeteer = require('puppeteer');
const fs = require('fs');
const { env } = require("process");

module.exports = ({ strapi }) => ({

    async scrapQuest(importRef, entry, auth) {
        // const browser = await puppeteer.launch({
        //     headless: false,
        //     args: ['--no-sandbox', '--disable-setuid-sandbox']
        // })
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        try {

            let filteredCategories = {
                categories: [],
            }

            const page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 600 })
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            await page.setRequestInterception(true)

            page.on('request', (request) => {
                if (request.resourceType() === 'image') request.abort()
                else request.continue()
            })

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

            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => page.goto('https://www.questonline.gr', { waitUntil: "networkidle0" }),
                    5, // retry this 5 times,
                    false
                );

            // await page.goto('https://www.questonline.gr', { waitUntil: "networkidle0" });
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
                .filterCategories(scrapCategories, importRef.categoryMap.isWhitelistSelected, importRef.categoryMap.whitelist_map, importRef.categoryMap.blacklist_map)

            filteredCategories.categories = newCategories
            // console.log(newCategories)

            for (let category of newCategories) {

                await page.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(5000, 10000))

                await this.scrapQuestSubcategories(browser, category, filteredCategories, importRef, entry, auth);
                }
        } catch (error) {
            return { "message": "error" }
        }
        finally {
            await browser.close();
        }
    },

    async scrapQuestSubcategories(browser, category, filteredCategories, importRef, entry, auth) {
        const newPage = await browser.newPage();
        await newPage.setViewport({ width: 1400, height: 600 })
        await newPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

        await newPage.setRequestInterception(true)

        newPage.on('request', (request) => {
            if (request.resourceType() === 'image') request.abort()
            else request.continue()
        })

        try {
            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => newPage.goto(`https://www.questonline.gr${category.link}`, { waitUntil: "networkidle0" }),
                    5 // retry this 5 times
                );
            // await page.goto(`https://www.questonline.gr${category.link}`, { waitUntil: "networkidle0" });
            const scrapSub = await newPage.$eval('.side-menu', (element) => {
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
                .filterCategories(filteredCategories.categories, importRef.categoryMap.isWhitelistSelected, importRef.categoryMap.whitelist_map, importRef.categoryMap.blacklist_map)

            for (let sub of filteredCategories.categories[catIndex].subCategories) {
                await newPage.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(5000, 10000))

                await this.scrapQuestSubcategories2(browser, category.title, sub, filteredCategories, importRef, entry, auth)
            }
        } catch (error) {
            console.log(error)
        }
        finally {
            newPage.close()
        }
    },

    async scrapQuestSubcategories2(browser, category, subcategory, filteredCategories, importRef, entry, auth) {
        const newPage = await browser.newPage();
        await newPage.setViewport({ width: 1400, height: 600 })
        await newPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

        await newPage.setRequestInterception(true)

        newPage.on('request', (request) => {
            if (request.resourceType() === 'image') request.abort()
            else request.continue()
        })

        try {
            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => newPage.goto(`https://www.questonline.gr${subcategory.link}`, { waitUntil: "networkidle0" }),
                    5 // retry this 5 times
                );
            // await page.goto(`https://www.questonline.gr${subcategory.link}`, { waitUntil: "networkidle0" });
            const sideMenu = await newPage.$('.side-menu')

            const catIndex = filteredCategories.categories.findIndex(x => x.title === category)
            const subIndex = filteredCategories.categories[catIndex].subCategories.findIndex(x => x.title === subcategory.title)

            if (sideMenu) {
                const scrapSub = await newPage.$eval('.side-menu', (element) => {
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
                    .filterCategories(filteredCategories.categories, importRef.categoryMap.isWhitelistSelected, importRef.categoryMap.whitelist_map, importRef.categoryMap.blacklist_map)

                for (let sub2 of filteredCategories.categories[catIndex].subCategories[subIndex].subCategories) {
                    await this.scrapQuestCategory(browser, sub2.link, category, subcategory.title, sub2.title, importRef, entry, auth)
                    await newPage.waitForTimeout(1000);
                }
            }
            else {
                await newPage.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(5000, 10000))
                await this.scrapQuestCategory(browser, subcategory.link, category, subcategory.title, null, importRef, entry, auth)
            }

        } catch (error) {
            console.log(error)
        }
        finally {
            newPage.close()
        }
    },

    async scrapQuestCategory(browser, link, category, subcategory, sub2category, importRef, entry, auth) {
        const newPage = await browser.newPage();
        await newPage.setViewport({ width: 1400, height: 600 })
        await newPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

        await newPage.setRequestInterception(true)

        newPage.on('request', (request) => {
            if (request.resourceType() === 'image') request.abort()
            else request.continue()
        })

        try {
            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => newPage.goto(`https://www.questonline.gr${link}?pagesize=300&skuavailableindays=1`, { waitUntil: "networkidle0" }),
                    5 // retry this 5 times
                );
            // await page.goto(`https://www.questonline.gr${link}?pagesize=300&skuavailableindays=1`, { waitUntil: "networkidle0" });

            const scrapProducts = await newPage.$eval('div.region-area-three>div.inner-area.inner-area-three', (element) => {
                const productListWrapper = element.querySelector('div.box>ul.product-list')
                const productList = productListWrapper.querySelectorAll('li>article>div.description-container')

                const products = []
                for (let prod of productList) {
                    let product = {}
                    const leftContainer = prod.querySelector('div.description-container-left')
                    const titleWrapper = leftContainer.querySelector('header.title-container>h2.title>a')
                    product.name = titleWrapper.textContent.trim()
                    const linkHref = titleWrapper.getAttribute('href')
                    product.link = `https://www.questonline.gr${linkHref}`
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
                    const initialWholesale = priceWrapper.querySelector('.deleted-price')
                    if (initialWholesale) {
                        product.initial_wholesale = initialWholesale.textContent.replace('€', '').replace(',', '.').trim()
                    }
                    product.wholesale = priceWrapper.querySelector('.final-price').textContent.replace('€', '').replace(',', '.').trim()

                    product.stockLevel = productAvailability

                    products.push(product)
                }
                return products
            })

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .updateAndFilterScrapProducts(scrapProducts, category, subcategory, sub2category, importRef, entry)

            // console.dir(products)
            for (let product of products) {
                await newPage.waitForTimeout(strapi
                    .plugin('import-products')
                    .service('helpers')
                    .randomWait(5000, 10000))
                await this.scrapQuestProduct(browser, product.link, category, subcategory, sub2category, importRef, entry, auth)
                // }
            }

        } catch (error) {
            console.log(error)
        }
        finally {
            newPage.close()
        }
    },

    async scrapQuestProduct(browser, productLink, category, subcategory, sub2category, importRef, entry, auth) {
        const newPage = await browser.newPage();
        await newPage.setViewport({ width: 1400, height: 600 })
        await newPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");


        try {
            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => newPage.goto(productLink, { waitUntil: "networkidle0" }),
                    5 // retry this 5 times
                );

            // await newPage.goto(productLink, { waitUntil: "networkidle0" });

            await newPage.waitForTimeout(strapi
                .plugin('import-products')
                .service('helpers')
                .randomWait(1000, 3000))

            const scrapProduct = await newPage.$eval('.details-page', (scrap) => {
                const product = {}

                const element = scrap.querySelector('div.content-container div.region-area-two')
                // Αφαίρεσα div.content-container div.region-area-two 
                const titleWrapper = element.querySelector('.inner-area-one .title')
                product.name = titleWrapper.textContent.trim();
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
                        product.imagesSrc.push({ url: `https://www.questonline.gr${src}` })
                }

                const priceWrapper = element.querySelector('.box-three')
                product.initial_wholesale = priceWrapper.querySelector('.deleted-price')?.textContent.replace('€', '').replace(',', '.').trim()
                product.wholesale = priceWrapper.querySelector('.final-price').textContent.replace('€', '').replace(',', '.').trim()

                product.stockLevel = priceWrapper.querySelector('#realAvail').textContent.trim()

                switch (product.stockLevel) {
                    case 'Διαθέσιμο':
                        product.status = "InStock"
                        break;
                    case 'Διαθέσιμο - Περιορισμένη ποσότητα':
                        product.status = "LowStock"
                        break;
                    default:
                        product.status = "OutOfStock"
                        break;
                }

                const tabsWrapper = scrap.querySelector('.tabs-content .technical-charact')

                if (tabsWrapper) {
                    const liWrappers = tabsWrapper.querySelectorAll('li')

                    const prod_chars = []
                    for (let i = 0; i < liWrappers.length; i += 2) {
                        prod_chars.push({
                            name: liWrappers[i].querySelector('span').textContent.trim(),
                            value: liWrappers[i + 1].querySelector('span').textContent.trim(),
                        })
                    }

                    product.prod_chars = prod_chars
                }

                return product
            })

            scrapProduct.link = productLink
            scrapProduct.mpn = scrapProduct.prod_chars.find(x => x.name === "Part Number").value?.trim();
            scrapProduct.barcode = scrapProduct.prod_chars.find(x => x.name === "EAN Number").value?.trim();
            scrapProduct.model = scrapProduct.prod_chars.find(x => x.name === "Μοντέλο")?.value?.trim();
            scrapProduct.brand_name = scrapProduct.prod_chars.find(x => x.name === "Κατασκευαστής")?.value?.trim()
            scrapProduct.entry = entry
            scrapProduct.category = { title: category }
            scrapProduct.subcategory = { title: subcategory }
            scrapProduct.sub2category = { title: sub2category }


            // await this.importQuestProduct(scrapProduct, category, subcategory, sub2category,
            //         importRef, entry, auth)
            await strapi
                .plugin('import-products')
                .service('helpers')
                .importScrappedProduct(scrapProduct, importRef, entry, auth)

        } catch (error) {
            console.log(error)
        }
        finally {
            newPage.close()
        }
    },

    async importQuestProduct(product, category, subcategory,
        sub2category, importRef, entry, auth) {
        console.log("category:", category, "subcategory:", subcategory, "sub2category:", sub2category)
        try {
            // Αν δεν είναι Διαθέσιμο τότε προχώρα στο επόμενο
            const isAvailable = await strapi
                .plugin('import-products')
                .service('helpers')
                .filterScrappedProducts(importRef.categoryMap, product);

            if (!isAvailable)
                return

            const { entryCheck, brandId } = await strapi
                .plugin('import-products')
                .service('helpers')
                .checkProductAndBrand(product.mpn, product.name, product.barcode, product.brand_name, product.model);

            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await strapi
                .plugin('import-products')
                .service('helpers')
                .getCategory(importRef.categoryMap.categories_map, product.name, category, subcategory, sub2category);

            // console.log("categoryInfo:", categoryInfo, "brandId:", brandId)

            if (!entryCheck) {
                try {

                    //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
                    const { mapCharNames, mapCharValues } = importRef.charMaps

                    const parsedChars = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .parseChars(product.prod_chars, mapCharNames, mapCharValues)

                    let imageUrls = []
                    for (let imageUrl of product.imagesSrc) {
                        imageUrls.push({ url: imageUrl })
                    }

                    const price_progress_data = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .createPriceProgress(product)

                    const supplierInfo = [await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .createSupplierInfoData(entry, product, price_progress_data)]

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPrice(product, supplierInfo, categoryInfo, brandId);

                    const data = {
                        name: product.name,
                        slug: slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*+~=#.,±°;_()/'"!:@]/g }),
                        category: categoryInfo.id,
                        price: parseFloat(productPrice).toFixed(2),
                        publishedAt: new Date(),
                        status: product.status,
                        related_import: entry.id,
                        supplierInfo: supplierInfo,
                        prod_chars: parsedChars,
                        ImageURLS: imageUrls,
                    }

                    if (product.mpn) {
                        data.mpn = product.mpn
                    }

                    if (product.barcode) {
                        data.barcode = product.barcode
                    }

                    if (product.model) {
                        data.model = product.model
                    }

                    if (product.description) {
                        data.description = product.description
                    }

                    if (product.short_description) {
                        data.short_description = short_description.model
                    }

                    if (brandId) {
                        data.brand = { id: brandId }
                    }

                    if (brandId) {
                        data.brand = { id: brandId }
                    }

                    const newEntry = await strapi.entityService.create('api::product.product', {
                        data: data,
                    });

                    importRef.related_entries.push(newEntry.id)
                    importRef.created += 1;
                    console.log("Created:", importRef.created)

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
                    importRef.related_entries.push(entryCheck.id)

                    let supplierInfo = entryCheck.supplierInfo;
                    const relatedImport = entryCheck.related_import;
                    const relatedImportId = relatedImport.map(x => x.id)
                    relatedImportId.push(entry.id)

                    const { updatedSupplierInfo, isUpdated } = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .updateSupplierInfo(entry, product, supplierInfo)

                    if (isUpdated) {
                        supplierInfo = updatedSupplierInfo
                    }

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPrice(entryCheck, supplierInfo, categoryInfo, brandId);

                    await strapi.entityService.update('api::product.product', entryCheck.id, {
                        data: {
                            name: product.name,
                            category: categoryInfo.id,
                            model: product.model ? product.model : null,
                            price: parseFloat(productPrice),
                            supplierInfo: supplierInfo,
                            related_import: relatedImportId,
                        },
                    });
                    importRef.updated += 1
                    console.log("Updated:", importRef.updated)
                } catch (error) {
                    console.log(error, error.details.errors)
                }
            }
        } catch (error) {
            console.log(error, error.details.errors)
        }
    },

}); 