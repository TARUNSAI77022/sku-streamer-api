const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], 
    default: 'PENDING' 
  },
  progress: { type: Number, default: 0 },
  totalRows: { type: Number, default: 0 },
  processedRows: { type: Number, default: 0 },
  fileName: { type: String },
  result: {
    valid: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 }
  },
  error: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
