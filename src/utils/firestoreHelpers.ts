/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FirestoreDate } from '../types';

interface FirestoreTimestampWithToDate {
  toDate(): Date;
}

interface FirestoreTimestampWithSeconds {
  seconds: number;
}

function hasToDate(value: unknown): value is FirestoreTimestampWithToDate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  );
}

function hasSeconds(value: unknown): value is FirestoreTimestampWithSeconds {
  return (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  );
}

/**
 * Formate un objet de date Firestore (Timestamp, Date, string, etc.) en une chaîne lisible au format : jj/mm/aaaa à hh:mm.
 * Retourne "Date inconnue" si la valeur est invalide ou manquante.
 */
export function formatFirestoreDate(date: FirestoreDate): string {
  if (!date) {
    return 'Date inconnue';
  }

  let parsedDate: Date | null = null;

  try {
    if (hasToDate(date)) {
      parsedDate = date.toDate();
    } else if (hasSeconds(date)) {
      parsedDate = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      parsedDate = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      const tempDate = new Date(date);
      if (!isNaN(tempDate.getTime())) {
        parsedDate = tempDate;
      }
    }
  } catch {
    return 'Date inconnue';
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    if (typeof date === 'string') {
      return date;
    }
    return 'Date inconnue';
  }

  const formattedString = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsedDate);

  return formattedString.replace(',', ' à');
}