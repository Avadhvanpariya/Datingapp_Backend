require('./src/config/env');

const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const connectDatabase = require('./src/middleware/database/connectDatabase');
const indexRouter = require('./src/routes/index.route');
const AppError = require('./utils/AppError');
const { initSocket } = require('./utils/socket');

const path = require('path');

dotenv.config();

const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 5153;
const CLIENT_URL = process.env.CLIENT_URL;

app.use(cors({ origin: CLIENT_URL, credentials: true, }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Connect to MongoDB
connectDatabase();

// Body parsers with limits 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api', indexRouter);

// 404 Handler
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: err.status || 'error',
    message: err.message || 'Internal Server Error',
  });
});

// Wrap Express app with HTTP Server to enable WebSockets
const server = http.createServer(app);
initSocket(server, CLIENT_URL);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
