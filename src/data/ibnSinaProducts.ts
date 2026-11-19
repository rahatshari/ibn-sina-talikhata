import type { Product } from '../types/tally';

export const PRODUCT_SHEET_IMAGE_URL = '/assets/aistudio/IMG-20261118-WA0000_c735ac99.jpg';

export const INITIAL_IBN_SINA_PRODUCTS: Product[] = [
  // Super Star (Left Top - 10 products)
  { id: 'ibn-dexlan', name: 'Dexlan', tier: 'Super Star', boxPrice: 480, packInfo: '1 Box (30 Caps)', active: true },
  { id: 'ibn-linax-plus', name: 'Linax Plus', tier: 'Super Star', boxPrice: 540, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-vitalgin', name: 'Vitalgin', tier: 'Super Star', boxPrice: 320, packInfo: '1 Box (50 Tabs)', active: true },
  { id: 'ibn-oxyfer', name: 'Oxyfer', tier: 'Super Star', boxPrice: 360, packInfo: '1 Box (30 Caps)', active: true },
  { id: 'ibn-linax', name: 'Linax', tier: 'Super Star', boxPrice: 420, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-romycin', name: 'Romycin', tier: 'Super Star', boxPrice: 650, packInfo: '1 Box (20 Tabs)', active: true },
  { id: 'ibn-merotrax', name: 'Merotrax', tier: 'Super Star', boxPrice: 890, packInfo: '1 Box (10 Vials)', active: true },
  { id: 'ibn-newralgin', name: 'Newralgin', tier: 'Super Star', boxPrice: 280, packInfo: '1 Box (50 Tabs)', active: true },
  { id: 'ibn-meroclav', name: 'Meroclav', tier: 'Super Star', boxPrice: 720, packInfo: '1 Box (12 Tabs)', active: true },
  { id: 'ibn-esolok', name: 'Esolok', tier: 'Super Star', boxPrice: 450, packInfo: '1 Box (60 Caps)', active: true },

  // Star Line (Group B - Right Top - 8 products)
  { id: 'ibn-gavisol', name: 'Gavisol', tier: 'Star Line (Group B)', boxPrice: 340, packInfo: '1 Box (20 Sachets)', active: true },
  { id: 'ibn-olmedip', name: 'Olmedip', tier: 'Star Line (Group B)', boxPrice: 510, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-xorel', name: 'Xorel', tier: 'Star Line (Group B)', boxPrice: 390, packInfo: '1 Box (50 Tabs)', active: true },
  { id: 'ibn-dermacom', name: 'Dermacom', tier: 'Star Line (Group B)', boxPrice: 290, packInfo: '1 Box (6 Tubes)', active: true },
  { id: 'ibn-cefixim', name: 'Cefixim', tier: 'Star Line (Group B)', boxPrice: 680, packInfo: '1 Box (14 Caps)', active: true },
  { id: 'ibn-axosin', name: 'Axosin', tier: 'Star Line (Group B)', boxPrice: 560, packInfo: '1 Box (20 Tabs)', active: true },
  { id: 'ibn-montex', name: 'Montex', tier: 'Star Line (Group B)', boxPrice: 440, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-votab', name: 'Votab', tier: 'Star Line (Group B)', boxPrice: 310, packInfo: '1 Box (50 Tabs)', active: true },

  // Priority Star (Left Middle - 8 products)
  { id: 'ibn-moodnor', name: 'Moodnor', tier: 'Priority Star', boxPrice: 350, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-coraltab-dx', name: 'Coraltab-DX', tier: 'Priority Star', boxPrice: 460, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-fexornin', name: 'Fexornin', tier: 'Priority Star', boxPrice: 330, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-lytex', name: 'Lytex', tier: 'Priority Star', boxPrice: 410, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-longpara', name: 'Longpara', tier: 'Priority Star', boxPrice: 240, packInfo: '1 Box (100 Tabs)', active: true },
  { id: 'ibn-bondrix', name: 'Bondrix', tier: 'Priority Star', boxPrice: 520, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-fungicor', name: 'Fungicor', tier: 'Priority Star', boxPrice: 370, packInfo: '1 Box (20 Tabs)', active: true },
  { id: 'ibn-colostat', name: 'Colostat', tier: 'Priority Star', boxPrice: 490, packInfo: '1 Box (30 Tabs)', active: true },

  // Priority Line (Group B - Right Middle - 11 products)
  { id: 'ibn-sinagold', name: 'Sinagold', tier: 'Priority Line (Group B)', boxPrice: 430, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-bilamin', name: 'Bilamin', tier: 'Priority Line (Group B)', boxPrice: 380, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-floromox', name: 'Floromox', tier: 'Priority Line (Group B)', boxPrice: 640, packInfo: '1 Box (10 Tabs)', active: true },
  { id: 'ibn-taglimet', name: 'Taglimet', tier: 'Priority Line (Group B)', boxPrice: 530, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-terbinox', name: 'Terbinox', tier: 'Priority Line (Group B)', boxPrice: 470, packInfo: '1 Box (14 Tabs)', active: true },
  { id: 'ibn-etolac', name: 'Etolac', tier: 'Priority Line (Group B)', boxPrice: 360, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-nupralgin-plus', name: 'Nupralgin Plus', tier: 'Priority Line (Group B)', boxPrice: 300, packInfo: '1 Box (50 Tabs)', active: true },
  { id: 'ibn-myoson', name: 'Myoson', tier: 'Priority Line (Group B)', boxPrice: 390, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-zepiron-plus', name: 'Zepiron Plus', tier: 'Priority Line (Group B)', boxPrice: 340, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-sinaban', name: 'Sinaban', tier: 'Priority Line (Group B)', boxPrice: 270, packInfo: '1 Box (50 Tabs)', active: true },
  { id: 'ibn-restat', name: 'Restat', tier: 'Priority Line (Group B)', boxPrice: 510, packInfo: '1 Box (30 Tabs)', active: true },

  // Promising Star (Left Bottom - 10 products)
  { id: 'ibn-linax-e', name: 'Linax E', tier: 'Promising Star', boxPrice: 580, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-esolok-mups', name: 'Esolok MUPS', tier: 'Promising Star', boxPrice: 520, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-zoline', name: 'Zoline', tier: 'Promising Star', boxPrice: 350, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-micosina', name: 'Micosina', tier: 'Promising Star', boxPrice: 410, packInfo: '1 Box (20 Tabs)', active: true },
  { id: 'ibn-sucrasol', name: 'Sucrasol', tier: 'Promising Star', boxPrice: 330, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-rupamine', name: 'Rupamine', tier: 'Promising Star', boxPrice: 360, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-famas', name: 'Famas', tier: 'Promising Star', boxPrice: 260, packInfo: '1 Box (50 Tabs)', active: true },
  { id: 'ibn-audicom', name: 'Audicom', tier: 'Promising Star', boxPrice: 290, packInfo: '1 Box (10 Drops)', active: true },
  { id: 'ibn-xofyl', name: 'Xofyl', tier: 'Promising Star', boxPrice: 400, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-orabis', name: 'Orabis', tier: 'Promising Star', boxPrice: 310, packInfo: '1 Box (30 Tabs)', active: true },

  // Promising Line (Group B - Right Bottom - 8 products)
  { id: 'ibn-glipatab', name: 'Glipatab', tier: 'Promising Line (Group B)', boxPrice: 460, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-neurega', name: 'Neurega', tier: 'Promising Line (Group B)', boxPrice: 550, packInfo: '1 Box (30 Caps)', active: true },
  { id: 'ibn-luly', name: 'Luly', tier: 'Promising Line (Group B)', boxPrice: 340, packInfo: '1 Box (6 Tubes)', active: true },
  { id: 'ibn-xorel-mups', name: 'Xorel MUPS', tier: 'Promising Line (Group B)', boxPrice: 470, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-cordef', name: 'Cordef', tier: 'Promising Line (Group B)', boxPrice: 420, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-sporagin', name: 'Sporagin', tier: 'Promising Line (Group B)', boxPrice: 490, packInfo: '1 Box (15 Caps)', active: true },
  { id: 'ibn-olmetab', name: 'Olmetab', tier: 'Promising Line (Group B)', boxPrice: 440, packInfo: '1 Box (30 Tabs)', active: true },
  { id: 'ibn-glipatab-m', name: 'Glipatab-M', tier: 'Promising Line (Group B)', boxPrice: 510, packInfo: '1 Box (30 Tabs)', active: true },
];
