import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Helper to check if Firebase is fully initialized and active
export function isFirebaseSyncActive(): boolean {
  return db !== null;
}

// Subscribe to a collection in real-time
export function subscribeToCollection<T>(
  collectionName: string, 
  onUpdate: (data: T[]) => void,
  sortField?: string,
  sortDir: 'asc' | 'desc' = 'asc'
) {
  if (!isFirebaseSyncActive()) return () => {};

  const colRef = collection(db, collectionName);
  const q = sortField ? query(colRef, orderBy(sortField, sortDir)) : colRef;

  return onSnapshot(q, (snapshot) => {
    const items: T[] = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as any);
    });
    onUpdate(items);
  }, (error) => {
    console.error(`Error syncing collection ${collectionName}:`, error);
  });
}

// Subscribe to a single document in real-time
export function subscribeToDoc<T>(
  collectionName: string, 
  docId: string, 
  onUpdate: (data: T | null) => void
) {
  if (!isFirebaseSyncActive()) return () => {};

  const docRef = doc(db, collectionName, docId);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() } as any);
    } else {
      onUpdate(null);
    }
  }, (error) => {
    console.error(`Error syncing document ${collectionName}/${docId}:`, error);
  });
}

// Set/Update a document in Firestore
export async function saveDocument(collectionName: string, docId: string, data: any) {
  if (!isFirebaseSyncActive()) {
    console.warn(`Firebase is not active. Save to ${collectionName}/${docId} aborted.`);
    return false;
  }
  try {
    const docRef = doc(db, collectionName, docId);
    // Sanitize data to remove any undefined values which Firestore throws on
    const sanitized = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, sanitized, { merge: true });
    return true;
  } catch (error) {
    console.error(`Error writing document ${collectionName}/${docId}:`, error);
    return false;
  }
}

// Delete a document from Firestore
export async function deleteDocument(collectionName: string, docId: string) {
  if (!isFirebaseSyncActive()) return false;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${collectionName}/${docId}:`, error);
    return false;
  }
}

// Bulk seed initial data if Firestore database is empty
export async function seedFirestoreIfEmpty(initialDb: any) {
  if (!isFirebaseSyncActive()) return;

  try {
    // Check if establishment is already seeded
    const estRef = doc(db, 'establishment', 'config');
    const estSnap = await getDoc(estRef);

    if (estSnap.exists()) {
      console.log('Firestore is already seeded with data. Skipping seeding.');
      return;
    }

    console.log('Firestore is empty. Starting initial data seeding with batch...');
    
    // 1. Seed Establishment config
    if (initialDb.establishment) {
      await saveDocument('establishment', 'config', initialDb.establishment);
    }

    // 2. Seed other collections in bulk using a Firestore batch for efficiency
    const collectionsToSeed = [
      { name: 'studentsStats', key: 'studentsStats', defaultIdField: 'className' },
      { name: 'gradeSheets', key: 'gradeSheets', defaultIdField: 'id' },
      { name: 'hourCoverages', key: 'hourCoverages', defaultIdField: 'id' },
      { name: 'programCoverages', key: 'programCoverages', defaultIdField: 'id' },
      { name: 'apcPreps', key: 'apcPreps', defaultIdField: 'id' },
      { name: 'exams', key: 'exams', defaultIdField: 'id' },
      { name: 'councilReports', key: 'councilReports', defaultIdField: 'id' },
      { name: 'departmentMessages', key: 'departmentMessages', defaultIdField: 'id' },
      { name: 'logbookEntries', key: 'logbookEntries', defaultIdField: 'id' },
      { name: 'emargementClaims', key: 'emargementClaims', defaultIdField: 'id' },
      { name: 'archiveReleves', key: 'archiveReleves', defaultIdField: 'id' },
      { name: 'customUsers', key: 'customUsers', defaultIdField: 'id' }
    ];

    for (const col of collectionsToSeed) {
      const items = initialDb[col.key];
      if (items && Array.isArray(items) && items.length > 0) {
        console.log(`Seeding collection ${col.name} with ${items.length} items using batch...`);
        const batch = writeBatch(db);
        
        for (const item of items) {
          const docId = item[col.defaultIdField] || `seeded-${Math.random().toString(36).substr(2, 9)}`;
          const docRef = doc(db, col.name, docId);
          const sanitized = JSON.parse(JSON.stringify(item));
          batch.set(docRef, sanitized, { merge: true });
        }
        
        await batch.commit();
      }
    }

    // Seed config files
    if (initialDb.customClassesList) {
      await saveDocument('config', 'customClassesList', { list: initialDb.customClassesList });
    }
    if (initialDb.evalCoefficients) {
      await saveDocument('config', 'evalCoefficients', { coefs: initialDb.evalCoefficients });
    }
    if (initialDb.customEstablishmentHeaders) {
      await saveDocument('config', 'customEstablishmentHeaders', { headers: initialDb.customEstablishmentHeaders });
    }

    console.log('Firestore seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding Firestore database:', error);
  }
}

// Synchronize an entire collection with a local array
export async function syncCollectionWithArray<T extends { id?: string; className?: string }>(
  collectionName: string,
  localArray: T[],
  idField: keyof T = 'id'
) {
  if (!isFirebaseSyncActive()) return;

  try {
    // 1. Get all existing documents in this collection
    const snap = await getDocs(collection(db, collectionName));
    const dbIds = new Set<string>();
    snap.forEach((d) => {
      dbIds.add(d.id);
    });

    const localIds = new Set<string>();
    
    // 2. Add or update items using writeBatch for performance optimization
    if (localArray.length > 0) {
      const batch = writeBatch(db);
      for (const item of localArray) {
        const docId = String(item[idField] || '');
        if (docId) {
          localIds.add(docId);
          const docRef = doc(db, collectionName, docId);
          const sanitized = JSON.parse(JSON.stringify(item));
          batch.set(docRef, sanitized, { merge: true });
        }
      }
      await batch.commit();
    }

    // 3. Delete any orphaned items in database using writeBatch
    const orphanedIds = Array.from(dbIds).filter(dbId => !localIds.has(dbId));
    if (orphanedIds.length > 0) {
      const deleteBatch = writeBatch(db);
      for (const dbId of orphanedIds) {
        const docRef = doc(db, collectionName, dbId);
        deleteBatch.delete(docRef);
      }
      await deleteBatch.commit();
    }
  } catch (err) {
    console.error(`Error syncing array with collection ${collectionName}:`, err);
  }
}