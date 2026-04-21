const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryId: { type: String, required: true, unique: true },
  categoryName: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
