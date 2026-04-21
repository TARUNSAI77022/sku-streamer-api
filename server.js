require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const skuRoutes = require('./routes/skuRoutes');

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
