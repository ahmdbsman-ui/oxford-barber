import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from '../firebase/config';

function sortByCreatedAtDescending(items) {
  return [...items].sort((left, right) =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
  );
}

function sortClosures(closures) {
  return [...closures].sort((left, right) =>
    `${left.startDate || ''}${left.startTime || ''}`.localeCompare(
      `${right.startDate || ''}${right.startTime || ''}`
    )
  );
}

function subscribeToCollection(collectionName, onData, onError, transform) {
  return onSnapshot(
    collection(db, collectionName),
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      onData(transform ? transform(items) : items);
    },
    onError
  );
}

export function subscribeToSettings(onData, onError) {
  return onSnapshot(
    doc(db, 'siteConfig', 'settings'),
    (snapshot) => {
      onData(
        snapshot.exists()
          ? snapshot.data()
          : {
              happyClients: '500+',
              rating: '5.0',
              experience: '8+',
              vacationMode: false,
            }
      );
    },
    onError
  );
}

export function saveSettings(settings) {
  return setDoc(doc(db, 'siteConfig', 'settings'), settings, { merge: true });
}

export function subscribeToScheduledClosures(onData, onError) {
  return subscribeToCollection(
    'scheduledClosures',
    onData,
    onError,
    sortClosures
  );
}

export function addScheduledClosure(closure) {
  return addDoc(collection(db, 'scheduledClosures'), {
    ...closure,
    createdAt: new Date().toISOString(),
  });
}

export function deleteScheduledClosure(id) {
  return deleteDoc(doc(db, 'scheduledClosures', id));
}

export function subscribeToBannedUsers(onData, onError) {
  return subscribeToCollection('bannedUsers', onData, onError);
}

export function addBannedUser(data) {
  return addDoc(collection(db, 'bannedUsers'), {
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export function removeBannedUser(id) {
  return deleteDoc(doc(db, 'bannedUsers', id));
}

export function subscribeToReviews(onData, onError) {
  return subscribeToCollection(
    'reviews',
    onData,
    onError,
    sortByCreatedAtDescending
  );
}

export function addReview(data) {
  return addDoc(collection(db, 'reviews'), {
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export function updateReviewVisibility(id, isVisible) {
  return updateDoc(doc(db, 'reviews', id), { isVisible });
}

export function deleteReview(id) {
  return deleteDoc(doc(db, 'reviews', id));
}

function buildGalleryStoragePath(fileName) {
  const safeFileName = String(fileName || 'gallery-image').replace(
    /[^a-zA-Z0-9.-]/g,
    '-'
  );

  return `gallery/${Date.now()}-${safeFileName}`;
}

export async function addGalleryItem({ file, title }) {
  const storagePath = buildGalleryStoragePath(file?.name);
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);

  return addDoc(collection(db, 'gallery'), {
    imageUrl,
    storagePath,
    title: String(title || '').trim(),
    isVisible: true,
    createdAt: new Date().toISOString(),
  });
}

export function subscribeToGalleryItems(onData, onError) {
  return subscribeToCollection(
    'gallery',
    onData,
    onError,
    sortByCreatedAtDescending
  );
}

export function updateGalleryVisibility(id, isVisible) {
  return updateDoc(doc(db, 'gallery', id), { isVisible });
}

export async function deleteGalleryItem(item) {
  if (item?.storagePath) {
    try {
      await deleteObject(ref(storage, item.storagePath));
    } catch (error) {
      console.error('Admin app gallery storage delete failed:', error);
    }
  }

  return deleteDoc(doc(db, 'gallery', item.id));
}
