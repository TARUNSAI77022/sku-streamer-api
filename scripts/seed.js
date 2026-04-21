require('dotenv').config();
const mongoose = require('mongoose');
const SKU = require('../models/SKU');
const Category = require('../models/Category');
const UOM = require('../models/UOM');
const SKUUpload = require('../models/SKUUpload');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // STEP 1: RESET DATABASE
    console.log('Resetting database...');
    await SKU.deleteMany({});
    await Category.deleteMany({});
    await UOM.deleteMany({});
    await SKUUpload.deleteMany({});
    console.log('Database reset complete.');

    // STEP 3: SEED MASTER DATA
    console.log('Seeding master data...');

    // Seed Categories
    const categories = [
      { categoryId: 'CAT-1', categoryName: 'Electronics' },
      { categoryId: 'CAT-2', categoryName: 'Groceries' },
      { categoryId: 'CAT-3', categoryName: 'Clothing' },
      { categoryId: 'CAT-4', categoryName: 'Home & Kitchen' },
      { categoryId: 'CAT-5', categoryName: 'Automotive' }
    ];
    await Category.insertMany(categories);
    console.log(`${categories.length} Categories seeded.`);

    // Seed UOMs
    const uoms = [
      { uomCode: 'UNIT', description: 'Unit/Piece' },
      { uomCode: 'KG', description: 'Kilogram' },
      { uomCode: 'LTR', description: 'Liter' }
    ];
    await UOM.insertMany(uoms);
    console.log(`${uoms.length} UOMs seeded.`);

    // Seed SKUs (50 records)
    const skus = [];
    for (let i = 1; i <= 50; i++) {
      skus.push({
        skuId: `SKU-${i.toString().padStart(3, '0')}`,
        skuName: `Product SKU Name ${i}`
      });
    }
    await SKU.insertMany(skus);
    console.log(`${skus.length} SKUs seeded.`);

    console.log('Master data seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
