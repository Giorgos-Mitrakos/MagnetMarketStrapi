'use strict';

/**
 * user-address service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-address.user-address', ({ strapi }) => ({
    async getUser(ctx) {
        try {
            const billing_address = await strapi.db.query('api::user-address.user-address').findMany({
                where: {
                    user_billing: {
                        id: ctx.state.user.id
                    }
                },
            })

            const shipping_address = await strapi.db.query('api::user-address.user-address').findMany({
                where: {
                    user_shipping: {
                        id: ctx.state.user.id
                    }
                },
            })

            // console.log(shipping_address)
            return {
                user: {
                    info: {
                        username: ctx.state.user.username,
                        email: ctx.state.user.email,
                        firstName: ctx.state.user.firstName,
                        lastName: ctx.state.user.lastName,
                        telephone: ctx.state.user.telephone,
                        mobilePhone: ctx.state.user.mobilePhone
                    },
                    billing_address: billing_address,
                    shipping_address
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async findMyAddress(ctx) {
        try {
            const billing_address = await strapi.db.query('api::user-address.user-address').findMany({
                where: {
                    user_billing: {
                        id: ctx.state.user.id
                    }
                },
            })

            const shipping_address = await strapi.db.query('api::user-address.user-address').findMany({
                where: {
                    user_shipping: {
                        id: ctx.state.user.id
                    }
                },
            })

            console.log(shipping_address)
            return {
                user: {
                    username: ctx.state.user.username,
                    email: ctx.state.user.email,
                    firstName: ctx.state.user.firstName,
                    lastName: ctx.state.user.lastName,
                    telephone: ctx.state.user.telephone,
                    mobilePhone: ctx.state.user.mobilePhone,
                    billing_address: billing_address,
                    shipping_address
                }
            }
        } catch (error) {
            console.log(error)
        }
    },

    async updateMyAddress(ctx) {
        try {
            const user = await strapi.entityService.update('plugin::users-permissions.user', ctx.state.user.id,
                {
                    data: {
                        email: ctx.request.body.email,
                        firstName: ctx.request.body.firstName,
                        lastName: ctx.request.body.lastName,
                        telephone: ctx.request.body.telephone,
                        mobilePhone: ctx.request.body.mobilePhone,
                    },
                });

            console.log(user)
            // const billing_address = await strapi.db.query('api::user-address.user-address').findMany({
            //     where: {
            //         user_billing: {
            //             id: ctx.state.user.id
            //         }
            //     },
            // })

            // const shipping_address = await strapi.db.query('api::user-address.user-address').findMany({
            //     where: {
            //         user_shipping: {
            //             id: ctx.state.user.id
            //         }
            //     },
            // })

            // return {
            //     user: {
            //         username: ctx.state.user.username,
            //         email: ctx.state.user.email,
            //         firstName: ctx.state.user.firstName,
            //         lastName: ctx.state.user.lastName,
            //         telephone: ctx.state.user.telephone,
            //         mobilePhone: ctx.state.user.mobilePhone,
            //         billing_address: billing_address,
            //         shipping_address
            //     }
            // }
        } catch (error) {
            console.log(error)
        }
    }
}));
