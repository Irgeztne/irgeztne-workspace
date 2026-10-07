export const VERSION = '0.2.0';
export const PORT = Number(process.env.IRGEZTNE_DATA_PORT || 8788);
export const REFRESH_MS = Number(process.env.IRGEZTNE_REFRESH_MS || 6 * 60 * 60 * 1000);

export const COUNTRIES = [
  { id: 'US', entityId: 'country.US', wb: 'USA', bis: 'US', currency: 'USD', name: { ru: 'США', en: 'United States' } },
  { id: 'XM', entityId: 'region.XM', wb: 'EMU', bis: 'XM', currency: 'EUR', name: { ru: 'Еврозона', en: 'Euro area' } },
  { id: 'GB', entityId: 'country.GB', wb: 'GBR', bis: 'GB', currency: 'GBP', name: { ru: 'Великобритания', en: 'United Kingdom' } },
  { id: 'JP', entityId: 'country.JP', wb: 'JPN', bis: 'JP', currency: 'JPY', name: { ru: 'Япония', en: 'Japan' } },
  { id: 'CN', entityId: 'country.CN', wb: 'CHN', bis: 'CN', currency: 'CNY', name: { ru: 'Китай', en: 'China' } },
  { id: 'IN', entityId: 'country.IN', wb: 'IND', bis: 'IN', currency: 'INR', name: { ru: 'Индия', en: 'India' } },
  { id: 'CA', entityId: 'country.CA', wb: 'CAN', bis: 'CA', currency: 'CAD', name: { ru: 'Канада', en: 'Canada' } },
  { id: 'BR', entityId: 'country.BR', wb: 'BRA', bis: 'BR', currency: 'BRL', name: { ru: 'Бразилия', en: 'Brazil' } },
  { id: 'AU', entityId: 'country.AU', wb: 'AUS', bis: 'AU', currency: 'AUD', name: { ru: 'Австралия', en: 'Australia' } },
  { id: 'CH', entityId: 'country.CH', wb: 'CHE', bis: 'CH', currency: 'CHF', name: { ru: 'Швейцария', en: 'Switzerland' } },
  { id: 'TR', entityId: 'country.TR', wb: 'TUR', bis: 'TR', currency: 'TRY', name: { ru: 'Турция', en: 'Türkiye' } },
  { id: 'DE', entityId: 'country.DE', wb: 'DEU', bis: null, currency: 'EUR', name: { ru: 'Германия', en: 'Germany' } },
  { id: 'FR', entityId: 'country.FR', wb: 'FRA', bis: null, currency: 'EUR', name: { ru: 'Франция', en: 'France' } },
  { id: 'KR', entityId: 'country.KR', wb: 'KOR', bis: 'KR', currency: 'KRW', name: { ru: 'Южная Корея', en: 'South Korea' } },
  { id: 'MX', entityId: 'country.MX', wb: 'MEX', bis: 'MX', currency: 'MXN', name: { ru: 'Мексика', en: 'Mexico' } },
  { id: 'AZ', entityId: 'country.AZ', wb: 'AZE', bis: null, currency: 'AZN', name: { ru: 'Азербайджан', en: 'Azerbaijan' } }
];

export const WORLD_BANK_METRICS = [
  { sourceSeries: 'NY.GDP.MKTP.CD', metricId: 'economy.gdp_current_usd', unit: 'USD', frequency: 'annual' },
  { sourceSeries: 'FP.CPI.TOTL.ZG', metricId: 'economy.inflation_cpi', unit: '%', frequency: 'annual' }
];

export const ECB_CURRENCIES = ['USD', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'BRL', 'AUD', 'CHF', 'TRY'];
export const BIS_AREAS = COUNTRIES.filter((country) => country.bis).map((country) => country.bis);

export const SOURCE_REGISTRY = {
  worldbank: {
    id: 'worldbank',
    name: 'World Bank',
    url: 'https://data.worldbank.org/',
    usageNote: 'World Bank open data; dataset-specific terms apply. Attribution retained.',
    cadence: 'annual'
  },
  ecb: {
    id: 'ecb',
    name: 'European Central Bank',
    url: 'https://data.ecb.europa.eu/',
    usageNote: 'ECB reference rates; attribution retained. Not a tradable live quote.',
    cadence: 'business_daily'
  },
  bis: {
    id: 'bis',
    name: 'Bank for International Settlements',
    url: 'https://data.bis.org/topics/CBPOL',
    usageNote: 'BIS central-bank policy-rate statistics; attribution retained.',
    cadence: 'monthly_or_event'
  }
};
