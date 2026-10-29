import { normalizeName } from './query.ts'

/** Bundled SVG slug (under `public/thumbs/`). */
export type ThumbSlug = string

export const THUMB_BARCODE_SLUG: Record<string, ThumbSlug> = {
  '8410660098804': 'la-espanola-olive-oil',
}

/** Fixture item ids → bundled slug. */
export const THUMB_ID_SLUG: Record<string, ThumbSlug> = {
  '6a748f67-0a6d-469d-a8f2-497e9bb314bf': 'three-crabs-fish-sauce',
  '40925a6a-317c-463c-b440-ec2485353d86': 'dettol-disinfectant',
  '23590ff7-1465-4bfb-9cb0-de3bf9cb97b9': 'omo-detergent',
  'a040d705-4e09-4ade-b76f-fa28a0c4b279': 'kleenex-toilet-paper',
  'b0fe7662-1b76-4d09-948a-2164edbafd07': 'listerine-mouthwash',
  'b150563d-5136-4ff3-a5ef-21d26d66aa24': 'mitchum-deodorant',
  '3c7f1267-ecf6-41ad-882d-8447bafbd91b': 'dettol-laundry-sanitiser',
  '6dd94741-288f-4255-84d6-2640998c30b3': 'dettol-wipes',
  'b50b979b-028b-455a-9e77-ca31bb91403a': 'glad-bake-paper',
  '77425082-ab4f-4659-ba2b-f8cec2d0b6bd': 'glad-foil',
  '8a78e5de-de74-4d29-9f00-8049774b6c70': 'energizer-batteries',
  '32356f79-13c8-4994-880c-0fd8e097316e': 'moro-olive-oil',
  'cc9db0cf-4341-4da8-a64c-9089c195a9c9': 'colavita-olive-oil',
  'f5ca4cf2-250a-4732-bc97-911632b9d091': 'spiral-tamari',
  'd56fa747-73fe-4cc8-a14f-6f88410ac4a6': 'bertolli-spray',
  '584d372a-036e-4522-9397-8c277f58ae3b': 'mazzetti-balsamic',
  'aaa1b498-cbe2-438c-b037-4c289ed65d52': 'queen-vanilla',
  '9d5fa6d4-4b67-46d8-9307-4ee4934e6b7c': 'chung-jung-ssamjang',
  '9e0a0211-8281-45e0-8fde-cf2d38b10901': 'capriccio-anchovy',
  '72fae4c3-d3d4-4ddf-8ef8-7ddcb2e0e6cd': 'maeil-doenjang',
  'cf888824-7766-4067-823b-f9cceb40cb6c': 'lee-kum-kee-chilli-oil',
}

const THUMB_NAME_SLUG_RAW: Record<string, ThumbSlug> = {
  [normalizeName('Three Crabs Brand Fish Sauce (Việt Hương)')]: 'three-crabs-fish-sauce',
  [normalizeName('Dettol Antibacterial Household Grade Disinfectant')]: 'dettol-disinfectant',
  [normalizeName('OMO Laundry Detergent Washing Powder Front & Top Loader')]: 'omo-detergent',
  [normalizeName('Kleenex Complete Clean Toilet Paper')]: 'kleenex-toilet-paper',
  [normalizeName('Listerine Total Care Zero Alcohol Mouthwash')]: 'listerine-mouthwash',
  [normalizeName('Mitchum Unscented Roll-On Deodorant (Men)')]: 'mitchum-deodorant',
  [normalizeName('Dettol Antibacterial Laundry Sanitiser Fresh Cotton')]: 'dettol-laundry-sanitiser',
  [normalizeName('Dettol Multipurpose Disinfectant Wipes Apple')]: 'dettol-wipes',
  [normalizeName('Glad Bake and Cooking Paper')]: 'glad-bake-paper',
  [normalizeName('Glad Aluminium Foil')]: 'glad-foil',
  [normalizeName('Energizer Max Plus AA Batteries')]: 'energizer-batteries',
  [normalizeName('Moro Primero Extra Virgin Olive Oil')]: 'moro-olive-oil',
  [normalizeName('Colavita Extra Virgin Olive Oil Premium Selection')]: 'colavita-olive-oil',
  [normalizeName('Spiral Organic Tamari (wheat-free soy sauce)')]: 'spiral-tamari',
  [normalizeName('Bertolli Light Taste Olive Oil Spray')]: 'bertolli-spray',
  [normalizeName('Mazzetti Gourmet Glaze with Balsamic Vinegar of Modena (Original)')]:
    'mazzetti-balsamic',
  [normalizeName('Queen Organic Vanilla Bean Paste with Seeds')]: 'queen-vanilla',
  [normalizeName('Chung Jung One Seasoned Bean Paste (Ssamjang)')]: 'chung-jung-ssamjang',
  [normalizeName('Capriccio Classic Anchovy Fillets in Olive Oil')]: 'capriccio-anchovy',
  [normalizeName('Maeil Traditional Doenjang Gold (Soybean Paste)')]: 'maeil-doenjang',
  [normalizeName('Lee Kum Kee Chiu Chow Style Chilli Oil')]: 'lee-kum-kee-chilli-oil',
  [normalizeName('Koala Eco Brighten & Whiten Oxygenated Bleach (Fragrance Free)')]:
    'koala-eco-bleach',
  [normalizeName('La Española Extra Virgin Olive Oil')]: 'la-espanola-olive-oil',
  [normalizeName('Finish Rinse Aid')]: 'finish-rinse-aid',
  [normalizeName('Finish Quantum Tablets')]: 'finish-quantum-tablets',
  [normalizeName('Sorbent Facial Tissues')]: 'sorbent-tissues',
  [normalizeName('Morning Fresh Dishwashing Liquid')]: 'morning-fresh-dishwashing',
  [normalizeName('Palmolive Hand Wash')]: 'palmolive-hand-wash',
  [normalizeName("Ajax Spray n' Wipe")]: 'ajax-spray-wipe',
  [normalizeName('Pine O Cleen Disinfectant')]: 'pine-o-cleen',
  [normalizeName('Quilton Paper Towel')]: 'quilton-paper-towel',
  [normalizeName('Glad Chux Superwipes')]: 'glad-chux-superwipes',
  [normalizeName("Bosisto's Eucalyptus Spray")]: 'bosistos-eucalyptus',
  [normalizeName('Mortein Surface Spray')]: 'mortein-surface-spray',
  [normalizeName('White King Bleach')]: 'white-king-bleach',
  [normalizeName('Handee Ultra Paper Towel')]: 'handee-paper-towel',
  [normalizeName('Aerogard Odourless')]: 'aerogard-odourless',
}

export function slugForItemName(name: string): ThumbSlug | null {
  const key = normalizeName(name)
  return THUMB_NAME_SLUG_RAW[key] ?? null
}

export function bundledThumbUrl(slug: ThumbSlug): string {
  const base = import.meta.env.BASE_URL
  return `${base}thumbs/${slug}.svg`
}

export function slugForItem(
  item: Pick<{ id: string; name: string; barcode: string }, 'id' | 'name' | 'barcode'>,
): ThumbSlug | null {
  if (item.id && THUMB_ID_SLUG[item.id]) return THUMB_ID_SLUG[item.id]
  const code = item.barcode?.trim()
  if (code && THUMB_BARCODE_SLUG[code]) return THUMB_BARCODE_SLUG[code]
  return slugForItemName(item.name)
}
