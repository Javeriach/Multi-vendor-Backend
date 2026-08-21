/**
 * Seeds the marketplace with 10 real, approved vendor stores and 100+
 * products backed by genuine, verified Unsplash CDN photography — not
 * placeholders. Every image URL below was fetched (HTTP 200) AND visually
 * inspected before being added; a number of plausible-looking Unsplash IDs
 * were discarded during that pass because the photo didn't actually depict
 * the stated product (e.g. a candidate "power bank" photo turned out to be
 * an iPhone/AirPods/Watch flat-lay) — product names here were chosen to
 * match what the photo actually shows, not the other way around.
 *
 * Drives the real HTTP API end to end (register -> onboard -> admin-approve
 * -> create products -> publish), exactly like a real vendor onboarding
 * would, so every business rule (slug uniqueness, SKU uniqueness, vendor
 * approval gating, etc.) is exercised rather than bypassed.
 *
 * Idempotent and safe to re-run anywhere, including production:
 *  - Categories are reused if they already exist (matched by slug).
 *  - Vendor users log in instead of re-registering if already present.
 *  - Vendor records are fetched instead of re-created if already onboarded.
 *  - Products are skipped (not duplicated) if their SKU already exists.
 * So running this against a database that already has some/all of this
 * data is a no-op for what's already there and only creates what's missing.
 *
 * Requires the backend to be reachable and an ADMIN account to exist with
 * the admin role already granted (see scripts/promote-admin.js — there is
 * deliberately no API path to self-promote to admin).
 *
 * Usage:
 *   node scripts/seed-vendors.js
 *
 * Against production, point it at the real API and use real admin
 * credentials instead of the local defaults — never commit real prod
 * credentials into this file or a shell history:
 *   API_URL=https://api.yourdomain.com/api \
 *   ADMIN_EMAIL=admin@yourdomain.com \
 *   ADMIN_PASSWORD='...' \
 *   node scripts/seed-vendors.js
 */
const BASE = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Passw0rd123';
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD || 'Passw0rd123';

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

/** Every URL below was fetched (HTTP 200) and visually confirmed to depict
 * the stated subject before being used — not placeholder/stock-icon images. */
