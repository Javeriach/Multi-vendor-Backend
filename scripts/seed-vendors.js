/**
 * Seeds the marketplace with several real, approved vendor stores and
 * genuine product photography (verified, real Unsplash CDN images — not
 * placeholders) so the storefront has realistic multi-vendor data to browse.
 *
 * Drives the real HTTP API end to end (register -> onboard -> admin-approve
 * -> create products -> publish), exactly like a real vendor onboarding
 * would, so every business rule (slug uniqueness, SKU uniqueness, vendor
 * approval gating, etc.) is exercised rather than bypassed. Requires the
 * backend dev server to be running and an existing admin account.
 *
 * Usage: node scripts/seed-vendors.js
 */
const BASE = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Passw0rd123';
const VENDOR_PASSWORD = 'Passw0rd123';

function makeSession() {
  let cookie = null;
  return async function request(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  };
}

/** Every URL below was fetched and verified (HTTP 200, real JPEG bytes,
 * visually confirmed to depict the stated subject) before being used. */
const IMG = {
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80&auto=format&fit=crop',
  headphonesPremium: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1200&q=80&auto=format&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&q=80&auto=format&fit=crop',
  techFlatlay: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1200&q=80&auto=format&fit=crop',
  smartwatchWhite: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80&auto=format&fit=crop',
  smartwatchBlack: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&q=80&auto=format&fit=crop',
  smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80&auto=format&fit=crop',

  leatherJacket: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1200&q=80&auto=format&fit=crop',
  sneakersPastel: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=80&auto=format&fit=crop',
  sneakersRed: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=80&auto=format&fit=crop',
  handbag: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200&q=80&auto=format&fit=crop',
  watch: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=1200&q=80&auto=format&fit=crop',
  sunglasses: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200&q=80&auto=format&fit=crop',
  tshirt: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80&auto=format&fit=crop',

  sofa: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80&auto=format&fit=crop',
  blender: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=1200&q=80&auto=format&fit=crop',
  coffeeBeans: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=1200&q=80&auto=format&fit=crop',
  wallClock: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=1200&q=80&auto=format&fit=crop',
  floorLamp: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80&auto=format&fit=crop',

  yogaMats: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=1200&q=80&auto=format&fit=crop',
  barbell: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80&auto=format&fit=crop',
  backpack: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80&auto=format&fit=crop',
  bicycle: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1200&q=80&auto=format&fit=crop',
  tent: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop',

  cleanser: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80&auto=format&fit=crop',
  makeupFlatlay1: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1200&q=80&auto=format&fit=crop',
  makeupFlatlay2: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80&auto=format&fit=crop',
  beautyFlatlayPink: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&q=80&auto=format&fit=crop',
};

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', reuseIfExists: true },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
  { name: 'Beauty & Personal Care', slug: 'beauty' },
];

