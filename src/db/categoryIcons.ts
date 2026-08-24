// Maps a seeded category's name to its icon file under public/icons/.
// Custom user-created categories won't have an entry — CategoryBadge falls
// back to a lettermark for those.
export const CATEGORY_ICON_SLUGS: Record<string, string> = {
  'Comida y Bebida': 'comida-y-bebida',
  Transporte: 'transporte',
  'Salud y Bienestar': 'salud-y-bienestar',
  Compras: 'compras',
  Entretenimiento: 'entretenimiento',
  Administrativo: 'administrativo',
  Otros: 'otros',
  Sueldo: 'sueldo',
  Freelance: 'freelance',
  Bonos: 'bonos',
  'Regalos / dinero recibido': 'regalos',
  Rendimientos: 'rendimientos',
  'Otros ingresos': 'otros-ingresos',

  // Subcategories
  Terapia: 'terapia',
  'Self Care': 'self-care',
  Deporte: 'deporte',
  Gasolina: 'gasolina',
  'Uber/Didi': 'uber-didi',
  'Transporte público': 'transporte-publico',
  Estacionamiento: 'estacionamiento',
  Mantenimiento: 'mantenimiento',
  Groceries: 'groceries',
  Restaurantes: 'restaurantes',
  'Bares y bebidas': 'bares-y-bebidas',
  Delivery: 'delivery',
  'Documentos y licencias': 'documentos-y-licencias',
  Impuestos: 'impuestos',
  'Eventos en vivo': 'eventos-en-vivo',
  Suscripciones: 'suscripciones',
  'Salidas nocturnas': 'salidas-nocturnas',
  Cine: 'cine',
  Hogar: 'hogar',
  'Ropa y accesorios': 'ropa-y-accesorios',
  Gadgets: 'gadgets',
  // "Regalos" here is the Compras subcategory (buying gifts) — distinct slug from
  // the "Regalos / dinero recibido" income category above (gifts received).
  Regalos: 'regalos-compras',
}
