import { db } from './firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

export interface PharmacyProduct {
  code: string;
  barcode: string;
  name: string;
  formDosage: string;
  category: string;
  brand: string;
  stockLevel: number;
  minStock: number;
  purchasePriceUSD: number;
  price: number;
  equivCDF: number;
  status: 'OK' | 'ALERTE' | 'RUPTURE';
  unit: string;
  prescriptionRequired: boolean;
  expiryDate: string;
  lotNumber: string;
}

export const initialMedicines: PharmacyProduct[] = [
  {
    code: 'MED0001',
    barcode: '3400936192841',
    name: 'Paracétamol Sirop 2.4% (120ml)',
    formDosage: 'Sirop pédiatrique · 2.4% Flacon 120ml',
    category: 'Antalgique / Antipyrétique',
    brand: 'Laboratoires Sanofi',
    stockLevel: 24,
    minStock: 10,
    purchasePriceUSD: 1.80,
    price: 3.50,
    equivCDF: 7800,
    status: 'OK',
    unit: 'Flacon',
    prescriptionRequired: false,
    expiryDate: '2027-08-15',
    lotNumber: 'LT-24081'
  },
  {
    code: 'MED0002',
    barcode: '3400935824910',
    name: 'Doliprane 1g Effervescent (Boîte de 8)',
    formDosage: 'Comprimés effervescents · 1000mg',
    category: 'Antalgique / Antipyrétique',
    brand: 'Sanofi Aventis',
    stockLevel: 32,
    minStock: 15,
    purchasePriceUSD: 2.20,
    price: 4.50,
    equivCDF: 10000,
    status: 'OK',
    unit: 'Boîte',
    prescriptionRequired: false,
    expiryDate: '2028-02-28',
    lotNumber: 'DOL-9921'
  },
  {
    code: 'MED0003',
    barcode: '3400933709219',
    name: 'Clamoxyl 500mg Gélules (Amoxicilline)',
    formDosage: 'Gélules orales · 500mg Bte de 12',
    category: 'Antibiotique (Pénicilline)',
    brand: 'GSK GlaxoSmithKline',
    stockLevel: 4,
    minStock: 12,
    purchasePriceUSD: 5.40,
    price: 9.80,
    equivCDF: 21850,
    status: 'ALERTE',
    unit: 'Boîte',
    prescriptionRequired: true,
    expiryDate: '2027-01-10',
    lotNumber: 'AMX-4412'
  },
  {
    code: 'MED0004',
    barcode: '3400934123519',
    name: 'Gaviscon Sirop Suspension Buvable (250ml)',
    formDosage: 'Suspension gastrique · 250ml Flacon',
    category: 'Gastro-entérologie / Anti-reflux',
    brand: 'Reckitt Benckiser',
    stockLevel: 18,
    minStock: 8,
    purchasePriceUSD: 4.10,
    price: 7.20,
    equivCDF: 16050,
    status: 'OK',
    unit: 'Flacon',
    prescriptionRequired: false,
    expiryDate: '2027-11-20',
    lotNumber: 'GAV-7731'
  },
  {
    code: 'MED0005',
    barcode: '3400931298456',
    name: 'Ibucap Forte Capsules (Ibuprofène + Caféine)',
    formDosage: 'Capsules molles · 400mg/30mg',
    category: 'Anti-inflammatoire / Antalgique',
    brand: 'Denk Pharma',
    stockLevel: 14,
    minStock: 10,
    purchasePriceUSD: 3.20,
    price: 6.00,
    equivCDF: 13380,
    status: 'OK',
    unit: 'Plaquette',
    prescriptionRequired: false,
    expiryDate: '2027-06-30',
    lotNumber: 'IBU-1082'
  },
  {
    code: 'MED0006',
    barcode: '3400936543210',
    name: 'Cipronat 750mg Comprimés Pelliculés',
    formDosage: 'Comprimés pelliculés · 750mg Bte de 10',
    category: 'Antibiotique (Fluoroquinolone)',
    brand: 'Novartis Pharma',
    stockLevel: 2,
    minStock: 8,
    purchasePriceUSD: 8.50,
    price: 14.50,
    equivCDF: 32300,
    status: 'ALERTE',
    unit: 'Boîte',
    prescriptionRequired: true,
    expiryDate: '2026-12-15',
    lotNumber: 'CPN-0091'
  },
  {
    code: 'MED0007',
    barcode: '3400938765432',
    name: 'Cipro Denk 500mg Comprimés',
    formDosage: 'Comprimés pelliculés · 500mg Bte de 10',
    category: 'Antibiotique (Fluoroquinolone)',
    brand: 'Denk Pharma',
    stockLevel: 0,
    minStock: 10,
    purchasePriceUSD: 6.00,
    price: 11.00,
    equivCDF: 24530,
    status: 'RUPTURE',
    unit: 'Boîte',
    prescriptionRequired: true,
    expiryDate: '2026-10-01',
    lotNumber: 'CDK-5541'
  },
  {
    code: 'MED0008',
    barcode: '3400932109876',
    name: 'Supradyn Effervescent Multivitamines',
    formDosage: 'Comprimés effervescents · Tube de 30',
    category: 'Vitamines & Minéraux',
    brand: 'Bayer Santé',
    stockLevel: 19,
    minStock: 6,
    purchasePriceUSD: 5.80,
    price: 9.50,
    equivCDF: 21180,
    status: 'OK',
    unit: 'Tube',
    prescriptionRequired: false,
    expiryDate: '2028-04-18',
    lotNumber: 'SUP-3302'
  },
  {
    code: 'MED0009',
    barcode: '3400937654321',
    name: 'Dermobacter 125ml Solution Antiseptique',
    formDosage: 'Solution cutanée moussante · Flacon 125ml',
    category: 'Dermatologie / Antiseptique',
    brand: 'Laboratoires Innotech',
    stockLevel: 22,
    minStock: 8,
    purchasePriceUSD: 2.80,
    price: 5.20,
    equivCDF: 11600,
    status: 'OK',
    unit: 'Flacon',
    prescriptionRequired: false,
    expiryDate: '2027-09-01',
    lotNumber: 'DRM-8812'
  },
  {
    code: 'MED0010',
    barcode: '3400939876543',
    name: 'Profenid 100mg Suppositoires (Kétoprofène)',
    formDosage: 'Suppositoires adultes · 100mg Bte de 10',
    category: 'Anti-inflammatoire non stéroïdien (AINS)',
    brand: 'Sanofi Winthrop',
    stockLevel: 8,
    minStock: 6,
    purchasePriceUSD: 4.20,
    price: 7.80,
    equivCDF: 17400,
    status: 'OK',
    unit: 'Boîte',
    prescriptionRequired: true,
    expiryDate: '2027-03-25',
    lotNumber: 'PRF-4430'
  },
  {
    code: 'MED0011',
    barcode: '3400934567890',
    name: 'Oroken 200mg Comprimés (Céfixime)',
    formDosage: 'Comprimés pelliculés · 200mg Bte de 8',
    category: 'Antibiotique (Céphalosporine 3G)',
    brand: 'Sanofi Aventis',
    stockLevel: 11,
    minStock: 5,
    purchasePriceUSD: 11.20,
    price: 18.50,
    equivCDF: 41250,
    status: 'OK',
    unit: 'Boîte',
    prescriptionRequired: true,
    expiryDate: '2027-07-12',
    lotNumber: 'ORO-1120'
  },
  {
    code: 'MED0012',
    barcode: '3400935678901',
    name: 'Cether L Ad Comprimés (Artéméther + Luméfantrine)',
    formDosage: 'Comprimés antipaludiques · 20/120mg Bte de 24',
    category: 'Antipaludéen ACT',
    brand: 'Cipla Therapeutics',
    stockLevel: 16,
    minStock: 8,
    purchasePriceUSD: 4.00,
    price: 8.00,
    equivCDF: 17840,
    status: 'OK',
    unit: 'Boîte',
    prescriptionRequired: false,
    expiryDate: '2027-05-30',
    lotNumber: 'CTH-6650'
  }
];

