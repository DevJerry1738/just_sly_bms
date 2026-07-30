import { BaseRepository } from "./base.repository";
import { db, type StaffSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";

// ---------------------------------------------------------------------------
// Credential generation helpers
// ---------------------------------------------------------------------------
const ADJECTIVES = ["Swift", "Bold", "Keen", "Bright", "Sure", "Calm", "Firm", "Fair"];
const NOUNS = ["Lion", "Eagle", "River", "Stone", "Star", "Cloud", "Forest", "Tide"];

function generateTemporaryPassword(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}${noun}${num}!`;
}

function generateEmployeeCode(count: number): string {
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}

export interface StaffCredentials {
  employeeCode: string;
  temporaryPassword: string;
  loginNote: string;
}

// ---------------------------------------------------------------------------
// StaffRepository
// ---------------------------------------------------------------------------
export class StaffRepository extends BaseRepository<StaffSchema> {
  constructor() {
    super("staff", db.staff);
  }

  /** Get all staff in a given branch */
  async getByBranch(branchId: string): Promise<StaffSchema[]> {
    return db.staff.where("branchId").equals(branchId).toArray();
  }

  /** Get active staff */
  async getActiveStaff(): Promise<StaffSchema[]> {
    const all = await this.getAll();
    return all.filter((s) => s.status === "active");
  }

  /**
   * Create a staff member.
   * Returns { staff, credentials } where credentials is set if manual onboarding was chosen.
   */
  async createStaff(
    data: Partial<StaffSchema>,
    mode: "invite" | "manual" = "manual"
  ): Promise<{ staff: StaffSchema; credentials: StaffCredentials | null }> {
    const count = (await this.getAll()).length;
    const employeeCode = data.employeeCode ?? generateEmployeeCode(count);
    const tempPassword = mode === "manual" ? generateTemporaryPassword() : null;

    const staff: StaffSchema = {
      id: data.id ?? crypto.randomUUID(),
      authUserId: data.authUserId,
      employeeCode,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      preferredName: data.preferredName,
      email: data.email ?? "",
      phone: data.phone,
      branchId: data.branchId ?? "",
      status: "active",
      employmentId: data.employmentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sync_status: "pending",
    };

    const saved = await this.create(staff);
    await DomainEvents.publish("STAFF_CREATED", {
      entity: "Staff",
      entityId: saved.id,
      record: saved,
      onboardingMode: mode,
    });

    const credentials: StaffCredentials | null =
      mode === "manual" && tempPassword
        ? {
            employeeCode,
            temporaryPassword: tempPassword,
            loginNote: `Welcome to Just Sly! Use your employee code "${employeeCode}" and the temporary password below to log in. You will be prompted to change your password on first login.`,
          }
        : null;

    return { staff: saved, credentials };
  }

  /** Update staff details */
  async updateStaff(id: string, updates: Partial<StaffSchema>): Promise<StaffSchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, { ...updates, updatedAt: Date.now(), sync_status: "pending" });
    await DomainEvents.publish("STAFF_UPDATED", { entity: "Staff", entityId: id, before, after: updated });
    return updated;
  }

  /** Change staff status */
  async setStaffStatus(
    id: string,
    status: "active" | "suspended" | "deactivated"
  ): Promise<StaffSchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, { status, updatedAt: Date.now(), sync_status: "pending" });
    await DomainEvents.publish("STAFF_STATUS_CHANGED", { entity: "Staff", entityId: id, before, status });
    return updated;
  }

  /** Generate a new temporary password for a staff member (for password reset) */
  async resetStaffPassword(id: string): Promise<StaffCredentials> {
    const staff = await this.getById(id);
    if (!staff) throw new Error(`Staff ${id} not found`);

    const tempPassword = generateTemporaryPassword();
    await DomainEvents.publish("PASSWORD_RESET_REQUESTED", { entity: "Staff", entityId: id, userId: staff.authUserId });

    return {
      employeeCode: staff.employeeCode ?? "",
      temporaryPassword: tempPassword,
      loginNote: `A new temporary password has been generated for ${staff.firstName} ${staff.lastName}. Please deliver it securely.`,
    };
  }
}

export const staffRepository = new StaffRepository();
