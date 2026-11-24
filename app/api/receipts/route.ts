import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { receipts } from '@/db/schema';
import { failure, identity, json, readJson } from '@/lib/api';
import { validateReceipt, ValidationError } from '@/lib/domain';

export async function POST(request: Request) {
  try {
    const owner = identity(request, true),
      input = await readJson(request, 2_000_000),
      receipt = validateReceipt(input),
      db = getDb(),
      now = new Date().toISOString();

    const row = await db
      .insert(receipts)
      .values({
        id: receipt.id,
        owner,
        period: receipt.period,
        category: receipt.category,
        title: receipt.title,
        account: receipt.account,
        amount: receipt.amount,
        paidAmount: receipt.paidAmount,
        status: receipt.status,
        dueDate: receipt.dueDate,
        paidDate: receipt.paidDate,
        items: JSON.stringify(receipt.items),
        fileName: receipt.fileName,
        fileData: receipt.fileData,
        notes: receipt.notes,
        created: receipt.created || now,
        updated: now,
      })
      .onConflictDoUpdate({
        target: [receipts.owner, receipts.period, receipts.category, receipts.account],
        set: {
          title: receipt.title,
          amount: receipt.amount,
          paidAmount: receipt.paidAmount,
          status: receipt.status,
          dueDate: receipt.dueDate,
          paidDate: receipt.paidDate,
          items: JSON.stringify(receipt.items),
          fileName: receipt.fileName,
          fileData: receipt.fileData,
          notes: receipt.notes,
          updated: now,
        },
      })
      .returning();

    const saved = row[0];
    return json({
      ok: true,
      receipt: {
        ...saved,
        items: JSON.parse(saved.items),
      },
    });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const owner = identity(request, true),
      input = await readJson(request),
      id = String(input?.id || '').trim();

    if (!id) throw new ValidationError('Укажите идентификатор квитанции.');

    const db = getDb();
    const result = await db
      .delete(receipts)
      .where(and(eq(receipts.owner, owner), eq(receipts.id, id)))
      .returning({ id: receipts.id });

    if (!result.length) {
      throw new ValidationError('Квитанция не найдена.');
    }

    return json({ ok: true, deleted: id });
  } catch (e) {
    return failure(e);
  }
}
