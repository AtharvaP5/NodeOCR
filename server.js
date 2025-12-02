import express from 'express';
import cors from 'cors';
import pdf from 'pdf-parse';
import fs from 'fs';

const app = express();

// ✅ Enable CORS for all origins (default)
app.use(cors());

// OR, if you want to restrict access to specific origins, use this instead:
// app.use(cors({
//   origin: ['https://your-frontend-domain.com', 'http://localhost:3000'],
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.send('🚀 Node OCR API is running!');
});

// Main parsing route
app.post('/parse', async (req, res) => {
  try {
    console.log('📄 Received parse request');
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Missing filePath' });
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text.replace(/\r/g, '').replace(/\s+/g, ' ').trim();

    const getMatch = (regex) => {
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    const invoiceData = {
      customerName: getMatch(/CUSTOMER\s*NAME\s*[:\-]?\s*(.+?)(?=\s+DUE\s+DATE|TIN|ADDRESS|$)/i),
      dueDate: getMatch(/DUE\s*DATE\s*[:\-]?\s*([0-9/.\-]+)/i),
      accountNo: getMatch(/AC\s*NO\.?\s*[:\-]?\s*([0-9\-]+)/i),
    };

    res.json({ success: true, invoiceData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
