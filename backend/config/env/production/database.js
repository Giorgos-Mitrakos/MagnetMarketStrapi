module.exports = ({ env }) => ({
    connection: {
      client: 'mysql',
      connection: {
        host: env('DATABASE_HOST', '127.0.0.1'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'f127527kko_strapi'),
        user: env('DATABASE_USERNAME', 'f127527kko'),
        password: env('DATABASE_PASSWORD', 'Z?d94oX!_S'),
        ssl: env.bool('DATABASE_SSL', false),
      },
    },
  });