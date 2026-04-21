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
const Job = require('../models/Job');
const { v4: uuidv4 } = require('uuid');

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

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Get the status of a specific background job
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status retrieved
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching job status', error: error.message });
  }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get service health status
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'sku-streamer-api',
    timestamp: new Date().toISOString() 
  });
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload an Excel file for SKU processing
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload processed successfully
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file.' });
    }

    const jobId = uuidv4();
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const totalRows = rows.length;

    // Create the Job record in DB
    let job;
    try {
      job = await Job.create({
        jobId,
        status: 'PROCESSING',
        totalRows,
        fileName: req.file.originalname
      });
      console.log(`📋 [DB] Created persistent Job: ${jobId} for file: ${req.file.originalname}`);
    } catch (dbError) {
      console.error(`❌ [DB] Failed to create Job record:`, dbError);
      // We continue anyway, but this log will tell us WHY it's missing in your DB
    }

    // Send immediate response
    res.json({ message: 'Upload started', jobId, totalRows });

    // BACKGROUND PROCESSING START
    (async () => {
      try {
        const [skus, categories, uoms] = await Promise.all([
          SKU.find({}, 'skuId').lean(),
          Category.find({}, 'categoryId').lean(),
          UOM.find({}, 'uomCode').lean()
        ]);

        const skuSet = new Set(skus.map(s => s.skuId));
        const catSet = new Set(categories.map(c => c.categoryId));
        const uomSet = new Set(uoms.map(u => u.uomCode));

        let validCount = 0;
        let invalidCount = 0;

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
          if (isValid) validCount++; else invalidCount++;

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

          // Save row
          const savedRecord = await SKUUpload.create(recordData);

          // Update Job progress in DB every 50 rows (to avoid overworking DB) or at the end
          const progress = Math.round(((i + 1) / totalRows) * 100);
          if ((i + 1) % 50 === 0 || i === totalRows - 1) {
            await Job.findOneAndUpdate({ jobId }, { 
              progress, 
              processedRows: i + 1,
              result: { valid: validCount, invalid: invalidCount }
            });
          }

          // Emit progress via WebSocket (using room based on jobId)
          req.io.to(jobId).emit('uploadProgress', { 
            jobId,
            progress, 
            currentRow: i + 1, 
            totalRows,
            newRecords: [savedRecord]
          });
        }

        // Finalize Job
        await Job.findOneAndUpdate({ jobId }, { status: 'COMPLETED' });
        console.log(`✅ [Job ${jobId}] Completed successfully.`);

        // Cleanup file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      } catch (bgError) {
        console.error(`❌ [Job ${jobId}] Background Error:`, bgError);
        await Job.findOneAndUpdate({ jobId }, { status: 'FAILED', error: bgError.message });
      }
    })();
    // BACKGROUND PROCESSING END

  } catch (error) {
    console.error('Error starting upload:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

/**
 * @swagger
 * /api/sku-uploads:
 *   get:
 *     summary: Get all processed SKU uploads with pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Records per page
 *     responses:
 *       200:
 *         description: List of upload records
 */
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
