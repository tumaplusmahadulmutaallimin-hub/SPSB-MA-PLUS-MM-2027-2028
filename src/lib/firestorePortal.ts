import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, isAuthorizedFirebaseAdmin } from './firebase';
import type {
  SiteSettings,
  QrSettings,
  Category,
  ServiceLink,
  Announcement,
  Registration,
  DocumentItem,
  CommitteeContact,
  MadrasahAchievement,
  StudentAchievement,
} from '../types';

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

function sanitizeId(id?: string): string {
  const raw = (id || '').trim();
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(raw)) return raw;
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isCloudAdminReady(): boolean {
  return isAuthorizedFirebaseAdmin(auth.currentUser);
}

/**
 * Compress image files client-side before saving so base64 payloads fit cleanly inside Firestore 1MB docs.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 1280,
  maxStringLength = 520000
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || rawDataUrl.length <= 220000) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round((img.width || 1) * scale));
      const height = Math.max(1, Math.round((img.height || 1) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.82;
      let output = canvas.toDataURL('image/jpeg', quality);
      while (output.length > maxStringLength && quality > 0.35) {
        quality -= 0.12;
        output = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(output);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

// Helper: preserve createdAt on update or initialize server timestamps on create
async function writeWithTimestamps(
  colName: string,
  docId: string,
  payload: Record<string, any>
): Promise<void> {
  const cleanId = sanitizeId(docId);
  const path = `${colName}/${cleanId}`;
  const ref = doc(db, colName, cleanId);
  try {
    let existingCreatedAt: any = null;
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        existingCreatedAt = snap.data()?.createdAt || null;
      }
    } catch {
      existingCreatedAt = null;
    }

    const finalData = {
      ...payload,
      createdAt: existingCreatedAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, finalData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function deleteFirestoreDoc(colName: string, docId: string): Promise<void> {
  const cleanId = sanitizeId(docId);
  const path = `${colName}/${cleanId}`;
  try {
    await deleteDoc(doc(db, colName, cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ------------------------------------------------------------
// PUBLIC PORTAL READ & REAL-TIME SUBSCRIPTION
// ------------------------------------------------------------

export interface PublicFirestoreSnapshot {
  initialized: boolean;
  siteSettings: SiteSettings | null;
  categories: Category[];
  links: ServiceLink[];
  announcements: Announcement[];
  registrations: Registration[];
  documents: DocumentItem[];
  committeeContacts: CommitteeContact[];
  madrasahAchievements: MadrasahAchievement[];
}

function mapSiteSettings(data: any): SiteSettings {
  return {
    portalName: String(data.portalName || 'PORTAL DIGITAL TERPADU'),
    institutionName: String(data.institutionName || "MA PLUS MA'HADUL MUTA'ALLIMIN"),
    tagline: String(data.tagline || ''),
    description: String(data.description || ''),
    logoUrl: String(data.logoUrl || ''),
    faviconUrl: String(data.faviconUrl || ''),
    bannerUrl: String(data.bannerUrl || ''),
    primaryColor: String(data.primaryColor || '#065f46'),
    accentColor: String(data.accentColor || '#d97706'),
    whatsappNumber: String(data.whatsappNumber || ''),
    email: String(data.email || ''),
    address: String(data.address || ''),
    instagramUrl: String(data.instagramUrl || ''),
    facebookUrl: String(data.facebookUrl || ''),
    youtubeUrl: String(data.youtubeUrl || ''),
    tiktokUrl: String(data.tiktokUrl || ''),
    websiteUrl: String(data.websiteUrl || ''),
    copyrightText: String(data.copyrightText || ''),
    heroEnabled: Boolean(data.heroEnabled ?? true),
    announcementsEnabled: Boolean(data.announcementsEnabled ?? true),
    registrationsEnabled: Boolean(data.registrationsEnabled ?? true),
    documentsEnabled: Boolean(data.documentsEnabled ?? true),
    searchEnabled: Boolean(data.searchEnabled ?? true),
    categoriesEnabled: Boolean(data.categoriesEnabled ?? true),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function mapQrSettings(data: any): QrSettings {
  return {
    portalUrl: String(data.portalUrl || ''),
    size: Number(data.size || 320),
    foregroundColor: String(data.foregroundColor || '#065f46'),
    backgroundColor: String(data.backgroundColor || '#ffffff'),
    includeLogo: Boolean(data.includeLogo ?? true),
    logoUrl: String(data.logoUrl || ''),
    errorCorrectionLevel: (['L', 'M', 'Q', 'H'].includes(data.errorCorrectionLevel)
      ? data.errorCorrectionLevel
      : 'H') as 'L' | 'M' | 'Q' | 'H',
    posterTitle: String(data.posterTitle || 'PORTAL DIGITAL TERPADU'),
    posterSubtitle: String(data.posterSubtitle || ''),
    posterFooter: String(data.posterFooter || ''),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export async function fetchPublicPortalFromFirestore(): Promise<PublicFirestoreSnapshot> {
  const settingsRef = doc(db, 'site_settings', 'default');
  let settingsSnap;
  try {
    settingsSnap = await getDocFromServer(settingsRef);
  } catch {
    settingsSnap = await getDoc(settingsRef);
  }

  if (!settingsSnap.exists()) {
    return {
      initialized: false,
      siteSettings: null,
      categories: [],
      links: [],
      announcements: [],
      registrations: [],
      documents: [],
      committeeContacts: [],
      madrasahAchievements: [],
    };
  }

  const [catSnap, linkSnap, annSnap, regSnap, docSnap, contactSnap, madAchSnap] = await Promise.all([
    getDocs(query(collection(db, 'categories'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'links'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'announcements'), where('status', '==', 'published'))),
    getDocs(query(collection(db, 'registrations'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'documents'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'committee_contacts'), where('isAvailable', '==', true))),
    getDocs(query(collection(db, 'madrasah_achievements'), where('isActive', '==', true))),
  ]);

  return {
    initialized: true,
    siteSettings: mapSiteSettings(settingsSnap.data()),
    categories: catSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Category)
      .sort((a, b) => a.order - b.order),
    links: linkSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as ServiceLink)
      .sort((a, b) => a.order - b.order),
    announcements: annSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Announcement)
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()),
    registrations: regSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Registration)
      .sort((a, b) => a.order - b.order),
    documents: docSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as DocumentItem)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    committeeContacts: contactSnap.docs.map(
      (d) => ({ ...(d.data() as any), id: d.id }) as CommitteeContact
    ),
    madrasahAchievements: madAchSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as MadrasahAchievement)
      .sort((a, b) => a.order - b.order),
  };
}

export function subscribePublicPortalFromFirestore(
  onUpdate: (snapshot: Partial<PublicFirestoreSnapshot> & { initialized: boolean }) => void
): () => void {
  const unsubs: (() => void)[] = [];
  let isInitialized = false;

  const logError = (path: string) => (err: unknown) => {
    console.warn(`Firestore listener warning on ${path}:`, err instanceof Error ? err.message : err);
  };

  unsubs.push(
    onSnapshot(
      doc(db, 'site_settings', 'default'),
      (snap) => {
        if (!snap.exists()) {
          isInitialized = false;
          onUpdate({ initialized: false });
          return;
        }
        isInitialized = true;
        onUpdate({ initialized: true, siteSettings: mapSiteSettings(snap.data()) });
      },
      logError('site_settings/default')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'categories'), where('isActive', '==', true)),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const categories = snap.docs
          .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Category)
          .sort((a, b) => a.order - b.order);
        onUpdate({ initialized: true, categories });
      },
      logError('categories')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'links'), where('isActive', '==', true)),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const links = snap.docs
          .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as ServiceLink)
          .sort((a, b) => a.order - b.order);
        onUpdate({ initialized: true, links });
      },
      logError('links')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'announcements'), where('status', '==', 'published')),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const announcements = snap.docs
          .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Announcement)
          .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
        onUpdate({ initialized: true, announcements });
      },
      logError('announcements')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'registrations'), where('isActive', '==', true)),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const registrations = snap.docs
          .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Registration)
          .sort((a, b) => a.order - b.order);
        onUpdate({ initialized: true, registrations });
      },
      logError('registrations')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'documents'), where('isActive', '==', true)),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const documents = snap.docs
          .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as DocumentItem)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate({ initialized: true, documents });
      },
      logError('documents')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'committee_contacts'), where('isAvailable', '==', true)),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const committeeContacts = snap.docs.map(
          (d) => ({ ...(d.data() as any), id: d.id }) as CommitteeContact
        );
        onUpdate({ initialized: true, committeeContacts });
      },
      logError('committee_contacts')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'madrasah_achievements'), where('isActive', '==', true)),
      (snap) => {
        if (!isInitialized && snap.empty) return;
        const madrasahAchievements = snap.docs
          .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as MadrasahAchievement)
          .sort((a, b) => a.order - b.order);
        onUpdate({ initialized: true, madrasahAchievements });
      },
      logError('madrasah_achievements')
    )
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

// ------------------------------------------------------------
// ADMIN CLOUD CRUD & FULL LOADERS
// ------------------------------------------------------------

export async function loadAllAdminFromFirestore() {
  let settingsSnap;
  try {
    settingsSnap = await getDocFromServer(doc(db, 'site_settings', 'default'));
  } catch {
    settingsSnap = await getDoc(doc(db, 'site_settings', 'default'));
  }

  if (!settingsSnap.exists()) {
    return { initialized: false } as const;
  }

  const adminReady = isCloudAdminReady();
  const safeGetDocs = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

  const [qrSnap, catSnap, linkSnap, annSnap, regSnap, docSnap, contactSnap, madAchSnap, stuAchSnap] =
    await Promise.all([
      safeGetDocs(getDoc(doc(db, 'qr_settings', 'default'))),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'categories'))
          : getDocs(query(collection(db, 'categories'), where('isActive', '==', true)))
      ),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'links'))
          : getDocs(query(collection(db, 'links'), where('isActive', '==', true)))
      ),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'announcements'))
          : getDocs(query(collection(db, 'announcements'), where('status', '==', 'published')))
      ),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'registrations'))
          : getDocs(query(collection(db, 'registrations'), where('isActive', '==', true)))
      ),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'documents'))
          : getDocs(query(collection(db, 'documents'), where('isActive', '==', true)))
      ),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'committee_contacts'))
          : getDocs(query(collection(db, 'committee_contacts'), where('isAvailable', '==', true)))
      ),
      safeGetDocs(
        adminReady
          ? getDocs(collection(db, 'madrasah_achievements'))
          : getDocs(query(collection(db, 'madrasah_achievements'), where('isActive', '==', true)))
      ),
      adminReady ? safeGetDocs(getDocs(collection(db, 'student_achievements'))) : Promise.resolve(null),
    ]);

  return {
    initialized: true as const,
    siteSettings: mapSiteSettings(settingsSnap.data()),
    qrSettings: qrSnap && qrSnap.exists() ? mapQrSettings(qrSnap.data()) : null,
    categories: (catSnap?.docs || [])
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Category)
      .sort((a, b) => a.order - b.order),
    links: (linkSnap?.docs || [])
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as ServiceLink)
      .sort((a, b) => a.order - b.order),
    announcements: (annSnap?.docs || [])
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Announcement)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    registrations: (regSnap?.docs || [])
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as Registration)
      .sort((a, b) => a.order - b.order),
    documents: (docSnap?.docs || [])
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as DocumentItem)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    committeeContacts: (contactSnap?.docs || []).map(
      (d) => ({ ...(d.data() as any), id: d.id }) as CommitteeContact
    ),
    madrasahAchievements: (madAchSnap?.docs || [])
      .map((d) => ({ ...(d.data() as any), id: d.id, createdAt: toIsoString(d.data().createdAt), updatedAt: toIsoString(d.data().updatedAt) }) as MadrasahAchievement)
      .sort((a, b) => a.order - b.order),
    studentAchievements: (stuAchSnap?.docs || [])
      .map((d) => ({
        ...(d.data() as any),
        id: d.id,
        createdAt: toIsoString(d.data().createdAt),
        updatedAt: toIsoString(d.data().updatedAt),
        submittedAt: toIsoString(d.data().submittedAt || d.data().createdAt),
      }) as StudentAchievement)
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.createdAt).getTime() -
          new Date(a.submittedAt || a.createdAt).getTime()
      ),
  };
}

export async function saveSiteSettingsToFirestore(settings: SiteSettings): Promise<void> {
  await writeWithTimestamps('site_settings', 'default', {
    portalName: (settings.portalName || 'PORTAL DIGITAL TERPADU').slice(0, 120),
    institutionName: (settings.institutionName || "MA PLUS MA'HADUL MUTA'ALLIMIN").slice(0, 160),
    tagline: (settings.tagline || '').slice(0, 240),
    description: (settings.description || '').slice(0, 1000),
    logoUrl: (settings.logoUrl || '').slice(0, 600000),
    faviconUrl: (settings.faviconUrl || '').slice(0, 600000),
    bannerUrl: (settings.bannerUrl || '').slice(0, 700000),
    primaryColor: (settings.primaryColor || '#065f46').slice(0, 32),
    accentColor: (settings.accentColor || '#d97706').slice(0, 32),
    whatsappNumber: (settings.whatsappNumber || '').slice(0, 64),
    email: (settings.email || '').slice(0, 200),
    address: (settings.address || '').slice(0, 500),
    instagramUrl: (settings.instagramUrl || '').slice(0, 500),
    facebookUrl: (settings.facebookUrl || '').slice(0, 500),
    youtubeUrl: (settings.youtubeUrl || '').slice(0, 500),
    tiktokUrl: (settings.tiktokUrl || '').slice(0, 500),
    websiteUrl: (settings.websiteUrl || '').slice(0, 500),
    copyrightText: (settings.copyrightText || '').slice(0, 300),
    heroEnabled: Boolean(settings.heroEnabled),
    announcementsEnabled: Boolean(settings.announcementsEnabled),
    registrationsEnabled: Boolean(settings.registrationsEnabled),
    documentsEnabled: Boolean(settings.documentsEnabled),
    searchEnabled: Boolean(settings.searchEnabled),
    categoriesEnabled: Boolean(settings.categoriesEnabled),
  });
}

export async function saveQrSettingsToFirestore(qr: QrSettings): Promise<void> {
  await writeWithTimestamps('qr_settings', 'default', {
    portalUrl: (qr.portalUrl || '').slice(0, 500),
    size: Number(qr.size || 320),
    foregroundColor: (qr.foregroundColor || '#065f46').slice(0, 32),
    backgroundColor: (qr.backgroundColor || '#ffffff').slice(0, 32),
    includeLogo: Boolean(qr.includeLogo ?? true),
    logoUrl: (qr.logoUrl || '').slice(0, 600000),
    errorCorrectionLevel: ['L', 'M', 'Q', 'H'].includes(qr.errorCorrectionLevel)
      ? qr.errorCorrectionLevel
      : 'H',
    posterTitle: (qr.posterTitle || 'PORTAL DIGITAL TERPADU').slice(0, 160),
    posterSubtitle: (qr.posterSubtitle || '').slice(0, 300),
    posterFooter: (qr.posterFooter || '').slice(0, 300),
  });
}

export async function saveCategoryToFirestore(cat: Category): Promise<void> {
  const id = sanitizeId(cat.id);
  await writeWithTimestamps('categories', id, {
    id,
    name: (cat.name || '').trim().slice(0, 120),
    description: (cat.description || '').trim().slice(0, 500),
    icon: (cat.icon || 'Folder').slice(0, 80),
    order: Number(cat.order || 0),
    isActive: Boolean(cat.isActive),
  });
}

export async function deleteCategoryFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('categories', id);
}

export async function saveLinkToFirestore(link: ServiceLink): Promise<void> {
  const id = sanitizeId(link.id);
  await writeWithTimestamps('links', id, {
    id,
    name: (link.name || '').trim().slice(0, 120),
    categoryId: (link.categoryId || '').slice(0, 128),
    description: (link.description || '').trim().slice(0, 500),
    iconType: ['lucide', 'image', 'upload'].includes(link.iconType) ? link.iconType : 'lucide',
    icon: (link.icon || 'Globe').slice(0, 700000),
    targetUrl: (link.targetUrl || '').trim().slice(0, 1000),
    targetOpen: link.targetOpen === '_self' ? '_self' : '_blank',
    order: Number(link.order || 0),
    isActive: Boolean(link.isActive),
    clicksCount: Number(link.clicksCount || 0),
  });
}

export async function deleteLinkFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('links', id);
}

export async function saveAnnouncementToFirestore(ann: Announcement): Promise<void> {
  const id = sanitizeId(ann.id);
  await writeWithTimestamps('announcements', id, {
    id,
    title: (ann.title || '').trim().slice(0, 200),
    content: (ann.content || '').trim().slice(0, 5000),
    imageUrl: (ann.imageUrl || '').slice(0, 700000),
    publishDate: (ann.publishDate || new Date().toISOString().split('T')[0]).slice(0, 40),
    expiryDate: (ann.expiryDate || '').slice(0, 40),
    status: ann.status === 'draft' ? 'draft' : 'published',
  });
}

export async function deleteAnnouncementFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('announcements', id);
}

export async function saveRegistrationToFirestore(reg: Registration): Promise<void> {
  const id = sanitizeId(reg.id);
  await writeWithTimestamps('registrations', id, {
    id,
    title: (reg.title || '').trim().slice(0, 200),
    description: (reg.description || '').trim().slice(0, 1000),
    bannerUrl: (reg.bannerUrl || '').slice(0, 700000),
    formUrl: (reg.formUrl || '').trim().slice(0, 1000),
    startDate: (reg.startDate || '').slice(0, 40),
    endDate: (reg.endDate || '').slice(0, 40),
    status: reg.status === 'closed' ? 'closed' : 'open',
    order: Number(reg.order || 0),
    isActive: Boolean(reg.isActive),
  });
}

export async function deleteRegistrationFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('registrations', id);
}

export async function saveDocumentToFirestore(docItem: DocumentItem): Promise<void> {
  const id = sanitizeId(docItem.id);
  await writeWithTimestamps('documents', id, {
    id,
    title: (docItem.title || '').trim().slice(0, 200),
    description: (docItem.description || '').trim().slice(0, 1000),
    category: (docItem.category || 'Umum').trim().slice(0, 80),
    fileUrl: (docItem.fileUrl || '').trim().slice(0, 1000),
    fileType: (docItem.fileType || 'PDF').toUpperCase().slice(0, 24),
    fileSize: (docItem.fileSize || '0 KB').slice(0, 40),
    downloadCount: Number(docItem.downloadCount || 0),
    isActive: Boolean(docItem.isActive),
  });
}

export async function deleteDocumentFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('documents', id);
}

export async function saveContactToFirestore(contact: CommitteeContact): Promise<void> {
  const id = sanitizeId(contact.id);
  await writeWithTimestamps('committee_contacts', id, {
    id,
    name: (contact.name || '').trim().slice(0, 120),
    role: (contact.role || 'Panitia').trim().slice(0, 120),
    whatsappNumber: (contact.whatsappNumber || '').trim().slice(0, 40),
    notes: (contact.notes || '').trim().slice(0, 300),
    isAvailable: contact.isAvailable !== false,
  });
}

export async function deleteContactFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('committee_contacts', id);
}

export async function saveMadrasahAchievementToFirestore(ach: MadrasahAchievement): Promise<void> {
  const id = sanitizeId(ach.id);
  await writeWithTimestamps('madrasah_achievements', id, {
    id,
    title: (ach.title || '').trim().slice(0, 200),
    category: (ach.category || 'Prestasi').trim().slice(0, 100),
    level: (ach.level || 'Tingkat Nasional').trim().slice(0, 100),
    recipient: (ach.recipient || 'MA PLUS MM').trim().slice(0, 160),
    year: (ach.year || String(new Date().getFullYear())).slice(0, 20),
    photoUrl: (ach.photoUrl || '').slice(0, 700000),
    shortDescription: (ach.shortDescription || '').trim().slice(0, 1000),
    order: Number(ach.order || 0),
    isActive: ach.isActive !== false,
  });
}

export async function deleteMadrasahAchievementFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('madrasah_achievements', id);
}

export async function createStudentAchievementInFirestore(ach: StudentAchievement): Promise<void> {
  const id = sanitizeId(ach.id);
  const path = `student_achievements/${id}`;
  try {
    await setDoc(doc(db, 'student_achievements', id), {
      id,
      studentName: (ach.studentName || '').trim().slice(0, 160),
      registrationNumberOrNisn: (ach.registrationNumberOrNisn || '').trim().slice(0, 64),
      achievementTitle: (ach.achievementTitle || '').trim().slice(0, 200),
      field: (ach.field || 'akademik').slice(0, 80),
      level: (ach.level || 'Kabupaten/Kota').slice(0, 80),
      rank: (ach.rank || 'Juara 1').slice(0, 80),
      organizer: (ach.organizer || '').slice(0, 160),
      year: (ach.year || String(new Date().getFullYear())).slice(0, 20),
      certificateUrl: (ach.certificateUrl || '').slice(0, 750000),
      certificateFileName: (ach.certificateFileName || 'piagam.pdf').slice(0, 200),
      notes: (ach.notes || '').slice(0, 500),
      status: 'pending',
      submittedAt: (ach.submittedAt || new Date().toISOString()).slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function verifyStudentAchievementInFirestore(
  id: string,
  status: 'verified' | 'rejected',
  notes = ''
): Promise<void> {
  const cleanId = sanitizeId(id);
  const path = `student_achievements/${cleanId}`;
  const ref = doc(db, 'student_achievements', cleanId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await setDoc(ref, {
      ...snap.data(),
      status,
      notes: notes.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudentAchievementFromFirestore(id: string): Promise<void> {
  await deleteFirestoreDoc('student_achievements', id);
}

/**
 * Push an entire local state snapshot to Cloud Firestore (used on initial cloud link or manual sync).
 */
