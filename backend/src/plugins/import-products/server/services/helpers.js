'use strict';

const slugify = require("slugify");
const Axios = require('axios');
const { JSDOM } = require("jsdom");
const sharp = require('sharp');
const FormData = require("form-data");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const { env } = require("process");
const { format } = require("path");
const xml2js = require('xml2js');
const xlsx = require('xlsx')
const xpath = require('xpath')
const { DOMParser, XMLSerializer, DOMImplementation } = require('xmldom');
const { setTimeout } = require("timers/promises");
const _ = require('lodash');
const path = require("path");
const process = require('process');
const promisify = require('util').promisify;
const stream = require('stream');

module.exports = ({ strapi }) => ({

    async createBrowser() {
        puppeteer.use(StealthPlugin())
        return await puppeteer.launch({
            headless: false,
            executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    },

    async retry(promiseFactory, retryCount, isRetry) {

        try {
            return await promiseFactory();
        } catch (error) {
            if (retryCount <= 0) {
                throw error;
            }
            return await this.retry(promiseFactory, retryCount - 1, true);
        }
    },

    randomWait(min, max) {
        return Math.random() * (max - min) + min
    },

    async updateAndFilterScrapProducts(products, category, subcategory, sub2category, importRef, entry) {
        try {
            const newProducts = []
            let stockLevelFilter = []
            for (let stock of importRef.categoryMap.stock_map) {
                stockLevelFilter.push(stock.name)
            }

            for (let product of products) {
                product.entry = entry
                product.category = { title: category }
                product.sub2category = { title: sub2category }
                product.subcategory = { title: subcategory }

                if (stockLevelFilter.includes(product.stockLevel) && product.wholesale) {

                    const checkIfEntry = await strapi.db.query('api::product.product').findOne({
                        where: {
                            supplierInfo: {
                                supplierProductId: product.supplierCode
                            }
                        },
                        populate: {
                            supplierInfo: {
                                // where: {
                                //     // name: product.name,
                                //     supplierProductId: product.supplierCode
                                // },
                                populate: {
                                    price_progress: true,
                                }
                            },
                            brand: true,
                            related_import: true,
                            prod_chars: true,
                            category: {
                                populate: {
                                    cat_percentage: {
                                        populate: {
                                            brand_perc: {
                                                populate: {
                                                    brand: true
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            platform: true
                        },
                    });

                    if (checkIfEntry) {
                        if (checkIfEntry.related_import.find(x => x.name.toLowerCase() === "quest")) {
                            if (checkIfEntry.prod_chars.find(x => x.name === "Μεικτό βάρος")) {
                                let chars = checkIfEntry.prod_chars.find(x => x.name === "Μεικτό βάρος")
                                let weight = parseInt(chars.value.replace("kg", "").replace(",", ".").trim()) * 1000

                                product.weight = weight
                            }
                            else if (checkIfEntry.prod_chars.find(x => x.name === "Βάρος (κιλά)")) {
                                let chars = checkIfEntry.prod_chars.find(x => x.name === "Βάρος (κιλά)")
                                let weight = parseInt(chars.value.replace("kg", "").replace(",", ".").trim()) * 1000

                                product.weight = weight
                            }
                        }
                        else if (checkIfEntry.related_import.find(x => x.name.toLowerCase() === "globalsat")) {
                            if (checkIfEntry.prod_chars.find(x => x.name.toLowerCase().includes("βάρος") ||
                                x.name.toLowerCase().includes("specs"))) {
                                if (checkIfEntry.prod_chars.find(x => x.name.toLowerCase().includes("μεικτό βάρος"))) {
                                    let weightChar = checkIfEntry.prod_chars.find(x => x.name.toLowerCase().includes("μεικτό βάρος"))
                                    if (weightChar) {
                                        if (weightChar.value.toLowerCase().includes("kg")) {
                                            let result = weightChar.value.toLowerCase().match(/\d{1,3}(.|,|\s)?\d{0,3}\s*kg/gmi)
                                            if (result) {
                                                if (result[result.length - 1].match(/\d{1,3}(.|\s)?\d{0,3}\s*kg/gmi)) {
                                                    product.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(",", ".").trim()) * 1000
                                                    // console.log("weight:", weight)
                                                }
                                                else {
                                                    product.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(".", "").replace(",", ".").trim()) * 1000
                                                    // console.log("weight:", weight)
                                                }

                                            }
                                        }
                                        else if (weightChar.value.toLowerCase().includes("gr")) {
                                            let result = weightChar.value.toLowerCase().match(/\d*(.|,|\s)?\d{0,3}\s*gr/gmi)
                                            if (result[result.length - 1].match(/\d*.\d{3}\s*gr/gmi)) {
                                                product.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(".", "").trim())
                                                // console.log("weight:", weight)
                                            }
                                            else {
                                                product.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(",", ".").trim())
                                                // console.log("weight:", weight)
                                            }
                                        }
                                    }
                                }
                                else {
                                    let weightChar = checkIfEntry.prod_chars.find(x => x.name.toLowerCase().includes("βάρος"))
                                    if (weightChar) {
                                        if (weightChar.value.toLowerCase().includes("kg")) {
                                            let result = weightChar.value.toLowerCase().match(/\d{1,3}(.|,|\s)?\d{0,3}\s*kg/gmi)
                                            if (result) {
                                                if (result[result.length - 1].match(/\d{1,3}(.|\s)?\d{0,3}\s*kg/gmi)) {
                                                    product.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(",", ".").trim()) * 1000
                                                    // console.log("weight:", weight)
                                                }
                                                else {
                                                    product.weight = parseFloat(result[result.length - 1].replace("kg", "").replace(".", "").replace(",", ".").trim()) * 1000
                                                    // console.log("weight:", weight)
                                                }

                                            }
                                        }
                                        else if (weightChar.value.toLowerCase().includes("gr")) {
                                            let result = weightChar.value.toLowerCase().match(/\d*(.|,|\s)?\d{0,3}\s*gr/gmi)
                                            if (result[result.length - 1].match(/\d*.\d{3}\s*gr/gmi)) {
                                                product.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(".", "").trim())
                                                // console.log("weight:", weight)
                                            }
                                            else {
                                                product.weight = parseFloat(result[result.length - 1].replace("gr", "").replace(",", ".").trim())
                                                // console.log("weight:", weight)
                                            }
                                        }
                                    }

                                    let specsChar = checkIfEntry.prod_chars.find(x => x.name.toLowerCase().includes("specs"))
                                    if (specsChar) {
                                        if (specsChar.value.toLowerCase().includes("βάρος") || specsChar.value.toLowerCase().includes("weight")) {
                                            let result = specsChar.value.toLowerCase().match(/(βάρος|weight)\s?:\s?\d+(.)?\d+\s?gr?/gmi)
                                            if (result) {
                                                if (result[result.length - 1].match(/\d+.?\d+/gmi)) {
                                                    product.weight = parseFloat(result[result.length - 1].match(/\d+.?\d+/gmi)[0])
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        const brandID = await this.brandIdCheck(product.brand, product.name)

                        if (brandID) {
                            product.brand = {
                                id: brandID
                            }
                        }

                        if (checkIfEntry.brand && !checkIfEntry.brand.name.toLowerCase().includes("dahua"))
                            await this.updateEntry(checkIfEntry, product, importRef)
                    }
                    else {
                        newProducts.push(product)
                    }
                }
            }
            return newProducts
        } catch (error) {
            console.log(error)
        }

    },

    async createImportRef(entry) {
        const importRef = {
            created: 0,
            updated: 0,
            skipped: 0,
            deleted: 0,
            republished: 0,
            related_entries: [],
            related_products: [],
            charMaps: {},
        }

        importRef.categoryMap = await strapi
            .plugin('import-products')
            .service('helpers')
            .getImportMapping(entry);

        importRef.charMaps = await strapi
            .plugin('import-products')
            .service('helpers')
            .parseCharsToMap(importRef.categoryMap.char_name_map, importRef.categoryMap.char_value_map);

        return importRef

    },

    filterScrappedProducts(categoryMap, product) {
        try {
            let isPassingFilteres = true

            let stockLevelFilter = []
            for (let stock of categoryMap.stock_map) {
                stockLevelFilter.push(stock.name)
            }

            if (!stockLevelFilter.includes(product.stockLevel)) {
                isPassingFilteres = false
            }

            let minPrice = categoryMap.minimumPrice ? categoryMap.minimumPrice : 0;
            let maxPrice;
            if (categoryMap.maximumPrice && categoryMap.maximumPrice > 0) {
                maxPrice = categoryMap.maximumPrice;
            }
            else {
                maxPrice = 100000;
            }

            if (Number.isNaN(product.wholesale) || product.wholesale < minPrice || product.wholesale > maxPrice) {
                isPassingFilteres = false
            }

            return isPassingFilteres
        } catch (error) {
            console.log(error)
        }
    },

    createPriceProgress(product) {

        let price_progress = {
            date: new Date(),
        }

        if (product.in_offer) {
            price_progress.in_offer = product.in_offer
        }

        if (product.discount) {
            price_progress.discount = product.discount
        }

        if (product.initial_wholesale) {
            price_progress.initial_wholesale = parseFloat(product.initial_wholesale).toFixed(2)
        }

        if (product.wholesale) {
            price_progress.wholesale = parseFloat(product.wholesale).toFixed(2)
        }

        return price_progress

    },

    createSupplierInfoData(entry, product, price_progress) {

        const supplierInfo = {
            name: entry.name,
            in_stock: true,
            wholesale: parseFloat(product.wholesale).toFixed(2),
            supplierProductId: product.supplierCode,
            supplierProductURL: product.link,
        }

        if (Array.isArray(price_progress)) {
            supplierInfo.price_progress = price_progress
        }
        else {
            supplierInfo.price_progress = [price_progress]
        }

        if (product.in_offer) {
            supplierInfo.in_offer = product.in_offer
        }

        if (product.initial_retail_price) {
            supplierInfo.initial_retail_price = parseFloat(product.initial_retail_price).toFixed(2)
        }

        if (product.retail_price) {
            supplierInfo.retail_price = parseFloat(product.retail_price).toFixed(2)
        }

        if (product.recycleTax) {
            supplierInfo.recycle_tax = parseFloat(product.recycleTax).toFixed(2)
        }

        if (product.quantity) {
            supplierInfo.quantity = parseInt(product.quantity)
        }

        return supplierInfo
    },

    async updateSupplierInfo(entry, product, supplierInfo) {

        let isUpdated = false;
        let dbChange = 'skipped'

        let supplierInfoUpdate = supplierInfo.findIndex(o => o.name === entry.name)

        if (supplierInfoUpdate !== -1) {
            if (parseFloat(supplierInfo[supplierInfoUpdate].wholesale) === 0 && parseFloat(product.wholesale) !== 0) {
                parseFloat(supplierInfo[supplierInfoUpdate].wholesale) = parseFloat(product.wholesale)
                isUpdated = true;
                dbChange = 'updated'
            }

            if (parseFloat(product.wholesale) > 0 && parseFloat(supplierInfo[supplierInfoUpdate].wholesale) !== parseFloat(product.wholesale)) {

                const price_progress = supplierInfo[supplierInfoUpdate].price_progress;

                const price_progress_data = this.createPriceProgress(product)

                price_progress.push(price_progress_data)

                supplierInfo[supplierInfoUpdate] = this.createSupplierInfoData(entry, product, price_progress)

                isUpdated = true;
                dbChange = 'updated'
            }

            if (supplierInfo[supplierInfoUpdate].in_stock === false) {
                supplierInfo[supplierInfoUpdate].in_stock = true
                isUpdated = true;
                dbChange = 'updated'
            }
        }
        else {
            const price_progress_data = this.createPriceProgress(product)

            supplierInfo.push(this.createSupplierInfoData(entry, product, price_progress_data))

            isUpdated = true;
            dbChange = 'created'
        }

        return { updatedSupplierInfo: supplierInfo, isUpdated, dbChange }

    },

    async xPathFilter(result, entry) {
        const docParser = new DOMParser()
        var serializer = new XMLSerializer();
        const doc = docParser.parseFromString(result.data, "application/xml")

        try {
            if (entry.xPath && entry.xPath !== "") {
                const allParagraphs = xpath.evaluate(
                    entry.xPath,
                    doc,
                    null,
                    xpath.XPathResult.ANY_TYPE,
                    null)

                let newDOM = new DOMImplementation()
                let newDoc = newDOM.createDocument(null, 'products')

                allParagraphs.nodes.forEach(node => {
                    newDoc.childNodes[0].appendChild(node)
                });
                var xmlOut = serializer.serializeToString(newDoc);

                return xmlOut
            }
            return result.data
        } catch (error) {
            console.log(error)
            return result.data
        }
    },

    async parseXml(xml) {
        try {
            if (!xml)
                return

            const parser = new xml2js.Parser();
            return new Promise((resolve, reject) => {
                parser.parseString(xml, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        } catch (error) {
            return
        }

    },

    async getData(entry, categoryMap) {
        const parser = new xml2js.Parser();

        if (entry.importedURL) {
            if (entry.name === "Oktabit") {
                return await strapi
                    .plugin('import-products')
                    .service('oktabitHelper')
                    .getOktabitData(entry, categoryMap)
            }
            else if (entry.name === "Gerasis") {
                return await strapi
                    .plugin('import-products')
                    .service('gerasisHelper')
                    .getGerasisData(entry, categoryMap)
            }
            else if (entry.name === "Zegetron") {
                return await strapi
                    .plugin('import-products')
                    .service('zegetronHelper')
                    .getZegetronData(entry, categoryMap)
            }
            else if (entry.name === "Shopflix") {
                let { data } = await Axios.get(`${entry.importedURL}`)
                const xml = await this.parseXml(await data)

                return await xml;
            }
            else if (entry.name === "Westnet") {
                return await strapi
                    .plugin('import-products')
                    .service('westnetHelper')
                    .getWestnetData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "dotmedia") {
                return await strapi
                    .plugin('import-products')
                    .service('dotMediaHelper')
                    .getDotMediaData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "telehermes") {
                return await strapi
                    .plugin('import-products')
                    .service('telehermesHelper')
                    .getTelehermesData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "smart4all") {
                return await strapi
                    .plugin('import-products')
                    .service('smart4allHelper')
                    .getSmart4AllData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "cpi") {
                return await strapi
                    .plugin('import-products')
                    .service('cpiHelper')
                    .getCpiData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "netone") {
                return await strapi
                    .plugin('import-products')
                    .service('netoneHelper')
                    .getNetoneData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "allwan") {
                return await strapi
                    .plugin('import-products')
                    .service('allwanHelper')
                    .getAllwanData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "damkalidis") {
                return await strapi
                    .plugin('import-products')
                    .service('damkalidisHelper')
                    .getDamkalidisData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "iason") {
                return await strapi
                    .plugin('import-products')
                    .service('iasonHelper')
                    .getIasonData(entry, categoryMap)
            }
            else if (entry.name.toLowerCase() === "acihellas") {
                return await strapi
                    .plugin('import-products')
                    .service('aciHelper')
                    .getAciCatalog(entry, categoryMap)
            }
            // console.log("Ξεκινάω να κατεβάζω τα xml...")
            let data = await Axios.get(`${entry.importedURL}`,
                { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

            // console.log("Το downloading ολοκληρώθηκε.")

            // console.log(data)

            const xPath = await this.xPathFilter(await data, entry);
            const xml = await this.parseXml(xPath)

            return await xml;
        }
        else {
            if (entry.importedFile.ext === ".xlsx") {
                const wb = xlsx.readFile(`./public${entry.importedFile.url}`)
                const ws = wb.Sheets['Φύλλο1']
                const data = xlsx.utils.sheet_to_json(ws)
                return data;
            }
            else if (entry.importedFile.ext === ".xml") {
                let xml = new Promise(async (resolve, reject) => {
                    const data = await fs.promises.readFile(`./public/uploads/${entry.importedFile.hash}${entry.importedFile.ext}`)
                        .catch((err) => console.error('Failed to read file', err));

                    parser.parseString(data, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                });
                if (entry.name.toLowerCase() === "logicom") {
                    return await strapi
                        .plugin('import-products')
                        .service('logicomHelper')
                        .getLogicomData(entry, await xml, categoryMap)
                }
                else if (entry.name.toLowerCase() === "iason") {
                    return await strapi
                        .plugin('import-products')
                        .service('iasonHelper')
                        .getIasonData(entry, await xml, categoryMap)
                }
            }
        }
    },

    async editData(data, dataTitles) {
        const categoryMap = await this.getImportMapping(dataTitles.entry);

        const { categories_map, char_name_map, char_value_map, stock_map,
            isWhitelistSelected, whitelist_map, blacklist_map,
            xPath, minimumPrice, maximumPrice } = await categoryMap

        const charMaps = await this.parseCharsToMap(char_name_map, char_value_map);

        const newData = this.filterData(data, dataTitles, await categoryMap)
        return { newData, categories_map, charMaps }
    },

    async checkProductAndBrand(mpn, name, barcode, brand, model) {
        const entryCheck = await this.checkIfProductExists(mpn, barcode, name, model);

        const brandId = await this.brandIdCheck(brand, name);

        return { entryCheck, brandId }

    },

    async brandIdCheck(brand, name) {
        try {
            let brandId;
            if (!brand) {
                const brandEntries = await strapi.entityService.findMany('api::brand.brand', {
                    fields: ['name'],
                });

                let sortedBrandArray = brandEntries.sort(function (a, b) {
                    // ASC  -> a.length - b.length
                    // DESC -> b.length - a.length
                    return b.name.length - a.name.length;
                });
                // const brands = brandEntries.map(x => x.name)

                const brandFound = sortedBrandArray.find(x => name?.toLowerCase().includes(x.name.toLowerCase()))

                if (brandFound) {
                    brandId = brandFound.id
                    return brandId
                }
            }

            const brandCheck = await strapi.db.query('api::brand.brand').findOne({
                // select: ['mpn', 'id', 'relatedSupplier'],
                where: { name: brand },
            });

            brandId = brandCheck?.id

            if (!brandCheck && brand) {
                let newbrand = await strapi.entityService.create('api::brand.brand', {
                    data: {
                        name: brand,
                        slug: slugify(brand, { lower: true }),
                        publishedAt: new Date()
                    },
                })

                brandId = await newbrand.id
            }

            return brandId;
        } catch (error) {
            console.log(brand, error, error.details.errors)
        }
    },

    async checkIfProductExists(mpn, barcode, name, model) {
        try {
            const checkIfEntry = await strapi.db.query('api::product.product').findOne({
                where: {
                    $or: [
                        {
                            $and: [
                                { mpn: mpn },
                                { barcode: barcode }
                            ]
                        },
                        {
                            $and: [
                                { mpn: mpn },
                                // { mpn: { $notNull: true, } },
                                // { barcode: { $null: true, } }
                            ]
                        },
                        {
                            $and: [
                                { mpn: model },
                                { mpn: { $notNull: true, } },
                                // { barcode: { $null: true, } }
                            ]
                        },
                        {
                            $and: [
                                { model: mpn },
                                { mpn: { $notNull: true, } },
                                // { barcode: { $null: true, } }
                            ]
                        },
                        {
                            $and: [
                                { barcode: barcode },
                                { mpn: { $null: true, } }
                            ]
                        },
                        {
                            $and: [
                                { name: name },
                                { mpn: { $null: true, } },
                                { barcode: { $null: true, } }
                            ]
                        },
                    ]
                },
                populate: {
                    supplierInfo: {
                        populate: {
                            price_progress: true,
                        }
                    },
                    related_import: true,
                    category: {
                        populate: {
                            cat_percentage: {
                                populate: {
                                    brand_perc: {
                                        populate: {
                                            brand: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    platform: true
                },
            });

            return await checkIfEntry
        } catch (error) {
            console.log(error)
        }
    },

    async getImportMapping(entry) {
        try {
            const categoryMap = await strapi.entityService.findOne('plugin::import-products.importxml', entry.id, {
                fields: ['isWhitelistSelected', 'xPath', 'minimumPrice', 'maximumPrice'],
                populate: {
                    char_name_map: {
                        fields: ['name', 'value'],
                    },
                    char_value_map: {
                        fields: ['name', 'value'],
                    },
                    categories_map: {
                        populate: {
                            contains: true,
                            subcategory: {
                                populate: {
                                    contains: true,
                                    subcategory: {
                                        populate: {
                                            contains: true,
                                        }
                                    }

                                }
                            }
                        },
                    },
                    stock_map: {
                        fields: ['name'],
                    },
                    whitelist_map: {
                        fields: ['name'],
                        populate: {
                            subcategory: {
                                fields: ['name'],
                                populate: {
                                    subcategory: {
                                        fields: ['name'],
                                    }
                                }
                            }
                        }
                    },
                    blacklist_map: {
                        fields: ['name'],
                        populate: {
                            subcategory: {
                                fields: ['name'],
                                populate: {
                                    subcategory: {
                                        fields: ['name'],
                                    }
                                }
                            }
                        }
                    }
                },
            })

            return categoryMap
        } catch (error) {
            console.log(error)
        }
    },

    async mappingToCategories(mapping, category, subcategory1, subcategory2, name) {
        try {
            let mappingToCategory = "uncategorized"

            const categoryMapping = mapping.find((cat) => {
                if (cat.name.trim().toLowerCase() === category.trim().toLowerCase()) {
                    return cat;
                }
            })

            if (categoryMapping) {
                if (categoryMapping.sub_category?.length > 0) {
                    const subcategoryMapping = categoryMapping.sub_category.find((subcat) => {
                        if (subcat.name.trim().toLowerCase() === subcategory1.trim().toLowerCase()) {
                            return subcat;
                        }
                    })

                    if (subcategoryMapping.sub_category2?.length > 0) {
                        const subcategory2Mapping = subcategoryMapping.sub_category2.find((subcat2) => {
                            return (subcat2.name.trim().toLowerCase() === subcategory2.trim().toLowerCase())
                        })

                        if (subcategory2Mapping.contains.length > 0) {
                            let find_str = subcategory2Mapping.contains.find(cont => {

                                if (name.search(new RegExp(cont.name, "i")) > 0) {
                                    return true
                                }

                            })
                            mappingToCategory = find_str ? find_str.value : subcategory2Mapping.value
                        }
                        else {
                            mappingToCategory = categoryMapping.value
                        }
                    }
                    else {
                        if (subcategoryMapping.contains.length > 0) {
                            let find_str = subcategoryMapping.contains.find(cont => {

                                if (name.search(new RegExp(cont.name, "i")) > 0) {
                                    return true
                                }

                            })
                            mappingToCategory = find_str ? find_str.value : subcategoryMapping.value
                        }
                        else {
                            mappingToCategory = categoryMapping.value
                        }
                    }
                }
                else {
                    if (categoryMapping.contains.length > 0) {
                        let find_str = categoryMapping.contains.find(cont => {

                            if (name.search(new RegExp(cont.name, "i")) > 0) {
                                return true
                            }

                        })
                        mappingToCategory = find_str ? find_str.value : categoryMapping.value
                    }
                    else {
                        mappingToCategory = categoryMapping.value
                    }
                }
            }
            return mappingToCategory
        } catch (error) {
            console.log(error)
        }


    },

    async getCategory(categoryMap, name, category, sub_category, sub_category2) {
        let cat = categoryMap.find(x => x.name.trim().toLowerCase() === category.trim().toLowerCase())

        let categoryMapping = "Uncategorized"

        if (cat) {
            let sub = cat.subcategory.find(x => x.name.trim().toLowerCase() === sub_category.toLowerCase().trim())
            if (sub) {
                let sub2 = sub.subcategory.find(x => x.name.trim().toLowerCase() === sub_category2?.toLowerCase().trim())
                if (sub2) {
                    if (sub2.contains.length > 0) {
                        for (let word of sub2.contains) {
                            if (name.trim().includes(word.name.trim())) {
                                categoryMapping = word.value.trim()
                                break;
                            }
                            else {
                                categoryMapping = sub2.value.trim()
                            }
                        }
                    }
                    else {
                        categoryMapping = sub2.value.trim()
                    }
                }
                else {
                    if (sub.contains.length > 0) {
                        for (let word of sub.contains) {
                            if (name.trim().toLowerCase().includes(word.name.trim().toLowerCase())) {
                                categoryMapping = word.value.trim()
                                break;
                            }
                            else {
                                categoryMapping = sub.value.trim()
                            }
                        }
                    }
                    else {
                        categoryMapping = sub.value.trim()
                    }
                }
            }
            else {
                if (cat.contains.length > 0) {
                    for (let word of cat.contains) {
                        if (name.trim().toLowerCase().includes(word.name.trim().toLowerCase())) {
                            categoryMapping = word.value.trim()
                            break;
                        }
                        else {
                            categoryMapping = cat.value.trim()
                        }
                    }

                }
                else {
                    categoryMapping = cat.value.trim()
                }
            }
        }

        let categoryID = await strapi.db.query('api::category.category').findOne({
            select: ['id', 'slug', 'average_weight'],
            where: { slug: categoryMapping },
            populate: {
                supplierInfo: true,
                cat_percentage: {
                    populate: {
                        brand_perc: {
                            populate: {
                                brand: true
                            }
                        }
                    }
                }
            }
        });

        if (categoryID === null) {
            let uncategorized = await strapi.db.query('api::category.category').findOne({
                select: ['id', 'slug'],
                where: { slug: "uncategorized" },
                populate: {
                    supplierInfo: true,
                    cat_percentage: true
                }
            });
            return await uncategorized
        }
        return categoryID
    },

    filterCategories(categories, isWhitelistSelected, whitelist_map, blacklist_map) {

        try {
            let newData = []
            for (let cat of categories) {
                if (isWhitelistSelected) {
                    if (whitelist_map.length > 0) {
                        let catIndex = whitelist_map.findIndex(x => x.name.trim() === cat.title.trim())
                        if (catIndex !== -1) {
                            let subCategories = []
                            if (whitelist_map[catIndex].subcategory.length > 0) {
                                for (let sub of cat.subCategories) {
                                    let subIndex = whitelist_map[catIndex].subcategory.findIndex((x) => sub.title.trim() === x.name.trim())
                                    if (subIndex !== -1) {
                                        let subCategories2 = []
                                        if (whitelist_map[catIndex].subcategory[subIndex].subcategory.length > 0) {
                                            for (let sub2 of sub.subCategories) {
                                                let sub2Index = whitelist_map[catIndex].subcategory[subIndex].subcategory.findIndex((x) => sub2.title.trim() === x.name.trim())
                                                if (sub2Index !== -1) {
                                                    subCategories2.push({ title: sub2.title, link: sub2.link })
                                                }
                                            }
                                        }
                                        else {
                                            if (sub.subCategories) {
                                                for (let sub2 of sub.subCategories) {
                                                    subCategories2.push({ title: sub2.title, link: sub2.link })
                                                }
                                            }
                                        }
                                        subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                                    }
                                }
                            }
                            else {
                                if (cat.subCategories) {
                                    for (let sub of cat.subCategories) {
                                        let subCategories2 = []
                                        if (sub.subCategories) {
                                            for (let sub2 of sub.subCategories) {
                                                subCategories2.push({ title: sub2.title, link: sub2.link })
                                            }
                                        }

                                        subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                                    }
                                }
                            }
                            newData.push({ title: cat.title.trim(), link: cat.link, subCategories: subCategories })
                        }
                    }
                    else {
                        let subCategories = []
                        if (cat.subCategories) {
                            for (let sub of cat.subCategories) {
                                let subCategories2 = []
                                if (sub.subCategories) {
                                    for (let sub2 of sub.subCategories) {
                                        subCategories2.push({ title: sub2.title, link: sub2.link })
                                    }
                                }

                                subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                            }
                        }
                        newData.push({ title: cat.title.trim(), link: cat.link, subCategories: subCategories })
                    }
                }
                else {
                    if (blacklist_map.length > 0) {
                        let catIndex = blacklist_map.findIndex(x => x.name.trim() === cat.title.trim())
                        if (catIndex !== -1) {
                            let subCategories = []
                            if (blacklist_map[catIndex].subcategory.length > 0) {
                                for (let sub of cat.subCategories) {
                                    let subIndex = blacklist_map[catIndex].subcategory.findIndex((x) => sub.title.trim() === x.name.trim())
                                    if (subIndex !== -1) {
                                        let subCategories2 = []
                                        if (blacklist_map[catIndex].subcategory[subIndex].subcategory.length > 0) {
                                            for (let sub2 of sub.subCategories) {
                                                let subIndex2 = blacklist_map[catIndex].subcategory[subIndex].subcategory.findIndex((x) => sub2.title.trim() === x.name.trim())
                                                if (subIndex2 === -1) {
                                                    subCategories2.push({ title: sub2.title, link: sub2.link })
                                                }
                                            }
                                        }
                                        subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                                    }
                                    else {
                                        let subCategories2 = []
                                        if (sub.subCategories) {
                                            for (let sub2 of sub.subCategories) {
                                                subCategories2.push({ title: sub2.title, link: sub2.link })
                                            }
                                        }
                                        subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                                    }
                                }
                                newData.push({ title: cat.title.trim(), link: cat.link, subCategories: subCategories })
                            }
                        }
                        else {
                            let subCategories = []
                            if (cat.subCategories) {
                                for (let sub of cat.subCategories) {
                                    let subCategories2 = []
                                    if (sub.subCategories) {
                                        for (let sub2 of sub.subCategories) {
                                            subCategories2.push({ title: sub2.title, link: sub2.link })
                                        }
                                    }

                                    subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                                }
                            }
                            newData.push({ title: cat.title.trim(), link: cat.link, subCategories: subCategories })
                        }
                    }
                    else {
                        let subCategories = []
                        if (cat.subCategories) {
                            for (let sub of cat.subCategories) {
                                let subCategories2 = []
                                if (sub.subCategories) {
                                    for (let sub2 of sub.subCategories) {
                                        subCategories2.push({ title: sub2.title, link: sub2.link })
                                    }
                                }

                                subCategories.push({ title: sub.title, link: sub.link, subCategories: subCategories2 })
                            }
                        }
                        newData.push({ title: cat.title.trim(), link: cat.link, subCategories: subCategories })
                    }
                }
            }
            return newData
        } catch (error) {
            console.log(error)
        }
    },

    async getAndConvertImgToWep(product, entryID, auth) {

        try {
            let productName = product.name.replace(/\//g, "_");

            let index = 0
            let mainImageID = '';
            const imageIDS = { mainImage: [], additionalImages: [], imgUrls: [] }

            for (let imgUrl of product.ImageURLS) {
                index += 1;
                const sharpStream = sharp({
                    failOnError: false
                });

                try {
                    let cont = false;
                    const response = await Axios({
                        method: 'get',
                        url: imgUrl.url,
                        responseType: 'stream'
                    }).catch(err => {
                        cont = true;
                    })

                    if (cont) {
                        break;
                    }

                    await response && response !== null && response.data.pipe(sharpStream)

                    imageIDS.imgUrls.push(imgUrl)

                    const imgID = await sharpStream
                        .webp({ quality: 75 })
                        .resize({ width: 1000 })
                        .toFile(`./public/tmp/${productName}_${index}.webp`)
                        .then(async () => {
                            const image = await strapi
                                .plugin('import-products')
                                .service('imageHelper')
                                .upload(`./public/tmp/${productName}_${index}.webp`, 'uploads');
                            return image
                        })
                        .then((image) => {
                            index === 1 ? imageIDS.mainImage.push(image.id)
                                : imageIDS.additionalImages.push(image.id)
                        })
                        .catch(err => {
                            console.error("Error processing files, let's clean it up", err, "File:", product.name, "supplier Code:", product.supplierCode);
                            try {
                                if (fs.existsSync(`./public/tmp/${productName}_${index}.webp`)) {
                                    fs.unlinkSync(`./public/tmp/${productName}_${index}.webp`);
                                }
                            } catch (e) {
                                console.log(e)
                                return
                            }
                        })

                } catch (error) {
                    console.log("Axios Error:", error)
                }
            }

            if (imageIDS.imgUrls.length === 0) { return }

            return imageIDS
        } catch (error) {
            console.log("Error in converting Image:", error)
        }
    },

    async getAdditionalFile(product, entryID, auth) {

        try {
            let productName = product.name.replace(/\//g, "_");

            let index = 0
            let additionalFileID = [];
            // const imageIDS = { mainImage: [], additionalImages: [], imgUrls: [] }

            if (product.technical_guide && product.technical_guide.url !== "") {
                try {
                    const writer = fs.createWriteStream(`./public/tmp/${productName}_${index}.pdf`);
                    const response = await Axios({
                        method: 'get',
                        url: product.technical_guide.url,
                        responseType: 'stream'
                    }).then(response => {
                        return new Promise((resolve, reject) => {
                            response.data.pipe(writer);
                            let error = null;
                            writer.on('error', err => {
                                error = err;
                                writer.close();
                                reject(err);
                            });
                            writer.on('close', () => {
                                if (!error) {
                                    resolve(true);
                                }
                                //no need to call the reject here, as it will have been called in the
                                //'error' stream;
                            });
                        });
                    })
                        .then(async () => {
                            const file = await strapi
                                .plugin('import-products')
                                .service('imageHelper')
                                .upload(`./public/tmp/${productName}_${index}.pdf`, 'uploads');
                            return file
                        }).then((file) => {
                            additionalFileID.push(file.id)
                        })
                        .catch(err => {
                            console.error("Error processing files, let's clean it up", err, "File:", product.name, "supplier Code:", product.supplierCode);
                            try {
                                if (fs.existsSync(`./public/tmp/${productName}_${index}.pdf`)) {
                                    fs.unlinkSync(`./public/tmp/${productName}_${index}.pdf`);
                                }
                            } catch (e) {
                                console.log(e)
                                return
                            }
                        })

                    // if (cont) {
                    //     break;
                    // }

                    // await response && response !== null && response.data.pipe(sharpStream)

                    // imageIDS.imgUrls.push(imgUrl)

                    // const imgID = await sharpStream
                    //     .webp({ quality: 75 })
                    //     .resize({ width: 1000 })
                    //     .toFile(`./public/tmp/${productName}_${index}.webp`)
                    //     .then(async () => {
                    //         const image = await strapi
                    //             .plugin('import-products')
                    //             .service('imageHelper')
                    //             .upload(`./public/tmp/${productName}_${index}.webp`, 'uploads');
                    //         return image
                    //     })
                    //     .then((image) => {
                    //         index === 1 ? imageIDS.mainImage.push(image.id)
                    //             : imageIDS.additionalImages.push(image.id)
                    //     })
                    //     .catch(err => {
                    //         console.error("Error processing files, let's clean it up", err, "File:", product.name, "supplier Code:", product.supplierCode);
                    //         try {
                    //             if (fs.existsSync(`./public/tmp/${productName}_${index}.webp`)) {
                    //                 fs.unlinkSync(`./public/tmp/${productName}_${index}.webp`);
                    //             }
                    //         } catch (e) {
                    //             console.log(e)
                    //             return
                    //         }
                    //     })

                } catch (error) {
                    console.log("Axios Error:", error)
                }
            }
            // }

            if (additionalFileID.length === 0) { return }

            return additionalFileID
        } catch (error) {
            console.log("Error in upload additional File:", error)
        }
    },

    async saveSEO(imgid, product) {
        try {
            let brand
            if (product.brand)
                brand = await strapi.entityService.findOne('api::brand.brand', parseInt(product.brand.id), {
                    fields: ['name'],
                })

            let productName = product.name.replace(/\//g, "_");
            const slug = slugify(`${productName}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })
            const canonicalURL = `http://localhost:3000/product/${slug}`

            let metaDescription = `${productName}${product.short_description}`.length > 160 ?
                `${productName}${product.short_description}`.substring(0, 159) :
                `${productName}${product.short_description}`.length > 50 ?
                    `${productName}${product.short_description}` :
                    `${productName}${product.short_description}${productName}${product.short_description}
            ${productName}${product.short_description}`.substring(0, 50)

            let keywords = `${brand?.name},${product.mpn},${product.barcode}`

            return [{
                metaTitle: productName.substring(0, 59),
                metaDescription: metaDescription,
                metaImage: {
                    id: imgid
                },
                keywords: `${keywords}`,
                canonicalURL: canonicalURL,
                metaViewport: "width=device-width, initial-scale=1",
                metaSocial: [
                    {
                        socialNetwork: "Facebook",
                        title: productName.substring(0, 59),
                        description: `${productName}`.substring(0, 64),
                        image: {
                            id: imgid
                        },
                    },
                    {
                        socialNetwork: "Twitter",
                        title: productName.substring(0, 59),
                        description: `${productName}`.substring(0, 64),
                        image: {
                            id: imgid
                        },
                    }
                ]
            }]

        } catch (error) {
            console.error(error)
        }
    },

    async parseCharsToMap(charName, charValue) {
        try {
            const mapCharNames = new Map()
            const mapCharValues = new Map()
            for (let char of charName) {
                mapCharNames.set(char.name, char.value)
            }

            for (let char of charValue) {
                mapCharValues.set(char.name, char.value)
            }

            return { mapCharNames, mapCharValues }
        } catch (error) {
            console.log(error)
        }
    },

    async parseChars(chars, mapCharNames, mapCharValues) {
        try {
            let newChars = chars.map(char => {
                char = JSON.parse(JSON.stringify(char))
                if (mapCharNames.get(char.name) !== undefined) {
                    let name = mapCharNames.get(char.name)
                    char.name = name
                }
                if (char.value) {
                    if (mapCharValues.get(char.value) !== undefined) {
                        let value = mapCharValues.get(char.value)
                        char.value = value
                    }
                }
                return char
            })

            return newChars
        } catch (error) {
            console.log(error)
        }
    },

    async updatespecs({ id }) {
        try {
            const entries = await strapi.entityService.findOne('plugin::import-products.importxml', id, {
                fields: ['name'],
                populate: {
                    related_products: {
                        fields: ['name'],
                        populate: {
                            prod_chars: {
                                fields: ['name', 'value'],
                            }
                        }
                    }
                },
            });

            const categoryMap = await strapi.entityService.findOne('plugin::import-products.importxml', id, {
                populate: {
                    char_name_map: {
                        fields: ['name', 'value'],
                    },
                    char_value_map: {
                        fields: ['name', 'value'],
                    }
                },
            })

            const { char_name_map, char_value_map } = await categoryMap

            const charMaps = await this.parseCharsToMap(char_name_map, char_value_map)

            const { mapCharNames, mapCharValues } = charMaps

            for (let entry of entries.related_products) {
                if (entry.prod_chars && entry.prod_chars.length > 0) {
                    const parsedChars = await this.parseChars(entry.prod_chars, mapCharNames, mapCharValues)

                    const updateProduct = await strapi.entityService.update('api::product.product', entry.id, {
                        data: {
                            prod_chars: parsedChars,
                        },
                    });
                }
            }

            return { "message": 'ok' }
        } catch (error) {
            console.log(error)
        }
    },

    findProductPlatformPercentage(categoryInfo, brandId) {
        let percentage = Number(process.env.GENERAL_CATEGORY_PERCENTAGE)
        let addToPrice = Number(process.env.GENERAL_SHIPPING_PRICE)

        let percentages = {
            general: {
                platformCategoryPercentage: percentage,
                addToPrice: addToPrice,
            },
            skroutz: {
                platformCategoryPercentage: percentage,
                addToPrice: addToPrice,
            },
            shopflix: {
                platformCategoryPercentage: percentage,
                addToPrice: addToPrice,
            }
        }

        const generalCategoryPercentage = categoryInfo.cat_percentage.find(x => x.name.toLowerCase().trim() === "general")
        const skroutzCategoryPercentage = categoryInfo.cat_percentage.find(x => x.name.toLowerCase().trim() === "skroutz")
        const shopflixCategoryPercentage = categoryInfo.cat_percentage.find(x => x.name.toLowerCase().trim() === "shopflix")

        if (generalCategoryPercentage) {
            if (generalCategoryPercentage.percentage) {
                percentages.general.platformCategoryPercentage = generalCategoryPercentage.percentage
            }
            percentages.general.addToPrice = generalCategoryPercentage.add_to_price ? generalCategoryPercentage.add_to_price : 0

            if (generalCategoryPercentage.brand_perc && generalCategoryPercentage.brand_perc.length > 0) {
                let brandPercentage = generalCategoryPercentage.brand_perc.find(x => x.brand?.id === brandId)
                percentages.general.brandPercentage = brandPercentage?.percentage
            }
        }

        if (skroutzCategoryPercentage) {
            if (skroutzCategoryPercentage.percentage) {
                percentages.skroutz.platformCategoryPercentage = skroutzCategoryPercentage.percentage
            }
            else {
                percentages.skroutz.platformCategoryPercentage = percentages.general.platformCategoryPercentage
            }

            percentages.skroutz.addToPrice = skroutzCategoryPercentage.add_to_price ? skroutzCategoryPercentage.add_to_price : 0

            if (skroutzCategoryPercentage.brand_perc && skroutzCategoryPercentage.brand_perc.length > 0) {
                let brandPercentage = skroutzCategoryPercentage.brand_perc.find(x => x.brand?.id === brandId)
                percentages.skroutz.brandPercentage = brandPercentage?.percentage
            }
        }
        else {
            percentages.skroutz.platformCategoryPercentage = percentages.general.platformCategoryPercentage
            percentages.skroutz.addToPrice = percentages.general.addToPrice
        }

        if (shopflixCategoryPercentage) {
            if (shopflixCategoryPercentage.percentage) {
                percentages.shopflix.platformCategoryPercentage = shopflixCategoryPercentage.percentage
            }
            else {
                percentages.shopflix.platformCategoryPercentage = percentages.general.platformCategoryPercentage
            }

            percentages.shopflix.addToPrice = shopflixCategoryPercentage.add_to_price ? shopflixCategoryPercentage.add_to_price : 0

            if (shopflixCategoryPercentage.brand_perc && shopflixCategoryPercentage.brand_perc.length > 0) {
                let brandPercentage = shopflixCategoryPercentage.brand_perc.find(x => x.brand?.id === brandId)
                percentages.shopflix.brandPercentage = brandPercentage?.percentage
            }
        }
        else {
            percentages.shopflix.platformCategoryPercentage = percentages.general.platformCategoryPercentage
            percentages.shopflix.addToPrice = percentages.general.addToPrice
        }

        percentages.general.platformCategoryPercentage = percentages.general.brandPercentage ? percentages.general.brandPercentage : percentages.general.platformCategoryPercentage
        percentages.skroutz.platformCategoryPercentage = percentages.skroutz.brandPercentage ? percentages.skroutz.brandPercentage :
            (percentages.general.brandPercentage ? percentages.general.brandPercentage : percentages.skroutz.platformCategoryPercentage)
        percentages.shopflix.platformCategoryPercentage = percentages.shopflix.brandPercentage ? percentages.shopflix.brandPercentage :
            (percentages.general.brandPercentage ? percentages.general.brandPercentage : percentages.shopflix.platformCategoryPercentage)

        return percentages
    },

    async setPrice(existedProduct, supplierInfo, categoryInfo, product) {
        try {
            let brandId = product.brand?.id;
            // const generalCategoryPercentage = Number(process.env.GENERAL_CATEGORY_PERCENTAGE)
            const taxRate = Number(process.env.GENERAL_TAX_RATE)
            // let addToPrice = Number(process.env.GENERAL_SHIPPING_PRICE)
            const filteredSupplierInfo = supplierInfo.filter(x => x.in_stock === true)
            let recycleTax = product.recycleTax ? parseFloat(product.recycleTax).toFixed(2) : parseFloat(0).toFixed(2)

            let minSupplierPrice = filteredSupplierInfo?.reduce((prev, current) => {
                return (prev.wholesale < current.wholesale) ? prev : current
            })

            const supplier = await strapi.db.query('plugin::import-products.importxml').findOne({
                select: ['name', 'shipping'],
                where: { name: minSupplierPrice.name },
            });

            let supplierShipping = supplier.shipping ? supplier.shipping : 0

            let percentages = this.findProductPlatformPercentage(categoryInfo, brandId)

            let minPrices = {}

            let prices = {}

            const minGeneral = (parseFloat(minSupplierPrice.wholesale) + parseFloat(recycleTax) + parseFloat(percentages.general.addToPrice) + parseFloat(supplierShipping)) * (taxRate / 100 + 1) * (parseFloat(percentages.general.platformCategoryPercentage) / 100 + 1)
            minPrices.general = parseFloat(minGeneral)
            const minSkroutz = (parseFloat(minSupplierPrice.wholesale) + parseFloat(recycleTax) + parseFloat(percentages.skroutz.addToPrice) + parseFloat(supplierShipping)) * (taxRate / 100 + 1) * (parseFloat(percentages.skroutz.platformCategoryPercentage) / 100 + 1)
            minPrices.skroutz = parseFloat(minSkroutz)
            const minShopflix = (parseFloat(minSupplierPrice.wholesale) + parseFloat(recycleTax) + parseFloat(percentages.shopflix.addToPrice) + parseFloat(supplierShipping)) * (taxRate / 100 + 1) * (parseFloat(percentages.shopflix.platformCategoryPercentage) / 100 + 1)
            minPrices.shopflix = parseFloat(minShopflix)

            const skroutz = existedProduct?.platform.find(x => x.platform === "Skroutz")
            const shopflix = existedProduct?.platform.find(x => x.platform === "Shopflix")

            if (existedProduct) {
                if (minSupplierPrice.name.toLowerCase() === "globalsat") {
                    let retail_price = parseFloat(minSupplierPrice.retail_price) - 0.5

                    if (parseFloat(minPrices.general) > parseFloat(retail_price)) {
                        if (existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                isFixed: false
                            }
                        }
                    }
                    else {
                        if (existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else if (parseFloat(existedProduct.price) > parseFloat(retail_price) && existedProduct.is_fixed_price) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                                isFixed: existedProduct.inventory > 0 ? existedProduct.is_fixed_price : false
                            }
                        }
                    }

                    if (skroutz) {

                        if (parseFloat(minPrices.skroutz) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                skroutz.is_fixed_price = false
                                prices.skroutzPrice = skroutz
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else if (parseFloat(skroutz.price) > parseFloat(retail_price) && skroutz.is_fixed_price) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(retail_price).toFixed(2)
                                skroutz.is_fixed_price = existedProduct.inventory > 0 ? skroutz.is_fixed_price : false
                                prices.skroutzPrice = skroutz
                            }
                        }

                    }
                    else {
                        if (parseFloat(retail_price) > parseFloat(minPrices.skroutz)) {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(minPrices.skroutz).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                    }

                    if (shopflix) {
                        if (parseFloat(minPrices.shopflix) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                prices.shopflixPrice = shopflix
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else if (parseFloat(shopflix.price) > parseFloat(retail_price) && shopflix.is_fixed_price) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(retail_price).toFixed(2)
                                shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                prices.shopflixPrice = shopflix
                            }
                        }
                    }
                    else {
                        if (parseFloat(retail_price) > parseFloat(minPrices.shopflix)) {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(minPrices.shopflix).toFixed(2),
                                is_fixed_price: false,
                            }
                        }

                    }
                }
                else if (minSupplierPrice.name.toLowerCase() === "telehermes") {
                    let retail_price = parseFloat(minSupplierPrice.retail_price)

                    if (parseFloat(minPrices.general) > parseFloat(retail_price)) {
                        if (existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                isFixed: false
                            }
                        }
                    }
                    else {
                        if (existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else if (parseFloat(existedProduct.price) > parseFloat(retail_price) && existedProduct.is_fixed_price) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                                isFixed: existedProduct.inventory > 0 ? existedProduct.is_fixed_price : false
                            }
                        }
                    }

                    if (skroutz) {

                        if (parseFloat(minPrices.skroutz) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                skroutz.is_fixed_price = false
                                prices.skroutzPrice = skroutz
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else if (parseFloat(skroutz.price) > parseFloat(retail_price) && skroutz.is_fixed_price) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(retail_price).toFixed(2)
                                skroutz.is_fixed_price = existedProduct.inventory > 0 ? skroutz.is_fixed_price : false
                                prices.skroutzPrice = skroutz
                            }
                        }

                    }
                    else {
                        if (parseFloat(retail_price) > parseFloat(minPrices.skroutz)) {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(minPrices.skroutz).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                    }

                    if (shopflix) {
                        if (parseFloat(minPrices.shopflix) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                prices.shopflixPrice = shopflix
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else if (parseFloat(shopflix.price) > parseFloat(retail_price) && shopflix.is_fixed_price) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(retail_price).toFixed(2)
                                shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                prices.shopflixPrice = shopflix
                            }
                        }
                    }
                    else {
                        if (parseFloat(retail_price) > parseFloat(minPrices.shopflix)) {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(minPrices.shopflix).toFixed(2),
                                is_fixed_price: false,
                            }
                        }

                    }
                }
                else if (minSupplierPrice.name.toLowerCase() === "dotmedia") {
                    let retail_price = parseFloat(minSupplierPrice.retail_price)

                    if (parseFloat(minSupplierPrice.wholesale) > 0) {
                        if (parseFloat(minPrices.general) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.generalPrice = {
                                    price: parseFloat(existedProduct.price).toFixed(2),
                                    isFixed: existedProduct.is_fixed_price
                                }
                            }
                            else {
                                prices.generalPrice = {
                                    price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                    isFixed: existedProduct.inventory > 0 ? existedProduct.is_fixed_price : false
                                }
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.generalPrice = {
                                    price: parseFloat(existedProduct.price).toFixed(2),
                                    isFixed: existedProduct.is_fixed_price
                                }
                            }
                            else if (parseFloat(existedProduct.price) > parseFloat(retail_price) && existedProduct.is_fixed_price) {
                                prices.generalPrice = {
                                    price: parseFloat(existedProduct.price).toFixed(2),
                                    isFixed: existedProduct.is_fixed_price
                                }
                            }
                            else {
                                prices.generalPrice = {
                                    price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                                    isFixed: false
                                }
                            }
                        }

                        if (skroutz) {
                            if (parseFloat(minPrices.skroutz) > parseFloat(retail_price)) {
                                if (existedProduct.inventory > 0) {
                                    prices.skroutzPrice = skroutz
                                }
                                else {
                                    skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                    skroutz.is_fixed_price = existedProduct.inventory > 0 ? skroutz.is_fixed_price : false
                                    prices.skroutzPrice = skroutz
                                }
                            }
                            else {
                                if (existedProduct.inventory > 0) {
                                    prices.skroutzPrice = skroutz
                                }
                                else if (parseFloat(skroutz.price) > parseFloat(retail_price) && skroutz.is_fixed_price) {
                                    prices.skroutzPrice = skroutz
                                }
                                else {
                                    skroutz.price = parseFloat(retail_price).toFixed(2)
                                    skroutz.is_fixed_price = false
                                    prices.skroutzPrice = skroutz
                                }
                            }
                        }
                        else {
                            if (parseFloat(retail_price) > parseFloat(minPrices.skroutz)) {
                                prices.skroutzPrice = {
                                    platform: "Skroutz",
                                    price: parseFloat(retail_price).toFixed(2),
                                    is_fixed_price: false,
                                }
                            }
                            else {
                                prices.skroutzPrice = {
                                    platform: "Skroutz",
                                    price: parseFloat(minPrices.skroutz).toFixed(2),
                                    is_fixed_price: false,
                                }
                            }
                        }

                        if (shopflix) {
                            if (parseFloat(minPrices.shopflix) > parseFloat(retail_price)) {
                                if (existedProduct.inventory > 0) {
                                    prices.shopflixPrice = shopflix
                                }
                                else {
                                    shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                    shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                    prices.shopflixPrice = shopflix
                                }
                            }
                            else {
                                if (existedProduct.inventory > 0) {
                                    prices.shopflixPrice = shopflix
                                }
                                else if (parseFloat(shopflix.price) > parseFloat(retail_price) && shopflix.is_fixed_price) {
                                    prices.shopflixPrice = shopflix
                                }
                                else {
                                    shopflix.price = parseFloat(retail_price).toFixed(2)
                                    shopflix.is_fixed_price = false
                                    prices.shopflixPrice = shopflix
                                }
                            }
                        }
                        else {
                            if (parseFloat(retail_price) > parseFloat(minPrices.shopflix)) {
                                prices.shopflixPrice = {
                                    platform: "Shopflix",
                                    price: parseFloat(retail_price).toFixed(2),
                                    is_fixed_price: false,
                                }
                            }
                            else {
                                prices.shopflixPrice = {
                                    platform: "Shopflix",
                                    price: parseFloat(minPrices.shopflix).toFixed(2),
                                    is_fixed_price: false,
                                }
                            }

                        }
                    }
                    else {
                        if (parseFloat(existedProduct.price) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0 || existedProduct.is_fixed_price) {
                                prices.generalPrice = {
                                    price: parseFloat(existedProduct.price).toFixed(2),
                                    isFixed: existedProduct.is_fixed_price
                                }
                            }
                            else {
                                prices.generalPrice = {
                                    price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                                    isFixed: existedProduct.inventory > 0 ? existedProduct.is_fixed_price : false
                                }
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.generalPrice = {
                                    price: parseFloat(existedProduct.price).toFixed(2),
                                    isFixed: existedProduct.is_fixed_price
                                }
                            }
                            else {
                                prices.generalPrice = {
                                    price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                                    isFixed: existedProduct.inventory > 0 ? existedProduct.is_fixed_price : false
                                }
                            }
                        }

                        if (skroutz) {
                            if (parseFloat(skroutz.price) > parseFloat(retail_price)) {
                                if (existedProduct.inventory > 0 || existedProduct.is_fixed_price) {
                                    prices.skroutzPrice = skroutz
                                }
                                else {
                                    skroutz.price = parseFloat(retail_price).toFixed(2)
                                    skroutz.is_fixed_price = existedProduct.inventory > 0 ? skroutz.is_fixed_price : false
                                    prices.skroutzPrice = skroutz
                                }
                            }
                            else {
                                if (existedProduct.inventory > 0) {
                                    prices.skroutzPrice = skroutz
                                }
                                else {
                                    skroutz.price = parseFloat(retail_price).toFixed(2)
                                    skroutz.is_fixed_price = existedProduct.inventory > 0 ? skroutz.is_fixed_price : false
                                    prices.skroutzPrice = skroutz
                                }
                            }
                        }
                        else {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }

                        if (shopflix) {
                            if (parseFloat(shopflix.price) > parseFloat(retail_price)) {
                                if (existedProduct.inventory > 0 || existedProduct.is_fixed_price) {
                                    prices.shopflixPrice = shopflix
                                }
                                else {
                                    shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                    shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                    prices.shopflixPrice = shopflix
                                }
                            }
                            else {
                                if (existedProduct.inventory > 0) {
                                    prices.shopflixPrice = shopflix
                                }
                                else {
                                    shopflix.price = parseFloat(retail_price).toFixed(2)
                                    shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                    prices.shopflixPrice = shopflix
                                }
                            }
                        }
                        else {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                    }
                }
                else if (minSupplierPrice.name.toLowerCase() === "novatron" && existedProduct.name.toLowerCase().includes("vigi")) {
                    let retail_price = parseFloat(minSupplierPrice.retail_price)

                    if (parseFloat(minPrices.general) > parseFloat(retail_price)) {
                        if (existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                isFixed: false
                            }
                        }
                    }
                    else {
                        if (existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else if (parseFloat(existedProduct.price) > parseFloat(retail_price) && existedProduct.is_fixed_price) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                                isFixed: existedProduct.inventory > 0 ? existedProduct.is_fixed_price : false
                            }
                        }
                    }

                    if (skroutz) {

                        if (parseFloat(minPrices.skroutz) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                skroutz.is_fixed_price = false
                                prices.skroutzPrice = skroutz
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else if (parseFloat(skroutz.price) > parseFloat(retail_price) && skroutz.is_fixed_price) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(retail_price).toFixed(2)
                                skroutz.is_fixed_price = existedProduct.inventory > 0 ? skroutz.is_fixed_price : false
                                prices.skroutzPrice = skroutz
                            }
                        }

                    }
                    else {
                        if (parseFloat(retail_price) > parseFloat(minPrices.skroutz)) {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(minPrices.skroutz).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                    }

                    if (shopflix) {
                        if (parseFloat(minPrices.shopflix) > parseFloat(retail_price)) {
                            if (existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                prices.shopflixPrice = shopflix
                            }
                        }
                        else {
                            if (existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else if (parseFloat(shopflix.price) > parseFloat(retail_price) && shopflix.is_fixed_price) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(retail_price).toFixed(2)
                                shopflix.is_fixed_price = existedProduct.inventory > 0 ? shopflix.is_fixed_price : false
                                prices.shopflixPrice = shopflix
                            }
                        }
                    }
                    else {
                        if (parseFloat(retail_price) > parseFloat(minPrices.shopflix)) {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(minPrices.shopflix).toFixed(2),
                                is_fixed_price: false,
                            }
                        }

                    }
                }
                else {
                    if (existedProduct.price > minPrices.general) {
                        if (existedProduct.is_fixed_price) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                    }
                    else {
                        if (existedProduct.inventory && existedProduct.inventory > 0) {
                            prices.generalPrice = {
                                price: parseFloat(existedProduct.price).toFixed(2),
                                isFixed: existedProduct.is_fixed_price
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                isFixed: false
                            }
                        }
                    }

                    if (skroutz) {
                        if (parseFloat(skroutz.price) > parseFloat(minPrices.skroutz)) {
                            if (skroutz.is_fixed_price) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                skroutz.is_fixed_price = false
                                prices.skroutzPrice = skroutz
                            }
                        }
                        else {
                            if (existedProduct.inventory && existedProduct.inventory > 0) {
                                prices.skroutzPrice = skroutz
                            }
                            else {
                                skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                skroutz.is_fixed_price = false
                                prices.skroutzPrice = skroutz
                            }
                        }
                    }
                    else {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(minPrices.skroutz).toFixed(2),
                            is_fixed_price: false,
                        }
                    }

                    if (shopflix) {
                        if (parseFloat(shopflix.price) > parseFloat(minPrices.shopflix)) {
                            if (shopflix.is_fixed_price) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                shopflix.is_fixed_price = false
                                prices.shopflixPrice = shopflix
                            }
                        }
                        else {
                            if (existedProduct.inventory && existedProduct.inventory > 0) {
                                prices.shopflixPrice = shopflix
                            }
                            else {
                                shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                shopflix.is_fixed_price = false
                                prices.shopflixPrice = shopflix
                            }
                        }
                    }
                    else {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(minPrices.shopflix).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                }
            }
            else {
                if (minSupplierPrice.name.toLowerCase() === "globalsat") {
                    if (parseFloat(parseFloat(product.retail_price) - 0.5) > parseFloat(minPrices.general)) {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(parseFloat(product.retail_price) - 0.5).toFixed(2),
                            isFixed: false
                        }
                    }
                    else {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                            isFixed: false
                        }
                    }

                    if (parseFloat(parseFloat(product.retail_price) - 0.5) > parseFloat(minPrices.skroutz)) {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(parseFloat(product.retail_price) - 0.5).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                    else {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(minPrices.skroutz).toFixed(2),
                            is_fixed_price: false,
                        }
                    }

                    if (parseFloat(parseFloat(product.retail_price) - 0.5) > parseFloat(minPrices.shopflix)) {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(parseFloat(product.retail_price) - 0.5).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                    else {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(minPrices.shopflix).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                }
                else if (minSupplierPrice.name.toLowerCase() === "telehermes") {
                    if (parseFloat(product.retail_price) > parseFloat(minPrices.general)) {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(product.retail_price).toFixed(2),
                            isFixed: false
                        }
                    }
                    else {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                            isFixed: false
                        }
                    }

                    if (parseFloat(product.retail_price) > parseFloat(minPrices.skroutz)) {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(product.retail_price).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                    else {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(minPrices.skroutz).toFixed(2),
                            is_fixed_price: false,
                        }
                    }

                    if (parseFloat(product.retail_price) > parseFloat(minPrices.shopflix)) {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(product.retail_price).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                    else {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(minPrices.shopflix).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                }
                else if (minSupplierPrice.name.toLowerCase() === "dotmedia") {
                    if (parseFloat(minSupplierPrice.wholesale) > 0) {
                        if (parseFloat(product.retail_price) > parseFloat(minPrices.general)) {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(product.retail_price).toFixed(2),
                                isFixed: false
                            }
                        }
                        else {
                            prices.generalPrice = {
                                price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                                isFixed: false
                            }
                        }

                        if (parseFloat(product.retail_price) > parseFloat(minPrices.skroutz)) {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(product.retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.skroutzPrice = {
                                platform: "Skroutz",
                                price: parseFloat(minPrices.skroutz).toFixed(2),
                                is_fixed_price: false,
                            }
                        }

                        if (parseFloat(product.retail_price) > parseFloat(minPrices.shopflix)) {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(product.retail_price).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                        else {
                            prices.shopflixPrice = {
                                platform: "Shopflix",
                                price: parseFloat(minPrices.shopflix).toFixed(2),
                                is_fixed_price: false,
                            }
                        }
                    }
                    else {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(product.retail_price).toFixed(2),
                            isFixed: false
                        }

                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(product.retail_price).toFixed(2),
                            is_fixed_price: false,
                        }

                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(product.retail_price).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                }
                else if (minSupplierPrice.name.toLowerCase() === "novatron" && product.name.toLowerCase().includes("vigi")) {
                    let retail_price = parseFloat(minSupplierPrice.retail_price)
                    if (parseFloat(retail_price) > parseFloat(minPrices.general)) {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(retail_price).toFixed(2),
                            isFixed: false
                        }
                    }
                    else {
                        prices.generalPrice = {
                            price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                            isFixed: false
                        }
                    }

                    if (parseFloat(retail_price) > parseFloat(minPrices.skroutz)) {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(retail_price).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                    else {
                        prices.skroutzPrice = {
                            platform: "Skroutz",
                            price: parseFloat(minPrices.skroutz).toFixed(2),
                            is_fixed_price: false,
                        }
                    }

                    if (parseFloat(retail_price) > parseFloat(minPrices.shopflix)) {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(retail_price).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                    else {
                        prices.shopflixPrice = {
                            platform: "Shopflix",
                            price: parseFloat(minPrices.shopflix).toFixed(2),
                            is_fixed_price: false,
                        }
                    }
                }
                else {
                    prices.generalPrice = {
                        price: prices.generalPrice = parseFloat(minPrices.general).toFixed(2),
                        isFixed: false
                    }

                    prices.skroutzPrice = {
                        platform: "Skroutz",
                        price: parseFloat(minPrices.skroutz).toFixed(2),
                        is_fixed_price: false,
                    }

                    prices.shopflixPrice = {
                        platform: "Shopflix",
                        price: parseFloat(minPrices.shopflix).toFixed(2),
                        is_fixed_price: false,
                    }
                }
            }
            return prices

        } catch (error) {
            console.log(error)
        }
    },

    async exportToXML(supplier) {
        try {
            console.log(supplier)
            const xmlEntries = {}
            let finalEntries = []
            if (supplier === "inventory") {
                const entries = await strapi.entityService.findMany('api::product.product', {
                    filters: {
                        inventory: {
                            $gt: 0,
                        }
                    },
                    populate: {
                        category: { fields: ['name', 'slug'] },
                        brand: { fields: ['name'] },
                        prod_chars: { fields: ['name', 'value'] },
                        ImageURLS: { fields: ['url'] },
                        image: { fields: ['url'] },
                        additionalImages: true,
                        related_with: true,
                        supplierInfo: true
                    }
                });
                xmlEntries.entries = entries
            }
            else {
                const entries = await strapi.db.query('plugin::import-products.importxml').findOne({
                    select: ['name'],
                    where: { name: supplier },
                    populate: {
                        related_products: {
                            where: {
                                $and: [
                                    {
                                        $not: {
                                            publishedAt: null
                                        },
                                        supplierInfo: {
                                            $and: [
                                                { name: supplier },
                                                { in_stock: true }
                                            ]
                                        },
                                    }
                                ]
                            },
                            populate: {
                                category: { fields: ['name', 'slug'] },
                                brand: { fields: ['name'] },
                                prod_chars: { fields: ['name', 'value'] },
                                ImageURLS: { fields: ['url'] },
                                image: { fields: ['url'] },
                                additionalImages: true,
                                related_with: true,
                                supplierInfo: true
                            }
                        }
                    },
                });

                delete entries.id;
                delete entries.name;
                xmlEntries.entries = entries.related_products
            }

            for (let entry of xmlEntries.entries) {
                let newEntry = {
                    name: entry.name,
                    description: entry.description,
                    price: entry.price,
                    sale_price: entry.is_sale && entry.sale_price ? entry.sale_price : null,
                    sku: entry.sku,
                    mpn: entry.mpn,
                    status: entry.status,
                    image: entry.image?.url,
                    short_description: entry.short_description,
                    barcode: entry.barcode,
                    category: entry.category.name,
                    category_slug: entry.category.slug,
                    brand: entry.brand ? entry.brand?.name : "",
                    weight: entry.weight ? entry.weight : 0
                }

                let chars1 = []

                for (let char of entry.prod_chars) {
                    chars1.push({ name: char.name, value: char.value.replace(/[^a-zA-Z0-9_.-/'"]/g, " ") })
                }

                let imageURL = []

                for (let imageUrl of entry.ImageURLS) {
                    imageURL.push(imageUrl.url)
                }

                let relProds = []
                if (entry.related_with.length > 0) {
                    for (let prod of entry.related_with) {
                        relProds.push({ related_product_mpn: prod.mpn })
                    }
                }

                let additionalImages = []

                if (entry.additionalImages && entry.additionalImages.length > 0) {
                    for (let addImage of entry.additionalImages) {
                        additionalImages.push(addImage.url)
                    }
                }

                newEntry.related_products = [relProds];
                newEntry.chars = { char: chars1 };
                newEntry.imageURLS = { url: imageURL };
                newEntry.additionalImages = { url: additionalImages };

                finalEntries.push({ product: newEntry })
            }

            console.log(finalEntries.length)

            var builder = new xml2js.Builder();
            var xml = builder.buildObject({ products: finalEntries });

            return xml;
        } catch (error) {
            console.log(error)
        }

    },

    convertDataTitles(o, s) {
        s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        for (var i = 0, n = a.length; i < n; ++i) {
            var k = a[i];
            if (k in o) {
                o = o[k];
                if (o.length === 1)
                    o = o[0]
            } else {
                return;
            }
        }
        return o;
    },

    filterData(data, dataTitles, categoryMap) {

        const newData = data
            .filter(filterStock)
            .filter(filterPriceRange)
            .filter(filterCategories)

        function filterStock(stockName) {
            let status = strapi
                .plugin('import-products')
                .service('helpers')
                .convertDataTitles(stockName, dataTitles.status)

            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => x.name.trim() === status.trim())
                if (catIndex !== -1) {
                    return true
                }
                else {
                    return false
                }
            }
            else {
                return true
            }
        }

        function filterCategories(cat) {

            let category1 = strapi
                .plugin('import-products')
                .service('helpers')
                .convertDataTitles(cat, dataTitles.category_1)
            let category2 = strapi
                .plugin('import-products')
                .service('helpers')
                .convertDataTitles(cat, dataTitles.category_2)

            if (categoryMap.isWhitelistSelected) {
                if (categoryMap.whitelist_map.length > 0) {
                    let catIndex = categoryMap.whitelist_map.findIndex(x => x.name.trim() === category1?.trim())
                    if (catIndex !== -1) {
                        if (categoryMap.whitelist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.whitelist_map[catIndex].subcategory.findIndex(x => x.name.trim() === category2.trim())
                            if (subIndex !== -1) {
                                true
                            }
                            else {
                                return false
                            }
                        }
                        else {
                            return true
                        }
                    }
                    else {
                        return false
                    }
                }
                return true
            }
            else {
                if (categoryMap.blacklist_map.length > 0) {
                    let catIndex = categoryMap.blacklist_map.findIndex(x => x.name.trim() === category1.trim())
                    if (catIndex !== -1) {
                        if (categoryMap.blacklist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.blacklist_map[catIndex].subcategory.findIndex(x => x.name.trim() === category2.trim())
                            if (subIndex !== -1) {
                                return false
                            }
                            else {
                                return true
                            }
                        }
                        else {
                            return false
                        }
                    }
                    else {
                        return true
                    }
                }
                return true
            }
        }

        function filterPriceRange(priceRange) {

            let price = strapi
                .plugin('import-products')
                .service('helpers')
                .convertDataTitles(priceRange, dataTitles.price)

            let minPrice = categoryMap.minimumPrice ? categoryMap.minimumPrice : 0;
            let maxPrice;
            if (categoryMap.maximumPrice && categoryMap.maximumPrice > 0) {
                maxPrice = categoryMap.maximumPrice;
            }
            else {
                maxPrice = 100000;
            }

            if (price >= minPrice && price <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

    parseDatatitles(data, dataTitles) {

        let category_1 = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.category_1)

        let category_2 = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.category_2)

        let category_3 = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.category_3)

        let supplierCode = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.supplierCode)

        let model = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.model)

        let title = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.title)

        let brandName = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.brandName)

        let productURL = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.productURL)

        let partNumber = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.partNumber)

        let barcode = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.barcode)

        let description = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.description)

        let length = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.length)

        let width = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.width)

        let height = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.height)

        let weight = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.weight)

        let status = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.status)

        let price = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.price)

        let recycleTax = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.recycleTax)

        let suggestedPrice = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.suggestedPrice)

        let parsedDataTitles = {
            entry: dataTitles.entry,
            category_1,
            category_2,
            category_3,
            brandName,
            supplierCode,
            productURL,
            title,
            model,
            description,
            partNumber,
            length,
            width,
            height,
            weight,
            barcode,
            status,
            price,
            recycleTax,
            suggestedPrice
        }

        return parsedDataTitles
    },

    async constructProduct(dt, dataTitles) {

        try {
            const parsedDataTitles = this.parseDatatitles(dt, dataTitles);

            const { entryCheck, brandId } = await strapi
                .plugin('import-products')
                .service('helpers')
                .checkProductAndBrand(parsedDataTitles.partNumber, parsedDataTitles.title, parsedDataTitles.brandName.trim());

            const categoryMap = await strapi
                .plugin('import-products')
                .service('helpers')
                .getImportMapping(dataTitles.entry);

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = await categoryMap

            const categoryInfo = await strapi
                .plugin('import-products')
                .service('helpers')
                .getCategory(categories_map, parsedDataTitles.title, parsedDataTitles.category_1, parsedDataTitles.category_2, parsedDataTitles.category_3);

            const product = {
                name: parsedDataTitles.title,
                description: parsedDataTitles.description !== undefined ? parsedDataTitles.description : null,
                categories: categoryInfo.id,
                // price: parseFloat(productPrice),
                mpn: parsedDataTitles.partNumber ? parsedDataTitles.partNumber.toString() : null,
                barcode: parsedDataTitles.barcode ? parsedDataTitles.barcode : null,
                slug: parsedDataTitles.partNumber ?
                    slugify(`${parsedDataTitles.title?.toString()}-${parsedDataTitles.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    slugify(`${parsedDataTitles.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                publishedAt: new Date(),
                status: 'InStock',
                brand: { id: await brandId },
                related_import: dataTitles.entry.id,
                // supplierInfo: [{
                //     name: entry.name,
                //     wholesale: dt[`${dataTitles.price}`],
                //     recycle_tax: dt[`${dataTitles.recycleTax}`],
                //     supplierProductId: dt[`${dataTitles.supplierCode}`].toString(),
                //     in_offer: inOffer
                // }],
                // prod_chars: parsedChars

            }

            return { entryCheck, product, brandId }
        } catch (error) {
            console.log(error)
        }
    },

    async createEntry(product, importRef, auth) {

        try {
            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await this.getCategory(importRef.categoryMap.categories_map, product.name, product.category.title, product.subcategory.title, product.sub2category.title);

            const price_progress_data = this.createPriceProgress(product)

            const supplierInfo = [this.createSupplierInfoData(product.entry, product, price_progress_data)]

            const productPrices = await this.setPrice(null, supplierInfo, categoryInfo, product);

            product.supplierInfo = supplierInfo
            product.category = categoryInfo.id;
            product.price = parseFloat(productPrices.generalPrice.price).toFixed(2);

            product.is_fixed_price = productPrices.generalPrice.isFixed;

            let platforms = [
                productPrices.skroutzPrice,
                productPrices.shopflixPrice
            ]

            const data = {
                name: product.name,
                slug: slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*±+~=#.,°;_()/'"!:@]/g }),
                category: categoryInfo.id,
                price: parseFloat(productPrices.generalPrice.price).toFixed(2),
                is_fixed_price: product.is_fixed_price,
                publishedAt: new Date(),
                status: product.status,
                related_import: product.entry.id,
                supplierInfo: supplierInfo,
                prod_chars: product.prod_chars,
                ImageURLS: product.imagesSrc,
                technical_guide: product.technical_guide,
                platform: platforms
            }

            if (product.entry.name.toLowerCase() === "novatron" && product.short_description) {
                let result = product.short_description.match(/[0-9].[0-9]mm/g)
                if (result) {
                    data.name = `${product.name}-${result[0]}`;
                    data.slug = slugify(`${product.name}-${result[0]}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })
                }
            }

            if (product.mpn) {
                data.mpn = product.mpn.trim()
                data.slug = slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*±+~=#.,°;_()/'"!:@]/g })
            }

            if (product.barcode) {
                data.barcode = product.barcode.trim()
            }

            if (product.model) {
                data.model = product.model.trim()
            }

            if (product.description) {
                data.description = product.description.trim()
            }

            if (product.short_description) {
                data.short_description = product.short_description.trim()
            }

            if (product.brand) {
                data.brand = product.brand
            }

            if (product.length && product.width && product.height) {
                data.length = parseInt(product.length)
                data.width = parseInt(product.width)
                data.height = parseInt(product.height)
            }

            //Υπολογισμός βάρους
            if (!product.weight) {
                product.weight = this.createProductWeight(product, categoryInfo)
            }
            if (product.weight) {
                data.weight = parseInt(product.weight)
            }
            else if (categoryInfo.average_weight) {
                data.weight = parseInt(categoryInfo.average_weight)
            }
            else {
                data.weight = 0
            }
            //Κατεβάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
            let responseImage = await strapi
                .plugin('import-products')
                .service('helpers')
                .getAndConvertImgToWep(data, null, auth);

            data.image = await responseImage?.mainImage[0]
            data.additionalImages = await responseImage?.additionalImages
            data.ImageURLS = await responseImage?.imgUrls

            let responseFile = await strapi
                .plugin('import-products')
                .service('helpers')
                .getAdditionalFile(data, null, auth);

            data.additionalFiles = await responseFile?.[0]

            data.seo = await this.saveSEO(data.image, product)

            const newEntry = await strapi.entityService.create('api::product.product', {
                data: data,
            });

            //Δημιουργώ αυτόματα το SEO για το προϊόν 
            // await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .saveSEO(await responseImage.mainImageID.data[0], product, newEntry.id);

            importRef.related_entries.push(newEntry.id)
            if (product.relativeProducts && product.relativeProducts.length > 0)
                importRef.related_products.push({ productID: newEntry.id, relatedProducts: product.relativeProducts })

            importRef.created += 1;
        } catch (error) {
            console.log("Error in Entry Function:", error, error.details?.errors, product.name)
        }

    },

    async importScrappedProduct(product, importRef, auth) {
        try {
            if (!product.wholesale || isNaN(product.wholesale || product.brand_name.toLowerCase().includes("dahua")))
                return;

            // Αν δεν είναι Διαθέσιμο τότε προχώρα στο επόμενο
            const isAvailable = this.filterScrappedProducts(importRef.categoryMap, product);

            if (!isAvailable)
                return

            const { entryCheck, brandId } = await this.checkProductAndBrand(product.mpn, product.name, product.barcode, product.brand_name, product.model);

            //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
            const { mapCharNames, mapCharValues } = importRef.charMaps

            if (product.prod_chars && product.prod_chars.length > 0) {
                const parsedChars = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .parseChars(product.prod_chars, mapCharNames, mapCharValues)

                product.prod_chars = parsedChars
            }

            if (brandId) { product.brand = { id: brandId } }


            if (!entryCheck) {
                try {
                    await this.createEntry(product, importRef, auth)

                } catch (error) {
                    console.log("entryCheck:", entryCheck, "mpn:", product.mpn, "name:", product.name,
                        "barcode:", product.barcode, "brand_name:", product.brand_name, "model:", product.model)
                    console.log(error, error.details?.errors)
                }
            }
            else {
                try {
                    if (product.entry.name.toLowerCase() === "quest") {
                        if (entryCheck.prod_chars) {
                            if (entryCheck.prod_chars.find(x => x.name === "Μεικτό βάρος")) {
                                let chars = entryCheck.prod_chars.find(x => x.name === "Μεικτό βάρος")
                                let weight = parseInt(chars.value.replace("kg", "").replace(",", ".").trim()) * 1000

                                product.weight = weight
                            }
                            else if (entryCheck.prod_chars.find(x => x.name === "Βάρος (κιλά)")) {
                                let chars = entryCheck.prod_chars.find(x => x.name === "Βάρος (κιλά)")
                                let weight = parseInt(chars.value.replace("kg", "").replace(",", ".").trim()) * 1000

                                product.weight = weight
                            }
                        }
                    }
                    else if (product.entry.name.toLowerCase() === "globalsat") {
                        if (entryCheck.prod_chars) {
                            if (entryCheck.prod_chars.find(x => x.name.toLowerCase().contains("βάρος") || x.name.toLowerCase().contains("specs"))) {
                                let chars = entryCheck.prod_chars.find(x => x.name.toLowerCase().contains("βάρος"))

                                let specs = entryCheck.prod_chars.find(x => x).toLowerCase().contains("specs")

                                let value = chars.value.toLowerCase()
                                // if (value.contains("kg")) {
                                //     product.weight = parseInt(chars.value.replace("kg", "").replace(",", ".").trim()) * 1000
                                // }
                                // else if (value.contains("gr")) {
                                //     product.weight = parseInt(chars.value.replace("gr", "").replace(",", ".").trim())
                                // }
                            }
                        }
                    }

                    await this.updateEntry(entryCheck, product, importRef)

                } catch (error) {
                    console.log(error)
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async updateEntry(entryCheck, product, importRef) {

        try {
            // Τσεκάρω αν η προτεινόμενη τιμή είναι μικρότερη από την παλαιότερη
            if (entryCheck.related_import.findIndex(x => x.name.toLowerCase() === "globalsat") !== -1
                && entryCheck.supplierInfo.findIndex(x => { x.name.toLowerCase() === "globalsat" && Number(x.retail_price) < Number(product.retail_price) }) !== -1)
                return

            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await this.getCategory(importRef.categoryMap.categories_map,
                product.name, product.category.title, product.subcategory?.title, product.sub2category?.title);

            let dbChange = ''
            const data = {}

            importRef.related_entries.push(entryCheck.id)

            if (product.relativeProducts && product.relativeProducts.length > 0)
                importRef.related_products.push({ productID: entryCheck.id, relatedProducts: product.relativeProducts })

            let supplierInfo = entryCheck.supplierInfo;
            const relatedImport = entryCheck.related_import;
            const relatedImportIds = relatedImport.map(x => x.id)

            const findImport = relatedImport.findIndex(x =>
                x.id === product.entry.id)

            if (findImport === -1) { data.related_import = [...relatedImportIds, product.entry.id] }

            if (!entryCheck.category || entryCheck.category.id !== categoryInfo.id) {
                data.category = categoryInfo.id
                dbChange = 'updated'
            }

            //Υπολογισμός βάρους
            if (!product.weight) {
                product.weight = this.createProductWeight(product, categoryInfo)
            }

            if (entryCheck.slug.includes("undefined")) {
                if (product.mpn) {
                    data.slug = slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*±+~=#.,°;_()/'"!:@]/g })
                    dbChange = 'updated'
                }
                else {
                    data.slug = slugify(`${product.name}`, { lower: true, remove: /[*±+~=#.,°;_()/'"!:@]/g })
                    dbChange = 'updated'
                }
            }

            if (!entryCheck.barcode && product.barcode) {
                data.barcode = product.barcode
                dbChange = 'updated'
            }

            if (!entryCheck.length && product.length) {
                data.length = parseInt(product.length)
                dbChange = 'updated'
            }

            if (!entryCheck.width && product.width) {
                data.width = parseInt(product.width)
                dbChange = 'updated'
            }

            if (!entryCheck.height && product.height) {
                data.height = (product.height)
                dbChange = 'updated'
            }

            if (!entryCheck.model && product.model) {
                data.model = product.model
                dbChange = 'updated'
            }

            //Εδώ να κάνω έλεγχο Κατασκευαστή
            if (product.brand) {
                if (entryCheck.brand) {
                    if (entryCheck.brand.id !== product.brand.id) {
                        data.brand = product.brand.id
                        dbChange = 'updated'
                    }
                }
                else {
                    data.brand = product.brand.id
                    dbChange = 'updated'
                }

            }


            if (!entryCheck.weight) {
                if (entryCheck.weight === 0) {
                    if (parseInt(product.weight) === 0) {
                        if (categoryInfo.average_weight) {
                            data.weight = parseInt(categoryInfo.average_weight)
                            dbChange = 'updated'
                        }
                    }
                    else if (parseInt(product.weight) !== 0) {
                        data.weight = parseInt(product.weight)
                        dbChange = 'updated'
                    }
                }
                else {
                    data.weight = categoryInfo.average_weight ? parseInt(categoryInfo.average_weight) : parseInt(0)
                    dbChange = 'updated'
                }
            }
            else {
                if (product.weight && product.weight > 0) {
                    if (parseInt(entryCheck.weight) !== parseInt(product.weight)) {
                        data.weight = parseInt(product.weight)
                        dbChange = 'updated'
                    }
                }
                else {
                    if (categoryInfo.average_weight && parseInt(categoryInfo.average_weight) !== parseInt(entryCheck.weight)) {
                        data.weight = parseInt(categoryInfo.average_weight)
                        dbChange = 'updated'
                    }
                }
            }

            const { updatedSupplierInfo, isUpdated } = await strapi
                .plugin('import-products')
                .service('helpers')
                .updateSupplierInfo(product.entry, product, supplierInfo)

            const skroutz = entryCheck.platform.find(x => x.platform === "Skroutz")
            const shopflix = entryCheck.platform.find(x => x.platform === "Shopflix")

            if (isUpdated) {
                data.supplierInfo = updatedSupplierInfo
                dbChange = 'updated'
            }

            let info = data.supplierInfo ? data.supplierInfo : supplierInfo

            const productPrices = await strapi
                .plugin('import-products')
                .service('helpers')
                .setPrice(entryCheck, info, categoryInfo, product);

            if (isUpdated || !entryCheck.category
                || entryCheck.category.id !== categoryInfo.id
                || !skroutz || !shopflix) {

                data.is_fixed_price = productPrices.generalPrice.isFixed;

                data.price = parseFloat(productPrices.generalPrice.price)
                data.platform = [
                    productPrices.skroutzPrice,
                    productPrices.shopflixPrice
                ]
                dbChange = 'updated'
            }

            if (parseFloat(entryCheck.price).toFixed(2) !== parseFloat(productPrices.generalPrice.price).toFixed(2)
                && entryCheck.is_fixed_price === false) {
                data.is_fixed_price = productPrices.generalPrice.isFixed;

                data.price = parseFloat(productPrices.generalPrice.price)
                data.platform = [
                    productPrices.skroutzPrice,
                    productPrices.shopflixPrice
                ]
                dbChange = 'updated'
            }

            if (parseFloat(entryCheck.price).toFixed(2) !== parseFloat(productPrices.generalPrice.price).toFixed(2)) {
                if (parseFloat(entryCheck.price) > parseFloat(productPrices.generalPrice.price)) {
                    if (!entryCheck.is_fixed_price) { data.price = parseFloat(productPrices.generalPrice.price).toFixed(2) }
                }
                else {
                    data.price = parseFloat(productPrices.generalPrice.price).toFixed(2)
                    data.is_fixed_price = false
                }
            }

            if (entryCheck.publishedAt === null) {
                if (product.entry.name.toLowerCase() === "globalsat") {
                    data.need_verify = true
                    dbChange = 'updated'
                }
                else {
                    data.publishedAt = new Date()
                    data.deletedAt = null
                    dbChange = 'republished'
                }
            }

            if (Object.keys(data).length !== 0) {
                await strapi.entityService.update('api::product.product', entryCheck.id, {
                    data
                });

            }

            switch (dbChange) {
                case 'republished':
                    importRef.republished += 1
                    break;
                case 'updated':
                    importRef.updated += 1
                    break;
                case 'created':
                    importRef.created += 1
                    break;
                default:
                    importRef.skipped += 1
                    break;
            }
        } catch (error) {
            console.log(error, error?.details?.errors)
        }
    },

    async deleteEntry(entry, importRef) {
        try {
            const importXmlFile = await strapi.entityService.findOne('plugin::import-products.importxml', entry.id,
                {
                    populate: {
                        related_products: {
                            filters: {
                                $and: [
                                    {
                                        $not: {
                                            publishedAt: null
                                        }
                                    },
                                    {
                                        supplierInfo: {
                                            $and: [
                                                { name: entry.name },
                                                { in_stock: true },
                                            ]
                                        }
                                    },
                                ]
                            },
                        }
                    },
                });

            for (let product of importXmlFile.related_products) {

                if (!importRef.related_entries.includes(product.id)) {

                    const data = {}
                    const checkProduct = await strapi.entityService.findOne('api::product.product', product.id, {
                        // fields: ['supplierInfo', 'name'],
                        populate: {
                            supplierInfo: true,
                            related_import: true
                        },
                    })

                    let supplierInfo = checkProduct.supplierInfo

                    const index = supplierInfo.findIndex((o) => {
                        return o.name === entry.name
                    })

                    if (index === -1) {
                        let relatedImports = checkProduct.related_import.filter(x => x.id !== entry.id)
                        data.related_import = relatedImports
                    }
                    else {
                        supplierInfo[index].in_stock = false;
                    }

                    const isAllSuppliersOutOfStock = supplierInfo.every(supplier => supplier.in_stock === false)

                    if (!isAllSuppliersOutOfStock) {
                        data.supplierInfo = supplierInfo
                    }
                    else {
                        data.supplierInfo = supplierInfo
                        data.deletedAt = new Date();
                        if (!checkProduct.inventory || checkProduct.inventory !== 0) { data.publishedAt = null }
                    }
                    await strapi.entityService.update('api::product.product', product.id, {
                        data: data,
                    });
                    importRef.deleted += 1;
                }
            }

            await strapi.entityService.update('plugin::import-products.importxml', entry.id,
                {
                    data: {
                        lastRun: new Date(),
                        report: `Created: ${importRef.created}, Updated: ${importRef.updated},Republished: ${importRef.republished} Skipped: ${importRef.skipped}, Deleted: ${importRef.deleted}`,
                    },
                })

        } catch (error) {
            console.log(error)
        }
    },

    createProductWeight(product, categoryInfo) {
        try {
            let weight = 0
            if (product.length && product.width && product.height) {
                let calcWweight = parseInt(product.length) * parseInt(product.width) * parseInt(product.height) / 5
                weight = parseInt(calcWweight)
            }
            else if (product.recycleTax) {
                let tax = parseFloat(product.recycleTax)
                if (categoryInfo) {
                    if (categoryInfo.slug === "othones-ypologisti"
                        || categoryInfo.slug === "othones-surveilance-cctv"
                        || categoryInfo.slug === "tileoraseis") {
                        weight = parseInt(tax * 1000 / 0.25424)
                    }
                    else {
                        weight = parseInt(tax * 1000 / 0.16)
                    }
                }
            }
            else {
                weight = parseInt(0)
            }
            return weight
        } catch (error) {
            console.log(error)
        }
    }
})
