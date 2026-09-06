/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'db.json');

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'plateforme-kkj',
          },
        },
      });
    }
  }
  return aiClient;
}

// Initial empty database structure with minimal national institution defaults and empty collections
const getInitialDb = () => {
  return {
    establishment: {
      ministry: "MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES",
      region: "",
      delegation: "",
      establishmentName: "",
      academicYear: "",
      motto: "Paix - Travail - Patrie",
      town: "",
      departmentName: "",
      principalName: "",
      logoUrl: ""
    },
    studentsStats: [],
    gradeSheets: [],
    hourCoverages: [],
    programCoverages: [],
    apcPreps: [],
    exams: [],
    councilReports: [],
    departmentMessages: []
  };
};

// Ensure database state file exists and load it
const loadDb = () => {
  if (!fs.existsSync(DB_PATH)) {
    const initial = getInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error loading database, resetting to initial', err);
    return getInitialDb();
  }
};

const saveDb = (data: unknown) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

const CONFIG_PATH = path.join(process.cwd(), 'firebase-config.json');

// REST API Endpoints
app.get('/api/firebase-config', (req: Request, res: Response) => {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return res.json(JSON.parse(config));
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse config' });
    }
  }
  res.json({});
});

app.post('/api/firebase-config', (req: Request, res: Response) => {
  try {
    const config = req.body;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ success: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to write config: ' + errorMessage });
  }
});

app.get('/api/data', (req: Request, res: Response) => {
  const data = loadDb();
  res.json(data);
});

