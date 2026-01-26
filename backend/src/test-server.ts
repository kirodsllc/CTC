import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Inventory ERP Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working correctly',
    endpoints: {
      health: '/health',
      parts: '/api/parts',
      dropdowns: '/api/dropdowns',
    },
  });
});

// Start server
app.listen(PORT, () => {
});