export async function syncAllLocalToFirestore(payload: {
  siteSettings: SiteSettings | null;
  qrSettings: QrSettings | null;
  categories: Category[];
  links: ServiceLink[];
  announcements: Announcement[];
  registrations: Registration[];
  documents: DocumentItem[];
  committeeContacts: CommitteeContact[];
  madrasahAchievements: MadrasahAchievement[];
}): Promise<void> {
  if (payload.siteSettings) {
    await saveSiteSettingsToFirestore(payload.siteSettings);
  }
  if (payload.qrSettings) {
    await saveQrSettingsToFirestore(payload.qrSettings);
  }
  for (const cat of payload.categories) await saveCategoryToFirestore(cat);
  for (const link of payload.links) await saveLinkToFirestore(link);
  for (const ann of payload.announcements) await saveAnnouncementToFirestore(ann);
  for (const reg of payload.registrations) await saveRegistrationToFirestore(reg);
  for (const docItem of payload.documents) await saveDocumentToFirestore(docItem);
  for (const c of payload.committeeContacts) await saveContactToFirestore(c);
  for (const m of payload.madrasahAchievements) await saveMadrasahAchievementToFirestore(m);
}

/**
 * Clear all content collections in Cloud Firestore while preserving siteSettings & qrSettings docs.
 */
export async function clearPortalCollectionsInFirestore(): Promise<void> {
  const cols = [
    'categories',
    'links',
    'announcements',
    'registrations',
    'documents',
    'committee_contacts',
    'madrasah_achievements',
    'student_achievements',
  ];

  for (const colName of cols) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }
}
