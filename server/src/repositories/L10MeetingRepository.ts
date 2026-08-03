import type { L10Meeting, L10MeetingRating, MeetingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface MeetingFilters {
  status?: MeetingStatus;
}

export interface CreateMeetingInput {
  meetingDate: Date;
  facilitatorUserId: string;
}

export type UpdateMeetingInput = Partial<{
  meetingDate: Date;
  facilitatorUserId: string;
  status: MeetingStatus;
  segueNotes: string | null;
  headlines: string | null;
  concludeNotes: string | null;
  overallRating: number | null;
  timerStartedAt: Date | null;
  timerAccumulatedSeconds: number;
  timerIsPaused: boolean;
  currentSectionId: string | null;
  currentSectionStartedAt: Date | null;
  currentSectionAccumulatedSeconds: number;
}>;

export interface MeetingRatingWithUser extends L10MeetingRating {
  user: { id: string; fullName: string; avatarUrl: string | null };
}

export interface L10MeetingWithRatings extends L10Meeting {
  ratings: MeetingRatingWithUser[];
}

export class L10MeetingRepository {
  constructor(private tenantId: string) {}

  findAll(filters: MeetingFilters = {}): Promise<L10Meeting[]> {
    return prisma.l10Meeting.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { meetingDate: 'desc' },
    });
  }

  findById(id: string): Promise<L10Meeting | null> {
    return prisma.l10Meeting.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  create(data: CreateMeetingInput, createdByUserId: string): Promise<L10Meeting> {
    return prisma.l10Meeting.create({
      data: { ...data, tenantId: this.tenantId, status: 'scheduled', createdByUserId, updatedByUserId: createdByUserId },
    });
  }

  async update(id: string, data: UpdateMeetingInput, updatedByUserId: string): Promise<L10Meeting | null> {
    const result = await prisma.l10Meeting.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.l10Meeting.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }

  // ─────────────────────────────────────────────
  // RATINGS INDIVIDUALES
  // ─────────────────────────────────────────────

  /**
   * Obtiene una reunión con sus ratings individuales
   */
  findByIdWithRatings(id: string): Promise<L10MeetingWithRatings | null> {
    return prisma.l10Meeting.findFirst({
      where: { id, tenantId: this.tenantId },
      include: {
        ratings: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Obtiene los ratings de una reunión
   */
  getRatings(meetingId: string): Promise<MeetingRatingWithUser[]> {
    return prisma.l10MeetingRating.findMany({
      where: { meetingId, tenantId: this.tenantId },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Añade o actualiza el rating de un usuario para una reunión.
   * Recalcula el overallRating como promedio de todos los ratings.
   */
  async upsertRating(meetingId: string, targetUserId: string, rating: number): Promise<MeetingRatingWithUser> {
    const upsertedRating = await prisma.l10MeetingRating.upsert({
      where: { meetingId_userId: { meetingId, userId: targetUserId } },
      create: {
        tenantId: this.tenantId,
        meetingId,
        userId: targetUserId,
        rating,
      },
      update: { rating },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Recalcular overallRating como promedio
    const allRatings = await prisma.l10MeetingRating.findMany({
      where: { meetingId, tenantId: this.tenantId },
      select: { rating: true },
    });
    const avg = allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
      : null;

    await prisma.l10Meeting.updateMany({
      where: { id: meetingId, tenantId: this.tenantId },
      data: { overallRating: avg },
    });

    return upsertedRating;
  }

  /**
   * Elimina el rating de un usuario para una reunión
   */
  async deleteRating(meetingId: string, userId: string): Promise<boolean> {
    const result = await prisma.l10MeetingRating.deleteMany({
      where: { meetingId, userId, tenantId: this.tenantId },
    });

    // Recalcular overallRating
    const allRatings = await prisma.l10MeetingRating.findMany({
      where: { meetingId, tenantId: this.tenantId },
      select: { rating: true },
    });
    const avg = allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
      : null;

    await prisma.l10Meeting.updateMany({
      where: { id: meetingId, tenantId: this.tenantId },
      data: { overallRating: avg },
    });

    return result.count > 0;
  }
}
