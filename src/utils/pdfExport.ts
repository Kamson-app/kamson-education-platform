/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';

import type {
  EstablishmentSettings,
  CouncilReport,
  StudentGrade,
  APCPrepFiche
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

type PDFSettings = EstablishmentSettings & {
  country?: string;
  countryEnglish?: string;

  ministry?: string;
  ministryEnglish?: string;

  region?: string;
  regionFr?: string;
  regionEn?: string;

  delegation?: string;
  subDelegation?: string;

  departementFr?: string;
  departementEn?: string;

  establishmentName?: string;
  establishmentNameEnglish?: string;

  schoolName?: string;
  schoolNameEnglish?: string;

  etablissementFr?: string;
  etablissementEn?: string;

  departmentName?: string;

  discipline?: string;

  academicYear?: string;
  anneeScolaire?: string;

  trimester?: string;
  trimestre?: string;

  dateRapport?: string;
  reportDate?: string;

  town?: string;

  logoUrl?: string;

  enseignant?: string;
  animateurPedagogique?: string;
  administration?: string;
};

// ============================================================================
// OUTILS
// ============================================================================

function getValue(
  settings: EstablishmentSettings,
  ...keys: string[]
): string {
  const source =
    settings as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = source[key];

    if (
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      return value.trim();
    }
  }

  return '';
}

function getRegion(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'regionFr',
    'region',
    'delegation'
  );
}

function getRegionEn(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'regionEn',
    'region',
    'delegation'
  );
}

function getDepartment(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'departementFr',
    'departmentName',
    'department',
    'delegation'
  );
}

function getDepartmentEn(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'departementEn',
    'departmentName',
    'department',
    'delegation'
  );
}

function getSchoolFr(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'etablissementFr',
    'establishmentName',
    'schoolName'
  );
}

function getSchoolEn(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'etablissementEn',
    'schoolNameEnglish',
    'establishmentName',
    'schoolName'
  );
}

function getDiscipline(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'discipline',
    'subject'
  );
}

function getAcademicYear(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'anneeScolaire',
    'academicYear'
  );
}

function getTrimester(
  settings: EstablishmentSettings
): string {
  return getValue(
    settings,
    'trimestre',
    'trimester'
  );
}

// ============================================================================
// LOGO
// ============================================================================

async function imageUrlToDataUrl(
  url: string
): Promise<string | null> {
  try {
    if (!url) {
      return null;
    }

    /*
     * Si le logo est déjà enregistré en Base64,
     * aucune conversion supplémentaire n'est nécessaire.
     */
    if (
      url.startsWith('data:image/')
    ) {
      return url;
    }

    const response =
      await fetch(url);

    if (!response.ok) {
      console.warn(
        'Impossible de charger le logo :',
        response.status
      );

      return null;
    }

    const blob =
      await response.blob();

    return await new Promise<string | null>(
      (resolve) => {
        const reader =
          new FileReader();

        reader.onloadend = () => {
          resolve(
            typeof reader.result === 'string'
              ? reader.result
              : null
          );
        };

        reader.onerror = () => {
          resolve(null);
        };

        reader.readAsDataURL(blob);
      }
    );
  } catch (error) {
    console.warn(
      'Erreur lors du chargement du logo :',
      error
    );

    return null;
  }
}

async function drawCenterLogo(
  doc: jsPDF,
  settings: EstablishmentSettings
) {
  const pdfSettings =
    settings as PDFSettings;

  const logoUrl =
    pdfSettings.logoUrl?.trim();

  if (!logoUrl) {
    return;
  }

  const logo =
    await imageUrlToDataUrl(
      logoUrl
    );

  if (!logo) {
    return;
  }

  try {
    const pageWidth =
      doc.internal.pageSize.getWidth();

    /*
     * Zone centrale.
     *
     * Le logo remplace l'ancienne ligne
     * verticale centrale.
     */
    const logoWidth = 20;
    const logoHeight = 20;

    const x =
      pageWidth / 2 -
      logoWidth / 2;

    const y = 17;

    doc.addImage(
      logo,
      'PNG',
      x,
      y,
      logoWidth,
      logoHeight,
      undefined,
      'FAST'
    );
  } catch (error) {
    console.warn(
      'Impossible d’insérer le logo dans le PDF :',
      error
    );
  }
}

// ============================================================================
// NOUVELLE PAGE SANS EN-TÊTE
// ============================================================================

