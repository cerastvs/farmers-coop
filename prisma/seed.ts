import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  Role,
  PaymentType,
  PaymentStatus,
  LoanStatus,
  MachineStatus,
  SupplyTransactionType,
  TransactionStatus,
  ApplicationStatus,
} from "../app/generated/prisma/enums";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Cleanup existing data
  await prisma.auditTrail.deleteMany();
  await prisma.report.deleteMany();
  await prisma.log.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.machineRequest.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.supplyTransaction.deleteMany();
  await prisma.supply.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.loanStatusHistory.deleteMany();
  await prisma.loanPayment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.application.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  const member = await prisma.user.create({
    data: {
      username: "member1",
      password: await bcrypt.hash("password123", 10),
      name: "Juan Dela Cruz",
      role: Role.MEMBER,
    },
  });

  const president = await prisma.user.create({
    data: {
      username: "president1",
      password: await bcrypt.hash("password123", 10),
      name: "Maria Santos",
      role: Role.PRESIDENT,
    },
  });

  const treasurer = await prisma.user.create({
    data: {
      username: "treasurer1",
      password: await bcrypt.hash("password123", 10),
      name: "Pedro Reyes",
      role: Role.TREASURER,
    },
  });

  const secretary = await prisma.user.create({
    data: {
      username: "secretary1",
      password: await bcrypt.hash("password123", 10),
      name: "Ana Garcia",
      role: Role.SECRETARY,
    },
  });

  const applicant = await prisma.user.create({
    data: {
      username: "applicant1",
      password: await bcrypt.hash("password123", 10),
      name: "Jose Rizal",
      role: Role.APPLICANT,
    },
  });

  await prisma.post.createMany({
    data: [
      {
        title: "Welcome to the Cooperative",
        content: "Happy to be part of this organization!",
        published: true,
        authorId: member.id,
      },
      {
        title: "Upcoming Meeting",
        content: "There will be a general assembly next week.",
        published: true,
        authorId: president.id,
      },
    ],
  });

  await prisma.application.create({
    data: {
      userId: applicant.id,
      fullName: "Jose Rizal",
      age: 30,
      gender: "Male",
      address: "123 Rizal St, Manila",
      contact: "09123456789",
      farmSize: 2.5,
      cropType: "Rice",
      yearsFarming: 5,
      validIdUrl: "https://example.com/valid-id.jpg",
      proofOfFarmUrl: "https://example.com/proof-of-farm.jpg",
      status: ApplicationStatus.PENDING,
    },
  });

  await prisma.application.create({
    data: {
      userId: member.id,
      fullName: "Juan Dela Cruz",
      age: 45,
      gender: "Male",
      address: "456 Mabini Ave, Quezon City",
      contact: "09987654321",
      farmSize: 5.0,
      cropType: "Corn",
      yearsFarming: 10,
      validIdUrl: "https://example.com/valid-id2.jpg",
      proofOfFarmUrl: "https://example.com/proof-of-farm2.jpg",
      status: ApplicationStatus.APPROVED,
      reviewedBy: president.id,
    },
  });

  const loan = await prisma.loan.create({
    data: {
      userId: member.id,
      name: "Cash Loan",
      amount: 5000,
      status: LoanStatus.ACTIVE,
      due: new Date(new Date().setMonth(new Date().getMonth() + 3)),
    },
  });

  await prisma.loanPayment.create({
    data: {
      loanId: loan.id,
      amount: 1000,
      receiptNo: "RCP-2026-0001",
    },
  });

  await prisma.loanStatusHistory.createMany({
    data: [
      { loanId: loan.id, status: LoanStatus.PENDING },
      { loanId: loan.id, status: LoanStatus.APPROVED },
      { loanId: loan.id, status: LoanStatus.ACTIVE },
    ],
  });

  await prisma.payment.createMany({
    data: [
      {
        userId: member.id,
        type: PaymentType.APPLICATION_FEE,
        amount: 100,
        status: PaymentStatus.VERIFIED,
        receiptUrl: "https://example.com/receipt1.jpg",
        verifiedBy: treasurer.id,
      },
      {
        userId: applicant.id,
        type: PaymentType.APPLICATION_FEE,
        amount: 100,
        status: PaymentStatus.PENDING,
        receiptUrl: null,
      },
    ],
  });

  const fertilizer = await prisma.supply.create({
    data: {
      productName: "Fertilizer",
      price: 1200,
      quantity: 100,
    },
  });

  const seeds = await prisma.supply.create({
    data: {
      productName: "Rice Seeds",
      price: 500,
      quantity: 200,
    },
  });

  await prisma.supplyTransaction.createMany({
    data: [
      {
        userId: member.id,
        supplyId: fertilizer.id,
        quantity: 2,
        totalPrice: 2400,
        type: SupplyTransactionType.PURCHASE,
        status: TransactionStatus.COMPLETED,
      },
      {
        userId: member.id,
        supplyId: seeds.id,
        quantity: 5,
        totalPrice: 2500,
        type: SupplyTransactionType.LOAN,
        status: TransactionStatus.APPROVED,
      },
    ],
  });

  const tractor = await prisma.machine.create({
    data: {
      name: "Tractor",
      description: "Used for plowing fields",
      quantity: 3,
    },
  });

  const harvester = await prisma.machine.create({
    data: {
      name: "Rice Harvester",
      description: "Used for harvesting rice",
      quantity: 2,
    },
  });

  await prisma.machineRequest.createMany({
    data: [
      {
        userId: member.id,
        machineId: tractor.id,
        status: MachineStatus.APPROVED,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 2)),
      },
      {
        userId: member.id,
        machineId: harvester.id,
        status: MachineStatus.QUEUED,
      },
    ],
  });

  await prisma.availability.createMany({
    data: [
      {
        userId: member.id,
        date: new Date(),
        location: "Barangay Hall",
        notes: "Available for farm inspection",
      },
      {
        userId: secretary.id,
        date: new Date(new Date().setDate(new Date().getDate() + 1)),
        location: "Cooperative Office",
        notes: "Available for document signing",
      },
    ],
  });

  await prisma.log.createMany({
    data: [
      { info: "System initialized" },
      { info: "Member Juan Dela Cruz registered" },
      { info: "Loan #1 approved by president" },
    ],
  });

  await prisma.auditTrail.createMany({
    data: [
      {
        userId: president.id,
        action: "APPROVED",
        entity: "Application",
        entityId: member.id,
      },
      {
        userId: treasurer.id,
        action: "VERIFIED",
        entity: "Payment",
        entityId: member.id,
      },
    ],
  });

  await prisma.report.createMany({
    data: [
      {
        title: "Monthly Loan Report - April 2026",
        generatedBy: treasurer.id,
      },
      {
        title: "Supply Inventory Report - April 2026",
        generatedBy: secretary.id,
      },
    ],
  });

  console.log("✅ Seeded all models successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
