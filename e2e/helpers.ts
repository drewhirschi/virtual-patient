import prisma from "@/lib/prisma";

export function uniqueEmail(tag: string): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${tag}-${id}@example.test`;
}

export async function deleteUserByEmail(email: string): Promise<void> {
  // Cascade will clean sessions, accounts, patient actors, etc.
  await prisma.user.deleteMany({ where: { email } });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { accounts: true, patientActors: true },
  });
}
