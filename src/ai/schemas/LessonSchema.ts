/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const LessonSchema = {

  type: "object",

  properties: {

    header: {

      type: "object",

      properties: {

        countryFr: { type: "string" },
        countryEn: { type: "string" },
        ministryFr: { type: "string" },
        ministryEn: { type: "string" },
        regionalDelegation: { type: "string" },
        divisionalDelegation: { type: "string" },
        school: { type: "string" },
        department: { type: "string" },
        subject: { type: "string" },
        className: { type: "string" },
        teacher: { type: "string" },
        academicYear: { type: "string" },
        duration: { type: "string" },
        date: { type: "string" },
        effectif: { type: "string" }

      }

    },

    administrative: {

      type: "object",

      properties: {

        module: { type: "string" },
        chapter: { type: "string" },
        lesson: { type: "string" },
        competence: { type: "string" },
        familySituation: { type: "string" },
        exampleSituation: { type: "string" },
        actionCategory: { type: "string" },

        materialResources: {

          type: "array",

          items: {

            type: "string"

          }

        },

        pedagogicalResources: {

          type: "array",

          items: {

            type: "string"

          }

        }

      }

    },

    diagnostic: {

      type: "object",

      properties: {

        reviewQuestions: {

          type: "array",

          items: {

            type: "string"

          }

        },

        expectedAnswers: {

          type: "array",

          items: {

            type: "string"

          }

        },

        commonDifficulties: {

          type: "array",

          items: {

            type: "string"

          }

        },

        transition: {

          type: "string"

        }

      }

    },

    problemSituation: {

      type: "object",

      properties: {

        realLifeContext: {

          type: "string"

        },

        problem: {

          type: "string"

        },

        studentTask: {

          type: "string"

        },

        objective: {

          type: "string"

        }

      }

    },

    phases: {

      type: "array",

      items: {

        type: "object",

        properties: {

          title: { type: "string" },

          duration: { type: "string" },

          objective: { type: "string" },

          teacherActivities: { type: "string" },

          studentActivities: { type: "string" },

          teacherQuestions: {

            type: "array",

            items: {

              type: "string"

            }

          },

          expectedResponses: {

            type: "array",

            items: {

              type: "string"

            }

          },

          possibleErrors: {

            type: "array",

            items: {

              type: "string"

            }

          },

          remediation: { type: "string" },

          differentiation: { type: "string" },

          writtenTrace: { type: "string" },

          assessment: { type: "string" }

        }

      }

    },

    lessonContent: {

      type: "object",

      properties: {

        definitions: { type: "string" },

        rules: { type: "string" },

        examples: { type: "string" },

        counterExamples: { type: "string" },

        applications: { type: "string" },

        summary: { type: "string" }

      }

    },

    exercises: {

      type: "object",

      properties: {

        easy: {

          type: "array",

          items: {

            type: "string"

          }

        },

        medium: {

          type: "array",

          items: {

            type: "string"

          }

        },

        hard: {

          type: "array",

          items: {

            type: "string"

          }

        },

        corrections: {

          type: "array",

          items: {

            type: "string"

          }

        }

      }

    },

    evaluation: {

      type: "object",

      properties: {

        questions: {

          type: "array",

          items: {

            type: "string"

          }

        },

        successCriteria: {

          type: "array",

          items: {

            type: "string"

          }

        },

        grading: {

          type: "string"

        },

        competences: {

          type: "array",

          items: {

            type: "string"

          }

        }

      }

    },

    homework: {

      type: "object",

      properties: {

        title: { type: "string" },

        instruction: { type: "string" },

        expectedWork: { type: "string" }

      }

    },

    annexes: {

      type: "object",

      properties: {

        tables: { type: "string" },

        diagrams: { type: "string" },

        vocabulary: {

          type: "array",

          items: {

            type: "string"

          }

        },

        remarks: { type: "string" }

      }

    }

  }

} as const;