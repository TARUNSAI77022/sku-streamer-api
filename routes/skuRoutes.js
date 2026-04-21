const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const SKU = require('../models/SKU');
const Category = require('../models/Category');
const UOM = require('../models/UOM');
const SKUUpload = require('../models/SKUUpload');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// POST /upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file.' });
    }

    // Parse Excel
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const totalRows = rows.length;

    // Fetch master data for validation
    const [skus, categories, uoms] = await Promise.all([
      SKU.find({}, 'skuId').lean(),
      Category.find({}, 'categoryId').lean(),
      UOM.find({}, 'uomCode').lean()
    ]);

    const skuSet = new Set(skus.map(s => s.skuId));
    const catSet = new Set(categories.map(c => c.categoryId));
    const uomSet = new Set(uoms.map(u => u.uomCode));

    for (let i = 0; i < totalRows; i++) {
      const row = rows[i];
      const skuId = (row.SKU || '').toString();
      const catId = (row.Category || '').toString();
      const uomCode = (row.UOM || '').toString();

      let errors = [];
      if (!skuSet.has(skuId)) errors.push('Invalid SKU');
      if (!catSet.has(catId)) errors.push('Category Not Found');
      if (!uomSet.has(uomCode)) errors.push('UOM Not Found');

      const isValid = errors.length === 0;

      const recordData = {
        clientName: row.ClientName || 'N/A',
        skuId: skuId,
        skuName: row.SKUName || 'N/A',
        categoryId: catId,
        uomCode: uomCode,
        weight: Number(row.Weight) || 0,
        status: isValid ? 'VALID' : 'INVALID',
        error: isValid ? null : errors.join(' / ')
      };

      // 1-BY-1 SAVE: Save this specific row to MongoDB Atlas immediately
      const savedRecord = await SKUUpload.create(recordData);

      // 1-BY-1 EMIT: Send this row and current progress to UI immediately
      const progress = Math.round(((i + 1) / totalRows) * 100);
      req.io.emit('uploadProgress', { 
        progress, 
        currentRow: i + 1, 
        totalRows,
        newRecords: [savedRecord] // Send as an array so frontend logic still works
      });
      
      console.log(`[1-by-1] Saved & Emitted Row ${i+1}/${totalRows}: ${skuId}`);
    }

    // Cleanup
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      message: 'Upload processed successfully',
      totalRows: totalRows,
      valid: uploadRecords.filter(r => r.status === 'VALID').length,
      invalid: uploadRecords.filter(r => r.status === 'INVALID').length
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// GET /sku-uploads with Pagination and Projection
router.get('/sku-uploads', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const [records, total] = await Promise.all([
      SKUUpload.find(filter)
        .select('clientName skuId status error createdAt') // Projection
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SKUUpload.countDocuments(filter)
    ]);

    res.json({
      records,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

module.exports = router;
