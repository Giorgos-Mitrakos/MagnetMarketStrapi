'use strict';

const Axios = require('axios');
const slugify = require("slugify");
const puppeteer = require('puppeteer');
const fs = require('fs');
const { env } = require("process");

module.exports = ({ strapi }) => ({

    async scrapNovatronCategories(importRef, entry, auth) {
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
                .filterCategories(scrapProduct, importRef.categoryMap.isWhitelistSelected, importRef.categoryMap.whitelist_map, importRef.categoryMap.blacklist_map)


            await this.scrapNovatronCategory(newCategories, page, importRef, entry, auth)
            await browser.close();
        } catch (error) {
            console.log(error)
        }
    },

    async scrapNovatronCategory(novatronCategories, page,
        importRef, entry, auth) {
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
                            let productLink = anchor.getAttribute("href");
                            product.link = `https://novatronsec.com${productLink}`

                            const productImageBadge = anchor.querySelector("img.product-image-badge");
                            if (productImageBadge)
                                product.in_offer = productImageBadge.getAttribute("href") === '/Content/img/prosfora-R.png'

                            const productBody = prod.querySelector('.product-body')
                            const productTitleAnchor = productBody.querySelector('.product-title>a')
                            product.title = productTitleAnchor.textContent.trim()
                            product.brand_name = product.title.split("-")[0].trim()
                            product.wholesale = productBody.querySelector('.product-price>div>div>span').textContent.replace('€', '').replace('.', '').replace(',', '.').trim()
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
                        .updateAndFilterScrapProducts(scrap, cat.title, sub.title, null, importRef, entry)

                    // console.log(products)

                    for (let prod of products) {
                        await this.scrapNovatronProduct(prod.link, page, cat.title, sub.title, importRef, entry, auth)
                    }
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async scrapNovatronProduct(productLink, page, category, subcategory,
        importRef, entry, auth) {
        try {

            await Promise.all([page.goto(productLink, { waitUntil: "networkidle0" }),
            page.waitForNavigation()])

            let productUrl = page.url();
            const urlArray = productUrl.split("/")
            const productID = urlArray[urlArray.length - 1].split("?")[0]

            const bodyHandle = await page.$("body");

            let scrapProduct = await bodyHandle.evaluate(() => {
                const product = {}

                const productDetailsSection = document.querySelector("section.product-details");
                const productImageWrapper = productDetailsSection.querySelector(".owl-thumbs");
                const productImages = productImageWrapper.querySelectorAll("img");
                product.imagesSrc = []
                for (let imgSrc of productImages) {
                    product.imagesSrc.push(`https://novatronsec.com${imgSrc.getAttribute('src')}`)
                }

                const inOfferImage = productDetailsSection.querySelector(".active .product-image-badge");
                if (inOfferImage) {
                    product.in_offer = inOfferImage.getAttribute('src') === '/Content/img/prosfora-R.png'
                }
                else {
                    product.in_offer = false
                }
                product.title = productDetailsSection.querySelector("h1.product-title").textContent.trim();
                product.brand_name = product.title.split("-")[0].trim()
                product.short_description = productDetailsSection.querySelector("p.mini-description").textContent.trim();
                const productPriceWrapper = productDetailsSection.querySelector("div.product-price");
                product.wholesale = productPriceWrapper.querySelector("span").textContent.replace('€', '').replace(',', '.').trim();

                const productPriceRetailWrapper = productDetailsSection.querySelector("div.product-price-retail");
                product.retail_price = productPriceRetailWrapper.querySelector("span").textContent.replace('€', '').replace(',', '.').trim();

                const productRow = productDetailsSection.querySelector("div.row");
                const productStock = productRow.querySelector("div>span>img");
                const stockImg = productStock.getAttribute('src').trim();
                let stockLevelImg = stockImg.substring(stockImg.length - 5, stockImg.length - 4);

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

                const productDetailsExtraSection = document.querySelector("section.product-details-extra");

                const productDescriptionWrapper = productDetailsExtraSection.querySelector("#description");

                if (productDescriptionWrapper)
                    product.description = productDescriptionWrapper.querySelector("div").innerHTML.trim();

                const productFovSection = document.querySelector("section.fov");
                if (productFovSection) {
                    let productFovContainer = productFovSection.querySelector(".container");
                    let productFovTitle = productFovContainer.querySelector("h4").textContent;
                    let productFovTable = productFovContainer.querySelector("table").innerHTML;

                    product.description += productFovTitle
                    product.description += productFovTable
                }

                const productAdditionalInfoWrapper = productDetailsExtraSection.querySelector("#additional-information");

                product.prod_chars = []

                if (productAdditionalInfoWrapper) {
                    let productAdditionalInfoTables = productAdditionalInfoWrapper.querySelectorAll("tbody");


                    for (let tbl of productAdditionalInfoTables) {
                        let tableRows = tbl.querySelectorAll("tr");

                        for (let row of tableRows) {
                            product.prod_chars.push({
                                name: row.querySelector("th").textContent.trim(),
                                value: row.querySelector("td").textContent.trim(),
                            })
                        }
                    }
                }

                product.relativeProducts = []
                const productRelativeWrapper = document.querySelector("section.relative-products");

                if (productRelativeWrapper) {
                    const productRelativeRow = productRelativeWrapper.querySelectorAll("div.product");
                    for (let prod of productRelativeRow) {
                        let relativeProductURL = prod.querySelector("a").getAttribute("href").trim();
                        const urlArray = relativeProductURL.split("/")
                        let relativeProductID = urlArray[urlArray.length - 1]

                        product.relativeProducts.push({
                            mpn: relativeProductID,
                        })
                    }
                }

                return product
            })

            scrapProduct.mpn = productID.toString()
            scrapProduct.supplierCode = productID.toString()
            scrapProduct.link = productUrl

            let importProduct = await this.importNovatronProduct(scrapProduct, `https://novatronsec.com${productLink}`, category, subcategory,
                importRef, entry, auth)

        } catch (error) {
            console.log(error)
        }
    },

    async importNovatronProduct(product, productLink, category, subcategory,
        importRef, entry, auth) {
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
                .checkProductAndBrand(product.mpn, product.title, product.barcode, product.brand_name, product.model);

            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await strapi
                .plugin('import-products')
                .service('helpers')
                .getCategory(importRef.categoryMap.categories_map, product.title, category, subcategory, null);

            // console.log("categoryInfo:", categoryInfo)

            // const prod = { price: wholesale.trim() }
            if (!entryCheck) {
                try {
                    console.log("New Data")
                    //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
                    const { mapCharNames, mapCharValues } = importRef.charMaps

                    const parsedChars = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .parseChars(product.prod_chars, mapCharNames, mapCharValues)

                    const imageUrls = []
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
                        .setPrice(product.wholesale, supplierInfo, categoryInfo, brandId);

                    const data = {
                        name: product.title,
                        short_description: product.short_description,
                        description: product.description,
                        category: categoryInfo.id,
                        price: parseFloat(productPrice).toFixed(2),
                        mpn: product.mpn ? product.mpn : null,
                        slug: slugify(`${product.title}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g }),
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

                    importRef.related_entries.push(newEntry.id)
                    importRef.related_products.push({ productID: newEntry.id, relatedProducts: product.relativeProducts })
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
                    console.log(error, error.details?.errors)
                }
            }
            else {
                try {
                    console.log("Existed Data")
                    importRef.related_entries.push(entryCheck.id)
                    importRef.related_products.push({ productID: entryCheck.id, relatedProducts: product.relativeProducts })

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
                            name: product.productTitle,
                            category: categoryInfo.id,
                            price: parseFloat(productPrice),
                            supplierInfo: supplierInfo,
                            related_import: relatedImportId,
                        },
                    });
                    importRef.updated += 1
                    console.log("Updated:", importRef.updated)
                } catch (error) {
                    console.log(error)
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

});