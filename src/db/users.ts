import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { enrollments, users } from './schema.ts';
import type { User, UserGender, UserRole } from '../types.ts';

const CHANCELLOR_EMAIL = 'mustaqeemshaikh004@gmail.com';

function mapUserRow(row: typeof users.$inferSelect): User {
  return {
    id: row.uid,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    role: (row.role as UserRole) || 'student',
    gender: (row.gender as UserGender) === 'female' ? 'female' : 'male',
    avatarUrl: row.avatarUrl || undefined,
    avatarStoragePath: row.avatarStoragePath || undefined,
    timezone: row.timezone || undefined,
    hasCustomPassword: Boolean(row.accessCode),
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    lastActive: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  profile?: {
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    gender?: UserGender;
    avatarUrl?: string;
    avatarStoragePath?: string;
  }
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const isChancellor = normalizedEmail === CHANCELLOR_EMAIL;
  const resolvedRole: UserRole = isChancellor ? 'admin' : (profile?.role || 'student');
  const firstName = profile?.firstName?.trim() || 'Scholar';
  const lastName = profile?.lastName?.trim() || 'User';
  const gender: UserGender = profile?.gender === 'female' ? 'female' : 'male';

  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        firstName,
        lastName,
        role: resolvedRole,
        gender,
        avatarUrl: profile?.avatarUrl || null,
        avatarStoragePath: profile?.avatarStoragePath || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          ...(isChancellor ? { role: 'admin' } : {}),
          ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
          ...(profile?.avatarStoragePath ? { avatarStoragePath: profile.avatarStoragePath } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    // If student previously enrolled via form using the same email under a temporary std-* uid,
    // carry those enrollments over to this authenticated uid so their dashboard shows all courses.
    if (normalizedEmail) {
      const sameEmailRows = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`);

      const legacyUids = sameEmailRows
        .map((r) => r.uid)
        .filter((otherUid) => otherUid && otherUid !== uid);

      for (const oldUid of legacyUids) {
        const priorEnrollments = await db
          .select()
          .from(enrollments)
          .where(eq(enrollments.userUid, oldUid));
        for (const enr of priorEnrollments) {
          await db
            .insert(enrollments)
            .values({
              courseId: enr.courseId,
              userUid: uid,
              status: enr.status || 'active',
            })
            .onConflictDoNothing();
        }
      }
    }

    return mapUserRow(result[0]);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUsersFromSql(): Promise<User[]> {
  try {
    const rows = await db.select().from(users);
    return rows.map(mapUserRow);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserByUidFromSql(uid: string): Promise<User | null> {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] ? mapUserRow(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserAvatarInSql(
  uid: string,
  avatarUrl: string,
  avatarStoragePath?: string
): Promise<User | null> {
  try {
    const updated = await db
      .update(users)
      .set({
        avatarUrl,
        ...(avatarStoragePath !== undefined ? { avatarStoragePath } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return updated[0] ? mapUserRow(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserTimezoneInSql(
  uid: string,
  timezone: string | null
): Promise<User | null> {
  try {
    const updated = await db
      .update(users)
      .set({
        timezone: timezone ? timezone.trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return updated[0] ? mapUserRow(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserPasswordInSql(
  uid: string,
  encodedAccessCode: string
): Promise<User | null> {
  try {
    const updated = await db
      .update(users)
      .set({
        accessCode: encodedAccessCode,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return updated[0] ? mapUserRow(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserCredentialsByEmailFromSql(email: string): Promise<{
  user: User;
  accessCode: string | null;
} | null> {
  try {
    const rows = await db.select().from(users);
    const matched = rows.find((r) => r.email.toLowerCase() === email.toLowerCase());
    if (!matched) return null;
    return {
      user: mapUserRow(matched),
      accessCode: matched.accessCode || null,
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createTeacherUserInSql(params: {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  accessCode: string;
}): Promise<User> {
  try {
    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: params.email.toLowerCase(),
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        role: 'teacher',
        gender: params.gender === 'female' ? 'female' : 'male',
        accessCode: params.accessCode,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          firstName: params.firstName.trim(),
          lastName: params.lastName.trim(),
          role: 'teacher',
          gender: params.gender === 'female' ? 'female' : 'male',
          accessCode: params.accessCode,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapUserRow(result[0]);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function registerAccountInSql(params: {
  uid?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'teacher';
  gender: UserGender;
  accessCode?: string | null;
  timezone?: string | null;
  failIfEmailExists?: boolean;
}): Promise<User> {
  try {
    const normalizedEmail = params.email.trim().toLowerCase();
    const existingRows = await db.select().from(users);
    const existing = existingRows.find((r) => r.email.toLowerCase() === normalizedEmail);
    if (existing) {
      if (params.failIfEmailExists) {
        const err = new Error('An account with this email already exists. Please sign in instead.') as Error & {
          statusCode?: number;
        };
        err.statusCode = 409;
        throw err;
      }
      return mapUserRow(existing);
    }

    const generatedUid =
      params.uid ||
      `${params.role === 'teacher' ? 'tch' : 'std'}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;

    const inserted = await db
      .insert(users)
      .values({
        uid: generatedUid,
        email: normalizedEmail,
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        role: params.role === 'teacher' ? 'teacher' : 'student',
        gender: params.gender === 'female' ? 'female' : 'male',
        accessCode: params.accessCode ?? null,
        timezone: params.timezone ? params.timezone.trim() : null,
      })
      .returning();

    return mapUserRow(inserted[0]);
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode === 409) {
      throw error;
    }
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteUserFromSql(uid: string): Promise<boolean> {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (!existing[0]) return false;
    if (existing[0].role === 'admin' && existing[0].uid === 'admin-mustaqeem') {
      throw new Error('Cannot delete Founding Administrator Mustaqeem.');
    }
    await db.delete(users).where(eq(users.uid, uid));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Founding Administrator')) {
      throw error;
    }
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
