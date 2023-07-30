'use strict';

const https = require('https');
const xml2js = require('xml2js');
const fs = require('fs');
const xlsx = require('xlsx')
const slugify = require("slugify");
const Axios = require('axios');
const path = require('path');
const sharp = require('sharp');
const FormData = require("form-data");
const puppeteer = require('puppeteer');
const downloadImages = require('./get-file-to-import')
const xpath = require('xpath')
const { DOMParser, XMLSerializer, DOMImplementation } = require('xmldom');


module.exports = ({ strapi }) => ({
    async updateAll() {

        await scrapNOVATRON()
            .then(async () => { return updateZEGETRON() })
            .then(async () => { return updateGERASIS() })
            .then(async () => { return updateOKTABIT() })
            .then(async () => { return updateWESTNET() })
            .then(async () => { return scrapQUEST() })

        async function scrapNOVATRON() {
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Novatron" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseNovatronXml({ entry, auth });
        }

        async function updateZEGETRON() {
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Zegetron" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseZegetronXml({ entry, auth });
        }

        async function updateGERASIS() {
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Gerasis" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseGerasisXml({ entry, auth });
        }

        async function updateOKTABIT() {
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Oktabit" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseOktabitXml({ entry, auth });
        }

        async function updateWESTNET() {
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Westnet" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseWestnetXml({ entry, auth });
        }

        async function scrapQUEST() {
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "QUEST" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseQuestXml({ entry, auth });
        }

    },

    async parseLogicomXml({ entry, auth }) {
        try {
            // const parser = new xml2js.Parser();
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            // console.log(products)

            if (products.length === 0)
                return { "message": "xml is empty" }

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const { mapCharNames, mapCharValues } = importRef.charMaps

            const { browser, page } =
                await strapi
                    .plugin('import-products')
                    .service('logicomHelper')
                    .scrapLogicom();
            try {
                for (let dt of products) {
                    let mpn = dt.ItemCode[0].trim().toString()
                    let name = dt.ItemTitle[0].trim()
                    let barcode = dt.EANBarcode ? dt.EANBarcode[0].trim() : null
                    let brand_name = dt.Brand[0].trim()

                    const { entryCheck, brandId } = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                    const product = {
                        entry,
                        name,
                        // supplierCode: dt.product_id[0].trim(),
                        // description: dt.description, 
                        category: { title: dt.Cat1_Desc[0].trim() },
                        subcategory: dt.Cat2_Desc[0] ? { title: dt.Cat2_Desc[0].trim() } : { title: null },
                        sub2category: dt.Cat3_Desc[0] ? { title: dt.Cat3_Desc[0].trim() } : { title: null },
                        mpn,
                        barcode,
                        // slug: dt.partNumber ? 
                        //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                        //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                        // publishedAt: new Date(),
                        stockLevel: dt.StockLevel[0].trim(),
                        wholesale: parseFloat(dt.NetPrice[0].replace(',', '.')).toFixed(2),
                        // imagesSrc: dt.imagesSrc,
                        brand: { id: await brandId },
                        // retail_price: dt.retail_price,
                        recycleTax: parseFloat(dt.RecycleTax[0].replace(',', '.')).toFixed(2),
                        // link: dt.url[0].trim(),
                        // related_import: entry.id,
                        // prod_chars: dt.prod_chars
                    }

                    //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                    if (!entryCheck) {
                        try {
                            const { scrap, productUrl } =
                                await strapi
                                    .plugin('import-products')
                                    .service('logicomHelper')
                                    .scrapLogicomProduct(page, mpn);

                            const { prod_chars, imagesSrc } = await scrap

                            // Προσθέτω τις πληροφορίες που πήρα από scrapping
                            product.prod_chars = await prod_chars;
                            // product.barcode = EAN ? EAN : null;
                            // product.brand = { id: brandId };
                            product.supplierInfo = [{
                                name: entry.name,
                                wholesale: product.wholesale,
                                recycle_tax: product.recycleTax,
                                supplierProductId: dt.ItemCode[0].trim().toString(),
                                supplierProductURL: productUrl,
                                price_progress: [{
                                    date: new Date(),
                                    price: product.wholesale,
                                }]
                            }]

                            product.imagesSrc = dt.PictureURL[0] !== "" ? dt.PictureURL[0] : imagesSrc;

                            // console.log({ name: product.name, xmlImage: dt.PictureURL[0], imagesSrc })
                            console.log({ Product: product })

                            // await strapi
                            //     .plugin('import-products')
                            //     .service('helpers')
                            //     .createEntry(parsedDataTitles, product, importRef,
                            //         prod_chars, mapCharNames, mapCharValues, imagesSrc, auth);

                        } catch (error) {
                            console.log(error)
                        }
                    }
                    else {
                        try {
                            const { scrap, productUrl } =
                                await strapi
                                    .plugin('import-products')
                                    .service('logicomHelper')
                                    .scrapLogicom(product.mpn);

                            // await strapi
                            //     .plugin('import-products')
                            //     .service('helpers')
                            //     .updateEntry(parsedDataTitles, entryCheck, importRef, productUrl);

                        } catch (error) {
                            console.log(error)
                        }
                    }
                }
            } catch (error) {
                await browser.close()
            }
            finally {
                await browser.close()
            }

            // await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .deleteEntry(entry, importRef);

            console.log(importRef)
            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err);
        }
    },

    async parseOktabitXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const { products, downloadingAllSuccess } = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            if (products.message) {
                return { message: "Error" }
            }

            for (let dt of products) {

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(dt.mpn, dt.name, dt.barcode, dt.brand_name, null);

                //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                let productUrl = `http://www.oktabit.gr/product_details.asp?productid=${dt.supplierCode}`


                const product = {
                    entry,
                    name: dt.name,
                    supplierCode: dt.supplierCode,
                    description: dt.description,
                    category: { title: dt.category.title },
                    subcategory: { title: dt.subcategory.title },
                    sub2category: { title: dt.sub2category.title },
                    mpn: dt.mpn.toString(),
                    barcode: dt.barcode.toString(),
                    // slug: dt.partNumber ? 
                    //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    // publishedAt: new Date(),
                    stockLevel: dt.stockLevel,
                    wholesale: dt.wholesale,
                    imagesSrc: dt.imagesSrc,
                    brand: { id: await brandId },
                    retail_price: dt.retail_price,
                    recycleTax: dt.recycleTax,
                    link: productUrl,
                    related_import: entry.id,
                    // supplierInfo: [{
                    //     name: entry.name,
                    //     in_stock: true,
                    //     wholesale: dt.price,
                    //     recycle_tax: dt.recycleTax,
                    //     supplierProductId: dt.supplierCode,
                    //     supplierProductURL: productUrl,
                    //     retail_price: dt.suggestedPrice,
                    //     price_progress: [{
                    //         date: new Date(),
                    //         wholesale: dt.price,
                    //     }]
                    // }],
                    prod_chars: dt.prod_chars
                }

                if (downloadingAllSuccess) {
                    if (product.prod_chars) {

                        let weightChar = product.prod_chars.find(x => x.name.includes("Βάρος"))
                        if (weightChar) {
                            if (weightChar.name.includes("κιλά") && !product.supplierCode === "281-69-ANPNAB2") {
                                if (weightChar.value.trim() !== "") {
                                    let result = weightChar.value.match(/\d{1,3}(.|,)\d{0,3}/gmi)
                                    let weightString = result.find(x => x !== undefined)
                                    if (weightString && weightString.trim() !== "") {
                                        let weight = parseFloat(weightString.replace("Kg", "").replace(",", ".").trim()) * 1000
                                        product.weight = parseInt(weight)
                                    }
                                }
                            }
                            else if (weightChar.name.includes("γραμμάρια") || product.supplierCode === "281-69-ANPNAB2") {
                                if (weightChar.value.trim() !== "") {
                                    let result = weightChar.value.match(/\d{1,5}/gmi)
                                    let weightString = result?.find(x => x !== undefined)
                                    if (weightString) {
                                        let weight = parseFloat(weightString.replace(",", ".").trim())
                                        product.weight = parseInt(weight)
                                    }
                                }
                            }
                        }

                        // let diminsionChar = product.prod_chars.find(x => x.name.includes("Διαστάσεις "))
                        // if (diminsionChar && diminsionChar.value.trim() !== "") {
                        //     let removedSpecial = diminsionChar.value.replace(/and#\d{3,4};/gmi, ' x ').replace("x", ' ')
                        //     let result = removedSpecial.replace("/", "-").match(/(\d+((\.|\,)\d+)?|\d+((\.|\,)\d+)?-\d+((\.|\,)\d+)?)\s*(x|and#215;|and#8206;|\s)\s*(\d+((\.|\,)\d+)?|\d+((\.|\,)\d+)?-\d+((\.|\,)\d+)?)\s*(x|and#215;|and#8206;|\s)\s*(\d+((\.|\,)\d+)?|\d+((\.|\,)\d+)?-\d+((\.|\,)\d+)?)/gmi)

                        //     let dim = result[result.length - 1].match(/\d+((\.|\,)\d+)?/gmi)
                        //     let length = dim[0].match(/\d+((\.|\,)\d+)?/gmi)[0].replace(",", ".").trim()
                        //     product.length = length.includes("-") ? length.split("-")[1] : length
                        //     let width = dim[1].match(/\d+((\.|\,)\d+)?/gmi)[0].replace(",", ".").trim()
                        //     product.width = width.includes("-") ? width.split("-")[1] : width
                        //     let height = dim[2].match(/\d+((\.|\,)\d+)?/gmi)[0].replace(",", ".").trim()
                        //     product.height = height.includes("-") ? height.split("-")[1] : height

                        // }
                    }
                }

                //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {
                    if (downloadingAllSuccess) {
                        try {
                            const response = await strapi
                                .plugin('import-products')
                                .service('helpers')
                                .createEntry(product, importRef, auth);

                            await response
                        } catch (error) {
                            console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                        }
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }

            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
        }
    },

    async parseZegetronXml({ entry, auth }) {
        try {

            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            if (products.length === 0)
                return { "message": "xml is empty" }

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap



            const { mapCharNames, mapCharValues } = importRef.charMaps
            for (let dt of products) {

                let mpn = dt.part_number[0].trim().toString()
                let name = dt.title[0].trim()
                let barcode = dt.barcode ? dt.barcode[0].trim() : null
                let brand_name = dt.manufacturer[0].trim()

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                const product = {
                    entry,
                    name,
                    supplierCode: dt.product_id[0].trim(),
                    // description: dt.description, 
                    category: { title: dt.category[0].trim() },
                    subcategory: { title: null },
                    sub2category: { title: null },
                    mpn,
                    barcode,
                    weight: dt.weight ? dt.weight[0] : 0,
                    length: dt.length ? parseFloat(dt.length[0].replace(',', '.')).toFixed(2) : 0,
                    width: dt.width ? parseFloat(dt.width[0].replace(',', '.')).toFixed(2) : 0,
                    height: dt.height ? parseFloat(dt.height[0].replace(',', '.')).toFixed(2) : 0,
                    // slug: dt.partNumber ? 
                    //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    // publishedAt: new Date(),
                    quantity: parseInt(dt.stock[0]),
                    wholesale: parseFloat(dt.price[0].replace(',', '.')).toFixed(2),
                    // imagesSrc: dt.imagesSrc,
                    brand: { id: await brandId },
                    retail_price: parseFloat(dt.suggested_retail_price[0].replace(',', '.')).toFixed(2),
                    recycleTax: parseFloat(dt.recycling_fee[0].replace(',', '.')).toFixed(2),
                    // link: dt.url[0].trim(),
                    related_import: entry.id,
                    // prod_chars: dt.prod_chars
                }

                const stripContent = dt.description[0]?.replace(/(<([^>]+)>)/ig, '').trim();

                product.description = stripContent ? stripContent : ""

                // const chars = []

                // if (dt.product_chars) {
                //     for (let productChar of dt.product_chars[0].char) {
                //         const char = {}
                //         char.name = productChar.char_name[0]
                //         char.value = productChar.char_value[0]
                //         chars.push(char)
                //     }

                //     const parsedChars = await strapi
                //         .plugin('import-products')
                //         .service('helpers')
                //         .parseChars(chars, mapCharNames, mapCharValues)

                //     product.prod_chars = parsedChars
                // }


                const imageUrls = []
                if (dt.images[0].image && dt.images[0].image.length > 0) {
                    for (let image of dt.images[0].image) {
                        if (imageUrls.length >= 5)
                            break;
                        imageUrls.push({ url: image })
                    }

                    product.imagesSrc = imageUrls
                }

                //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {

                    try {
                        const response = await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                        await response
                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }

            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log(importRef)

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err);
        }
    },

    async parseGlobalsat({ entry, auth }) {
        const importRef = await strapi
            .plugin('import-products')
            .service('helpers')
            .createImportRef(entry);

        const response = await strapi
            .plugin('import-products')
            .service('globalsatHelper')
            .scrapGlobalsat(importRef, entry, auth);


        if (response && response.message === "error") {
            console.log("AN error occured")
            await strapi.entityService.update('plugin::import-products.importxml', entry.id,
                {
                    data: {
                        lastRun: new Date(),
                        report: `Created: ${importRef.created}, Updated: ${importRef.updated},Republished: ${importRef.republished} Skipped: ${importRef.skipped}, Deleted: ${importRef.deleted},
                            Δημιουργήθηκε κάποιο σφάλμα κατά τη διαδικάσία. Ξαναπροσπασθήστε!`,
                    },
                })
        }
        else {
            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);
        }

        console.log("End of Import")
        return { "message": "ok" }

    },

    async parseWestnetXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const { mapCharNames, mapCharValues } = importRef.charMaps
            let index = 0
            for (let dt of products) {

                let mpn = dt.partNumber[0].trim().toString()
                let name = dt.name[0].trim()
                let barcode = dt.barCode ? dt.barCode[0].trim() : null
                let brand_name = dt.manufacturer[0].trim()

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                let productUrl = `https://www.mywestnet.com/el${dt.url[0]}`

                const chars = []

                if (dt.specs[0].spec) {
                    for (let productChar of dt.specs[0].spec) {
                        const char = {}
                        char.name = productChar.name[0]
                        char.value = productChar.value[0]
                        chars.push(char)
                    }
                }

                const parsedChars = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .parseChars(chars, mapCharNames, mapCharValues)

                const product = {
                    entry,
                    name,
                    supplierCode: dt.id[0],
                    description: dt.description[0],
                    category: { title: dt.category[0] },
                    subcategory: { title: null },
                    sub2category: { title: null },
                    mpn,
                    barcode,
                    // slug: dt.partNumber ? 
                    //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    // publishedAt: new Date(),
                    stockLevel: parseInt(dt.availability[0]),
                    wholesale: parseFloat(dt.price[0]).toFixed(2),
                    imagesSrc: [{ url: dt.image[0] }],
                    brand: { id: await brandId },
                    recycleTax: parseFloat(dt.recycle_tax[0].replace(",", ".")).toFixed(2),
                    link: productUrl,
                    related_import: entry.id,
                    // supplierInfo: [{
                    //     name: entry.name,
                    //     in_stock: true,
                    //     wholesale: dt.price,
                    //     recycle_tax: dt.recycleTax,
                    //     supplierProductId: dt.supplierCode,
                    //     supplierProductURL: productUrl,
                    //     retail_price: dt.suggestedPrice,
                    //     price_progress: [{
                    //         date: new Date(),
                    //         wholesale: dt.price,
                    //     }]
                    // }],
                    prod_chars: parsedChars
                }

                let weightChar = chars.find(x => x.name === "Weight")
                if (weightChar) {
                    if (weightChar.value.includes("GW")) {
                        let result = weightChar.value.match(/GW: \d{1,3}(.|,|\s)\d{0,3}\s*kgs/gmi)
                        let weightString = result.find(x => x !== undefined)
                        let weight = parseFloat(weightString.replace("GW: ", "").replace("kgs", "").replace(",", ".").trim()) * 1000
                        product.weight = parseInt(weight)
                    }
                    else if (weightChar.value.includes("Gross")) {
                        let result = weightChar.value.match(/Gross \d{1,3}(.|,|\s)\d{0,3}\s*kg/gmi)
                        let weightString = result.find(x => x !== undefined)
                        let weight = parseFloat(weightString.replace("Gross ", "").replace("kgs", "").replace(",", ".").trim()) * 1000
                        product.weight = parseInt(weight)
                    }
                    else if (weightChar.value.includes("kg") || weightChar.value.includes("Kg")) {
                        let result = weightChar.value.match(/\d{1,3}(.|,|\s)\d{0,3}\s*kg/gmi)
                        let weightString = result.find(x => x !== undefined)
                        let weight = parseFloat(weightString.replace("kg", "").replace(",", ".").trim()) * 1000
                        product.weight = parseInt(weight)
                    }
                    else if (weightChar.value.includes("grams")) {
                        let result = weightChar.value.match(/\d{1,5}\s*grams/gmi)
                        let weightString = result.find(x => x !== undefined)
                        let weight = parseFloat(weightString.replace("kg", "").replace(",", ".").trim())
                        product.weight = parseInt(weight)
                    }
                    else if (weightChar.value.includes("g")) {
                        let result = weightChar.value.match(/\d{1,5}\s*g/gmi)
                        let weightString = result.find(x => x !== undefined)
                        let weight = parseFloat(weightString.replace("kg", "").replace(",", ".").trim())
                        product.weight = parseInt(weight)
                    }
                    else {
                        let result = weightChar.value.match(/\d{1,3}(.|,)\d{0,3}/gmi)
                        let weightString = result.find(x => x !== undefined)
                        let weight = parseFloat(weightString.replace(",", ".").trim()) * 1000
                        product.weight = parseInt(weight)
                    }
                }


                let diminsionChar = chars.find(x => x.name.includes("Dimensions"))

                if (diminsionChar && diminsionChar.value.trim() !== "") {

                    if (diminsionChar.value.includes("mm")) {
                        let result = diminsionChar.value.match(/\d+((\.|\,)\d+)?/gmi)
                        if (!result || result.length < 3) { continue }
                        let length = parseFloat(result[0].replace(",", ".").trim())* 10
                        product.length = parseInt(length)
                        let width = parseFloat(result[1].replace(",", ".").trim())* 10
                        product.width = parseInt(width)
                        let height = parseFloat(result[2].replace(",", ".").trim())* 10
                        product.height = parseInt(height)
                    } 
                    else {
                        let result = diminsionChar.value.match(/\d+((\.|\,)\d+)?/gmi)
                        if (!result || result.length < 3) { continue }
                        let length = parseFloat(result[0].replace(",", ".").trim()) 
                        product.length = parseInt(length)
                        let width = parseFloat(result[1].replace(",", ".").trim())
                        product.width = parseInt(width)
                        let height = parseFloat(result[2].replace(",", ".").trim())
                        product.height = parseInt(height)
                    }

                    // let removedSpecial = diminsionChar.value.replace(/and#\d{3,4};/gmi, ' x ').replace("x", ' ')
                    // let result = removedSpecial.replace("/", "-").match(/(\d+((\.|\,)\d+)?|\d+((\.|\,)\d+)?-\d+((\.|\,)\d+)?)\s*(x|and#215;|and#8206;|\s)\s*(\d+((\.|\,)\d+)?|\d+((\.|\,)\d+)?-\d+((\.|\,)\d+)?)\s*(x|and#215;|and#8206;|\s)\s*(\d+((\.|\,)\d+)?|\d+((\.|\,)\d+)?-\d+((\.|\,)\d+)?)/gmi)

                    // let dim = result[result.length - 1].match(/\d+((\.|\,)\d+)?/gmi)


                }

                //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }
            } 

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err)
            return { "message": "Error" }
        }
    },

    async parseGerasisXml({ entry, auth }) {
        try {

            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            if (products.length === 0)
                return { "message": "xml is empty" }

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const { mapCharNames, mapCharValues } = importRef.charMaps

            for (let dt of products) {

                let mpn = dt.mpn[0].trim().toString()
                let name = dt.name[0].trim()
                let barcode = dt.barcode ? dt.barcode[0].trim() : null
                let brand_name = dt.manufacturer[0].trim()
                let weightFromData = null
                if (dt.weight) {
                    weightFromData = parseFloat(dt.weight[0].replace("kg", "").replace(",", ".").trim()) * 1000
                }

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                const product = {
                    entry,
                    name,
                    supplierCode: dt.product_id[0].trim(),
                    // description: dt.description, 
                    category: { title: dt.product_categories[0].category_path[0]._.split("->")[0].trim() },
                    subcategory: dt.product_categories[0].category_path[0]._.split("->")[1] ? { title: dt.product_categories[0].category_path[0]._.split("->")[1].trim() } : { title: null },
                    sub2category: dt.product_categories[0].category_path[0]._.split("->")[2] ? { title: dt.product_categories[0].category_path[0]._.split("->")[2].trim() } : { title: null },
                    mpn,
                    barcode,
                    weight: weightFromData ? parseInt(weightFromData) : 0,
                    // slug: dt.partNumber ? 
                    //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    // publishedAt: new Date(),
                    stockLevel: dt.instock[0].trim(),
                    wholesale: parseFloat(dt.price[0].price_original[0].replace(',', '.')).toFixed(2),
                    // imagesSrc: dt.imagesSrc,
                    brand: { id: await brandId },
                    // retail_price: dt.retail_price,
                    // recycleTax: dt.recycleTax,
                    link: dt.url[0].trim(),
                    related_import: entry.id,

                    // prod_chars: dt.prod_chars
                }

                const stripContent = dt.description[0]?.replace(/(<([^>]+)>)/ig, '').trim();

                product.description = stripContent ? stripContent : ""

                const chars = []

                if (dt.product_chars) {
                    for (let productChar of dt.product_chars[0].char) {
                        const char = {}
                        char.name = productChar.char_name[0]
                        char.value = productChar.char_value[0]
                        chars.push(char)
                    }

                    const parsedChars = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .parseChars(chars, mapCharNames, mapCharValues)

                    product.prod_chars = parsedChars
                }

                const imageUrls = []
                if (dt.images[0].image_url) {
                    for (let image of dt.images[0].image_url) {
                        imageUrls.push({ url: image._ })
                    }

                    product.imagesSrc = imageUrls
                }

                //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {

                    try {
                        const response = await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                        await response
                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }

            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err);
        }
    },

    async parseNovatronXml({ entry, auth }) {
        try {

            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            let response = await strapi
                .plugin('import-products')
                .service('novatronHelper')
                .scrapNovatronCategories(importRef, entry, auth);

            if (response && response.message === "error") {
                await strapi.entityService.update('plugin::import-products.importxml', entry.id,
                    {
                        data: {
                            lastRun: new Date(),
                            report: `Created: ${importRef.created}, Updated: ${importRef.updated},Republished: ${importRef.republished} Skipped: ${importRef.skipped}, Deleted: ${importRef.deleted},
                            Δημιουργήθηκε κάποιο σφάλμα κατά τη διαδικάσία. Ξαναπροσπασθήστε!`,
                        },
                    })
            }
            else {
                await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .deleteEntry(entry, importRef);
            }

            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
        }
    },

    async parseQuestXml({ entry, auth }) {
        try {

            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const response = await strapi
                .plugin('import-products')
                .service('questHelper')
                .scrapQuest(importRef, entry, auth);

            if (response && response.message === "error") {
                console.log("AN error occured")
                await strapi.entityService.update('plugin::import-products.importxml', entry.id,
                    {
                        data: {
                            lastRun: new Date(),
                            report: `Created: ${importRef.created}, Updated: ${importRef.updated},Republished: ${importRef.republished} Skipped: ${importRef.skipped}, Deleted: ${importRef.deleted},
                            Δημιουργήθηκε κάποιο σφάλμα κατά τη διαδικάσία. Ξαναπροσπαθήστε!`,
                        },
                    })
            }
            else {
                await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .deleteEntry(entry, importRef);

                // console.log(importRef)
            }

            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
        }
    },

    async parseDotMediaWithScrapping({ entry, auth }) {
        const browser = await strapi
            .plugin('import-products')
            .service('helpers')
            .createBrowser()

        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const login = await strapi
                .plugin('import-products')
                .service('dotMediaHelper')
                .loginToDotMedia(browser);

            await login
            const { mapCharNames, mapCharValues } = importRef.charMaps
            // let index = 0 
            for (let dt of products) {

                let mpn = dt.MakerID[0].trim().toString()
                let name = dt.Description[0].trim()
                let barcode = dt.BarCode ? dt.BarCode[0].trim() : null
                let brand_name = dt.Maker[0].trim()
                let wholesaleFromXml = parseFloat(dt.WholesalePrice[0].replace(",", ".")).toFixed(2)
                let suggestedRetailPriceFromXml = parseFloat(dt.Suggested_x0020_Retail_x0020_Price[0].replace(",", ".")).toFixed(2)
                let suggestedWebPriceFromXml = parseFloat(dt.Suggested_x0020_Web_x0020_Price[0].replace(",", ".")).toFixed(2)

                const { wholesale, initial_wholesale } = await strapi
                    .plugin('import-products')
                    .service('dotMediaHelper')
                    .getPrices(wholesaleFromXml, suggestedRetailPriceFromXml, suggestedWebPriceFromXml, dt.ProIDLink[0].trim(), browser);

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                // let chars = dt.DetailedDescriptionPre[0].split('\n')


                let imageUrls = [{ url: dt.ImageLink[0] },
                { url: dt.ImageLink2[0] },
                { url: dt.ImageLink3[0] }]
                // const chars = [] 

                // if (dt.specs[0].spec) {
                //     for (let productChar of dt.specs[0].spec) {
                //         const char = {}
                //         char.name = productChar.name[0]
                //         char.value = productChar.value[0]
                //         chars.push(char)
                //     }
                // }

                // const parsedChars = await strapi
                //     .plugin('import-products')
                //     .service('helpers')
                //     .parseChars(chars, mapCharNames, mapCharValues)

                const product = {
                    entry,
                    name,
                    supplierCode: dt.ProductID[0],
                    short_description: dt.DetailedDescription[0],
                    description: `${dt.DetailedDescription[0]} Χαρακτηριστικά\n ${dt.DetailedDescriptionPre[0]}`,
                    category: { title: dt.Category[0] },
                    subcategory: { title: dt.SubCategory[0] },
                    sub2category: { title: dt.Category3[0] },
                    mpn,
                    barcode,
                    stockLevel: dt.Availability[0],
                    wholesale: parseFloat(wholesale.replace(",", ".")).toFixed(2),
                    initial_wholesale: initial_wholesale ? parseFloat(initial_wholesale.replace(",", ".")).toFixed(2) : null,
                    retail_price: suggestedWebPriceFromXml,
                    imagesSrc: imageUrls,
                    brand: { id: await brandId },
                    recycleTax: parseFloat(dt.Eisfora[0].replace(",", ".")).toFixed(2),
                    link: dt.ProIDLink[0].trim(),
                    related_import: entry.id,
                    // prod_chars: parsedChars
                }

                // console.log(product)

                let weight = []
                let weightInKilos = []
                let weightInKilos1 = dt.DetailedDescriptionPre[0].match(/(?<!Gross )Weight\s*:?\s*\d{1,3}(.|,|\s)\d{0,3}\s*kg/gmi)
                if (weightInKilos1 && weightInKilos1.length > 0)
                    weightInKilos.push(weightInKilos1)

                let weightInKilos2 = dt.DetailedDescriptionPre[0].match(/(?<!Gross )Weight\s*\(kg\)\s*:?\s*\d{1,3}(.|,|\s)\d{0,3}/gmi)
                if (weightInKilos2 && weightInKilos2.length > 0)
                    weightInKilos.push(weightInKilos2)

                if (weightInKilos.length > 0) {
                    let weightsList = []
                    let weightFlattenArray = weightInKilos.flat()
                    weightFlattenArray.forEach(wt => {
                        let result = wt.match(/\d{1,3}(.|,)\d{0,3}/)
                        if (result) { weightsList.push(result[0]) }
                    });
                    if (weightsList.length > 0) {
                        let maxWeight = weightsList?.reduce((prev, current) => {
                            return (parseFloat(prev.replace(",", ".")) > parseFloat(current.replace(",", "."))) ? prev : current
                        })
                        weight.push(parseFloat(maxWeight.replace(",", ".")) * 1000)
                    }
                }

                let weightInGrams = []
                let weightInGrams1 = dt.DetailedDescriptionPre[0].match(/Weight\s*:?\s*\d*\s*g/gmi)
                if (weightInGrams1 && weightInGrams1.length > 0)
                    weightInGrams.push(weightInGrams1)

                let weightInGrams2 = dt.DetailedDescriptionPre[0].match(/Weight\s*\((gram|g)\)\s*:?\s*\d*/gmi)
                if (weightInGrams2 && weightInGrams2.length > 0)
                    weightInGrams.push(weightInGrams2)

                if (weightInGrams.length > 0) {
                    let weightsList = []
                    let weightFlattenArray = weightInGrams.flat()
                    weightFlattenArray.forEach(wt => {
                        let result = wt.match(/\d{1,3}(.|,)\d{0,3}/)
                        if (result) { weightsList.push(result[0]) }
                    });
                    if (weightsList.length > 0) {
                        let maxWeight = weightsList?.reduce((prev, current) => {
                            return (parseFloat(prev.replace(",", ".")) > parseFloat(current.replace(",", "."))) ? prev : current
                        })
                        weight.push(parseFloat(maxWeight.replace(",", ".")))
                    }
                }

                if (weight.length > 0) {
                    let maxWeight = weight.reduce((prev, current) => {
                        return (parseFloat(prev) > parseFloat(current)) ? prev : current
                    })
                    product.weight = parseInt(maxWeight)
                }

                // console.log(product)
                // //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 


                if (!entryCheck) {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }
            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err)
            return { "message": "Error" }
        }
        finally {
            await browser.close()
        }
    },

    async parseDotMediaOnlyXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const { mapCharNames, mapCharValues } = importRef.charMaps
            // let index = 0 
            for (let dt of products) {

                let mpn = dt.MakerID[0].trim().toString()
                let name = dt.Description[0].trim()
                let barcode = dt.BarCode ? dt.BarCode[0].trim() : null
                let brand_name = dt.Maker[0].trim()
                let wholesale = parseFloat(dt.WholesalePrice[0].replace(",", ".")).toFixed(2)
                let suggestedRetailPriceFromXml = parseFloat(dt.Suggested_x0020_Retail_x0020_Price[0].replace(",", ".")).toFixed(2)
                let suggestedWebPriceFromXml = parseFloat(dt.Suggested_x0020_Web_x0020_Price[0].replace(",", ".")).toFixed(2)

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                // let chars = dt.DetailedDescriptionPre[0].split('\n')


                let imageUrls = [{ url: dt.ImageLink[0] },
                { url: dt.ImageLink2[0] },
                { url: dt.ImageLink3[0] }]
                // const chars = [] 

                // if (dt.specs[0].spec) {
                //     for (let productChar of dt.specs[0].spec) {
                //         const char = {}
                //         char.name = productChar.name[0]
                //         char.value = productChar.value[0]
                //         chars.push(char)
                //     }
                // }

                // const parsedChars = await strapi
                //     .plugin('import-products')
                //     .service('helpers')
                //     .parseChars(chars, mapCharNames, mapCharValues)

                const product = {
                    entry,
                    name,
                    supplierCode: dt.ProductID[0],
                    short_description: dt.DetailedDescription[0],
                    description: `${dt.DetailedDescription[0]} Χαρακτηριστικά\n ${dt.DetailedDescriptionPre[0]}`,
                    category: { title: dt.Category[0] },
                    subcategory: { title: dt.SubCategory[0] },
                    sub2category: { title: dt.Category3[0] },
                    mpn,
                    barcode,
                    stockLevel: dt.Availability[0],
                    wholesale: parseFloat(wholesale.replace(",", ".")).toFixed(2),
                    retail_price: suggestedWebPriceFromXml,
                    imagesSrc: imageUrls,
                    brand: { id: await brandId },
                    recycleTax: parseFloat(dt.Eisfora[0].replace(",", ".")).toFixed(2),
                    link: dt.ProIDLink[0].trim(),
                    related_import: entry.id,
                    // prod_chars: parsedChars
                }

                // console.log(product)

                let weight = []
                let weightInKilos = []
                let weightInKilos1 = dt.DetailedDescriptionPre[0].match(/(?<!Gross )Weight\s*:?\s*\d{1,3}(.|,|\s)\d{0,3}\s*kg/gmi)
                if (weightInKilos1 && weightInKilos1.length > 0)
                    weightInKilos.push(weightInKilos1)

                let weightInKilos2 = dt.DetailedDescriptionPre[0].match(/(?<!Gross )Weight\s*\(kg\)\s*:?\s*\d{1,3}(.|,|\s)\d{0,3}/gmi)
                if (weightInKilos2 && weightInKilos2.length > 0)
                    weightInKilos.push(weightInKilos2)

                if (weightInKilos.length > 0) {
                    let weightsList = []
                    let weightFlattenArray = weightInKilos.flat()
                    weightFlattenArray.forEach(wt => {
                        let result = wt.match(/\d{1,3}(.|,)\d{0,3}/)
                        if (result) { weightsList.push(result[0]) }
                    });
                    if (weightsList.length > 0) {
                        let maxWeight = weightsList?.reduce((prev, current) => {
                            return (parseFloat(prev.replace(",", ".")) > parseFloat(current.replace(",", "."))) ? prev : current
                        })
                        weight.push(parseFloat(maxWeight.replace(",", ".")) * 1000)
                    }
                }

                let weightInGrams = []
                let weightInGrams1 = dt.DetailedDescriptionPre[0].match(/Weight\s*:?\s*\d*\s*g/gmi)
                if (weightInGrams1 && weightInGrams1.length > 0)
                    weightInGrams.push(weightInGrams1)

                let weightInGrams2 = dt.DetailedDescriptionPre[0].match(/Weight\s*\((gram|g)\)\s*:?\s*\d*/gmi)
                if (weightInGrams2 && weightInGrams2.length > 0)
                    weightInGrams.push(weightInGrams2)

                if (weightInGrams.length > 0) {
                    let weightsList = []
                    let weightFlattenArray = weightInGrams.flat()
                    weightFlattenArray.forEach(wt => {
                        let result = wt.match(/\d{1,3}(.|,)\d{0,3}/)
                        if (result) { weightsList.push(result[0]) }
                    });
                    if (weightsList.length > 0) {
                        let maxWeight = weightsList?.reduce((prev, current) => {
                            return (parseFloat(prev.replace(",", ".")) > parseFloat(current.replace(",", "."))) ? prev : current
                        })
                        weight.push(parseFloat(maxWeight.replace(",", ".")))
                    }
                }

                if (weight.length > 0) {
                    let maxWeight = weight.reduce((prev, current) => {
                        return (parseFloat(prev) > parseFloat(current)) ? prev : current
                    })
                    product.weight = parseInt(maxWeight)
                }

                // console.log(product)
                // //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 


                if (!entryCheck) {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }
            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err)
            return { "message": "Error" }
        }
    },

    async parseTelehermesXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            // console.log("products:", products)
            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const { mapCharNames, mapCharValues } = importRef.charMaps

            for (let dt of products) {

                let mpn = dt.mpn[0].trim().toString()
                let name = dt.title[0].trim()
                let barcode = dt.ean ? dt.ean[0].trim() : null
                let brand_name = dt.manufacturer[0].trim()

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                // let productUrl = `https://www.mywestnet.com/el${dt.url[0]}`


                const chars = []

                if (dt.specifications && dt.specifications[0].item) {
                    for (let productChar of dt.specifications[0].item) {

                        if (productChar.$.key.trim() === "Κατάσταση")
                            continue

                        const char = {}
                        char.name = productChar.$.key
                        char.value = productChar.$.value
                        chars.push(char)
                    }
                }

                const parsedChars = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .parseChars(chars, mapCharNames, mapCharValues)

                const product = {
                    entry,
                    name,
                    supplierCode: dt.sku[0],
                    description: dt.full_description[0],
                    short_description: dt.short_description[0],
                    category: { title: dt.category_level_1[0] },
                    subcategory: { title: dt.category_level_2[0] },
                    sub2category: { title: null },
                    mpn,
                    barcode,
                    // slug: dt.partNumber ? 
                    //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    // publishedAt: new Date(),
                    stockLevel: parseInt(dt.availability[0]),
                    wholesale: parseFloat(dt.wholesale_price[0]).toFixed(2),
                    imagesSrc: [{ url: dt.image[0] }],
                    brand: { id: await brandId },
                    retail_price: parseFloat(dt.retail_price[0]).toFixed(2),
                    related_import: entry.id,
                    // supplierInfo: [{
                    //     name: entry.name,
                    //     in_stock: true,
                    //     wholesale: dt.price,
                    //     recycle_tax: dt.recycleTax,
                    //     supplierProductId: dt.supplierCode,
                    //     supplierProductURL: productUrl,
                    //     retail_price: dt.suggestedPrice,
                    //     price_progress: [{
                    //         date: new Date(),
                    //         wholesale: dt.price,
                    //     }]
                    // }],
                    prod_chars: parsedChars
                }

                // αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }
            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err)
            return { "message": "Error" }
        }
    },

    async parseSmart4AllXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const { products, productsInExcel } = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            // console.log("products:", productsInExcel)
            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            const { mapCharNames, mapCharValues } = importRef.charMaps

            for (let dt of products) {
                let productInExcel = productsInExcel.find(x => {
                    // console.log(x.EAN, "   ", dt.BARCODE[0], Number(x.EAN) === Number(dt.BARCODE[0]))
                    return Number(x.EAN) === Number(dt.BARCODE[0])
                })
                if (!productInExcel)
                    continue

                let mpn = productInExcel.PN.trim().toString()
                let name = productInExcel["Περιγραφή"].trim()
                let barcode = dt.BARCODE ? dt.BARCODE[0].trim() : null
                let brand_name = dt.MANUFACTURER[0].trim()

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(mpn, name, barcode, brand_name, null);

                // //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                // // let productUrl = `https://www.mywestnet.com/el${dt.url[0]}`

                let typeOfPhone = ''
                const chars = []

                if (dt.FEATURES && dt.FEATURES[0].FEATURE) {
                    for (let productChar of dt.FEATURES[0].FEATURE) {
                        if (dt.CATEGORY[0].trim() === 'Τηλεφωνία > Phones') {
                            if (productChar.FEATURE_NAME[0].trim() === 'Τύπος Συσκευής'
                                && productChar.FEATURE_VALUE[0].trim() === 'Feature Phone / Bar') {
                                typeOfPhone = "Κινητό"
                            }
                        }
                        const char = {}
                        char.name = productChar.FEATURE_NAME[0]
                        char.value = productChar.FEATURE_VALUE[0]
                        chars.push(char)
                    }
                }

                const parsedChars = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .parseChars(chars, mapCharNames, mapCharValues)

                let categories = dt.CATEGORY[0].split(">")
                let category = categories[0] ? categories[0].trim() : null
                let subcategory = categories[1] ? categories[1].trim() : null
                let sub2category = typeOfPhone !== "" ? typeOfPhone : (categories[2] ? categories[2].trim() : null)

                const product = {
                    entry,
                    name,
                    supplierCode: dt.ID[0],
                    description: dt.DESCRIPTION[0],
                    short_description: dt.SHORT_DESCRIPTION[0],
                    category: { title: category },
                    subcategory: { title: subcategory },
                    sub2category: { title: sub2category },
                    mpn,
                    barcode,
                    wholesale: parseFloat(dt.WHOLESALE_PRICE[0]).toFixed(2),
                    imagesSrc: [{ url: dt.IMAGE[0] }],
                    brand: { id: await brandId },
                    related_import: entry.id,
                    // supplierInfo: [{
                    //     name: entry.name,
                    //     in_stock: true,
                    //     wholesale: dt.price,
                    //     recycle_tax: dt.recycleTax,
                    //     supplierProductId: dt.supplierCode,
                    //     supplierProductURL: productUrl,
                    //     retail_price: dt.suggestedPrice,
                    //     price_progress: [{
                    //         date: new Date(),
                    //         wholesale: dt.price,
                    //     }]
                    // }],
                    prod_chars: parsedChars
                }

                // αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(product, importRef, auth);

                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt.title)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(entryCheck, product, importRef);
                    } catch (error) {
                        console.log(error)
                    }
                }
            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log("End of Import")
            return { "message": "ok" }
        }
        catch (err) {
            console.log(err)
            return { "message": "Error" }
        }
    },

    async parseDamkalidisXml({ entry, auth }) {
        try {
            const importRef = {
                created: 0,
                updated: 0,
                republished: 0,
                deleted: 0,
                related_entries: []
            }
            // let created = 0
            // let updated = 0
            // let deleted = 0
            // const related_entries = []

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry);

            // console.log(data)

            // async function readWestnetFile() {

            //     let req = Axios.get(`${entry.importedURL}`)
            //         .then((data) => { return data })

            //     return await req
            // }

            // function parseXml(xml) {
            //     return new Promise((resolve, reject) => {
            //         parser.parseString(xml, (err, result) => {
            //             if (err) {
            //                 reject(err);
            //             } else {
            //                 resolve(result);
            //             }
            //         });
            //     });
            // }

            // async function parseWestnet(result) {
            //     // try {

            //     if (result.products.length === 0 || result.products?.product.length === 0)
            //         return

            //     const categoryMap = await strapi
            //         .plugin('import-products')
            //         .service('helpers')
            //         .getImportMapping(entry);

            //     const { categories_map, char_name_map, char_value_map, stock_map,
            //         isWhitelistSelected, whitelist_map, blacklist_map } = await categoryMap

            //     const newData = result.products.product
            //         .filter(filterStock)
            //         .filter(filterCategories)

            //     function filterStock(stockName) {
            //         if (stock_map.length > 0) {
            //             let catIndex = stock_map.findIndex(x => parseInt(x.name.trim()) < parseInt(stockName.availability[0].trim()))
            //             if (catIndex !== -1) {
            //                 return true
            //             }
            //             else {
            //                 return false
            //             }
            //         }
            //         else {
            //             return true
            //         }
            //     }

            //     function filterCategories(cat) {
            //         if (isWhitelistSelected) {
            //             if (whitelist_map.length > 0) {
            //                 let catIndex = whitelist_map.findIndex(x => x.name.trim() === cat.category[0].trim())
            //                 if (catIndex !== -1) {
            //                     return true
            //                 }
            //                 else {
            //                     return false
            //                 }
            //             }
            //             return true
            //         }
            //         else {
            //             if (blacklist_map.length > 0) {
            //                 let catIndex = blacklist_map.findIndex(x => x.name.trim() === cat.category[0].trim())
            //                 if (catIndex !== -1) {
            //                     return false
            //                 }
            //                 else {
            //                     return true
            //                 }
            //             }
            //             return true
            //         }
            //     }

            //     console.log(newData.length)

            //     const { mapCharNames, mapCharValues } = importRef.charMaps

            //     for (let dt of newData) {

            //         let mpn = dt.partNumber[0].toString()

            //         const entryCheck = await strapi
            //             .plugin('import-products')
            //             .service('helpers')
            //             .checkIfProductExists(mpn);

            //         const brandId = await strapi
            //             .plugin('import-products')
            //             .service('helpers')
            //             .brandIdCheck(dt.manufacturer[0].trim());

            //         //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 
            //         if (!entryCheck) {
            //             try {
            //                 const imageUrls = [dt.image[0]]

            //                 const prod_chars = []

            //                 dt.specs[0].spec.forEach(spec => {
            //                     prod_chars.push({
            //                         name: spec.name[0].trim(),
            //                         value: spec.value[0].trim(),
            //                     })
            //                 });

            //                 //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
            //                 const parsedChars = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .parseChars(prod_chars, mapCharNames, mapCharValues)

            //                 const categoryInfo = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .getCategory(categories_map, dt.name[0], dt.category[0], null, null);

            //                 const productPrice = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .setPriceOnCreation(dt.price[0], categoryInfo, brandId);

            //                 const data = {
            //                     name: dt.name[0],
            //                     description: dt.description ? dt.description[0] : null,
            //                     categories: categoryInfo.id,
            //                     price: parseFloat(productPrice),
            //                     mpn: mpn ? mpn : null,
            //                     barcode: dt.barCode ? dt.barCode[0] : null,
            //                     slug: slugify(`${dt.name[0]}-${mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g }),
            //                     publishedAt: new Date(),
            //                     status: 'InStock',
            //                     brand: { id: brandId },
            //                     related_import: entry.id,
            //                     supplierInfo: [{
            //                         name: entry.name,
            //                         wholesale: dt.price[0],
            //                         recycle_tax: dt.recycle_tax[0],
            //                         supplierProductId: dt.id[0].toString(),
            //                         in_offer: dt.in_offer[0]
            //                     }],
            //                     prod_chars: parsedChars
            //                 }

            //                 const newEntry = await strapi.entityService.create('api::product.product', {
            //                     data: data,
            //                 });

            //                 related_entries.push(newEntry.id)
            //                 created += 1;

            //                 console.log(imageUrls)

            //                 let responseImage = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .getAndConvertImgToWep(imageUrls, data, newEntry.id, auth);

            //                 const { mainImageID } = await responseImage
            //                 let imgID = mainImageID.data ? mainImageID.data[0] : undefined

            //                 //Δημιουργώ αυτόματα το SEO για το προϊόν
            //                 await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .saveSEO(imgID, data, newEntry.id);

            //             } catch (error) {
            //                 console.log(error)
            //             }
            //         }
            //         else {
            //             try {
            //                 related_entries.push(entryCheck.id)
            //                 const supplierInfo = entryCheck.supplierInfo
            //                 const relatedImport = entryCheck.related_import;
            //                 const relatedImportId = []
            //                 relatedImport.forEach(x => {
            //                     relatedImportId.push(x.id)
            //                 })
            //                 relatedImportId.push(entry.id)
            //                 let searchSupplierInfo = supplierInfo.find((o, i) => {
            //                     if (o.name === entry.name) {
            //                         supplierInfo[i] = {
            //                             name: entry.name,
            //                             wholesale: dt.price[0],
            //                             recycle_tax: dt.recycle_tax[0],
            //                             supplierProductId: dt.id[0].toString(),
            //                         }
            //                         return true;
            //                     }
            //                 })


            //                 if (!searchSupplierInfo) {
            //                     supplierInfo.push({
            //                         name: entry.name,
            //                         wholesale: dt.price[0],
            //                         recycle_tax: dt.recycle_tax[0],
            //                         supplierProductId: dt.id.toString(),
            //                     })
            //                 }

            //                 const productPrice = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .setPriceOnUpdate(entryCheck, supplierInfo);

            //                 await strapi.entityService.update('api::product.product', entryCheck.id, {
            //                     data: {
            //                         price: parseFloat(productPrice),
            //                         supplierInfo: supplierInfo,
            //                         related_import: relatedImportId
            //                     },
            //                 });
            //                 updated += 1
            //             } catch (error) {
            //                 console.log(error)
            //             }
            //         }
            //     }

            //     const importXmlFile = await strapi.entityService.findMany('plugin::import-products.importxml',
            //         {
            //             populate: { related_products: true },
            //             filters: { id: entry.id },
            //         });

            //     for (let product of importXmlFile[0].related_products) {

            //         if (!related_entries.includes(product.id)) {
            //             const checkProduct = await strapi.entityService.findOne('api::product.product', product.id, {
            //                 // fields: ['supplierInfo', 'name'],
            //                 populate: { supplierInfo: true },
            //             })

            //             let supplierInfo = checkProduct.supplierInfo

            //             if (supplierInfo.length > 1) {
            //                 const index = supplierInfo.findIndex((o) => {
            //                     return o.name === entry.name
            //                 })
            //                 supplierInfo.splice(index, 1)

            //                 await strapi.entityService.update('api::product.product', product.id, {
            //                     data: {
            //                         supplierInfo: supplierInfo,
            //                     },
            //                 });
            //                 updated += 1
            //             }
            //             else {
            //                 await strapi.entityService.delete('api::product.product', product.id);
            //                 deleted += 1;
            //             }
            //         }
            //     }

            //     const updateImport = await strapi.entityService.update('plugin::import-products.importxml', entry.id,
            //         {
            //             data: {
            //                 report: `Created: ${created}, Updated: ${updated}, Deleted: ${deleted}`,
            //             },
            //         })

            //     return { "message": "ok" }
            //     // } catch (error) {
            //     //     return { "message": "Error" }
            //     // }
            // }

            // const response = await readWestnetFile()
            //     .then((response) => parseXml(response.data))
            //     .then((result) => console.log(result))
            //     // .then((result) => parseWestnet(result))
            //     // .then((response) => {
            //     //     console.log("End of Import")
            //     //     if (response) {
            //     //         if (response.message === "Error") { return { "message": "Error" } }
            //     //         else { return { "message": "ok" } }
            //     //     }
            //     //     else {
            //     //         return { "message": "xml is empty" }
            //     //     }
            //     // })
            //     .catch((err) => console.log(err))

            // return response
        }
        catch (err) {
            return { "message": "Error" }
        }
    },
});