const VENDORS = [
  {
    email: 'techhub.vendor@example.com',
    firstName: 'Ayesha',
    lastName: 'Malik',
    businessName: 'TechHub Electronics LLC',
    storeName: 'TechHub Electronics',
    storeSlug: 'techhub-electronics',
    description: 'Curated consumer electronics — audio, wearables, and computing.',
    categorySlug: 'electronics',
    products: [
      {
        name: 'Wireless Bluetooth Headphones',
        description: 'Over-ear wireless headphones with 30-hour battery life and active noise cancellation.',
        imageUrls: [IMG.headphones, IMG.headphonesPremium],
        variants: [
          { sku: 'THE-HEAD-BLK', attributes: { Color: 'Black' }, price: 89.99, discountPrice: 74.99, stockQuantity: 40 },
          { sku: 'THE-HEAD-SLV', attributes: { Color: 'Silver' }, price: 89.99, stockQuantity: 25 },
        ],
      },
      {
        name: 'Premium Ultrabook Laptop 14"',
        description: 'Lightweight 14-inch ultrabook with all-day battery and a backlit keyboard.',
        imageUrls: [IMG.laptop, IMG.techFlatlay],
        variants: [
          { sku: 'THE-LAP-256', attributes: { Storage: '256GB' }, price: 999.0, stockQuantity: 15 },
          { sku: 'THE-LAP-512', attributes: { Storage: '512GB' }, price: 1249.0, stockQuantity: 10 },
        ],
      },
      {
        name: 'Smart Watch Pro',
        description: 'Fitness tracking smartwatch with heart-rate monitoring and a 7-day battery.',
        imageUrls: [IMG.smartwatchWhite, IMG.smartwatchBlack],
        variants: [
          { sku: 'THE-WATCH-WHT', attributes: { Color: 'White' }, price: 199.0, stockQuantity: 30 },
          { sku: 'THE-WATCH-BLK', attributes: { Color: 'Black' }, price: 199.0, discountPrice: 169.0, stockQuantity: 30 },
        ],
      },
      {
        name: 'Flagship Smartphone 128GB',
        description: 'Latest-generation smartphone with a triple-lens camera system and 5G.',
        imageUrls: [IMG.smartphone],
        variants: [{ sku: 'THE-PHONE-128', price: 799.0, stockQuantity: 20 }],
      },
    ],
  },
  {
    email: 'urbanthreads.vendor@example.com',
    firstName: 'Bilal',
    lastName: 'Ahmed',
    businessName: 'Urban Threads Apparel Co',
    storeName: 'Urban Threads',
    storeSlug: 'urban-threads',
    description: 'Everyday fashion essentials — jackets, footwear, and accessories.',
    categorySlug: 'fashion',
    products: [
      {
        name: 'Classic Leather Jacket',
        description: 'Genuine leather biker jacket with a full zip front and quilted lining.',
        imageUrls: [IMG.leatherJacket],
        variants: [
          { sku: 'UT-JKT-M', attributes: { Size: 'M' }, price: 179.0, stockQuantity: 12 },
          { sku: 'UT-JKT-L', attributes: { Size: 'L' }, price: 179.0, stockQuantity: 10 },
        ],
      },
      {
        name: 'Canvas Low-Top Sneakers',
        description: 'Lightweight everyday sneakers with a cushioned insole.',
        imageUrls: [IMG.sneakersPastel, IMG.sneakersRed],
        variants: [
          { sku: 'UT-SNK-8', attributes: { Size: '8' }, price: 64.99, stockQuantity: 18 },
          { sku: 'UT-SNK-9', attributes: { Size: '9' }, price: 64.99, stockQuantity: 22 },
          { sku: 'UT-SNK-10', attributes: { Size: '10' }, price: 64.99, discountPrice: 49.99, stockQuantity: 15 },
        ],
      },
      {
        name: 'Structured Top-Handle Bag',
        description: 'Structured top-handle handbag in smooth vegan leather with an adjustable strap.',
        imageUrls: [IMG.handbag],
        variants: [{ sku: 'UT-BAG-01', price: 129.0, stockQuantity: 14 }],
      },
      {
        name: 'Classic Leather Strap Watch',
        description: 'Analog watch with a stainless steel case and genuine leather strap.',
        imageUrls: [IMG.watch],
        variants: [{ sku: 'UT-WATCH-01', price: 149.0, discountPrice: 119.0, stockQuantity: 16 }],
      },
      {
        name: 'Wayfarer Sunglasses',
        description: 'UV400-protected polarized sunglasses with a matte acetate frame.',
        imageUrls: [IMG.sunglasses],
        variants: [{ sku: 'UT-SUN-01', price: 39.99, stockQuantity: 35 }],
      },
      {
        name: 'Essential Crew Neck T-Shirt',
        description: '100% combed cotton crew neck t-shirt, tailored fit.',
        imageUrls: [IMG.tshirt],
        variants: [
          { sku: 'UT-TEE-S', attributes: { Size: 'S' }, price: 19.99, stockQuantity: 40 },
          { sku: 'UT-TEE-M', attributes: { Size: 'M' }, price: 19.99, stockQuantity: 40 },
          { sku: 'UT-TEE-L', attributes: { Size: 'L' }, price: 19.99, stockQuantity: 30 },
        ],
      },
    ],
  },
  {
    email: 'cozyhome.vendor@example.com',
    firstName: 'Sara',
    lastName: 'Khan',
    businessName: 'Cozy Home Co',
    storeName: 'Cozy Home Co',
    storeSlug: 'cozy-home-co',
    description: 'Furniture, kitchenware, and decor for a comfortable home.',
    categorySlug: 'home-kitchen',
    products: [
      {
        name: 'Velvet 3-Seater Sofa',
        description: 'Mid-century style 3-seater sofa upholstered in soft velvet with solid wood legs.',
        imageUrls: [IMG.sofa],
        variants: [
          { sku: 'CHC-SOFA-GRN', attributes: { Color: 'Emerald Green' }, price: 899.0, stockQuantity: 6 },
        ],
      },
      {
        name: 'Personal Fruit Blender',
        description: 'Compact countertop blender with a glass jar, perfect for smoothies.',
        imageUrls: [IMG.blender],
        variants: [{ sku: 'CHC-BLEND-01', price: 49.99, stockQuantity: 25 }],
      },
      {
        name: 'Single-Origin Coffee Beans 1kg',
        description: 'Freshly roasted single-origin whole coffee beans, medium roast.',
        imageUrls: [IMG.coffeeBeans],
        variants: [{ sku: 'CHC-COFFEE-1KG', price: 22.5, stockQuantity: 50 }],
      },
      {
        name: 'Minimalist Wall Clock',
        description: 'Silent-sweep wooden wall clock with a minimalist dial.',
        imageUrls: [IMG.wallClock],
        variants: [{ sku: 'CHC-CLOCK-01', price: 34.99, stockQuantity: 20 }],
      },
      {
        name: 'Adjustable Floor Lamp',
        description: 'Matte-finish adjustable floor lamp with a dimmable warm-white bulb.',
        imageUrls: [IMG.floorLamp],
        variants: [{ sku: 'CHC-LAMP-01', price: 79.0, discountPrice: 64.0, stockQuantity: 18 }],
      },
    ],
  },
  {
    email: 'peakgear.vendor@example.com',
    firstName: 'Hamza',
    lastName: 'Tariq',
    businessName: 'Peak Gear Outfitters',
    storeName: 'Peak Gear',
    storeSlug: 'peak-gear',
    description: 'Gear for the gym, the trail, and everywhere in between.',
    categorySlug: 'sports-outdoors',
    products: [
      {
        name: 'Premium Yoga Mat',
        description: 'Extra-thick non-slip yoga mat with a carrying strap.',
        imageUrls: [IMG.yogaMats],
        variants: [
          { sku: 'PG-YOGA-GRY', attributes: { Color: 'Charcoal' }, price: 34.99, stockQuantity: 40 },
          { sku: 'PG-YOGA-RED', attributes: { Color: 'Brick Red' }, price: 34.99, stockQuantity: 30 },
        ],
      },
      {
        name: 'Olympic Barbell Set',
        description: '7ft olympic barbell with a 700lb capacity, knurled grip.',
        imageUrls: [IMG.barbell],
        variants: [{ sku: 'PG-BAR-01', price: 189.0, stockQuantity: 8 }],
      },
      {
        name: 'Hiking Daypack 25L',
        description: 'Water-resistant 25L daypack with a padded laptop sleeve and hydration port.',
        imageUrls: [IMG.backpack],
        variants: [{ sku: 'PG-PACK-25L', price: 59.99, stockQuantity: 22 }],
      },
      {
        name: 'Fixed-Gear Bicycle',
        description: 'Steel-frame fixed-gear commuter bicycle, single speed.',
        imageUrls: [IMG.bicycle],
        variants: [{ sku: 'PG-BIKE-01', price: 449.0, stockQuantity: 5 }],
      },
      {
        name: '2-Person Camping Tent',
        description: 'Lightweight 3-season 2-person tent, sets up in under 5 minutes.',
        imageUrls: [IMG.tent],
        variants: [{ sku: 'PG-TENT-2P', price: 129.0, discountPrice: 99.0, stockQuantity: 12 }],
      },
    ],
  },
  {
    email: 'glowbeauty.vendor@example.com',
    firstName: 'Zara',
    lastName: 'Sheikh',
    businessName: 'Glow Beauty Studio',
    storeName: 'Glow Beauty',
    storeSlug: 'glow-beauty',
    description: 'Skincare and makeup essentials for every routine.',
    categorySlug: 'beauty',
    products: [
      {
        name: 'Daily Gentle Facial Cleanser',
        description: 'Fragrance-free daily cleanser suitable for sensitive skin.',
        imageUrls: [IMG.cleanser],
        variants: [{ sku: 'GB-CLNS-01', price: 24.0, stockQuantity: 45 }],
      },
      {
        name: 'Pro Makeup Essentials Kit',
        description: 'Everything-you-need makeup kit: eyeshadow palette, brushes, and foundation.',
        imageUrls: [IMG.makeupFlatlay1],
        variants: [{ sku: 'GB-KIT-01', price: 89.0, discountPrice: 69.0, stockQuantity: 15 }],
      },
      {
        name: 'Everyday Vanity Set',
        description: 'Compact everyday makeup set with a bronzer, concealer, and mascara.',
        imageUrls: [IMG.makeupFlatlay2],
        variants: [{ sku: 'GB-VANITY-01', price: 54.0, stockQuantity: 20 }],
      },
      {
        name: 'Beauty Brush & Lip Set',
        description: 'Makeup brush set paired with a matte lipstick and compact mirror.',
        imageUrls: [IMG.beautyFlatlayPink],
        variants: [{ sku: 'GB-BRUSH-01', price: 39.0, stockQuantity: 28 }],
      },
    ],
  },
];

