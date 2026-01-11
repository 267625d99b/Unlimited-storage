/**
 * Swagger API Documentation
 * توثيق API باستخدام Swagger/OpenAPI
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cloud Storage API',
      version: '1.0.0',
      description: 'نظام التخزين السحابي - API Documentation',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            displayName: { type: 'string' },
            role: { type: 'string', enum: ['super_admin', 'admin', 'user', 'guest'] },
            status: { type: 'string', enum: ['active', 'suspended', 'pending'] },
            createdAt: { type: 'string', format: 'date-time' },
            emailVerified: { type: 'boolean' },
            twoFactorEnabled: { type: 'boolean' }
          }
        },
        File: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            size: { type: 'integer' },
            type: { type: 'string' },
            folder_id: { type: 'string', format: 'uuid', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            starred: { type: 'boolean' },
            shared: { type: 'boolean' }
          }
        },
        Folder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            parent_id: { type: 'string', format: 'uuid', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasMore: { type: 'boolean' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 8 }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { $ref: '#/components/schemas/User' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            displayName: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Files', description: 'File operations' },
      { name: 'Folders', description: 'Folder operations' },
      { name: 'Search', description: 'Search functionality' },
      { name: 'Share', description: 'Sharing functionality' },
      { name: 'Admin', description: 'Admin operations' }
    ]
  },
  apis: ['./server/routes/*.js', './server/swagger-docs.js']
};

const specs = swaggerJsdoc(options);

function setupSwagger(app) {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Cloud Storage API Docs'
  }));
  
  // JSON spec endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
  
  console.log('📚 Swagger docs available at /api-docs');
}

module.exports = { setupSwagger, specs };
