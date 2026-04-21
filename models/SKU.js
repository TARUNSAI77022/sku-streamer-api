const mongoose = require('mongoose');

const skuSchema = new mongoose.Schema({
  skuId: { type: String, required: true, unique: true },
  skuName: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('SKU', skuSchema);
