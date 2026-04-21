require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const skuRoutes = require('./routes/skuRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 5000;

// Setup HTTP server for WebSocket
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with FRONTEND_URL
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SKU Streamer API',
      version: '1.0.0',
      description: 'API for real-time Excel SKU processing and validation',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local server',
      },
      {
        url: 'https://sku-streamer-api.onrender.com', // Placeholder for production
        description: 'Production server',
      }
    ],
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api', skuRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