const IMG = {
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80&auto=format&fit=crop',
  headphonesPremium: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1200&q=80&auto=format&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&q=80&auto=format&fit=crop',
  techFlatlay: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1200&q=80&auto=format&fit=crop',
  smartwatchWhite: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80&auto=format&fit=crop',
  smartwatchBlack: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&q=80&auto=format&fit=crop',
  smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80&auto=format&fit=crop',
  gamepad: 'https://images.unsplash.com/photo-1605901309584-818e25960a8f?w=1200&q=80&auto=format&fit=crop',
  headphonesWired: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1200&q=80&auto=format&fit=crop',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1200&q=80&auto=format&fit=crop',
  mouse: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=1200&q=80&auto=format&fit=crop',
  allInOneDesktop: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=1200&q=80&auto=format&fit=crop',
  tabletStylus: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1200&q=80&auto=format&fit=crop',
  btSpeaker: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1200&q=80&auto=format&fit=crop',
  networkSwitch: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&q=80&auto=format&fit=crop',
  drone: 'https://images.unsplash.com/photo-1508444845599-5c89863b1c44?w=1200&q=80&auto=format&fit=crop',
  vrHeadset: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=1200&q=80&auto=format&fit=crop',
  deviceBundle: 'https://images.unsplash.com/photo-1609692814858-f7cd2f0afa4f?w=1200&q=80&auto=format&fit=crop',
  earbuds: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=1200&q=80&auto=format&fit=crop',
  dslrCamera: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&q=80&auto=format&fit=crop',
  smartHomeSpeaker: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=1200&q=80&auto=format&fit=crop',
  slimLaptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=80&auto=format&fit=crop',

  leatherJacket: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1200&q=80&auto=format&fit=crop',
  sneakersPastel: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=80&auto=format&fit=crop',
  sneakersRed: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=80&auto=format&fit=crop',
  handbag: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200&q=80&auto=format&fit=crop',
  watch: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=1200&q=80&auto=format&fit=crop',
  sunglasses: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200&q=80&auto=format&fit=crop',
  tshirt: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80&auto=format&fit=crop',
  dress: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80&auto=format&fit=crop',
  jeans: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=1200&q=80&auto=format&fit=crop',
  hoodie: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=80&auto=format&fit=crop',
  scarf: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1200&q=80&auto=format&fit=crop',
  dadCap: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=1200&q=80&auto=format&fit=crop',
  boots: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=1200&q=80&auto=format&fit=crop',
  wallet: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=1200&q=80&auto=format&fit=crop',
  necktie: 'https://images.unsplash.com/photo-1589756823695-278bc923f962?w=1200&q=80&auto=format&fit=crop',
  novSocks: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=1200&q=80&auto=format&fit=crop',
  runningShoes: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=1200&q=80&auto=format&fit=crop',
  sandals: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=1200&q=80&auto=format&fit=crop',
  toteBag: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=1200&q=80&auto=format&fit=crop',

  sofa: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80&auto=format&fit=crop',
  blender: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=1200&q=80&auto=format&fit=crop',
  coffeeBeans: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=1200&q=80&auto=format&fit=crop',
  wallClock: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=1200&q=80&auto=format&fit=crop',
  floorLamp: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80&auto=format&fit=crop',
  bedsideLamp: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&q=80&auto=format&fit=crop',
  throwPillow: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1200&q=80&auto=format&fit=crop',
  barStool: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=1200&q=80&auto=format&fit=crop',
  bookshelf: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=1200&q=80&auto=format&fit=crop',
  pendantLight: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=1200&q=80&auto=format&fit=crop',
  succulentPot: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=1200&q=80&auto=format&fit=crop',
  woodVase: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=1200&q=80&auto=format&fit=crop',
  coffeeMug: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1200&q=80&auto=format&fit=crop',
  studyDesk: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=1200&q=80&auto=format&fit=crop',
  loveseat: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=1200&q=80&auto=format&fit=crop',
  gardenBed: 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=1200&q=80&auto=format&fit=crop',
  trowel: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80&auto=format&fit=crop',
  plantingGloves: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?w=1200&q=80&auto=format&fit=crop',
  chefKnife: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=1200&q=80&auto=format&fit=crop',
  wineGlasses: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80&auto=format&fit=crop',

  yogaMats: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=1200&q=80&auto=format&fit=crop',
  barbell: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80&auto=format&fit=crop',
  backpack: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80&auto=format&fit=crop',
  bicycle: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1200&q=80&auto=format&fit=crop',
  tent: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop',
  basketball: 'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=1200&q=80&auto=format&fit=crop',
  soccerBall: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=1200&q=80&auto=format&fit=crop',
  skateboard: 'https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=1200&q=80&auto=format&fit=crop',
  weightPlates: 'https://images.unsplash.com/photo-1517344368193-41552b6ad3f5?w=1200&q=80&auto=format&fit=crop',
  yogaGroup: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80&auto=format&fit=crop',

  cleanser: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80&auto=format&fit=crop',
  makeupFlatlay1: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1200&q=80&auto=format&fit=crop',
  makeupFlatlay2: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80&auto=format&fit=crop',
  beautyFlatlayPink: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&q=80&auto=format&fit=crop',

  goldBangle: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80&auto=format&fit=crop',
  gemstoneNecklace: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80&auto=format&fit=crop',
  crystalEarrings: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&q=80&auto=format&fit=crop',
  pendantNecklace: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=1200&q=80&auto=format&fit=crop',
  sportsWatch: 'https://images.unsplash.com/photo-1548171915-e79a380a2a4b?w=1200&q=80&auto=format&fit=crop',
  luxuryWatch: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1200&q=80&auto=format&fit=crop',
  analogWatch: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=1200&q=80&auto=format&fit=crop',

  freshVeg: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&q=80&auto=format&fit=crop',
  sourdough: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=80&auto=format&fit=crop',
  pasta: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=1200&q=80&auto=format&fit=crop',
  spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=1200&q=80&auto=format&fit=crop',
  bbqSkewers: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&q=80&auto=format&fit=crop',

  dogChewToy: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200&q=80&auto=format&fit=crop',
  catMat: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1200&q=80&auto=format&fit=crop',
  puppyCollar: 'https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=1200&q=80&auto=format&fit=crop',

  buildingBricks: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=1200&q=80&auto=format&fit=crop',
  toyCar: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=1200&q=80&auto=format&fit=crop',
  bathToy: 'https://images.unsplash.com/photo-1559715541-5daf8a0296d0?w=1200&q=80&auto=format&fit=crop',
  babyOnesie: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=1200&q=80&auto=format&fit=crop',
  giftBox: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=1200&q=80&auto=format&fit=crop',
  giftWrap: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=1200&q=80&auto=format&fit=crop',
  guitar: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=80&auto=format&fit=crop',
  piano: 'https://images.unsplash.com/photo-1552422535-c45813c61732?w=1200&q=80&auto=format&fit=crop',

  booksStack: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=80&auto=format&fit=crop',
  booksOpen: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1200&q=80&auto=format&fit=crop',
  bookMilkHoney: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200&q=80&auto=format&fit=crop',
  vintageBooks: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=1200&q=80&auto=format&fit=crop',
  spiralNotebook: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=1200&q=80&auto=format&fit=crop',
  leatherNotebook: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200&q=80&auto=format&fit=crop',
  stickyNotes: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=1200&q=80&auto=format&fit=crop',
  deskEssentials: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=1200&q=80&auto=format&fit=crop',
};

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', reuseIfExists: true },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
  { name: 'Beauty & Personal Care', slug: 'beauty' },
  { name: 'Jewelry & Watches', slug: 'jewelry-watches' },
  { name: 'Groceries & Gourmet', slug: 'groceries' },
  { name: 'Pet Supplies', slug: 'pet-supplies' },
  { name: 'Toys, Games & Baby', slug: 'toys-games' },
  { name: 'Books, Stationery & Office', slug: 'books-stationery' },
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
      {
        name: 'Wireless Console & Controller Bundle',
        description: 'Home gaming console bundled with a wireless controller.',
        imageUrls: [IMG.gamepad],
        variants: [{ sku: 'THE-CONSOLE-01', price: 349.0, stockQuantity: 12 }],
      },
      {
        name: 'Studio Wired Headphones',
        description: 'On-ear wired headphones tuned for studio monitoring.',
        imageUrls: [IMG.headphonesWired],
        variants: [{ sku: 'THE-HEAD-WIRED', price: 59.99, stockQuantity: 30 }],
      },
      {
        name: 'Wireless Compact Keyboard',
        description: 'Low-profile wireless keyboard with scissor-switch keys.',
        imageUrls: [IMG.keyboard],
        variants: [{ sku: 'THE-KEY-01', price: 69.0, stockQuantity: 35 }],
      },
      {
        name: 'Wireless Gaming Mouse',
        description: 'High-precision wireless mouse with programmable buttons.',
        imageUrls: [IMG.mouse],
        variants: [{ sku: 'THE-MOUSE-01', price: 79.0, discountPrice: 64.0, stockQuantity: 28 }],
      },
      {
        name: '27" All-in-One Desktop Computer',
        description: 'Slim all-in-one desktop with a 27-inch display, ideal for home or office.',
        imageUrls: [IMG.allInOneDesktop],
        variants: [{ sku: 'THE-AIO-27', price: 1399.0, stockQuantity: 8 }],
      },
      {
        name: 'Pro Tablet 11" with Stylus',
        description: '11-inch professional tablet bundled with a pressure-sensitive stylus.',
        imageUrls: [IMG.tabletStylus],
        variants: [{ sku: 'THE-TAB-11', price: 799.0, stockQuantity: 14 }],
      },
      {
        name: 'Portable Bluetooth Speaker',
        description: 'Rugged, water-resistant Bluetooth speaker with deep bass.',
        imageUrls: [IMG.btSpeaker],
        variants: [{ sku: 'THE-SPK-01', price: 99.0, discountPrice: 79.0, stockQuantity: 24 }],
      },
      {
        name: 'Gigabit Network Switch',
        description: '8-port gigabit ethernet switch for home and small-office networks.',
        imageUrls: [IMG.networkSwitch],
        variants: [{ sku: 'THE-NET-01', price: 39.99, stockQuantity: 40 }],
      },
      {
        name: 'Aerial Photography Drone',
        description: 'Camera drone with GPS hold and a 25-minute flight time.',
        imageUrls: [IMG.drone],
        variants: [{ sku: 'THE-DRONE-01', price: 549.0, stockQuantity: 6 }],
      },
      {
        name: 'Wireless VR Headset',
        description: 'Standalone wireless VR headset, no PC or console required.',
        imageUrls: [IMG.vrHeadset],
        variants: [{ sku: 'THE-VR-01', price: 399.0, stockQuantity: 10 }],
      },
      {
        name: 'Smartphone & Wearables Bundle',
        description: 'Flagship phone bundled with true-wireless earbuds and a fitness watch.',
        imageUrls: [IMG.deviceBundle],
        variants: [{ sku: 'THE-BUNDLE-01', price: 1099.0, discountPrice: 949.0, stockQuantity: 9 }],
      },
      {
        name: 'True Wireless Earbuds',
        description: 'Noise-isolating true-wireless earbuds with a compact charging case.',
        imageUrls: [IMG.earbuds],
        variants: [{ sku: 'THE-EARBUD-01', price: 129.0, stockQuantity: 32 }],
      },
      {
        name: 'Digital SLR Camera',
        description: 'Entry-level DSLR camera with an 18-55mm kit lens.',
        imageUrls: [IMG.dslrCamera],
        variants: [{ sku: 'THE-DSLR-01', price: 549.0, stockQuantity: 7 }],
      },
      {
        name: 'Smart Home Speaker',
        description: 'Voice-controlled smart speaker for music and home automation.',
        imageUrls: [IMG.smartHomeSpeaker],
        variants: [{ sku: 'THE-SMARTSPK-01', price: 49.99, stockQuantity: 45 }],
      },
      {
        name: 'Slim Notebook Laptop 13"',
        description: 'Everyday 13-inch notebook laptop with a full-day battery.',
        imageUrls: [IMG.slimLaptop],
        variants: [{ sku: 'THE-LAP-13', price: 699.0, stockQuantity: 16 }],
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
      {
        name: 'Elegant Evening Gown',
        description: 'Flowing floor-length evening gown in rich red satin.',
        imageUrls: [IMG.dress],
        variants: [{ sku: 'UT-GOWN-01', price: 249.0, stockQuantity: 8 }],
      },
      {
        name: 'Classic Straight-Leg Jeans',
        description: 'Mid-rise straight-leg denim in a classic dark wash.',
        imageUrls: [IMG.jeans],
        variants: [{ sku: 'UT-JEAN-01', price: 74.99, stockQuantity: 26 }],
      },
      {
        name: 'Pullover Fleece Hoodie',
        description: 'Heavyweight fleece pullover hoodie with a kangaroo pocket.',
        imageUrls: [IMG.hoodie],
        variants: [{ sku: 'UT-HOOD-01', price: 54.99, stockQuantity: 30 }],
      },
      {
        name: 'Assorted Silk Scarves',
        description: 'Patterned silk scarves, sold as an assorted-print set.',
        imageUrls: [IMG.scarf],
        variants: [{ sku: 'UT-SCARF-01', price: 34.99, stockQuantity: 20 }],
      },
      {
        name: 'Vintage Washed Dad Cap',
        description: 'Garment-washed cotton dad cap with an adjustable strap back.',
        imageUrls: [IMG.dadCap],
        variants: [{ sku: 'UT-CAP-01', price: 24.99, stockQuantity: 38 }],
      },
      {
        name: 'Leather Ankle Boots',
        description: 'Lace-up leather ankle boots with a stacked heel.',
        imageUrls: [IMG.boots],
        variants: [{ sku: 'UT-BOOT-01', price: 139.0, stockQuantity: 16 }],
      },
      {
        name: 'Slim Bifold Leather Wallet',
        description: 'Slim bifold wallet in full-grain leather with card slots.',
        imageUrls: [IMG.wallet],
        variants: [{ sku: 'UT-WALLET-01', price: 44.99, stockQuantity: 30 }],
      },
      {
        name: 'Silk Print Necktie',
        description: 'Woven silk necktie in a classic patterned print.',
        imageUrls: [IMG.necktie],
        variants: [{ sku: 'UT-TIE-01', price: 29.99, stockQuantity: 25 }],
      },
      {
        name: 'Novelty Print Crew Socks',
        description: 'Cotton-blend crew socks in a playful all-over print.',
        imageUrls: [IMG.novSocks],
        variants: [{ sku: 'UT-SOCK-01', price: 12.99, stockQuantity: 50 }],
      },
      {
        name: 'Performance Running Shoes',
        description: 'Lightweight running shoes with responsive cushioning.',
        imageUrls: [IMG.runningShoes],
        variants: [{ sku: 'UT-RUN-01', price: 89.99, discountPrice: 69.99, stockQuantity: 22 }],
      },
      {
        name: 'Two-Strap Buckle Sandals',
        description: 'Contoured cork-footbed sandals with adjustable buckle straps.',
        imageUrls: [IMG.sandals],
        variants: [{ sku: 'UT-SAND-01', price: 49.99, stockQuantity: 24 }],
      },
      {
        name: 'Floral Print Tote Handbag',
        description: 'Structured tote handbag in a floral print with silver hardware.',
        imageUrls: [IMG.toteBag],
        variants: [{ sku: 'UT-TOTE-01', price: 159.0, stockQuantity: 10 }],
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
    description: 'Furniture, kitchenware, garden, and decor for a comfortable home.',
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
      {
        name: 'Modern Bedside Table Lamp',
        description: 'Warm-glow bedside lamp on a compact nightstand.',
        imageUrls: [IMG.bedsideLamp],
        variants: [{ sku: 'CHC-BEDLAMP-01', price: 44.99, stockQuantity: 22 }],
      },
      {
        name: 'Soft Throw Pillow',
        description: 'Plush accent throw pillow with a removable cover.',
        imageUrls: [IMG.throwPillow],
        variants: [{ sku: 'CHC-PILLOW-01', price: 19.99, stockQuantity: 45 }],
      },
      {
        name: 'Wooden Bar Stool',
        description: 'Solid wood counter-height bar stool with a whitewashed finish.',
        imageUrls: [IMG.barStool],
        variants: [{ sku: 'CHC-STOOL-01', price: 89.0, stockQuantity: 14 }],
      },
      {
        name: 'Modern Wall Bookshelf',
        description: 'Floor-to-ceiling modular bookshelf unit in natural oak.',
        imageUrls: [IMG.bookshelf],
        variants: [{ sku: 'CHC-SHELF-01', price: 249.0, stockQuantity: 5 }],
      },
      {
        name: 'Modern Pendant Ceiling Light',
        description: 'Dome-shade pendant light fixture for kitchen islands and dining tables.',
        imageUrls: [IMG.pendantLight],
        variants: [{ sku: 'CHC-PENDANT-01', price: 69.0, stockQuantity: 16 }],
      },
      {
        name: 'Succulent in Ceramic Pot',
        description: 'Low-maintenance potted succulent in a glazed ceramic planter.',
        imageUrls: [IMG.succulentPot],
        variants: [{ sku: 'CHC-SUCC-01', price: 17.99, stockQuantity: 40 }],
      },
      {
        name: 'Wooden Bud Vase Set',
        description: 'Turned-wood bud vase set, sold as a pair.',
        imageUrls: [IMG.woodVase],
        variants: [{ sku: 'CHC-VASE-01', price: 32.0, stockQuantity: 20 }],
      },
      {
        name: 'Ceramic Coffee Mug with Coaster',
        description: 'Stoneware coffee mug paired with a matching wooden coaster.',
        imageUrls: [IMG.coffeeMug],
        variants: [{ sku: 'CHC-MUG-01', price: 14.99, stockQuantity: 55 }],
      },
      {
        name: 'Minimalist Study Desk & Chair Set',
        description: 'Compact writing desk paired with a matching accent chair.',
        imageUrls: [IMG.studyDesk],
        variants: [{ sku: 'CHC-DESK-01', price: 219.0, stockQuantity: 7 }],
      },
      {
        name: 'Rust Orange Accent Loveseat',
        description: 'Compact accent loveseat upholstered in rust-orange fabric.',
        imageUrls: [IMG.loveseat],
        variants: [{ sku: 'CHC-LOVESEAT-01', price: 549.0, stockQuantity: 6 }],
      },
      {
        name: 'Raised Vegetable Garden Planter Box',
        description: 'Cedar raised planter box for growing herbs and vegetables at home.',
        imageUrls: [IMG.gardenBed],
        variants: [{ sku: 'CHC-GARDENBED-01', price: 129.0, stockQuantity: 9 }],
      },
      {
        name: 'Garden Hand Trowel Tool',
        description: 'Stainless-steel hand trowel with an ergonomic soft-grip handle.',
        imageUrls: [IMG.trowel],
        variants: [{ sku: 'CHC-TROWEL-01', price: 12.99, stockQuantity: 60 }],
      },
      {
        name: 'Seedling Planting Gloves',
        description: 'Durable gardening gloves for planting and yard work.',
        imageUrls: [IMG.plantingGloves],
        variants: [{ sku: 'CHC-GLOVES-01', price: 14.99, stockQuantity: 50 }],
      },
      {
        name: 'Professional Chef Knife Set',
        description: '5-piece chef knife set with wooden handles and a carrying roll.',
        imageUrls: [IMG.chefKnife],
        variants: [{ sku: 'CHC-KNIFE-01', price: 89.0, discountPrice: 74.0, stockQuantity: 18 }],
      },
      {
        name: 'Crystal Wine Glass Set',
        description: 'Set of 4 crystal-cut red wine glasses.',
        imageUrls: [IMG.wineGlasses],
        variants: [{ sku: 'CHC-WINE-01', price: 39.99, stockQuantity: 26 }],
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
      {
        name: 'Official Size Basketball',
        description: 'Indoor/outdoor composite-leather basketball, official size and weight.',
        imageUrls: [IMG.basketball],
        variants: [{ sku: 'PG-BBALL-01', price: 29.99, stockQuantity: 40 }],
      },
      {
        name: 'Match Soccer Ball',
        description: 'FIFA-quality-inspired match soccer ball for training and play.',
        imageUrls: [IMG.soccerBall],
        variants: [{ sku: 'PG-SOCCER-01', price: 24.99, stockQuantity: 45 }],
      },
      {
        name: 'Graphic Print Skateboard',
        description: 'Complete skateboard with a colorful graphic deck print.',
        imageUrls: [IMG.skateboard],
        variants: [{ sku: 'PG-SKATE-01', price: 79.99, stockQuantity: 15 }],
      },
      {
        name: 'Olympic Weight Plates Set',
        description: 'Cast-iron olympic weight plate set for barbell training.',
        imageUrls: [IMG.weightPlates],
        variants: [{ sku: 'PG-PLATES-01', price: 219.0, stockQuantity: 10 }],
      },
      {
        name: 'Studio Yoga Mat with Grip',
        description: 'Non-slip studio-grade yoga mat for group fitness classes.',
        imageUrls: [IMG.yogaGroup],
        variants: [{ sku: 'PG-YOGA-STUDIO', price: 39.99, stockQuantity: 28 }],
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
  {
    email: 'sparklestone.vendor@example.com',
    firstName: 'Nida',
    lastName: 'Farooq',
    businessName: 'Sparkle & Stone Jewelry',
    storeName: 'Sparkle & Stone',
    storeSlug: 'sparkle-stone',
    description: 'Fine jewelry and watches for everyday elegance.',
    categorySlug: 'jewelry-watches',
    products: [
      {
        name: 'Vintage Gold Bangle Bracelet',
        description: 'Gold-tone bangle bracelet with a vintage floral engraving.',
        imageUrls: [IMG.goldBangle],
        variants: [{ sku: 'SS-BANGLE-01', price: 79.0, stockQuantity: 20 }],
      },
      {
        name: 'Layered Gemstone Necklace',
        description: 'Double-layer chain necklace with a blue gemstone and crescent pendant.',
        imageUrls: [IMG.gemstoneNecklace],
        variants: [{ sku: 'SS-NECK-01', price: 64.0, stockQuantity: 24 }],
      },
      {
        name: 'Statement Crystal Earrings',
        description: 'Crystal-embellished statement drop earrings.',
        imageUrls: [IMG.crystalEarrings],
        variants: [{ sku: 'SS-EAR-01', price: 49.0, discountPrice: 39.0, stockQuantity: 18 }],
      },
      {
        name: 'Minimalist Pendant Necklace',
        description: 'Delicate gold-plated chain necklace with a small round pendant.',
        imageUrls: [IMG.pendantNecklace],
        variants: [{ sku: 'SS-PENDANT-01', price: 34.99, stockQuantity: 30 }],
      },
      {
        name: 'Sports Chronograph Watch',
        description: 'Dive-style chronograph watch with a stainless steel bracelet.',
        imageUrls: [IMG.sportsWatch],
        variants: [{ sku: 'SS-WATCH-SPORT', price: 189.0, stockQuantity: 12 }],
      },
      {
        name: 'Steel Chronograph Watch',
        description: 'Blue-dial steel chronograph watch with a tachymeter bezel.',
        imageUrls: [IMG.luxuryWatch],
        variants: [{ sku: 'SS-WATCH-STEEL', price: 249.0, discountPrice: 209.0, stockQuantity: 8 }],
      },
      {
        name: 'Classic Analog Wristwatch',
        description: 'Clean-dial classic analog wristwatch with a stainless case.',
        imageUrls: [IMG.analogWatch],
        variants: [{ sku: 'SS-WATCH-CLASSIC', price: 129.0, stockQuantity: 16 }],
      },
    ],
  },
  {
    email: 'freshmarket.vendor@example.com',
    firstName: 'Usman',
    lastName: 'Raza',
    businessName: 'Fresh Market Grocers',
    storeName: 'Fresh Market Grocers',
    storeSlug: 'fresh-market-grocers',
    description: 'Fresh produce, pantry staples, and gourmet groceries.',
    categorySlug: 'groceries',
    products: [
      {
        name: 'Fresh Garden Salad Box',
        description: 'Mixed fresh vegetables and greens, pre-washed and ready to prep.',
        imageUrls: [IMG.freshVeg],
        variants: [{ sku: 'FMG-SALAD-01', price: 12.99, stockQuantity: 30 }],
      },
      {
        name: 'Artisan Sourdough Bread Duo',
        description: 'Two freshly baked artisan sourdough loaves.',
        imageUrls: [IMG.sourdough],
        variants: [{ sku: 'FMG-BREAD-01', price: 9.99, stockQuantity: 25 }],
      },
      {
        name: 'Assorted Italian Pasta Set',
        description: 'Dry pasta set — spaghetti, rigatoni, and tagliatelle.',
        imageUrls: [IMG.pasta],
        variants: [{ sku: 'FMG-PASTA-01', price: 14.5, stockQuantity: 40 }],
      },
      {
        name: 'Whole Spice Collection',
        description: 'Curated collection of whole cooking spices.',
        imageUrls: [IMG.spices],
        variants: [{ sku: 'FMG-SPICE-01', price: 19.99, stockQuantity: 35 }],
      },
      {
        name: 'Gourmet BBQ Skewer Kit',
        description: 'Ready-to-grill skewer platter with dipping sauces.',
        imageUrls: [IMG.bbqSkewers],
        variants: [{ sku: 'FMG-BBQ-01', price: 24.99, stockQuantity: 18 }],
      },
    ],
  },
  {
    email: 'pawsandco.vendor@example.com',
    firstName: 'Hina',
    lastName: 'Qureshi',
    businessName: 'Paws & Co Pet Supplies',
    storeName: 'Paws & Co',
    storeSlug: 'paws-and-co',
    description: 'Toys, collars, and comfort for dogs and cats.',
    categorySlug: 'pet-supplies',
    products: [
      {
        name: 'Durable Dog Chew Toy',
        description: 'Heavy-duty chew toy for medium to large dogs.',
        imageUrls: [IMG.dogChewToy],
        variants: [{ sku: 'PC-CHEW-01', price: 14.99, stockQuantity: 40 }],
      },
      {
        name: 'Cozy Cat Perch Mat',
        description: 'Woven perch mat for cats to sit, stretch, and relax.',
        imageUrls: [IMG.catMat],
        variants: [{ sku: 'PC-CATMAT-01', price: 22.0, stockQuantity: 25 }],
      },
      {
        name: 'Adjustable Puppy Collar',
        description: 'Soft adjustable collar for growing puppies.',
        imageUrls: [IMG.puppyCollar],
        variants: [{ sku: 'PC-COLLAR-01', price: 11.99, stockQuantity: 50 }],
      },
    ],
  },
  {
    email: 'playfulkids.vendor@example.com',
    firstName: 'Fatima',
    lastName: 'Iqbal',
    businessName: 'Playful Kids & Toys',
    storeName: 'Playful Kids & Toys',
    storeSlug: 'playful-kids-toys',
    description: 'Toys, gifts, and hobby instruments for kids and the young at heart.',
    categorySlug: 'toys-games',
    products: [
      {
        name: 'Classic Building Brick Set',
        description: 'Large mixed-color building brick set, compatible with major brands.',
        imageUrls: [IMG.buildingBricks],
        variants: [{ sku: 'PKT-BRICKS-01', price: 39.99, stockQuantity: 30 }],
      },
      {
        name: 'Vintage Model Toy Car',
        description: 'Die-cast vintage convertible model car, collector scale.',
        imageUrls: [IMG.toyCar],
        variants: [{ sku: 'PKT-CAR-01', price: 19.99, stockQuantity: 26 }],
      },
      {
        name: 'Novelty Superhero Bath Toy',
        description: 'Fun superhero-themed rubber bath toy for kids.',
        imageUrls: [IMG.bathToy],
        variants: [{ sku: 'PKT-BATHTOY-01', price: 9.99, stockQuantity: 45 }],
      },
      {
        name: 'Bear Hoodie Baby Onesie',
        description: 'Soft fleece baby onesie with a bear-ear hood.',
        imageUrls: [IMG.babyOnesie],
        variants: [{ sku: 'PKT-ONESIE-01', price: 24.99, stockQuantity: 20 }],
      },
      {
        name: 'Gift Box with Ribbon',
        description: 'Pre-wrapped gift box with a satin ribbon bow.',
        imageUrls: [IMG.giftBox],
        variants: [{ sku: 'PKT-GIFTBOX-01', price: 12.99, stockQuantity: 35 }],
      },
      {
        name: 'Kraft Paper Wrapped Gift Box',
        description: 'Rustic kraft-paper wrapped gift box tied with twine.',
        imageUrls: [IMG.giftWrap],
        variants: [{ sku: 'PKT-GIFTWRAP-01', price: 10.99, stockQuantity: 35 }],
      },
      {
        name: 'Acoustic Guitar',
        description: 'Full-size steel-string acoustic guitar for beginners and hobbyists.',
        imageUrls: [IMG.guitar],
        variants: [{ sku: 'PKT-GUITAR-01', price: 149.0, stockQuantity: 10 }],
      },
      {
        name: 'Upright Piano',
        description: 'Classic upright acoustic piano for home practice.',
        imageUrls: [IMG.piano],
        variants: [{ sku: 'PKT-PIANO-01', price: 1899.0, stockQuantity: 2 }],
      },
    ],
  },
  {
    email: 'papersink.vendor@example.com',
    firstName: 'Ali',
    lastName: 'Rehman',
    businessName: 'Papers & Ink Stationery',
    storeName: 'Papers & Ink',
    storeSlug: 'papers-and-ink',
    description: 'Books, notebooks, and everyday office essentials.',
    categorySlug: 'books-stationery',
    products: [
      {
        name: 'Bestselling Business Books Bundle',
        description: 'Stack of popular business and startup strategy books.',
        imageUrls: [IMG.booksStack],
        variants: [{ sku: 'PNI-BOOKS-BIZ', price: 59.99, stockQuantity: 15 }],
      },
      {
        name: 'Assorted Paperback Book Set',
        description: 'Assorted paperback fiction set, ready for a book club.',
        imageUrls: [IMG.booksOpen],
        variants: [{ sku: 'PNI-BOOKS-PAPER', price: 34.99, stockQuantity: 20 }],
      },
      {
        name: 'Milk and Honey — Poetry Collection',
        description: 'Bestselling poetry collection paperback.',
        imageUrls: [IMG.bookMilkHoney],
        variants: [{ sku: 'PNI-BOOK-POETRY', price: 12.99, stockQuantity: 40 }],
      },
      {
        name: 'Vintage Hardcover Book Set',
        description: 'Curated set of vintage-style hardcover books for shelf styling.',
        imageUrls: [IMG.vintageBooks],
        variants: [{ sku: 'PNI-BOOKS-VINTAGE', price: 44.99, stockQuantity: 12 }],
      },
      {
        name: 'Spiral Notebook & Pen Set',
        description: 'Spiral-bound notebook paired with a gel pen.',
        imageUrls: [IMG.spiralNotebook],
        variants: [{ sku: 'PNI-NOTEBOOK-01', price: 9.99, stockQuantity: 60 }],
      },
      {
        name: 'Classic Leather Notebook & Pen',
        description: 'Refillable leather-cover notebook with a fountain pen.',
        imageUrls: [IMG.leatherNotebook],
        variants: [{ sku: 'PNI-NOTEBOOK-LEATHER', price: 29.99, stockQuantity: 25 }],
      },
      {
        name: 'Idea Sticky Notes Pack',
        description: 'Multi-pack of sticky notes for brainstorming and planning.',
        imageUrls: [IMG.stickyNotes],
        variants: [{ sku: 'PNI-STICKY-01', price: 6.99, stockQuantity: 80 }],
      },
      {
        name: 'Home Office Desk Essentials Set',
        description: 'Desk essentials bundle: notebook, pens, and a mug warmer setup.',
        imageUrls: [IMG.deskEssentials],
        variants: [{ sku: 'PNI-DESKSET-01', price: 49.99, stockQuantity: 18 }],
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
  let totalCreated = 0;

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
      // 409 = vendor record already exists for this user; 403 = this user's
      // role has already moved past "customer" (a prior run already
      // onboarded them, and the create-vendor endpoint only accepts
      // customers). Either way, the vendor record already exists — fetch it
      // instead of failing the whole run.
      if (String(err.message).includes('409') || String(err.message).includes('403')) {
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

    totalCreated += created;
    summary.push({ store: v.storeName, category: v.categorySlug, created, skipped });
  }

  console.log('\n=== Seed summary ===');
  for (const s of summary) {
    console.log(`${s.store} [${s.category}]: ${s.created} product(s) created, ${s.skipped} skipped (already existed)`);
  }
  console.log(`\nTotal new products created this run: ${totalCreated}`);
  console.log(`Total product listings across all vendors: ${VENDORS.reduce((n, v) => n + v.products.length, 0)}`);
}

main().catch((err) => {
  console.error('SEED_FAILED:', err.message);
  process.exit(1);
});
