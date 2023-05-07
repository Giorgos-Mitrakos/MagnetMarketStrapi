'use strict';

const slugify = require("slugify");
const Axios = require('axios');
const { JSDOM } = require("jsdom");
const sharp = require('sharp');
const FormData = require("form-data");
const puppeteer = require('puppeteer');
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

    async delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) },

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
                // console.log(product)
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
                            }
                        },
                    });

                    if (checkIfEntry) {
                        await this.updateEntry(checkIfEntry, product, importRef)
                        // let dbChange = ''
                        // const data = {}

                        // importRef.related_entries.push(checkIfEntry.id)

                        // if (product.relativeProducts && product.relativeProducts.length > 0)
                        //     importRef.related_products.push({ productID: checkIfEntry.id, relatedProducts: product.relativeProducts })

                        // let supplierInfo = checkIfEntry.supplierInfo

                        // const categoryInfo = await this.getCategory(importRef.categoryMap.categories_map, product.name, category, subcategory, sub2category);

                        // data.category = categoryInfo.id

                        // if (!checkIfEntry.publishedAt) {
                        //     data.publishedAt = new Date()
                        //     data.deletedAt = null
                        //     dbChange = 'republished'
                        // }

                        // if (!checkIfEntry.brand) {
                        //     const brandId = await this.brandIdCheck(null, checkIfEntry.name)
                        //     if (brandId)
                        //         data.brand = brandId
                        // }

                        // const { updatedSupplierInfo, isUpdated } = await this.updateSupplierInfo(entry, product, supplierInfo)

                        // if (isUpdated) {
                        //     dbChange = 'updated';
                        //     data.supplierInfo = updatedSupplierInfo
                        // }

                        // const productPrice = await strapi
                        //     .plugin('import-products')
                        //     .service('helpers')
                        //     .setPrice(checkIfEntry, supplierInfo, categoryInfo, checkIfEntry.brand?.id);

                        // data.price = productPrice
                        // data.model = checkIfEntry.prod_chars.find(x => x.name === "Μοντέλο")?.value;

                        // // if (entry.name === "Novatron" && product.short_description) {
                        // //     let result = product.short_description.match(/[0-9].[0-9]mm/g)
                        // //     if (result) {
                        // //         data.name = `${product.name}-${result[0]}`;
                        // //         data.slug = slugify(`${product.name}-${result[0]}-${product.supplierCode}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })

                        // //         // console.log(result[0])
                        // //     }
                        // // }

                        // await strapi.entityService.update('api::product.product', checkIfEntry.id, {
                        //     data: data,
                        // });

                        // switch (dbChange) {
                        //     case 'republished':
                        //         importRef.republished += 1
                        //         console.log("Republished:", importRef.republished)
                        //         break;
                        //     case 'updated':
                        //         importRef.updated += 1
                        //         console.log("Update:", importRef.updated)
                        //         break;
                        //     default:
                        //         importRef.skipped += 1
                        //         console.log("Skipped:", importRef.skipped)
                        //         break;
                        // }


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

        if (supplierInfo.in_offer) {
            supplierInfo.in_offer = product.in_offer
        }

        if (product.initial_retail_price) {
            supplierInfo.initial_retail_price = parseFloat(product.initial_retail_price).toFixed(2)
        }

        if (product.retail_price) {
            supplierInfo.retail_price = parseFloat(product.retail_price).toFixed(2)
        }

        if (product.recycle_tax) {
            supplierInfo.recycle_tax = parseFloat(product.recycle_tax).toFixed(2)
        }

        return supplierInfo
    },

    async updateSupplierInfo(entry, product, supplierInfo) {

        //Προσπάθησα να αφαιρέσω τα price_progress που δεν έχουν τιμη wholesale,
        //θέλει βελτίωση.
        // for (let i = 0; i < supplierInfo.length; i++) {
        //     supplierInfo[i].price_progress = supplierInfo[i].price_progress.filter(removeEmptyWholesale)
        // }

        // function removeEmptyWholesale(o) {
        //     return !isNaN(o)
        // }

        let isUpdated = false;
        let dbChange = 'skipped'

        let supplierInfoUpdate = supplierInfo.findIndex(o => o.name === entry.name)

        if (supplierInfoUpdate !== -1) {
            if (parseFloat(supplierInfo[supplierInfoUpdate].wholesale).toFixed(2) !== parseFloat(product.wholesale).toFixed(2)) {
                // console.log(product)
                // console.log("product", product.name)
                // console.log("New wholesale:", product.wholesale, "Previous wholesale:", supplierInfo[supplierInfoUpdate].wholesale)

                const price_progress = supplierInfo[supplierInfoUpdate].price_progress;

                const price_progress_data = this.createPriceProgress(product)

                price_progress.push(price_progress_data)

                supplierInfo[supplierInfoUpdate] = this.createSupplierInfoData(entry, product, price_progress)
                // console.log("supplierInfoUpdate", supplierInfo[supplierInfoUpdate])
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
            // console.log("New supplier!!!!!!!!")

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

        // console.log("importedURL:", entry.importedURL)
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
            else if (entry.name === "Shopflix") {
                let { data } = await Axios.get(`${entry.importedURL}`)
                const xml = await this.parseXml(await data)

                return await xml;
            }
            // else if (entry.name === "Westnet") {
            //     return await strapi
            //         .plugin('import-products')
            //         .service('westnetHelper')
            //         .getWestnetData(entry, categoryMap)
            // }
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
                return new Promise(async (resolve, reject) => {
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
            console.log(error)
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
                                { mpn: { $notNull: true, } }
                            ]
                        },
                        {
                            $and: [
                                { mpn: model },
                                { mpn: { $notNull: true, } }
                            ]
                        },
                        {
                            $and: [
                                { model: mpn },
                                { model: { $notNull: true, } }
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
                                { mpn: { $null: true, } }
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
                    }
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

                        // console.log(subcategory2Mapping)
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

    getGlobalsatProductURL(data) {
        try {
            const category = data[" Category "].trim()
            const subcategory1 = data[" Sub Category 1 "].trim()
            const subcategory2 = data[" Sub Category 2 "].trim()
            const description = data[" GS Description "].trim()
            const gsCode = data["GS Code"]
            const mpn = data.partNumber.toLowerCase().replace(".", "-").replace(/\//g, "");

            const gsDescription = description.toLowerCase()
                .replace(/\./gi, "-").replace(/''/gi, "")
                .replace(/ - /gi, "-").replace(/\//g, "")
                .replace(/"/gi, "")
                .replace(/ /gi, "-").replace(/\+/g, "-plus");


            let productUrl = 'https://www.globalsat.gr/';

            switch (category) {
                case "Bags":
                    productUrl = productUrl.concat("it-axesouar-and-gaming/a_tsantes/b_backpacks/")
                    break;
                case "Charging":
                    productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-fortisis/")
                    switch (subcategory1) {
                        case "Cables":
                            productUrl = productUrl.concat("b_kalodia/")
                            break;
                        case "Car Adaptor":
                            productUrl = productUrl.concat("b_antaptoras-aftokinitou/")
                            break;
                        case "Car Charger":
                            productUrl = productUrl.concat("b_fortistis-aftokinitou/")
                            break;
                        case "PowerBanks":
                            productUrl = productUrl.concat("b_powerbanks/")
                            break;
                        case "Travel Adaptor":
                            productUrl = productUrl.concat("b_antaptoras-taxidiou/")
                            break;
                        case "Travel Charger":
                            productUrl = productUrl.concat("b_fortistis-taxidiou/")
                            break;
                        case "Wireless Charger":
                            productUrl = productUrl.concat("b_asurmatoi-fortistes/")
                            break;
                        default:
                            break;
                    }
                    break;
                case "Connectivity":
                    productUrl = productUrl.concat("it-axesouar-and-gaming/a_perifereiaka-pc/b_web-cameras/")
                    break;
                case "Extended":
                    switch (subcategory1) {
                        case "Adaptors":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_antaptores/")
                            switch (subcategory2) {
                                case "SIM Cards":
                                    productUrl = productUrl.concat("b_sim-cards/")
                                    break;
                                case "Converter":
                                    productUrl = productUrl.concat("b_converter/")
                                    break;
                                default:
                                    break;
                            }
                            break;
                        case "Backpacks":
                            productUrl = productUrl.concat("it-axesouar-and-gaming/a_tsantes/b_backpacks/")
                            break;
                        case "Car Holder":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-aftokinitou/")
                            break;
                        case "Consumable Batteries":
                            if (description.includes("Rechargable")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_katanalotikes-mpataries/b_epanafortizomenes/")
                            }
                            else {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_katanalotikes-mpataries/b_alkalikes/")
                            }
                            break;
                        case "Desktop":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-grafeiou/")
                            break;
                        case "E-Mobility":
                            productUrl = productUrl.concat("exupni-metakinisi/a_ilektrokinita-ochimata/")
                            switch (subcategory2) {
                                case "Scooter":
                                    productUrl = productUrl.concat("b_e-scooters/")
                                    break;
                                case "Bike":
                                    productUrl = productUrl.concat("b_e-bikes/")
                                    break;
                                case "Accessories":
                                    productUrl = productUrl.concat("b_axesouar-ilektrokiniton-ochimaton/")
                                    break;
                                default:
                                    break;
                            }
                            break;
                        case "Gadgets":
                            if (description.includes("Lamp")) {
                                productUrl = productUrl.concat("lampes-fotismos-and-fakoi/a_fotistika-and-provoleis/b_fotistika/")
                            }
                            else if (description.includes("Car Front Window Sunshade")) {
                                productUrl = productUrl.concat("eidi-taxidiou-and-camping/a_axesouar-aftokinitou/b_axesouar-aftokinitou/")
                            }
                            else if (description.includes("Bracket", "Holder")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-grafeiou/")
                            }
                            else if (description.includes("AirTag")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_gadgets/b_loipa-gadgets/")
                            }
                            break;
                        case "Holders":
                            if (description.includes("Selfie Stick")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_gadgets/b_selfie-stick/")
                            }
                            else if (description.includes("Vehicle Backseat")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_gadgets/b_loipa-gadgets/")
                            }
                            else if (description.includes("Laptop Portable Stand")) {
                                productUrl = productUrl.concat("it-axesouar-and-gaming/a_cooling-stands/b_cooling-stands/")
                            }
                            else if (description.includes("Screen/Dash Holder", "Backseat Car", "Car Mount")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-aftokinitou/")
                            }
                            else if (description.includes("Desktop Bracket")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-grafeiou/")
                            }
                            else if (description.includes("Motorcycle Holder")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-dikuklou/")
                            }
                            else if (description.includes("Motorcycle Holder")) {
                                productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-dikuklou/")
                            }
                            break;
                        case "microSD":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-mvimis/b_microsd/")
                            break;
                        case "Mouse":
                            productUrl = productUrl.concat("it-axesouar-and-gaming/a_perifereiaka-pc/b_pontikia/")
                            break;
                        case "Others":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_gadgets/b_loipa-gadgets/")
                            break;
                        case "Smart Pen":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_gadgets/b_smart-pen/")
                            break;
                        case "USB Sticks":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-mvimis/b_usb-sticks/")
                            break;
                        case "Τηλεόραση & Περιφερειακά":
                            productUrl = productUrl.concat("eikona-and-ichos/a_tileorasi-and-periferiaka/b_android-boxes/")
                            break;
                        default:
                            break;
                    }
                    break;
                case "Gadgets":
                    productUrl = productUrl.concat("kiniti-tilefonia/a_vaseis-stirixis/b_vaseis-grafeiou/")
                    break;
                case "Gaming":
                    switch (subcategory1) {
                        case "Consoles":
                            productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_konsoles/")
                            break;
                        case "Games":
                            productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_paichnidia/")
                            break;
                        case "Peripherals":
                            productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_perifereiaka/")
                            break;
                        case "Prepaid Cards":
                            productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_prepaid-cards/")
                            break;
                        default:
                            break;
                    }
                    break;
                case "GAMING ACCESSORIES":
                    if (description.includes("Backpack")) {
                        productUrl = productUrl.concat("it-axesouar-and-gaming/a_tsantes/b_backpacks/")
                    }
                    else if (description.includes("Mouse Pad")) {
                        productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_gaming-mousepads/")
                    }
                    else if (description.includes("Mouse")) {
                        productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_gaming-pontikia/")
                    }
                    break;
                case "Home":
                    switch (subcategory1) {
                        case "Connectivity":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-spitiou/b_connectivity/")
                            break;
                        case "Fixed Telephony":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-spitiou/b_statheri-tilefonia/")
                            break;
                        case "Smarthome":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-spitiou/b_smarthome/")
                            break;
                        default:
                            break;
                    }
                    break;
                case "Hubs & Card Readers":
                    productUrl = productUrl.concat("kiniti-tilefonia/a_antaptores/b_converter/")
                    break;
                case "IT ACCESSORIES":
                    productUrl = productUrl.concat("it-axesouar-and-gaming/a_pc-and-console-gaming/b_gaming-pontikia/")
                    break;
                case "MICE & KEYBOARDS":
                    productUrl = productUrl.concat("it-axesouar-and-gaming/a_perifereiaka-pc/b_pontikia/")
                    break;
                case "Protection":
                    switch (subcategory1) {
                        case "Cases":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-prostasias/b_thikes-gia-smartphones/")
                            break;
                        case "Tempered Glass":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-prostasias/b_prostasia-othonis/")
                            break;
                        case "Tablet Smart Case":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-prostasias/b_thikes-gia-tablet/")
                            break;
                        default:
                            break;
                    }
                    break;
                case "Sound":
                    switch (subcategory1) {
                        case "Bluetooth":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-ichou/b_bluetooth/")
                            break;
                        case "Handsfree":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-ichou/b_handsfree/")
                            break;
                        case "Headphones":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-ichou/b_akoustika-kefalis/")
                            break;
                        case "Speaker":
                        case "Speakers":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-ichou/b_forita-icheia/")
                            break;
                        case "True Wireless":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-ichou/b_true-wireless/")
                            break;
                        default:
                            productUrl = productUrl.concat("kiniti-tilefonia/a_axesouar-ichou/b_handsfree/")
                            break;
                    }
                    break;
                case "Wearables":
                    switch (subcategory1) {
                        case "Activity Tracker":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_wearables/b_activity-trackers/")
                            break;
                        case "Smartwatch":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_wearables/b_smartwatch/")
                            break;
                        case "Strap":
                            productUrl = productUrl.concat("kiniti-tilefonia/a_wearables/b_axesouar-gia-wearables/")
                            break;
                        default:
                            break;
                    }
                    break;
                case "Ηλεκτρικές Σκούπες":
                    productUrl = productUrl.concat("eidi-spitiou-and-mikrosuskeues/a_ilektriki-skoupa/b_rompotiki-skoupa/")
                    break;
                case "Πληκτρολόγια Η/Υ":
                    productUrl = productUrl.concat("it-axesouar-and-gaming/a_perifereiaka-pc/b_pliktrologia/")
                    break;
                case "Ποντικία Η/Υ":
                    productUrl = productUrl.concat("it-axesouar-and-gaming/a_perifereiaka-pc/b_pontikia/")
                    break;
                case "Υγεία & Ευεξία":
                    productUrl = productUrl.concat("prosopiki-frontida-and-paidi/a_ugeia-and-euexia/b_zugaries-somatos/")
                    break;
                default:
                    break;
            }

            productUrl = productUrl.trim().concat(`${gsDescription}-${mpn}-${gsCode}`)

            return productUrl
        } catch (error) {
            // console.log(error)
        }

    },

    async getCategory(categoryMap, name, category, sub_category, sub_category2) {
        let cat = categoryMap.find(x => x.name.trim().toLowerCase() === category.trim().toLowerCase())

        let categoryMapping = "Uncategorized"

        if (cat) {
            let sub = cat.subcategory.find(x => x.name.trim().toLowerCase() === sub_category.toLowerCase().trim())
            if (sub) {
                let sub2 = sub.subcategory.find(x => x.name.trim().toLowerCase() === sub_category2.toLowerCase().trim())
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
            select: ['id', 'slug'],
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

    async scrapOktabit(productUrl) {
        try {
            // const browser = await puppeteer.launch();
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            const page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");
            await page.goto(productUrl, { waitUntil: "networkidle0" });

            const bodyHandle = await page.$('body');
            // const specs = await bodyHandle.$("div #specsTab");
            let scrap = await bodyHandle.evaluate(() => {
                let prod_chars = [];
                const prodSpecs = document.querySelector("#product-specifications");
                if (prodSpecs) {
                    const charTable = prodSpecs.querySelector("table");
                    const charTableBody = charTable.querySelector("tbody");
                    const charRows = charTableBody.querySelectorAll("tr");
                    for (let row of charRows) {
                        prod_chars.push({
                            name: row.querySelector("th").textContent.trim(),
                            value: row.querySelector("td").textContent.trim(),
                        })
                    }
                }
                const descriptionwrapper = document.querySelector("#product-description");
                let description = ''
                if (descriptionwrapper)
                    description = descriptionwrapper.textContent.trim()

                let rows = document.querySelectorAll(".text-muted");
                let EAN = ""
                if (rows) {
                    rows.forEach(row => {
                        if (row.textContent.trim().includes("EAN/UPC:")) {
                            EAN = row.textContent.trim().slice(8).trim();
                        }
                    })
                }

                let inOffer = false;
                const offer = document.querySelector("#product-description");
                if (offer)
                    inOffer = true;

                const body = document.querySelector(".content");
                const galleryThumps = body.querySelector(".swiper-container.gallery-thumbs");
                const slides = galleryThumps.querySelectorAll(".swiper-slide");

                let imageUrls = []
                for (let slide of slides) {
                    let slideStyle = slide.getAttribute("style")
                    let styles = slideStyle.split(";")
                    styles.forEach(style => {
                        let backgroundImage = style.includes("background-image:")
                        if (backgroundImage) {
                            let imageString = style.split("(")[1]
                            let image = imageString.slice(1, imageString.length - 2)
                            imageUrls.push(`https://www.oktabit.gr${image}`)
                        }
                    }
                    )
                }

                return { prod_chars, description, EAN, inOffer, imageUrls };
            });

            await browser.close();
            return { scrap }
        } catch (error) {
            console.log(error)
        }
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

    async saveLogicomCookies() {
        try {
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            const page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");
            await page.goto('https://logicompartners.com/el-gr/countries', { waitUntil: "networkidle0" });
            let url = page.url()

            await page.click('a[data-store="SanaStore_GR"]');
            await page.waitForNavigation()

            const acceptCookies = await page.$('.btn-cookies-accept')
            await acceptCookies.click();

            const cookies = await page.cookies();
            const cookiesJson = JSON.stringify(cookies, null, 2)
            fs.writeFile('./public/LogicomCookies.json', cookiesJson, (err) => {
                if (err)
                    console.log(err);
                else {
                    // console.log("File written successfully\n");
                }
            });

            await browser.close();

        } catch (error) {

        }
    },

    async scrapLogicom(itemID) {
        try {

            // { headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' }
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            const page = await browser.newPage();
            if (!fs.existsSync('./public/LogicomCookies.json')) {
                await this.saveLogicomCookies()
            }
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            fs.readFile('./public/LogicomCookies.json', async (err, data) => {
                if (err)
                    console.log(err);
                else {
                    const cookies = JSON.parse(data);
                    await page.setCookie(...cookies);
                    // console.log("File readen successfully\n");
                }
            })

            await page.goto('https://logicompartners.com/el-gr/', { waitUntil: "networkidle0" });

            const pageUrl = page.url();

            if (pageUrl === "https://logicompartners.com/el-gr/countries") {

                this.saveLogicomCookies()
            }

            const acceptCookies = await page.$('.btn-cookies-accept')
            if (acceptCookies) {
                await acceptCookies.click();
            }

            const searchBox = await page.$('#searchbox')
            searchBox.type(`${itemID}`)
            await page.waitForResponse(response => response.status() === 200)
            const searchBoxUl = await page.waitForSelector('#ui-id-1', { visible: true })
            const searchBoxFirstLi = await searchBoxUl.$('li.ui-menu-item')

            const [response] = await Promise.all([
                // The promise resolves after navigation has finished
                searchBoxFirstLi.click('a'), // Clicking the link will indirectly cause a navigation
            ]);
            await page.waitForNavigation()

            const bodyHandle = await page.$('body');

            let scrap = await bodyHandle.evaluate(() => {
                let prod_chars = [];
                const prodSpecs = document.querySelector("#specifications");
                if (prodSpecs) {
                    const charTable = prodSpecs.querySelector("table");
                    const charTableBody = charTable.querySelector("tbody");
                    const charRows = charTableBody.querySelectorAll("tr");
                    for (let row of charRows) {
                        const charValue = row.querySelectorAll('td')
                        prod_chars.push({
                            name: charValue[0].innerHTML.trim(),
                            value: charValue[1].innerHTML.trim()
                        })
                    }
                }

                let imagesSrc = []
                const detailsImg = document.querySelector("div.details-img")
                const imageWrapper = detailsImg.querySelector("div")
                const slickList = imageWrapper.querySelector("div")
                const slickTrack = slickList.querySelector("div")
                const images = slickTrack.querySelectorAll("div>img")
                images.forEach(image => {
                    if (imagesSrc.length < 5) {
                        if (imagesSrc.length === 0) {
                            imagesSrc.push(`https://www.logicompartners.com${image.getAttribute("src")}`);
                        }
                        else {
                            imagesSrc.push(`https://www.logicompartners.com${image.getAttribute("data-src")}`);
                        }
                    }
                })

                return { prod_chars, imagesSrc };
            });

            await browser.close();
            return { scrap, productUrl: page.url() }
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

            // const reduceApiEndpoints = async (previous, endpoint) => {
            //     await previous;
            //     index === 1 ? imageIDS.mainImage.push(previous)
            //         : imageIDS.additionalImages.push(previous)
            //     return apiCall(endpoint);
            // };

            // const sequential = product.ImageURLS.reduce(reduceApiEndpoints, Promise.resolve());

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
                        // console.log("Axios Error:", productName, imgUrl.url, "Supplier Code:", product.supplierInfo[0].supplierProductId);
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
                        // .toBuffer({ resolveWithObject: true })                        
                        // .then(({ data }) => {
                        //     const formData = new FormData();
                        //     formData.append("files", data,
                        //         {
                        //             filename: `${productName}_${index}.webp`,
                        //         },

                        //     );
                        //     formData.append('fileInfo', JSON.stringify({
                        //         alternativeText: `${productName}_${index}`,
                        //         caption: `${productName}_${index}`
                        //     }));
                        //     formData.append("refId", entryID);
                        //     formData.append("ref", "api::product.product");
                        //     if (index === 1) {
                        //         formData.append("field", "image");
                        //     }
                        //     else {
                        //         formData.append("field", "additionalImages");
                        //     }
                        //     return formData
                        // })
                        // .then(async (formData) => {
                        //     try {
                        //         await strapi.plugins.upload.services.upload.upload({

                        //         })
                        //         // const imgid = await Axios.post(`${process.env.PUBLIC_API_URL}/upload`, formData, {
                        //         //     headers: {
                        //         //         ...formData.getHeaders(),
                        //         //         Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
                        //         //     }
                        //         // })
                        //         // if (index === 1) {
                        //         //     //Δημιουργώ αυτόματα το SEO για το προϊόν 
                        //         //     await strapi
                        //         //         .plugin('import-products')
                        //         //         .service('helpers')
                        //         //         .saveSEO(await imgid, product, entryID);
                        //         // mainImageID = await imgid
                        //         return await imgid.data[0]
                        //         // }
                        //     } catch (error) {
                        //         console.log("Axios Error:", error.response?.data)
                        //     }
                        // })
                        // .then(async (imgid) => {
                        //     if (index === 1) {
                        //         //Δημιουργώ αυτόματα το SEO για το προϊόν 
                        //         await strapi
                        //             .plugin('import-products')
                        //             .service('helpers')
                        //             .saveSEO(imgid, product, entryID);
                        //     }
                        // })
                        // απο εδώ ξεκινά η προσπάθεια
                        .toFile(`./public/tmp/${productName}_${index}.webp`)
                        .then(async () => {
                            const image = await strapi
                                .plugin('import-products')
                                .service('imageHelper')
                                .upload(`./public/tmp/${productName}_${index}.webp`, 'uploads');
                            return image
                        })
                        .then((image) => {
                            // console.log("ImageID:", image.id, "Index:", index)
                            index === 1 ? imageIDS.mainImage.push(image.id)
                                : imageIDS.additionalImages.push(image.id)
                        })
                        // .then(async () => { return await this.delay(3000) })
                        // εδώ τελιώνει
                        .catch(err => {
                            console.error("Error processing files, let's clean it up", err, "File:", product.name, "supplier Code:", product.supplierCode);
                            try {
                                fs.unlinkSync(`./public/tmp/${productName}_${index}.webp`);
                            } catch (e) {
                                console.log(e)
                                return
                            }
                        })

                    // const image = await strapi
                    //     .plugin('import-products')
                    //     .service('imageHelper')
                    //     .upload(`./public/tmp/${productName}_${index}.webp`, 'uploads');

                    // console.log(image)
                    // return image;

                } catch (error) {
                    console.log("Axios Error:", error)
                }
            }

            if (imageIDS.imgUrls.length === 0) { return }

            // await this.saveImageURLS(imgUrls, entryID)

            // console.log("imageIDS:", imageIDS)
            return imageIDS
            // if (mainImageID) {
            //     return { mainImageID } 
            // } else {
            //     return null
            // }
        } catch (error) {
            console.log("Error in converting Image:", error)
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
                if (mapCharNames.get(char.name) !== undefined) {
                    char.name = mapCharNames.get(char.name)
                }
                if (char.value) {
                    if (mapCharValues.get(char.value) !== undefined) {
                        char.value = mapCharValues.get(char.value)
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
                const parsedChars = await this.parseChars(entry.prod_chars, mapCharNames, mapCharValues)

                const updateProduct = await strapi.entityService.update('api::product.product', entry.id, {
                    data: {
                        prod_chars: parsedChars,
                    },
                });
            }

            return { "message": 'ok' }
        } catch (error) {
            console.log(error)
        }
    },

    async setPrice(existedProduct, supplierInfo, categoryInfo, brandId) {
        try {
            const generalCategoryPercentage = process.env.GENERAL_CATEGORY_PERCENTAGE
            const taxRate = process.env.GENERAL_TAX_RATE

            const filteredSupplierInfo = supplierInfo.filter(x => x.in_stock === true)

            let minSupplierPrice = filteredSupplierInfo?.reduce((prev, current) => {
                return (prev.wholesale < current.wholesale) ? prev : current
            })

            let generalPercentage = ''
            let addToPrice = 0
            if (categoryInfo.cat_percentage && categoryInfo.cat_percentage.length > 0) {

                let findPercentage = categoryInfo.cat_percentage.find(x => x.name === "general")

                if (findPercentage) {
                    addToPrice = findPercentage.add_to_price ? findPercentage.add_to_price : 0;
                    if (findPercentage.brand_perc && findPercentage.brand_perc.length > 0) {
                        let findBrandPercentage = findPercentage.brand_perc.find(x => x.brand?.id === brandId)
                        if (findBrandPercentage) {
                            generalPercentage = findBrandPercentage.percentage
                        }
                        else {
                            generalPercentage = findPercentage.percentage
                        }
                    }
                    else {
                        generalPercentage = findPercentage.percentage
                    }
                }
                else {
                    generalPercentage = generalCategoryPercentage
                }
            }
            else {
                generalPercentage = generalCategoryPercentage
            }

            let minPrice = parseFloat(minSupplierPrice.wholesale + addToPrice) * (taxRate / 100 + 1) * (generalPercentage / 100 + 1)

            return existedProduct && existedProduct.price > minPrice && existedProduct.is_fixed_price ? parseFloat(existedProduct.price).toFixed(2) : minPrice.toFixed(2)

        } catch (error) {
            console.log(error)
        }
    },

    async exportToXML(supplier) {
        try {
            console.log(supplier)
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
                                    }
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

            let finalEntries = []

            delete entries.id;
            delete entries.name;

            // console.log(entries.related_products.length)

            for (let entry of entries.related_products) {
                let newEntry = {
                    name: entry.name,
                    description: entry.description,
                    price: entry.price,
                    sku: entry.sku,
                    mpn: entry.mpn,
                    status: entry.status,
                    image: entry.image?.url,
                    short_description: entry.short_description,
                    barcode: entry.barcode,
                    category: entry.category.name,
                    category_slug: entry.category.slug,
                    brand: entry.brand ? entry.brand?.name : ""
                }

                let chars1 = []

                for (let char of entry.prod_chars) {
                    chars1.push({ name: char.name, value: char.value.replace(/[^a-zA-Z0-9_.-/'"]/g, " ") })
                }

                let imageURL = []

                // console.log(entry.ImageURLS)
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

            // console.log(xml)

            // fs.writeFile(`./public/${supplier}.xml`, xml, (err) => {
            //     if (err)
            //         console.log(err);
            //     else {
            //         console.log("File written successfully\n");
            //     }
            // });

            // const response = fs.readFile(`./public/${supplier}.xml`)

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
            // console.log("New Product:", product.name)

            //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await this.getCategory(importRef.categoryMap.categories_map, product.name, product.category.title, product.subcategory.title, product.sub2category.title);

            const price_progress_data = this.createPriceProgress(product)

            const supplierInfo = [this.createSupplierInfoData(product.entry, product, price_progress_data)]

            const productPrice = await this.setPrice(null, supplierInfo, categoryInfo, product.brand?.id);

            // const { mapCharNames, mapCharValues } = importRef.charMaps

            // //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
            // const parsedChars = await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .parseChars(product.prod_chars, mapCharNames, mapCharValues)

            product.supplierInfo = supplierInfo
            product.category = categoryInfo.id;
            product.price = parseFloat(productPrice);
            // product.prod_chars = parsedChars;

            const data = {
                name: product.name,
                slug: slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*±+~=#.,°;_()/'"!:@]/g }),
                category: categoryInfo.id,
                price: parseFloat(productPrice).toFixed(2),
                publishedAt: new Date(),
                status: product.status,
                related_import: product.entry.id,
                supplierInfo: supplierInfo,
                prod_chars: product.prod_chars,
                ImageURLS: product.imagesSrc,


                // short_description: product.short_description,
                // description: product.description,                        
                // mpn: product.mpn ? product.mpn : null,                        
                // brand: { id: brandId },                        
            }

            if (product.entry.name === "Novatron" && product.short_description) {
                let result = product.short_description.match(/[0-9].[0-9]mm/g)
                if (result) {
                    data.name = `${product.name}-${result[0]}`;
                    data.slug = slugify(`${product.name}-${result[0]}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })

                    // console.log(result[0])
                }
            }

            if (product.mpn) {
                data.mpn = product.mpn.trim()
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

            //Κατευάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
            let responseImage = await strapi
                .plugin('import-products')
                .service('helpers')
                .getAndConvertImgToWep(data, null, auth);

            // console.log("ResponseImage:", await responseImage)

            data.image = await responseImage?.mainImage[0]
            data.additionalImages = await responseImage?.additionalImages
            data.ImageURLS = await responseImage?.imgUrls

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
            // console.log("Created:", importRef.created)
        } catch (error) {
            console.log("Error in Entry Function:", error, error.details?.errors, product.name)
        }

    },

    async importScrappedProduct(product, importRef, auth) {
        try {
            if (!product.wholesale || isNaN(product.wholesale))
                return;

            // Αν δεν είναι Διαθέσιμο τότε προχώρα στο επόμενο
            const isAvailable = this.filterScrappedProducts(importRef.categoryMap, product);

            if (!isAvailable)
                return

            const { entryCheck, brandId } = await this.checkProductAndBrand(product.mpn, product.name, product.barcode, product.brand_name, product.model);

            //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
            const { mapCharNames, mapCharValues } = importRef.charMaps

            const parsedChars = await strapi
                .plugin('import-products')
                .service('helpers')
                .parseChars(product.prod_chars, mapCharNames, mapCharValues)

            if (brandId) { product.brand = { id: brandId } }
            product.prod_chars = parsedChars

            if (!entryCheck) {
                try {
                    await this.createEntry(product, importRef, auth)
                    // console.log("New Product:", product.name)

                    // //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
                    // const categoryInfo = await this.getCategory(importRef.categoryMap.categories_map, product.name, product.category.title, product.subcategory.title, product.sub2category.title);

                    // const price_progress_data = this.createPriceProgress(product)

                    // const supplierInfo = [this.createSupplierInfoData(product.entry, product, price_progress_data)]

                    // const productPrice = await this.setPrice(null, supplierInfo, categoryInfo, brandId);

                    // const data = {
                    //     name: product.name,
                    //     slug: slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g }),
                    //     category: categoryInfo.id,
                    //     price: parseFloat(productPrice).toFixed(2),
                    //     publishedAt: new Date(),
                    //     status: product.status.trim(),
                    //     related_import: product.entry.id,
                    //     supplierInfo: supplierInfo,
                    //     prod_chars: product.prod_chars,
                    //     ImageURLS: product.imagesSrc,

                    //     // short_description: product.short_description,
                    //     // description: product.description,                        
                    //     // mpn: product.mpn ? product.mpn : null,                        
                    //     // brand: { id: brandId },                        
                    // }

                    // if (product.entry.name === "Novatron" && product.short_description) {
                    //     let result = product.short_description.match(/[0-9].[0-9]mm/g)
                    //     if (result) {
                    //         data.name = `${product.name}-${result[0]}`;
                    //         data.slug = slugify(`${product.name}-${result[0]}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })

                    //         // console.log(result[0])
                    //     }
                    // }

                    // if (product.mpn) {
                    //     data.mpn = product.mpn.trim()
                    // }

                    // if (product.barcode) {
                    //     data.barcode = product.barcode.trim()
                    // }

                    // if (product.model) {
                    //     data.model = product.model.trim()
                    // }

                    // if (product.description) {
                    //     data.description = product.description.trim()
                    // }

                    // if (product.short_description) {
                    //     data.short_description = product.short_description.trim()
                    // }

                    // if (brandId) {
                    //     data.brand = { id: brandId }
                    // }

                    // const newEntry = await strapi.entityService.create('api::product.product', {
                    //     data: data,
                    // });

                    // //Κατεβάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
                    // let responseImage = await strapi
                    //     .plugin('import-products')
                    //     .service('helpers')
                    //     .getAndConvertImgToWep(data, newEntry.id, auth);

                    // // //Δημιουργώ αυτόματα το SEO για το προϊόν
                    // await strapi
                    //     .plugin('import-products')
                    //     .service('helpers')
                    //     .saveSEO(responseImage.mainImageID.data[0], data, newEntry.id);

                    // importRef.related_entries.push(newEntry.id)
                    // if (product.relativeProducts && product.relativeProducts.length > 0)
                    //     importRef.related_products.push({ productID: newEntry.id, relatedProducts: product.relativeProducts })

                    // importRef.created += 1;
                    // console.log("Created:", importRef.created)
                } catch (error) {
                    console.log("entryCheck:", entryCheck, "mpn:", product.mpn, "name:", product.name,
                        "barcode:", product.barcode, "brand_name:", product.brand_name, "model:", product.model)
                    console.log(error, error.details?.errors)
                }
            }
            else {
                try {
                    await this.updateEntry(entryCheck, product, importRef)
                    // console.log("Existed Data:", product.name)

                    // //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
                    // const categoryInfo = await this.getCategory(importRef.categoryMap.categories_map, product.name, product.category.title, product.subcategory.title, product.sub2category.title);

                    // importRef.related_entries.push(entryCheck.id)

                    // if (product.relativeProducts && product.relativeProducts.length > 0)
                    //     importRef.related_products.push({ productID: entryCheck.id, relatedProducts: product.relativeProducts })

                    // let supplierInfo = entryCheck.supplierInfo
                    // const relatedImport = entryCheck.related_import;
                    // const relatedImportId = relatedImport.map(x => x.id)

                    // const findImport = relatedImport.findIndex(x =>
                    //     x.id === product.entry.id)

                    // if (findImport === -1) { relatedImportId.push(product.entry.id) }

                    // const { updatedSupplierInfo, isUpdated } = await strapi
                    //     .plugin('import-products')
                    //     .service('helpers')
                    //     .updateSupplierInfo(product.entry, product, supplierInfo)

                    // if (isUpdated) {
                    //     supplierInfo = updatedSupplierInfo
                    // }

                    // const productPrice = await strapi
                    //     .plugin('import-products')
                    //     .service('helpers')
                    //     .setPrice(entryCheck, supplierInfo, categoryInfo, brandId);

                    // await strapi.entityService.update('api::product.product', entryCheck.id, {
                    //     data: {
                    //         // name: product.productTitle,
                    //         category: categoryInfo.id,
                    //         model: product.model ? product.model : null,
                    //         price: parseFloat(productPrice),
                    //         supplierInfo: supplierInfo,
                    //         related_import: relatedImportId,
                    //         publishedAt: new Date()
                    //     },
                    // });
                    // importRef.updated += 1
                    // console.log("Updated:", importRef.updated)
                } catch (error) {
                    console.log(error)
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async updateEntry(entryCheck, product, importRef) {
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
            // console.log("categoryInfo.id:", categoryInfo.id, "entryCheck.categories", entryCheck.category)
        }

        const { updatedSupplierInfo, isUpdated } = await strapi
            .plugin('import-products')
            .service('helpers')
            .updateSupplierInfo(product.entry, product, supplierInfo)

        if (isUpdated) {
            const productPrice = await strapi
                .plugin('import-products')
                .service('helpers')
                .setPrice(entryCheck, supplierInfo, categoryInfo, product.brand?.id);

            data.price = parseFloat(productPrice)
            data.supplierInfo = updatedSupplierInfo
            data.model = product.model ? product.model : null
            dbChange = 'updated'
        }

        if (entryCheck.publishedAt === null) {
            data.publishedAt = new Date()
            data.deletedAt = null
            dbChange = 'republished'
        }

        if (Object.keys(data).length !== 0) {
            await strapi.entityService.update('api::product.product', entryCheck.id, {
                data
            });

        }

        switch (dbChange) {
            case 'republished':
                importRef.republished += 1
                // console.log("Republished:", importRef.republished)
                break;
            case 'updated':
                importRef.updated += 1
                // console.log("Update:", importRef.updated)
                break;
            case 'created':
                importRef.created += 1
                // console.log("Created:", importRef.created)
                break;
            default:
                importRef.skipped += 1
                // console.log("Skipped:", importRef.skipped)
                break;
        }
        // const imgUrls = []


        // console.log("Updated:", importRef.updated, "Skipped:", importRef.skipped)
    },

    async deleteEntry(entry, importRef) {

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

        console.log("related_products:", importXmlFile.related_products.length,
            "importRef.related_entries:", importRef.related_entries.length)


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
                    // console.log(supplierInfo, index)
                    supplierInfo[index].in_stock = false;
                }

                const isAllSuppliersOutOfStock = supplierInfo.every(supplier => supplier.in_stock === false)
                // supplierInfo.splice(index, 1)
                // console.log("Product Deleted:", product.name)
                if (!isAllSuppliersOutOfStock) {
                    data.supplierInfo = supplierInfo
                }
                else {
                    data.supplierInfo = supplierInfo
                    data.publishedAt = null
                    data.deletedAt = new Date();
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
    },
})