app.post('/api/data', (req: Request, res: Response) => {
  try {
    saveDb(req.body);
    res.json({ success: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to write data: ' + errorMessage });
  }
});

// Gemini AI API Proxy endpoint
app.post('/api/gemini/generate-apc', async (req: Request, res: Response) => {
  const { title, subject, className, chapterName, lessonName, competenceTargeted } = req.body;
  const ai = getAiClient();

  if (!ai) {
    // Graceful Demo Fallback Mode
    return res.json({
      demo: true,
      data: {
        id: 'apc-demo-' + Date.now(),
        title: title || `Fiche APC : ${lessonName}`,
        subject: subject || "Mathématiques",
        className: className || "Seconde C",
        duration: "2 heures",
        effectif: "55 élèves",
        date: new Date().toLocaleDateString('fr-FR'),
        teacherName: req.body.teacherName || "Enseignant",
        moduleName: "Module d'enseignement",
        chapterName: chapterName || "Chapitre",
        lessonName: lessonName || "Leçon",
        competenceTargeted: competenceTargeted || "Résoudre des situations-problèmes.",
        familyOfSituation: "Situation de référence",
        exampleOfSituation: "Exemple concret",
        categoryOfAction: "Catégorie d'action",
        resources: {
          material: "Tableau, craie, instruments",
          pedagogical: "Approche par compétences"
        },
        prerequisites: {
          recallQuestions: "1) Rappel de la notion précédente.",
          expectedAnswers: "Réponses attendues.",
          transition: "Transition vers la nouvelle leçon."
        },
        situationProbleme: {
          context: "Contexte de vie réelle au Cameroun.",
          problem: "Problème à résoudre.",
          task: "Tâches demandées aux élèves."
        },
        steps: [
          {
            phase: "A) Introduction / Découverte",
            duration: "20 min",
            teacherActivity: "Présentation de la situation.",
            studentActivity: "Observation et analyse.",
            writtenTrace: "Trace écrite initiale."
          }
        ],
        homework: "Exercices de consolidation."
      }
    });
  }

  try {
    const prompt = `Génère une fiche de préparation de leçon extrêmement complète, détaillée et longue, conforme à l'Approche Par Compétences (APC) en vigueur au sein du Ministère des Enseignements Secondaires du Cameroun (MINESEC).

    Informations d'entrée :
    - Discipline / Matière : ${subject}
    - Classe visée : ${className}
    - Chapitre officiel : ${chapterName}
    - Titre précis de la leçon : ${lessonName}
    - Compétence ciblée (APC) : ${competenceTargeted || "Résoudre une situation-problème complexe liée à ce thème"}

    Directives de génération absolues :
    1. Ne produis jamais une fiche de leçon résumée ou courte. Rédige de grands textes denses avec des explications complètes en français de haute tenue.
    2. Contextualise la "SITUATION PROBLÈME" dans la vie courante au Cameroun en utilisant des noms locaux camerounais.
    3. REGLE MATHEMATIQUE CRITIQUE : Pour toute expression mathématique, utilise le format Markdown avec LaTeX pour les exposants ($x^2$).

    Retourne STRICTEMENT un objet JSON unique respectant la structure TypeScript suivante, sans bloc de code (\`\`\`json etc.) ni aucun texte de présentation avant ou après :
    {
      "moduleName": "Nom officiel complet du module",
      "familyOfSituation": "La famille de situation APC",
      "exampleOfSituation": "Un exemple concret",
      "categoryOfAction": "La catégorie d'action",
      "duration": "2 heures",
      "effectif": "50 élèves",
      "date": "2026-10-15",
      "resources": {
        "material": "Ressources matérielles",
        "pedagogical": "Méthode pédagogique"
      },
      "prerequisites": {
        "recallQuestions": "Questions de rappel",
        "expectedAnswers": "Réponses attendues",
        "transition": "Transition"
      },
      "situationProbleme": {
        "context": "Contexte réaliste au Cameroun",
        "problem": "Problème à résoudre",
        "task": "Tâches de l'élève"
      },
      "steps": [
        {
          "phase": "A) Introduction / Découverte",
          "duration": "20 min",
          "teacherActivity": "Activité de l'enseignant",
          "studentActivity": "Activité des élèves",
          "writtenTrace": "Trace écrite"
        }
      ],
      "homework": "Exercices à domicile"
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const text = response.text || '{}';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);

    res.json({
      demo: false,
      data: {
        id: 'apc-' + Date.now(),
        title: title || `Fiche APC : ${lessonName}`,
        subject: subject,
        className: className,
        teacherName: req.body.teacherName || "Enseignant",
        createdAt: new Date().toISOString(),
        ...parsedData
      }
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate APC lesson: ' + errorMessage });
  }
});

app.post('/api/gemini/generate-exam', async (req: Request, res: Response) => {
  const { subject, className, examType, duration, coefficient } = req.body;
  const ai = getAiClient();

  if (!ai) {
    return res.json({
      demo: true,
      data: {
        id: 'exam-demo-' + Date.now(),
        title: `Évaluation de ${subject} - Type ${examType}`,
        subject,
        examType,
        className,
        duration: duration || "3 heures",
        coefficient: coefficient || 4,
        instructions: "L'usage de la calculatrice est autorisé.",
        sections: [
          {
            title: "Partie A : Évaluation des ressources (15 points)",
            points: 15,
            content: "Exercice 1 : Restitution de connaissances\nExercice 2 : Application directe"
          },
          {
            title: "Partie B : Évaluation des compétences (5 points)",
            points: 5,
            content: "Situation-problème contextualisée."
          }
        ],
        markingScheme: "Barème détaillé."
      }
    });
  }

  try {
    const prompt = `Génère un sujet d'examen officiel de type Camerounais (${examType}) pour la classe de ${className} dans la matière ${subject}.
    Le sujet doit respecter les normes administratives du MINESEC (Partie A: Évaluation des ressources 15 points, Partie B: Évaluation des compétences 5 points).
    Durée: ${duration || "3 heures"}, Coefficient: ${coefficient || 4}.
    
    Retourne STRICTEMENT un objet JSON conforme à cette structure sans aucun texte superflu :
    {
      "instructions": "Instructions pour le candidat",
      "sections": [
        {
          "title": "Partie A : Évaluation des ressources (15 points)",
          "points": 15,
          "content": "Exercices..."
        },
        {
          "title": "Partie B : Évaluation des compétences (5 points)",
          "points": 5,
          "content": "Situation-problème..."
        }
      ],
      "markingScheme": "Corrigé indicatif."
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const text = response.text || '{}';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);

    res.json({
      demo: false,
      data: {
        id: 'exam-' + Date.now(),
        title: `Évaluation - ${subject}`,
        subject,
        examType,
        className,
        duration: duration || "3 heures",
        coefficient: coefficient || 4,
        createdAt: new Date().toISOString(),
        ...parsedData
      }
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate exam: ' + errorMessage });
  }
});

app.post('/api/gemini/generate-report', async (req: Request, res: Response) => {
  const { type, trimester, establishment } = req.body;
  const ai = getAiClient();

  const fallbackTrimesterJson = {
    introduction: "Introduction du rapport trimestriel conforme aux exigences du MINESEC.",
    hoursAnalysis: "Analyse de la couverture horaire.",
    programsCommentary: "Commentaire sur l'avancement des programmes.",
    difficulties: {
      pedagogical: ["Hétérogénéité des niveaux."],
      material: ["Insuffisance de manuels."],
      administrative: ["Contraintes de calendrier."],
      learners: ["Absentéisme ponctuel."]
    },
    resolutions: ["Intensification du suivi pédagogique."]
  };

  if (!ai) {
    if (type === 'PREMIER_CONSEIL') {
      return res.json({
        demo: true,
        report: "Compte-rendu du premier conseil d'enseignement établi selon les normes réglementaires."
      });
    }
    return res.json({
      demo: true,
      report: JSON.stringify(fallbackTrimesterJson)
    });
  }

  try {
    if (type === 'PREMIER_CONSEIL') {
      const prompt = `Rédige un compte-rendu administratif narratif très formel et détaillé en français pour le premier conseil d'enseignement.
      Matière/Département: ${establishment.departmentName}
      Établissement: ${establishment.establishmentName}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      let cleanText = (response.text || '').replace(/[*#_\-`|]/g, '').trim();
      return res.json({
        demo: false,
        report: cleanText
      });
    } else {
      const prompt = `Génère le contenu textuel d'un rapport de conseil d'enseignement trimestriel officiel (MINESEC).
      Retourne STRICTEMENT un objet JSON sans Markdown avec les clés : introduction, hoursAnalysis, programsCommentary, difficulties (pedagogical, material, administrative, learners), resolutions.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      const text = response.text || '{}';
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        JSON.parse(cleanText);
        res.json({
          demo: false,
          report: cleanText
        });
      } catch (jsonErr) {
        res.json({
          demo: true,
          report: JSON.stringify(fallbackTrimesterJson)
        });
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate report text: ' + errorMessage });
  }
});

app.post('/api/gemini/parse-progression', async (req: Request, res: Response) => {
  const { text } = req.body;
  const ai = getAiClient();

  if (!ai) {
    return res.json({ demo: true, lessons: [] });
  }

  try {
    const prompt = `Analyse le texte de progression pédagogique et extrait chaque chapitre sous forme de tableau JSON strict : [ { "title": "...", "plannedTrimester": 1, "status": "PLANNED", "doneDate": null } ]`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const resultText = response.text || '[]';
    const cleanText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    res.json({ demo: false, lessons: parsed });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to parse progression: ' + errorMessage });
  }
});

app.post('/api/gemini/generate-exam-structure', async (req: Request, res: Response) => {
  const { subject, className, chapterName } = req.body;
  const ai = getAiClient();

  const fallbackData = {
    instructions: "Traiter toutes les parties.",
    sections: [
      { title: "Partie A : Évaluation des ressources (15 points)", points: 15, content: "Exercices..." },
      { title: "Partie B : Évaluation des compétences (5 points)", points: 5, content: "Situation-problème..." }
    ],
    markingScheme: "Corrigé indicatif."
  };

  if (!ai) {
    return res.json({ demo: true, data: fallbackData });
  }

  try {
    const prompt = `Génère une structure d'épreuve type APC pour ${subject} (${className}) sur le chapitre ${chapterName}. Retourne un objet JSON strict avec instructions, sections et markingScheme.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const resultText = response.text || '{}';
    const cleanText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    res.json({ demo: false, data: JSON.parse(cleanText) });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate exam structure: ' + errorMessage });
  }
});

app.post('/api/gemini/generate-exercises', async (req: Request, res: Response) => {
  const { chapterName } = req.body;
  const fallbackData = {
    chapter: chapterName || 'Généralités',
    applicationExercises: [],
    consolidationExercises: [],
    supervisedWorks: []
  };
  res.json({ demo: true, data: fallbackData });
});

app.post('/api/gemini/proofread-exam', async (req: Request, res: Response) => {
  const { instructions, sections, markingScheme } = req.body;
  res.json({
    demo: true,
    data: {
      correctedInstructions: instructions,
      correctedSections: sections,
      correctedMarkingScheme: markingScheme,
      corrections: []
    }
  });
});

// Vite Middleware & SPA Static fallback routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ConseilEnseignement] Server running on port ${PORT}`);
  });
}

startServer();