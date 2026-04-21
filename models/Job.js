const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'], 
    default: 'PROCESSING' 
  },
  progress: { type: Number, default: 0 },
  totalRows: { type: Number, default: 0 },
  currentRow: { type: Number, default: 0 },
  fileName: { type: String },
  result: {
    valid: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 },
    errors: [String]
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
