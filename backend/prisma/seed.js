/**
 * BizGST — Database Seed
 * Creates a sample business with products, parties, and demo invoices
 * Run: node prisma/seed.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BizGST database...');

  // Create demo user
  const user = await prisma.user.upsert({
    where: { mobile: '9876543210' },
    update: {},
    create: {
      mobile: '9876543210',
      name:   'Rahul Sharma',
      isVerified: true,
    },
  });
  console.log(`✅ User: ${user.id}`);

  // Create business
  const business = await prisma.business.upsert({
    where: { gstin: '27ABCDE1234F1Z5' },
    update: {},
    create: {
      userId:      user.id,
      name:        'Sharma Electronics',
      gstin:       '27ABCDE1234F1Z5',
      stateCode:   '27',
      stateName:   'Maharashtra',
      address:     'Shop 12, Gandhi Market, Pune - 411001',
      businessType: 'RETAIL',
    },
  });
  console.log(`✅ Business: ${business.name}`);

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-fan-001' },
      update: {},
      create: { id: 'prod-fan-001', businessId: business.id, name: 'Ceiling Fan', hsnCode: '8414', gstRate: 18, unit: 'Nos', basePrice: 2200 },
    }),
    prisma.product.upsert({
      where: { id: 'prod-phone-001' },
      update: {},
      create: { id: 'prod-phone-001', businessId: business.id, name: 'Mobile Phone', hsnCode: '8517', gstRate: 18, unit: 'Nos', basePrice: 12000 },
    }),
    prisma.product.upsert({
      where: { id: 'prod-tv-001' },
      update: {},
      create: { id: 'prod-tv-001', businessId: business.id, name: 'Television', hsnCode: '8528', gstRate: 28, unit: 'Nos', basePrice: 35000 },
    }),
    prisma.product.upsert({
      where: { id: 'prod-bulb-001' },
      update: {},
      create: { id: 'prod-bulb-001', businessId: business.id, name: 'LED Bulb', hsnCode: '8539', gstRate: 12, unit: 'Nos', basePrice: 120 },
    }),
  ]);
  console.log(`✅ Products: ${products.length} created`);

  // Create customers
  const customer1 = await prisma.party.upsert({
    where: { id: 'party-cust-001' },
    update: {},
    create: {
      id: 'party-cust-001',
      businessId: business.id,
      name: 'Ramesh Traders',
      gstin: '27XYZAB1234C1Z5',
      stateCode: '27',
      stateName: 'Maharashtra',
      mobile: '9898989898',
      type: 'CUSTOMER',
    },
  });

  const customer2 = await prisma.party.upsert({
    where: { id: 'party-cust-002' },
    update: {},
    create: {
      id: 'party-cust-002',
      businessId: business.id,
      name: 'Mehta Enterprises',
      gstin: '24ABCDE5678G1Z9',
      stateCode: '24',
      stateName: 'Gujarat',
      mobile: '9797979797',
      type: 'CUSTOMER',
    },
  });

  // Create vendor
  const vendor1 = await prisma.party.upsert({
    where: { id: 'party-vend-001' },
    update: {},
    create: {
      id: 'party-vend-001',
      businessId: business.id,
      name: 'Godrej Appliances Ltd',
      gstin: '27GODRE1234A1Z5',
      stateCode: '27',
      stateName: 'Maharashtra',
      type: 'VENDOR',
    },
  });
  console.log(`✅ Parties: customers + vendor created`);

  // Create sample sale invoice (B2B intrastate)
  const existingInv = await prisma.invoice.findFirst({
    where: { businessId: business.id, invoiceNumber: 'INV-0001' },
  });

  if (!existingInv) {
    await prisma.invoice.create({
      data: {
        businessId:    business.id,
        partyId:       customer1.id,
        invoiceNumber: 'INV-0001',
        invoiceDate:   new Date('2025-03-01'),
        invoiceType:   'SALE',
        supplyType:    'B2B',
        isInterstate:  false,
        taxableAmount: 24000,
        cgst:          2160,
        sgst:          2160,
        igst:          0,
        totalAmount:   28320,
        items: {
          create: [{
            productId:    'prod-phone-001',
            description:  'Mobile Phone',
            hsnCode:      '8517',
            quantity:     2,
            unit:         'Nos',
            unitPrice:    12000,
            taxableAmount:24000,
            gstRate:      18,
            cgst:         2160,
            sgst:         2160,
            igst:         0,
            totalAmount:  28320,
          }],
        },
      },
    });

    // B2B interstate sale
    await prisma.invoice.create({
      data: {
        businessId:    business.id,
        partyId:       customer2.id,
        invoiceNumber: 'INV-0002',
        invoiceDate:   new Date('2025-03-10'),
        invoiceType:   'SALE',
        supplyType:    'B2B',
        isInterstate:  true,
        taxableAmount: 35000,
        cgst:          0,
        sgst:          0,
        igst:          9800,
        totalAmount:   44800,
        items: {
          create: [{
            productId:    'prod-tv-001',
            description:  'Television',
            hsnCode:      '8528',
            quantity:     1,
            unit:         'Nos',
            unitPrice:    35000,
            taxableAmount:35000,
            gstRate:      28,
            cgst:         0,
            sgst:         0,
            igst:         9800,
            totalAmount:  44800,
          }],
        },
      },
    });

    // Purchase with ITC
    await prisma.invoice.create({
      data: {
        businessId:    business.id,
        partyId:       vendor1.id,
        invoiceNumber: 'PUR-0001',
        invoiceDate:   new Date('2025-03-02'),
        invoiceType:   'PURCHASE',
        supplyType:    'B2B',
        isInterstate:  false,
        taxableAmount: 50000,
        cgst:          4500,
        sgst:          4500,
        igst:          0,
        totalAmount:   59000,
        itcEligible:   true,
        itcCgst:       4500,
        itcSgst:       4500,
        itcIgst:       0,
        items: {
          create: [{
            description:  'Ceiling Fan (bulk)',
            hsnCode:      '8414',
            quantity:     25,
            unit:         'Nos',
            unitPrice:    2000,
            taxableAmount:50000,
            gstRate:      18,
            cgst:         4500,
            sgst:         4500,
            igst:         0,
            totalAmount:  59000,
          }],
        },
      },
    });
    console.log(`✅ Sample invoices created`);
  }

  console.log('\n🎉 Seed complete! Login with mobile: 9876543210, OTP: 123456 (dev mode)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
