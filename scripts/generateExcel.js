const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const generateFile = (rowCount, fileName) => {
  const data = [
    ['ClientName', 'SKU', 'SKUName', 'Category', 'UOM', 'Weight']
  ];

  for (let i = 1; i <= rowCount; i++) {
    // 10% of data will be invalid
    const isInvalid = Math.random() < 0.1;

    let sku = `SKU-${Math.floor(Math.random() * 50 + 1).toString().padStart(3, '0')}`;
    let category = `CAT-${Math.floor(Math.random() * 5 + 1)}`;
    let uom = ['UNIT', 'KG', 'LTR'][Math.floor(Math.random() * 3)];

    if (isInvalid) {
      const errorType = Math.floor(Math.random() * 3);
      if (errorType === 0) sku = 'INVALID-SKU-999';
      else if (errorType === 1) category = 'INVALID-CAT-999';
      else uom = 'INVALID-UOM-999';
    }

    data.push([
      `Client ${Math.ceil(Math.random() * 10)}`,
      sku,
      `Product SKU Name Reference`,
      category,
      uom,
      (Math.random() * 100).toFixed(2)
    ]);
  }

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, 'SKU Data');

  const filePath = path.join(uploadDir, fileName);
  xlsx.writeFile(wb, filePath);
  console.log(`Generated: ${fileName} with ${rowCount} rows.`);
};

// Generate files: 2000, 4000, 5000, 7000 rows
generateFile(2000, 'skus_2000.xlsx');
generateFile(4000, 'skus_4000.xlsx');
generateFile(5000, 'skus_5000.xlsx');
generateFile(7000, 'skus_7000.xlsx');
