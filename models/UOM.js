const mongoose = require('mongoose');

const uomSchema = new mongoose.Schema({
  uomCode: { type: String, required: true, unique: true },
  description: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('UOM', uomSchema);
