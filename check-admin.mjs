import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] } },
    select: { id: true, fullName: true, username: true, email: true, phone: true, role: true },
  });

  if (admins.length > 0) {
    console.log("FOUND_ADMINS:", JSON.stringify(admins));
    const passHash = await bcrypt.hash("Admin@123456", 12);
    await prisma.user.update({
      where: { id: admins[0].id },
      data: { passwordHash: passHash, status: UserStatus.ACTIVE },
    });
    console.log("UPDATED_PASSWORD_TO: Admin@123456 for admin:", admins[0].username || admins[0].email || admins[0].phone);
  } else {
    const passHash = await bcrypt.hash("Admin@123456", 12);
    const newAdmin = await prisma.user.create({
      data: {
        fullName: "مدير المنصة الأعلى",
        username: "admin",
        email: "admin@skoola.com",
        phone: "01000000000",
        passwordHash: passHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log("CREATED_SUPER_ADMIN:", JSON.stringify(newAdmin));
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
