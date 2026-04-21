const mongoose = require('mongoose');

const skuUploadSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  skuId: { type: String, required: true },
  skuName: { type: String, required: true },
  categoryId: { type: String, required: true },
  uomCode: { type: String, required: true },
  weight: { type: Number, required: true },
  status: { type: String, enum: ['VALID', 'INVALID'], required: true },
  error: { type: String, default: null }
}, { timestamps: true });

// Adding indexes for better query performance
skuUploadSchema.index({ status: 1 });
skuUploadSchema.index({ skuId: 1 });

module.exports = mongoose.model('SKUUpload', skuUploadSchema);
