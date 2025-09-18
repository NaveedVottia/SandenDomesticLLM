import express from 'express';

const app = express();

app.get('/', (req, res) => {
  console.log('🎮 Root route called:', req.path, req.method);
  res.send('Test server working!');
});

const PORT = 8081;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});