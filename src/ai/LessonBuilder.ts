/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APCPrepFiche } from "../types";
import type { LessonResult } from "./LessonAgent";

function normalizeLesson(raw: any): LessonResult {

    return {

        header: {
            countryFr: raw.header?.countryFr ?? "",
            countryEn: raw.header?.countryEn ?? "",
            ministryFr: raw.header?.ministryFr ?? "",
            ministryEn: raw.header?.ministryEn ?? "",
            regionalDelegation: raw.header?.regionalDelegation ?? "",
            divisionalDelegation: raw.header?.divisionalDelegation ?? "",
            school: raw.header?.school ?? "",
            department: raw.header?.department ?? "",
            subject: raw.header?.subject ?? "",
            className: raw.header?.className ?? "",
            teacher: raw.header?.teacher ?? "",
            academicYear: raw.header?.academicYear ?? "",
            duration: raw.header?.duration ?? "",
            date: raw.header?.date ?? "",
            effectif: raw.header?.effectif ?? ""
        },

        administrative: {
            module: raw.administrative?.module ?? "",
            chapter: raw.administrative?.chapter ?? "",
            lesson: raw.administrative?.lesson ?? "",
            competence: raw.administrative?.competence ?? "",
            familySituation: raw.administrative?.familySituation ?? "",
            exampleSituation: raw.administrative?.exampleSituation ?? "",
            actionCategory: raw.administrative?.actionCategory ?? "",
            materialResources:
                raw.administrative?.materialResources ??
                raw.ressourcesMaterielles ??
                "",
            pedagogicalResources:
                raw.administrative?.pedagogicalResources ??
                raw.ressourcesPedagogiques ??
                ""
        },

        diagnostic: raw.diagnostic ?? {
            reviewQuestions: [],
            expectedAnswers: [],
            commonDifficulties: [],
            transition: ""
        },

        problemSituation:
            raw.problemSituation ??
            raw.situationProbleme ?? {
                realLifeContext: "",
                problem: "",
                studentTask: "",
                objective: ""
            },

        phases:
            Array.isArray(raw.phases)
                ? raw.phases
                : [],

        lessonContent:
            raw.lessonContent ?? {
                definitions:
                    raw.trace_ecrite_complete ?? "",
                rules: "",
                examples: "",
                counterExamples: "",
                applications: "",
                summary: ""
            },

        exercises:
            raw.exercises ?? {
                easy: [],
                medium: [],
                hard: [],
                corrections: raw.corrections ?? []
            },

        evaluation:
            raw.evaluation ?? {
                questions: [],
                successCriteria: [],
                grading:
                    raw.evaluation_formative_globale ?? "",
                competences: []
            },

        homework:
            raw.homework ?? {
                title: "Devoir",
                instruction:
                    raw.devoir ?? "",
                expectedWork:
                    raw.devoir ?? ""
            },

        annexes:
            raw.annexes ?? {
                tables: "",
                diagrams: "",
                vocabulary: [],
                remarks: ""
            }

    };

}

export class LessonBuilder {

