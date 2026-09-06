import type { User, EstablishmentSettings } from "../types";

export function getUserProfile(
  currentUser: User | null,
  establishment: EstablishmentSettings
) {
  return {
    name: currentUser?.name || "",

    discipline:
      currentUser?.discipline ||
      currentUser?.subject ||
      establishment.departmentName ||
      "",

    establishment:
      currentUser?.establishment ||
      establishment.establishmentName ||
      "",

    academicYear:
      currentUser?.academicYear ||
      establishment.academicYear ||
      "",

    role:
      currentUser?.role || "ENSEIGNANT",
  };
}