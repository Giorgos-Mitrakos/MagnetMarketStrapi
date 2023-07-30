'use strict';

const slugify = require("slugify");
const puppeteer = require('puppeteer');
const fs = require('fs');
const { env } = require("process");

module.exports = ({ strapi }) => ({

    async saveGlobalsatCookies(page) {
        try {
            const body = await page.$('body');
            // const closePopUp = await body.waitForSelector('.closeModal');
            // if (closePopUp)
            //     await closePopUp.evaluate(el => el.click());


            // const optionsButton = await body.$('button.open-nv-modal')
            // await optionsButton.click()

            // const settingsButton = await body.$('button.nvcookies__button--toggle')
            // await settingsButton.click()

            // const settingsSwitch = await body.$('input.nvswitch__input')
            // const v = await (await settingsSwitch.getProperty("checked")).jsonValue()
            // if (v) {
            //     await settingsSwitch.click()
            // }

            const consentButton = await body.waitForSelector('.consent-give');
            await consentButton.click()

            // const loginOpen = await body.$('.login_nav_head');
            // await loginOpen.click();

            await page.waitForTimeout(500)
            // await body.waitForSelector('#UserName')
            // const loginSubMenu = await body.$('.login')
            const loginForm = await body.$('.form')

            const username = await loginForm.$('#UserName');
            const password = await loginForm.$('#Password');
            await username.type(process.env.GLOBALSAT_USERNAME)
            await password.type(process.env.GLOBALSAT_PASSWORD)
            const submitLogin = await loginForm.$('button')

            await Promise.all([
                submitLogin.click('#loginSubmit'),
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
            ]);

            const cookies = await page.cookies();
            const cookiesJson = JSON.stringify(cookies, null, 2)
            fs.writeFile('./public/GlobalsatCookies.json', cookiesJson, (err) => {
                if (err)
                    console.log(err);
                else {
                    console.log("File written successfully\n");
                }
            });

        } catch (error) {

        }
    },

    async scrapGlobalsat(importRef, entry, auth) {
        const browser = await strapi
            .plugin('import-products')
            .service('helpers')
            .createBrowser()
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 500 })
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            if (fs.existsSync('./public/GlobalsatCookies.json')) {
                fs.readFile('./public/GlobalsatCookies.json', async (err, data) => {
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
                    () => page.goto('https://b2b.globalsat.gr/', { waitUntil: "networkidle0" }),
                    10 // retry this 5 times
                );

            const pageUrl = page.url();
            await page.waitForTimeout(1500)

            if (pageUrl === "https://b2b.globalsat.gr/account/login/") {
                await this.saveGlobalsatCookies(page)
            }

            const newBody = await page.$('body');

            const categories = await this.scrapGlobalsatCategories(newBody)

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map } = await importRef.categoryMap

            let newCategories = await strapi
                .plugin('import-products')
                .service('helpers')
                .filterCategories(categories, isWhitelistSelected, whitelist_map, blacklist_map)


            const brandEntries = await strapi.entityService.findMany('api::brand.brand', {
                fields: ['name'],
            });

            let sortedBrandArray = brandEntries.sort(function (a, b) {
                // ASC  -> a.length - b.length
                // DESC -> b.length - a.length
                return b.name.length - a.name.length;
            });

            for (let category of newCategories) {
                // console.dir(category.subCategories)
                for (let subCategory of category.subCategories) {
                    for (let sub2Category of subCategory.subCategories) {
                        await page.waitForTimeout(strapi
                            .plugin('import-products')
                            .service('helpers')
                            .randomWait(5000, 10000))
                        await this.scrapGlobalsatCategory(page, category, subCategory, sub2Category, sortedBrandArray, importRef, entry, auth)
                    }
                }
            }
            await browser.close();

        } catch (error) {
            return { "message": "error" }
        }
        finally {
            await browser.close();
        }
    },

    async scrapGlobalsatCategories(body) {
        try {
            let scrap = await body.evaluate(() => {
                const categoriesNav = document.querySelector('nav.main_nav');
                const productsNav = categoriesNav.querySelector('li.first_li');
                const productsNavList = productsNav.querySelector('ul.level2');
                const productsNavList1 = productsNavList.querySelectorAll('li.level2_1');

                const categories = []


                for (let li of productsNavList1) {
                    const titleSpan = li.querySelector('span');
                    const titleAnchor = titleSpan.querySelector('a').textContent
                    const linkAnchor = titleSpan.querySelector('a').getAttribute('href')

                    const megaMenuInner = li.querySelector('div.megamenu_inner')
                    const subCategoryList = megaMenuInner.querySelectorAll('ul.level3')

                    const subCategories = []
                    for (let subLi of subCategoryList) {
                        const titleSpan = subLi.querySelector('li');
                        const titleAnchor = titleSpan.querySelector('a').textContent
                        const linkAnchor = titleSpan.querySelector('a').getAttribute('href')

                        const subCategoryList = subLi.querySelector('ul.level4')
                        const subCategoryListItems = subCategoryList.querySelectorAll('li')

                        const subCategories2 = []

                        for (let sub2Li of subCategoryListItems) {
                            const titleAnchor = sub2Li.querySelector('a').textContent
                            const titleLink = sub2Li.querySelector('a').getAttribute('href')
                            subCategories2.push({ title: titleAnchor, link: titleLink })
                        }
                        subCategories.push({ title: titleAnchor, link: linkAnchor, subCategories: subCategories2 })
                    }

                    categories.push({ title: titleAnchor, link: linkAnchor, subCategories })
                }

                return categories
            })

            return scrap

        } catch (error) {
            console.log(error)
        }
    },

    async scrapGlobalsatCategory(page, category, subCategory, sub2Category, sortedBrandArray, importRef, entry, auth) {
        try {

            const navigationParams = sub2Category.link === "https://b2b.globalsat.gr/kiniti-tilefonia/a_axesouar-prostasias/b_thikes-gia-smartphones/" ?
                { waitUntil: "networkidle0", timeout: 0 } :
                { waitUntil: "networkidle0" }

            let status = await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => page.goto(`${sub2Category.link}?wbavlb=Διαθέσιμο&sz=3`, navigationParams),
                    10 // retry this 5 times
                );

            status = status.status();

            if (status !== 404) {
                const listContainer = await page.$('div.list_container');

                // const productLinksList = []

                const productList = await listContainer.evaluate(() => {
                    const productsList = document.querySelectorAll(".product_box")

                    let products = []
                    for (let prod of productsList) {
                        const product = {}

                        const productInfoWrapper = prod.querySelector('.product_info');
                        const productTitleAnchor = productInfoWrapper.querySelector('h2 a');
                        product.link = productTitleAnchor.getAttribute('href');
                        product.name = productTitleAnchor.textContent.trim();
                        product.supplierCode = productInfoWrapper.querySelector('.product_code span').textContent.trim();

                        const productPriceWrapper = productInfoWrapper.querySelector('.price_row');
                        const productPriceItems = productPriceWrapper.querySelectorAll('.price-item');

                        for (let item of productPriceItems) {
                            const txtPrice = item.querySelector('.txt').textContent.trim()
                            if (txtPrice === 'Τλ:') {
                                product.initial_retail_price = item.querySelector('.initial_price')?.textContent.replace('€', '').replace('.', '').replace(',', '.').trim()

                                const sale_prices = item.querySelectorAll('.price')
                                if (sale_prices.length === 1) {
                                    product.retail_price = item.querySelector('.price').textContent.replace('€', '').replace('.', '').replace(',', '.').trim()
                                }
                                else {
                                    product.retail_price = sale_prices[1].textContent.replace('€', '').replace('.', '').replace(',', '.').trim();
                                }
                            }
                            else {
                                product.wholesale = item.querySelector('.price').textContent.replace('€', '').replace(".", "").replace(',', '.').trim()
                            }
                        }

                        const productAvailability = prod.querySelector('.tag_line span').textContent.trim();
                        product.stockLevel = productAvailability

                        products.push(product)
                    }
                    return products
                })

                productList.forEach(prod => {
                    const brandFound = sortedBrandArray.find(x => prod.name?.toLowerCase().startsWith(x.name.toLowerCase()))
                    
                    if (brandFound) {
                        prod.brand = brandFound.name
                    }
                })

                const products = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .updateAndFilterScrapProducts(productList, category.title, subCategory.title, sub2Category.title, importRef, entry)

                // console.log("Products after Filtering:", products.length) 

                for (let product of products) {
                    await page.waitForTimeout(strapi
                        .plugin('import-products')
                        .service('helpers')
                        .randomWait(5000, 10000))
                    await this.scrapGlobalsatProduct(page, category, subCategory, sub2Category, product.link, importRef, entry, auth)
                }
            }

        } catch (error) {
            console.error(error, importRef, entry, auth)
        }
    },

    async scrapGlobalsatProduct(page, category, subcategory, sub2category, productLink, importRef, entry, auth) {
        try {
            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => page.goto(productLink, { waitUntil: "networkidle0" }),
                    10 // retry this 5 times
                );

            const productPage = await page.$('section.product_page');

            const scrapProduct = await productPage.evaluate(() => {

                const product = {}

                const productContainer = document.querySelector('div.product_container');
                product.name = productContainer.querySelector('div.main_prod_title h1').textContent;
                const productCodesWrapper = productContainer.querySelectorAll('div.product_code>span');

                for (let code of productCodesWrapper) {

                    let codeSpan = code.querySelector("span")
                    const indexOfSpan = code.innerHTML.indexOf("</span>")
                    if (codeSpan.textContent.trim() === "ΚΩΔΙΚΟΣ ΠΡΟΪΟΝΤΟΣ:") {
                        product.supplierCode = code.innerHTML.slice(indexOfSpan + 7).trim()
                    }
                    else if (codeSpan.textContent.trim() === "BarCode:") {
                        product.barcode = code.innerHTML.slice(indexOfSpan + 7).trim()
                    }
                    else if (codeSpan.textContent.trim() === "PartNumber:") {
                        product.mpn = code.innerHTML.slice(indexOfSpan + 7).trim()
                    }
                }

                const productImgUrlsWrapper = productContainer.querySelectorAll('div.main_slider_thumbs figure>img');

                product.imagesSrc = []
                for (let productImgUrl of productImgUrlsWrapper) {
                    let imgURL = productImgUrl.getAttribute("src")
                    product.imagesSrc.push({ url: imgURL })
                }

                const productInfo = productContainer.querySelector('div.product_info');
                const productTag = productInfo.querySelector('div.tag_line');
                product.stockLevel = productTag.querySelector('span').textContent.trim();

                switch (product.stockLevel) {
                    case 'Διαθέσιμο':
                        product.status = "InStock"
                        break;
                    case 'Αναμένεται Σύντομα':
                        product.status = "OutOfStock"
                        break;
                    default:
                        product.status = "OutOfStock"
                        break;
                }

                const suggestedPriceWrapper = productInfo.querySelector("div.trade");
                const suggestedPrices = suggestedPriceWrapper.querySelectorAll("span.price");

                if (suggestedPrices.length > 1) {
                    for (let price of suggestedPrices) {
                        if (price.getAttribute("class") === "price initial_price") {
                            product.initial_retail_price = price.textContent.replace("€", "").replace('.', '').replace(",", ".").trim();
                        }
                        else {
                            product.retail_price = price.textContent.replace("€", "").replace('.', '').replace(",", ".").trim();
                        }
                    }
                }
                else {
                    product.retail_price = suggestedPrices[0].textContent.replace(".", "").replace("€", "").replace('.', '').replace(",", ".").trim();
                }

                const wholesalePriceWrapper = productInfo.querySelector("div.price_row:not(.trade)");
                const wholesaleNode = wholesalePriceWrapper.querySelector("span.price").textContent;
                product.wholesale = wholesaleNode.replace("€", "").replace(".", "").replace(",", ".").trim();

                const description = productContainer.querySelector("div.main_prod_info>div");
                product.description = description.textContent.trim();

                const productCharsContainer = document.querySelector('div.product_chars');

                if (productCharsContainer) {
                    const charTable = productCharsContainer.querySelector('tbody')
                    const charRow = charTable.querySelectorAll('tr')
                    product.prod_chars = []
                    charRow.forEach(tr => {
                        const charValue = tr.querySelectorAll('td')
                        product.prod_chars.push({
                            "name": charValue[0].innerHTML.trim(),
                            "value": charValue[1].querySelector('b').innerHTML.trim()
                        })

                    });
                }

                return product
            })
            scrapProduct.supplierProductURL = productLink
            scrapProduct.entry = entry
            scrapProduct.category = category
            scrapProduct.subcategory = subcategory
            scrapProduct.sub2category = sub2category

            if (scrapProduct.prod_chars) {
                if (scrapProduct.prod_chars.find(x => x.name.toLowerCase().includes("βάρος") ||
                    x.name.toLowerCase().includes("specs"))) {
                    if (scrapProduct.prod_chars.find(x => x.name.toLowerCase().includes("μεικτό βάρος"))) {
                        let weightChar = scrapProduct.prod_chars.find(x => x.name.toLowerCase().includes("μεικτό βάρος"))
                        if (weightChar) {
                            if (weightChar.value.toLowerCase().includes("kg")) {
                                let result = weightChar.value.toLowerCase().match(/\d{1,3}(.|,|\s)?\d{0,3}\s*kg/gmi)
                                if (result) {
                                    if (result[result.length - 1].match(/\d{1,3}(.|\s)?\d{0,3}\s*kg/gmi)) {
                                        scrapProduct.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(",", ".").trim()) * 1000
                                        // console.log("weight:", weight)
                                    }
                                    else {
                                        scrapProduct.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(".", "").replace(",", ".").trim()) * 1000
                                        // console.log("weight:", weight)
                                    }

                                }
                            }
                            else if (weightChar.value.toLowerCase().includes("gr")) {
                                let result = weightChar.value.toLowerCase().match(/\d*(.|,|\s)?\d{0,3}\s*gr/gmi)
                                if (result[result.length - 1].match(/\d*.\d{3}\s*gr/gmi)) {
                                    scrapProduct.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(".", "").trim())
                                    // console.log("weight:", weight)
                                }
                                else {
                                    scrapProduct.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(",", ".").trim())
                                    // console.log("weight:", weight)
                                }
                            }
                        }
                    }
                    else {
                        let weightChar = scrapProduct.prod_chars.find(x => x.name.toLowerCase().includes("βάρος"))
                        if (weightChar) {
                            if (weightChar.value.toLowerCase().includes("kg")) {
                                let result = weightChar.value.toLowerCase().match(/\d{1,3}(.|,|\s)?\d{0,3}\s*kg/gmi)
                                if (result) {
                                    if (result[result.length - 1].match(/\d{1,3}(.|\s)?\d{0,3}\s*kg/gmi)) {
                                        scrapProduct.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(",", ".").trim()) * 1000
                                        // console.log("weight:", weight)
                                    }
                                    else {
                                        scrapProduct.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(".", "").replace(",", ".").trim()) * 1000
                                        // console.log("weight:", weight)
                                    }

                                }
                            }
                            else if (weightChar.value.toLowerCase().includes("gr")) {
                                let result = weightChar.value.toLowerCase().match(/\d*(.|,|\s)?\d{0,3}\s*gr/gmi)
                                if (result[result.length - 1].match(/\d*.\d{3}\s*gr/gmi)) {
                                    scrapProduct.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(".", "").trim())
                                    // console.log("weight:", weight)
                                }
                                else {
                                    scrapProduct.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(",", ".").trim())
                                    // console.log("weight:", weight)
                                }
                            }
                        }

                        let specsChar = scrapProduct.prod_chars.find(x => x.name.toLowerCase().includes("specs"))
                        if (specsChar) {
                            if (specsChar.value.toLowerCase().includes("βάρος") || specsChar.value.toLowerCase().includes("weight")) {
                                let result = specsChar.value.toLowerCase().match(/(βάρος|weight)\s?:\s?\d+(.)?\d+\s?gr?/gmi)
                                if (result) {
                                    if (result[result.length - 1].match(/\d+.?\d+/gmi)) {
                                        scrapProduct.weight = parseFloat(result[result.length - 1].match(/\d+.?\d+/gmi)[0])
                                    }
                                }
                            }
                        }
                    }
                }
            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .importScrappedProduct(scrapProduct, importRef, auth)

        } catch (error) {
            console.error(error)
        }
    },

    async importGlobalsatProduct(product, category,
        subcategory, sub2category, importRef, entry, auth) {
        try {
            console.log(product.name, category.title, subcategory.title, sub2category.title)
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

            // Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await strapi
                .plugin('import-products')
                .service('helpers')
                .getCategory(importRef.categoryMap.categories_map, product.name, category.title, subcategory.title, sub2category.title);

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
                        slug: slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g }),
                        category: categoryInfo.id,
                        price: parseFloat(productPrice).toFixed(2),
                        publishedAt: new Date(),
                        status: product.stockLevel,
                        related_import: entry.id,
                        supplierInfo: supplierInfo,
                        prod_chars: parsedChars,
                        ImageURLS: imageUrls,

                        // description: product.description,

                        // mpn: product.mpn ? product.mpn : null,
                        // barcode: product.barcode ? product.barcode : null,                        
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

                    const newEntry = await strapi.entityService.create('api::product.product', {
                        data: data,
                    });

                    importRef.related_entries.push(newEntry.id)
                    importRef.related_products.push({ productID: newEntry.id, relatedProducts: product.relativeProducts })
                    importRef.created += 1;

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
                    console.error(error, importRef, entry, auth)
                    console.log(error, error.details?.errors)
                }
            }
            else {
                try {
                    importRef.related_entries.push(entryCheck.id)
                    // importRef.related_products.push({ productID: entryCheck.id, relatedProducts: product.relativeProducts })

                    let supplierInfo = entryCheck.supplierInfo
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
                            categories: categoryInfo.id,
                            price: parseFloat(productPrice),
                            supplierInfo: supplierInfo,
                            related_import: relatedImportId,
                        },
                    });
                    importRef.updated += 1
                } catch (error) {
                    console.log(error)
                }
            }
        } catch (error) {
            console.error(error, importRef, entry, auth)
        }
    },

});