  static build(
    lesson: LessonResult,
    previous: APCPrepFiche
  ): APCPrepFiche {

    lesson = normalizeLesson(lesson);
    console.log("===== LESSON NORMALIZED =====");
    console.log(lesson);

    const header = lesson.header ?? {};
    const administrative = lesson.administrative ?? {};
    const diagnostic = lesson.diagnostic ?? {};
    const problemSituation = lesson.problemSituation ?? {};

    return {

      ...previous,

      teacherName:
        header.teacher ?? previous.teacherName,

      subject:
        header.subject ?? previous.subject,

      className:
        header.className ?? previous.className,

      duration:
        header.duration ?? previous.duration,

      effectif:
        header.effectif ?? previous.effectif,

      date:
        header.date ?? previous.date,

      moduleName:
        administrative.module ?? previous.moduleName,

      chapterName:
        administrative.chapter ?? previous.chapterName,

      lessonName:
        administrative.lesson ?? previous.lessonName,

      competenceTargeted:
        administrative.competence ?? previous.competenceTargeted,

      familyOfSituation:
        administrative.familySituation ?? previous.familyOfSituation,

      exampleOfSituation:
        administrative.exampleSituation ?? previous.exampleOfSituation,

      categoryOfAction:
        administrative.actionCategory ?? previous.categoryOfAction,

      resources: {

        material:
          administrative.materialResources
            ? administrative.materialResources
            : [],

        pedagogical:
          administrative.pedagogicalResources
            ? administrative.pedagogicalResources
            : [],

        digital: [],

        bibliography: []

      },

      diagnostic: {

        reviewQuestions:
          diagnostic.reviewQuestions ?? [],

        expectedAnswers:
          diagnostic.expectedAnswers ?? [],

        commonDifficulties:
          diagnostic.commonDifficulties ?? [],

        transition:
          diagnostic.transition ?? ""

      },

      prerequisites: {

        reviewQuestions:
          diagnostic.reviewQuestions ?? [],

        expectedAnswers:
          diagnostic.expectedAnswers ?? [],

        commonDifficulties:
          diagnostic.commonDifficulties ?? [],

        transition:
          diagnostic.transition ?? ""

      },

      situationProbleme: {

        realLifeContext:
          problemSituation.realLifeContext ?? "",

        problem:
          problemSituation.problem ?? "",

        studentTask:
          problemSituation.studentTask ?? "",

        objective:
          problemSituation.objective ?? ""

      },

      steps:
        (lesson.phases ?? []).map((phase: any) => ({

          phase:
            phase.title ??
            phase.phase ??
            "",

          duration:
            phase.duration ??
            phase.duree ??
            "",

          objective:
            phase.objective ??
            phase.objectif ??
            "",

          teacherActivity:
            phase.teacherActivities ??
            phase.teacherActivity ??
            phase.activiteEnseignant ??
            phase.activites_enseignant ??
            "",

          studentActivity:
            phase.studentActivities ??
            phase.studentActivity ??
            phase.activiteEleve ??
            phase.activites_eleves ??
            "",

          teacherQuestions:
            Array.isArray(phase.teacherQuestions)
              ? phase.teacherQuestions
              : Array.isArray(phase.questions)
                ? phase.questions
                : phase.questions
                  ? [phase.questions]
                  : [],

          expectedResponses:
            Array.isArray(phase.expectedResponses)
              ? phase.expectedResponses
              : Array.isArray(phase.reponsesAttendues)
                ? phase.reponsesAttendues
                : phase.reponsesAttendues
                  ? [phase.reponsesAttendues]
                  : [],

          possibleErrors:
            Array.isArray(phase.possibleErrors)
              ? phase.possibleErrors
              : Array.isArray(phase.erreursFrequentes)
                ? phase.erreursFrequentes
                : phase.erreursFrequentes
                  ? [phase.erreursFrequentes]
                  : [],

          remediation:
            phase.remediation ??
            "",

          differentiation:
            phase.differentiation ??
            phase.differenciationPedagogique ??
            phase.differenciation_pedagogique ??
            "",

          writtenTrace:
            phase.writtenTrace ??
            phase.traceEcrite ??
            phase.trace_ecrite ??
            "",

          assessment:
            phase.assessment ??
            phase.evaluationFormative ??
            phase.evaluation_formative ??
            ""

        })),

      homework:

        lesson.homework?.expectedWork ??
        previous.homework,

      lessonContent: {

        definitions:
          lesson.lessonContent?.definitions
          ?? (lesson as any).trace_ecrite_complete
          ?? "",

        rules:
          lesson.lessonContent?.rules
          ?? "",

        examples:
          lesson.lessonContent?.examples
          ?? "",

        counterExamples:
          lesson.lessonContent?.counterExamples
          ?? "",

        applications:
          lesson.lessonContent?.applications
          ?? "",

        summary:
          lesson.lessonContent?.summary
          ?? ""

      },

      exercises: {

        easy:
          lesson.exercises?.easy
          ?? [],

        medium:
          lesson.exercises?.medium
          ?? [],

        hard:
          lesson.exercises?.hard
          ?? [],

        corrections:
          lesson.exercises?.corrections
          ?? (lesson as any).corrections
          ?? []

      },

      evaluation: {

        questions:
          lesson.evaluation?.questions
          ?? [],

        successCriteria:
          lesson.evaluation?.successCriteria
          ?? [],

        grading:
          lesson.evaluation?.grading
          ?? (lesson as any).evaluation_formative_globale
          ?? "",

        competences:
          lesson.evaluation?.competences
          ?? []

      },

      annexes: {

        tables:
          typeof lesson.annexes?.tables === 'string'
            ? lesson.annexes.tables
            : typeof (lesson as any).annexes === 'string'
              ? (lesson as any).annexes
              : "",

        diagrams:
          lesson.annexes?.diagrams
          ?? "",

        vocabulary:
          lesson.annexes?.vocabulary
          ?? [],

        remarks:
          lesson.annexes?.remarks
          ?? ""

      }

    };

  }

}