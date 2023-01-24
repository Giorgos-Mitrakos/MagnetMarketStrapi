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

module.exports = ({ strapi }) => ({

    async xPathFilter(result, entry) {
        const docParser = new DOMParser()
        var serializer = new XMLSerializer();
        const doc = docParser.parseFromString(result.data, "application/xml")

        try {
            if (entry.xPath !== "") {
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
            else if (entry.name === "Shopflix") {
                let { data } = await Axios.get(`${entry.importedURL}`)
                const xml = await this.parseXml(await data)

                return await xml;
            }
            let data = Axios.get(`${entry.importedURL}`)
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

        // const { categories_map, char_name_map, char_value_map, stock_map,
        //     isWhitelistSelected, whitelist_map, blacklist_map,
        //     xPath, minimumPrice, maximumPrice } = await categoryMap

        const charMaps = await this.parseCharsToMap(char_name_map, char_value_map);

        const newData = this.filterData(data, dataTitles, await categoryMap)
        return { newData, categoryMap, charMaps }
    },

    async brandIdCheck(brand, name) {
        try {
            let brandId;
            if (!brand) {
                const brandEntries = await strapi.entityService.findMany('api::brand.brand', {
                    fields: ['name'],
                });

                // const brands = brandEntries.map(x => x.name)

                const brandFound = brandEntries.find(x => name.toLowerCase().includes(x.name.toLowerCase()))

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

    async checkIfProductExists(mpn, name) {
        const checkIfEntry = await strapi.db.query('api::product.product').findOne({
            where: {
                $or: [
                    { mpn: mpn },
                    {
                        name: name,
                        mpn: { $null: true, }
                    }
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
    },

    async updateAndFilterScrapProducts(products, categoryMap, category, subcategory, sub2category, report, entry) {
        try {
            const newProducts = []
            let stockLevelFilter = []
            for (let stock of categoryMap.stock_map) {
                stockLevelFilter.push(stock.name)
            }

            for (let product of products) {
                // console.log(product) 
                if (stockLevelFilter.includes(product.stockLevel)) {
                    // console.log(product)

                    const checkIfEntry = await strapi.db.query('api::product.product').findOne({
                        where: {
                            // name: product.title,
                            supplierInfo: {
                                supplierProductId: product.supplierCode
                            }
                        },
                        populate: {
                            supplierInfo: {
                                // where: {
                                //     // name: product.title,
                                //     supplierProductId: product.supplierCode
                                // },
                                populate: {
                                    price_progress: true,
                                }
                            },
                            brand: true,
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

                    // console.log("checkIfEntry:", checkIfEntry)

                    if (checkIfEntry) {
                        let dbChange = ''
                        const data = {}
                        const checkIfIsInSupplier = checkIfEntry.supplierInfo.find(x => x.name === entry.name)

                        // console.log("checkIfIsInSupplier:", checkIfIsInSupplier)

                        const supplierInfo = checkIfEntry.supplierInfo

                        const categoryInfo = await this.getCategory(categoryMap.categories_map, product.title, category, subcategory, sub2category);

                        data.category = categoryInfo.id

                        if (!checkIfEntry.publishedAt) {
                            data.publishedAt = new Date()
                            dbChange = 'republished'
                        }

                        if (!checkIfEntry.brand) {
                            const brandId = await this.brandIdCheck(null, checkIfEntry.name)
                            if (brandId)
                                data.brand = brandId
                        }

                        if (parseFloat(checkIfIsInSupplier.wholesale).toFixed(2) !== parseFloat(product.price).toFixed(2)) {
                            // console.log(product)
                            console.log("New wholesale:", product.price, "Previous wholesale:", checkIfIsInSupplier.wholesale)

                            const supplierInfoUpdate = checkIfEntry.supplierInfo.find((o, i) => {

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
                                        wholesale: parseFloat(product.price).toFixed(2),
                                        supplierProductId: product.supplierCode,
                                        // price: parseFloat(salePrice).toFixed(2),
                                        supplierProductURL: checkIfIsInSupplier.supplierProductURL,
                                        in_offer: product.in_offer,
                                        price_progress: price_progress,
                                    }
                                    return true;
                                }
                            })

                            console.log("supplierInfoUpdate:", supplierInfoUpdate)

                            data.supplierInfo = supplierInfo

                            dbChange = 'updated'
                        }

                        const productPrice = await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .setPrice(checkIfEntry, supplierInfo, categoryInfo, checkIfEntry.brand?.id);

                        data.price = productPrice

                        await strapi.entityService.update('api::product.product', checkIfEntry.id, {
                            data: data,
                        });

                        switch (dbChange) {
                            case 'republished':
                                report.republished += 1
                                console.log("Republished:", report.republished)
                                break;
                            case 'updated':
                                report.updated += 1
                                console.log("Update:", report.updated)
                                break;
                            default:
                                report.skipped += 1
                                console.log("Skipped:", report.skipped)
                                break;
                        } 

                        report.related_entries.push(checkIfEntry.id)
                    }
                    else {
                        if (product.price)
                            newProducts.push(product)
                    }
                }
            }

            return newProducts
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

    async saveGlobalsatCookies(page) {
        try {
            const body = await page.$('body');
            const closePopUp = await body.waitForSelector('.closeModal');
            if (closePopUp)
                await closePopUp.evaluate(el => el.click());

            const optionsButton = await body.$('button.open-nv-modal')
            await optionsButton.click()

            const settingsButton = await body.$('button.nvcookies__button--toggle')
            await settingsButton.click()

            const settingsSwitch = await body.$('input.nvswitch__input')
            const v = await (await settingsSwitch.getProperty("checked")).jsonValue()
            if (v) {
                await settingsSwitch.click()
            }

            const consentButton = await body.waitForSelector('#consent-modal-submit');
            await consentButton.click()

            const loginOpen = await body.$('.login_nav_head');
            await loginOpen.click();

            await body.waitForSelector('#UserName')
            const loginSubMenu = await body.waitForSelector('.login')
            const loginForm = await loginSubMenu.$('form')

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
        try {

            // const dataFromExcel = await this.getData(entry)
            // const browser = await puppeteer.launch()
            const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
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

            await page.goto('https://www.globalsat.gr/', { waitUntil: "networkidle0" });
            const body = await page.$('body');
            const login = await body.$('.login')

            if (login) {
                await this.saveGlobalsatCookies(page)
            }

            const newBody = await page.$('body');

            const categories = await this.scrapGlobalsatCategories(newBody)

            const categoryMap = this.getImportMapping(entry);

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map } = await categoryMap

            const charMaps = await this.parseCharsToMap(char_name_map, char_value_map);

            let newCategories = this.filterCategories(categories, isWhitelistSelected, whitelist_map, blacklist_map)

            // console.dir(newCategories)
            for (let category of newCategories) {
                // console.dir(category.subCategories)
                for (let subCategory of category.subCategories) {
                    for (let sub2Category of subCategory.subCategories) {
                        // console.log(subCategory.subCategory) 
                        // console.log(category, subCategory.title, sub2Category.title)
                        await this.scrapGlobalsatCategory(page, categoryMap, category, subCategory, sub2Category, charMaps, dataFromExcel, importRef, entry, auth)
                    }
                }
            }
            await browser.close();

        } catch (error) {
            console.error(error)
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
                        subCategories.push({ title: titleAnchor, link: linkAnchor, subCategories2 })
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

    async scrapGlobalsatCategory(page, categoryMap, category, subCategory, sub2Category, charMaps, dataFromExcel, importRef, entry, auth) {
        try {
            await page.goto(`${sub2Category.link}?wbavlb=Διαθέσιμο&sz=3`, { waitUntil: "networkidle0" });

            const listContainer = await page.$('div.list_container');

            // const productLinksList = []

            const productLinksList = await listContainer.evaluate(() => {
                const productsList = document.querySelectorAll(".product_box")

                let productLinks = []
                for (let product of productsList) {
                    const productAnchor = product.querySelector('figure a');
                    const link = productAnchor.getAttribute('href')
                    productLinks.push(link)
                }
                return productLinks
            })

            console.log(productLinksList)

            // for (let productLink of productLinksList) {
            //     await this.scrapGlobalsatProduct(page, categoryMap, category, subCategory, sub2Category, productLink, charMaps, dataFromExcel, importRef, entry, auth)
            // }

        } catch (error) {
            console.error(error)
        }
    },

    async scrapGlobalsatProduct(page, categoryMap, category, subCategory, sub2Category, productLink, charMaps, dataFromExcel, importRef, entry, auth) {
        try {
            await page.goto(productLink, { waitUntil: "networkidle0" });

            const productPage = await page.$('section.product_page');

            const scrapProduct = await productPage.evaluate(() => {

                const product = {
                    name: '',
                    supplierProductId: '',
                    barcode: '',
                    mpn: '',
                    imgUrls: [],
                    description: '',
                    status: '',
                    sale_price: '',
                    suggested_price: '',
                    wholesale: '',
                    prod_chars: [],
                    relativeProducts: []
                }

                const productContainer = document.querySelector('div.product_container');
                product.name = productContainer.querySelector('div.main_prod_title h1').textContent;
                const productCodesWrapper = productContainer.querySelectorAll('div.product_code>span');

                for (let code of productCodesWrapper) {

                    let codeSpan = code.querySelector("span")
                    const indexOfSpan = code.innerHTML.indexOf("</span>")
                    if (codeSpan.textContent.trim() === "ΚΩΔΙΚΟΣ ΠΡΟΪΟΝΤΟΣ:") {
                        product.supplierProductId = code.innerHTML.slice(indexOfSpan + 7).trim()
                    }
                    else if (codeSpan.textContent.trim() === "BarCode:") {
                        product.barcode = code.innerHTML.slice(indexOfSpan + 7).trim()
                    }
                    else if (codeSpan.textContent.trim() === "PartNumber:") {
                        product.mpn = code.innerHTML.slice(indexOfSpan + 7).trim()
                    }
                }

                const productImgUrlsWrapper = productContainer.querySelectorAll('div.main_slider_thumbs figure>img');

                for (let productImgUrl of productImgUrlsWrapper) {
                    let imgURL = productImgUrl.getAttribute("src")
                    product.imgUrls.push(imgURL)
                }

                const productInfo = productContainer.querySelector('div.product_info');
                const productTag = productInfo.querySelector('div.tag_line');
                const productAvailability = productTag.querySelector('span').textContent;
                product.status = productAvailability

                const suggestedPriceWrapper = productInfo.querySelector("div.trade");
                const suggestedPrices = suggestedPriceWrapper.querySelectorAll("span.price");

                if (suggestedPrices.length > 1) {
                    for (let price of suggestedPrices) {
                        if (price.getAttribute("class") === "price initial_price") {
                            product.sale_price = price.textContent.replace("€", "").replace(",", ".").trim();
                        }
                        else {
                            product.suggested_price = price.textContent.replace("€", "").replace(",", ".").trim();
                        }
                    }
                }
                else {
                    product.sale_price = suggestedPrices[0].textContent.replace("€", "").replace(",", ".").trim();
                }

                const wholesalePriceWrapper = productInfo.querySelector("div.price_row:not(.trade)");
                const wholesaleNode = wholesalePriceWrapper.querySelector("span.price").textContent;
                product.wholesale = wholesaleNode.replace("€", "").replace(",", ".").trim();

                const description = productContainer.querySelector("div.main_prod_info>div");
                product.description = description.textContent.trim();

                const productCharsContainer = document.querySelector('div.product_chars');

                const charTable = productCharsContainer.querySelector('tbody')
                const charRow = charTable.querySelectorAll('tr')
                charRow.forEach(tr => {
                    const charValue = tr.querySelectorAll('td')
                    product.prod_chars.push({
                        "name": charValue[0].innerHTML.trim(),
                        "value": charValue[1].querySelector('b').innerHTML.trim()
                    })

                });

                return product
            })
            scrapProduct.supplierProductURL = productLink
            // console.log(scrapProduct)

            await this.importGlobalsatProduct(scrapProduct, categoryMap, category, subCategory, sub2Category, charMaps, dataFromExcel, importRef, entry, auth)

        } catch (error) {
            console.error(error)
        }
    },

    async importGlobalsatProduct(product, categoryMap, category, subCategory, sub2Category, charMaps, dataFromExcel, importRef, entry, auth) {
        try {
            // console.log(product.name, category.category, subCategory.title, sub2Category.title)
            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map } = await categoryMap

            // Αν δεν είναι Διαθέσιμο τότε προχώρα στο επόμενο
            let stockLevelFilter = []
            for (let stock of stock_map) {
                stockLevelFilter.push(stock.name)
            }

            // if (!stockLevelFilter.includes(product.availability)) {
            //     return
            // }

            // Ελέγχω αν υπάρχει στο excel, 
            // αν δεν υπάρχει τότε χρησιμοποιώ την πρώτη λέξη του ονόματος 
            // και ελέγχω αν υπάρχει στους κατασκευαστές που ήδη υπάρχουν στη βάση
            // αν δεν υπάρχει τότε προχώρα στο επόμενο 
            let productInExcel = dataFromExcel.find(x => x["GS Code"] == product.supplierProductId)
            if (productInExcel) {
                product.brand = productInExcel[' Brand ']
            }
            else {
                let productBrand = product.name.split(" ")[0].toUpperCase()
                const brandCheck = await strapi.db.query('api::brand.brand').findOne({
                    where: { name: productBrand },
                });
                if (brandCheck) {
                    product.brandId = brandCheck.id
                }
            }

            if (!product.brandId) { return }

            const entryCheck = await this.checkIfProductExists(product.mpn);

            // Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
            const categoryInfo = await this.getCategory(categories_map, product.name, category.category, subCategory.title, sub2Category.title);

            if (!entryCheck) {
                try {
                    const productPrice = await this.setPriceOnCreation(product.wholesale.trim(), categoryInfo, product.brandId);

                    //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
                    const { mapCharNames, mapCharValues } = charMaps
                    const parsedChars = await this.parseChars(product.prod_chars, mapCharNames, mapCharValues)

                    let imageUrls = []
                    for (let imageUrl of product.imgUrls) {
                        imageUrls.push({ url: imageUrl })
                    }

                    console.log(product)

                    const data = {
                        name: product.name,
                        description: product.description,
                        categories: categoryInfo.id,
                        price: parseFloat(productPrice).toFixed(2),
                        mpn: product.mpn ? product.mpn : null,
                        barcode: product.barcode,
                        slug: slugify(`${product.name}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g }),
                        publishedAt: new Date(),
                        status: "InStock",
                        brand: { id: product.brandId },
                        related_import: entry.id,
                        supplierInfo: [{
                            name: entry.name,
                            wholesale: parseFloat(product.wholesale).toFixed(2),
                            supplierProductId: product.supplierProductId,
                            price: parseFloat(product.sale_price).toFixed(2),
                            sale_price: parseFloat(product.suggested_price ? product.suggested_price : 0).toFixed(2),
                            supplierProductURL: product.supplierProductURL
                        }],
                        prod_chars: parsedChars,
                        ImageURLS: imageUrls,
                    }

                    const newEntry = await strapi.entityService.create('api::product.product', {
                        data: data,
                    });

                    importRef.related_entries.push(newEntry.id)
                    importRef.related_products.push({ productID: newEntry.id, relatedProducts: product.relativeProducts })
                    importRef.created += 1;

                    //Κατεβάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
                    let responseImage = await this.getAndConvertImgToWep(product.imgUrls, data, newEntry.id, auth);

                    // //Δημιουργώ αυτόματα το SEO για το προϊόν
                    await this.saveSEO(responseImage.mainImageID.data[0], data, newEntry.id);

                } catch (error) {
                    console.log(error)
                }
            }
            else {
                try {
                    importRef.related_entries.push(entryCheck.id)
                    importRef.related_products.push({ productID: entryCheck.id, relatedProducts: product.relativeProducts })
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
                                wholesale: parseFloat(product.wholesale).toFixed(2),
                                supplierProductId: product.supplierProductId,
                                price: parseFloat(product.sale_price).toFixed(2),
                                sale_price: parseFloat(product.suggested_price ? product.suggested_price : 0).toFixed(2),
                                supplierProductURL: product.supplierProductURL
                            }
                            return true;
                        }
                    })

                    if (!searchSupplierInfo) {
                        supplierInfo.push({
                            name: entry.name,
                            wholesale: parseFloat(product.wholesale).toFixed(2),
                            supplierProductId: product.supplierProductId,
                            price: parseFloat(product.sale_price).toFixed(2),
                            sale_price: parseFloat(product.suggested_price ? product.suggested_price : 0).toFixed(2),
                            supplierProductURL: product.supplierProductURL
                        })
                    }

                    const productPrice = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .setPriceOnUpdate(entryCheck, supplierInfo, product.brandId);

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

        }
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
                    console.log("File written successfully\n");
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
                    console.log("File readen successfully\n");
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

    async getAndConvertImgToWep(imageUrls, product, entryID, auth) {

        let productName = product.name.replace(/\//g, "_");

        let index = 0
        let mainImageID = '';
        let imgUrls = []
        for (let imgUrl of imageUrls) {
            index += 1;
            const sharpStream = sharp({
                failOnError: false
            });

            try {
                let cont = false;
                const response = await Axios({
                    method: 'get',
                    url: imgUrl,
                    responseType: 'stream'
                }).catch(err => {
                    console.log("Axios Error:", productName, imgUrl, "Supplier Code:", product.supplierInfo[0].supplierProductId);
                    cont = true;
                })

                if (cont) {
                    break;
                }
                else {
                    await response && response !== null && response.data.pipe(sharpStream)

                    imgUrls.push({ url: imgUrl })

                    await sharpStream
                        .webp({ quality: 75 })
                        .resize({ width: 1000 })
                        .toBuffer({ resolveWithObject: true })
                        .then(({ data }) => {
                            const formData = new FormData();
                            formData.append("files", data,
                                {
                                    filename: `${productName}_${index}.webp`,
                                },

                            );
                            formData.append('fileInfo', JSON.stringify({
                                alternativeText: `${productName}_${index}`,
                                caption: `${productName}_${index}`
                            }));
                            formData.append("refId", entryID);
                            formData.append("ref", "api::product.product");
                            if (index === 1) {
                                formData.append("field", "image");
                            }
                            else {
                                formData.append("field", "additionalImages");
                            }
                            return formData
                        })
                        .then(async (formData) => {
                            try {
                                const imgid = Axios.post(`${process.env.PUBLIC_API_URL}/upload`, formData, {
                                    headers: {
                                        ...formData.getHeaders(),
                                        Authorization: `Bearer ${auth}`,
                                    }
                                })
                                if (index === 1) { mainImageID = await imgid }
                            } catch (error) {
                                console.log("Axios Error:", error.response?.data)
                            }
                        })
                        .catch(err => {
                            console.error("Error processing files, let's clean it up", err, "File:", product.title, "supplier Code:", product.supplierCode);
                            try {
                                // fs.unlinkSync(`./src/tmp/${data[" GS Description "]}_${index}.webp`);
                            } catch (e) {
                                console.log(e)
                                return
                            }
                        });
                }
            } catch (error) {
                console.log("Axios Error:", error)
            }
        }

        if (imgUrls.length === 0) { return }

        await this.saveImageURLS(imgUrls, entryID)

        if (mainImageID) {
            return { mainImageID }
        } else {
            return null
        }
    },

    async saveImageURLS(imgUrls, entryID) {
        await strapi.entityService.update('api::product.product', entryID, {
            data: {
                ImageURLS: imgUrls,
            },
        });
    },

    async saveSEO(imgid, product, entryID) {
        try {
            const brand = await strapi.entityService.findOne('api::brand.brand', parseInt(product.brand.id), {
                fields: ['name'],
            })

            let productName = product.name.replace(/\//g, "_");
            const slug = slugify(`${productName}-${product.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })
            const canonicalURL = `http://localhost:3000/product/${slug}`

            strapi.entityService.update('api::product.product', parseInt(entryID),
                {
                    data: {
                        seo: [{
                            metaTitle: productName.substring(0, 59),
                            metaDescription: `${productName}${productName}${productName}`.length > 160 ?
                                `${productName}${productName}${productName}`.substring(0, 159) :
                                `${productName}${productName}${productName}`,
                            metaImage: {
                                id: imgid ? imgid.id : null
                            },
                            keywords: `${brand.name},${product.mpn},${product.barcode}`,
                            canonicalURL: canonicalURL,
                            metaViewport: "width=device-width, initial-scale=1",
                            metaSocial: [
                                {
                                    socialNetwork: "Facebook",
                                    title: productName.substring(0, 59),
                                    description: `${productName}`.substring(0, 64),
                                    image: {
                                        id: imgid ? imgid.id : null
                                    },
                                },
                                {
                                    socialNetwork: "Twitter",
                                    title: productName.substring(0, 59),
                                    description: `${productName}`.substring(0, 64),
                                    image: {
                                        id: imgid ? imgid.id : null
                                    },
                                }
                            ]
                        }]
                    },
                });
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

    async setPriceOnCreation(price, categoryInfo, brandId) {
        try {
            const generalCategoryPercentage = process.env.GENERAL_CATEGORY_PERCENTAGE
            const taxRate = process.env.GENERAL_TAX_RATE

            let generalPercentage = ''
            if (categoryInfo.cat_percentage && categoryInfo.cat_percentage.length > 0) {

                let findPercentage = categoryInfo.cat_percentage.find(x => x.name === "general")

                if (findPercentage) {
                    if (findPercentage.brand_perc && findPercentage.brand_perc.length > 0) {
                        let findBrandPercentage = findPercentage.brand_perc.find(x => x.brand.id === brandId)
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


            return parseFloat(price) * (taxRate / 100 + 1) * (generalPercentage / 100 + 1)

        } catch (error) {
            console.log(error)
        }
    },

    async setPrice(entry, supplierInfo, categoryInfo, brandId) {
        try {
            const generalCategoryPercentage = process.env.GENERAL_CATEGORY_PERCENTAGE
            const taxRate = process.env.GENERAL_TAX_RATE

            let minSupplierPrice = supplierInfo?.reduce((prev, current) => {
                return (prev.wholesale < current.wholesale) ? prev : current
            })

            let generalPercentage = ''
            if (categoryInfo.cat_percentage && categoryInfo.cat_percentage.length > 0) {

                let findPercentage = categoryInfo.cat_percentage.find(x => x.name === "general")

                if (findPercentage) {
                    if (findPercentage.brand_perc && findPercentage.brand_perc.length > 0) {
                        let findBrandPercentage = findPercentage.brand_perc.find(x => x.brand.id === brandId)
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

            let minPrice = parseFloat(minSupplierPrice.wholesale) * (taxRate / 100 + 1) * (generalPercentage / 100 + 1)

            return entry.price > minPrice && entry.is_fixed_price ? parseFloat(entry.price).toFixed(2) : minPrice.toFixed(2)

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
                            $not: {
                                publishedAt: null
                            }
                        },
                        populate: {
                            category: { fields: ['name'] },
                            brand: { fields: ['name'] },
                            prod_chars: { fields: ['name', 'value'] },
                            ImageURLS: { fields: ['url'] },
                            related_with: true
                        }
                    }
                },
            });

            let finalEntries = []

            delete entries.id;
            delete entries.name;

            console.log(entries.related_products.length)

            for (let entry of entries.related_products) {
                let newEntry = {
                    name: entry.name,
                    description: entry.description,
                    price: entry.price,
                    sku: entry.sku,
                    mpn: entry.mpn,
                    status: entry.status,
                    short_description: entry.short_description,
                    barcode: entry.barcode,
                    category: entry.category.name,
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

                newEntry.related_products = [relProds];
                newEntry.chars = { char: chars1 };
                newEntry.imageURLS = { url: imageURL };

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
                    let catIndex = categoryMap.whitelist_map.findIndex(x => x.name.trim() === category1.trim())
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

        let brandName = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.brandName)

        let supplierCode = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.supplierCode)

        let productURL = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.productURL)

        let title = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.title)

        let description = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.description)

        let partNumber = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.partNumber)

        let barcode = strapi
            .plugin('import-products')
            .service('helpers')
            .convertDataTitles(data, dataTitles.barcode)

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
            description,
            partNumber,
            barcode,
            status,
            price,
            recycleTax,
            suggestedPrice
        }

        return parsedDataTitles
    },

    async constructProduct(dataTitles) {

        const { entryCheck, brandId } = await strapi
            .plugin('import-products')
            .service('helpers')
            .checkProductAndBrand(dataTitles.partNumber, dataTitles.title, dataTitles.brandName.trim());

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
            .getCategory(categories_map, dataTitles.title, dataTitles.category_1, dataTitles.category_2, dataTitles.category_3);

        const product = {
            name: dataTitles.title,
            description: dataTitles.description !== undefined ? dataTitles.description : null,
            categories: categoryInfo.id,
            // price: parseFloat(productPrice),
            mpn: dataTitles.partNumber ? dataTitles.partNumber.toString() : null,
            barcode: dataTitles.barcode ? dataTitles.barcode : null,
            slug: dataTitles.partNumber ?
                slugify(`${dataTitles.title?.toString()}-${dataTitles.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                slugify(`${dataTitles.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
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

        return { entryCheck, product }
    },

    async checkProductAndBrand(mpn, name, brand) {
        const entryCheck = await this.checkIfProductExists(mpn, name);

        const brandId = await this.brandIdCheck(brand, name);

        return { entryCheck, brandId }

    },

    async createEntry(parsedDataTitles, product,
        charMaps, categories_map, importRef, auth) {

        //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
        const categoryInfo = await strapi
            .plugin('import-products')
            .service('helpers')
            .getCategory(categories_map, parsedDataTitles.title, parsedDataTitles.category_1, parsedDataTitles.category_2, parsedDataTitles.category_3);

        // console.log("categoryInfo:", categoryInfo)
        const productPrice = await strapi
            .plugin('import-products')
            .service('helpers')
            .setPrice(parsedDataTitles, product.supplierInfo, product.category, product.brand.id);

        const { mapCharNames, mapCharValues } = charMaps

        //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
        const parsedChars = await strapi
            .plugin('import-products')
            .service('helpers')
            .parseChars(product.prod_chars, mapCharNames, mapCharValues)

        product.category = categoryInfo.id;
        product.price = parseFloat(productPrice);
        product.prod_chars = parsedChars;

        const newEntry = await strapi.entityService.create('api::product.product', {
            data: product,
        });

        importRef.related_entries.push(await newEntry.id)
        importRef.created += 1;

        const imageUrls = product.ImageURLS.map(x => x.url)

        //Κατευάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
        let responseImage = await strapi
            .plugin('import-products')
            .service('helpers')
            .getAndConvertImgToWep(imageUrls, product, newEntry.id, auth);

        //Δημιουργώ αυτόματα το SEO για το προϊόν
        await strapi
            .plugin('import-products')
            .service('helpers')
            .saveSEO(responseImage.mainImageID.data[0], product, newEntry.id);

    },

    async updateEntry(parsedDataTitles, entry, entryCheck, importRef, productUrl, categories_map) {
        const data = {}

        importRef.related_entries.push(entryCheck.id)
        const supplierInfo = entryCheck.supplierInfo;
        const relatedImport = entryCheck.related_import;
        const relatedImportId = []

        let newRelatedImport = false

        relatedImport.forEach(x => {
            if (x.id !== entry.id) {
                relatedImportId.push(x.id)
                newRelatedImport = true
            }
        })
        relatedImportId.push(entry.id)

        if (newRelatedImport) { data.related_import = relatedImportId }

        const categoryInfo = await strapi
            .plugin('import-products')
            .service('helpers')
            .getCategory(categories_map, parsedDataTitles.title, parsedDataTitles.category_1, parsedDataTitles.category_2, parsedDataTitles.category_3);

        console.log("CentryCheck:", entryCheck)
        console.log("category_1:", parsedDataTitles.category_1, "category_2:", parsedDataTitles.category_2)
        console.log("CategoryInfo ID:", categoryInfo.id)

        // const categoryIsFound = entryCheck.categories.some(x => {
        //     console.log(x.id)

        //     if (x.id === categoryInfo.id) {
        //         return true
        //     }
        //     return false
        // })

        if (!entryCheck.category || entryCheck.category.id !== categoryInfo.id) {
            data.category = categoryInfo.id
            console.log("categoryInfo.id:", categoryInfo.id, "entryCheck.categories", entryCheck.categories)
        }

        let searchSupplierInfo = supplierInfo.find((o, i) => {
            if (o.name === entry.name) {
                const price_progress = o.price_progress;

                if (o.wholesale !== parsedDataTitles.price || price_progress.length === 0) {
                    price_progress.push({
                        date: new Date(),
                        price: parsedDataTitles.price
                    })
                }

                supplierInfo[i] = {
                    name: entry.name,
                    wholesale: parseFloat(parsedDataTitles.price),
                    recycle_tax: parseFloat(parsedDataTitles.recycleTax),
                    supplierProductId: parsedDataTitles.supplierCode.toString(),
                    supplierProductURL: productUrl,
                    price: parsedDataTitles.suggestedPrice,
                    price_progress: price_progress,
                }
                return true;
            }
        })

        if (!searchSupplierInfo) {
            supplierInfo.push({
                name: entry.name,
                wholesale: parsedDataTitles.price,
                recycle_tax: parsedDataTitles.recycleTax,
                supplierProductId: parsedDataTitles.supplierCode.toString(),
                supplierProductURL: productUrl,
                price: parsedDataTitles.suggestedPrice,
                price_progress: [{
                    date: new Date(),
                    price: parsedDataTitles.price
                }]
            })
        }

        if (supplierInfo !== entryCheck.supplierInfo) {
            const productPrice = await strapi
                .plugin('import-products')
                .service('helpers')
                .setPriceOnUpdate(entryCheck, supplierInfo, categoryInfo, entry.brand.id);

            data.price = parseFloat(productPrice).toFixed(2)
            data.supplierInfo = supplierInfo
        }

        // return { supplierInfo, relatedImportId, productPrice }
        // console.log("categoryInfo:", categoryInfo, "productPrice:", productPrice)

        if (Object.keys(data).length !== 0) {
            console.log(data)
            data.publishedAt = new Date()
            await strapi.entityService.update('api::product.product', entryCheck.id, {
                data: data
                // {
                //     price: parseFloat(productPrice),
                //     publishedAt: new Date(),
                //     // supplierInfo: supplierInfo,
                //     related_import: relatedImportId, 
                //     // ImageURLS:  
                // },
            });
            importRef.updated += 1
        }
        else {
            importRef.skipped += 1
        }
        // const imgUrls = []


        console.log("Updated:", importRef.updated, "Skipped:", importRef.skipped)
    },

    async deleteEntry(entry, importRef) {

        const importXmlFile = await strapi.entityService.findMany('plugin::import-products.importxml',
            {
                populate: {
                    related_products: {
                        filters: {
                            $not: {
                                publishedAt: null
                            }
                        },
                    }
                },
                filters: { id: entry.id },
            });

        for (let product of importXmlFile[0].related_products) {

            if (!importRef.related_entries.includes(product.id)) {
                const checkProduct = await strapi.entityService.findOne('api::product.product', product.id, {
                    // fields: ['supplierInfo', 'name'],
                    populate: { supplierInfo: true },
                })

                console.log(product)

                let supplierInfo = checkProduct.supplierInfo

                if (supplierInfo.length > 1) {
                    const index = supplierInfo.findIndex((o) => {
                        return o.name === entry.name
                    })
                    supplierInfo.splice(index, 1)

                    await strapi.entityService.update('api::product.product', product.id, {
                        data: {
                            supplierInfo: supplierInfo,
                        },
                    });
                    importRef.updated += 1
                }
                else {
                    console.log("Product Deleted:", product.name)
                    await strapi.entityService.update('api::product.product', product.id, {
                        data: {
                            publishedAt: null,
                            is_fixed_price: false,
                        },
                    });
                    importRef.deleted += 1;
                }
            }
        }

        await strapi.entityService.update('plugin::import-products.importxml', entry.id,
            {
                data: {
                    report: `Created: ${importRef.created}, Updated: ${importRef.updated}, Skipped: ${importRef.skipped}, Deleted: ${importRef.deleted}`,
                },
            })
    },
})