function addContinuationPage(
  doc: jsPDF
): number {
  doc.addPage();

  return 20;
}

// ============================================================================
// EN-TÊTE PORTRAIT
// ============================================================================

async function drawPortraitLetterhead(
  doc: jsPDF,
  settings: EstablishmentSettings
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const centerX =
    pageWidth / 2;

  const leftX =
    centerX / 2;

  const rightX =
    centerX + centerX / 2;

  const regionFr =
    getRegion(settings)
      .toUpperCase();

  const regionEn =
    getRegionEn(settings)
      .toUpperCase();

  const departmentFr =
    getDepartment(settings)
      .toUpperCase();

  const departmentEn =
    getDepartmentEn(settings)
      .toUpperCase();

  const schoolFr =
    getSchoolFr(settings)
      .toUpperCase();

  const schoolEn =
    getSchoolEn(settings)
      .toUpperCase();

  // ============================================================
  // POLICE GENERALE
  // ============================================================

  doc.setTextColor(
    0,
    0,
    0
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(7.5);

  // ============================================================
  // FRANÇAIS
  // INTERLIGNE TRÈS RÉDUIT
  // ============================================================

  doc.text(
    'REPUBLIQUE DU CAMEROUN',
    leftX,
    11,
    { align: 'center' }
  );

  doc.text(
    'Paix - Travail - Patrie',
    leftX,
    14,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    leftX,
    17,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'bold'
  );

  doc.text(
    'MINISTERE DES ENSEIGNEMENTS SECONDAIRES',
    leftX,
    20.5,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.text(
    '*********************',
    leftX,
    23.5,
    { align: 'center' }
  );

  doc.text(
    `DELEGATION REGIONALE DE ${regionFr}`,
    leftX,
    27,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    leftX,
    30,
    { align: 'center' }
  );

  doc.text(
    `DELEGATION DEPARTEMENTALE DU ${departmentFr}`,
    leftX,
    33.5,
    { align: 'center' }
  );

  // ============================================================
  // ANGLAIS
  // ============================================================

  doc.text(
    'REPUBLIC OF CAMEROON',
    rightX,
    11,
    { align: 'center' }
  );

  doc.text(
    'Peace - Work - Fatherland',
    rightX,
    14,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    rightX,
    17,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'bold'
  );

  doc.text(
    'MINISTRY OF SECONDARY EDUCATION',
    rightX,
    20.5,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.text(
    '*********************',
    rightX,
    23.5,
    { align: 'center' }
  );

  doc.text(
    `REGIONAL DELEGATION OF ${regionEn}`,
    rightX,
    27,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    rightX,
    30,
    { align: 'center' }
  );

  doc.text(
    `DIVISIONAL DELEGATION OF ${departmentEn}`,
    rightX,
    33.5,
    { align: 'center' }
  );

  // ============================================================
  // LOGO CENTRAL
  // ============================================================

  await drawCenterLogo(
    doc,
    settings
  );

  // ============================================================
  // ETABLISSEMENT
  // ============================================================

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(8.5);

  if (schoolFr) {
    doc.text(
      schoolFr,
      leftX,
      40,
      { align: 'center' }
    );
  }

  if (schoolEn) {
    doc.text(
      schoolEn,
      rightX,
      40,
      { align: 'center' }
    );
  }

  // ============================================================
  // LIGNE SOUS L'EN-TÊTE
  // ============================================================

  doc.setDrawColor(
    0,
    0,
    0
  );

  doc.setLineWidth(
    0.4
  );

  doc.line(
    15,
    44,
    pageWidth - 15,
    44
  );
}

// ============================================================================
// EN-TÊTE PAYSAGE
// ============================================================================

async function drawLandscapeLetterhead(
  doc: jsPDF,
  settings: EstablishmentSettings
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const centerX =
    pageWidth / 2;

  const leftX =
    centerX / 2;

  const rightX =
    centerX + centerX / 2;

  const regionFr =
    getRegion(settings)
      .toUpperCase();

  const regionEn =
    getRegionEn(settings)
      .toUpperCase();

  const departmentFr =
    getDepartment(settings)
      .toUpperCase();

  const departmentEn =
    getDepartmentEn(settings)
      .toUpperCase();

  const schoolFr =
    getSchoolFr(settings)
      .toUpperCase();

  const schoolEn =
    getSchoolEn(settings)
      .toUpperCase();

  // ============================================================
  // POLICE
  // ============================================================

  doc.setTextColor(
    0,
    0,
    0
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(8);

  // ============================================================
  // FRANÇAIS
  // ============================================================

  doc.text(
    'REPUBLIQUE DU CAMEROUN',
    leftX,
    11,
    { align: 'center' }
  );

  doc.text(
    'Paix - Travail - Patrie',
    leftX,
    14,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    leftX,
    17,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'bold'
  );

  doc.text(
    'MINISTERE DES ENSEIGNEMENTS SECONDAIRES',
    leftX,
    20.5,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.text(
    '*********************',
    leftX,
    23.5,
    { align: 'center' }
  );

  doc.text(
    `DELEGATION REGIONALE DE ${regionFr}`,
    leftX,
    27,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    leftX,
    30,
    { align: 'center' }
  );

  doc.text(
    `DELEGATION DEPARTEMENTALE DU ${departmentFr}`,
    leftX,
    33.5,
    { align: 'center' }
  );

  // ============================================================
  // ANGLAIS
  // ============================================================

  doc.text(
    'REPUBLIC OF CAMEROON',
    rightX,
    11,
    { align: 'center' }
  );

  doc.text(
    'Peace - Work - Fatherland',
    rightX,
    14,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    rightX,
    17,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'bold'
  );

  doc.text(
    'MINISTRY OF SECONDARY EDUCATION',
    rightX,
    20.5,
    { align: 'center' }
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.text(
    '*********************',
    rightX,
    23.5,
    { align: 'center' }
  );

  doc.text(
    `REGIONAL DELEGATION OF ${regionEn}`,
    rightX,
    27,
    { align: 'center' }
  );

  doc.text(
    '*********************',
    rightX,
    30,
    { align: 'center' }
  );

  doc.text(
    `DIVISIONAL DELEGATION OF ${departmentEn}`,
    rightX,
    33.5,
    { align: 'center' }
  );

  // ============================================================
  // LOGO
  // ============================================================

  await drawCenterLogo(
    doc,
    settings
  );

  // ============================================================
  // ETABLISSEMENT
  // ============================================================

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(9);

  if (schoolFr) {
    doc.text(
      schoolFr,
      leftX,
      40,
      { align: 'center' }
    );
  }

  if (schoolEn) {
    doc.text(
      schoolEn,
      rightX,
      40,
      { align: 'center' }
    );
  }

  // ============================================================
  // LIGNE SOUS L'EN-TÊTE
  // ============================================================

  doc.setDrawColor(
    0,
    0,
    0
  );

  doc.setLineWidth(
    0.4
  );

  doc.line(
    15,
    44,
    pageWidth - 15,
    44
  );
}

// ============================================================================
// PIED DE PAGE
// ============================================================================

function drawFooter(
  doc: jsPDF,
  pageNumber: number,
  totalPages: number
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(7);

  doc.setTextColor(
    100,
    100,
    100
  );

  doc.text(
    'Document administratif - MINESEC',
    15,
    pageHeight - 8
  );

  doc.text(
    `Page ${pageNumber} sur ${totalPages}`,
    pageWidth - 15,
    pageHeight - 8,
    { align: 'right' }
  );

  doc.setTextColor(
    0,
    0,
    0
  );
}

// ============================================================================
// RELEVE DE NOTES
// PORTRAIT
// ============================================================================

export async function exportGradeSheetToPDF(
  _students: StudentGrade[],
  className: string,
  subject: string,
  trimester: 1 | 2 | 3,
  est: EstablishmentSettings
) {
  const doc =
    new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

  await drawPortraitLetterhead(
    doc,
    est
  );

  const pageWidth =
    doc.internal.pageSize.getWidth();

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(14);

  doc.text(
    'RELEVE DE NOTES SEQUENTIEL & TRIMESTRIEL',
    pageWidth / 2,
    58,
    {
      align: 'center'
    }
  );

  doc.setDrawColor(
    0,
    0,
    0
  );

  doc.line(
    25,
    62,
    pageWidth - 25,
    62
  );

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(10);

  doc.text(
    `Classe : ${className}`,
    15,
    73
  );

  doc.text(
    `Discipline : ${subject}`,
    15,
    82
  );

  doc.text(
    `Trimestre : ${trimester}e`,
    15,
    91
  );

  doc.text(
    `Année scolaire : ${getAcademicYear(est)}`,
    15,
    100
  );

  drawFooter(
    doc,
    1,
    1
  );

  doc.save(
    `Releve_de_Notes_${className}_${subject}.pdf`
  );
}

// ============================================================================
// PREMIER CONSEIL D'ENSEIGNEMENT
// PORTRAIT
// ============================================================================

export async function exportFirstCouncilToPDF(
  report: CouncilReport,
  est: EstablishmentSettings
) {
  const doc =
    new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  await drawPortraitLetterhead(
    doc,
    est
  );

  // ============================================================
  // TITRE
  // ============================================================

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(14);

  doc.text(
    "PROCES-VERBAL DU PREMIER CONSEIL D'ENSEIGNEMENT",
    pageWidth / 2,
    58,
    {
      align: 'center'
    }
  );

  doc.setDrawColor(
    0,
    0,
    0
  );

  doc.line(
    25,
    62,
    pageWidth - 25,
    62
  );

  // ============================================================
  // INFORMATIONS
  // ============================================================

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(9.5);

  doc.text(
    `Département : ${getDepartment(est)}`,
    15,
    72
  );

  doc.text(
    `Etablissement : ${getSchoolFr(est)}`,
    15,
    80
  );

  doc.text(
    `Discipline : ${getDiscipline(est)}`,
    15,
    88
  );

  doc.text(
    `Année scolaire : ${
      report.academicYear ||
      getAcademicYear(est)
    }`,
    15,
    96
  );

  if (report.date) {
    const date =
      new Date(report.date);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      doc.text(
        `Date : ${date.toLocaleDateString('fr-FR')}`,
        15,
        104
      );
    }
  }

  doc.line(
    15,
    110,
    pageWidth - 15,
    110
  );

  // ============================================================
  // ORDRE DU JOUR
  // ============================================================

  let y = 120;

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(11);

  doc.text(
    'I. ORDRE DU JOUR',
    15,
    y
  );

  y += 7;

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(9.5);

  const agenda =
    report.agenda || [];

  for (
    let i = 0;
    i < agenda.length;
    i++
  ) {
    const lines =
      doc.splitTextToSize(
        `${i + 1}. ${agenda[i]}`,
        pageWidth - 35
      );

    if (
      y +
        lines.length * 4.5 >
      pageHeight - 30
    ) {
      y =
        addContinuationPage(
          doc
        );
    }

    doc.text(
      lines,
      20,
      y
    );

    y +=
      lines.length * 4.5 +
      2;
  }

  // ============================================================
  // COMPTE RENDU
  // ============================================================

  y += 6;

  if (
    y >
    pageHeight - 45
  ) {
    y =
      addContinuationPage(
        doc
      );
  }

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(11);

  doc.text(
    'II. COMPTE RENDU DES DEBATS',
    15,
    y
  );

  y += 7;

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(9.5);

  const content =
    report.content || '';

  const contentLines =
    doc.splitTextToSize(
      content,
      pageWidth - 30
    );

  for (
    let i = 0;
    i < contentLines.length;
    i++
  ) {
    if (
      y >
      pageHeight - 25
    ) {
      y =
        addContinuationPage(
          doc
        );
      doc.setFont(
        'times',
        'normal'
      );
      doc.setFontSize(9.5);
    }

    doc.text(
      contentLines[i],
      15,
      y
    );

    y += 4.5;
  }

  // ============================================================
  // RESOLUTIONS
  // ============================================================

  y += 7;

  if (
    y >
    pageHeight - 55
  ) {
    y =
      addContinuationPage(
        doc
      );
  }

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(11);

  doc.text(
    'III. RESOLUTIONS ADOPTEES',
    15,
    y
  );

  y += 7;

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(9.5);

  const resolutions =
    report.resolutions || [];

  for (
    let i = 0;
    i < resolutions.length;
    i++
  ) {
    const lines =
      doc.splitTextToSize(
        `${i + 1}. ${resolutions[i]}`,
        pageWidth - 35
      );

    if (
      y +
        lines.length * 4.5 >
      pageHeight - 25
    ) {
      y =
        addContinuationPage(
          doc
        );
    }

    doc.text(
      lines,
      20,
      y
    );

    y +=
      lines.length * 4.5 +
      2;
  }

  // ============================================================
  // SIGNATAIRES
  // ============================================================

  if (
    y >
    pageHeight - 65
  ) {
    y =
      addContinuationPage(
        doc
      );
  }

  y += 12;

  const signatureY =
    y;

  const rapporteurX = 40;
  const animateurX =
    pageWidth / 2;
  const administrationX =
    pageWidth - 40;

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(9);

  doc.text(
    'Le Rapporteur de Séance',
    rapporteurX,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.text(
    "L'Animateur Pédagogique",
    animateurX,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.text(
    "L'Administration",
    administrationX,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.setFont(
    'times',
    'italic'
  );

  doc.setFontSize(8);

  doc.text(
    '(Signature)',
    rapporteurX,
    signatureY + 20,
    {
      align: 'center'
    }
  );

  doc.text(
    '(Signature & Cachet)',
    animateurX,
    signatureY + 20,
    {
      align: 'center'
    }
  );

  doc.text(
    '(Signature & Cachet)',
    administrationX,
    signatureY + 20,
    {
      align: 'center'
    }
  );

  // ============================================================
  // PIEDS DE PAGE
  // ============================================================

  const totalPages =
    doc.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);

    drawFooter(
      doc,
      page,
      totalPages
    );
  }

  const academicYear =
    report.academicYear ||
    getAcademicYear(est) ||
    'annee';

  doc.save(
    `PV_Premier_Conseil_${academicYear.replace(
      /\//g,
      '_'
    )}.pdf`
  );
}

// ============================================================================
// RAPPORT DE CONSEIL D'ENSEIGNEMENT DE FIN DE TRIMESTRE
// PAYSAGE
// ============================================================================

export async function exportTrimestrialCouncilToPDF(
  report: CouncilReport,
  est: EstablishmentSettings
) {
  const doc =
    new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  await drawLandscapeLetterhead(
    doc,
    est
  );

  // ============================================================
  // TITRE
  // ============================================================

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(15);

  doc.text(
    "RAPPORT DE CONSEIL D'ENSEIGNEMENT DE FIN DE TRIMESTRE",
    pageWidth / 2,
    58,
    {
      align: 'center'
    }
  );

  doc.setDrawColor(
    0,
    0,
    0
  );

  doc.line(
    50,
    62,
    pageWidth - 50,
    62
  );

  // ============================================================
  // INFORMATIONS
  // ============================================================

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(10);

  doc.text(
    `Département : ${getDepartment(est)}`,
    15,
    73
  );

  doc.text(
    `Etablissement : ${getSchoolFr(est)}`,
    pageWidth / 2,
    73,
    {
      align: 'center'
    }
  );

  doc.text(
    `Année scolaire : ${getAcademicYear(est)}`,
    pageWidth - 15,
    73,
    {
      align: 'right'
    }
  );

  doc.text(
    `Discipline : ${getDiscipline(est)}`,
    15,
    82
  );

  doc.text(
    `Trimestre : ${
      report.trimester ||
      getTrimester(est)
    }`,
    pageWidth / 2,
    82,
    {
      align: 'center'
    }
  );

  if (report.date) {
    const date =
      new Date(report.date);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      doc.text(
        `Date : ${date.toLocaleDateString('fr-FR')}`,
        pageWidth - 15,
        82,
        {
          align: 'right'
        }
      );
    }
  }

  doc.line(
    15,
    88,
    pageWidth - 15,
    88
  );

  // ============================================================
  // CONTENU
  // ============================================================

  let y = 100;

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(11);

  doc.text(
    'I. ORDRE DU JOUR',
    15,
    y
  );

  y += 7;

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(9.5);

  const agenda = [
    'Examen des résultats scolaires du trimestre',
    'Analyse de la couverture des heures d’enseignement',
    'Analyse de la couverture des programmes',
    'Examen des conditions de travail',
    'Examen des difficultés rencontrées',
    'Adoption des recommandations et résolutions'
  ];

  agenda.forEach(
    (
      item,
      index
    ) => {
      doc.text(
        `${index + 1}. ${item}`,
        20,
        y
      );

      y += 5;
    }
  );

  y += 5;

  doc.setFont(
    'times',
    'bold'
  );

  doc.text(
    'II. COMPTE RENDU DES DEBATS',
    15,
    y
  );

  y += 7;

  doc.setFont(
    'times',
    'normal'
  );

  const content =
    report.content || '';

  const contentLines =
    doc.splitTextToSize(
      content,
      pageWidth - 30
    );

  for (
    let i = 0;
    i < contentLines.length;
    i++
  ) {
    if (
      y > 175
    ) {
      doc.addPage();

      y = 20;

      doc.setFont(
        'times',
        'normal'
      );

      doc.setFontSize(9.5);
    }

    doc.text(
      contentLines[i],
      15,
      y
    );

    y += 4.5;
  }

  // ============================================================
  // SIGNATAIRES
  // ============================================================

  const signatureY = 185;

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(9.5);

  doc.text(
    'Le Rapporteur de Séance',
    50,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.text(
    "L'Animateur Pédagogique",
    pageWidth / 2,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.text(
    "L'Administration",
    pageWidth - 50,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.setFont(
    'times',
    'italic'
  );

  doc.setFontSize(8);

  doc.text(
    '(Signature)',
    50,
    signatureY + 16,
    {
      align: 'center'
    }
  );

  doc.text(
    '(Signature & Cachet)',
    pageWidth / 2,
    signatureY + 16,
    {
      align: 'center'
    }
  );

  doc.text(
    '(Signature & Cachet)',
    pageWidth - 50,
    signatureY + 16,
    {
      align: 'center'
    }
  );

  const totalPages =
    doc.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);

    drawFooter(
      doc,
      page,
      totalPages
    );
  }

  doc.save(
    `Rapport_Conseil_Trimestre_${
      report.trimester ||
      getTrimester(est) ||
      'trimestre'
    }.pdf`
  );
}

// ============================================================================
// FICHE DE PREPARATION APC
// PAYSAGE
// ============================================================================

export async function exportAPCPrepFicheToPDF(
  fiche: APCPrepFiche,
  est: EstablishmentSettings
) {
  const doc =
    new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  await drawLandscapeLetterhead(
    doc,
    est
  );

  // ============================================================
  // TITRE
  // ============================================================

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(14);

  doc.text(
    `FICHE DE PREPARATION APC : ${
      fiche.lessonName || ''
    }`,
    pageWidth / 2,
    58,
    {
      align: 'center'
    }
  );

  doc.setDrawColor(
    0,
    0,
    0
  );

  doc.line(
    40,
    62,
    pageWidth - 40,
    62
  );

  // ============================================================
  // INFORMATIONS
  // ============================================================

  doc.setFont(
    'times',
    'normal'
  );

  doc.setFontSize(10);

  let y = 73;

  doc.text(
    `Discipline : ${getDiscipline(est)}`,
    15,
    y
  );

  doc.text(
    `Classe : ${fiche.className || ''}`,
    pageWidth / 2,
    y,
    {
      align: 'center'
    }
  );

  doc.text(
    `Année scolaire : ${getAcademicYear(est)}`,
    pageWidth - 15,
    y,
    {
      align: 'right'
    }
  );

  y += 9;

  doc.text(
    `Leçon : ${fiche.lessonName || ''}`,
    15,
    y
  );

  y += 9;

  doc.text(
    `Chapitre : ${fiche.chapterName || ''}`,
    15,
    y
  );

  y += 9;

  doc.text(
    `Compétence ciblée : ${
      fiche.competenceTargeted || ''
    }`,
    15,
    y
  );

  // ============================================================
  // SIGNATAIRES
  // ============================================================

  const signatureY = 185;

  doc.setFont(
    'times',
    'bold'
  );

  doc.setFontSize(9.5);

  doc.text(
    "L'Enseignant",
    50,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.text(
    "L'Animateur Pédagogique",
    pageWidth / 2,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.text(
    "L'Administration",
    pageWidth - 50,
    signatureY,
    {
      align: 'center'
    }
  );

  doc.setFont(
    'times',
    'italic'
  );

  doc.setFontSize(8);

  doc.text(
    '(Signature)',
    50,
    signatureY + 16,
    {
      align: 'center'
    }
  );

  doc.text(
    '(Signature & Cachet)',
    pageWidth / 2,
    signatureY + 16,
    {
      align: 'center'
    }
  );

  doc.text(
    '(Signature & Cachet)',
    pageWidth - 50,
    signatureY + 16,
    {
      align: 'center'
    }
  );

  drawFooter(
    doc,
    1,
    1
  );

  const lessonName =
    fiche.lessonName ||
    'Fiche_APC';

  const safeName =
    lessonName.replace(
      /[^a-zA-Z0-9À-ÿ_-]/g,
      '_'
    );

  doc.save(
    `Fiche_APC_${safeName}.pdf`
  );
}