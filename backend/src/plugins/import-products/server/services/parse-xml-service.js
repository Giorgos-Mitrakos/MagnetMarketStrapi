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
    async parseLogicomXml({ entry, auth }) {
        try {
            // const parser = new xml2js.Parser();
            const importRef = {
                created: 0,
                updated: 0,
                republished: 0,
                deleted: 0,
                related_entries: []
            }

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry);

            // console.log(data.Pricelist.Items[0].Item.length)

            if (data.Pricelist.Items[0].Item.length === 0)
                return { "message": "xml is empty" }

            const dataTitles = {
                entry,
                category_1: 'Cat1_Desc',
                category_2: 'Cat2_Desc',
                category_3: 'Cat3_Desc',
                brandName: 'Brand',
                supplierCode: 'ItemCode',
                productURL: '',
                imageUrls: 'PictureURL',
                title: 'ItemTitle',
                description: '',
                partNumber: 'ItemCode',
                barcode: 'EANBarcode',
                status: 'StockLevel',
                price: 'NetPrice',
                recycleTax: 'RecycleTax',
                suggestedPrice: ''
            }

            const editData = await strapi
                .plugin('import-products')
                .service('helpers')
                .editData(await data.Pricelist.Items[0].Item, dataTitles);

            const { newData, categoryMap, charMaps } = await editData;

            console.log(newData.length)

            const { mapCharNames, mapCharValues } = charMaps

            for (let dt of newData) {

                const parsedDataTitles = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .parseDatatitles(dt, dataTitles);

                // console.log(parsedDataTitles)

                const { entryCheck, product } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .constructProduct(parsedDataTitles);

                console.log(product)

                //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 
                if (!entryCheck) {
                    try {
                        const { scrap, productUrl } =
                            await strapi
                                .plugin('import-products')
                                .service('helpers')
                                .scrapLogicom(product.mpn);

                        const { prod_chars, imagesSrc } = await scrap

                        // Προσθέτω τις πληροφορίες που πήρα από scrapping
                        product.prod_chars = prod_chars;
                        // product.barcode = EAN ? EAN : null;
                        // product.brand = { id: brandId };
                        product.supplierInfo = [{
                            name: entry.name,
                            wholesale: parsedDataTitles.price,
                            recycle_tax: parsedDataTitles.recycleTax,
                            supplierProductId: parsedDataTitles.supplierCode.toString(),
                            supplierProductURL: productUrl,
                            price_progress: [{
                                date: new Date(),
                                price: parsedDataTitles.price,
                            }]
                        }]

                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(parsedDataTitles, product, importRef,
                                prod_chars, mapCharNames, mapCharValues, imagesSrc, auth);

                    } catch (error) {
                        console.log(error)
                    }
                }
                else {
                    try {
                        const { scrap, productUrl } =
                            await strapi
                                .plugin('import-products')
                                .service('helpers')
                                .scrapLogicom(product.mpn);

                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(parsedDataTitles, entryCheck, importRef, productUrl);

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

    async parseOktabitXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const products = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);

            let index = 0
            for (let dt of products) {
                index++


                setTimeout(async () => {


                    console.log("delay:", `${5000 * index}`, "MPN: ", dt.mpn, " Barcode: ", dt.barcode)

                    const { entryCheck, brandId } = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .checkProductAndBrand(dt.mpn, dt.name, dt.barcode, dt.brand_name, null);

                    //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                    let productUrl = `http://www.oktabit.gr/product_details.asp?productid=${dt.supplierCode}`

                    // const productPrevius = {
                    //     name: dt.title,
                    //     description: dt.description,
                    //     // category: categoryInfo.id,
                    //     mpn: dt.partNumber.toString(),
                    //     barcode: dt.barcode.toString(),
                    //     slug: dt.partNumber ?
                    //         slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //         slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    //     publishedAt: new Date(),
                    //     status: 'InStock',
                    //     ImageURLS: dt.ImageURLS,
                    //     brand: { id: await brandId },
                    //     related_import: entry.id,
                    //     supplierInfo: [{
                    //         name: entry.name,
                    //         in_stock: true,
                    //         wholesale: dt.price,
                    //         recycle_tax: dt.recycleTax,
                    //         supplierProductId: dt.supplierCode,
                    //         supplierProductURL: productUrl,
                    //         retail_price: dt.suggestedPrice,
                    //         price_progress: [{
                    //             date: new Date(),
                    //             wholesale: dt.price,
                    //         }]
                    //     }],
                    //     prod_chars: dt.prod_chars
                    // }

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

                    //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                    if (!entryCheck) {
                        
                        try {
                            // var startTime = performance.now()
                            // setTimeout(async () => {
                            const response = await strapi
                                .plugin('import-products')
                                .service('helpers')
                                .createEntry(product, importRef, auth);
                            // var endTime = performance.now()

                            await response
                            //     console.log(`Call to doSomething took ${endTime - startTime} milliseconds`)
                            // }, 3000 * index);
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

                            // console.log("Updated")
                        } catch (error) {
                            console.log(error)
                        }
                    }
                }, 10000 * index);

            }

            // const reduceApiEndpoints = async (previous, endpoint) => {
            //     await previous;
            //     return apiCall(endpoint);
            // };

            // const sequential = await products.reduce(reduceApiEndpoints, Promise.resolve());


            // console.log("Ίδια προιόντα:", numberOfSame)

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log(importRef)

            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
        }
    },

    async parseGlobalsat({ entry, auth }) {
        const importRef = await strapi
            .plugin('import-products')
            .service('helpers')
            .createImportRef(entry);

        await strapi
            .plugin('import-products')
            .service('globalsatHelper')
            .scrapGlobalsat(importRef, entry, auth);

        await strapi
            .plugin('import-products')
            .service('helpers')
            .deleteEntry(entry, importRef);

        console.log(importRef)

        console.log("End of Import")
        return { "message": "ok" }

    },

    async parseWestnetXml({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry, importRef.categoryMap);


            console.log("Προϊόντα στο xml της Westnet:", data.products.product.length)
            // Φιλτράρω τα προϊόντα
            const availableProducts = await strapi
                .plugin('import-products')
                .service('westnetHelper')
                .filterData(data.products.product, importRef.categoryMap)


            console.log("Προϊόντα μετά το φιλτράρισμα:", availableProducts.length)
            // console.log(availableProducts)

            // let categories = data.products.product.map(x => x.category[0])

            // const unique_names = [...new Set(categories)]

            // console.log(unique_names)

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = importRef.categoryMap

            // console.log("newData:", newData.length)
            const charMaps = await strapi
                .plugin('import-products')
                .service('helpers')
                .parseCharsToMap(char_name_map, char_value_map);

            const { mapCharNames, mapCharValues } = charMaps

            for (let dt of availableProducts) {

                const { entryCheck, brandId } = await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .checkProductAndBrand(dt.partNumber[0], dt.name[0], dt.barCode[0],
                        dt.manufacturer[0], null);

                //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                let productUrl = `https://www.mywestnet.com${dt.url[0]}`

                const chars = []
                // console.log(typeof dt.specs[0].spec)
                if (dt.specs[0].spec) {
                    for (let productChar of dt.specs[0].spec) {
                        // console.log(char)
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
                    name: dt.name[0],
                    supplierCode: dt.id[0],
                    description: dt.description[0],
                    category: { title: dt.category[0] },
                    subcategory: { title: null },
                    sub2category: { title: null },
                    mpn: dt.partNumber[0],
                    barcode: dt.barCode[0].toString(),
                    // slug: dt.partNumber ? 
                    //     slugify(`${dt.title?.toString()}-${dt.partNumber?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }) :
                    //     slugify(`${dt.title?.toString()}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g }),
                    // publishedAt: new Date(),
                    stockLevel: parseInt(dt.availability[0]),
                    wholesale: parseFloat(dt.price[0]).toFixed(2),
                    imagesSrc: [{ url: dt.image[0] }],
                    brand: { id: await brandId },
                    recycleTax: parseFloat(dt.recycle_tax[0]).toFixed(2),
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

            console.log(importRef)

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

            const importRef = {
                created: 0,
                updated: 0,
                republished: 0,
                deleted: 0,
                related_entries: []
            }

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry);

            const dataTitles = {
                entry,
                category_1: 'product_categories.category_path._',
                category_2: '',
                category_3: '',
                supplierCode: 'product_id',
                model: 'model',
                title: 'name',
                brandName: 'manufacturer',
                productURL: 'url',
                imageUrls: 'images',
                partNumber: 'mpn',
                barcode: 'barcode',
                length: 'length',
                width: 'width',
                height: 'height',
                weight: 'weight',
                description: 'description',
                status: 'instock',
                price: 'price.price_original',
                recycleTax: '',
                suggestedPrice: ''
            }

            console.log(data.products.product.length)

            const editData = await strapi
                .plugin('import-products')
                .service('helpers')
                .editData(await data.products.product, dataTitles);

            const { newData, categories_map, charMaps } = await editData;

            console.log(newData)

            let dt = newData[0]

            const product = {
                name: dt.name[0],
                supplierCode: dt.product_id[0],
                model: dt.model[0],
                brand_name: dt.manufacturer[0],
                link: dt.url[0],
                category: dt.product_categories[0].category_path[0]._,
                mpn: dt.mpn[0],
                barcode: dt.barcode[0],
                description: dt.description[0],
                wholesale: parseFloat(dt.price[0].price_original[0]).toFixed(2),
                stockLevel: dt.instock[0],
            }

            product.imagesSrc = []
            for (let productImgUrl of dt.images[0].image_url) {
                let imgURL = productImgUrl._
                product.imagesSrc.push(imgURL)
            }

            product.prod_chars = []

            if (dt.product_chars) {
                dt.product_chars[0].char.forEach(ch => {
                    product.prod_chars.push({
                        name: ch.char_name[0].trim(),
                        value: ch.char_value[0].trim(),
                    })

                });
            }

            console.log(product)

            if (data.products.product[0].length === 0)
                return { "message": "xml is empty" }



            // const { entryCheck, product, brandId } = await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .constructProduct(data.products.product[0], dataTitles);

            // console.log(product)


            // console.log(editData.newData.length)

            // for (let dt of newData) {
            //     // console.log(parsedDataTitles)

            //     const { entryCheck, product, brandId } = await strapi
            //         .plugin('import-products')
            //         .service('helpers')
            //         .constructProduct(dt, dataTitles);

            //     // const imageUrls = []
            //     product.ImageURLS = []

            //     if (dt.images[0].image_url?.length > 0) {
            //         for (let img of dt.images[0].image_url) {
            //             product.ImageURLS.push({ url: img._ })
            //         }
            //     }

            //     console.log(product, brandId)

            //     // αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω
            //     if (!entryCheck) {
            //         try {
            //             product.prod_chars = []

            //             if (dt.product_chars) {
            //                 dt.product_chars[0].char.forEach(ch => {
            //                     product.prod_chars.push({
            //                         name: ch.char_name[0].trim(),
            //                         value: ch.char_value[0].trim(),
            //                     })

            //                 });
            //             }

            //             // Προσθέτω τις πληροφορίες που πήρα 

            //             product.supplierInfo = [{
            //                 name: entry.name,
            //                 wholesale: parseFloat(parsedDataTitles.price).toFixed(2),
            //                 supplierProductId: parsedDataTitles.supplierCode.toString(),
            //                 supplierProductURL: parsedDataTitles.productURL,
            //                 price_progress: [{
            //                     date: new Date(),
            //                     price: parseFloat(parsedDataTitles.price).toFixed(2),
            //                 }]
            //             }]

            //             await strapi
            //                 .plugin('import-products')
            //                 .service('helpers')
            //                 .createEntry(parsedDataTitles, product, charMaps, categories_map,
            //                     importRef, auth);

            //         } catch (error) {
            //             console.log(error)
            //         }
            //     }
            //     else {
            //         try {
            //             await strapi
            //                 .plugin('import-products')
            //                 .service('helpers')
            //                 .updateEntry(parsedDataTitles, entry, entryCheck, brandId,
            //                     importRef, parsedDataTitles.productUrl, categories_map);

            //         } catch (error) {
            //             console.log(error)
            //         }
            //     }
            // }

            // await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .deleteEntry(entry, importRef);

            console.log(importRef)

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

            await strapi
                .plugin('import-products')
                .service('novatronHelper')
                .scrapNovatronCategories(importRef, entry, auth);

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log(importRef)

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

            await strapi
                .plugin('import-products')
                .service('questHelper')
                .scrapQuest(importRef, entry, auth);

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, importRef);

            console.log(importRef)

            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
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

            //     const charMaps = await strapi
            //         .plugin('import-products')
            //         .service('helpers')
            //         .parseCharsToMap(char_name_map, char_value_map);

            //     const { mapCharNames, mapCharValues } = charMaps

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

    async parseShopflixXml({ entry, auth }) {
        for (let i = 0; i < 10; i++) {
            task(i);
        }

        function task(i) {
            setTimeout(function () {
                console.log(i);
            }, 2000 * i);
        }
        // try {
        //     // const importXmlFile = await strapi.entityService.findOne('plugin::import-products.importxml', 3,
        //     //     {
        //     //         populate: {
        //     //             related_products: {
        //     //                 filters: {
        //     //                     $and: [
        //     //                         {
        //     //                             $not: {
        //     //                                 publishedAt: null
        //     //                             }
        //     //                         },
        //     //                         {
        //     //                             supplierInfo: {
        //     //                                 $and: [
        //     //                                     { name: "Quest" },
        //     //                                     { in_stock: true },
        //     //                                 ]
        //     //                             }
        //     //                         },
        //     //                     ]
        //     //                 },
        //     //                 populate: {

        //     //                 },
        //     //             }
        //     //         },
        //     //     });

        //     // const data = await strapi
        //     //     .plugin('import-products')
        //     //     .service('helpers')
        //     //     .checkProductAndBrand('TL-SG1218MPE ', ' Switch TP-Link TL-SG1218MPE', '6935364086923 ', "TP-Link", null);

        //     // console.log(data)

        //     // console.log(importXmlFile.related_products.length)
        //     const data = await strapi
        //         .plugin('import-products')
        //         .service('helpers')
        //         .getData(entry);

        //     console.log("Προϊόντα στο XML του Shopflix:", await data.MPITEMS.products[0].product.length)

        //     await strapi.entityService.update('plugin::import-products.importxml', entry.id,
        //         {
        //             data: {
        //                 report: `Προϊόντα στο XML του Shopflix: ${await data.MPITEMS.products[0].product.length}`,
        //             },
        //         })
        //     return { "message": "ok" }

        // }
        // catch (err) {
        //     return { "message": "Error" }
        // }
    },
});
