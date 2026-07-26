import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  documentId,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export type WhereCondition = {
  field: string;
  op: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains" | "array-contains-any";
  value: unknown;
};

export type OrderByCondition = {
  field: string;
  direction?: "asc" | "desc";
};

export type QueryOptions = {
  conditions?: WhereCondition[];
  orderBy?: OrderByCondition[];
  limitCount?: number;
  startAfterDoc?: DocumentData;
};

async function getDocById(collectionName: string, id: string): Promise<Record<string, any> | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getDocsFromCollection(
  collectionName: string,
  options?: QueryOptions
): Promise<Record<string, any>[]> {
  const constraints: QueryConstraint[] = [];

  if (options?.conditions) {
    for (const c of options.conditions) {
      constraints.push(where(c.field, c.op as any, c.value as any));
    }
  }

  if (options?.orderBy) {
    for (const o of options.orderBy) {
      constraints.push(orderBy(o.field, o.direction ?? "asc"));
    }
  }

  if (options?.startAfterDoc) {
    constraints.push(startAfter(options.startAfterDoc));
  }

  if (options?.limitCount) {
    constraints.push(fbLimit(options.limitCount));
  }

  const q = constraints.length > 0
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function addDocToCollection(
  collectionName: string,
  data: DocumentData
): Promise<string> {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

async function setDocById(
  collectionName: string,
  id: string,
  data: DocumentData,
  merge = true
): Promise<void> {
  await setDoc(doc(db, collectionName, id), data, { merge });
}

async function updateDocById(
  collectionName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), data);
}

async function deleteDocById(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

function addArrayItem(collectionName: string, id: string, field: string, value: unknown): Promise<void> {
  return updateDoc(doc(db, collectionName, id), { [field]: arrayUnion(value) });
}

function removeArrayItem(collectionName: string, id: string, field: string, value: unknown): Promise<void> {
  return updateDoc(doc(db, collectionName, id), { [field]: arrayRemove(value) });
}

function incrementField(collectionName: string, id: string, field: string, amount: number): Promise<void> {
  return updateDoc(doc(db, collectionName, id), { [field]: increment(amount) });
}

function subscribeToDoc(
  collectionName: string,
  id: string,
  callback: (data: DocumentData | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, collectionName, id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

function subscribeToCollection(
  collectionName: string,
  callback: (data: DocumentData[]) => void,
  options?: QueryOptions
): Unsubscribe {
  const constraints: QueryConstraint[] = [];

  if (options?.conditions) {
    for (const c of options.conditions) {
      constraints.push(where(c.field, c.op as any, c.value as any));
    }
  }
  if (options?.orderBy) {
    for (const o of options.orderBy) {
      constraints.push(orderBy(o.field, o.direction ?? "asc"));
    }
  }
  if (options?.limitCount) {
    constraints.push(fbLimit(options.limitCount));
  }

  const q = constraints.length > 0
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

function runBatch(operations: Array<{ type: "set" | "update" | "delete"; collection: string; id: string; data?: DocumentData }>): Promise<void> {
  const batch = writeBatch(db);
  for (const op of operations) {
    const ref = doc(db, op.collection, op.id);
    switch (op.type) {
      case "set":
        batch.set(ref, op.data ?? {}, { merge: true });
        break;
      case "update":
        batch.update(ref, op.data ?? {});
        break;
      case "delete":
        batch.delete(ref);
        break;
    }
  }
  return batch.commit();
}

export const db_ops = {
  get: getDocById,
  query: getDocsFromCollection,
  add: addDocToCollection,
  set: setDocById,
  update: updateDocById,
  delete: deleteDocById,
  addToArray: addArrayItem,
  removeFromArray: removeArrayItem,
  increment: incrementField,
  subscribeToDoc,
  subscribeToCollection,
  batch: runBatch,
  serverTimestamp,
};
