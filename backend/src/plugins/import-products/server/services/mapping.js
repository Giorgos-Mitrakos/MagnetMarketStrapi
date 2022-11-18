'use strict';

module.exports = ({ strapi }) => ({
    async getMapping({ id }) {
        try {
            const entry = await strapi.entityService.findOne('plugin::import-products.importxml', id,
                {
                    fields: ['name', 'isWhitelistSelected', 'xPath', 'minimumPrice', 'maximumPrice'],
                    sort: 'name:asc',
                    populate: {
                        categories_map:
                        {
                            fields: ['name', 'value'],
                            sort: 'name:asc',
                            populate: {
                                contains: true,
                                subcategory: {
                                    fields: ['name', 'value'],
                                    sort: 'name:asc',
                                    populate: {
                                        contains: true,
                                        subcategory: {
                                            fields: ['name', 'value'],
                                            populate: {
                                                contains: true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        char_name_map: {
                            fields: ['name', 'value'],
                            sort: 'name:asc',
                        },
                        char_value_map: {
                            fields: ['name', 'value'],
                            sort: 'name:asc',
                        },
                        stock_map: {
                            fields: ['name'],
                            sort: 'name:asc',
                        },
                        whitelist_map: {
                            fields: ['name'],
                            sort: 'name:asc',
                            populate: {
                                subcategory: {
                                    fields: ['name'],
                                    sort: 'name:asc',
                                    populate: {
                                        subcategory: {
                                            fields: ['name'],
                                            sort: 'name:asc',
                                        }
                                    }
                                }
                            }
                        },
                        blacklist_map: {
                            fields: ['name'],
                            sort: 'name:asc',
                            populate: {
                                subcategory: {
                                    fields: ['name'],
                                    sort: 'name:asc',
                                    populate: {
                                        subcategory: {
                                            fields: ['name'],
                                            sort: 'name:asc',
                                        }
                                    }
                                }
                            }
                        }
                    },
                })

            return entry
        }
        catch (err) {
            console.log(err);
        }
    },

    async updateCategoryMap(map) {
        try {
            await strapi.entityService.update('plugin::import-products.categorymap', map.id, {
                data: {
                    name: map.name,
                    value: map.value,
                    contains: map.contains.map(x => {
                        delete x.id
                        return x
                    })
                },
            });
        } catch (error) {
            console.log(error)
        }
    },

    async createCategoryMap(id, map) {
        try {
            const cat = await strapi.entityService.create('plugin::import-products.categorymap', {
                data: {
                    related_import: id,
                    name: map.name,
                    value: map.value,
                    contains: map.contains.map(x => {
                        delete x.id
                        return x
                    })
                },
            });
            return cat
        } catch (error) {
            console.log(error)
        }
    },

    async createSubCategoryMap(id, map) {
        try {
            const subcat = await strapi.entityService.create('plugin::import-products.categorymap', {
                data: {
                    parentcategory: id,
                    name: map.name,
                    value: map.value,
                    contains: map.contains.map(x => {
                        delete x.id
                        return x
                    })
                },
            });
            return subcat
        } catch (error) {
            console.log(error)
        }
    },

    async deleteOldCategoryMap({ categoryMapping, oldcategoryMapping }) {
        try {
            let newArrayId = []
            for (let cat of categoryMapping.categories_map) {
                for (let sub of cat.subcategory) {
                    for (let sub2 of sub.subcategory) {
                        newArrayId.push(sub2.id)
                    }
                    newArrayId.push(sub.id)
                }
                newArrayId.push(cat.id)
            }

            for (let old of oldcategoryMapping.categories_map) {
                if (!newArrayId.includes(old.id)) {
                    for (let oldsub of old.subcategory) {
                        for (let oldsub2 of oldsub.subcategory) {
                            await strapi.entityService.delete('plugin::import-products.categorymap', oldsub2.id)
                        }
                        await strapi.entityService.delete('plugin::import-products.categorymap', oldsub.id)
                    }
                    await strapi.entityService.delete('plugin::import-products.categorymap', old.id)
                }
                else {
                    for (let oldsub of old.subcategory) {
                        if (!newArrayId.includes(oldsub.id)) {
                            for (let oldsub2 of oldsub.subcategory) {
                                await strapi.entityService.delete('plugin::import-products.categorymap', oldsub2.id)
                            }
                            await strapi.entityService.delete('plugin::import-products.categorymap', oldsub.id)
                        }
                        else {
                            for (let oldsub2 of oldsub.subcategory) {
                                if (!newArrayId.includes(oldsub2.id)) {
                                    await strapi.entityService.delete('plugin::import-products.categorymap', oldsub2.id)
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async saveMappingCategories({ id, categoryMapping, oldcategoryMapping }) {
        try {
            await this.deleteOldCategoryMap({ categoryMapping, oldcategoryMapping })

            for (let map of categoryMapping.categories_map) {
                const category = await strapi.entityService.findOne('plugin::import-products.categorymap', map.id,
                    {
                        fields: ['name', 'value'],
                    })
                if (category) {
                    this.updateCategoryMap(map)
                    for (let submap of map.subcategory) {
                        let subcategory = await strapi.entityService.findOne('plugin::import-products.categorymap', submap.id,
                            {
                                fields: ['name', 'value'],
                                sort: 'name:asc',
                            })
                        if (subcategory) {
                            this.updateCategoryMap(submap)
                            for (let submap2 of submap.subcategory) {
                                let subcategory2 = await strapi.entityService.findOne('plugin::import-products.categorymap', submap2.id,
                                    {
                                        fields: ['name', 'value'],
                                        sort: 'name:asc',
                                    })
                                if (subcategory2) {
                                    this.updateCategoryMap(submap2)
                                }
                                else {
                                    this.createSubCategoryMap(submap.id, submap2)
                                }
                            }
                        }
                        else {
                            const newsub = await this.createSubCategoryMap(map.id, submap)
                            for (let submap2 of submap.subcategory) {
                                this.createSubCategoryMap(newsub.id, submap2)
                            }
                        }
                    }
                }
                else {
                    const newCat = await this.createCategoryMap(id, map)
                    for (let submap of map.subcategory) {
                        const newSub = await this.createSubCategoryMap(newCat.id, submap)
                        for (let submap2 of submap.subcategory) {
                            this.createSubCategoryMap(newSub.id, submap2)
                        }
                    }
                }
            }

        } catch (error) {
            console.log(error);
        }
    },

    async deleteOldCharNames({ categoryMapping, oldcategoryMapping }) {
        try {
            let newArrayId = []
            for (let char of categoryMapping.char_name_map) {
                newArrayId.push(char.id)
            }
            for (let old of oldcategoryMapping.char_name_map) {
                if (!newArrayId.includes(old.id)) {
                    console.log(old.id)
                    await strapi.entityService.delete('plugin::import-products.charnamemap', old.id)
                }
            }
        } catch (error) {

        }

    },

    async saveCharNames({ id, categoryMapping, oldcategoryMapping }) {
        try {
            await this.deleteOldCharNames({ categoryMapping, oldcategoryMapping })

            for (let map of categoryMapping.char_name_map) {

                const charTitle = await strapi.entityService.findOne('plugin::import-products.charnamemap', map.id,
                    {
                        fields: ['name', 'value'],
                        sort: 'name:asc',
                    })

                if (charTitle) {
                    await strapi.entityService.update('plugin::import-products.charnamemap', map.id, {
                        data: {
                            name: map.name,
                            value: map.value,
                        },
                    });
                }
                else {
                    await strapi.entityService.create('plugin::import-products.charnamemap', {
                        data: {
                            name: map.name,
                            value: map.value,
                            related_import: id,
                        },
                    });
                }

            }
        } catch (error) {

        }
    },

    async deleteOldCharValues({ id, categoryMapping, oldcategoryMapping }) {
        try {
            let newArrayId = []
            for (let char of categoryMapping.char_value_map) {
                newArrayId.push(char.id)
            }
            for (let old of oldcategoryMapping.char_value_map) {
                if (!newArrayId.includes(old.id)) {
                    await strapi.entityService.delete('plugin::import-products.charvaluemap', old.id)
                }
            }
        } catch (error) {

        }

    },

    async saveCharValues({ id, categoryMapping, oldcategoryMapping }) {
        try {
            await this.deleteOldCharValues({ categoryMapping, oldcategoryMapping })

            for (let map of categoryMapping.char_value_map) {

                const charTitle = await strapi.entityService.findOne('plugin::import-products.charvaluemap', map.id,
                    {
                        fields: ['name', 'value'],
                    })

                if (charTitle) {
                    await strapi.entityService.update('plugin::import-products.charvaluemap', map.id, {
                        data: {
                            name: map.name,
                            value: map.value
                        },
                    });
                }
                else {
                    await strapi.entityService.create('plugin::import-products.charvaluemap', {
                        data: {
                            name: map.name,
                            value: map.value,
                            related_import: id,
                        },
                    });
                }

            }
        } catch (error) {

        }
    },

    async deleteOldStockValues({ id, categoryMapping, oldcategoryMapping }) {
        try {
            let newArrayId = []
            for (let stock of categoryMapping.stock_map) {
                newArrayId.push(stock.id)
            }
            for (let old of oldcategoryMapping.stock_map) {
                if (!newArrayId.includes(old.id)) {
                    await strapi.entityService.delete('plugin::import-products.stockmap', old.id)
                }
            }
        } catch (error) {

        }

    },

    async saveStockValues({ id, categoryMapping, oldcategoryMapping }) {
        try {
            await this.deleteOldStockValues({ categoryMapping, oldcategoryMapping })

            for (let map of categoryMapping.stock_map) {

                const stockValue = await strapi.entityService.findOne('plugin::import-products.stockmap', map.id,
                    {
                        fields: ['name'],
                    })

                if (stockValue) {
                    await strapi.entityService.update('plugin::import-products.stockmap', map.id, {
                        data: {
                            name: map.name,
                        },
                    });
                }
                else {
                    await strapi.entityService.create('plugin::import-products.stockmap', {
                        data: {
                            name: map.name,
                            related_import: id,
                        },
                    });
                }

            }
        } catch (error) {

        }
    },

    async updateWhitelistMap(map) {
        try {
            await strapi.entityService.update('plugin::import-products.whitelistmap', map.id, {
                data: {
                    name: map.name,
                },
            });
        } catch (error) {
            console.log(error)
        }
    },

    async createWhitelistCategory(id, map) {
        try {
            const cat = await strapi.entityService.create('plugin::import-products.whitelistmap', {
                data: {
                    related_import: id,
                    name: map.name,
                },
            });
            return cat
        } catch (error) {
            console.log(error)
        }
    },

    async createWhitelistSubCategoryMap(id, map) {
        try {
            const subcat = await strapi.entityService.create('plugin::import-products.whitelistmap', {
                data: {
                    parentcategory: id,
                    name: map.name,
                },
            });
            return subcat
        } catch (error) {
            console.log(error)
        }
    },

    async deleteOldWhitelistMap({ categoryMapping, oldcategoryMapping }) {
        try {
            let newArrayId = []
            for (let cat of categoryMapping.whitelist_map) {
                for (let sub of cat.subcategory) {
                    for (let sub2 of sub.subcategory) {
                        newArrayId.push(sub2.id)
                    }
                    newArrayId.push(sub.id)
                }
                newArrayId.push(cat.id)
            }
            for (let old of oldcategoryMapping.whitelist_map) {
                if (!newArrayId.includes(old.id)) {
                    for (let oldsub of old.subcategory) {
                        for (let oldsub2 of oldsub.subcategory) {
                            await strapi.entityService.delete('plugin::import-products.whitelistmap', oldsub2.id)
                        }
                        await strapi.entityService.delete('plugin::import-products.whitelistmap', oldsub.id)
                    }
                    await strapi.entityService.delete('plugin::import-products.whitelistmap', old.id)
                }
                else {
                    for (let oldsub of old.subcategory) {
                        if (!newArrayId.includes(oldsub.id)) {
                            for (let oldsub2 of oldsub.subcategory) {
                                await strapi.entityService.delete('plugin::import-products.whitelistmap', oldsub2.id)
                            }
                            await strapi.entityService.delete('plugin::import-products.whitelistmap', oldsub.id)
                        }
                        else {
                            for (let oldsub2 of oldsub.subcategory) {
                                if (!newArrayId.includes(oldsub2.id))
                                    await strapi.entityService.delete('plugin::import-products.whitelistmap', oldsub2.id)
                            }
                        }

                    }
                    await strapi.entityService.delete('plugin::import-products.whitelistmap', old.id)
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async saveWhitelist({ id, categoryMapping, oldcategoryMapping }) {
        try {
            await this.deleteOldWhitelistMap({ categoryMapping, oldcategoryMapping })

            for (let map of categoryMapping.whitelist_map) {
                const category = await strapi.entityService.findOne('plugin::import-products.whitelistmap', map.id,
                    {
                        fields: ['name'],
                    })
                if (category) {
                    this.updateWhitelistMap(map)
                    for (let submap of map.subcategory) {
                        let subcategory = await strapi.entityService.findOne('plugin::import-products.whitelistmap', submap.id,
                            {
                                fields: ['name'],
                            })
                        if (subcategory) {
                            this.updateWhitelistMap(submap)
                            for (let submap2 of submap.subcategory) {
                                let subcategory2 = await strapi.entityService.findOne('plugin::import-products.whitelistmap', submap2.id,
                                    {
                                        fields: ['name'],
                                    })
                                if (subcategory2) {
                                    this.updateWhitelistMap(submap2)
                                }
                                else {
                                    this.createWhitelistSubCategoryMap(submap.id, submap2)
                                }
                            }
                        }
                        else {
                            const newsub = await this.createWhitelistSubCategoryMap(map.id, submap)
                            for (let submap2 of submap.subcategory) {
                                this.createWhitelistSubCategoryMap(newsub.id, submap2)
                            }
                        }
                    }
                }
                else {
                    const newCat = await this.createWhitelistCategory(id, map)
                    for (let submap of map.subcategory) {
                        const newSub = await this.createWhitelistSubCategoryMap(newCat.id, submap)
                        for (let submap2 of submap.subcategory) {
                            this.createWhitelistSubCategoryMap(newSub.id, submap2)
                        }
                    }
                }
            }

        } catch (error) {
            console.log(error);
        }
    },

    async updateBlacklistMap(map) {
        try {
            await strapi.entityService.update('plugin::import-products.blacklistmap', map.id, {
                data: {
                    name: map.name,
                },
            });
        } catch (error) {
            console.log(error)
        }
    },

    async createBlacklistCategory(id, map) {
        try {
            const cat = await strapi.entityService.create('plugin::import-products.blacklistmap', {
                data: {
                    related_import: id,
                    name: map.name,
                },
            });
            return cat
        } catch (error) {
            console.log(error)
        }
    },

    async createBlacklistSubCategoryMap(id, map) {
        try {
            const subcat = await strapi.entityService.create('plugin::import-products.blacklistmap', {
                data: {
                    parentcategory: id,
                    name: map.name,
                },
            });
            return subcat
        } catch (error) {
            console.log(error)
        }
    },

    async deleteOldBlacklistMap({ categoryMapping, oldcategoryMapping }) {
        try {
            let newArrayId = []
            for (let cat of categoryMapping.blacklist_map) {
                for (let sub of cat.subcategory) {
                    for (let sub2 of sub.subcategory) {
                        newArrayId.push(sub2.id)
                    }
                    newArrayId.push(sub.id)
                }
                newArrayId.push(cat.id)
            }
            for (let old of oldcategoryMapping.blacklist_map) {
                if (!newArrayId.includes(old.id)) {
                    for (let oldsub of old.subcategory) {
                        for (let oldsub2 of oldsub.subcategory) {
                            await strapi.entityService.delete('plugin::import-products.blacklistmap', oldsub2.id)
                        }
                        await strapi.entityService.delete('plugin::import-products.blacklistmap', oldsub.id)
                    }
                    await strapi.entityService.delete('plugin::import-products.blacklistmap', old.id)
                }
                else {
                    for (let oldsub of old.subcategory) {
                        if (!newArrayId.includes(oldsub.id)) {
                            for (let oldsub2 of oldsub.subcategory) {
                                await strapi.entityService.delete('plugin::import-products.blacklistmap', oldsub2.id)
                            }
                            await strapi.entityService.delete('plugin::import-products.blacklistmap', oldsub.id)
                        }
                        else {
                            for (let oldsub2 of oldsub.subcategory) {
                                if (!newArrayId.includes(oldsub2.id))
                                    await strapi.entityService.delete('plugin::import-products.blacklistmap', oldsub2.id)
                            }
                        }

                    }
                    await strapi.entityService.delete('plugin::import-products.blacklistmap', old.id)
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async saveBlacklist({ id, categoryMapping, oldcategoryMapping }) {
        try {
            await this.deleteOldBlacklistMap({ categoryMapping, oldcategoryMapping })

            for (let map of categoryMapping.blacklist_map) {
                const category = await strapi.entityService.findOne('plugin::import-products.blacklistmap', map.id,
                    {
                        fields: ['name'],
                    })
                if (category) {
                    this.updateBlacklistMap(map)
                    for (let submap of map.subcategory) {
                        let subcategory = await strapi.entityService.findOne('plugin::import-products.blacklistmap', submap.id,
                            {
                                fields: ['name'],
                            })
                        if (subcategory) {
                            this.updateBlacklistMap(submap)
                            for (let submap2 of submap.subcategory) {
                                let subcategory2 = await strapi.entityService.findOne('plugin::import-products.blacklistmap', submap2.id,
                                    {
                                        fields: ['name'],
                                    })
                                if (subcategory2) {
                                    this.updateBlacklistMap(submap2)
                                }
                                else {
                                    this.createBlacklistSubCategoryMap(submap.id, submap2)
                                }
                            }
                        }
                        else {
                            const newsub = await this.createBlacklistSubCategoryMap(map.id, submap)
                            for (let submap2 of submap.subcategory) {
                                this.createBlacklistSubCategoryMap(newsub.id, submap2)
                            }
                        }
                    }
                }
                else {
                    const newCat = await this.createBlacklistCategory(id, map)
                    for (let submap of map.subcategory) {
                        const newSub = await this.createBlacklistSubCategoryMap(newCat.id, submap)
                        for (let submap2 of submap.subcategory) {
                            this.createBlacklistSubCategoryMap(newSub.id, submap2)
                        }
                    }
                }
            }

        } catch (error) {
            console.log(error);
        }
    },

    async updateIsWhitelistSelected_XPath_minPrice_maxPrice({ id, categoryMapping }) {
        try {
            await strapi.entityService.update('plugin::import-products.importxml', id, {
                data: {
                    isWhitelistSelected: categoryMapping.isWhitelistSelected,
                    xPath: categoryMapping.xPath,
                    minimumPrice: categoryMapping.minimumPrice,
                    maximumPrice: categoryMapping.maximumPrice,
                },
            })
        } catch (error) {

        }
    },

    async saveMapping({ id, categoryMapping }) {
        let oldcategoryMapping = await this.getMapping({ id })
        await this.saveMappingCategories({ id, categoryMapping, oldcategoryMapping })
        await this.saveCharNames({ id, categoryMapping, oldcategoryMapping })
        await this.saveCharValues({ id, categoryMapping, oldcategoryMapping })
        await this.saveStockValues({ id, categoryMapping, oldcategoryMapping })
        await this.updateIsWhitelistSelected_XPath_minPrice_maxPrice({ id, categoryMapping })
        await this.saveWhitelist({ id, categoryMapping, oldcategoryMapping })
        await this.saveBlacklist({ id, categoryMapping, oldcategoryMapping })
    },

});
