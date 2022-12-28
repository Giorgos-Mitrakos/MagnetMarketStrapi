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

    async parseOktabitXlsx({ entry, auth }) {
        try {
            const importRef = {
                created: 0,
                updated: 0,
                deleted: 0,
                related_entries: []
            }

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry);

            // const wb = xlsx.readFile(`./public${entry.importedFile.url}`)
            // const ws = wb.Sheets['Φύλλο1']
            // const data = xlsx.utils.sheet_to_json(ws)

            const dataTitles = {
                entry,
                category_1: 'ΚΑΤΗΓΟΡΙΑ',
                category_2: '',
                category_3: '',
                brandName: 'ΚΑΤΑΣΚΕΥΑΣΤΗΣ',
                supplierCode: 'ΚΩΔΙΚΟΣ',
                productURL: '',
                title: 'ΠΕΡΙΓΡΑΦΗ',
                description: '',
                partNumber: 'PART NO',
                barcode: '',
                status: 'St',
                price: 'TIMH',
                recycleTax: 'AHHE',
                suggestedPrice: '__EMPTY'
            }

            console.log("data:", await data.length)

            // const categoryMap = await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .getImportMapping(entry);

            // const { categories_map, char_name_map, char_value_map, stock_map,
            //     isWhitelistSelected, whitelist_map, blacklist_map, 
            //     xPath, minimumPrice, maximumPrice } = await categoryMap

            // const newData = data
            //     .filter(filterStock)
            //     .filter(filterPriceRange)
            //     .filter(filterCategories)

            const editData = await strapi
                .plugin('import-products')
                .service('helpers')
                .editData(await data, dataTitles);

            const { newData, categoryMap, charMaps } = await editData;

            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = await categoryMap

            console.log("newData:", newData.length)

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

                // const imageUrls = [`https://www.oktabit.gr/media/products/heroes/${parsedDataTitles.supplierCode}/${parsedDataTitles.supplierCode}.jpg`]
                // for (let j = 1; j < 5; j++) {
                //     imageUrls.push(`https://www.oktabit.gr/media/products/${parsedDataTitles.supplierCode}/${parsedDataTitles.supplierCode}_${j}.jpg`)
                // }

                //Κατασκευάζω το URL του προϊόντος του προμηθευτή
                let productUrl = `http://www.oktabit.gr/product_details.asp?productid=${parsedDataTitles.supplierCode}`

                // console.log(product)
                //     const product = {
                //         name: dt[`${dataTitles.title}`],
                //         // description: description,
                //         // categories: categoryInfo.id,
                //         // price: parseFloat(productPrice),
                //         mpn: dt[`${dataTitles.partNumber}`] ? dt[`${dataTitles.partNumber}`].toString() : null,
                //         // barcode: EAN ? EAN : null,
                //         slug: dt[`${dataTitles.partNumber}`] !== undefined ?
                //             slugify(`${dt[`${dataTitles.title}`]}-${dt[`${dataTitles.partNumber}`].toString()}`, { lower: true, remove: /[*+±~=#.,°;_()/'"!:@]/g }) :
                //             slugify(`${dt[`${dataTitles.title}`].toString()}`, { lower: true, remove: /[*+±~=#.,°;_()/'"!:@]/g }),
                //         publishedAt: new Date(),
                //         status: 'InStock',
                //         // brand: { id: brandId },
                //         related_import: entry.id,
                //         // supplierInfo: [{
                //         //     name: entry.name,
                //         //     wholesale: dt[`${dataTitles.price}`],
                //         //     recycle_tax: dt[`${dataTitles.recycleTax}`],
                //         //     supplierProductId: dt[`${dataTitles.supplierCode}`].toString(),
                //         //     in_offer: inOffer
                //         // }],
                //         // prod_chars: parsedChars

                //     }

                //     // let mpn = dt[`${dataTitles.partNumber}`]?.toString()

                //     const { entryCheck, brandId } = await strapi
                //         .plugin('import-products')
                //         .service('helpers')
                //         .checkProductAndBrand(product.mpn, dt[`${dataTitles.brandName}`]);

                //     // console.log("entryCheck:", entryCheck,"brandId:", brandId)

                //     //     const entryCheck = await strapi
                //     //         .plugin('import-products')
                //     //         .service('helpers')
                //     //         .checkIfProductExists(mpn);

                //     //     const brandId = await strapi
                //     //         .plugin('import-products')
                //     //         .service('helpers')
                //     //         .brandIdCheck(dt["ΚΑΤΑΣΚΕΥΑΣΤΗΣ"].trim());

                //     //αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω 

                if (!entryCheck) {
                    try {
                        //Κάνω scrap από τη σελίδα του προμηθευτή διαθεσιμότητα, περιγραφή και χαρακτηριστικά
                        const { scrap } = await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .scrapOktabit(productUrl);

                        const { prod_chars, description, EAN, inOffer, imageUrls } = await scrap

                        // Προσθέτω τις πληροφορίες που πήρα από scrapping
                        product.description = description;
                        product.barcode = EAN ? EAN : null;
                        // product.brand = { id: brandId };
                        product.supplierInfo = [{
                            name: entry.name,
                            wholesale: parsedDataTitles.price,
                            recycle_tax: parsedDataTitles.recycleTax,
                            supplierProductId: parsedDataTitles.supplierCode.toString(),
                            supplierProductURL: productUrl,
                            in_offer: inOffer,
                            price_progress: [{
                                date: new Date(),
                                price: parsedDataTitles.price,
                            }]
                        }]

                        console.log(product)

                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(parsedDataTitles, product, importRef,
                                prod_chars, mapCharNames, mapCharValues, imageUrls, auth);

                        //             // //Βρίσκω τον κωδικό της κατηγορίας ώστε να συνδέσω το προϊόν με την κατηγορία
                        //             // const categoryInfo = await strapi
                        //             //     .plugin('import-products')
                        //             //     .service('helpers')
                        //             //     .getCategory(categories_map, dt[`${dataTitles.title}`], dt[`${dataTitles.category_2}`], null, null);

                        //             // // console.log("categoryInfo:", categoryInfo)
                        //             // const productPrice = await strapi
                        //             //     .plugin('import-products')
                        //             //     .service('helpers')
                        //             //     .setPriceOnCreation(dt[`${dataTitles.price}`], categoryInfo, brandId);

                        //             // //Κάνω mapping τα χαρακτηριστικά του αρχείου με το πώς θέλω να αποθηκευτούν στη βάση
                        //             // const parsedChars = await strapi
                        //             //     .plugin('import-products')
                        //             //     .service('helpers')
                        //             //     .parseChars(prod_chars, mapCharNames, mapCharValues)

                        //             // const data = {
                        //             //     name: dt["ΠΕΡΙΓΡΑΦΗ"],
                        //             //     description: description,
                        //             //     categories: categoryInfo.id,
                        //             //     price: parseFloat(productPrice),
                        //             //     mpn: mpn ? mpn : null,
                        //             //     barcode: EAN ? EAN : null,
                        //             //     slug: slugify(`${dt["ΠΕΡΙΓΡΑΦΗ"]}-${mpn}`, { lower: true, remove: /[*+±~=#.,°;_()/'"!:@]/g }),
                        //             //     publishedAt: new Date(),
                        //             //     status: 'InStock',
                        //             //     brand: { id: brandId },
                        //             //     related_import: entry.id,
                        //             //     supplierInfo: [{
                        //             //         name: "Oktabit",
                        //             //         wholesale: dt.TIMH,
                        //             //         recycle_tax: dt.AHHE,
                        //             //         supplierProductId: dt['ΚΩΔΙΚΟΣ'].toString(),
                        //             //         in_offer: inOffer
                        //             //     }],
                        //             //     prod_chars: parsedChars
                        //             // }

                        //             //             const newEntry = await strapi.entityService.create('api::product.product', {
                        //             //                 data: data,
                        //             //             });

                        //             // importRef.related_entries.push(newEntry.id)
                        //             // importRef.created += 1;

                        //             //             //Κατευάζω τις φωτογραφίες του προϊόντος , τις μετατρέπω σε webp και τις συνδέω με το προϊόν
                        //             //             let responseImage = await strapi
                        //             //                 .plugin('import-products')
                        //             //                 .service('helpers')
                        //             //                 .getAndConvertImgToWep(imageUrls, data, newEntry.id, auth);

                        //             //             //Δημιουργώ αυτόματα το SEO για το προϊόν
                        //             //             await strapi
                        //             //                 .plugin('import-products')
                        //             //                 .service('helpers')
                        //             //                 .saveSEO(responseImage.mainImageID.data[0], data, newEntry.id);

                    } catch (error) {
                        console.error("errors in create:", error, error.details?.errors, "Προϊόν:", dt["ΠΕΡΙΓΡΑΦΗ"])
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(parsedDataTitles, entryCheck, importRef, productUrl);

                        // console.log(supplierInfo, relatedImportId, productPrice)
                        //             // console.log(supplierInfo, relatedImportId, categoryInfo, productPrice, importRef.related_entries)
                        //             // importRef.related_entries.push(entryCheck.id)
                        //             // const supplierInfo = entryCheck.supplierInfo;
                        //             // const relatedImport = entryCheck.related_import;
                        //             // const relatedImportId = []

                        //             // relatedImport.forEach(x => {
                        //             //     if (x.id !== entry.id)
                        //             //         relatedImportId.push(x.id)
                        //             // })
                        //             // relatedImportId.push(entry.id)

                        //             // console.log("relatedImportId:", relatedImportId)

                        //             // let searchSupplierInfo = supplierInfo.find((o, i) => {
                        //             //     if (o.name === entry.name) {
                        //             //         supplierInfo[i] = {
                        //             //             name: entry.name,
                        //             //             wholesale: dt[`${dataTitles.price}`],
                        //             //             recycle_tax: dt[`${dataTitles.recycleTax}`],
                        //             //             supplierProductId: dt[`${dataTitles.supplierCode}`].toString(),
                        //             //             price: dt[`${dataTitles.suggestedPrice}`],
                        //             //         }
                        //             //         return true;
                        //             //     }
                        //             // })

                        //             // if (!searchSupplierInfo) {
                        //             //     supplierInfo.push({
                        //             //         name: entry.name,
                        //             //         wholesale: dt[`${dataTitles.price}`],
                        //             //         recycle_tax: dt[`${dataTitles.recycleTax}`],
                        //             //         supplierProductId: dt[`${dataTitles.supplierCode}`].toString(),
                        //             //         price: dt[`${dataTitles.suggestedPrice}`]
                        //             //     })
                        //             // }

                        //             // const categoryInfo = await strapi
                        //             //     .plugin('import-products')
                        //             //     .service('helpers')
                        //             //     .getCategory(categories_map, dt[`${dataTitles.title}`], dt[`${dataTitles.category_2}`], null, null);

                        //             // const productPrice = await strapi
                        //             //     .plugin('import-products')
                        //             //     .service('helpers')
                        //             //     .setPriceOnUpdate(entryCheck, supplierInfo);


                        //             // console.log("categoryInfo:", categoryInfo, "productPrice:", productPrice)



                        //             const imgUrls = [{ url: `https://www.oktabit.gr/media/products/heroes/${dt["ΚΩΔΙΚΟΣ"]}/${dt["ΚΩΔΙΚΟΣ"]}.jpg` }]
                        //             for (let j = 1; j < 5; j++) {
                        //                 imgUrls.push({ url: `https://www.oktabit.gr/media/products/${dt["ΚΩΔΙΚΟΣ"]}/${dt["ΚΩΔΙΚΟΣ"]}_${j}.jpg` })
                        //             }

                        // await strapi.entityService.update('api::product.product', entryCheck.id, {
                        //     data: {
                        //         price: parseFloat(productPrice),
                        //         categories: categoryInfo.id,
                        //         supplierInfo: supplierInfo,
                        //         related_import: relatedImportId,
                        //         ImageURLS: imgUrls
                        //     },
                        // });
                        // importRef.updated += 1
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
            // const importXmlFile = await strapi.entityService.findMany('plugin::import-products.importxml',
            //     {
            //         populate: { related_products: true },
            //         filters: { id: entry.id },
            //     });

            // for (let product of importXmlFile[0].related_products) {

            //     if (!importRef.related_entries.includes(product.id)) {
            //         const checkProduct = await strapi.entityService.findOne('api::product.product', product.id, {
            //             // fields: ['supplierInfo', 'name'],
            //             populate: { supplierInfo: true },
            //         })

            //         let supplierInfo = checkProduct.supplierInfo

            //         if (supplierInfo.length > 1) {
            //             const index = supplierInfo.findIndex((o) => {
            //                 return o.name === entry.name
            //             })
            //             supplierInfo.splice(index, 1)

            //             await strapi.entityService.update('api::product.product', product.id, {
            //                 data: {
            //                     supplierInfo: supplierInfo,
            //                 },
            //             });
            //             importRef.updated += 1
            //         }
            //         else {
            //             await strapi.entityService.delete('api::product.product', product.id);
            //             importRef.deleted += 1;
            //         }
            //     }
            // }

            // await strapi.entityService.update('plugin::import-products.importxml', entry.id,
            //     {
            //         data: {
            //             report: `Created: ${importRef.created}, Updated: ${importRef.updated}, Deleted: ${importRef.deleted}`,
            //         },
            //     })


            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
        }
    },

    async parseGlobalsatXlsx({ entry, auth }) {
        const importRef = {
            created: 0,
            updated: 0,
            skipped: 0,
            deleted: 0,
            related_entries: [],
            related_products: []
        }

        await strapi
            .plugin('import-products')
            .service('helpers')
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
            const importRef = {
                created: 0,
                updated: 0,
                deleted: 0,
                related_entries: []
            }

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry);

            console.log(data)

            // async function readWestnetFile() {

            //     let req = Axios.get(`${entry.importedURL}`)
            //         .then((data) => { return data })

            //     return await req
            //     // let data = '';
            //     // let req = https.get(`${entry.importedURL}`, function (res) {
            //     //     if (res.statusCode >= 200 && res.statusCode < 400) {
            //     //         console.log("Status OK")
            //     //         res.on('data', function (data_) { data += data_.toString(); });
            //     //         res.on('end', function () {
            //     //             console.log('data', data);
            //     //             return data
            //     //             // parser.parseString(data, function (err, result) {
            //     //             //     console.log('FINISHED', err, result);
            //     //             // });
            //     //         });
            //     //     }
            //     // });
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

            //                 const categoryInfo = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .getCategory(categories_map, dt.name[0], dt.category[0], null, null);

            //                 console.log(categoryInfo.id)
            //                 const productPrice = await strapi
            //                     .plugin('import-products')
            //                     .service('helpers')
            //                     .setPriceOnUpdate(entryCheck, supplierInfo);

            //                 await strapi.entityService.update('api::product.product', entryCheck.id, {
            //                     data: {
            //                         price: parseFloat(productPrice),
            //                         categories: categoryInfo.id,
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
            //     .then((result) => parseWestnet(result))
            //     .then((response) => {
            //         console.log("End of Import")
            //         if (response) {
            //             if (response.message === "Error") { return { "message": "Error" } }
            //             else { return { "message": "ok" } }
            //         }
            //         else {
            //             return { "message": "xml is empty" }
            //         }
            //     })
            //     .catch((err) => console.log(err))

            // return response
        }
        catch (err) {
            return { "message": "Error" }
        }
    },

    async parseGerasisXml({ entry, auth }) {
        try {

            const importRef = {
                created: 0,
                updated: 0,
                deleted: 0,
                related_entries: []
            }

            const data = await strapi
                .plugin('import-products')
                .service('helpers')
                .getData(entry);

            if (data.products.product[0].length === 0)
                return { "message": "xml is empty" }

            const dataTitles = {
                entry,
                category_1: 'product_categories.category_path._',
                category_2: '',
                category_3: '',
                brandName: 'manufacturer',
                supplierCode: 'product_id',
                productURL: 'url',
                imageUrls: 'images',
                title: 'name',
                description: 'description',
                partNumber: 'mpn',
                barcode: 'barcode',
                status: 'instock',
                price: 'price.price_original',
                recycleTax: '',
                suggestedPrice: ''
            }

            const editData = await strapi
                .plugin('import-products')
                .service('helpers')
                .editData(await data.products.product, dataTitles);

            const { newData, categoryMap, charMaps } = await editData;

            const { mapCharNames, mapCharValues } = charMaps

            console.log(editData.newData.length)

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

                const imageUrls = []

                if (dt.images[0].image_url?.length > 0) {
                    for (let img of dt.images[0].image_url) {
                        imageUrls.push(img._)
                    }
                }

                // αν δεν υπάρχει το προϊόν το δημιουργώ αλλιώς ενημερώνω
                if (!entryCheck) {
                    try {
                        const prod_chars = []

                        if (dt.product_chars) {
                            dt.product_chars[0].char.forEach(ch => {
                                prod_chars.push({
                                    name: ch.char_name[0].trim(),
                                    value: ch.char_value[0].trim(),
                                })

                            });
                        }

                        // Προσθέτω τις πληροφορίες που πήρα 

                        product.supplierInfo = [{
                            name: entry.name,
                            wholesale: parsedDataTitles.price,
                            supplierProductId: parsedDataTitles.supplierCode.toString(),
                            supplierProductURL: parsedDataTitles.productURL,
                            price_progress: [{
                                date: new Date(),
                                price: parsedDataTitles.price,
                            }]
                        }]

                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .createEntry(parsedDataTitles, product, importRef,
                                prod_chars, mapCharNames, mapCharValues, imageUrls, auth);

                    } catch (error) {
                        console.log(error)
                    }
                }
                else {
                    try {
                        await strapi
                            .plugin('import-products')
                            .service('helpers')
                            .updateEntry(parsedDataTitles, entryCheck, importRef, parsedDataTitles.productUrl);

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

            return { "message": "ok" }
        }
        catch (err) {
            console.log(err);
        }
    },

    async parseNovatronXml({ entry, auth }) {
        try {

            let report = {
                created: 0,
                updated: 0,
                skipped: 0,
                deleted: 0,
                related_entries: [],
                related_products: [],
            }


            const categoryMap = await strapi
                .plugin('import-products')
                .service('helpers')
                .getImportMapping(entry);

            const novatronCategories = await strapi
                .plugin('import-products')
                .service('helpers')
                .scrapNovatronCategories(categoryMap, report, entry, auth);

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, report);

            console.log(report)
            // const importXmlFile = await strapi.entityService.findMany('plugin::import-products.importxml',
            //     {
            //         populate: { related_products: true },
            //         filters: { id: entry.id },
            //     });

            // for (let product of importXmlFile[0].related_products) {

            //     if (!report.related_entries.includes(product.id)) {
            //         const checkProduct = await strapi.entityService.findOne('api::product.product', product.id, {
            //             // fields: ['supplierInfo', 'name'],
            //             populate: { supplierInfo: true },
            //         })

            //         let supplierInfo = checkProduct.supplierInfo

            //         if (supplierInfo.length > 1) {
            //             const index = supplierInfo.findIndex((o) => {
            //                 return o.name === entry.name
            //             })
            //             supplierInfo.splice(index, 1)

            //             await strapi.entityService.update('api::product.product', product.id, {
            //                 data: {
            //                     supplierInfo: supplierInfo,
            //                 },
            //             });
            //         }
            //         else {
            //             await strapi.entityService.delete('api::product.product', product.id);
            //         }

            //         report.deleted += 1;
            //     }

            // }

            // for (let product of report.related_products) {
            //     console.log("product:", product)

            //     const relatedProductsIDs = []
            //     for (let relProd of product.relatedProducts) {
            //         const entry = await strapi.db.query('api::product.product').findOne({
            //             select: ['mpn', 'id'],
            //             where: { mpn: relProd.mpn },
            //         });

            //         console.log("entry:", entry)
            //         if (entry) {
            //             relatedProductsIDs.push({ id: entry.id })
            //         }
            //     }

            //     console.log("relatedProductsIDs:", relatedProductsIDs)
            //     // console.log("product.productID:", product.productID)
            //     if (relatedProductsIDs.length > 0) {
            //         await strapi.entityService.update('api::product.product', product.productID, {
            //             data: {
            //                 related_with: relatedProductsIDs,
            //             },
            //         });
            //     }
            // }

            // await strapi.entityService.update('plugin::import-products.importxml', entry.id,
            //     {
            //         data: {
            //             report: `Created: ${report.created}, Updated: ${report.updated}, Deleted: ${report.deleted}`,
            //         },
            //     })

            console.log("End of Import")
            return { "message": "ok" }
        } catch (error) {
            console.log(error)
        }
    },

    async parseQuestXml({ entry, auth }) {
        try {

            let report = {
                created: 0,
                updated: 0,
                skipped: 0,
                deleted: 0,
                republished:0,
                related_entries: [],
                related_products: [],
            }

            const categoryMap = await strapi
                .plugin('import-products')
                .service('helpers')
                .getImportMapping(entry);

            await strapi
                .plugin('import-products')
                .service('helpers')
                .scrapQuest(categoryMap, report, entry, auth);

            await strapi
                .plugin('import-products')
                .service('helpers')
                .deleteEntry(entry, report);

            console.log(report)

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
});
