import { createCustomer } from "./stripe";

export interface Invoice {
  id: string;
  amount: number;
  status: "draft" | "paid" | "void";
}

export class InvoiceService {
  async generateInvoice(tenantId: string, amount: number): Promise<Invoice> {
    return {
      id: `inv_${Date.now()}`,
      amount,
      status: "draft",
    };
  }
}