async function main() {
  console.log(`Seeding against ${BASE}`);

  const admin = makeSession();
  await admin('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log(`Logged in as admin (${ADMIN_EMAIL})`);

  const existingCategories = await admin('GET', '/categories');
  const categoryBySlug = new Map(existingCategories.map((c) => [c.slug, c]));

  for (const cat of CATEGORIES) {
    if (categoryBySlug.has(cat.slug)) {
      console.log(`Category "${cat.slug}" already exists — reusing`);
      continue;
    }
    const created = await admin('POST', '/categories', { name: cat.name, slug: cat.slug });
    categoryBySlug.set(cat.slug, created);
    console.log(`Created category "${cat.slug}"`);
  }

  const summary = [];

  for (const v of VENDORS) {
    const category = categoryBySlug.get(v.categorySlug);
    if (!category) throw new Error(`Category "${v.categorySlug}" not found for vendor ${v.storeName}`);

    const session = makeSession();

    let userAlreadyExisted = false;
    try {
      await session('POST', '/auth/register', {
        email: v.email,
        password: VENDOR_PASSWORD,
        firstName: v.firstName,
        lastName: v.lastName,
      });
    } catch (err) {
      if (String(err.message).includes('409')) {
        userAlreadyExisted = true;
        await session('POST', '/auth/login', { email: v.email, password: VENDOR_PASSWORD });
      } else {
        throw err;
      }
    }
    console.log(`${userAlreadyExisted ? 'Logged in existing' : 'Registered'} vendor user: ${v.email}`);

    let vendorRecord;
    try {
      vendorRecord = await session('POST', '/vendors', {
        businessName: v.businessName,
        storeName: v.storeName,
        storeSlug: v.storeSlug,
        description: v.description,
      });
    } catch (err) {
      if (String(err.message).includes('409')) {
        // Already onboarded from a previous run of this script — fetch it.
        vendorRecord = await session('GET', '/vendors/me');
      } else {
        throw err;
      }
    }
    console.log(`Onboarded store "${v.storeName}" (vendor ${vendorRecord.id}, status: ${vendorRecord.status})`);

    if (vendorRecord.status !== 'approved') {
      await admin('PATCH', `/admin/vendors/${vendorRecord.id}/status`, { status: 'approved' });
      console.log(`Approved vendor "${v.storeName}"`);
    } else {
      console.log(`Vendor "${v.storeName}" already approved`);
    }

    let created = 0;
    let skipped = 0;
    for (const p of v.products) {
      const sku = p.variants[0].sku;
      let product;
      try {
        product = await session('POST', '/vendor/products', {
          name: p.name,
          description: p.description,
          categoryId: category.id,
          imageUrls: p.imageUrls,
          variants: p.variants,
        });
        created++;
      } catch (err) {
        if (String(err.message).includes('409')) {
          skipped++;
          console.log(`  Skipping "${p.name}" — SKU "${sku}" already exists`);
          continue;
        }
        throw err;
      }
      await session('PATCH', `/vendor/products/${product.id}`, { status: 'active' });
      console.log(`  Created + published "${p.name}" (${p.variants.length} variant(s))`);
    }

    summary.push({ store: v.storeName, category: v.categorySlug, created, skipped });
  }

  console.log('\n=== Seed summary ===');
  for (const s of summary) {
    console.log(`${s.store} [${s.category}]: ${s.created} product(s) created, ${s.skipped} skipped (already existed)`);
  }
}

main().catch((err) => {
  console.error('SEED_FAILED:', err.message);
  process.exit(1);
});