export const seedDatabase = async (siteId: string) => {
  const inventoryRef = collection(db, 'sites', siteId, 'inventory');
  const lotsRef = collection(db, 'sites', siteId, 'lots');

  for (const item of initialMedicines) {
    const docId = item.code.toLowerCase();
    const productRef = doc(inventoryRef, docId);
    await setDoc(productRef, {
      code: item.code,
      barcode: item.barcode,
      name: item.name,
      formDosage: item.formDosage,
      category: item.category,
      brand: item.brand,
      stockLevel: item.stockLevel,
      minStock: item.minStock,
      purchasePriceUSD: item.purchasePriceUSD,
      price: item.price,
      equivCDF: item.equivCDF,
      unit: item.unit,
      prescriptionRequired: item.prescriptionRequired,
      expiryDate: item.expiryDate,
      lotNumber: item.lotNumber,
      updatedAt: new Date().toISOString()
    });

    // Also populate corresponding lot
    const lotRef = doc(lotsRef, item.lotNumber.toLowerCase());
    await setDoc(lotRef, {
      id: item.lotNumber,
      productId: item.code,
      productName: item.name,
      expiryDate: item.expiryDate,
      quantity: item.stockLevel,
      status: item.stockLevel === 0 ? 'RUPTURE' : (item.stockLevel < item.minStock ? 'ALERTE' : 'OK')
    });
  }
};
