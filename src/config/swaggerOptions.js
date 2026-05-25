const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Click Cupid',
      version: '1.0.0',
      description: 'API documentation for Click Cupid backend',
    },
    servers: [
      {
        url: `${process.env.BASE_URL}/api`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/**/*.js', './src/controllers/**/*.js'],
};

module.exports = options;
