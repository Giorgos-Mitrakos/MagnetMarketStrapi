'use strict';

const Axios = require('axios');
const slugify = require("slugify");

module.exports = {
    async afterUpdate(event) {
        try {
            const taxRate = Number(process.env.GENERAL_TAX_RATE)
            let percentage = Number(process.env.GENERAL_CATEGORY_PERCENTAGE)
            let addToPrice = Number(process.env.GENERAL_SHIPPING_PRICE)

            const { result, params } = event;

            let percentages = {
                general: {
                    platformCategoryPercentage: percentage,
                    addToPrice: addToPrice,
                    brandPercentage: new Map()
                },
                skroutz: {
                    platformCategoryPercentage: percentage,
                    addToPrice: addToPrice,
                    brandPercentage: new Map()
                },
                shopflix: {
                    platformCategoryPercentage: percentage,
                    addToPrice: addToPrice,
                    brandPercentage: new Map()
                }
            }

            const generalCategoryPercentage = result.cat_percentage.find(x => x.name.toLowerCase().trim() === "general")
            const skroutzCategoryPercentage = result.cat_percentage.find(x => x.name.toLowerCase().trim() === "skroutz")
            const shopflixCategoryPercentage = result.cat_percentage.find(x => x.name.toLowerCase().trim() === "shopflix")

            if (generalCategoryPercentage) {
                if (generalCategoryPercentage.percentage) {
                    percentages.general.platformCategoryPercentage = generalCategoryPercentage.percentage
                }

                percentages.general.addToPrice = generalCategoryPercentage.add_to_price ? generalCategoryPercentage.add_to_price : 0

                if (generalCategoryPercentage.brand_perc && generalCategoryPercentage.brand_perc.length > 0) {
                    generalCategoryPercentage.brand_perc.forEach(x => {
                        percentages.general.brandPercentage.set(x.brand.name, x.percentage);
                    });
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
                    skroutzCategoryPercentage.brand_perc.forEach(x => {
                        percentages.skroutz.brandPercentage.set(x.brand.name, x.percentage);
                    });
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
                    shopflixCategoryPercentage.brand_perc.forEach(x => {
                        percentages.shopflix.brandPercentage.set(x.brand.name, x.percentage);
                    });
                }
            }
            else {
                percentages.shopflix.platformCategoryPercentage = percentages.general.platformCategoryPercentage
                percentages.shopflix.addToPrice = percentages.general.addToPrice
            }

            const products = await strapi.entityService.findMany('api::product.product', {
                filters: {
                    $and: [
                        { category: result.id },
                        { publishedAt: { $notNull: true, } }
                    ]
                },
                populate: {
                    supplierInfo: true,
                    brand: true,
                    platform: true,
                },
            });

            for (let product of products) {
                let brandPercentage = {}
                brandPercentage.general = percentages.general.brandPercentage.get(product.brand?.name)
                brandPercentage.skroutz = percentages.skroutz.brandPercentage.get(product.brand?.name)
                brandPercentage.shopflix = percentages.shopflix.brandPercentage.get(product.brand?.name)

                const filteredSupplierInfo = product.supplierInfo.filter(x => x.in_stock === true)

                let minSupplierPrice = filteredSupplierInfo?.reduce((prev, current) => {
                    return (prev.wholesale < current.wholesale) ? prev : current
                })

                const supplier = await strapi.db.query('plugin::import-products.importxml').findOne({
                    select: ['name', 'shipping'],
                    where: { name: minSupplierPrice.name },
                });

                let supplierShipping = supplier.shipping ? supplier.shipping : 0

                let minPrices = {}

                let generalPerc = brandPercentage.general ? brandPercentage.general : percentages.general.platformCategoryPercentage
                let skroutzPerc = brandPercentage.skroutz ? brandPercentage.skroutz :
                    (brandPercentage.general ? brandPercentage.general : percentages.skroutz.platformCategoryPercentage)
                let shopflixPerc = brandPercentage.shopflix ? brandPercentage.shopflix :
                    (brandPercentage.general ? brandPercentage.general : percentages.shopflix.platformCategoryPercentage)

                minPrices.general = parseFloat((parseFloat(minSupplierPrice.wholesale) + parseFloat(minSupplierPrice.recycle_tax) + parseFloat(percentages.general.addToPrice) + parseFloat(supplierShipping)) * (taxRate / 100 + 1) * (parseFloat(generalPerc) / 100 + 1)).toFixed(2)
                minPrices.skroutz = parseFloat((parseFloat(minSupplierPrice.wholesale) + parseFloat(minSupplierPrice.recycle_tax) + parseFloat(percentages.skroutz.addToPrice) + parseFloat(supplierShipping)) * (taxRate / 100 + 1) * (parseFloat(skroutzPerc) / 100 + 1)).toFixed(2)
                minPrices.shopflix = parseFloat((parseFloat(minSupplierPrice.wholesale) + parseFloat(minSupplierPrice.recycle_tax) + parseFloat(percentages.shopflix.addToPrice) + parseFloat(supplierShipping)) * (taxRate / 100 + 1) * (parseFloat(shopflixPerc) / 100 + 1)).toFixed(2)

                const data = {}

                if (product.price !== minPrices.general) {
                    if (!product.is_fixed_price) { data.price = parseFloat(minPrices.general).toFixed(2) }
                    else if (product.price < minPrices.general) {
                        if (!product.inventory || product.inventory === 0) {
                            data.price = parseFloat(minPrices.general).toFixed(2)
                            data.is_fixed_price = false
                        }
                    }
                }

                if (product.platform) {
                    const skroutz = product.platform.find(x => x.platform === "Skroutz")
                    const shopflix = product.platform.find(x => x.platform === "Shopflix")

                    if (skroutz && shopflix) {
                        let isSkroutzPriceChanged = false
                        let isSkroutzPriceFixedChanges = false
                        let isShopflixPriceChanged = false
                        let isShopflixPriceFixedChanges = false

                        if (parseFloat(skroutz.price).toFixed(2) !== parseFloat(minPrices.skroutz).toFixed(2)) {
                            if (!skroutz.is_fixed_price) { isSkroutzPriceChanged = true }
                            else if (skroutz.price < minPrices.skroutz) {
                                if (!product.inventory || product.inventory === 0) {
                                    isSkroutzPriceChanged = true
                                    isSkroutzPriceFixedChanges = true
                                }
                            }
                        }

                        if (parseFloat(shopflix.price).toFixed(2) !== parseFloat(minPrices.shopflix).toFixed(2)) {
                            if (!shopflix.is_fixed_price) { isShopflixPriceChanged = true }
                            else if (skroutz.price < minPrices.skroutz) {
                                if (!product.inventory || product.inventory === 0) {
                                    isShopflixPriceChanged = true
                                    isShopflixPriceFixedChanges = true
                                }
                            }
                        }

                        if (isSkroutzPriceChanged || isShopflixPriceChanged) {
                            data.platform = []
                            if (isSkroutzPriceChanged) {
                                if (isSkroutzPriceFixedChanges) {
                                    skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                    skroutz.is_fixed_price = false
                                    data.platform.push(skroutz)
                                }
                                else {
                                    skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                    data.platform.push(skroutz)
                                }
                            }
                            else {
                                data.platform.push(skroutz)
                            }

                            if (isShopflixPriceChanged) {
                                if (isShopflixPriceFixedChanges) {
                                    shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                    shopflix.is_fixed_price = false
                                    data.platform.push(shopflix)
                                }
                                else {
                                    shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                    data.platform.push(shopflix)
                                }
                            }
                            else {
                                data.platform.push(shopflix)
                            }

                        }
                    }
                    else if (!skroutz && !shopflix) {
                        data.platform = [{
                            platform: "Skroutz",
                            price: parseFloat(minPrices.general).toFixed(2),
                            is_fixed_price: false,
                        },
                        {
                            platform: "Shopflix",
                            price: parseFloat(minPrices.general).toFixed(2),
                            is_fixed_price: false,
                        }]
                    }
                    else {
                        if (!skroutz) {
                            data.platform = [{
                                platform: "Skroutz",
                                price: parseFloat(minPrices.general).toFixed(2),
                                is_fixed_price: false,
                            }]
                            if (shopflix.price !== minPrices.shopflix) {
                                if (!shopflix.is_fixed_price) {
                                    shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                }
                                else if (shopflix.price < minPrices.shopflix) {
                                    if (!product.inventory || product.inventory === 0) {
                                        shopflix.price = parseFloat(minPrices.shopflix).toFixed(2)
                                        shopflix.is_fixed_price = false
                                    }
                                }
                                data.platform = [shopflix]
                            }
                        }

                        if (!shopflix) {
                            if (skroutz.price !== minPrices.skroutz) {
                                if (!skroutz.is_fixed_price) {
                                    skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                }
                                else if (skroutz.price < minPrices.skroutz) {
                                    if (!product.inventory || product.inventory === 0) {
                                        skroutz.price = parseFloat(minPrices.skroutz).toFixed(2)
                                        skroutz.is_fixed_price = false
                                    }
                                }
                                data.platform = [skroutz]
                            }
                            data.platform.push({
                                platform: "Shopflix",
                                price: parseFloat(minPrices.general).toFixed(2),
                                is_fixed_price: false,
                            })
                        }
                    }
                }
                else {
                    data.platform = [{
                        platform: "Skroutz",
                        price: parseFloat(minPrices.general).toFixed(2),
                        is_fixed_price: false,
                    },
                    {
                        platform: "Shopflix",
                        price: parseFloat(minPrices.general).toFixed(2),
                        is_fixed_price: false,
                    }]
                }

                if (Object.keys(data).length !== 0) {
                    await strapi.entityService.update('api::product.product', product.id, {
                        data
                    });
                }

            }
        } catch (error) {
            console.log(error)
        }
    },
};