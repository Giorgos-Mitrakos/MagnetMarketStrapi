'use strict';

const Axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { env } = require("process");

module.exports = ({ strapi }) => ({ 

    async scrapNovatronCategories(categoryMap, report, entry, auth) {
        try {
            // const browser = await puppeteer.launch()
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 500 })
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            if (fs.existsSync('./public/NovatronCookies.json')) {
                fs.readFile('./public/NovatronCookies.json', async (err, data) => {
                    if (err)
                        console.log(err);
                    else {
                        const cookies = JSON.parse(data);
                        await page.setCookie(...cookies);
                        console.log("File readen successfully\n");
                    }
                })
            }

            await page.goto('https://novatronsec.com/', { waitUntil: "networkidle0" });
            const pageUrl = page.url();

            if (pageUrl === "https://novatronsec.com/Account/Login?ReturnUrl=%2F") {
                const bodyHandle = await page.$('body');
                const formHandle = await bodyHandle.$('form');

                const username = await formHandle.$('#Email');
                const password = await formHandle.$('#Password');
                const button = await formHandle.$('button');
                await username.type(process.env.NOVARTONSEC_USERNAME)
                await password.type(process.env.NOVARTONSEC_PASSWORD)
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
                        fs.writeFile('./public/NovatronCookies.json', cookiesJson, (err) => {
                            if (err)
                                console.log(err);
                            else {
                                console.log("File written successfully\n");
                            }
                        })
                    })
                    .catch((error) => console.log(error))
            }

            const navList = await page.$("ul.navbar-nav")
            let scrapProduct = await navList.evaluate(() => {
                const navListElements = document.querySelectorAll("li.nav-item")
                let liElements = navListElements.length

                const categories = []
                for (let li of navListElements) {

                    let category = {}
                    let categoryAnchor = li.querySelector("a");
                    let categoryTitle = categoryAnchor.textContent;
                    category.title = categoryTitle.trim();

                    let subCategoryList = li.querySelectorAll("a.dropdown-item")

                    const subCategories = []
                    for (let sub of subCategoryList) {
                        const subCategory = {}
                        subCategory.title = sub.textContent.substring(0, sub.textContent.lastIndexOf("(")).trim()
                        subCategory.link = sub.getAttribute("href")
                        subCategories.push(subCategory)
                    }

                    category.subCategories = subCategories;

                    categories.push(category)
                }
                return categories
            });

            let newCategories = await strapi
                .plugin('import-products')
                .service('helpers')
                .filterCategories(scrapProduct, categoryMap.isWhitelistSelected, categoryMap.whitelist_map, categoryMap.blacklist_map)

            const charMaps = await await strapi
                .plugin('import-products')
                .service('helpers')
                .parseCharsToMap(categoryMap.char_name_map, categoryMap.char_value_map);

            await this.scrapNovatronCategory(newCategories, page, categoryMap, charMaps, report, entry, auth)
            await browser.close();
        } catch (error) {
            console.log(error)
        }
    },

    async scrapNovatronCategory(novatronCategories, page,
        categoryMap, charMaps, report, entry, auth) {
        try {
            for (let cat of novatronCategories) {
                for (let sub of cat.subCategories) {
                    await page.waitForTimeout(200)
                    await Promise.all(
                        [page.goto(`https://novatronsec.com${sub.link}?top=all&stock=1`, { waitUntil: "networkidle0" }),
                        page.waitForNavigation()]);

                    const bodyHandle = await page.$("body");

                    let scrap = await bodyHandle.evaluate(() => {
                        const productsGrid = document.querySelector(".products-grid");
                        const productsRow = productsGrid.querySelector(".row");
                        const productsList = productsRow.querySelectorAll(".product");

                        let products = []
                        for (let prod of productsList) {
                            const product = {}
                            const anchor = prod.querySelector("a");
                            product.link = anchor.getAttribute("href");

                            const productBody = prod.querySelector('.product-body')
                            const productTitleAnchor = productBody.querySelector('.product-title>a')
                            product.title = productTitleAnchor.textContent.trim()
                            product.price = productBody.querySelector('.product-price>div>div>span').textContent.replace('€', '').replace('.', '').replace(',', '.').trim()
                            product.supplierCode = productBody.querySelector('.product-code').textContent.trim()
                            const stockLevelWrapper = productBody.querySelector('div>p>img');
                            const productStockImg = stockLevelWrapper.getAttribute('src')
                            const stockLevelImg = productStockImg.split('/')[4].split('.')[0].split('-')[1].trim()

                            switch (stockLevelImg) {
                                case '3':
                                    product.stockLevel = "InStock"
                                    break;
                                case '2':
                                    product.stockLevel = "MediumStock"
                                    break;
                                case '1':
                                    product.stockLevel = "LowStock"
                                    break;
                                default:
                                    product.stockLevel = "OutOfStock"
                                    break;
                            }

                            products.push(product)
                        }
                        return products
                    })

                    const products = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .updateAndFilterScrapProducts(scrap, categoryMap, cat.title, sub.title, null, report, entry)

                    // console.log(products)

                    for (let prod of products) {
                        await this.scrapNovatronProduct(prod.link, page, cat.title, sub.title, categoryMap, charMaps, report, entry, auth)
                    }
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async scrapNovatronProduct(productLink, page, category, subcategory,
        categoryMap, charMaps, report, entry, auth) {
        try {
            await Promise.all([page.goto(`https://novatronsec.com${productLink}`, { waitUntil: "networkidle0" }),
            page.waitForNavigation()])

            let productUrl = page.url();
            const urlArray = productUrl.split("/")
            const productID = urlArray[urlArray.length - 1].split("?")[0]

            const bodyHandle = await page.$("body");

            let scrapProduct = await bodyHandle.evaluate(() => {
                const productDetailsSection = document.querySelector("section.product-details");
                const productImageWrapper = productDetailsSection.querySelector(".owl-thumbs");
                const productImages = productImageWrapper.querySelectorAll("img");
                const imagesSrc = []
                for (let imgSrc of productImages) {
                    imagesSrc.push(`https://novatronsec.com${imgSrc.getAttribute('src')}`)
                }
                const productTitle = productDetailsSection.querySelector("h1.product-title").textContent;
                const productMiniDescription = productDetailsSection.querySelector("p.mini-description").textContent;
                const productPriceWrapper = productDetailsSection.querySelector("div.product-price");
                const productPrice = productPriceWrapper.querySelector("span").textContent;

                const productPriceRetailWrapper = productDetailsSection.querySelector("div.product-price-retail");
                const productPriceRetail = productPriceRetailWrapper.querySelector("span").textContent;

                const productRow = productDetailsSection.querySelector("div.row");
                const productStock = productRow.querySelector("div>span>img");
                const stockImg = productStock.getAttribute('src').trim();
                let stockLevelImg = stockImg.substring(stockImg.length - 5, stockImg.length - 4);

                let stockLevel = ''
                switch (stockLevelImg) {
                    case '3':
                        stockLevel = "InStock"
                        break;
                    case '2':
                        stockLevel = "MediumStock"
                        break;
                    case '1':
                        stockLevel = "LowStock"
                        break;
                    default:
                        stockLevel = "OutOfStock"
                        break;
                }

                const productDetailsExtraSection = document.querySelector("section.product-details-extra");

                const productDescriptionWrapper = productDetailsExtraSection.querySelector("#description");

                let productDescription
                if (productDescriptionWrapper)
                    productDescription = productDescriptionWrapper.querySelector("div").innerHTML.trim();

                let productFovContainer
                let productFovTitle
                let productFovTable

                const productFovSection = document.querySelector("section.fov");
                if (productFovSection) {
                    productFovContainer = productFovSection.querySelector(".container");
                    productFovTitle = productFovContainer.querySelector("h4").textContent;
                    productFovTable = productFovContainer.querySelector("table").innerHTML;

                    productDescription += productFovTitle
                    productDescription += productFovTable
                }

                const productAdditionalInfoWrapper = productDetailsExtraSection.querySelector("#additional-information");

                let productAdditionalInfoTables
                let prod_chars = []

                if (productAdditionalInfoWrapper) {
                    productAdditionalInfoTables = productAdditionalInfoWrapper.querySelectorAll("tbody");


                    for (let tbl of productAdditionalInfoTables) {
                        let tableRows = tbl.querySelectorAll("tr");

                        for (let row of tableRows) {
                            prod_chars.push({
                                name: row.querySelector("th").textContent.trim(),
                                value: row.querySelector("td").textContent.trim(),
                            })
                        }
                    }
                }

                let relativeProducts = []
                const productRelativeWrapper = document.querySelector("section.relative-products");

                if (productRelativeWrapper) {
                    const productRelativeRow = productRelativeWrapper.querySelectorAll("div.product");
                    for (let prod of productRelativeRow) {
                        let relativeProductURL = prod.querySelector("a").getAttribute("href").trim();
                        const urlArray = relativeProductURL.split("/")
                        let relativeProductID = urlArray[urlArray.length - 1]

                        relativeProducts.push({
                            mpn: relativeProductID,
                        })
                    }
                }

                return {
                    imagesSrc, productTitle, productMiniDescription, productPrice,
                    productPriceRetail, stockLevel, productDescription, prod_chars, relativeProducts,
                }
                // return productPriceRetail 
            })

            scrapProduct.productID = productID

            let importProduct = await this.importNovatronProduct(scrapProduct, `https://novatronsec.com${productLink}`, category, subcategory,
                categoryMap, charMaps, report, entry, auth)

            return importProduct
        } catch (error) {
            console.log(error)
        }
    },

    async importNovatronProduct(product, productLink, category, subcategory,
        categoryMap, charMaps, report, entry, auth) {
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

            let mpn = product.productID.toString()
            let price = product.productPrice.replace('€', '').replace('.', '').replace(',', '.');
            let salePrice = product.productPriceRetail.replace('€', '').replace('.', '').replace(',', '.');

            if (price < minPrice || price > maxPrice) {
                return
            }

            console.log("price:", price, "salePrice:", salePrice)
            const entryCheck = await strapi
                .plugin('import-products')
                .service('helpers')
                .checkIfProductExists(mpn);

            let brandName = product.productTitle.split("-")[0].trim()

            const brandId = await strapi
                .plugin('import-products')
                .service('helpers')
                .brandIdCheck(brandName);

            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await strapi
                .plugin('import-products')
                .service('helpers')
                .getCategory(categoryMap.categories_map, product.productTitle, category, subcategory, null);

            console.log("categoryInfo:", categoryInfo)
            const prod = { price: price.trim() }
            if (!entryCheck) {
                try {
                    const supplierInfo = [{
                        name: entry.name,
                        wholesale: parseFloat(price).toFixed(2),
                        supplierProductId: mpn,
                        sale_price: parseFloat(salePrice).toFixed(2),
                        supplierProductURL: productLink
                    }]

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPrice(prod, supplierInfo, categoryInfo, brandId);

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

                    const data = {
                        name: product.productTitle,
                        short_description: product.productMiniDescription,
                        description: product.productDescription,
                        category: categoryInfo.id,
                        price: parseFloat(productPrice).toFixed(2),
                        mpn: mpn ? mpn : null,
                        slug: slugify(`${product.productTitle}-${mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g }),
                        publishedAt: new Date(),
                        status: product.stockLevel,
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
                    report.related_products.push({ productID: newEntry.id, relatedProducts: product.relativeProducts })
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
                    console.log(error.details.errors)
                }
            }
            else {
                try {
                    report.related_entries.push(entryCheck.id)
                    report.related_products.push({ productID: entryCheck.id, relatedProducts: product.relativeProducts })
                    const supplierInfo = [] //entryCheck.supplierInfo
                    const relatedImport = entryCheck.related_import;
                    const relatedImportId = []
                    relatedImport.forEach(x => {
                        relatedImportId.push(x.id)
                    })
                    relatedImportId.push(entry.id)
                    let searchSupplierInfo = supplierInfo.find((o, i) => {
                        if (o.name === entry.name) {
                            supplierInfo[i] = {
                                name: entry.name,
                                wholesale: parseFloat(price).toFixed(2),
                                supplierProductId: mpn,
                                price: parseFloat(salePrice).toFixed(2),
                                supplierProductURL: productLink
                            }
                            return true;
                        }
                    })

                    if (!searchSupplierInfo) {
                        supplierInfo.push({
                            name: entry.name,
                            wholesale: parseFloat(price).toFixed(2),
                            supplierProductId: mpn,
                            price: parseFloat(salePrice).toFixed(2),
                            supplierProductURL: productLink
                        })
                    }

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPrice(entryCheck, supplierInfo, categoryInfo, brandId);

                    await strapi.entityService.update('api::product.product', entryCheck.id, {
                        data: {
                            name: product.productTitle,
                            category: categoryInfo.id,
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