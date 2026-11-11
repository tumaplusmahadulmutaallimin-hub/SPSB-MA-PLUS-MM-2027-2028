/**
 * High-definition authentic SVG and Image brand assets
 * Produces crisp, true-to-life visual badges for official apps and services
 */

export interface BrandAsset {
  id: string;
  name: string;
  category: string;
  svgBadge: string;
  defaultUrl: string;
  description: string;
  targetOpen: '_blank' | '_self';
  isOfficialService?: boolean;
}

export const OFFICIAL_BRAND_ASSETS: Record<string, BrandAsset> = {
  ppdb_form: {
    id: 'ppdb_form',
    name: 'Formulir Pendaftaran (PPDB)',
    category: 'Pendaftaran',
    defaultUrl: '#ppdb-registration',
    description: 'Penerimaan Peserta Didik & Santri Baru MA Plus MM',
    targetOpen: '_self',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ppdbGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stop-color="#065F46"/>
          <stop offset="1" stop-color="#047857"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FDE047"/>
          <stop offset="1" stop-color="#CA8A04"/>
        </linearGradient>
        <filter id="shadowPPDB" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.25"/>
        </filter>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#ppdbGrad)"/>
      <rect x="22" y="18" width="56" height="64" rx="8" fill="#FFFFFF" filter="url(#shadowPPDB)"/>
      <rect x="30" y="26" width="28" height="6" rx="3" fill="#047857"/>
      <rect x="30" y="38" width="40" height="4" rx="2" fill="#E2E8F0"/>
      <rect x="30" y="46" width="34" height="4" rx="2" fill="#E2E8F0"/>
      <rect x="30" y="54" width="38" height="4" rx="2" fill="#E2E8F0"/>
      <circle cx="68" cy="68" r="14" fill="url(#goldGrad)" filter="url(#shadowPPDB)"/>
      <path d="M63 68L66.5 71.5L73 64.5" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },

  instagram: {
    id: 'instagram',
    name: 'Instagram Resmi',
    category: 'Media Sosial',
    defaultUrl: 'https://instagram.com',
    description: 'Dokumentasi kegiatan santri, kajian, dan galeri harian',
    targetOpen: '_blank',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rg" cx="20%" cy="100%" r="130%">
          <stop offset="0%" stop-color="#FFDD55"/>
          <stop offset="10%" stop-color="#FFDD55"/>
          <stop offset="50%" stop-color="#FF543E"/>
          <stop offset="70%" stop-color="#C837AB"/>
          <stop offset="100%" stop-color="#3771C8"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#rg)"/>
      <rect x="23" y="23" width="54" height="54" rx="16" stroke="#FFFFFF" stroke-width="6"/>
      <circle cx="50" cy="50" r="14" stroke="#FFFFFF" stroke-width="6"/>
      <circle cx="66" cy="34" r="3.5" fill="#FFFFFF"/>
    </svg>`,
  },

  youtube: {
    id: 'youtube',
    name: 'YouTube Resmi',
    category: 'Media Sosial',
    defaultUrl: 'https://youtube.com',
    description: 'Video podcast, ceramah santri, wisuda, dan siaran langsung',
    targetOpen: '_blank',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ytGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF0000"/>
          <stop offset="1" stop-color="#CC0000"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#ytGrad)"/>
      <path d="M78 35.5C77.4 33 75.4 31.1 73 30.5C68.6 29.3 50 29.3 50 29.3C50 29.3 31.4 29.3 27 30.5C24.6 31.1 22.6 33 22 35.5C20.8 40 20.8 50 20.8 50C20.8 50 20.8 60 22 64.5C22.6 67 24.6 68.9 27 69.5C31.4 70.7 50 70.7 50 70.7C50 70.7 68.6 70.7 73 69.5C75.4 68.9 77.4 67 78 64.5C79.2 60 79.2 50 79.2 50C79.2 50 79.2 40 78 35.5Z" fill="#FFFFFF"/>
      <path d="M43.5 41.5L59 50L43.5 58.5V41.5Z" fill="#CC0000"/>
    </svg>`,
  },

  tiktok: {
    id: 'tiktok',
    name: 'TikTok Resmi',
    category: 'Media Sosial',
    defaultUrl: 'https://tiktok.com',
    description: 'Video kreatif santri, tips belajar, dan syiar santri muda',
    targetOpen: '_blank',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="24" fill="#010101"/>
      <!-- Cyan offset note -->
      <path d="M57 26V49.5C54.8 48.2 52.3 47.5 49.5 47.5C41.8 47.5 35.5 53.8 35.5 61.5C35.5 69.2 41.8 75.5 49.5 75.5C57.2 75.5 63.5 69.2 63.5 61.5V39.2C67.8 42.3 73.2 44.1 79 44.2V36.2C73 36 67.5 32.5 65.2 26H57Z" fill="#25F4EE"/>
      <!-- Magenta offset note -->
      <path d="M55 24V47.5C52.8 46.2 50.3 45.5 47.5 45.5C39.8 45.5 33.5 51.8 33.5 59.5C33.5 67.2 39.8 73.5 47.5 73.5C55.2 73.5 61.5 67.2 61.5 59.5V37.2C65.8 40.3 71.2 42.1 77 42.2V34.2C71 34 65.5 30.5 63.2 24H55Z" fill="#FE2C55"/>
      <!-- White foreground note -->
      <path d="M56 25V48.5C53.8 47.2 51.3 46.5 48.5 46.5C40.8 46.5 34.5 52.8 34.5 60.5C34.5 68.2 40.8 74.5 48.5 74.5C56.2 74.5 62.5 68.2 62.5 60.5V38.2C66.8 41.3 72.2 43.1 78 43.2V35.2C72 35 66.5 31.5 64.2 25H56Z" fill="#FFFFFF"/>
    </svg>`,
  },

  google_maps: {
    id: 'google_maps',
    name: 'Google Maps Lokasi',
    category: 'Layanan Kampus',
    defaultUrl: 'https://maps.google.com',
    description: 'Petunjuk arah navigasi dan denah lokasi kampus MA Plus MM',
    targetOpen: '_blank',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
      <!-- Google Maps Pin -->
      <path d="M50 16C36.7 16 26 26.7 26 40C26 57 45.2 78.5 48.1 81.6C49.1 82.8 50.9 82.8 51.9 81.6C54.8 78.5 74 57 74 40C74 26.7 63.3 16 50 16Z" fill="#EA4335"/>
      <path d="M50 16C43.5 16 37.6 18.6 33.3 22.8L44.8 42.5L50 16Z" fill="#4285F4"/>
      <path d="M26 40C26 47.4 29.5 55.4 35 63.5L46.5 43.8L33.3 22.8C28.8 27.3 26 33.3 26 40Z" fill="#FBBC04"/>
      <path d="M50 82C49.5 82 48.8 81.6 48.1 81.6C45.2 78.5 26 57 26 40C26 39.5 26 39 26.1 38.5L46.5 43.8L50 82Z" fill="#34A853"/>
      <circle cx="50" cy="39" r="10.5" fill="#FFFFFF"/>
      <circle cx="50" cy="39" r="7" fill="#C5221F"/>
    </svg>`,
  },

  daftarkan_prestasi: {
    id: 'daftarkan_prestasi',
    name: 'Daftarkan Prestasi',
    category: 'Prestasi Santri',
    defaultUrl: '#achievement-portal',
    description: 'Pilih nama pendaftar & unggah piagam kejuaraan pendukung',
    targetOpen: '_self',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldMedal" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F59E0B"/>
          <stop offset="0.5" stop-color="#FBBF24"/>
          <stop offset="1" stop-color="#B45309"/>
        </linearGradient>
        <radialGradient id="shine" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="100%" stop-color="#D97706"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#goldMedal)"/>
      <!-- Ribbons -->
      <path d="M38 18L32 46L46 41L50 18H38Z" fill="#1E3A8A"/>
      <path d="M62 18L68 46L54 41L50 18H62Z" fill="#B91C1C"/>
      <!-- Trophy Icon -->
      <circle cx="50" cy="54" r="26" fill="url(#shine)" stroke="#FFFFFF" stroke-width="3"/>
      <!-- Trophy Cup -->
      <path d="M38 42H62V51C62 57.6 56.6 63 50 63C43.4 63 38 57.6 38 51V42Z" fill="#FFFFFF"/>
      <path d="M38 45H32C30.9 45 30 45.9 30 47V49C30 52.3 32.7 55 36 55H38V45Z" fill="#FFFFFF"/>
      <path d="M62 45H68C69.1 45 70 45.9 70 47V49C70 52.3 67.3 55 64 55H62V45Z" fill="#FFFFFF"/>
      <rect x="47" y="63" width="6" height="7" fill="#FFFFFF"/>
      <rect x="42" y="70" width="16" height="5" rx="2" fill="#FFFFFF"/>
      <!-- Star on Cup -->
      <path d="M50 46L51.2 49.5H55L52 51.5L53.1 55L50 53L46.9 55L48 51.5L45 49.5H48.8L50 46Z" fill="#D97706"/>
    </svg>`,
  },

  portal_web: {
    id: 'portal_web',
    name: 'Portal Web MA Plus MM',
    category: 'Informasi Resmi',
    defaultUrl: 'https://maplusmm.sch.id',
    description: 'Profil lembaga, kurikulum terpadu, asrama, dan kabar madrasah',
    targetOpen: '_blank',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crestGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stop-color="#064E3B"/>
          <stop offset="1" stop-color="#022C22"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#crestGrad)"/>
      <circle cx="50" cy="50" r="34" stroke="#FBBF24" stroke-width="2.5" stroke-dasharray="4 3"/>
      <!-- Mosque Dome & Minaret -->
      <path d="M50 24C44 32 35 36 35 48H65C65 36 56 32 50 24Z" fill="#FBBF24"/>
      <rect x="48.5" y="20" width="3" height="5" fill="#FBBF24"/>
      <circle cx="50" cy="19" r="2.5" fill="#FBBF24"/>
      <!-- Open Quran / Book -->
      <path d="M50 54L34 50V68L50 72L66 68V50L50 54Z" fill="#FFFFFF"/>
      <path d="M50 54V72" stroke="#064E3B" stroke-width="2"/>
      <path d="M38 55L48 58" stroke="#064E3B" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M38 60L48 63" stroke="#064E3B" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M62 55L52 58" stroke="#064E3B" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M62 60L52 63" stroke="#064E3B" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },

  saluran_whatsapp: {
    id: 'saluran_whatsapp',
    name: 'Saluran WhatsApp Resmi',
    category: 'Kontak Panitia',
    defaultUrl: '#committee-contacts',
    description: 'Direktori kontak person panitia PPDB & layanan madrasah',
    targetOpen: '_self',
    isOfficialService: true,
    svgBadge: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop stop-color="#25D366"/>
          <stop offset="1" stop-color="#128C7E"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#waGrad)"/>
      <circle cx="50" cy="50" r="27" fill="#FFFFFF"/>
      <path d="M50 28C38 28 28.2 37.8 28.2 49.8C28.2 53.6 29.2 57.3 31.1 60.5L28 72L39.9 68.9C43 70.6 46.5 71.5 50 71.5C62 71.5 71.8 61.7 71.8 49.7C71.8 37.7 62 28 50 28ZM62.7 58.7C62.2 60.1 60.1 61.3 58.4 61.6C57.2 61.8 55.7 62 50.4 59.8C43.6 57 39.2 50.1 38.8 49.6C38.5 49.1 36 45.7 36 42.3C36 38.9 37.7 37.2 38.4 36.5C39 35.8 40 35.6 40.8 35.6C41.1 35.6 41.3 35.6 41.5 35.6C42.2 35.6 42.5 35.7 43 36.9C43.6 38.3 45 41.8 45.2 42.2C45.4 42.6 45.5 43.1 45.2 43.7C45 44.2 44.7 44.5 44.4 44.9C44 45.4 43.7 45.8 43.3 46.3C42.9 46.7 42.4 47.2 42.9 48.1C43.4 49 45.1 51.8 47.7 54.1C51 57.1 53.7 58.1 54.7 58.5C55.7 58.9 56.3 58.8 56.9 58.1C57.6 57.3 58.8 55.7 59.6 54.6C60.2 53.7 61 53.9 61.8 54.2C62.6 54.5 67 56.7 67.9 57.2C68.8 57.7 69.4 58 69.6 58.3C69.8 58.8 69.8 60.4 62.7 58.7Z" fill="#128C7E"/>
    </svg>`,
  },
};

/**
 * Returns a data URI for the SVG badge
 */
export function getSvgDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}
