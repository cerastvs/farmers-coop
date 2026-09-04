import { Prisma, SmsStatus } from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";

/**
 * Creates an SMS task for the Secretary. This does NOT actually deliver a
 * message; it records an actionable task that the Secretary (the SMS handler)
 * will process. Reconciliation (delivery status) can be updated later.
 */
export async function createSmsTask(
  tx: Prisma.TransactionClient,
  input: {
    recipient: string;
    message: string;
    userId?: string;
    metadata?: Prisma.InputJsonValue;
    status?: SmsStatus;
    createdBy?: string;
  },
) {
  return tx.smsMessage.create({
    data: {
      recipient: input.recipient,
      message: input.message,
      userId: input.userId,
      metadata: input.metadata,
      status: input.status ?? SmsStatus.PENDING,
      sentBy: input.createdBy,
    },
  });
}

export function phoneFromContact(contact: string | null | undefined) {
  if (!contact) return null;
  const digits = contact.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? `+63${digits}` : `+${digits}`;
}

/**
 * "Sends" an SMS by recording it as SENT with a timestamp. Actual SMS gateway
 * integration would replace this, but the record is immutable and traceable so
 * a real gateway can be added without changing the audit trail.
 */
export async function sendSmsRecord(
  tx: Prisma.TransactionClient,
  smsId: string,
  sentBy: string,
) {
  const sms = await tx.smsMessage.findUnique({ where: { id: smsId } });
  if (!sms) throw new ApiError(404, "SMS task not found");
  if (sms.status === SmsStatus.SENT) {
    throw new ApiError(409, "SMS already marked as sent");
  }

  const updated = await tx.smsMessage.updateMany({
    where: { id: smsId, status: SmsStatus.PENDING },
    data: { status: SmsStatus.SENT, sentBy, sentAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new ApiError(409, "SMS task can no longer be sent");
  }
  return tx.smsMessage.findUniqueOrThrow({ where: { id: smsId } });
}

export async function failSmsRecord(
  tx: Prisma.TransactionClient,
  smsId: string,
  error: string,
) {
  const updated = await tx.smsMessage.updateMany({
    where: { id: smsId, status: SmsStatus.PENDING },
    data: { status: SmsStatus.FAILED, error },
  });
  if (updated.count !== 1) {
    throw new ApiError(409, "SMS task can no longer be updated");
  }
  return tx.smsMessage.findUniqueOrThrow({ where: { id: smsId } });
}
