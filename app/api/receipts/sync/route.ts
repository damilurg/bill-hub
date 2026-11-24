import { getDb } from '@/db';
import { receipts } from '@/db/schema';
import { failure, identity, json, readJson } from '@/lib/api';
import { syncMydomReceipt } from '@/lib/mydom-adapter';

export async function POST(request: Request) {
  try {
    const owner = identity(request, true);
    const input = await readJson(request);
    const account = input?.account ? String(input.account).trim() : undefined;
    const phone = input?.phone ? String(input.phone).trim() : undefined;
    const token = input?.token ? String(input.token).trim() : undefined;
    const period = input?.period ? String(input.period).trim() : undefined;

    const result = await syncMydomReceipt({
      account,
      phone,
      token,
      period,
    });

    const receipt = result.receipt;
    const db = getDb();
    const now = new Date().toISOString();

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
      source: result.source,
      message: result.message,
      receipt: {
        ...saved,
        items: JSON.parse(saved.items),
      },
    });
  } catch (e) {
    return failure(e);
  }
}
